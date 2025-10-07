import express from 'express';
import {
  getTeacher,
  getTeacherById,
  createTeacher,
  deleteTeacher,
  updateTeacher,
  deleteTeacherPhoto,
  uploadTeacherPhoto,
} from '../controllers/TeacherController.js';
import upload from '../middlewares/UploadFile.js';
import { verifyUser, adminOnly } from '../middlewares/AuthUser.js';

const router = express.Router();
router.get('/teacher', verifyUser, adminOnly, getTeacher); // Get all teachers
router.post('/teacher', verifyUser, adminOnly, createTeacher); // Create a new user
router.delete('/teacher/:id', verifyUser, adminOnly, deleteTeacher); // Delete teacher by ID
router.patch('/teacher/:id', updateTeacher); // Update teacher by ID
router.patch('/teacher/photo/:id', verifyUser, upload.single('photo'), uploadTeacherPhoto);
router.delete('/teacher/photo/:id', deleteTeacherPhoto);
router.get('/teacher/:id', getTeacherById); // Get teacher by ID
export default router;
