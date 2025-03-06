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

  if (!process.env.JWT_SECRET_ACCESS_TOKEN) {
    console.error('JWT_SECRET_ACCESS_TOKEN không được thiết lập.');
    return res.status(500).json({ message: 'Lỗi máy chủ: Thiếu secret key.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_ACCESS_TOKEN!) as { userId: string };
    const userId = decoded.userId;

    // Truy vấn UserRole, bao gồm thông tin role để biết isSystemWide
    const userRoles = await prisma.userRole.findMany({
      where: { userId, isActive: true },
      include: { role: true },
    });

    if (!userRoles.length) {
      return res.status(403).json({ message: 'Forbidden: No active roles found for user.' });
    }

    // Lấy email người dùng
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Gán tất cả vai trò hoạt động vào req.user, không lọc semesterId
    req.user = {
      userId,
      email: user.email,
      roles: userRoles.map(ur => ({
        roleId: ur.roleId,
        semesterId: ur.semesterId,
        isActive: ur.isActive,
        isSystemWide: ur.role.isSystemWide,
      })),
    };
    console.log('Authenticated User:', req.user);
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
/*
export const checkRole = (allowedRoles: string[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const semesterId = (req.query.semesterId as string) || (req.body.semesterId as string);
    const userRoles = req.user.roles;

    // Kiểm tra xem người dùng có vai trò được phép không
    const hasRequiredRole = userRoles.some((role) => allowedRoles.includes(role.roleId));
    if (!hasRequiredRole) {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
    }

    // Kiểm tra vai trò toàn hệ thống
    const hasSystemWideRole = userRoles.some((role) => role.isSystemWide);
    if (hasSystemWideRole) {
      console.log('User has system-wide role, granting full access');
      return next();
    }

    // Nếu không có vai trò toàn hệ thống, yêu cầu semesterId
    if (!semesterId) {
      return res.status(400).json({ message: 'Missing semesterId for semester-specific action' });
    }

    // Kiểm tra vai trò hợp lệ cho semesterId
    const hasValidSemesterRole = userRoles.some(
      (role) =>
        allowedRoles.includes(role.roleId) &&
        role.semesterId === semesterId &&
        role.semesterId !== null
    );

    if (!hasValidSemesterRole) {
      return res.status(403).json({
        message: `Forbidden: Role not valid for semester ${semesterId}`,
      });
    }

    console.log(`Access granted for semester ${semesterId}`);
    next();
  };
};
*/


export const checkRole = (allowedRoles: string[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    // Nếu user có bất kỳ vai trò nào là system-wide, cho phép truy cập ngay
    const hasSystemWideRole = req.user.roles.some(role => role.isSystemWide);
    if (hasSystemWideRole) {
      console.log('User has system-wide role, granting full access');
      return next();
    }
    
    // Nếu không, kiểm tra vai trò dựa trên allowedRoles và semesterId
    const hasRequiredRole = req.user.roles.some(role => allowedRoles.includes(role.roleId));
    if (!hasRequiredRole) {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
    }
    
    const semesterId = (req.query.semesterId as string) || (req.body.semesterId as string);
    if (!semesterId) {
      return res.status(400).json({ message: 'Missing semesterId for semester-specific action' });
    }
    
    const hasValidSemesterRole = req.user.roles.some(
      role => allowedRoles.includes(role.roleId) && role.semesterId === semesterId && role.semesterId !== null
    );
    
    if (!hasValidSemesterRole) {
      return res.status(403).json({
        message: `Forbidden: Role not valid for semester ${semesterId}`,
      });
    }
    
    console.log(`Access granted for semester ${semesterId}`);
    next();
  };
};
