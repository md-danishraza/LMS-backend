import type { Request, Response } from "express";
import Course from "../models/courseModel.js";

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
