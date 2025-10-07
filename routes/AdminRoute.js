import express from 'express';
import {
  getAdmin,
  getAdminById,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  deleteAdminPhoto,
  uploadAdminPhoto
} from '../controllers/AdminController.js';
import upload from '../middlewares/UploadFile.js';
import { verifyUser, adminOnly, superAdminOnly } from '../middlewares/AuthUser.js';

const router = express.Router();
router.get('/administrator', verifyUser, superAdminOnly, getAdmin);
router.get('/administrator/:id',verifyUser, adminOnly, getAdminById);
router.post('/administrator', createAdmin);
router.delete('/administrator/:id',verifyUser, superAdminOnly, deleteAdmin);
router.patch('/administrator/:id', verifyUser, adminOnly,updateAdmin);
router.patch('/administrator/photo/:id', upload.single('photo'), uploadAdminPhoto);
router.delete('/administrator/photo/:id', verifyUser, superAdminOnly, deleteAdminPhoto);
export default router;
