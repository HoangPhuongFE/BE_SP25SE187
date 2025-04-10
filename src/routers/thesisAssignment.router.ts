import { Router } from 'express';
import { ThesisAssignmentController } from '../controllers/thesisAssignment.controller';
import { authenticateToken, checkRole } from '../middleware/user.middleware';

const router = Router();
const thesisAssignmentController = new ThesisAssignmentController();

router.get(
  '/guidance-list',
  authenticateToken,
  checkRole(['examination_officer', 'graduation_thesis_manager', 'academic_officer', 'lecturer', 'council_member']),
  thesisAssignmentController.getThesisGuidanceList.bind(thesisAssignmentController)
);

export default router;