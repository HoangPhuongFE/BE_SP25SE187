import { Request, Response, NextFunction } from 'express';
import { AIService } from '../service/ai.service';
import { MESSAGES } from '../constants/message';

export class AIMiddleware {
  private aiService: AIService;

  constructor() {
    this.aiService = new AIService();
  }

  // Middleware kiểm tra mã đề tài
  validateTopicCode = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { topicCode } = req.body;

      if (!topicCode) {
        return res.status(400).json({
          success: false,
          message: "Mã đề tài là bắt buộc"
        });
      }

      const result = await this.aiService.validateTopicCode(topicCode);
      
      if (!result.isValid) {
        return res.status(400).json({
          success: false,
          message: result.message
        });
      }

      next();
    } catch (error) {
      console.error('Lỗi khi kiểm tra mã đề tài:', error);
      return res.status(500).json({
        success: false,
        message: MESSAGES.TOPIC.AI_VALIDATION_FAILED + "Lỗi hệ thống"
      });
    }
  };

  // Middleware kiểm tra tên đề tài
  validateTopicName = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { topicName } = req.body;

      if (!topicName) {
        return res.status(400).json({
          success: false,
          message: "Tên đề tài là bắt buộc"
        });
      }

      const result = await this.aiService.validateTopicName(topicName);
      
      if (!result.isValid) {
        return res.status(400).json({
          success: false,
          message: result.message
        });
      }

      next();
    } catch (error) {
      console.error('Lỗi khi kiểm tra tên đề tài:', error);
      return res.status(500).json({
        success: false,
        message: MESSAGES.TOPIC.AI_VALIDATION_FAILED + "Lỗi hệ thống"
      });
    }
  };

  // Middleware kiểm tra mã nhóm
  validateGroupCode = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { groupCode, semesterId } = req.body;

      if (!groupCode || !semesterId) {
        return res.status(400).json({
          success: false,
          message: "Mã nhóm và ID học kỳ là bắt buộc"
        });
      }

      const result = await this.aiService.validateGroupCode(groupCode, semesterId);
      
      if (!result.isValid) {
        return res.status(400).json({
          success: false,
          message: result.message
        });
      }

      next();
    } catch (error) {
      console.error('Lỗi khi kiểm tra mã nhóm:', error);
      return res.status(500).json({
        success: false,
        message: MESSAGES.TOPIC.AI_VALIDATION_FAILED + "Lỗi hệ thống"
      });
    }
  };

  // Middleware kiểm tra toàn bộ thông tin đề tài
  validateTopic = async (req: Request, res: Response, next: NextFunction) => {
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

      if (!codeResult.isValid || !nameResult.isValid || !groupResult.isValid) {
        const messages = [];
        if (!codeResult.isValid) messages.push(codeResult.message);
        if (!nameResult.isValid) messages.push(nameResult.message);
        if (!groupResult.isValid) messages.push(groupResult.message);

        return res.status(400).json({
          success: false,
          message: messages.join(", ")
        });
      }

      next();
    } catch (error) {
      console.error('Lỗi khi kiểm tra thông tin đề tài:', error);
      return res.status(500).json({
        success: false,
        message: MESSAGES.TOPIC.AI_VALIDATION_FAILED + "Lỗi hệ thống"
      });
    }
  };
} 