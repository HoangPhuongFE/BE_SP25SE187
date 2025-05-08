import { Router } from 'express';
import { InterMajorGroupController } from '../controllers/interMajorGroup.controller';
import { authenticateToken, checkRole } from '../middleware/user.middleware';

const router = Router();
const interMajorGroupController = new InterMajorGroupController();

router.post(
  '/inter-major-groups',
  authenticateToken,
  checkRole(['academic_officer', 'admin','student','lecturer',"examination_officer", "graduation_thesis_manager"]),
  interMajorGroupController.createGroup.bind(interMajorGroupController)
);


export default router;
