import { Router } from 'express';
import { ExportTopicController } from '../controller/export-topic.controller';
import { authenticateToken,checkRole } from '../middleware/user.middleware';

const router = Router();
const exportTopicController = new ExportTopicController();

router.get(
  '/export-topic',
  authenticateToken,
  checkRole(['admin', 'academic_officer', 'graduation_thesis_manager'], false),
  exportTopicController.exportTopicsForApproval.bind(exportTopicController)
);

export default router;
