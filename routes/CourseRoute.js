import express from 'express';
import {
  getCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
} from '../controllers/CourseController.js';
import { verifyUser, adminOnly } from '../middlewares/AuthUser.js';

const router = express.Router();
router.get('/courses', verifyUser, getCourses); // Get all courses
router.get('/course/:id', verifyUser,getCourseById); // Get course by ID
router.post('/course', verifyUser, adminOnly,createCourse); // Create a new course
router.patch('/course/:id', verifyUser, adminOnly,updateCourse); // Update course by ID
router.delete('/course/:id', verifyUser, adminOnly, deleteCourse); // Delete course by ID
export default router;
