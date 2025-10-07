import express from 'express';
import {
    getQuizzes,
    getQuizzById,
    getQuizzByTeacherId,
    getPastQuizzByTeacherId,
    getFutureQuizzByTeacherId,
    getActiveQuizzByTeacherId,
    getQuizzWithQuestions,
    getStudentQuizzes,
    createQuizz,
    cloneQuiz,
    updateQuizz,
    adminUpdateQuizz,
    deleteQuizz,
    uploadQuizzPhoto,
    uploadQuestionImage,
    uploadOptionImage,
    deleteQuizzPermanent,
    deleteQuizzPhoto,
    generateQuizPdf
} from '../controllers/QuizzController.js';
import { verifyUser } from '../middlewares/AuthUser.js';
import upload from '../middlewares/UploadFile.js';

const router = express.Router();

// Contoh: maksimal 10 soal, tiap soal punya 5 opsi
const MAX_QUESTIONS = 100;
const MAX_OPTIONS = 6;

const fields = [{ name: 'quiz_image', maxCount: 1 }];

// Tambahkan question_image_0 sampai question_image_9
for (let i = 0; i < MAX_QUESTIONS; i++) {
  fields.push({ name: `question_image_${i}`, maxCount: 1 });

  // Tambahkan option_image_0_0 sampai option_image_9_4
  for (let j = 0; j < MAX_OPTIONS; j++) {
    fields.push({ name: `option_image_${i}_${j}`, maxCount: 1 });
  }
}

const quizUploadMiddleware = upload.fields(fields);


// Route Get
router.get('/quizzes', verifyUser, getQuizzes); // Get all quizz
router.get('/quizzes/students', verifyUser, getStudentQuizzes); // Get active quizz by Teacher ID
router.get('/quizz/with-questions/:id', verifyUser, getQuizzWithQuestions); // Get all quizz
router.get('/quizzes/past/:id', verifyUser, getPastQuizzByTeacherId); // Get past quizz by Teacher ID
router.get('/quizzes/future/:id', verifyUser, getFutureQuizzByTeacherId); // Get future quizz by Teacher ID
router.get('/quizzes/active/:id', verifyUser, getActiveQuizzByTeacherId); // Get active quizz by Teacher ID
router.get('/quizz/:id', verifyUser, getQuizzById); // Get quizz by ID
router.get('/quizzes/:id', verifyUser, getQuizzByTeacherId); // Get all quizz by Teacher ID

// Route Post
router.post('/api/quizz', verifyUser, quizUploadMiddleware, createQuizz); // Create a new quizz
router.post('/download/pdf', verifyUser, generateQuizPdf); // Download quizz as PDF
router.post('/quizz/:id/clone', verifyUser,cloneQuiz); // Clone quizz

// Route Patch
router.patch('/quizz/update/administrator/:id', verifyUser,quizUploadMiddleware, adminUpdateQuizz); // Update quizz by ID
router.patch('/quizz/update/:id', verifyUser,quizUploadMiddleware, updateQuizz); // Update quizz by ID
router.patch('/quizz/photo/:id', upload.single('image'), uploadQuizzPhoto);
router.patch('/quizz/upload-question-image/:id', upload.single('image'), uploadQuestionImage);
router.patch('/quizz/upload-option-image/:id', upload.single('image'), uploadOptionImage);

// Route Delete 
router.delete('/quizz/permanent/:id', verifyUser, deleteQuizzPermanent); // Delete quizz permanently
router.delete('/quizz/photo/:id', deleteQuizzPhoto);
router.delete('/quizz/:id', verifyUser, deleteQuizz); // Delete quizz by ID


export default router;
