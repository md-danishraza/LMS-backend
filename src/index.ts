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
// rate limiter
import rateLimit from "express-rate-limit";

// Model
import ChatMessage from "./models/chatMessageModel.js";

// import dynamoose from "dynamoose";

// route imports
import courseRoutes from "./routes/courseRoutes.js";
import userClerkRoutes from "./routes/userClerkRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import userCourseProgressRoutes from "./routes/userCourseProgressRoutes.js";
import mentorshipRoutes from "./routes/mentorShipRoutes.js";
import emailRoutes from "./routes/emailRoutes.js";
import { clerkClient } from "@clerk/clerk-sdk-node";

// middlewares
import {
  clerkMiddleware,
  // createClerkClient,
  requireAuth,
} from "@clerk/express";

// configs
dotenv.config();

// creating instance of clerk client and exporting it
// export const clerkClient = createClerkClient({
//   secretKey: process.env.CLERK_SECRET_KEY as string,
// });
export { clerkClient };

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

// --- 2. SECURITY: Rate Limiter (Prevent DDoS/Brute Force) ---
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});
app.use(limiter);

// --- 3. SECURITY: Socket.io Authentication Middleware ---
// This blocks anyone who doesn't have a valid Clerk Token
io.use(async (socket, next) => {
  try {
    // Client must send token in auth object: io(url, { auth: { token: "..." } })
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }

    // Verify token with Clerk
    // This throws an error if token is invalid or expired
    const decoded = await clerkClient.verifyToken(token);

    // Attach the REAL user ID to the socket object
    // We do NOT trust the userId sent from the frontend body
    socket.data.userId = decoded.sub;

    next();
  } catch (err) {
    console.error("Socket authentication failed:", err);
    next(new Error("Authentication error"));
  }
});

// --- 4. Secured Socket Logic ---
io.on("connection", (socket) => {
  // console.log("User connected:", socket.data.userId); // Now we know WHO connected

  socket.on("joinRoom", ({ sessionId }) => {
    // Optional TODO: Check DB if socket.data.userId is actually
    // the teacher or student of this sessionId for extra security.
    socket.join(sessionId);
  });

  socket.on("sendMessage", async (data) => {
    // SECURITY: We overwrite senderId with the authenticated ID
    const senderId = socket.data.userId;
    const { sessionId, senderName, text } = data;

    try {
      const newMessage = new ChatMessage({
        sessionId,
        timestamp: Date.now(),
        senderId, // Secure ID
        senderName,
        text,
      });
      await newMessage.save();

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
app.use("/api/emails", emailRoutes);

// server
const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
