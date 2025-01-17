import { Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { AuthenticatedRequest } from './user.middleware';
import { ADMIN_MESSAGE } from '../constants/message';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const validateCreateUser = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('username').isLength({ min: 3 }),
  body('fullName').optional().isString(),
  body('roles').isArray().notEmpty(),
  
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, username, roles } = req.body;

    // Kiểm tra email và username tồn tại
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
        return res.status(400).json({ message: 'Email đã tồn tại' });
      }
      return res.status(400).json({ message: 'Username đã tồn tại' });
    }

    // Kiểm tra roles hợp lệ
    const validRoles = ['student', 'lecturer', 'head_of_department', 'dean', 'reviewer', 'mentor', 'chairman', 'secretary'];
    const isValidRoles = roles.every((role: string) => validRoles.includes(role));
    
    if (!isValidRoles) {
      return res.status(400).json({ message: ADMIN_MESSAGE.INVALID_ROLE });
    }

    // Kiểm tra quy tắc student role
    if (roles.includes('student') && roles.length > 1) {
      return res.status(400).json({ message: ADMIN_MESSAGE.STUDENT_ROLE_RESTRICTION });
    }

    next();
  }
]; 