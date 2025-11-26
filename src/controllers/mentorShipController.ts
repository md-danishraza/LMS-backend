import type { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { getAuth } from "@clerk/express";
import MentorshipSession from "../models/mentorShipSessionModel.js";
import ChatMessage from "../models/chatMessageModel.js";

// creating custom commonjs require for the agora ES import
import { require } from "../utils/commonJSReq.js";
const { RtcTokenBuilder, RtcRole } = require("agora-token");

// 1. Create a Session (Booking)
export const createSession = async (req: Request, res: Response) => {
  try {
    const { studentId, teacherId, courseId, date } = req.body;

    if (!studentId || !teacherId || !courseId || !date) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const sessionId = `sess_${uuidv4()}`;

    const session = new MentorshipSession({
      sessionId,
      studentId,
      teacherId,
      courseId,
      date,
      status: "scheduled",
    });

    await session.save();
    res.status(201).json({ message: "Session scheduled", data: session });
  } catch (error) {
    res.status(500).json({ message: "Error creating session", error });
  }
};

// 2. Get Sessions (For Student or Teacher)
export const getUserSessions = async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { type } = req.query; // 'student' or 'teacher'

  try {
    let sessions;
    if (type === "teacher") {
      // FIX: Tell DynamoDB to use the 'teacherId-index'
      sessions = await MentorshipSession.query("teacherId")
        .eq(userId)
        .using("teacherId-index") // This must match the name in AWS EXACTLY
        .exec();
    } else {
      // FIX: Tell DynamoDB to use the 'studentId-index'
      sessions = await MentorshipSession.query("studentId")
        .eq(userId)
        .using("studentId-index") // This must match the name in AWS EXACTLY
        .exec();
    }
    res.json({ message: "User sessions", data: sessions });
  } catch (error) {
    res.status(500).json({ message: "Error fetching sessions", error });
  }
};

// 5. Update Session Status (e.g., Mark as Completed)
export const updateSessionStatus = async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { status } = req.body;

  if (!sessionId || !status) {
    return res.status(400).json({ message: "Session ID and status required" });
  }

  const validStatuses = ["scheduled", "completed", "cancelled"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  try {
    // Update the session in DynamoDB
    // Dynamoose update syntax: Model.update({ key }, { updates })
    const updatedSession = await MentorshipSession.update(
      { sessionId },
      { status }
    );

    res.json({ message: "Session status updated", data: updatedSession });
  } catch (error) {
    console.error("Error updating session:", error);
    res.status(500).json({ message: "Error updating session", error });
  }
};

// 3. Generate Agora Token (Video)
export const generateToken = async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { userId } = getAuth(req);

  if (!sessionId || !userId) {
    return res.status(400).json({ message: "Session ID required" });
  }

  try {
    const appId = process.env.AGORA_APP_ID!;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE!;
    const channelName = sessionId;
    // Use 0 for random UID, or generate a consistent numeric UID from userId if needed
    const uid = 0;
    const role = RtcRole.PUBLISHER;

    const expirationTimeInSeconds = 3600; // Token validity time (1 hour)
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    // The API for buildTokenWithUid is compatible between the two packages
    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      uid,
      role,
      expirationTimeInSeconds, // 6th Arg: Token validity in seconds
      privilegeExpiredTs // 7th Arg: Privilege expiry timestamp
    );

    res.json({
      message: "Token generated",
      data: { token, channelName, uid },
    });
  } catch (error) {
    console.error("Token generation error:", error);
    res.status(500).json({ message: "Error generating token", error });
  }
};

// 4. Get Chat History
export const getChatHistory = async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  try {
    const messages = await ChatMessage.query("sessionId").eq(sessionId).exec();
    // Sort by timestamp ascending
    const sortedMessages = messages.sort((a, b) => a.timestamp - b.timestamp);
    res.json({ message: "Chat history", data: sortedMessages });
  } catch (error) {
    res.status(500).json({ message: "Error fetching chat", error });
  }
};
