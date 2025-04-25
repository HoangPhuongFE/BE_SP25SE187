import { PrismaClient } from '@prisma/client';
import { CoreAIService } from '../ai/ai.core';
import { SystemConfigService } from '../services/system.config.service';

const prisma = new PrismaClient();

export class AIService {
  private aiService: CoreAIService;
  private configService: SystemConfigService;

  constructor() {
    this.aiService = new CoreAIService();
    this.configService = new SystemConfigService();
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

  private async getRecentSemesterIds(currentSemesterId: string, count: number): Promise<string[]> {
    const base = await prisma.semester.findUnique({
      where: { id: currentSemesterId },
      select: { startDate: true },
    });
    if (!base) return [];

    const semesters = await prisma.semester.findMany({
      where: {
        isDeleted: false,
        startDate: { lte: base.startDate },
      },
      orderBy: { startDate: 'desc' },
      take: count,
      select: { id: true },
    });

    return semesters.map(s => s.id);
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
    topicId?: string,
    options?: { semesterId: string; skipDatabaseCheck?: boolean }
  ): Promise<{
    isValid: boolean;
    message: string;
    similarity?: number;
    suggestions?: string;
    similarTopics?: any[];
  }> {
    try {
      const result = await this._validateTopicName(nameVi, nameEn, options);

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

      return result;
    } catch (error) {
      return {
        isValid: false,
        message: `AI validation failed: ${(error as Error).message}`,
        similarity: 0,
      };
    }
  }

  private async _validateTopicName(
    nameVi: string,
    nameEn: string,
    options?: { semesterId?: string; skipDatabaseCheck?: boolean }
  ): Promise<{
    isValid: boolean;
    message: string;
    similarity?: number;
    suggestions?: string;
    similarTopics?: any[];
  }> {
    if (nameVi.length < 10 || nameVi.length > 200 || nameEn.length < 10 || nameEn.length > 200) {
      return {
        isValid: false,
        message: 'Tên đề tài phải dài từ 10 đến 200 ký tự',
      };
    }

    if (!options?.skipDatabaseCheck) {
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
    }

    const filterCount = await this.configService.getAITopicFilterCount();
    const semesterIds = await this.getRecentSemesterIds(options?.semesterId || '', filterCount);

    const oldTopics = await prisma.topic.findMany({
      where: {
        isDeleted: false,
        semesterId: { in: semesterIds },
      },
      select: { topicCode: true, nameVi: true, nameEn: true },
    });

    const aiResult = await this.aiService.validateTopicName(nameVi, nameEn, oldTopics);
    const confidence = aiResult.confidence ?? 0.9;

    let message = aiResult.message;
    if (!aiResult.isValid && (aiResult.similarTopics ?? []).length > 0) {
      const mostSimilar = (aiResult.similarTopics ?? [])[0];
      const sim = (mostSimilar.similarity * 100).toFixed(2);
      message = `Tên đề tài không hợp lệ: Tiêu đề "${mostSimilar.title}" trùng với "${nameVi}" (tương đồng ${sim}%)`;
    } else if (aiResult.isValid) {
      message = `Tên đề tài hợp lệ (mức độ phù hợp: ${(confidence * 100).toFixed(2)}%)`;
    }

    return {
      isValid: aiResult.isValid,
      message,
      similarity: confidence,
      suggestions: aiResult.message?.includes('similarity') ? 'Xem xét đổi tên để tránh trùng lặp' : undefined,
      similarTopics: aiResult.similarTopics,
    };
  }

  public async batchVerifyDecision(
    items: Array<{
      topicCode: string;
      groupCode: string;
      nameVi: string;
      nameEn: string;
      mentorUsername?: string;
    }>,
    verifiedBy: string
  ) {
    const results: any[] = [];

    for (const item of items) {
      try {
        const topic = await prisma.topic.findFirst({
          where: { topicCode: item.topicCode, isDeleted: false },
        });

        if (!topic) {
          results.push({
            topicCode: item.topicCode,
            isConsistent: false,
            confidence: 0,
            issues: ['Không tìm thấy đề tài trong hệ thống'],
          });
          continue;
        }

        const issues: string[] = [];

        if (topic.nameVi !== item.nameVi) issues.push('Tên tiếng Việt không khớp');
        if (topic.nameEn !== item.nameEn) issues.push('Tên tiếng Anh không khớp');

        const group = await prisma.group.findUnique({
          where: { id: topic.proposedGroupId ?? '' },
          select: { groupCode: true },
        });
        if (group?.groupCode !== item.groupCode) {
          issues.push(`Mã nhóm không khớp (FE: ${item.groupCode}, DB: ${group?.groupCode || 'Không có'})`);
        }

        const mentor = topic.mainSupervisor
          ? await prisma.user.findUnique({ where: { id: topic.mainSupervisor }, select: { username: true } })
          : null;
        if (item.mentorUsername && mentor?.username !== item.mentorUsername) {
          issues.push(`Mentor không khớp (FE: ${item.mentorUsername}, DB: ${mentor?.username || 'Không có'})`);
        }

        results.push({
          topicCode: item.topicCode,
          confidence: issues.length === 0 ? 1 : 0.5,
          isConsistent: issues.length === 0,
          issues,
          aiStatus: issues.length === 0 ? 'Passed' : 'Failed',
          aiMessage:
            issues.length === 0
              ? 'Dữ liệu trong biểu mẫu quyết định khớp với hệ thống.'
              : `Có lỗi: ${issues.join('; ')}`,
        });
      } catch (err) {
        results.push({
          topicCode: item.topicCode,
          isConsistent: false,
          confidence: 0,
          issues: [`Lỗi xử lý: ${(err as Error).message}`],
        });
      }
    }

    return results;
  }
}