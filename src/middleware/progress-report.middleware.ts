import { Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { MESSAGES } from '../constants/message';

export const validateCreateProgressReport = [
  body('content')
    .isString()
    .notEmpty()
    .withMessage('Nội dung báo cáo là bắt buộc')
    .isLength({ min: 5, max: 10000 })
    .withMessage('Nội dung báo cáo phải từ 5 đến 10000 ký tự'),
  body('completionPercentage')
    .isFloat({ min: 0, max: 100 })
    .withMessage('Phần trăm hoàn thành phải từ 0-100'),
  body('groupId')
    .optional()
    .isString()
    .withMessage('ID nhóm phải là chuỗi'),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: MESSAGES.PROGRESS_REPORT.INVALID_REQUEST, 
        errors: errors.array() 
      });
    }
    next();
  }
];

export const validateCreateReportPeriod = [
  body('groupId')
    .isString()
    .notEmpty()
    .withMessage('ID nhóm là bắt buộc'),
  body('weekNumber')
    .isInt({ min: 1 })
    .withMessage('Số tuần phải là số nguyên dương'),
  body('startDate')
    .isISO8601()
    .withMessage('Ngày bắt đầu phải là định dạng ISO8601'),
  body('endDate')
    .isISO8601()
    .withMessage('Ngày kết thúc phải là định dạng ISO8601')
    .custom((value, { req }) => {
      const endDate = new Date(value);
      const startDate = new Date(req.body.startDate);
      if (endDate <= startDate) {
        throw new Error('Ngày kết thúc phải sau ngày bắt đầu');
      }
      return true;
    }),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: MESSAGES.PROGRESS_REPORT.INVALID_REQUEST, 
        errors: errors.array() 
      });
    }
    next();
  }
];

export const validateUpdateProgressReport = [
  param('id')
    .isString()
    .notEmpty()
    .withMessage('ID báo cáo tiến độ là bắt buộc'),
  body('content')
    .optional()
    .isString()
    .notEmpty()
    .withMessage('Nội dung báo cáo không được để trống nếu cung cấp')
    .isLength({ min: 5, max: 10000 })
    .withMessage('Nội dung báo cáo phải từ 5 đến 10000 ký tự'),
  body('completionPercentage')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Phần trăm hoàn thành phải từ 0-100'),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: MESSAGES.PROGRESS_REPORT.INVALID_REQUEST, 
        errors: errors.array() 
      });
    }
    next();
  }
];

export const validateMentorFeedback = [
  param('id')
    .isString()
    .notEmpty()
    .withMessage('ID báo cáo tiến độ là bắt buộc'),
  body('mentorFeedback')
    .isString()
    .notEmpty()
    .withMessage('Nội dung phản hồi là bắt buộc')
    .isLength({ min: 5, max: 5000 })
    .withMessage('Nội dung phản hồi phải từ 5 đến 5000 ký tự'),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: MESSAGES.PROGRESS_REPORT.INVALID_REQUEST, 
        errors: errors.array() 
      });
    }
    next();
  }
];

export const validateUpdateMentorFeedback = [
  body('groupId')
    .optional()
    .isString()
    .withMessage('ID nhóm phải là chuỗi'),
  body('groupCode')
    .optional()
    .isString()
    .withMessage('Mã nhóm phải là chuỗi'),
  body('weekNumber')
    .isInt({ min: 1 })
    .withMessage('Số tuần phải là số nguyên dương'),
  body('feedback')
    .isString()
    .notEmpty()
    .withMessage('Nội dung phản hồi là bắt buộc')
    .isLength({ min: 5, max: 5000 })
    .withMessage('Nội dung phản hồi phải từ 5 đến 5000 ký tự'),
  body()
    .custom((value) => {
      if (!value.groupId && !value.groupCode) {
        throw new Error('Cần cung cấp groupId hoặc groupCode');
      }
      return true;
    }),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: MESSAGES.PROGRESS_REPORT.INVALID_REQUEST, 
        errors: errors.array() 
      });
    }
    next();
  }
]; 