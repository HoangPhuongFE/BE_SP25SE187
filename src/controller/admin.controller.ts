import { Response } from 'express';
import { AdminService } from '../service/admin.service';
import { AuthenticatedRequest } from '../middleware/user.middleware';
import { ADMIN_MESSAGE } from '../constants/message';

const adminService = new AdminService();

export class AdminController {
  //  Tạo user mới
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
      res.status(500).json({ message: (error as Error).message });
    }
  }

  //  Cập nhật roles của user
  async updateUserRoles(req: AuthenticatedRequest, res: Response) {
    try {
      const { userId, roles } = req.body;
      if (!userId || !roles) return res.status(400).json({ message: ADMIN_MESSAGE.MISSING_FIELDS });

      const updatedUser = await adminService.updateUserRoles({ userId, roles });
      if (!updatedUser) return res.status(404).json({ message: ADMIN_MESSAGE.USER_NOT_FOUND });

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
      res.status(500).json({ message: (error as Error).message });
    }
  }

  // Cập nhật thông tin user
  async updateUser(req: AuthenticatedRequest, res: Response) {
    try {
      const { userId } = req.params;
      const updatedUser = await adminService.updateUser(userId, req.body);
      if (!updatedUser) return res.status(404).json({ message: ADMIN_MESSAGE.USER_NOT_FOUND });

      res.status(200).json({
        message: ADMIN_MESSAGE.UPDATE_USER_SUCCESS,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          username: updatedUser.username,
          fullName: updatedUser.fullName || null,
          roles: updatedUser.roles.map((ur) => ur.role.name),
        },
      });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  }

  //  Xóa user
  async deleteUser(req: AuthenticatedRequest, res: Response) {
    try {
      const { userId } = req.params;
      await adminService.deleteUser(userId);
      res.status(200).json({ message: ADMIN_MESSAGE.DELETE_USER_SUCCESS });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  }

  //  Lấy danh sách user
  async getUsers(req: AuthenticatedRequest, res: Response) {
    try {
      const users = await adminService.getUsers();
      res.status(200).json({ users });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  }

  //  Lấy user theo ID
  async getUserById(req: AuthenticatedRequest, res: Response) {
    try {
      const { userId } = req.params;
      const user = await adminService.getUserById(userId);
      if (!user) return res.status(404).json({ message: ADMIN_MESSAGE.USER_NOT_FOUND });

      res.status(200).json({ user });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  }
}
