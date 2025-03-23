import { AIConfig, AIProvider, AIValidationResult } from './ai.interface';
import { GeminiProvider } from './gemini.provider';
import dotenv from 'dotenv';

dotenv.config();

export class AIService {
  private provider: AIProvider | null = null;
  private config: AIConfig = {
    enabled: !process.env.SKIP_AI_VALIDATION || process.env.SKIP_AI_VALIDATION.toLowerCase() !== 'true',
    provider: 'none'
  };

  constructor() {
    // Load config từ env hoặc config file
    this.initializeProvider();
  }

  private initializeProvider() {
    if (!this.config.enabled) {
      return;
    }

    switch (this.config.provider) {
      case 'gemini':
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey) {
          this.provider = new GeminiProvider(apiKey);
        }
        break;
      // Có thể thêm các provider khác ở đây
    }
  }

  async validateTopicName(topicName: string, description: string): Promise<AIValidationResult> {
    // Kiểm tra cơ bản trước
    if (topicName.length < 10 || topicName.length > 200) {
      return {
        isValid: false,
        message: "Tên đề tài phải có độ dài từ 10-200 ký tự"
      };
    }

    // Nếu AI không được bật, chỉ trả về kết quả kiểm tra cơ bản
    if (!this.config.enabled || !this.provider) {
      return {
        isValid: true,
        message: "Kiểm tra cơ bản thành công (AI không được kích hoạt)"
      };
    }

    // Sử dụng AI provider đã chọn
    return this.provider.validateTopicName(topicName, description);
  }

  async validateTopic(topicName: string, description: string): Promise<AIValidationResult> {
    // Tương tự như validateTopicName
    if (!this.config.enabled || !this.provider) {
      return {
        isValid: true,
        message: "Kiểm tra cơ bản thành công (AI không được kích hoạt)"
      };
    }

    return this.provider.validateTopic(topicName, description);
  }

  // Phương thức để cập nhật cấu hình
  updateConfig(newConfig: Partial<AIConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.initializeProvider();
  }
} 