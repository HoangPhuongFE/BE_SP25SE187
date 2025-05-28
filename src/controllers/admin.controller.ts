import { Response } from 'express';
import { AdminService } from '../services/admin.service';
import { AuthenticatedRequest } from '../middleware/user.middleware';
import { ADMIN_MESSAGE } from '../constants/message';

// Interface cho dữ liệu user trả về
interface UserResponse {
  id: string;
  email: string;
  username: string;
  fullName?: string | null;
  roles: string[];
  studentCode?: string | null;
  majorId?: string | null;
  semesterId?: string | null;
}
interface UserWithDetails {
  id: string;
  email: string;
  username: string;
  fullName?: string | null;
  roles: { role: { name: string } }[];
  studentCode?: string | null;
  majorId?: string | null;
  semesterId?: string | null;
}
const adminService = new AdminService();

export class AdminController {
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
          studentCode: user.studentCode,
          majorId: user.majorId,
          semesterId: user.semesterId,
        } as UserResponse,
      });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  }



  async updateUserRoles(req: AuthenticatedRequest, res: Response) {
    try {
      const { userId, roles, semesterId } = req.body;
      if (!userId || !roles) {
        return res.status(400).json({ message: 'Thiếu trường userId hoặc roles' });
      }

      const updatedUser = await adminService.updateUserRoles({ userId, roles, semesterId }) as UserWithDetails;

      if (!updatedUser || !updatedUser.roles) {
        return res.status(404).json({ message: 'Người dùng không tồn tại hoặc thiếu thông tin vai trò' });
      }

      res.status(200).json({
        message: 'Cập nhật vai trò thành công',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          username: updatedUser.username,
          fullName: updatedUser.fullName || null,
          roles: updatedUser.roles.map((ur: { role: { name: string } }) => ur.role.name),
          studentCode: updatedUser.studentCode,
          majorId: updatedUser.majorId,
          semesterId: updatedUser.semesterId,
        } as UserResponse,
      });
    } catch (error) {
      const message = (error as Error).message;
      if (
        message.includes('không tồn tại') ||
        message.includes('Không tìm thấy vai trò hợp lệ') ||
        message.includes('yêu cầu semesterId')
      ) {
        return res.status(400).json({ message });
      }
      return res.status(500).json({ message });
    }
  }

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
        } as UserResponse,
      });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  }

  async deleteUser(req: AuthenticatedRequest, res: Response) {
  try {
    const { userId } = req.params; // Lấy userId từ params
    const { semesterId } = req.body; // Lấy semesterId từ body
    const deletedByUserId = req.user?.userId;

    console.log('deleteUser request:', { userId, deletedByUserId, semesterId });

    if (!deletedByUserId) {
      return res.status(401).json({ message: 'Không tìm thấy thông tin người dùng thực hiện xóa.' });
    }

    const result = await adminService.deleteUser(userId, deletedByUserId, semesterId);
    return res.status(200).json(result);
  } catch (error) {
    const message = (error as Error).message;
    console.error('deleteUser error:', error);
    if (message.includes('không tồn tại') || message.includes('vai trò đặc biệt') || message.includes('Không có quyền')) {
      return res.status(400).json({ message });
    }
    return res.status(500).json({ message });
  }
}
 async getUsers(req: AuthenticatedRequest, res: Response) {
    try {
      const semesterId = req.query.semesterId as string | undefined;
      if (!semesterId) {
        return res.status(400).json({ message: 'semesterId là bắt buộc' });
      }
      const users = await adminService.getUsers(semesterId);
      res.status(200).json({ users });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  }

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
  async deleteAllUsers(req: AuthenticatedRequest, res: Response) {
  try {
    const { semesterId } = req.body;
    const deletedByUserId = req.user?.userId;

    console.log('deleteAllUsers request:', { deletedByUserId, semesterId });

    if (!deletedByUserId) {
      return res.status(401).json({ message: 'Không tìm thấy thông tin người dùng thực hiện xóa.' });
    }

    const result = await adminService.deleteAllUsers(deletedByUserId, semesterId);
    return res.status(200).json(result);
  } catch (error) {
    const message = (error as Error).message;
    console.error('deleteAllUsers error:', error);
    if (message.includes('không tồn tại') || message.includes('Không có quyền')) {
      return res.status(400).json({ message });
    }
    return res.status(500).json({ message: 'Lỗi server khi xóa tất cả người dùng' });
  }
}
}