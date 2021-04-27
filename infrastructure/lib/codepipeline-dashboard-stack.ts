import dynamodb = require('@aws-cdk/aws-dynamodb');
import lambda = require('@aws-cdk/aws-lambda');
import s3 = require('@aws-cdk/aws-s3');
import s3deploy = require('@aws-cdk/aws-s3-deployment');
import iam = require('@aws-cdk/aws-iam');
import route53 = require('@aws-cdk/aws-route53');
import events = require('@aws-cdk/aws-events')
import cdk = require('@aws-cdk/core');

export interface CodepipelineDashboardProps {
  namespace: string;
  hostedZoneName: string;
  restrictedCidrs: string;
}
export class CodepipelineDashboard extends cdk.Construct {
  constructor(scope: cdk.App, id: string, props: CodepipelineDashboardProps) {
    super(scope, id);

    const hosted_zone_id = 'Z3BJ6K6RIION7M' // this is for s3, constant everywhere.

    const bucket = new s3.Bucket(this, 'dashboardBucket', {
      bucketName: `pipeline-dashboard-bucket-${props.namespace}-${cdk.Aws.ACCOUNT_ID}`
    })
    const bucket_name = bucket.bucketName

    const hosted_zone_name = props.hostedZoneName
    const restricted_cidrs = props.restrictedCidrs
    let all_cidrs;

    if(restricted_cidrs){
      all_cidrs = restricted_cidrs.replace(/ /g,'').split(",")
    }

    const website_bucket_name = bucket_name + '.' + hosted_zone_name
    
    let the_bucket = new s3.Bucket(this, 'WebBucket', {
      bucketName: website_bucket_name,
      websiteErrorDocument: 'error.html',
      websiteIndexDocument: 'index.html',
    })

    const dns_entry = bucket_name + '.' + hosted_zone_name;
    const s3_url = 's3-website-' + cdk.Aws.REGION + '.amazonaws.com';

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

    new cdk.CfnOutput(this, 'ExternalDNS', { value: 'http://' + dns_entry });
    new cdk.CfnOutput(this, 'DirectBucketURL', { value: 'http://' + the_bucket.bucketName + '.' + s3_url });

    const bucket_statement = the_bucket.grantPublicAccess();
    if(all_cidrs){
      bucket_statement.resourceStatement?.addCondition('IpAddress', { "aws:SourceIp": all_cidrs });
    }
    
    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deploy.Source.asset('../src')],
      destinationBucket: the_bucket,
      retainOnDelete: true, // there are bugs if this is false
      // destinationKeyPrefix: 'web/sttic' // optional prefix in destination bucket
    }as s3deploy.BucketDeploymentProps);

    // dynamodb table
    const table = new dynamodb.Table(this, 'Table', {
      readCapacity: 1,
      writeCapacity: 1,
      partitionKey: { name: 'pipelineName', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'pipelineVersion', type: dynamodb.AttributeType.NUMBER },
    }as dynamodb.TableProps);

    // lambda role
    const role = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com')
    });
    
    const dynamoPolicy = new iam.PolicyStatement();
    dynamoPolicy.addActions("dynamoDB:*")
    dynamoPolicy.addResources(table.tableArn)

    const logPolicy = new iam.PolicyStatement()
    logPolicy.addActions("logs:*")
    logPolicy.addAllResources()
    
    const pipelinePolicy = new iam.PolicyStatement()
    pipelinePolicy.addActions("codepipeline:GetPipelineState")
    pipelinePolicy.addAllResources()
    
    const s3Policy = new iam.PolicyStatement()
    s3Policy.addActions("s3:*")
    s3Policy.addResources(the_bucket.bucketArn)
    s3Policy.addResources(the_bucket.bucketArn + "/*")

    // lambda function to handle events from codepipeline
    const pipeline_event_lambda = new lambda.Function(this, 'PipelineUpdateEvent', {
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: 'handlePipelineEvent/handlePipelineEvent.handle',
      code: lambda.Code.asset('../lambdas'),
      role: role,
    });

    //  lambda function to aggregate dynamo records into dashboard data
    const pipeline_summary_lambda = new lambda.Function(this, 'PipelineSummary', {
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: 'createPipelineSummary/createPipelineSummary.handle',
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
