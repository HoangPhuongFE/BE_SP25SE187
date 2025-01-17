import { Response } from 'express';
import { AdminService } from '../service/admin.service';
import { AuthenticatedRequest } from '../middleware/user.middleware';
import { ADMIN_MESSAGE } from '../constants/message';

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
          fullName: user.fullName,
          roles: user.roles.map(ur => ur.role.name)
        }
      });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  }
} 