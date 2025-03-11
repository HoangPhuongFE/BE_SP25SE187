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
        name: ur.role.name,
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
    // Kiểm tra xem người dùng đã được xác thực hay chưa
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    // Nếu người dùng có bất kỳ vai trò nào là system-wide, cho phép truy cập ngay
    const hasSystemWideRole = req.user.roles.some((role) => role.isSystemWide);
    if (hasSystemWideRole) {
      console.log('User has system-wide role, granting full access');
      return next();
    }
    // Kiểm tra xem có vai trò nào của người dùng có tên nằm trong allowedRoles không
    const hasRequiredRole = req.user.roles.some((role) =>
      allowedRoles.includes(role.name)
    );
    if (!hasRequiredRole) {
      return res
        .status(403)
        .json({ message: 'Forbidden: Insufficient permissions' });
    }
    // Lấy semesterId từ query hoặc body
    const semesterId =
      (req.params.semesterId as string) || (req.body.semesterId as string);
    if (!semesterId) {
      return res
        .status(400)
        .json({ message: 'Missing semesterId for semester-specific action' });
    }
    // Kiểm tra xem người dùng có vai trò nào hợp lệ cho học kỳ hiện tại không
    const hasValidSemesterRole = req.user.roles.some(
      (role) =>
        allowedRoles.includes(role.name) &&
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
  }
}
*/



export const checkRole = (allowedRoles: string[], requireSemester: boolean = true) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Kiểm tra xác thực người dùng
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Kiểm tra vai trò toàn hệ thống
    const hasSystemWideRole = req.user.roles.some((role) => role.isSystemWide);
    if (hasSystemWideRole) {
      console.log('User has system-wide role, granting full access');
      return next();
    }

    // Kiểm tra vai trò cần thiết
    const hasRequiredRole = req.user.roles.some((role) =>
      allowedRoles.includes(role.name)
    );
    if (!hasRequiredRole) {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
    }

    // Nếu không yêu cầu semesterId, cho phép truy cập
    if (!requireSemester) {
      console.log('Access granted without semester check');
      return next();
    }

    // Kiểm tra semesterId nếu requireSemester = true
    const semesterId = req.params.semesterId || req.body.semesterId || req.query.semesterId;
    if (!semesterId) {
      return res.status(400).json({ message: 'Missing semesterId for semester-specific action' });
    }

    // Kiểm tra vai trò hợp lệ cho học kỳ
    const hasValidSemesterRole = req.user.roles.some(
      (role) =>
        allowedRoles.includes(role.name) &&
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