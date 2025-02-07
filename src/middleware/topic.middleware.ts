import { Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { AuthenticatedRequest } from './user.middleware';
import { TOPIC_MESSAGE } from '../constants/message';
import { PrismaClient } from '@prisma/client';

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
  param('registrationId').notEmpty().withMessage('Registration ID is required'),
  body('status').isIn(['APPROVED', 'REJECTED']).withMessage(TOPIC_MESSAGE.INVALID_STATUS),
  body('reviewerId').optional().isString().withMessage(TOPIC_MESSAGE.INVALID_REVIEWER),

  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { registrationId } = req.params;
    const registration = await prisma.topicRegistration.findUnique({
      where: { id: registrationId }
    });

    if (!registration) {
      return res.status(404).json({ message: TOPIC_MESSAGE.TOPIC_REGISTRATION_NOT_FOUND });
    }

    next();
  }
]; 