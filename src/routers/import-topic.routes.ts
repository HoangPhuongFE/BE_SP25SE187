import { Router } from 'express';
import multer from 'multer';
import { ImportTopicController } from '../controller/import-topic.controller';
import { authenticateToken, checkRole } from '../middleware/user.middleware';

const router = Router();
const upload = multer({ dest: 'uploads/' }); // Thư mục lưu file tạm

const importTopicController = new ImportTopicController();

router.post(
  '/import-topic-updates',
  authenticateToken,
  checkRole(['academic_officer', 'graduation_thesis_manager']),
  upload.single('file'), // Field name là "file"
  importTopicController.importTopicUpdates.bind(importTopicController)
);

export default router;
