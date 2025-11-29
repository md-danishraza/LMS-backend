import express from "express";
import { body } from "express-validator";
import { sendContactEmail } from "../controllers/emailController.js";

const router = express.Router();

router.post(
  "/contact",
  [
    // Validation Middleware
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Must be a valid email address"),
    body("subject").notEmpty().withMessage("Subject is required"),
    body("message")
      .trim()
      .isLength({ min: 10 })
      .withMessage("Message must be at least 10 characters long"),
  ],
  sendContactEmail
);

export default router;
