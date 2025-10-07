import express from 'express';
import { verifyUser } from '../middlewares/AuthUser.js';
import { getAllStudentBadges, deleteStudentBadge, getAllBadges, editBadge } from '../controllers/StudentBadgesController.js';
// import multer from 'multer';
// const upload = multer({ dest: 'public/images/tmp/' });
import upload from '../middlewares/UploadFile.js';

const router = express.Router();

// Route Get
router.get('/get-all-badges', verifyUser, getAllBadges); // Get all badges
router.get('/student-badges', verifyUser, getAllStudentBadges); // Get all student badges

// Route Patch
router.patch('/edit-badge/:id', verifyUser, upload.single('image'), editBadge); // Edit a badge

// Route Delete
router.delete('/student-badges/:user_id/:badge_id', verifyUser, deleteStudentBadge); // Delete a specific badge for a student

export default router;