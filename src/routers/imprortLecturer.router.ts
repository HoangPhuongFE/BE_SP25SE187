import { Router } from 'express';
import { ImportLecturerController } from '../controller/importLecturer.controller';
import { authenticateToken, checkRole } from '../middleware/user.middleware'; 
import multer from 'multer'; 

const upload = multer({ dest: 'uploads/' });

const router = Router();
const importLecturerController = new ImportLecturerController();

router.post(
  '/lecturers',
  authenticateToken, checkRole(['admin', 'academic_officer']),
  upload.single('file'),
  importLecturerController.importLecturerHandler.bind(importLecturerController)
);


router.get(
  '/lecturers',
  authenticateToken,
  importLecturerController.getAllLecturersHandler.bind(importLecturerController)
);

router.get(
  '/lecturers/detail', 
  authenticateToken,
  importLecturerController.getLecturerByIdHandler.bind(importLecturerController)
);
export default router;