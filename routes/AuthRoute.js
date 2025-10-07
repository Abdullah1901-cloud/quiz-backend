import express from 'express';
import { Login, Logout, Me } from '../controllers/Auth.js';
import { verifyUser } from '../middlewares/AuthUser.js';

const router = express.Router();

router.get('/me', verifyUser, Me);
router.post('/login', Login);
router.delete('/logout', Logout);

export default router;