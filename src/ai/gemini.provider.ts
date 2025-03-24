import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIProvider, AIValidationResult } from './ai.interface';

export class GeminiProvider implements AIProvider {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(private apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
  }

  async validateTopicName(nameVi: string, nameEn: string, nameProject: string): Promise<AIValidationResult> {
    try {
      // Gửi cả 3 tên đề tài cho Gemini để kiểm tra
      const prompt = `
        Kiểm tra tính hợp lệ của tên đề tài:
        - Tên tiếng Việt: ${nameVi}
        - Tên tiếng Anh: ${nameEn}
        - Tên dự án: ${nameProject}

        Yêu cầu:
        1. Tên phải có ý nghĩa và rõ ràng
        2. Tên tiếng Anh phải là bản dịch chính xác hoặc gần nghĩa của tên tiếng Việt
        3. Không được chứa từ ngữ không phù hợp
      `;

      // TODO: Gọi Gemini API với prompt và API key
      // Tạm thời trả về kết quả giả định
      return {
        isValid: true,
        confidence: 0.95,
        message: "Tên đề tài hợp lệ"
      };
    } catch (error) {
      console.error('Lỗi khi gọi Gemini API:', error);
      return {
        isValid: false,
        message: "Lỗi khi kiểm tra tên đề tài với Gemini"
      };
    }
  }

  async validateTopic(topicName: string, description: string): Promise<AIValidationResult> {
    try {
      const prompt = `
        Kiểm tra tính hợp lệ của đề tài:
        Tên: ${topicName}
        Mô tả: ${description}

        Yêu cầu:
        1. Tên và mô tả phải liên quan đến nhau
        2. Mô tả phải đầy đủ và rõ ràng
        3. Nội dung phải phù hợp với cấp độ đại học
        4. Không được chứa thông tin nhạy cảm
      `;

      // TODO: Gọi Gemini API với prompt và API key
      // Tạm thời trả về kết quả giả định
      return {
        isValid: true,
        confidence: 0.9,
        message: "Đề tài hợp lệ"
      };
    } catch (error) {
      console.error('Lỗi khi gọi Gemini API:', error);
      return {
        isValid: false,
        message: "Lỗi khi kiểm tra đề tài với Gemini"
      };
    }
  }

  async train(trainingData: {
    topics: Array<{
      nameVi: string;
      nameEn: string;
      nameProject: string;
      description: string;
      isValid: boolean;
    }>;
  }): Promise<AIValidationResult> {
    try {
      // Tạo prompt cho việc training
      const prompt = `
        Training model với ${trainingData.topics.length} đề tài.
        Dữ liệu training:
        ${JSON.stringify(trainingData.topics, null, 2)}
      `;

      // TODO: Gọi Gemini API với prompt để train model
      // Tạm thời trả về kết quả giả định
      return {
        isValid: true,
        confidence: 0.85,
        message: "Model đã được train thành công"
      };
    } catch (error) {
      console.error('Lỗi khi train model với Gemini:', error);
      return {
        isValid: false,
        message: "Lỗi khi train model với Gemini"
      };
    }
  }
} 