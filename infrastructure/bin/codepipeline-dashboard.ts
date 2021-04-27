#!/usr/bin/env node
import cdk = require('@aws-cdk/cdk');
import { CodepipelineDashboardStack } from '../lib/codepipeline-dashboard-stack';


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


const app = new cdk.App();
new CodepipelineDashboardStack(app, 'CodepipelineDashboardStack');
app.run();
