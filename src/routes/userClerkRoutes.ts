import express from "express";

import { updateUser } from "../controllers/userClerkController.js";

const router = express.Router();

router.put("/:userId", updateUser);

export default router;
