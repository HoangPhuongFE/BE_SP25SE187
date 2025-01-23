import express from 'express';
import multer from 'multer';
import { importStudentHandler } from '../controller/importStudent.controller';
import { authenticateToken, checkRole } from '../middleware/user.middleware';

const upload = multer({ dest: 'uploads/' });
const router = express.Router();


router.post(
  '/import-students',
  authenticateToken,               
  checkRole(['admin', 'head_of_department']), 
  upload.single('file'),            
  importStudentHandler              
);

export default router;
