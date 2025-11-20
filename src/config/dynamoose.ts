import dynamoose from "dynamoose";
import { DynamoDB, type DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
import dotenv from "dotenv";

dotenv.config();

const isProduction = process.env.NODE_ENV === "production";
// Helper to force cloud DB even in dev (add USE_CLOUD_DB=true to .env)
const useCloudDB = process.env.USE_CLOUD_DB === "true";

const clientConfig: DynamoDBClientConfig = {
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
};

// Only switch to Local Docker if we are NOT in production AND NOT forcing cloud
if (!isProduction && !useCloudDB) {
  clientConfig.endpoint = "http://localhost:8000";
  clientConfig.credentials = {
    accessKeyId: "dummyKey",
    secretAccessKey: "dummySecret",
  };
  console.log("⚙️ Configured for Local DynamoDB");
} else {
  console.log("☁️ Configured for AWS DynamoDB");
}

const ddb = new DynamoDB(clientConfig);

// Set the DynamoDB instance for Dynamoose
dynamoose.aws.ddb.set(ddb);

// This forces all models to have the 'prolearn_' prefix in AWS
dynamoose.Table.defaults.set({
  prefix: "prolearn_",
});

// Check connection
const checkDbConnection = async () => {
  try {
    console.log("⏳ Connecting to DynamoDB...");
    // Listing tables is a lightweight way to verify credentials
    const list = await ddb.listTables({});

    if (list.TableNames) {
      console.log(
        `✅ Connected successfully! Found ${list.TableNames.length} tables.`
      );
    }
  } catch (error) {
    console.error("❌ Connection Failed.");
    if (error instanceof Error) {
      console.error("Error:", error.message);
      console.error("Name:", error.name);

      if (error.name === "UnrecognizedClientException") {
        console.error(
          "👉 Check your AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env"
        );
      }
      if (
        error.name === "NetworkingError" ||
        (error as any).code === "ECONNREFUSED"
      ) {
        console.error(
          "👉 Is your Docker container running? (docker-compose up)"
        );
      }
    }
    process.exit(1);
  }
};

checkDbConnection();

export default dynamoose;
