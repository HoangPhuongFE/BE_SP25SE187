import { Response } from 'express';
import { AdminService } from '../service/admin.service';
import { AuthenticatedRequest } from '../middleware/user.middleware';
import { ADMIN_MESSAGE } from '../constants/message';

const adminService = new AdminService();

export class AdminController {
  // Tạo user mới
  async createUser(req: AuthenticatedRequest, res: Response) {
    try {
      const user = await adminService.createUser(req.body);
      res.status(201).json({
        message: ADMIN_MESSAGE.CREATE_USER_SUCCESS,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          fullName: user.fullName || null,
          roles: user.roles.map((ur) => ur.role.name),
        },
      });
    } catch (error) {
      const errorMessage = (error as Error).message;

      // Xử lý lỗi logic
      if (errorMessage === 'Email already exists') {
        return res.status(400).json({ message: ADMIN_MESSAGE.EMAIL_EXISTS });
      }
      if (errorMessage === 'Username already exists') {
        return res.status(400).json({ message: ADMIN_MESSAGE.USERNAME_EXISTS });
      }
      if (errorMessage === 'One or more roles are invalid') {
        return res.status(400).json({ message: ADMIN_MESSAGE.INVALID_ROLE });
      }

      // Lỗi không xác định
      res.status(500).json({ message: errorMessage });
    }
  }

  // Cập nhật roles của user
  async updateUserRoles(req: AuthenticatedRequest, res: Response) {
    try {
      const { userId, roles } = req.body;

      if (!userId || !roles) {
        return res.status(400).json({ message: ADMIN_MESSAGE.MISSING_FIELDS });
      }

      const updatedUser = await adminService.updateUserRoles({ userId, roles });
      if (!updatedUser) {
        return res.status(404).json({ message: ADMIN_MESSAGE.USER_NOT_FOUND });
      }

      res.status(200).json({
        message: ADMIN_MESSAGE.UPDATE_ROLES_SUCCESS,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          username: updatedUser.username,
          fullName: updatedUser.fullName || null,
          roles: updatedUser.roles.map((ur) => ur.role.name),
        },
      });
    } catch (error) {
      const errorMessage = (error as Error).message;

      // Xử lý lỗi logic
      if (errorMessage === 'User not found') {
        return res.status(404).json({ message: ADMIN_MESSAGE.USER_NOT_FOUND });
      }
      if (errorMessage === 'One or more roles are invalid') {
        return res.status(400).json({ message: ADMIN_MESSAGE.INVALID_ROLE });
      }

      // Lỗi không xác định
      res.status(500).json({ message: errorMessage });
    }
  }

  async importUsers(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'Vui lòng upload file Excel' });
      }

      const results = await adminService.importUsersFromExcel(req.file.path);
      
      res.json({
        message: 'Import thành công',
        results: {
          success: results.success,
          failed: results.failed,
          errors: results.errors
        }
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Lỗi khi import users',
        error: (error as Error).message 
      });
    }
  }
}
