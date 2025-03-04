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

    // Truy vấn UserRole để lấy đầy đủ thông tin vai trò
    const userRoles = await prisma.userRole.findMany({
      where: { userId, isActive: true },
      select: { roleId: true, semesterId: true, isActive: true },
    });

    if (!userRoles.length) {
      return res.status(403).json({ message: 'Forbidden: No active roles found for user.' });
    }

    // Fetch user email from the database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    req.user = {
      userId,
      email: user.email,
      roles: userRoles, // Gắn danh sách roles với roleId và semesterId
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




const SYSTEM_DEFAULT_SEMESTER_ID = 'system-default-id'; // Thay bằng ID thực tế sau seed

export const checkRole = (allowedRoles: string[], requireSemester: boolean = false) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const semesterId = (req.body.semesterId || req.query.semesterId) as string;

    // Lấy danh sách role từ UserRole dựa trên roles trong req.user
    const userRoles = await prisma.userRole.findMany({
      where: {
        userId: req.user.userId,
        roleId: { in: req.user.roles.map(r => r.roleId) },
        isActive: true,
      },
      include: { role: true },
    });

    const userRoleNames = userRoles.map(ur => ur.role.name);
 //   console.log('User Role Names:', userRoleNames);
  //  console.log('User Roles with Semester:', userRoles.map(ur => ({ role: ur.role.name, semesterId: ur.semesterId })));

    // Kiểm tra xem user có vai trò cần thiết không
    const hasRequiredRole = userRoleNames.some(role => allowedRoles.includes(role));
    if (!hasRequiredRole) {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
    }

    // Kiểm tra quyền toàn hệ thống hoặc theo học kỳ
    const hasSystemWideRole = userRoles.some(ur => 
      ur.role.isSystemWide || ur.semesterId === SYSTEM_DEFAULT_SEMESTER_ID
    );
    const hasSemesterSpecificRole = semesterId && userRoles.some(ur => 
      allowedRoles.includes(ur.role.name) && ur.semesterId === semesterId
    );

    if (hasSystemWideRole) {
      console.log('User has system-wide role, granting full access');
      return next();
    } else if (requireSemester) {
      if (!semesterId) {
        return res.status(400).json({ message: 'Missing semesterId for semester-specific action' });
      }
      if (!hasSemesterSpecificRole) {
        return res.status(403).json({ message: `Forbidden: Role not valid for semester ${semesterId}` });
      }
      console.log(`Access granted for semester ${semesterId}`);
      return next();
    }

    console.log('Access granted (no semester check required)');
    next();
  };
};