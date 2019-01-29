const AWS = require("aws-sdk");
// const logger = require("../lib/logger")(module.filename);

const logger = require('logging/logger')(module.filename)

async function getAllPipelineStates() {
  var documentClient = new AWS.DynamoDB.DocumentClient();
  const DYNAMODB_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME;
  
  try {
    var params = {
        TableName: DYNAMODB_TABLE_NAME,
        Select: 'ALL_ATTRIBUTES'
    };

    logger.info("Getting all pipelines from dynamodb", {
      "documentClient.scan params": params,
    });
  
    var results = await documentClient.scan(params).promise();

    logger.info("Found Dynamo Data", {
      results: results
    });
    return results;
  } catch (error) {
    logger.error("Failed getting pipelines from dynamodb", {
      error: error
    });
    throw error;
  }
}

function generateDashBoardJson(raw_pipeline_states){

    let dashboard_json = {
        "pipelines": raw_pipeline_states.Items
    }
    return dashboard_json
}

async function putPipelineStateInS3(pipeline_state) {
  const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;
  const S3_BUCKET_DATA_KEY = process.env.S3_BUCKET_DATA_KEY;
  var s3 = new AWS.S3();

  try {
    const s3_target_config = {
      Bucket: S3_BUCKET_NAME,
      Key: S3_BUCKET_DATA_KEY,
      Body: JSON.stringify(pipeline_state),
      ContentType: "application/json"
    };

    await s3.putObject(s3_target_config).promise();

  } catch (error) {
    logger.error("Failed uploading dashboard json", {
      targetBucket: S3_BUCKET_NAME,
      targetObjectKey: S3_BUCKET_DATA_KEY,
      error: error
    });
  }
}

exports.handle = async (event, context) => {
  logger.info("Event", { event: event });
  logger.info("Context", { context: context });

  try {
    const all_pipeline_states = await getAllPipelineStates();
    
    s3_data = generateDashBoardJson(all_pipeline_states);

    await putPipelineStateInS3(s3_data);

    logger.info("Updated Dashboard with all pipelines");
  } catch (error) {
    logger.error(error.message, { error: error });
    throw error;
  }
};
