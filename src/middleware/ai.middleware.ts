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
      const { topicCode, semesterId, majorId } = req.body;

      if (!topicCode || !semesterId || !majorId) {
        return res.status(400).json({
          success: false,
          message: "Mã đề tài, ID học kỳ và ID chuyên ngành là bắt buộc"
        });
      }

      const result = await this.aiService.validateTopicCode(topicCode, semesterId, majorId);
      
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
      const { nameVi, nameEn, nameProject } = req.body;

      if (!nameVi || !nameEn || !nameProject) {
        return res.status(400).json({
          success: false,
          message: "Tên đề tài tiếng Việt, tiếng Anh và tên dự án là bắt buộc"
        });
      }

      const result = await this.aiService.validateTopicName(nameVi, nameEn, nameProject);
      
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
      const { topicCode, nameVi, nameEn, nameProject, description, groupCode, semesterId, majorId } = req.body;

      // Kiểm tra các trường bắt buộc
      if (!topicCode || !nameVi || !nameEn || !nameProject || !description || !semesterId || !majorId) {
        return res.status(400).json({
          success: false,
          message: "Thiếu thông tin bắt buộc cho đề tài: mã đề tài, tên tiếng Việt, tên tiếng Anh, tên dự án, mô tả, ID học kỳ, ID chuyên ngành"
        });
      }

      // Kiểm tra độ dài của các trường
      if (description.length < 50 || description.length > 1000) {
        return res.status(400).json({
          success: false,
          message: "Mô tả đề tài phải có độ dài từ 50-1000 ký tự"
        });
      }

      const result = await this.aiService.validateTopic(
        topicCode,
        nameVi,
        nameEn,
        nameProject,
        description,
        groupCode || null,
        semesterId,
        majorId
      );

      if (!result.isValid) {
        return res.status(400).json({
          success: false,
          message: result.message
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

  // Middleware kiểm tra quyết định phân công
  validateAssignmentVerification = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { semesterId } = req.body;

      // Kiểm tra dữ liệu đầu vào
      if (!semesterId) {
        return res.status(400).json({
          success: false,
          message: "ID học kỳ là bắt buộc"
        });
      }

      next();
    } catch (error) {
      console.error('Lỗi trong middleware validateAssignmentVerification:', error);
      return res.status(500).json({
        success: false,
        message: "Lỗi hệ thống khi kiểm tra quyết định phân công"
      });
    }
  }
} 