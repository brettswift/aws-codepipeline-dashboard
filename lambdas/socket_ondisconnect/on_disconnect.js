const logger = require('logging/logger')(module.filename)

var AWS = require("aws-sdk");
AWS.config.update({ region: process.env.AWS_REGION });

var DDB = new AWS.DynamoDB({apiVersion: "2012-10-08"});

exports.handler = function (event, context, callback) {
  var disconnectParams = {
    TableName: process.env.DYNAMODB_TABLE_NAME,
    Key: {
      connectionId: { S: event.requestContext.connectionId }
    }
  };

  try {
    DDB.deleteItem(disconnectParams)
    return {
      statusCode: 200,
      body: "Disconnected."
    }
  
  } catch (error) {
    return {
      statusCode: 500,
      body: "Failed to disconnect client: " + JSON.stringify(error)
    }
  }
};