import { getAuth } from "@clerk/express";
import type { Request, Response } from "express";
import UserCourseProgress from "../models/userCourseProgressModel.js";
import Course from "../models/courseModel.js";
import { calculateOverallProgress, mergeSections } from "../utils/utils.js";

export const getUserEnrolledCourses = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { userId } = req.params;
  const auth = getAuth(req);

  if (!auth || auth.userId !== userId) {
    res.status(403).json({ message: "Access denied" });
    return;
  }

  try {
    // 1. Get all progress records for this user
    const userProgresses = await UserCourseProgress.query("userId")
      .eq(userId)
      .exec();

    if (!userProgresses || userProgresses.length === 0) {
      res.json({
        message: "Enrolled courses retrieved successfully",
        data: [],
      });
      return;
    }

    // 2. Get the course details
    const courseIds = userProgresses.map((item: any) => item.courseId);
    const courses = await Course.batchGet(courseIds);

    // 3. MERGE: Attach overallProgress to each course
    const coursesWithProgress = courses.map((course: any) => {
      const progress = userProgresses.find(
        (p: any) => p.courseId === course.courseId
      );

      // Return the course object combined with the progress value
      return {
        ...course,
        overallProgress: progress ? progress.overallProgress : 0,
      };
    });

    res.json({
      message: "Enrolled courses retrieved successfully",
      data: coursesWithProgress,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error retrieving enrolled courses", error });
  }
};

// user course progress
export const getUserCourseProgress = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { userId, courseId } = req.params;

  if (!userId || !courseId) {
    res.status(403).json({ message: "Access denied" });
    return;
  }

  try {
    const progress = await UserCourseProgress.get({ userId, courseId });
    // console.log(progress);
    if (!progress) {
      res
        .status(404)
        .json({ message: "Course progress not found for this user" });
      return;
    }
    res.json({
      message: "Course progress retrieved successfully",
      data: progress,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error retrieving user course progress", error });
  }
};

// update user course progress
export const updateUserCourseProgress = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { userId, courseId } = req.params;
  const progressData = req.body;

  if (!userId || !courseId) {
    res.status(403).json({ message: "Access denied" });
    return;
  }

  try {
    let progress = await UserCourseProgress.get({ userId, courseId });

    if (!progress) {
      // If no progress exists, create initial progress
      progress = new UserCourseProgress({
        userId,
        courseId,
        enrollmentDate: new Date().toISOString(),
        overallProgress: 0,
        sections: progressData.sections || [],
        lastAccessedTimestamp: new Date().toISOString(),
      });
    } else {
      // Merge existing progress with new progress data
      progress.sections = mergeSections(
        progress.sections,
        progressData.sections || []
      );
      progress.lastAccessedTimestamp = new Date().toISOString();
      progress.overallProgress = calculateOverallProgress(progress.sections);
    }

    await progress.save();

    res.json({
      message: "",
      data: progress,
    });
  } catch (error) {
    console.error("Error updating progress:", error);
    res.status(500).json({
      message: "Error updating user course progress",
      error,
    });
  }
};
