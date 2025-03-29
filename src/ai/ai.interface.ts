export interface AIValidationResult {
  isValid: boolean;
  confidence?: number;
  message: string;
}

export interface AIProvider {
  train(trainingData: {
    topics: Array<{
      nameVi: string;
      nameEn: string;
      nameProject: string;
      description: string;
      isValid: boolean;
    }>;
  }): Promise<AIValidationResult>;
  validateTopicName(nameVi: string, nameEn: string, nameProject: string): Promise<AIValidationResult>;
  validateTopic(topicName: string, description: string): Promise<AIValidationResult>;
}

export interface AIConfig {
  enabled: boolean;
  provider: 'tensorflow' | 'gemini' | 'none';
  apiKey?: string; // Cho Gemini
} 