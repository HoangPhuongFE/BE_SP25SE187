import { AIConfig, AIProvider, AIValidationResult } from './ai.interface';
import { GeminiProvider } from './gemini.provider';

export class AIService {
  private provider: AIProvider | null = null;
  private config: AIConfig = {
    enabled: false,
    provider: 'none'
  };

  constructor() {
    // Khởi tạo với AI bị tắt mặc định
    this.initializeProvider();
  }

  private initializeProvider() {
    if (!this.config.enabled) {
      return;
    }

    switch (this.config.provider) {
      case 'gemini':
        if (this.config.apiKey) {
          this.provider = new GeminiProvider(this.config.apiKey);
        }
        break;
      // Có thể thêm các provider khác ở đây
    }
  }

  getConfig(): AIConfig {
    return { ...this.config };
  }

  getProvider(): AIProvider | null {
    return this.provider;
  }

  async validateTopicName(nameVi: string, nameEn: string, nameProject: string): Promise<AIValidationResult> {
    // Kiểm tra cơ bản trước
    if (nameVi.length < 10 || nameVi.length > 200 || 
        nameEn.length < 10 || nameEn.length > 200 || 
        nameProject.length < 10 || nameProject.length > 200) {
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
    return this.provider.validateTopicName(nameVi, nameEn, nameProject);
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