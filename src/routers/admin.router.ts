import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { authenticateToken, checkRole } from '../middleware/user.middleware';

const router = Router();
const adminController = new AdminController();

router.post(
  '/users',
  authenticateToken,
  checkRole(['admin']),
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


// Xóa tất cả người dùng (chỉ dành cho admin)
router.put(
  '/delete-all',
  authenticateToken, // Xác thực token
  checkRole(['admin']), // Kiểm tra quyền admin
  adminController.deleteAllUsers
);
export default router; 