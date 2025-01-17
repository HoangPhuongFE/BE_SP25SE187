import { Router } from 'express';
import { AdminController } from '../controller/admin.controller';
import { authenticateToken, checkRole } from '../middleware/user.middleware';
import { validateCreateUser } from '../middleware/admin.middleware';

const router = Router();
const adminController = new AdminController();

router.post(
  '/users',
  authenticateToken,
  checkRole(['admin']),
  validateCreateUser,
  adminController.createUser
);

export default router; 