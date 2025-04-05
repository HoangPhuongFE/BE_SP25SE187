import express from 'express';
import multer from 'multer';
import { ImportStudentController } from '../controllers/importStudent.controller';
import { authenticateToken, checkRole } from '../middleware/user.middleware';

const upload = multer({ dest: 'uploads/' });
const router = express.Router();
const importStudentController = new ImportStudentController();

router.post(
  '/import-students',
  authenticateToken,
  checkRole(['admin', 'academic_officer']),
  upload.single('file'),
  importStudentController.importStudentHandler.bind(importStudentController)
);

export default router;
