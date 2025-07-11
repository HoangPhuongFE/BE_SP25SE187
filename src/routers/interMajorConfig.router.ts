import { Router } from 'express';
import { InterMajorConfigController } from '../controllers/interMajorConfig.controller';
import { authenticateToken, checkRole } from '../middleware/user.middleware';

const router = Router();
const ctrl = new InterMajorConfigController();

router.post(
  '/inter-major-configs',
  authenticateToken,
  checkRole([ 'admin']),
  ctrl.createConfig.bind(ctrl)
);

router.get(
  '/inter-major-configs',
  authenticateToken,
  checkRole(['academic_officer', 'admin','student','lecturer',"examination_officer", "graduation_thesis_manager"], false),
  ctrl.getAllConfigs.bind(ctrl)
);

router.get(
  '/inter-major-configs/:id',
  authenticateToken,
  checkRole(['academic_officer', 'admin','student','lecturer',"examination_officer", "graduation_thesis_manager"]),
  ctrl.getConfigById.bind(ctrl)
);

router.put(
  '/inter-major-configs/:id',
  authenticateToken,
  checkRole([ 'admin']),
  ctrl.updateConfig.bind(ctrl)
);

router.delete(
  '/inter-major-configs/:id/delete',
  authenticateToken,
  checkRole(['admin']),
  ctrl.deleteConfig.bind(ctrl)
);

export default router;
