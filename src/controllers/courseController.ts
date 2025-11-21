import type { Request, Response } from "express";
import Course from "../models/courseModel.js";
import { getAuth } from "@clerk/express";
import { v4 as uuidv4 } from "uuid";

// aws
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"; // V3 Imports
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"; // V3 Presigner
// Initialize S3 Client (V3)
// It automatically reads AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION from .env
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// list courses
export const listCourse = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { category } = req.query;
  try {
    const courses =
      category && category !== "all"
        ? await Course.scan("category").eq(category).exec()
        : await Course.scan().exec();

    res.json({ message: "Courses retrieved successfully!", data: courses });
  } catch (error) {
    res.status(500).json({ message: "Error retreiving courses!", error });
  }
};
export const listTeacherCourses = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { userId: teacherId } = getAuth(req);

  if (!teacherId) {
    res.status(401).json({ message: "User not authenticated", data: null });
    return;
  }

  try {
    // --- Method 1: Efficient GSI Query (Recommended) ---
    // This query uses the index we just added.
    const courses = await Course.query("teacherId")
      .eq(teacherId)
      .using("teacherId-index")
      .exec();

    // --- Method 2: Inefficient Scan (If you CANNOT add a GSI) ---
    // This code works but is very slow. It reads your ENTIRE table.
    // Use this only if you can't update the schema.
    // const allCourses = await Course.scan().exec();
    // const courses = allCourses.filter(
    //   (course) => course.teacherId === teacherId
    // );

    res
      .status(200)
      .json({ message: "Teacher courses retrieved", data: courses });
  } catch (error: any) {
    res
      .status(500)
      .json({ message: error.message || "Error fetching courses", data: null });
  }
};

// get course
export const getCourse = async (req: Request, res: Response): Promise<void> => {
  const { courseId } = req.params;
  if (!courseId) {
    res.status(400).json({ message: "Course ID is required!" });
    return;
  }
  try {
    const course = await Course.get(courseId);
    if (!course) {
      res.status(404).json({ message: "Course not found!" });
      return;
    }
    res.json({ message: "Courses retrieved successfully!", data: course });
  } catch (error) {
    res.status(500).json({ message: "Error retreiving cours!", error });
  }
};

// user/teacher course section

// creating a template draft course
export const createCourse = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { teacherId, teacherName } = req.body;

    if (!teacherId || !teacherName) {
      res.status(400).json({ message: "Teacher Id and name are required" });
      return;
    }

    const newCourse = new Course({
      courseId: uuidv4(),
      teacherId,
      teacherName,
      title: "Untitled Course",
      description: "",
      category: "Uncategorized",
      image: "",
      price: 0,
      level: "Beginner",
      status: "Draft",
      sections: [],
      enrollments: [],
    });
    await newCourse.save();

    res.json({ message: "Course created successfully", data: newCourse });
  } catch (error) {
    res.status(500).json({ message: "Error creating course", error });
  }
};

