import { Router } from 'express';
import { AdminController } from '../controller/admin.controller';
import { authenticateToken, checkRole } from '../middleware/user.middleware';
import { validateCreateUser } from '../middleware/admin.middleware';
import { uploadExcel } from '../middleware/upload.middleware';

const router = Router();
const adminController = new AdminController();

router.post(
  '/users',
  authenticateToken,
  checkRole(['admin']),
  validateCreateUser,
  adminController.createUser
);


router.put(
  '/users/roles',
  authenticateToken, 
  checkRole(['admin']), 
  adminController.updateUserRoles 
);

router.post(
  '/users/import',
  authenticateToken,
  checkRole(['admin']),
  uploadExcel,
  adminController.importUsers
);

export default router; 