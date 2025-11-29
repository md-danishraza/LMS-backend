import type { Request, Response } from "express";
import { Resend } from "resend";
import { validationResult } from "express-validator";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendContactEmail = async (req: Request, res: Response) => {
  // 1. Validate Input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, email, subject, message } = req.body;

  try {
    // 2. Send email to YOU (The Admin)
    const { data, error } = await resend.emails.send({
      from: "ProLearn Contact <onboarding@resend.dev>", // Use 'onboarding' for testing, or your verified domain
      to: process.env.EMAIL_USER!, // Your personal email to receive messages
      replyTo: email, // Allows you to hit "Reply" and email the user back
      subject: `[ProLearn Support] ${subject}: ${name}`,
      html: `
        <h3>New Contact Message</h3>
        <p><strong>From:</strong> ${name} (${email})</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <br/>
        <p><strong>Message:</strong></p>
        <p style="background-color: #f4f4f5; padding: 12px; border-radius: 4px;">${message}</p>
      `,
    });

    if (error) {
      console.error("Resend API Error:", error);
      return res
        .status(500)
        .json({ message: "Failed to send email via provider.", data: null });
    }

    // Optional: Send auto-reply to visitor (Commented out to save quota)
    /*
    await resend.emails.send({
      from: "ProLearn Team <onboarding@resend.dev>",
      to: email,
      subject: "We received your message!",
      html: `<p>Hi ${name},</p><p>Thanks for reaching out. We'll get back to you shortly.</p>`,
    });
    */

    res
      .status(200)
      .json({ message: "Email sent successfully!", data: data?.id });
  } catch (err) {
    console.error("Server Error:", err);
    res
      .status(500)
      .json({ message: "Internal server error sending email.", data: null });
  }
};
