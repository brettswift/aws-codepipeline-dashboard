var AWS = require("aws-sdk");
const logger = require('logging/logger')(module.filename)

AWS.config.update({ region: process.env.AWS_REGION });

var DDB = new AWS.DynamoDB({apiVersion: "2012-10-08"});

exports.handle = async (event, context) => {
  var connectParams = {
    TableName: process.env.DYNAMODB_TABLE_NAME,
    Item: {
      connectionId: { S: event.requestContext.connectionId }
    }
  };

  try {
    DDB.putItem(connectParams)

    return {
      statusCode: 200,
      body: "Connected."
    }
  
  } catch (error) {
    return {
      statusCode: 500,
      body: "Failed to connect to client: " + JSON.stringify(error)
    }
  }
};
