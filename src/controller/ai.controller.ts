import { Request, Response } from 'express';
import { AIService } from '../service/ai.service';
import { MESSAGES } from '../constants/message';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class AIController {
  private aiService: AIService;

  constructor() {
    this.aiService = new AIService();
    // Bind các phương thức để giữ nguyên context
    this.trainModel = this.trainModel.bind(this);
    this.validateTopicCode = this.validateTopicCode.bind(this);
    this.validateTopicName = this.validateTopicName.bind(this);
    this.validateGroupCode = this.validateGroupCode.bind(this);
    this.validateTopic = this.validateTopic.bind(this);
    this.verifyAssignmentDecision = this.verifyAssignmentDecision.bind(this);
    this.switchAIProvider = this.switchAIProvider.bind(this);
    this.getAIConfig = this.getAIConfig.bind(this);
  }

  // Train model AI
  async trainModel(req: Request, res: Response) {
    try {
      const result = await this.aiService.retrainModel();
      
      return res.status(result.success ? 200 : 500).json({
        success: result.success,
        message: result.message
      });
    } catch (error) {
      console.error('Lỗi khi train model:', error);
      return res.status(500).json({
        success: false,
        message: MESSAGES.TOPIC.AI_VALIDATION_FAILED + "Lỗi khi train model"
      });
    }
  }

  // Kiểm tra mã đề tài
  async validateTopicCode(req: Request, res: Response) {
    try {
      const { topicCode, semesterId, majorId } = req.body;

      if (!topicCode || !semesterId || !majorId) {
        return res.status(400).json({
          success: false,
          message: "Mã đề tài, ID học kỳ và ID chuyên ngành là bắt buộc"
        });
      }

      const result = await this.aiService.validateTopicCode(topicCode, semesterId, majorId);
      
      return res.status(result.isValid ? 200 : 400).json({
        success: result.isValid,
        message: result.message
      });
    } catch (error) {
      console.error('Lỗi khi kiểm tra mã đề tài:', error);
      return res.status(500).json({
        success: false,
        message: "Lỗi hệ thống khi kiểm tra mã đề tài"
      });
    }
  }

  // Kiểm tra tên đề tài
  async validateTopicName(req: Request, res: Response) {
    try {
      const { nameVi, nameEn, nameProject } = req.body;

      if (!nameVi || !nameEn || !nameProject) {
        return res.status(400).json({
          success: false,
          message: "Tên đề tài tiếng Việt, tiếng Anh và tên dự án là bắt buộc"
        });
      }

      const result = await this.aiService.validateTopicName(nameVi, nameEn, nameProject);
      
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
      const { topicCode, nameVi, nameEn, nameProject, description, groupCode, semesterId, majorId } = req.body;

      if (!topicCode || !nameVi || !nameEn || !nameProject || !description || !groupCode || !semesterId || !majorId) {
        return res.status(400).json({
          success: false,
          message: "Thiếu thông tin bắt buộc"
        });
      }

      // Kiểm tra từng phần riêng biệt
      const [codeResult, nameResult, groupResult] = await Promise.all([
        this.aiService.validateTopicCode(topicCode, semesterId, majorId),
        this.aiService.validateTopicName(nameVi, nameEn, nameProject),
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

      return res.status(200).json({
        success: true,
        message: "Tất cả thông tin hợp lệ"
      });
    } catch (error) {
      console.error('Lỗi khi kiểm tra thông tin đề tài:', error);
      return res.status(500).json({
        success: false,
        message: MESSAGES.TOPIC.AI_VALIDATION_FAILED + "Lỗi hệ thống"
      });
    }
  }

  // Kiểm tra quyết định phân công đề tài
  async verifyAssignmentDecision(req: Request, res: Response) {
    try {
      const { semesterId } = req.body;

      // Lấy tất cả topic assignments trong kỳ
      const assignments = await prisma.topicAssignment.findMany({
        where: {
          topic: {
            semesterId: semesterId
          }
        },
        include: {
          topic: true,
          group: true
        }
      });

      if (assignments.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Không tìm thấy phân công đề tài nào trong học kỳ này"
        });
      }

      // Kiểm tra từng phân công
      const results = await Promise.all(
        assignments.map(async (assignment) => {
          const result = await this.aiService.verifyAssignmentDecision({
            groupCode: assignment.group.groupCode,
            topicCode: assignment.topic.topicCode,
            semesterId: semesterId
          });

          return {
            groupCode: assignment.group.groupCode,
            topicCode: assignment.topic.topicCode,
            ...result
          };
        })
      );

      // Tính tổng kết
      const totalAssignments = results.length;
      const validAssignments = results.filter(r => r.isValid).length;
      const invalidAssignments = totalAssignments - validAssignments;

      return res.status(200).json({
        success: true,
        message: `Đã kiểm tra ${totalAssignments} quyết định phân công. ${validAssignments} hợp lệ, ${invalidAssignments} không hợp lệ.`,
        results
      });
    } catch (error) {
      console.error('Lỗi khi kiểm tra quyết định phân công:', error);
      return res.status(500).json({
        success: false,
        message: MESSAGES.TOPIC.AI_VALIDATION_FAILED + "Lỗi hệ thống"
      });
    }
  }

  // Chuyển đổi loại AI
  async switchAIProvider(req: Request, res: Response) {
    try {
      const { provider, apiKey } = req.body;

      if (!provider) {
        return res.status(400).json({
          success: false,
          message: "Loại AI là bắt buộc"
        });
      }

      const result = await this.aiService.switchAIProvider(provider, apiKey);
      
      return res.status(result.success ? 200 : 400).json({
        success: result.success,
        message: result.message
      });
    } catch (error) {
      console.error('Lỗi khi chuyển đổi AI provider:', error);
      return res.status(500).json({
        success: false,
        message: "Lỗi hệ thống khi chuyển đổi AI provider"
      });
    }
  }

  // Lấy thông tin cấu hình AI
  async getAIConfig(req: Request, res: Response) {
    try {
      const result = await this.aiService.getAIConfig();
      
      return res.status(result.success ? 200 : 400).json({
        success: result.success,
        data: result.data,
        message: result.message
      });
    } catch (error) {
      console.error('Lỗi khi lấy cấu hình AI:', error);
      return res.status(500).json({
        success: false,
        message: "Lỗi hệ thống khi lấy cấu hình AI"
      });
    }
  }
} 