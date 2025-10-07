import express from 'express';
import { getQuizSummary, getClassQuizzesSummary,getQuizzesSummary,getAllQuizzes } from '../controllers/QuizRekapController.js';
import { verifyUser } from '../middlewares/AuthUser.js';

const router = express.Router();

// Route Get
router.get('/quizzes-summary', verifyUser, getQuizzesSummary); // Get quiz summary for a class
router.get('/get-all-quizzes', verifyUser, getAllQuizzes); // Get quiz summary for a class
router.get('/quizzes-summary/:id', verifyUser, getQuizSummary); // Get quiz summary for a class
router.get('/quiz-attempts/class-summary/:class_id', verifyUser, getClassQuizzesSummary); // Get all quizzes summary for a class


export default router;
