import dynamoose from "dynamoose";
import { DynamoDB, type DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";

const isProduction = process.env.NODE_ENV === "production";

const clientConfig: DynamoDBClientConfig = {
  region: process.env.AWS_REGION || "ap-south-1",
};

if (!isProduction) {
  clientConfig.endpoint = "http://localhost:8000";
  clientConfig.credentials = {
    accessKeyId: "dummyKey",
    secretAccessKey: "dummySecret",
  };
}

const ddb = new DynamoDB(clientConfig);
dynamoose.aws.ddb.set(ddb);

// 1. Create an async function to check the connection
const checkDbConnection = async () => {
  try {
    // Perform a simple, low-cost operation to test the connection
    await ddb.listTables({});
    if (!isProduction) {
      console.log(
        "✅ DynamoDB (Local) connected successfully at http://localhost:8000"
      );
    } else {
      console.log(
        `✅ DynamoDB (AWS) connected successfully in region: ${clientConfig.region}`
      );
    }
  } catch (error) {
    console.error("❌ Could not connect to DynamoDB.");
    console.error(
      "   Please ensure the Docker container is running or AWS credentials are set."
    );

    // Check if the error is an instance of the Error class
    if (error instanceof Error) {
      console.error("   Error details:", error.message);
    } else {
      // Handle cases where the thrown value is not an Error object
      console.error("   An unknown error occurred:", error);
    }

    process.exit(1);
  }
};

// 2. Call the function to perform the check when the app starts
checkDbConnection();

export default dynamoose;
