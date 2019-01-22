#!/usr/bin/env node
import cdk = require('@aws-cdk/cdk');
import { CodepipelineDashboardStack } from '../lib/codepipeline-dashboard-stack';

const app = new cdk.App();
new CodepipelineDashboardStack(app, 'CodepipelineDashboardStack');
app.run();
