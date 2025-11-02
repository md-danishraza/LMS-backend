import { Router } from "express";
import {
  createOrder,
  handleWebhook,
  getOrderStatus,
  listTransactions,
} from "../controllers/paymentController.js";
import { requireAuth } from "@clerk/express";
const router = Router();

// 1. Create an order (Frontend calls this)
// This should be a protected route.
router.post("/create-order", requireAuth(), createOrder);

// 2. Get order status (Frontend calls this to verify)
// This should be a protected route.
router.get("/order-status/:userId/:orderId", requireAuth(), getOrderStatus);

// 3. Handle webhook (Cashfree server calls this)
// This route MUST NOT be protected by your auth middleware,
// as it's an automated server-to-server call.
router.post("/webhook", handleWebhook);

// get transactions
router.get("/transactions/:userId", requireAuth(), listTransactions);

export default router;
