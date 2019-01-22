#!/usr/bin/env bash 

cdk deploy
aws codepipeline start-pipeline-execution --name Orchestratedbswift-Pipeline-LFCIG6BV21B0
docker run -it -v /Users/bswift/.aws:/root/.aws --rm shaw-support-aws awslogs get -G -s 1m -w /aws/lambda/CodepipelineDashboardStac-PipelineUpdateEventA8B49-1087NS9Q5FZHV

