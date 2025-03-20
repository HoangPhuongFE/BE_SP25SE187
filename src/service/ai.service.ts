import { PrismaClient } from '@prisma/client';
import { MESSAGES } from '../constants/message';
import { AIService as CoreAIService } from '../ai/ai.service';

const prisma = new PrismaClient();
const aiService = new CoreAIService();

export class AIService {
  // Khởi tạo và train model
  async initializeAndTrainModel() {
    try {
      await topicModel.initializeModel();
      await topicModel.trainModel();
      const modelJSON = await topicModel.saveModel();
      // Lưu modelJSON vào memory hoặc database nếu cần
      return { success: true, message: "Model đã được train thành công" };
    } catch (error) {
      console.error('Lỗi khi train model:', error);
      return { success: false, message: "Lỗi khi train model" };
    }
  }

  // Kiểm tra tính hợp lệ của mã đề tài
  async validateTopicCode(topicCode: string): Promise<{ isValid: boolean; message: string }> {
    try {
      // Kiểm tra định dạng mã đề tài (ví dụ: 3 chữ cái + 4 số)
      const codePattern = /^[A-Z]{3}\d{4}$/;
      if (!codePattern.test(topicCode)) {
        return {
          isValid: false,
          message: MESSAGES.TOPIC.INVALID_TOPIC_CODE + "Mã đề tài phải có định dạng 3 chữ cái + 4 số (ví dụ: ABC1234)"
        };
      }

      // Kiểm tra trùng lặp mã đề tài
      const existingTopic = await prisma.topic.findUnique({
        where: { topicCode }
      });

      if (existingTopic) {
        return {
          isValid: false,
          message: MESSAGES.TOPIC.DUPLICATE_TOPIC_CODE
        };
      }

      return { isValid: true, message: "Mã đề tài hợp lệ" };
    } catch (error) {
      console.error('Lỗi khi kiểm tra mã đề tài:', error);
      return {
        isValid: false,
        message: MESSAGES.TOPIC.AI_VALIDATION_FAILED + "Lỗi khi kiểm tra mã đề tài"
      };
    }
  }

  // Kiểm tra tính hợp lệ của tên đề tài
  async validateTopicName(topicName: string): Promise<{ isValid: boolean; message: string }> {
    try {
      const aiResult = await aiService.validateTopicName(topicName, "");
      
      if (!aiResult.isValid) {
        return {
          isValid: false,
          message: MESSAGES.TOPIC.INVALID_TOPIC_NAME + aiResult.message
        };
      }

      return { isValid: true, message: "Tên đề tài hợp lệ" };
    } catch (error) {
      console.error('Lỗi khi kiểm tra tên đề tài:', error);
      return {
        isValid: false,
        message: MESSAGES.TOPIC.AI_VALIDATION_FAILED + "Lỗi khi kiểm tra tên đề tài"
      };
    }
  }

  // Kiểm tra tính hợp lệ của mã nhóm
  async validateGroupCode(groupCode: string, semesterId: string): Promise<{ isValid: boolean; message: string }> {
    try {
      // Kiểm tra định dạng mã nhóm (ví dụ: 2 chữ cái + 3 số)
      const codePattern = /^[A-Z]{2}\d{3}$/;
      if (!codePattern.test(groupCode)) {
        return {
          isValid: false,
          message: "Mã nhóm phải có định dạng 2 chữ cái + 3 số (ví dụ: AB123)"
        };
      }

      // Kiểm tra trùng lặp mã nhóm trong cùng học kỳ
      const existingGroup = await prisma.group.findFirst({
        where: {
          groupCode,
          semesterId
        }
      });

      if (existingGroup) {
        return {
          isValid: false,
          message: "Mã nhóm đã tồn tại trong học kỳ này"
        };
      }

      return { isValid: true, message: "Mã nhóm hợp lệ" };
    } catch (error) {
      console.error('Lỗi khi kiểm tra mã nhóm:', error);
      return {
        isValid: false,
        message: MESSAGES.TOPIC.AI_VALIDATION_FAILED + "Lỗi khi kiểm tra mã nhóm"
      };
    }
  }

  // Kiểm tra toàn bộ thông tin đề tài
  async validateTopic(topicCode: string, topicName: string, description: string, groupCode: string, semesterId: string): Promise<{ isValid: boolean; message: string }> {
    try {
      const [codeResult, nameResult, groupResult] = await Promise.all([
        this.validateTopicCode(topicCode),
        this.validateTopicName(topicName),
        this.validateGroupCode(groupCode, semesterId)
      ]);

      if (!codeResult.isValid || !nameResult.isValid || !groupResult.isValid) {
        const messages = [];
        if (!codeResult.isValid) messages.push(codeResult.message);
        if (!nameResult.isValid) messages.push(nameResult.message);
        if (!groupResult.isValid) messages.push(groupResult.message);

        return {
          isValid: false,
          message: messages.join(", ")
        };
      }

      // Kiểm tra với AI
      const aiResult = await aiService.validateTopic(topicName, description);
      if (!aiResult.isValid) {
        return {
          isValid: false,
          message: aiResult.message
        };
      }

      return { isValid: true, message: "Tất cả thông tin hợp lệ" };
    } catch (error) {
      console.error('Lỗi khi kiểm tra thông tin đề tài:', error);
      return {
        isValid: false,
        message: MESSAGES.TOPIC.AI_VALIDATION_FAILED + "Lỗi hệ thống"
      };
    }
  }
} 