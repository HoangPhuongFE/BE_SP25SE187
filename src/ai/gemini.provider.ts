import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIProvider, AIValidationResult } from '../ai/ai.interface';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class GeminiProvider implements AIProvider {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  train(trainingData: { topics: Array<{ nameVi: string; nameEn: string; nameProject: string; description: string; isValid: boolean; }> }): Promise<AIValidationResult> {
    throw new Error('Method not implemented.');
  }

  validateTopic(topicName: string, description: string): Promise<AIValidationResult> {
    throw new Error('Method not implemented.');
  }

  public async validateTopicName(nameVi: string, nameEn: string, _nameProject: string): Promise<AIValidationResult> {
    try {
      const oldTopics = await prisma.topic.findMany({
        where: { isDeleted: false },
        select: { topicCode: true, nameVi: true, nameEn: true },
      });

      const oldTitlesVi = oldTopics.map(t => t.nameVi).join('\n');
      const oldTitlesEn = oldTopics.map(t => t.nameEn).join('\n');

      const prompt = `
        So sánh các tiêu đề đề tài mới sau đây để phát hiện trùng lặp hoặc độ tương đồng ngữ nghĩa cao (> 0.9):
        - Tiếng Việt: "${nameVi}"
        - Tiếng Anh: "${nameEn}"

        Với các tiêu đề hiện có:
        Tiêu đề tiếng Việt:
        ${oldTitlesVi}

        Tiêu đề tiếng Anh:
        ${oldTitlesEn}
         Yêu cầu:
        1. Kiểm tra xem tiêu đề mới có trùng lặp hoặc quá giống với tiêu đề cũ không (dựa trên ngữ nghĩa).
        2. Đảm bảo tên tiếng Anh là bản dịch hợp lý của tên tiếng Việt.
        3. Tránh nội dung không phù hợp hoặc không rõ ràng.
        4. Tính toán mức độ tin cậy (confidence) từ 0 đến 1 dựa trên độ tương đồng ngữ nghĩa (1 là hoàn toàn khác biệt, 0 là trùng hoàn toàn). Nếu không trùng, confidence phải lớn hơn 0.9.

        Trả về JSON với:
        - isValid (boolean): true nếu không trùng (độ tương đồng < 0.9), false nếu trùng
        - message (string): giải thích kết quả
        - confidence (number): mức độ tin cậy từ 0 đến 1 (dựa trên độ tương đồng ngữ nghĩa, phải có giá trị)
        - similarTopics (array): danh sách các đề tài tương tự với {topicCode, title, language, similarity}

        Chỉ trả về JSON, không thêm giải thích hoặc lưu ý bổ sung.

        
      `;

      console.log('Gửi yêu cầu đến Google Gemini với prompt:', prompt);
      const result = await this.model.generateContent(prompt);
      let responseText = result.response.text();
      console.log('Phản hồi từ Google Gemini (raw):', responseText);

      // Loại bỏ định dạng Markdown (```json và ```) và phần giải thích phía sau
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch && jsonMatch[1]) {
        responseText = jsonMatch[1].trim();
      } else {
        // Nếu không tìm thấy định dạng Markdown, thử lấy phần JSON từ đầu đến dấu } cuối cùng
        const lastBraceIndex = responseText.lastIndexOf('}');
        if (lastBraceIndex !== -1) {
          responseText = responseText.substring(0, lastBraceIndex + 1).trim();
        } else {
          throw new Error('Không tìm thấy JSON hợp lệ trong phản hồi từ Google Gemini');
        }
      }

      // Kiểm tra xem responseText có phải là JSON hợp lệ không
      let parsedResult;
      try {
        parsedResult = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Lỗi khi parse JSON từ Google Gemini:', parseError);
        throw new Error('Phản hồi từ Google Gemini không phải là JSON hợp lệ');
      }

      console.log('Phản hồi từ Google Gemini (parsed):', parsedResult);

      return {
        isValid: parsedResult.isValid ?? false,
        confidence: parsedResult.confidence !== undefined ? parsedResult.confidence : 0.9,
        message: parsedResult.message ?? 'Không có thông điệp từ Google Gemini',
        similarTopics: parsedResult.similarTopics || [], // Thêm trường similarTopics để sử dụng trong thông điệp lỗi
      };
    } catch (error) {
      console.error('Lỗi khi gọi API Google Gemini:', error);
      return {
        isValid: false,
        message: `Lỗi hệ thống: Không thể kiểm tra tính hợp lệ của tiêu đề đề tài: ${(error as Error).message}`,
        confidence: 0,
      };
    }
  }
}