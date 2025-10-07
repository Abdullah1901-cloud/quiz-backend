import express from 'express';
import {
  getStudentById,
  getStudentDetails,
  getStudent,
  leaderboardStudent,
  deleteStudent,
  updateStudent,
  createStudent,
  uploadStudentPhoto,
  deleteStudentPhoto,
  createStudentsBatch
} from '../controllers/StudentController.js';
import { verifyUser, adminOnly } from '../middlewares/AuthUser.js';
import upload from '../middlewares/UploadFile.js';

const router = express.Router();

router.get('/student', verifyUser, adminOnly,getStudent); // Get all students
router.get('/student/leaderboard', leaderboardStudent); // Get leaderboard data
router.get('/student/details', getStudentById); // Get student by ID
router.get('/student/details/:user_id', getStudentDetails); // Get student by ID

router.post('/student', verifyUser, adminOnly,createStudent); // Create a new user
router.post('/students/imports', verifyUser, adminOnly,createStudentsBatch); // Create a new user

router.patch('/student/:id', verifyUser,updateStudent); // Update student by ID
router.patch('/students/photo/:id', upload.single('photo'), uploadStudentPhoto);

router.delete('/student/:id', verifyUser, adminOnly, deleteStudent); // Delete student by ID
router.delete('/students/photo/:id', deleteStudentPhoto);
export default router;
