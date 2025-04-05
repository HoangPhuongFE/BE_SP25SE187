import { Request, Response } from 'express';
import { AIService } from '../services/ai.service';
import { MESSAGES } from '../constants/message';

export class AIController {
  private aiService: AIService;

  constructor() {
    this.aiService = new AIService();
  }

  /** API kiểm tra tên đề tài */
  public async validateTopicName(req: Request, res: Response) {
    try {
      const { nameVi, nameEn } = req.body;

      if (!nameVi || !nameEn) {
        return res.status(400).json({
          success: false,
          message: 'Tên đề tài tiếng Việt và tiếng Anh là bắt buộc',
        });
      }

      const result = await this.aiService.validateTopicName(nameVi, nameEn);

      return res.status(result.isValid ? 200 : 400).json({
        success: result.isValid,
        message: result.message,
      });
    } catch (error) {
      console.error('Lỗi khi kiểm tra tên đề tài:', error);
      return res.status(500).json({
        success: false,
        message: `${MESSAGES.TOPIC.AI_VALIDATION_FAILED} Lỗi hệ thống`,
      });
    }
  }
}