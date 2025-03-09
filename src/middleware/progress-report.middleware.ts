import { Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { MESSAGES } from '../constants/message';

export const validateCreateProgressReport = [
  body('groupId').isString().notEmpty().withMessage('ID nhóm là bắt buộc'),
  body('weekNumber').isInt({ min: 1 }).withMessage('Số tuần phải là số nguyên dương'),
  body('content').isString().notEmpty().withMessage('Nội dung báo cáo là bắt buộc'),
  body('completionPercentage').isFloat({ min: 0, max: 100 }).withMessage('Phần trăm hoàn thành phải từ 0-100'),
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
  param('id').isString().notEmpty().withMessage('ID báo cáo tiến độ là bắt buộc'),
  body('content').optional().isString().notEmpty().withMessage('Nội dung báo cáo không được để trống nếu cung cấp'),
  body('completionPercentage').optional().isFloat({ min: 0, max: 100 }).withMessage('Phần trăm hoàn thành phải từ 0-100'),
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