import { AIProvider, AIProviderRequest, AIProviderResponse } from "./AIProvider.js";
import { validateAndNormalizeGroundingBoxes } from "../utils/grounding.js";

export class LocalOllamaProvider implements AIProvider {
  private baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  private modelName = process.env.OLLAMA_MODEL || "qwen3-vl:4b-instruct";

  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${this.baseUrl}/api/tags`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) return false;
      const data = await res.json();
      return data.models.some((m: any) => m.name === this.modelName || m.name.startsWith("qwen3-vl:4b"));
    } catch (e) {
      return false;
    }
  }

  async generateContent(req: AIProviderRequest): Promise<AIProviderResponse> {
    const formattedMessages = req.messages.map((m: any, index: number) => {
      const msg: any = {
        role: m.role === "user" ? "user" : "assistant",
        content: typeof m.text === 'string' ? m.text : JSON.stringify(m.text)
      };
      
      // Ollama expects base64 images without the data:image/...;base64, prefix if standard format,
      // but standard is just base64 string.
      if (m.role === "user" && index === req.messages.length - 1 && req.images && req.images.length > 0) {
        msg.images = req.images.map(img => img.data);
      }
      return msg;
    });

    // Add system instruction as the first message
    formattedMessages.unshift({
      role: "system",
      content: req.systemInstruction
    });

    let traceHeader = [
      { step: "PROVIDER_SELECTED", status: "SUCCESS", details: "Local Ollama" },
      { step: "OLLAMA_HEALTH_CHECK", status: "SUCCESS", details: "Ollama instance reached" },
      { step: "LOCAL_MODEL_SELECTED", status: "SUCCESS", details: this.modelName },
      { step: req.images?.length > 0 ? "LOCAL_IMAGE_ANALYSIS" : "LOCAL_TEXT_ANALYSIS", status: "SUCCESS", details: `Model = ${this.modelName}` },
      { step: "LOCAL_VISION_REQUEST_SENT", status: "SUCCESS" }
    ];

    const ollamaReq = {
      model: this.modelName,
      messages: formattedMessages,
      format: "json", // Request JSON format
      options: {
        temperature: 0.1
      },
      stream: false
    };

    let fetchOptions: RequestInit = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ollamaReq)
    };

    if (req.signal) {
      fetchOptions.signal = req.signal;
    }

    const res = await fetch(`${this.baseUrl}/api/chat`, fetchOptions);

    if (!res.ok) {
      throw new Error(`Ollama error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    
    if (!data.message || !data.message.content) {
      throw new Error("Invalid response from Ollama");
    }

    let parsedData;
    try {
      parsedData = JSON.parse(data.message.content);
      if (parsedData.groundingBoxes) {
        parsedData.groundingBoxes = validateAndNormalizeGroundingBoxes(parsedData.groundingBoxes);
      }
    } catch (e) {
      // Fallback if model fails to generate pure JSON despite 'format: "json"'
      parsedData = {
        answer: data.message.content,
        evidence: { observations: ["See answer text."], interpretations: ["See answer text."] },
        confidence: { level: "NOT CALIBRATED", limitations: ["Model did not return structured JSON."], isModelEstimated: false },
        recommendedModality: "UNKNOWN"
      };
    }

    return {
      provider: "Local Ollama",
      model: this.modelName,
      ...parsedData,
      executionTrace: [...traceHeader, { step: "LOCAL_MODEL_RESPONSE_RECEIVED", status: "SUCCESS" }, ...(parsedData.executionTrace || [])]
    };
  }
}
