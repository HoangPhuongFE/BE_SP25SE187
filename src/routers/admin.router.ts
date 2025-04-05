import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
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


router.put(
  '/users/roles',
  authenticateToken,
  checkRole(['admin']),
  adminController.updateUserRoles
);

router.put(
  '/users/:userId',
  authenticateToken,
  checkRole(['admin']),
  adminController.updateUser
);


router.put(
  '/users/:userId/delete', 
  authenticateToken,
  checkRole(['admin']),
  adminController.deleteUser.bind(adminController)
);

router.get(
  '/users',
  authenticateToken,
  checkRole(['admin']),
  adminController.getUsers
);

router.get(
  '/users/:userId',
  authenticateToken,
  checkRole(['admin']),
  adminController.getUserById
);



export default router; 