import express from 'express';
import {
  getClasses,
  createClass,
  updateClass,
  deleteClass,
} from '../controllers/ClassController.js';
import { verifyUser, adminOnly } from '../middlewares/AuthUser.js';

const router = express.Router();
router.get('/class', verifyUser, getClasses); // Get all students
router.post('/class', verifyUser, adminOnly,createClass); // Create a new user
router.patch('/class/:id', verifyUser, adminOnly,updateClass); // Update student by ID
router.delete('/class/:id', verifyUser, adminOnly, deleteClass); // Delete student by ID
export default router;
