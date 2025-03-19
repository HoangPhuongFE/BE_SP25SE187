import { Router } from 'express';
import { ExportTopicController } from '../controller/export-topic.controller';
import { authenticateToken,checkRole } from '../middleware/user.middleware';

const router = Router();
const exportTopicController = new ExportTopicController();

router.get(
  '/export-topic',
  authenticateToken,
  checkRole(['lecturer', 'academic_officer', 'graduation_thesis_manager']),
  exportTopicController.exportTopicsForApproval.bind(exportTopicController)
);

export default router;
