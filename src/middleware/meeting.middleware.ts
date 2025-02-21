import { Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { AuthenticatedRequest } from './user.middleware';
import { MEETING_MESSAGE } from '../constants/message';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const validateCreateMeeting = [
  body('groupId').notEmpty().withMessage('Group ID là bắt buộc'),
  body('meetingTime').isISO8601().withMessage(MEETING_MESSAGE.INVALID_MEETING_TIME),
  body('location').notEmpty().withMessage('Địa điểm là bắt buộc'),
  body('agenda').notEmpty().withMessage('Nội dung họp là bắt buộc'),

  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { groupId } = req.body;
    const mentorId = req.user!.userId;

    // Kiểm tra xem user có phải là mentor của group không
    const group = await prisma.group.findFirst({
      where: {
        id: groupId,
        mentors: {
          some: { mentorId: mentorId }  
        }
      }
    });
    

    if (!group) {
      return res.status(403).json({ message: MEETING_MESSAGE.UNAUTHORIZED_MENTOR });
    }

    next();
  }
]; 