import express from 'express';
import { getAllStudentsProgress, getClassesProgress, getStudentProgress, getClassProgress } from '../controllers/StudentProgres.js';
import { verifyUser } from '../middlewares/AuthUser.js';

const router = express.Router();
router.get('/students-progress',  getAllStudentsProgress);
router.get('/student-progress/:id',  getStudentProgress);
router.get('/classes-progress',  getClassesProgress);
router.get('/class-progress/:id',getClassProgress);
export default router;