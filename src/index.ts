import "./config/dynamoose.ts";

import express from "express";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
// import dynamoose from "dynamoose";

// route imports

// configs
dotenv.config();

const isProduction = process.env.NODE_ENV === "production";
// // if ! production then connect to dynamoDb
// if (!isProduction) {
//   dynamoose.aws.ddb.local();
// }

// app
const app = express();

// middlewares
app.use(express.json());
app.use(helmet());
// allowing request from other domain
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(morgan("common"));
app.use(cors());

// routes
app.get("/", (req, res) => {
  res.send("hello from server!");
});

// server
const PORT = process.env.PORT || 3000;

if (!isProduction) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}
