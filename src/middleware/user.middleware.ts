import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { USER_MESSAGE } from '../constants/message';
import { body, validationResult } from 'express-validator';
import { Request as ExpressRequest } from 'express';
import { TokenPayload } from '~/types/type';

export interface AuthenticatedRequest extends ExpressRequest {
  user?: TokenPayload;
}

const prisma = new PrismaClient();

export const validateRegister = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('username').isLength({ min: 3 }),
  body('fullName').optional().isString(),
  
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, username } = req.body;
    
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username }
        ]
      }
    });

    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(400).json({ message: USER_MESSAGE.EMAIL_EXISTS });
      }
      return res.status(400).json({ message: USER_MESSAGE.USERNAME_EXISTS });
    }

    next();
  }
];

export const validateLogin = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];


export const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: Missing token.' });
  }

  // Kiểm tra nếu secret không được thiết lập
  if (!process.env.JWT_SECRET_ACCESS_TOKEN) {
    console.error('JWT_SECRET_ACCESS_TOKEN không được thiết lập.');
    return res.status(500).json({ message: 'Lỗi máy chủ: Thiếu secret key.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET_ACCESS_TOKEN!) as TokenPayload;
    req.user = payload; // Gắn thông tin user vào req.user
    console.log('Authenticated User:', req.user); // Log thông tin để debug
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      console.error('Token đã hết hạn:', error);
      return res.status(401).json({ message: 'Unauthorized: Token đã hết hạn.' });
    } else if (error.name === 'JsonWebTokenError') {
      console.error('Chữ ký token không hợp lệ:', error);
      return res.status(401).json({ message: 'Unauthorized: Chữ ký token không hợp lệ.' });
    } else {
      console.error('Lỗi xác thực token:', error);
      return res.status(500).json({ message: 'Lỗi máy chủ nội bộ.' });
    }
  }
};





export const checkRole = (allowedRoles: string[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Lấy danh sách role từ database dựa trên roleId
    const roles = await prisma.role.findMany({
      where: { id: { in: req.user.roles } },
    });

    const userRoleNames = roles.map(role => role.name);

    console.log('User Role Names:', userRoleNames); // Log kiểm tra vai trò

    const hasRole = userRoleNames.some(role => allowedRoles.includes(role));

    if (!hasRole) {
      return res.status(403).json({ message: 'Forbidden access' });
    }

    next();
  };
};

