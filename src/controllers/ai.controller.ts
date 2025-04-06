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



public async batchVerifyDecision(req: Request, res: Response) {
  try {
    const { items } = req.body;
    const verifiedBy = req.user?.id;

    if (!Array.isArray(items) || items.length === 0 || !verifiedBy) {
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu đầu vào không hợp lệ hoặc thiếu người xác thực',
      });
    }

    const result = await this.aiService.batchVerifyDecision(items, verifiedBy);
    return res.status(200).json({ success: true, results: result });
  } catch (error) {
    console.error('Lỗi batchVerifyDecision:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi xác minh hàng loạt',
      error: (error as Error).message,
    });
  }
}


}