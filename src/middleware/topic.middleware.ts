import { Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { AuthenticatedRequest } from './user.middleware';
import { TOPIC_MESSAGE } from '../constants/message';
import { PrismaClient } from '@prisma/client';
import { GroupService } from '~/service/group.service';

const prisma = new PrismaClient();

export const validateCreateTopic = [
  body('name').notEmpty().withMessage(TOPIC_MESSAGE.NAME_REQUIRED),
  body('description').notEmpty().withMessage(TOPIC_MESSAGE.DESCRIPTION_REQUIRED),
  body('maxStudents').isInt({ min: 1 }).withMessage(TOPIC_MESSAGE.MAX_STUDENTS_INVALID),
  body('semesterId').notEmpty().withMessage(TOPIC_MESSAGE.SEMESTER_REQUIRED),
  body('majors').isArray().notEmpty().withMessage(TOPIC_MESSAGE.INVALID_MAJOR),
  body('isBusiness').isBoolean().optional(),
  body('businessPartner').custom((value, { req }) => {
    if (req.body.isBusiness && !value) {
      throw new Error(TOPIC_MESSAGE.INVALID_BUSINESS_INFO);
    }
    return true;
  }),

  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { topicCode } = req.body;
    if (topicCode) {
      const existingTopic = await prisma.topic.findUnique({
        where: { topicCode }
      });
      if (existingTopic) {
        return res.status(400).json({ message: TOPIC_MESSAGE.DUPLICATE_TOPIC_CODE });
      }
    }

    next();
  }
];

export const validateUpdateTopic = [
  param('id').notEmpty().withMessage('Topic ID is required'),
  body('name').optional().notEmpty().withMessage(TOPIC_MESSAGE.NAME_REQUIRED),
  body('description').optional().notEmpty().withMessage(TOPIC_MESSAGE.DESCRIPTION_REQUIRED),
  body('maxStudents').optional().isInt({ min: 1 }).withMessage(TOPIC_MESSAGE.MAX_STUDENTS_INVALID),
  body('majors').optional().isArray().notEmpty().withMessage(TOPIC_MESSAGE.INVALID_MAJOR),

  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const topic = await prisma.topic.findUnique({
      where: { id }
    });

    if (!topic) {
      return res.status(404).json({ message: TOPIC_MESSAGE.TOPIC_NOT_FOUND });
    }

    next();
  }
];

export const validateTopicRegistration = [
  body('name').notEmpty().withMessage(TOPIC_MESSAGE.NAME_REQUIRED),
  body('description').notEmpty().withMessage(TOPIC_MESSAGE.DESCRIPTION_REQUIRED),
  body('semesterId').notEmpty().withMessage('Semester ID là bắt buộc'),
  body('majorId').notEmpty().withMessage('Major ID là bắt buộc'),
  
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user?.userId;
    const userRoles = req.user?.roles || [];

    // Kiểm tra nếu là mentor
    if (userRoles.includes('mentor')) {
      const registeredTopicsCount = await prisma.topicRegistration.count({
        where: {
          userId,
          role: 'mentor'
        }
      });

      if (registeredTopicsCount >= 5) {
        return res.status(400).json({ message: TOPIC_MESSAGE.MENTOR_MAX_TOPICS_REACHED });
      }
    }

    // Kiểm tra nếu là leader
    if (userRoles.includes('leader')) {
      const student = await prisma.student.findUnique({
        where: { userId },
        include: {
          groupMembers: {
            include: {
              group: {
                include: {
                  decisions: {
                    include: {
                      topic: {
                        include: {
                          topicRegistrations: true
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });

      const hasGroupWithTopic = student?.groupMembers.some(
        member => member.group.decisions.some(decision => decision.topic.topicRegistrations.some(registration => registration.status === 'pending'))
      );



      if (hasGroupWithTopic) {
        return res.status(400).json({ message: TOPIC_MESSAGE.GROUP_ALREADY_HAS_TOPIC });
      }
    }

    next();
  }
];