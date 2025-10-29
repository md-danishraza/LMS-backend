import "./config/dynamoose.js";

import express from "express";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

// import dynamoose from "dynamoose";

// route imports
import courseRoutes from "./routes/courseRoutes.js";
import userClerkRoutes from "./routes/userClerkRoutes.js";
import {
  clerkMiddleware,
  createClerkClient,
  requireAuth,
} from "@clerk/express";

// configs
dotenv.config();

const isProduction = process.env.NODE_ENV === "production";

// creating instance of clerk client and exporting it
export const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY as string,
});

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
// middleware for checking clerk token
app.use(clerkMiddleware());

app.use(
  cors({
    origin: "http://localhost:3000", // React app origin
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

// routes
app.get("/", (req, res) => {
  res.send("hello from server!");
});

app.use("/courses", courseRoutes);
app.use("/user/clerk", requireAuth(), userClerkRoutes);

// server
const PORT = process.env.PORT || 3000;

if (!isProduction) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}
