export interface AIValidationResult {
  isValid: boolean;
  confidence?: number;
  message: string;
}

export interface AIProvider {
  validateTopicName(topicName: string, description: string): Promise<AIValidationResult>;
  validateTopic(topicName: string, description: string): Promise<AIValidationResult>;
}

export interface AIConfig {
  enabled: boolean;
  provider: 'tensorflow' | 'gemini' | 'none';
  apiKey?: string; // Cho Gemini
} 