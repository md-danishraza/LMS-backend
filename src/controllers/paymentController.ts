import dotenv from "dotenv";

// Load environment variables FIRST
dotenv.config();

import type { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import crypto from "crypto";
import Course from "../models/courseModel.js";
import Transaction from "../models/transactionModel.js";
import UserCourseProgress from "../models/userCourseProgressModel.js";

const CASHFREE_CLIENT_ID = process.env.CASHFREE_CLIENT_ID!;
const CASHFREE_CLIENT_SECRET = process.env.CASHFREE_CLIENT_SECRET!;
const CASHFREE_API_URL = "https://sandbox.cashfree.com/pg";

// Validate on module load
if (!CASHFREE_CLIENT_ID || !CASHFREE_CLIENT_SECRET) {
  console.error(
    "❌ CRITICAL: Cashfree credentials not found in environment variables"
  );
  console.error("Please check your .env file contains:");
  console.error("  - CASHFREE_CLIENT_ID");
  console.error("  - CASHFREE_CLIENT_SECRET");
}

/**
 * CREATE ORDER
 */
export const createOrder = async (req: Request, res: Response) => {
  try {
    const { courseId, userId } = req.body;
    if (!courseId || !userId) {
      return res
        .status(400)
        .json({ message: "Course ID and User ID are required", data: null });
    }

    // Validate Cashfree credentials
    if (
      !process.env.CASHFREE_CLIENT_ID ||
      !process.env.CASHFREE_CLIENT_SECRET
    ) {
      return res.status(500).json({
        message: "Payment gateway not configured properly",
        data: null,
      });
    }

    const course = await Course.get(courseId);
    if (!course || !course.price) {
      return res
        .status(404)
        .json({ message: "Course not found or has no price", data: null });
    }

    const orderId = `ORD-${uuidv4()}`;

    // Cashfree API call
    const response = await axios.post(
      `${
        process.env.CASHFREE_API_URL || "https://sandbox.cashfree.com/pg"
      }/orders`,
      {
        order_id: orderId,
        order_amount: course.price,
        order_currency: "INR",
        customer_details: {
          customer_id: userId,
          customer_email: "test@email.com",
          customer_phone: "9999999999",
        },
      },
      {
        headers: {
          "x-client-id": process.env.CASHFREE_CLIENT_ID,
          "x-client-secret": process.env.CASHFREE_CLIENT_SECRET,
          "x-api-version": "2023-08-01",
          "Content-Type": "application/json",
        },
      }
    );

    const orderDetails = response.data;

    // Record the transaction
    const newTransaction = new Transaction({
      userId,
      transactionId: orderId,
      dateTime: new Date().toISOString(),
      courseId,
      paymentProvider: "cashfree",
      amount: course.price,
      status: "PENDING",
    });
    await newTransaction.save();
    console.log(orderDetails);
    // Unified { message, data } response
    res.status(200).json({ message: "Order created", data: orderDetails });
  } catch (error: any) {
    res.status(500).json({
      message:
        error.response?.data?.message ||
        error.message ||
        "Error creating payment order",
      data: null,
    });
  }
};

/**
 * HANDLE WEBHOOK - Critical for production
 */
export const handleWebhook = async (req: Request, res: Response) => {
  try {
    // Verify webhook signature
    const receivedSignature = req.headers["x-webhook-signature"] as string;
    const timestamp = req.headers["x-webhook-timestamp"] as string;

    // Get raw body - you need to configure express to capture raw body
    const rawBody = req.body; // This should be the raw string, not parsed JSON

    // Verify signature
    const body = timestamp + JSON.stringify(rawBody);
    const generatedSignature = crypto
      .createHmac("sha256", CASHFREE_CLIENT_SECRET)
      .update(body)
      .digest("base64");

    if (generatedSignature !== receivedSignature) {
      console.error("Invalid webhook signature");
      return res.status(401).send("Invalid signature");
    }

    const { data, type } = req.body;

    // Check for successful payment
    if (type === "PAYMENT_SUCCESS_WEBHOOK") {
      const orderId = data.order.order_id;

      // Find transaction
      const results = await Transaction.query("transactionId")
        .eq(orderId)
        .exec();
      const transaction = results[0];

      if (transaction && transaction.status === "PENDING") {
        // Update transaction
        transaction.status = "SUCCESS";
        await transaction.save();

        const { courseId, userId } = transaction;
        const course = await Course.get(courseId);

        // Enroll user
        await Course.update(
          { courseId },
          {
            $ADD: { enrollments: [{ userId: userId }] },
          }
        );

        // Create progress
        const newProgress = new UserCourseProgress({
          userId: userId,
          courseId: courseId,
          enrollmentDate: new Date().toISOString(),
          overallProgress: 0,
          lastAccessedTimestamp: new Date().toISOString(),
          sections: course.sections.map((section: any) => ({
            sectionId: section.sectionId,
            chapters: section.chapters.map((chapter: any) => ({
              chapterId: chapter.chapterId,
              completed: false,
            })),
          })),
        });
        await newProgress.save();

        console.log(`Payment successful for order ${orderId}`);
      }
    }

    res.status(200).send("Webhook received");
  } catch (error: any) {
    console.error("Webhook error:", error.message);
    res.status(500).send("Webhook processing error");
  }
};

/**
 * GET ORDER STATUS - Polling endpoint
 */
export const getOrderStatus = async (req: Request, res: Response) => {
  try {
    const { userId, orderId } = req.params;

    if (!userId || !orderId) {
      return res
        .status(400)
        .json({ message: "Missing parameters", data: null });
    }

    // --- THIS IS THE FIX ---
    // Use Transaction.get() with the full primary key (userId + transactionId)
    // This is the most efficient lookup possible in DynamoDB.
    const transaction = await Transaction.get({
      userId: userId,
      transactionId: orderId,
    });
    // --- END OF FIX ---

    if (!transaction) {
      return res.status(404).json({
        message: "Transaction not found",
        data: { status: "NOT_FOUND" },
      });
    }

    // If still pending, double-check with Cashfree API (this is excellent, robust logic!)
    if (transaction.status === "PENDING") {
      try {
        const cashfreeResponse = await axios.get(
          `${CASHFREE_API_URL}/orders/${orderId}`,
          {
            headers: {
              "x-client-id": CASHFREE_CLIENT_ID,
              "x-client-secret": CASHFREE_CLIENT_SECRET,
              "x-api-version": "2023-08-01",
            },
          }
        );

        const orderStatus = cashfreeResponse.data.order_status;

        // Update if payment was completed but webhook not received
        if (orderStatus === "PAID" && transaction.status === "PENDING") {
          transaction.status = "SUCCESS";
          await transaction.save();

          // Enroll user (same logic as webhook)
          const { courseId, userId } = transaction;
          const course = await Course.get(courseId);

          // Note: Check if enrollments is a Set. If it's a List,
          // $ADD will append the object, which might cause duplicates.
          // Using a Set of strings `enrollments: { type: Set, schema: [String] }` is safer.
          // Assuming your current schema works:
          await Course.update(
            { courseId },
            { $ADD: { enrollments: [{ userId: userId }] } }
          );

          const newProgress = new UserCourseProgress({
            userId: userId,
            courseId: courseId,
            enrollmentDate: new Date().toISOString(),
            overallProgress: 0,
            lastAccessedTimestamp: new Date().toISOString(),
            sections: course.sections.map((section: any) => ({
              sectionId: section.sectionId,
              chapters: section.chapters.map((chapter: any) => ({
                chapterId: chapter.chapterId,
                completed: false,
              })),
            })),
          });
          await newProgress.save();
        }
      } catch (apiError: any) {
        console.error(
          "Error checking Cashfree API:",
          apiError.response?.data || apiError.message
        );
        // Don't fail the request, just return the pending status
      }
    }

    // Return the (potentially updated) status
    console.log(transaction.status);
    res.status(200).json({
      message: "Status retrieved",
      data: { status: transaction.status },
    });
  } catch (error: any) {
    console.error("Error fetching order status:", error);
    res.status(500).json({
      message: error.message || "Error fetching order status",
      data: null,
    });
  }
};

// list transactions
export const listTransactions = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { userId } = req.query;

  try {
    const transactions = userId
      ? await Transaction.query("userId").eq(userId).exec()
      : await Transaction.scan().exec();

    res.json({
      message: "Transactions retrieved successfully",
      data: transactions,
    });
  } catch (error) {
    res.status(500).json({ message: "Error retrieving transactions", error });
  }
};
