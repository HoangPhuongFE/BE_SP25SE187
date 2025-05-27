import { Router } from 'express';
import { InterMajorGroupController } from '../controllers/interMajorGroup.controller';
import { authenticateToken, checkRole } from '../middleware/user.middleware';

const router = Router();
const interMajorGroupController = new InterMajorGroupController();

router.post(
  '/inter-major-groups',
  authenticateToken,
  checkRole(['student']),
  interMajorGroupController.createGroup.bind(interMajorGroupController)
);
router.post(
  "/create-inter-major-group-by-academic",
  authenticateToken,
  checkRole(["academic_officer"], false),
  interMajorGroupController.createInterMajorGroupByAcademicOfficer.bind(interMajorGroupController)
);


export default router;
