import { Message, UploadedImage, AgentResponse } from '../types/index.js';

interface ChatRequestPayload {
  messages: Array<{
    role: 'user' | 'model';
    text?: string;
  }>;
  trainingData: string;
  images: Array<{
    data: string;
    mimeType: string;
  }>;
  mode: string;
  aiMode: string;
  sessionId: string;
}

export async function checkHealth(): Promise<{
  gemini: { configured: boolean; available: boolean; model: string };
  ollama: { available: boolean; model: string };
  offlineReady: boolean;
  onlineReady: boolean;
}> {
  try {
    const res = await fetch('/api/ollama/health');
    if (!res.ok) {
      throw new Error('Health check failed');
    }
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error('Invalid health check response format');
    }
  } catch (e) {
    throw e;
  }
}

export async function sendChatMessage(
  messages: Message[],
  newUserMessage: Message,
  images: UploadedImage[],
  trainingData: string,
  analysisMode: string,
  aiMode: string,
  sessionId: string
): Promise<AgentResponse> {
  const payload = {
    messages: [...messages, newUserMessage].map(m => ({ 
      role: m.role, 
      text: m.role === 'user' ? m.text : (m.agentResponse ? JSON.stringify(m.agentResponse) : m.text) 
    })),
    trainingData,
    images: images.map(img => ({ 
      data: img.base64Data, 
      mimeType: img.mimeType,
      slot: img.slot,
      name: img.file?.name || img.metadata?.fileName || `image_${img.id}`
    })),
    mode: analysisMode,
    aiMode,
    sessionId
  };

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    if (!response.ok) {
      if (response.status === 413) {
        throw new Error("Payload Too Large: The uploaded images are too big. Please use smaller images.");
      }
      throw new Error(`Server returned an error (${response.status}: ${response.statusText}) that is not valid JSON.`);
    }
    throw new Error("Server returned a success response but the format is not valid JSON.");
  }

  if (!response.ok) {
    throw new Error(data.error || 'Failed to generate response');
  }

  return data;
}
