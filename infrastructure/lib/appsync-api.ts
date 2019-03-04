import cdk = require('@aws-cdk/cdk');
import lambda = require('@aws-cdk/aws-lambda');
import events = require('@aws-cdk/aws-events')
import iam = require('@aws-cdk/aws-iam');
import appsync = require('@aws-cdk/aws-appsync')

export interface AppSyncApiProps {
}

export class AppSyncApi extends cdk.Construct {

  /** allows accessing the lambda function */
  // public readonly handler: lambda.Function;

  // private id: string;
  constructor(scope: cdk.Construct, id: string, props: AppSyncApiProps) {
    super(scope, id);
    
    console.log(props);

    // store ID for unique naming of resources

    // this.id = id
    // lambda function to handle events from codepipeline
    
    const api_props: appsync.CfnGraphQLApiProps = {
      authenticationType: 'ApiKey',
      name: 'api'
    }

    // const api = new appsync.CfnGraphQLApi(this, 'api', api_props)
    const schema_props: appsync.CfnGraphQLSchemaProps = {}

    const api = new appsync.CfnGraphQLSchema(this, 'schema', schema_props )

  }
}