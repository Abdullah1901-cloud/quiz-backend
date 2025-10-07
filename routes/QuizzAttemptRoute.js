import express from 'express';
import { startQuizForStudent, getStudentQuizAttempts,getStudentQuizAttempt, saveTempAnswer, getTempAnswers, submitFinalAnswers, getStudentQuiz, reportViolation,deleteStudentQuizAttempts } from '../controllers/QuizzAttemptController.js';
import { verifyUser } from '../middlewares/AuthUser.js';

const router = express.Router();

// Route Get
router.get('/quiz-attempts', verifyUser, getStudentQuizAttempts); // Get all quiz attempts for a student
router.get('/quiz-attempts/temp-answers/:uuid', verifyUser, getTempAnswers); // Get temporary answers for a quiz attempt
router.get('/quiz-attempts/student/:quizAttemptId', verifyUser, getStudentQuiz); // Get quiz details for a student
router.get('/quiz-attempts/:id/start', verifyUser, startQuizForStudent); // Get quiz attempt by ID
router.get('/quiz-attempts/:quizId', verifyUser, getStudentQuizAttempt); // Get all quiz attempts for a student

// Route post
router.post('/quiz-attempts/save-temp-answer', verifyUser, saveTempAnswer); // Save temporary answer for a quiz attempt
router.post('/quiz-attempts/report-violation/:uuid', verifyUser, reportViolation); // Report a violation for a quiz attempt
router.post('/quiz-attempts/submit-final-answers/:uuid', verifyUser, submitFinalAnswers); // Submit final answers for a quiz attempt

router.delete('/quiz-attempts/del-attempts/:quizId/:studentUserId', verifyUser, deleteStudentQuizAttempts); // Delete quiz attempts for a student
export default router;
