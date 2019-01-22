import dynamodb = require('@aws-cdk/aws-dynamodb');
import lambda = require('@aws-cdk/aws-lambda');
import s3 = require('@aws-cdk/aws-s3');
import s3deploy = require('@aws-cdk/aws-s3-deployment');
import iam = require('@aws-cdk/aws-iam');
import route53 = require('@aws-cdk/aws-route53');
import events = require('@aws-cdk/aws-events')
import cdk = require('@aws-cdk/cdk');

function assert_required_param(param_name: string, param_value: string, suggestion?: string){
  suggestion = suggestion || '<value>'
  if(! param_value){
    console.log("-------- PARAMETER REQUIRED ------")
    console.log(`${param_name} is a required parameter` + 
    `You can add it like this:  cdk deploy -c ${param_name}=${suggestion}`
    )
    console.log("")
    throw new Error("required parameter")
  }

}

export class CodepipelineDashboardStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const hosted_zone_id = 'Z3BJ6K6RIION7M' // this is for s3, constant everywhere.

    const bucket_name = this.node.getContext("bucket_name");
    const hosted_zone_name = this.node.getContext("hosted_zone_name")
    const restricted_cidrs = this.node.getContext("restricted_cidrs")
    let all_cidrs;

    if(restricted_cidrs){
      all_cidrs = restricted_cidrs.replace(/ /g,'').split(",")
    }

    assert_required_param('bucket_name', bucket_name);
    assert_required_param('hosted_zone_name', hosted_zone_name, 'example.com')

    const website_bucket_name = bucket_name + '.' + hosted_zone_name
    
    let the_bucket = new s3.Bucket(this, 'WebBucket', {
      bucketName: website_bucket_name,
      websiteErrorDocument: 'error.html',
      websiteIndexDocument: 'index.html',
    })

    const dns_entry = bucket_name + '.' + hosted_zone_name;
    const s3_url = 's3-website-' + this.region + '.amazonaws.com';

    const cfnAliasTaragetProps: route53.CfnRecordSet.AliasTargetProperty = {
      dnsName: s3_url,
      hostedZoneId: hosted_zone_id
    }

    const cfnRecordsetProps: route53.CfnRecordSetProps = {
      name: dns_entry,
      type: 'A',
      aliasTarget: cfnAliasTaragetProps,
      hostedZoneName: hosted_zone_name + '.',
    }
    
    new route53.CfnRecordSet(this, 'DashboardDNS', cfnRecordsetProps)

    new cdk.Output(this, 'ExternalDNS', { value: 'http://' + dns_entry });
    new cdk.Output(this, 'DirectBucketURL', { value: 'http://' + the_bucket.bucketName + '.' + s3_url });

    const bucket_statement = the_bucket.grantPublicAccess();
    if(all_cidrs){
      bucket_statement.addCondition('IpAddress', { "aws:SourceIp": all_cidrs });
    }
    
    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      source: s3deploy.Source.asset('../src'),
      destinationBucket: the_bucket,
      retainOnDelete: true, // there are bugs if this is false
      // destinationKeyPrefix: 'web/sttic' // optional prefix in destination bucket
    });

    // dynamodb table
    const table = new dynamodb.Table(this, 'Table', {
      readCapacity: 1,
      writeCapacity: 1
    });

    table.addPartitionKey({ name: 'pipelineName', type: dynamodb.AttributeType.String });
    table.addSortKey({ name: 'pipelineVersion', type: dynamodb.AttributeType.Number });

    // lambda role
    const role = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com')
    });
    
    role.addToPolicy(new iam.PolicyStatement()
      .addAction("dynamoDB:*")
      .addResource(table.tableArn)
    );

    role.addToPolicy(new iam.PolicyStatement()
      .addAction("logs:*")
      .addAllResources()
    );
    
    role.addToPolicy(new iam.PolicyStatement()
      .addAction("codepipeline:GetPipelineState")
      .addAllResources()
    );
    
    role.addToPolicy(new iam.PolicyStatement()
      .addAction("s3:*")
      .addResource(the_bucket.bucketArn)
      .addResource(the_bucket.bucketArn + "/*")
    );

    // lambda function to handle events from codepipeline
    const pipeline_event_lambda = new lambda.Function(this, 'PipelineUpdateEvent', {
      runtime: lambda.Runtime.NodeJS810,
      handler: 'handlers/handlePipelineEvent.handle',
      code: lambda.Code.asset('../lambdas'),
      role: role,
    });

    //  lambda function to aggregate dynamo records into dashboard data
    const pipeline_summary_lambda = new lambda.Function(this, 'PipelineSummary', {
      runtime: lambda.Runtime.NodeJS810,
      handler: 'handlers/createPipelineSummary.handle',
      code: lambda.Code.asset('../lambdas'),
      role: role,
    });

    // TODO: add timer event on lambda
    const dashboard_summary_rule = new events.EventRule(this, 'ScheduledEvent', {
      ruleName: 'ScheduledDashboardSummaryRule',
      description: 'Runs on a schedule to update the dashboard json',
      targets: [pipeline_summary_lambda],
      scheduleExpression: 'cron(0/1 11-1 ? * MON-FRI *)', //every minute, between 11-1 UTC (MST: 4am-6pm), MON-FRI
    })

    pipeline_summary_lambda.addPermission('allowCloudWatchInvocation', {
      principal: new iam.ServicePrincipal('events.amazonaws.com'),
      sourceArn: dashboard_summary_rule.ruleArn
    });

    pipeline_summary_lambda.addEnvironment("DYNAMODB_TABLE_ARN", table.tableArn);
    pipeline_summary_lambda.addEnvironment("DYNAMODB_TABLE_NAME", table.tableName);
    pipeline_summary_lambda.addEnvironment("S3_BUCKET_NAME", the_bucket.bucketName);
    pipeline_summary_lambda.addEnvironment("S3_BUCKET_DATA_KEY", 'pipeline-state.json');

    the_bucket.addToResourcePolicy(new iam.PolicyStatement()
      .addAction('s3:*')
      .addResource(the_bucket.arnForObjects('*'))
      .addPrincipal(role.principal));
        
    const pipeline_event_rule = new events.EventRule(this, 'PipelineEvent', {
        ruleName: 'PipelineEventRule',
        description: 'Handles state change events from all codepipelines',
        targets: [pipeline_event_lambda],
    })

    // to only get events at a more macro level, change the word 'Action' in detail type to 'Stage' or 'Pipeline'.
    pipeline_event_rule.addEventPattern({
      detailType: ['CodePipeline Action Execution State Change'],
      source: ['aws.codepipeline'],
    })

    pipeline_event_lambda.addPermission('allowCloudWatchInvocation', {
      principal: new iam.ServicePrincipal('events.amazonaws.com'),
      sourceArn: pipeline_event_rule.ruleArn,
    });

    pipeline_event_lambda.addEnvironment("DYNAMODB_TABLE_ARN", table.tableArn);
    pipeline_event_lambda.addEnvironment("DYNAMODB_TABLE_NAME", table.tableName);

  }
}
