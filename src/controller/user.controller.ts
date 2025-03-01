import { Request, Response } from 'express';
import { UserService } from '../service/user.service';
import { AUTH_MESSAGE, USER_MESSAGE } from '../constants/message';
import { AuthenticatedRequest } from '../middleware/user.middleware';

const userService = new UserService();

export class UserController {
  async register(req: Request, res: Response) {
    try {
      const user = await userService.register(req.body);
      res.status(201).json({ 
        message: AUTH_MESSAGE.REGISTER_SUCCESS,
        user: {
          id: user.id,
          email: user.email,
          username: user.username
        }
      });
    } catch (error) {
      const errorMessage = (error as Error).message;
      res.status(500).json({ message: errorMessage });
    }
  }

  async login(req: Request, res: Response) {
    try {
      const { accessToken, refreshToken, user } = await userService.login(req.body);
      res.json({ 
        message: AUTH_MESSAGE.LOGIN_SUCCESS,
        accessToken,
        refreshToken,
        user
      });
    } catch (error) {
      const errorMessage = (error as Error).message;
      res.status(401).json({ message: errorMessage });
    }
  }

  async googleLogin(req: Request, res: Response) {
    try {
      const { idToken } = req.body;
      const { accessToken, refreshToken } = await userService.loginWithGoogle(idToken);
      res.json({ 
        message: AUTH_MESSAGE.LOGIN_SUCCESS,
        accessToken,
        refreshToken
      });
    } catch (error) {
      res.status(401).json({ 
        message: AUTH_MESSAGE.GOOGLE_LOGIN_FAILED,
        error: (error as Error).message 
      });
    }
  }
  
  async getProfile(req: AuthenticatedRequest, res: Response) {
      try {
        // Kiểm tra nếu user chưa đăng nhập
        if (!req.user || !req.user.userId) {
          return res.status(401).json({ message: USER_MESSAGE.UNAUTHORIZED });
        }
  
        // Gọi hàm getProfile từ UserService
        const user = await userService.getProfile(req.user.userId);
  
        // Kiểm tra nếu user không tồn tại
        if (!user) {
          return res.status(404).json({ message: USER_MESSAGE.USER_NOT_FOUND });
        }
  
        // Trả về thông tin đầy đủ của user
        res.json({ user });
  
      } catch (error) {
        res.status(500).json({ message: (error as Error).message });
      }
    }
  
  
  

  async logout(req: AuthenticatedRequest, res: Response) {
    try {
      const refreshToken = req.body.refreshToken;
      if (!refreshToken) {
        return res.status(400).json({ message: USER_MESSAGE.INVALID_REFRESH_TOKEN });
      }

      await userService.logout(refreshToken);
      res.json({ message: AUTH_MESSAGE.LOGOUT_SUCCESS });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  }

  async updateProfile(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: USER_MESSAGE.UNAUTHORIZED });
      }
  
      const updatedUser = await userService.updateProfile(req.user.userId, {
        fullName: req.body.fullName,
        avatar: req.body.avatar,
        gender: req.body.gender,
        phone: req.body.phone,
        personal_Email: req.body.personal_Email,
        profession: req.body.profession,
        specialty: req.body.specialty,
        programming_language: req.body.programming_language
      });
  
      res.json({ 
        message: USER_MESSAGE.UPDATE_PROFILE_SUCCESS,
        user: updatedUser 
      });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  }
  


  async getUsers(req: AuthenticatedRequest, res: Response) {
    try {
      const users = await userService.getUsers();
      res.json({ users });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  }

  async getUserById(req: Request, res: Response) {
    try {
      const userId = req.params.id; // Lấy ID từ request params
      const user = await userService.getUserById(userId);
  
      if (!user) {
        return res.status(404).json({ message: USER_MESSAGE.USER_NOT_FOUND });
      }
  
      res.json({ user });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  }
  
}