// updating course
export const updateCourse = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { courseId } = req.params;
  const updateData = { ...req.body };
  const { userId } = getAuth(req);

  if (!courseId || !userId) {
    res.status(400).json({ message: "Course Id and User Id are required" });
    return;
  }

  try {
    const course = await Course.get(courseId);
    if (!course) {
      res.status(404).json({ message: "Course not found" });
      return;
    }

    if (course.teacherId !== userId) {
      res
        .status(403)
        .json({ message: "Not authorized to update this course " });
      return;
    }

    if (updateData.price) {
      // console.log(updateData.price);
      const price = parseInt(updateData.price);
      if (isNaN(price)) {
        res.status(400).json({
          message: "Invalid price format",
          error: "Price must be a valid number",
        });
        return;
      }
      // updateData.price = Math.trunc(updateData.price);
      updateData.price = Math.trunc(price);
      // console.log(updateData.price);
    }

    if (updateData.sections) {
      // if sections exist than parse
      const sectionsData =
        typeof updateData.sections === "string"
          ? JSON.parse(updateData.sections)
          : updateData.sections;

      updateData.sections = sectionsData.map((section: any) => ({
        ...section,
        sectionId: section.sectionId || uuidv4(),
        chapters: section.chapters.map((chapter: any) => ({
          ...chapter,
          chapterId: chapter.chapterId || uuidv4(),
        })),
      }));
    }

    // --- 3. Handle Image Upload (S3 Logic) ---
    // Cast req.file to the S3 type to access .location and .key
    const file = req.file as Express.MulterS3.File;

    if (file) {
      // A new image was uploaded.
      // If using CloudFront, construct the URL manually for better performance
      if (process.env.CLOUDFRONT_DOMAIN) {
        updateData.image = `${process.env.CLOUDFRONT_DOMAIN}/${file.key}`;
      } else {
        // Fallback to direct S3 URL
        updateData.image = file.location;
      }
    } else {
      // No new image was uploaded.
      // CRITICAL: Delete the 'image' key from updateData.
      // This ensures Object.assign does NOT overwrite the existing
      // course.image with undefined/null.
      delete updateData.image;
    }

    // copying updated course object
    Object.assign(course, updateData);
    await course.save();

    res.json({ message: "Course updated successfully", data: course });
  } catch (error) {
    res.status(500).json({ message: "Error updating course", error });
  }
};

// deleting course
export const deleteCourse = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { courseId } = req.params;
  const { userId } = getAuth(req);

  if (!courseId || !userId) {
    res.status(400).json({ message: "Course Id and User Id are required" });
    return;
  }

  try {
    const course = await Course.get(courseId);
    if (!course) {
      res.status(404).json({ message: "Course not found" });
      return;
    }

    if (course.teacherId !== userId) {
      res
        .status(403)
        .json({ message: "Not authorized to delete this course " });
      return;
    }

    await Course.delete(courseId);

    res.json({ message: "Course deleted successfully", data: course });
  } catch (error) {
    res.status(500).json({ message: "Error deleting course", error });
  }
};

// getting uploading video to s3 URL
export const getUploadVideoUrl = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { fileName, fileType } = req.body;

  if (!fileName || !fileType) {
    res.status(400).json({ message: "File name and type are required" });
    return;
  }

  try {
    const uniqueId = uuidv4();
    const s3Key = `videos/${uniqueId}/${fileName}`;

    // Prepare the command
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: s3Key,
      ContentType: fileType,
    });

    // Generate the Pre-Signed URL
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 });

    // Construct the public URL (via CloudFront)
    const videoUrl = `${process.env.CLOUDFRONT_DOMAIN}/${s3Key}`;

    res.json({
      message: "Upload URL generated successfully",
      data: { uploadUrl, videoUrl },
    });
  } catch (error) {
    console.error("S3 Error:", error);
    res.status(500).json({ message: "Error generating upload URL", error });
  }
};

// export const getUploadVideoUrl = async (
//   req: Request,
//   res: Response
// ): Promise<void> => {
//   // file name and type
//   const { fileName, fileType } = req.body;

//   if (!fileName || !fileType) {
//     res.status(400).json({ message: "File name and type are required" });
//     return;
//   }

//   try {
//     const uniqueId = uuidv4();
//     // unique object in s3 bucket
//     const s3Key = `videos/${uniqueId}/${fileName}`;

//     // params
//     // bucket name from env as its private
//     const s3Params = {
//       Bucket: process.env.S3_BUCKET_NAME || "",
//       Key: s3Key,
//       Expires: 60,
//       ContentType: fileType,
//     };

//     // getting signed url for uploading large videos from fontend
//     const uploadUrl = s3.getSignedUrl("putObject", s3Params);
//     // accessing via cloudfront
//     const videoUrl = `${process.env.CLOUDFRONT_DOMAIN}/videos/${uniqueId}/${fileName}`;

//     // for each chapter we will have uploadUrl and videoUrl
//     res.json({
//       message: "Upload URL generated successfully",
//       data: { uploadUrl, videoUrl },
//     });
//   } catch (error) {
//     res.status(500).json({ message: "Error generating upload URL", error });
//   }
// };
