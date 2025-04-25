// src/ai/ai.interface.ts
export interface AIValidationResult {
  isValid: boolean;
  message: string;
  confidence: number;
  similarTopics?: Array<{
    topicCode: string;
    title: string;
    language: string;
    similarity: number;
  }>;
}

export interface AIConfig {
  enabled: boolean;
  provider: string;
  apiKey?: string;
}

export interface AIProvider {
  validateTopicName(
    nameVi: string,
    nameEn: string,
    oldTopics: Array<{ topicCode: string; nameVi: string; nameEn: string; }>
  ): Promise<AIValidationResult>;
  
  validateTopic(topicName: string, description: string): Promise<AIValidationResult>;
  
  train(trainingData: { topics: Array<{ nameVi: string; nameEn: string; nameProject: string; description: string; isValid: boolean; }> }): Promise<AIValidationResult>;
}
