import express from "express";
import { requireAuth } from "@clerk/express";
import {
  createSession,
  generateToken,
  getChatHistory,
  getUserSessions,
  updateSessionStatus,
} from "../controllers/mentorShipController.js";

const router = express.Router();

// Schedule a session
router.post("/", requireAuth(), createSession);

// Get sessions for a user (pass ?type=student or ?type=teacher)
router.get("/user/:userId", requireAuth(), getUserSessions);

// marking session to completed by teacher
router.patch("/:sessionId", requireAuth(), updateSessionStatus);

// Get Agora Video Token
router.get("/token/:sessionId", requireAuth(), generateToken);

// Get Chat History
router.get("/chat/:sessionId", requireAuth(), getChatHistory);

export default router;
