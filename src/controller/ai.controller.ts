import { Request, Response } from 'express';
import { AIService } from '../service/ai.service';
import { MESSAGES } from '../constants/message';

export class AIController {
  private aiService: AIService;

  constructor() {
    this.aiService = new AIService();
  }

  // Kiểm tra mã đề tài
  async validateTopicCode(req: Request, res: Response) {
    try {
      const { topicCode } = req.body;

      if (!topicCode) {
        return res.status(400).json({
          success: false,
          message: "Mã đề tài là bắt buộc"
        });
      }

      const result = await this.aiService.validateTopicCode(topicCode);
      
      return res.status(result.isValid ? 200 : 400).json({
        success: result.isValid,
        message: result.message
      });
    } catch (error) {
      console.error('Lỗi khi kiểm tra mã đề tài:', error);
      return res.status(500).json({
        success: false,
        message: MESSAGES.TOPIC.AI_VALIDATION_FAILED + "Lỗi hệ thống"
      });
    }
  }

  // Kiểm tra tên đề tài
  async validateTopicName(req: Request, res: Response) {
    try {
      const { topicName } = req.body;

      if (!topicName) {
        return res.status(400).json({
          success: false,
          message: "Tên đề tài là bắt buộc"
        });
      }

      const result = await this.aiService.validateTopicName(topicName);
      
      return res.status(result.isValid ? 200 : 400).json({
        success: result.isValid,
        message: result.message
      });
    } catch (error) {
      console.error('Lỗi khi kiểm tra tên đề tài:', error);
      return res.status(500).json({
        success: false,
        message: MESSAGES.TOPIC.AI_VALIDATION_FAILED + "Lỗi hệ thống"
      });
    }
  }

  // Kiểm tra mã nhóm
  async validateGroupCode(req: Request, res: Response) {
    try {
      const { groupCode, semesterId } = req.body;

      if (!groupCode || !semesterId) {
        return res.status(400).json({
          success: false,
          message: "Mã nhóm và ID học kỳ là bắt buộc"
        });
      }

      const result = await this.aiService.validateGroupCode(groupCode, semesterId);
      
      return res.status(result.isValid ? 200 : 400).json({
        success: result.isValid,
        message: result.message
      });
    } catch (error) {
      console.error('Lỗi khi kiểm tra mã nhóm:', error);
      return res.status(500).json({
        success: false,
        message: MESSAGES.TOPIC.AI_VALIDATION_FAILED + "Lỗi hệ thống"
      });
    }
  }

  // Kiểm tra toàn bộ thông tin đề tài
  async validateTopic(req: Request, res: Response) {
    try {
      const { topicCode, topicName, groupCode, semesterId } = req.body;

      if (!topicCode || !topicName || !groupCode || !semesterId) {
        return res.status(400).json({
          success: false,
          message: "Thiếu thông tin bắt buộc"
        });
      }

      const [codeResult, nameResult, groupResult] = await Promise.all([
        this.aiService.validateTopicCode(topicCode),
        this.aiService.validateTopicName(topicName),
        this.aiService.validateGroupCode(groupCode, semesterId)
      ]);

      const isValid = codeResult.isValid && nameResult.isValid && groupResult.isValid;
      const messages = [];

      if (!codeResult.isValid) messages.push(codeResult.message);
      if (!nameResult.isValid) messages.push(nameResult.message);
      if (!groupResult.isValid) messages.push(groupResult.message);

      return res.status(isValid ? 200 : 400).json({
        success: isValid,
        message: isValid ? "Tất cả thông tin hợp lệ" : messages.join(", ")
      });
    } catch (error) {
      console.error('Lỗi khi kiểm tra thông tin đề tài:', error);
      return res.status(500).json({
        success: false,
        message: MESSAGES.TOPIC.AI_VALIDATION_FAILED + "Lỗi hệ thống"
      });
    }
  }
} 