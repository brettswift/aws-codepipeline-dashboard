import cdk = require('@aws-cdk/cdk');
import lambda = require('@aws-cdk/aws-lambda');
import events = require('@aws-cdk/aws-events')
import iam = require('@aws-cdk/aws-iam');

export interface DashLambdaProps {
  role: iam.Role,
  handler: string,
  environment: {}
}

export class DashLambda extends cdk.Construct {

  /** allows accessing the lambda function */
  public readonly handler: lambda.Function;

  private id: string;
  constructor(scope: cdk.Construct, id: string, props: DashLambdaProps) {
    super(scope, id);
    
    // store ID for unique naming of resources

    this.id = id
    // lambda function to handle events from codepipeline
    
    this.handler = new lambda.Function(this, id, {
      runtime: lambda.Runtime.NodeJS810,
      handler: props.handler,
      code: lambda.Code.asset('../lambdas'),
      role: props.role,
      environment: props.environment,
    });
    
  }

  add_api_gateway_websocket_permission(){

    this.handler.addPermission('allowCloudWatchInvocation', {
      principal: new iam.ServicePrincipal('*.amazonaws.com'),
      // TODO: add arn when websocket support is here
      sourceArn: "*",
    });

  }

  add_pipeline_action_events(){
    const pipeline_event_rule = new events.EventRule(this, 'PipelineEvent', {
        ruleName: 'PipelineEventRule_' + this.id,
        description: 'Handles state change events from all codepipelines',
        targets: [this.handler],
    })

    // to only get events at a more macro level, change the word 'Action' in detail type to 'Stage' or 'Pipeline'.
    pipeline_event_rule.addEventPattern({
      detailType: ['CodePipeline Action Execution State Change'],
      source: ['aws.codepipeline'],
    })

    this.handler.addPermission('allowCloudWatchInvocation', {
      principal: new iam.ServicePrincipal('events.amazonaws.com'),
      sourceArn: pipeline_event_rule.ruleArn,
    });

  }
}