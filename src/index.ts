import "./config/dynamoose.js";

import express from "express";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { fileURLToPath } from "url";
import { dirname } from "path";

// import dynamoose from "dynamoose";

// route imports
import courseRoutes from "./routes/courseRoutes.js";
import userClerkRoutes from "./routes/userClerkRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";

// middlewares
import {
  clerkMiddleware,
  createClerkClient,
  requireAuth,
} from "@clerk/express";
import path from "path";

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
const corsOptions = {
  origin: process.env.CLIENT_URL || "http://localhost:3000", // Your frontend URL
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  optionsSuccessStatus: 200,
};

// Apply CORS globally
app.use(cors(corsOptions));
app.use(helmet());
// allowing request from other domain
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));
app.use(morgan("common"));
// middleware for checking clerk token
app.use(clerkMiddleware());

// serving static files
// 1. Get the current file's path (equivalent to __filename)
const __filename = fileURLToPath(import.meta.url);
// 2. Get the current file's directory (equivalent to __dirname)
const __dirname = dirname(__filename);
// --- End of fix ---
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// routes
app.get("/", (req, res) => {
  res.send("hello from server!");
});

app.use("/courses", courseRoutes);
app.use("/user/clerk", requireAuth(), userClerkRoutes);
app.use("/api/payments", paymentRoutes);

// server
const PORT = process.env.PORT || 3000;

if (!isProduction) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}
