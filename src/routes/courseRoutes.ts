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

// image upload
import multer from "multer";
import multerS3 from "multer-s3";
import { S3Client } from "@aws-sdk/client-s3";

const router = express.Router();

// 1. Configure S3 Client
const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// 2. Configure Multer S3 Storage
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.S3_BUCKET_NAME!,
    // AUTO_CONTENT_TYPE is crucial so the browser displays the image
    // instead of forcing a download.
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: (req: any, file: any, cb: any) => {
      cb(null, { fieldName: file.fieldname });
    },
    key: (req: any, file: any, cb: any) => {
      // Generate a unique path: thumbnails/timestamp_filename
      const fileName = `thumbnails/${Date.now()}_${file.originalname}`;
      cb(null, fileName);
    },
  }),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per image
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
