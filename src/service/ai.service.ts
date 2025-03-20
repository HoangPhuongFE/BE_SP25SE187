import { PrismaClient } from '@prisma/client';
import { MESSAGES } from '../constants/message';

const prisma = new PrismaClient();

export class AIService {
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
      // Kiểm tra độ dài tên đề tài
      if (topicName.length < 10 || topicName.length > 200) {
        return {
          isValid: false,
          message: MESSAGES.TOPIC.INVALID_TOPIC_NAME + "Tên đề tài phải có độ dài từ 10-200 ký tự"
        };
      }

      // Kiểm tra trùng lặp tên đề tài (sử dụng AI để so sánh độ tương đồng)
      const existingTopics = await prisma.topic.findMany({
        select: { name: true }
      });

      for (const topic of existingTopics) {
        const similarity = await this.calculateSimilarity(topicName, topic.name);
        if (similarity > 0.8) { // Ngưỡng tương đồng 80%
          return {
            isValid: false,
            message: MESSAGES.TOPIC.INVALID_TOPIC_NAME + "Tên đề tài có thể trùng lặp với đề tài đã tồn tại"
          };
        }
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

  // Tính toán độ tương đồng giữa hai chuỗi văn bản
  private async calculateSimilarity(text1: string, text2: string): Promise<number> {
    try {
      // Có thể sử dụng các phương pháp sau:
      // 1. Sử dụng API của bên thứ 3 (ví dụ: OpenAI API)
      // 2. Sử dụng thư viện xử lý ngôn ngữ tự nhiên
      // 3. Implement thuật toán so sánh văn bản đơn giản

      // Ví dụ implement đơn giản sử dụng Levenshtein Distance
      const distance = this.levenshteinDistance(text1, text2);
      const maxLength = Math.max(text1.length, text2.length);
      return 1 - (distance / maxLength);
    } catch (error) {
      console.error('Lỗi khi tính độ tương đồng:', error);
      return 0;
    }
  }

  // Thuật toán Levenshtein Distance
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j - 1] + 1,
            dp[i - 1][j] + 1,
            dp[i][j - 1] + 1
          );
        }
      }
    }

    return dp[m][n];
  }
} 