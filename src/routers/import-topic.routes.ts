// routes/import-topic.routes.ts
import { Router } from 'express';
import { ImportTopicController } from '../controller/import-topic.controller';
import { authenticateToken ,checkRole} from '../middleware/user.middleware';
import multer from 'multer';

// Cấu hình multer để lưu file tạm thời (sử dụng diskStorage)
const upload = multer({ dest: 'uploads/' });

const router = Router();
const importTopicController = new ImportTopicController();

// Endpoint POST /api/import-topic
router.post(
  '/import-topic',
  authenticateToken,
  checkRole(['admin', 'academic_officer', 'graduation_thesis_manager']),
  upload.single('file'),
  importTopicController.importTopics.bind(importTopicController)
);

export default router;
