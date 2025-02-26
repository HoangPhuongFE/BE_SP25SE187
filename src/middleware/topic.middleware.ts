import { Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { AuthenticatedRequest } from './user.middleware';
import { TOPIC_MESSAGE } from '../constants/message';
import { PrismaClient } from '@prisma/client';
import { GroupService } from '~/service/group.service';
import { TopicService } from '~/service/topic.service';

const prisma = new PrismaClient();

export const validateTopicWithAI = async (
  req: AuthenticatedRequest,
  res: Response, 
  next: NextFunction
) => {
  try {
    // Kiểm tra cấu hình và môi trường
    if (process.env.SKIP_AI_VALIDATION === 'true' || !process.env.GEMINI_API_KEY) {
      return next();
    }

    const topicService = new TopicService();
    const { name, topicCode } = req.body;

    // Validate input
    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        message: 'Tên đề tài không hợp lệ',
        field: 'name'
      });
    }

    // Thực hiện kiểm tra song song để tối ưu thời gian
    const validations = await Promise.allSettled([
      topicService.validateWithAI(name, 'name'),
      topicCode ? topicService.validateWithAI(topicCode, 'code') : Promise.resolve({ isValid: true })
    ]);

    // Xử lý kết quả kiểm tra tên
    if (validations[0].status === 'rejected') {
      console.error('Name validation error:', validations[0].reason);
      if (process.env.NODE_ENV === 'production') {
        return next();
      }
      return res.status(500).json({
        message: TOPIC_MESSAGE.AI_VALIDATION_FAILED,
        detail: 'Lỗi kiểm tra tên đề tài',
        field: 'name'
      });
    }

    const nameValidation = validations[0].value;
    if (!nameValidation.isValid) {
      return res.status(400).json({
        message: TOPIC_MESSAGE.INVALID_TOPIC_NAME,
        detail: nameValidation.message,
        field: 'name'
      });
    }

    // Xử lý kết quả kiểm tra mã (nếu có)
    if (topicCode && validations[1].status === 'fulfilled') {
      const codeValidation = validations[1].value;
      if (!codeValidation.isValid) {
        return res.status(400).json({
          message: TOPIC_MESSAGE.INVALID_TOPIC_CODE,
          detail: codeValidation.isValid,
          field: 'topicCode'
        });
      }
    }

    // Cache kết quả kiểm tra nếu hợp lệ
    // TODO: Implement caching mechanism

    next();
  } catch (error) {
    console.error('AI Validation Middleware Error:', error);
    
    // Log error
    await prisma.systemLog.create({
      data: {
        action: 'AI_VALIDATION_MIDDLEWARE',
        entityType: 'TOPIC',
        entityId: 'N/A',
        error: (error as Error).message,
        stackTrace: (error as Error).stack,
        severity: 'ERROR',
        ipAddress: req.ip || 'UNKNOWN',
        userId: req.user?.userId || 'SYSTEM'
      }
    }).catch(console.error);
    
    // Trong môi trường production, cho phép tiếp tục
    if (process.env.NODE_ENV === 'production') {
      return next();
    }
    
    return res.status(500).json({
      message: TOPIC_MESSAGE.AI_VALIDATION_FAILED,
      detail: (error as Error).message
    });
  }
};

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
  validateTopicWithAI,

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
  body('name').optional().notEmpty().withMessage(TOPIC_MESSAGE.NAME_REQUIRED),
  body('description').optional().notEmpty().withMessage(TOPIC_MESSAGE.DESCRIPTION_REQUIRED),
  body('maxStudents').optional().isInt({ min: 1 }).withMessage(TOPIC_MESSAGE.MAX_STUDENTS_INVALID),
  body('majors').optional().isArray().notEmpty().withMessage(TOPIC_MESSAGE.INVALID_MAJOR),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE', 'PENDING']).withMessage('Trạng thái không hợp lệ'),
  body('isBusiness').optional().isBoolean().withMessage('isBusiness phải là boolean'),
  body('businessPartner').optional().custom((value, { req }) => {
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

    const { topicId } = req.params;
    const topic = await prisma.topic.findUnique({
      where: { id: topicId }
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
  body('subSupervisor')
    .optional()
    .custom(async (value, { req }) => {
      if (value) {
        // Kiểm tra xem subSupervisor có tồn tại và có phải là mentor không
        const subMentor = await prisma.user.findFirst({
          where: {
            id: value,
            roles: {
              some: {
                role: {
                  name: 'mentor'
                }
              }
            }
          }
        });

        if (!subMentor) {
          throw new Error('Mentor phụ không tồn tại hoặc không có quyền mentor');
        }

        // Kiểm tra xem subSupervisor có phải là mentor chính không
        if (value === req.user?.userId) {
          throw new Error('Mentor phụ không thể là mentor chính');
        }
      }
      return true;
    }),
  
  validateTopicWithAI,
  
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

    next();
  }
];

export const validateTopicApproval = [
  param('registrationId').notEmpty().withMessage('ID đăng ký là bắt buộc'),
  body('status')
    .isIn(['approved', 'rejected', 'pending', 'considering'])
    .withMessage('Trạng thái không hợp lệ'),

  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { registrationId } = req.params;
    const registration = await prisma.topicRegistration.findUnique({
      where: { id: registrationId },
      include: {
        topic: true
      }
    });

    if (!registration) {
      return res.status(404).json({ 
        message: TOPIC_MESSAGE.TOPIC_REGISTRATION_NOT_FOUND 
      });
    }

    // Chỉ duyệt đề tài được đăng ký bởi mentor hoặc student
    if (registration.topic.createdBy === req.user?.userId) {
      return res.status(403).json({
        message: 'Không thể duyệt đề tài do chính mình tạo'
      });
    }

    next();
  }
];

export const validateCreateCouncil = [
  param('registrationId').notEmpty().withMessage('ID đăng ký là bắt buộc'),
  body('numberOfMembers')
    .isInt({ min: 1 })
    .withMessage('Số lượng thành viên hội đồng phải lớn hơn 0'),
  body('mentorIds')
    .isArray()
    .withMessage('Danh sách mentor phải là một mảng')
    .custom((value, { req }) => {
      if (value.length !== req.body.numberOfMembers) {
        throw new Error('Số lượng mentor phải khớp với số lượng thành viên hội đồng');
      }
      return true;
    }),

  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { registrationId } = req.params;
    const registration = await prisma.topicRegistration.findUnique({
      where: { id: registrationId },
      include: {
        topic: true
      }
    });

    if (!registration) {
      return res.status(404).json({ 
        message: TOPIC_MESSAGE.TOPIC_REGISTRATION_NOT_FOUND 
      });
    }

    // Kiểm tra xem đã có hội đồng duyệt chưa
    const existingCouncil = await prisma.council.findFirst({
      where: {
        topicAssId: registration.topicId
      }
    });

    if (existingCouncil) {
      return res.status(400).json({
        message: 'Đề tài này đã có hội đồng duyệt'
      });
    }

    next();
  }
];