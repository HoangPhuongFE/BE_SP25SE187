import { AIConfig, AIProvider, AIValidationResult } from '../ai/ai.interface';
import { GeminiProvider } from './gemini.provider';

export class CoreAIService {
  private provider: AIProvider | null = null;
  private config: AIConfig = {
    enabled: false,
    provider: 'none',
  };

  constructor() {
    this.initializeProvider();
  }

  private initializeProvider() {
    if (!this.config.enabled || this.config.provider === 'none') return;

    if (this.config.provider === 'gemini' && this.config.apiKey) {
      this.provider = new GeminiProvider(this.config.apiKey);
    }
  }

  public getConfig(): AIConfig {
    return { ...this.config };
  }

  public getProvider(): AIProvider | null {
    return this.provider;
  }

  public async validateTopicName(
    nameVi: string,
    nameEn: string,
    oldTopics: Array<{ topicCode: string; nameVi: string; nameEn: string }>
  ): Promise<AIValidationResult> {
    console.log('CoreAIService config:', this.config);
    console.log('CoreAIService provider:', this.provider ? 'Có provider' : 'Không có provider');

    if (!this.config.enabled || !this.provider) {
      console.log('AI bị tắt, trả về kết quả mặc định');
      return {
        isValid: true,
        message: 'Kiểm tra cơ bản qua (AI bị tắt)',
        confidence: 1.0,
      };
    }

    return this.provider.validateTopicName(nameVi, nameEn, oldTopics);
  }

  public updateConfig(newConfig: Partial<AIConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.initializeProvider();
  }
}
