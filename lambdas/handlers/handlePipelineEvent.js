const AWS = require("aws-sdk");
const logger = require('../lib/logger')(module.filename);

var codepipeline = new AWS.CodePipeline();

async function getPipelineState(name){
    var params = {
        name: name
    };
    try {  
        logger.info("Getting pipeline state for " + name, {
            'codepipeline.getPipelineState': params
        })
        const state_results = await codepipeline.getPipelineState(params).promise()
        logger.info("Pipeline State", {
            pipelineName: name,
            stateResponse: state_results
        });
        return state_results
    } catch (error) {
        logger.error("Failed getting pipeline status", {
            pipelineName: name,
            error: error
        })
        throw error
    }
}

async function putPipelineStateInDynamo(pipeline_state){
    const DYNAMODB_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME

    logger.info("Updating DynamoDb", {
        pipelineName: pipeline_state.pipelineName,
        dynamoDbTable: DYNAMODB_TABLE_NAME
    })

    const docClient = new AWS.DynamoDB.DocumentClient();

    var params = {
        TableName: DYNAMODB_TABLE_NAME,
        Item: pipeline_state
    };

    // Call DynamoDB to add the item to the table
    try {
        const ddb_result = await docClient.put(params).promise()
        
        logger.info("dynamodb.documentClient.put", 
            {result: ddb_result}
        )
    } catch (error) {
        logger.log(error.message,{
            error: error
        });
    }
    
}


exports.handle = async (event, context) => {
    let params;
    logger.info("Event", { event: event });
    logger.info("Context", { context: context} );
    try {
        const pipeline_name = event.detail.pipeline;

        const pipeline_state = await getPipelineState(pipeline_name)
        logger.info("pipeline state received", {
            pipelineName: pipeline_state.pipelineName,
            state: pipeline_state
        })

        await putPipelineStateInDynamo(pipeline_state)

    } catch (e) {
        logger.error(e.message, {error: e});
        throw e;
    }
};