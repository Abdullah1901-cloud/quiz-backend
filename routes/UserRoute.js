import express from 'express';
import {
  getUsers,
  getUsersById,
  createUser,
  updateUser,
  deleteUser,
  getUsersByRole,
  changePassword,
} from '../controllers/UserController.js';
import { verifyUser, adminOnly } from '../middlewares/AuthUser.js';

const router = express.Router();

router.get('/users', verifyUser, adminOnly, getUsers); // Get all users
router.get('/users/:role',verifyUser, adminOnly, getUsersByRole); // Get all users by role
router.get('/users/:id', verifyUser, adminOnly, getUsersById); // Get user by ID
router.post('/users', createUser); // Create a new user
router.patch('/users/:id', verifyUser, updateUser); // Update user by ID
router.patch('/users/change-password/:id', verifyUser, changePassword); // Update user by ID
router.delete('/users/:id', verifyUser, adminOnly,deleteUser); // Delete user by ID

export default router;
