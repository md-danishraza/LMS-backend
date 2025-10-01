import dynamoose from "dynamoose";
// Import both DynamoDB and the config type
import { DynamoDB, type DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";

const isProduction = process.env.NODE_ENV === "production";

// FIX 1: Use the DynamoDBClientConfig type for your configuration object
const clientConfig: DynamoDBClientConfig = {
  region: process.env.AWS_REGION || "ap-south-1",
};

// Now TypeScript knows that 'endpoint' and 'credentials' are valid properties
if (!isProduction) {
  clientConfig.endpoint = "http://localhost:8000";
  clientConfig.credentials = {
    accessKeyId: "dummyKey",
    secretAccessKey: "dummySecret",
  };
}

// FIX 2: Create an instance of 'DynamoDB', not 'DynamoDBClient'
const ddb = new DynamoDB(clientConfig);

// Set the DynamoDB instance for Dynamoose to use
dynamoose.aws.ddb.set(ddb);

if (!isProduction) {
  console.log(
    "✅ DynamoDB (Local) connected successfully at http://localhost:8000"
  );
} else {
  console.log(
    `✅ DynamoDB (AWS) connected successfully in region: ${clientConfig.region}`
  );
}

export default dynamoose;
