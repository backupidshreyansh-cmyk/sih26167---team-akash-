import { AgentResponse } from '../schemas/responses.js';

export interface AIProviderRequest {
  messages: any[];
  images: any[];
  systemInstruction: string;
  mode: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  config?: {
    model?: string;
  };
}

export interface AIProviderResponse extends Omit<AgentResponse, 'executionTrace'> {
  provider: string;
  model: string;
  executionTrace: Array<{step: string, status: string, details?: string}>;
}

export interface AIProvider {
  isAvailable(): Promise<boolean>;
  generateContent(req: AIProviderRequest): Promise<AIProviderResponse>;
}
