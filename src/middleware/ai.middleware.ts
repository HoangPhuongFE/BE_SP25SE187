import { Request, Response, NextFunction } from 'express';
import { AIService } from '../service/ai.service';
import { MESSAGES } from '../constants/message';

export class AIMiddleware {
  private aiService: AIService;

  constructor() {
    this.aiService = new AIService();
  }

  /** Middleware kiểm tra tên đề tài */
  public async validateTopicName(req: Request, res: Response, next: NextFunction) {
    try {
      const { nameVi, nameEn } = req.body;

      if (!nameVi || !nameEn) {
        return res.status(400).json({
          success: false,
          message: 'Tên đề tài tiếng Việt và tiếng Anh là bắt buộc',
        });
      }

      const result = await this.aiService.validateTopicName(nameVi, nameEn);

      if (!result.isValid) {
        return res.status(400).json({
          success: false,
          message: result.message,
        });
      }

      next();
    } catch (error) {
      console.error('Lỗi khi kiểm tra tên đề tài:', error);
      return res.status(500).json({
        success: false,
        message: `${MESSAGES.TOPIC.AI_VALIDATION_FAILED} Lỗi hệ thống`,
      });
    }
  }
}