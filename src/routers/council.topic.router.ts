import { Router } from 'express';
import { CouncilTopicController } from '../controllers/council.topic.controller';
import { authenticateToken, checkRole } from '../middleware/user.middleware';

const router = Router();
const councilTopicController = new CouncilTopicController();

router.post(
  '/',
  authenticateToken,
  checkRole(["examination_officer"]),
  councilTopicController.createCouncil.bind(councilTopicController)
);

router.get(
  '/',
  authenticateToken,
  checkRole(["examination_officer", "examination_officer","graduation_thesis_manager", 'lecturer', 'council_member']),
  councilTopicController.getCouncils.bind(councilTopicController)
);

router.get(
  '/:id',
  authenticateToken,
  checkRole(["examination_officer", 'lecturer']),
  councilTopicController.getCouncilById.bind(councilTopicController)
);

router.put(
  '/:id',
  authenticateToken,
  checkRole(["examination_officer"]),
  councilTopicController.updateCouncil.bind(councilTopicController)
);

router.put(
  '/:id/delete',
  authenticateToken,
  checkRole(['examination_officer']),
  councilTopicController.deleteCouncil.bind(councilTopicController)
);

router.post(
  "/members/:councilId",
  authenticateToken,
  checkRole(["examination_officer"]),
  councilTopicController.addMemberToCouncil.bind(councilTopicController)
);

router.delete(
  "/council/:councilId/user/:userId",
  authenticateToken,
  checkRole(["examination_officer", ]),
  councilTopicController.removeMemberFromCouncil.bind(councilTopicController)
);

router.get(
  '/lecturers/councils/:id',
  authenticateToken,
  checkRole(['lecturer', 'council_member']),
  councilTopicController.getCouncilDetailsForLecturer.bind(councilTopicController)
);

router.put(
  '/topics/:topicId/review',
  authenticateToken,
  checkRole(['council_member', "lecturer"], false),
  councilTopicController.reviewTopicByCouncilMember.bind(councilTopicController)
);

router.get(
  '/topics/approval',
  authenticateToken,
  checkRole(['examination_officer', 'graduation_thesis_manager', 'academic_officer', 'lecturer', 'council_member']),
  councilTopicController.getTopicsForApproval.bind(councilTopicController)
);

export default router;