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
      res.status(500).json({ message: error.message });
    }
  }

  async login(req: Request, res: Response) {
    try {
      const { accessToken, refreshToken } = await userService.login(req.body);
      res.json({ 
        message: AUTH_MESSAGE.LOGIN_SUCCESS,
        accessToken,
        refreshToken
      });
    } catch (error) {
      res.status(401).json({ message: error.message });
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
        error: error.message 
      });
    }
  }
  async getProfile(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: USER_MESSAGE.UNAUTHORIZED });
      }
      res.json({ user: req.user });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
}
