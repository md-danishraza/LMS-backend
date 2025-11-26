import "./config/dynamoose.js";

import express from "express";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
// server with socketIO
import { createServer } from "http";
import { Server } from "socket.io";

// Model
import ChatMessage from "./models/chatMessageModel.js";

// import dynamoose from "dynamoose";

// route imports
import courseRoutes from "./routes/courseRoutes.js";
import userClerkRoutes from "./routes/userClerkRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import userCourseProgressRoutes from "./routes/userCourseProgressRoutes.js";
import mentorshipRoutes from "./routes/mentorShipRoutes.js";

// middlewares
import {
  clerkMiddleware,
  createClerkClient,
  requireAuth,
} from "@clerk/express";

// configs
dotenv.config();

// creating instance of clerk client and exporting it
export const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY as string,
});

// app
const app = express();

// --- 1. Create HTTP Server & Attach Socket.io ---
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// --- 2. Socket.io Logic ---
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // User joins a session room
  socket.on("joinRoom", ({ sessionId }) => {
    socket.join(sessionId);
    // console.log(`User joined room: ${sessionId}`);
  });

  // User sends a message
  socket.on("sendMessage", async (data) => {
    const { sessionId, senderId, senderName, text } = data;

    // A. Save to Database (DynamoDB)
    try {
      const newMessage = new ChatMessage({
        sessionId,
        timestamp: Date.now(),
        senderId,
        senderName,
        text,
      });
      await newMessage.save();

      // B. Broadcast to everyone in the room (including sender)
      io.to(sessionId).emit("newMessage", newMessage);
    } catch (err) {
      console.error("Error saving chat message:", err);
    }
  });

  socket.on("disconnect", () => {
    // console.log("User disconnected");
  });
});

// middlewares
const corsOptions = {
  origin: process.env.CLIENT_URL || "http://localhost:3000", // frontend URL
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

// routes
app.get("/", (req, res) => {
  res.send("hello from server!");
});

app.use("/courses", courseRoutes);
app.use("/user/clerk", requireAuth(), userClerkRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/users/course-progress", requireAuth(), userCourseProgressRoutes);
app.use("/mentorship", mentorshipRoutes);

// server
const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
