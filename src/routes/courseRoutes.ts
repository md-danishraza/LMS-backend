import express from "express";
import {
  createCourse,
  deleteCourse,
  getCourse,
  getUploadVideoUrl,
  listCourse,
  listTeacherCourses,
  updateCourse,
} from "../controllers/courseController.js";
import { requireAuth } from "@clerk/express";

import multer from "multer";
import multerS3 from "multer-s3";
import { S3Client } from "@aws-sdk/client-s3";
// local multer
import path from "path";
import fs from "fs";

const router = express.Router();

// // Configure S3 Client
// const s3 = new S3Client({
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
//   },
//   region: process.env.AWS_REGION || "us-east-1",
// });

// // Configure Multer S3 Storage
// const upload = multer({
//   storage: multerS3({
//     s3: s3,
//     bucket: process.env.S3_BUCKET_NAME!,
//     contentType: multerS3.AUTO_CONTENT_TYPE,
//     metadata: (req, file, cb) => {
//       cb(null, { fieldName: file.fieldname });
//     },
//     key: (req, file, cb) => {
//       const fileName = `courses/${Date.now()}_${file.originalname}`;
//       cb(null, fileName);
//     },
//   }),
//   limits: {
//     fileSize: 5 * 1024 * 1024, // 5MB limit
//   },
// });

// Ensure uploads directory exists
const uploadDir = "./uploads/courses";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer for local disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

// Configure upload with file filter
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"));
    }
  },
});

// list only current teacher courses
router.get("/teacher", requireAuth(), listTeacherCourses);

// list all course
router.get("/", listCourse);
// create course
router.post("/", requireAuth(), createCourse);
// get a course
router.get("/:courseId", getCourse);
// update course with multer image
router.put("/:courseId", requireAuth(), upload.single("image"), updateCourse);
// delete course
router.delete("/:courseId", requireAuth(), deleteCourse);

// get upload/stream s3 urls
router.post(
  "/:courseId/sections/:sectionId/chapters/:chapterId/get-upload-url",
  requireAuth(),
  getUploadVideoUrl
);

export default router;
