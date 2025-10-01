// listTables.js
import { DynamoDBClient, ListTablesCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({
  region: "local",
  endpoint: "http://localhost:8000",
  credentials: {
    accessKeyId: "fakeMyKeyId",
    secretAccessKey: "fakeSecretAccessKey",
  },
});

async function listTables() {
  try {
    const command = new ListTablesCommand({});
    const response = await client.send(command);
    console.log("Tables:", response.TableNames);
  } catch (err) {
    console.error("Error listing tables:", err);
  }
}

listTables();
