import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIProvider, AIValidationResult } from './ai.interface';

export class GeminiProvider implements AIProvider {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
  }

  async validateTopicName(topicName: string, description: string): Promise<AIValidationResult> {
    try {
      const prompt = `Hãy đánh giá tính hợp lệ của tên đề tài sau:
      Tên đề tài: "${topicName}"
      Mô tả: "${description}"
      
      Yêu cầu:
      1. Kiểm tra tính rõ ràng và cụ thể của tên đề tài
      2. Đánh giá độ phù hợp với mô tả
      3. Kiểm tra tính khả thi
      
      Trả về JSON với format:
      {
        "isValid": boolean,
        "confidence": number (0-1),
        "message": string (lý do chi tiết)
      }`;

      const result = await this.model.generateContent(prompt);
      const response = JSON.parse(result.response.text());
      
      return {
        isValid: response.isValid,
        confidence: response.confidence,
        message: response.message
      };
    } catch (error) {
      console.error('Lỗi khi sử dụng Gemini:', error);
      return {
        isValid: false,
        confidence: 0,
        message: 'Lỗi khi kiểm tra với Gemini AI'
      };
    }
  }

  async validateTopic(topicName: string, description: string): Promise<AIValidationResult> {
    return this.validateTopicName(topicName, description);
  }
} 