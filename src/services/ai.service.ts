import { PrismaClient } from '@prisma/client';
import { MESSAGES } from '../constants/message';
import { CoreAIService } from '../ai/ai.core';

const prisma = new PrismaClient();

export class AIService {
  private aiService: CoreAIService;

  constructor() {
    this.aiService = new CoreAIService();
    this.initializeAI();
  }

  private async initializeAI() {
    try {
      const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
      console.log('AIService - API Key:', apiKey ? 'Đã tìm thấy API Key' : 'Không tìm thấy API Key');
      if (!apiKey) {
        console.warn('Google Gemini API key không tồn tại trong .env. AI sẽ bị tắt.');
        return;
      }
      this.aiService.updateConfig({
        enabled: true,
        provider: 'gemini',
        apiKey,
      });
      console.log('Khởi tạo AI thành công với Google Gemini');
    } catch (error) {
      console.error('Lỗi khi khởi tạo AI:', error);
    }
  }

  private async logSystemEvent(
    action: string,
    entityType: string,
    entityId: string,
    description: string,
    severity: 'INFO' | 'WARNING' | 'ERROR',
    metadata?: any
  ) {
    try {
      let systemUser = await prisma.user.findFirst({ where: { username: 'system' } });
      if (!systemUser) {
        systemUser = await prisma.user.create({
          data: {
            username: 'system',
            email: 'system@localhost',
            passwordHash: 'system',
            isActive: true,
          },
        });
      }

      // Cắt ngắn description nếu vượt quá 191 ký tự
      const maxDescriptionLength = 191;
      const truncatedDescription =
        description.length > maxDescriptionLength
          ? description.substring(0, maxDescriptionLength - 3) + '...'
          : description;

      await prisma.systemLog.create({
        data: {
          userId: systemUser.id,
          action,
          entityType,
          entityId,
          description: truncatedDescription,
          severity,
          metadata: metadata || null,
          ipAddress: '::1',
        },
      });
    } catch (error) {
      console.error('Lỗi khi ghi log hệ thống:', error);
    }
  }

  public async validateTopicName(
    nameVi: string,
    nameEn: string,
    topicId?: string
  ): Promise<{ isValid: boolean; message: string; similarity?: number; suggestions?: string; similarTopics?: any[] }> {
    try {
      const result = await this._validateTopicName(nameVi, nameEn);

      await this.logSystemEvent(
        'VALIDATE_TOPIC_NAME',
        'topic',
        topicId || 'N/A',
        result.message,
        result.isValid ? 'INFO' : 'WARNING',
        { nameVi, nameEn, similarity: result.similarity, suggestions: result.suggestions, similarTopics: result.similarTopics }
      );

      if (topicId) {
        await prisma.aIVerificationLog.create({
          data: {
            topicId,
            verification: result.isValid ? 'Passed' : 'Failed',
            originalText: `${nameVi} | ${nameEn}`,
            verifiedText: `${nameVi} | ${nameEn}`,
            similarityScore: result.similarity || 0,
            suggestions: result.suggestions || null,
            verifiedBy: 'AI_System',
            verifiedAt: new Date(),
          },
        });
      }

      return {
        isValid: result.isValid,
        message: result.message,
        similarity: result.similarity,
        suggestions: result.suggestions,
        similarTopics: result.similarTopics,
      };
    } catch (error) {
      console.error('Lỗi khi kiểm tra tên đề tài:', error);
      await this.logSystemEvent(
        'VALIDATE_TOPIC_NAME_ERROR',
        'topic',
        topicId || 'N/A',
        'Lỗi khi kiểm tra tên đề tài',
        'ERROR',
        { error: (error as Error).message }
      );
      return {
        isValid: false,
        message: `${MESSAGES.TOPIC.AI_VALIDATION_FAILED} ${(error as Error).message}`,
        similarity: 0,
      };
    }
  }

  private async _validateTopicName(
    nameVi: string,
    nameEn: string
  ): Promise<{ isValid: boolean; message: string; similarity?: number; suggestions?: string; similarTopics?: any[] }> {
    if (nameVi.length < 10 || nameVi.length > 200 || nameEn.length < 10 || nameEn.length > 200) {
      return {
        isValid: false,
        message: 'Tên đề tài phải dài từ 10 đến 200 ký tự',
      };
    }

    const existingTopic = await prisma.topic.findFirst({
      where: {
        OR: [{ nameVi }, { nameEn }],
      },
    });
    if (existingTopic) {
      const duplicateFields = [];
      if (existingTopic.nameVi === nameVi) duplicateFields.push('tên tiếng Việt');
      if (existingTopic.nameEn === nameEn) duplicateFields.push('tên tiếng Anh');
      return {
        isValid: false,
        message: `Đề tài đã tồn tại với ${duplicateFields.join(', ')}`,
      };
    }

    const aiResult = await this.aiService.validateTopicName(nameVi, nameEn, '');
    console.log('Kết quả từ CoreAIService:', aiResult);

    const confidence = aiResult.confidence !== undefined ? aiResult.confidence : 0.9;
    let message = aiResult.message;

    // Nếu tiêu đề không hợp lệ, cải thiện thông điệp lỗi
    if (!aiResult.isValid && aiResult.similarTopics && aiResult.similarTopics.length > 0) {
      const mostSimilarTopic = aiResult.similarTopics[0];
      const similarityPercentage = (mostSimilarTopic.similarity * 100).toFixed(2);
      message = `Tên đề tài không hợp lệ: Tiêu đề "${mostSimilarTopic.language === 'vi' ? nameVi : nameEn}" trùng lặp với "${mostSimilarTopic.title}" (mức độ tương đồng: ${similarityPercentage}%)`;
    } else if (aiResult.isValid) {
      const confidencePercentage = (confidence * 100).toFixed(2);
      message = `Tên đề tài hợp lệ (mức độ phù hợp: ${confidencePercentage}%)`;
    }

    return {
      isValid: aiResult.isValid,
      message,
      similarity: confidence,
      suggestions: aiResult.message?.includes('similarity') ? 'Xem xét đổi tên để tránh trùng lặp' : undefined,
      similarTopics: aiResult.similarTopics,
    };
  }
}