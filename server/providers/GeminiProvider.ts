import { GoogleGenAI, Type } from "@google/genai";
import { AIProvider, AIProviderRequest, AIProviderResponse } from "./AIProvider.js";
import { validateAndNormalizeGroundingBoxes } from "../utils/grounding.js";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export class GeminiProvider implements AIProvider {
  async isAvailable(): Promise<boolean> {
    return !!process.env.GEMINI_API_KEY;
  }

  async generateContent(req: AIProviderRequest): Promise<AIProviderResponse> {
    const formattedMessages = req.messages.map((m: any, index: number) => {
      const parts: any[] = [{ text: typeof m.text === 'string' ? m.text : JSON.stringify(m.text) }];
      
      // Attach images only to the current/latest user query
      if (m.role === "user" && index === req.messages.length - 1 && req.images && req.images.length > 0) {
        req.images.forEach((img: any) => {
          parts.push({
            inlineData: {
              data: img.data,
              mimeType: img.mimeType
            }
          });
        });
      }
      
      return {
        role: m.role === "user" ? "user" : "model",
        parts
      };
    });

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        answer: { type: Type.STRING },
        evidence: {
          type: Type.OBJECT,
          properties: {
            observations: { type: Type.ARRAY, items: { type: Type.STRING } },
            interpretations: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["observations", "interpretations"]
        },
        confidence: {
          type: Type.OBJECT,
          properties: {
            level: { type: Type.STRING },
            limitations: { type: Type.ARRAY, items: { type: Type.STRING } },
            isModelEstimated: { type: Type.BOOLEAN }
          },
          required: ["level", "limitations", "isModelEstimated"]
        },
        recommendedModality: { type: Type.STRING },
        groundingBoxes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              ymin: { type: Type.NUMBER },
              xmin: { type: Type.NUMBER },
              ymax: { type: Type.NUMBER },
              xmax: { type: Type.NUMBER },
              label: { type: Type.STRING }
            },
            required: ["ymin", "xmin", "ymax", "xmax", "label"]
          }
        }
      },
      required: ["answer", "evidence", "confidence", "recommendedModality"]
    };

    let traceHeader = [
      { step: "PROVIDER_SELECTED", status: "SUCCESS", details: "Gemini" },
      { step: "VISION_REQUEST_SENT", status: "SUCCESS", details: "Data transmitted to Gemini API" }
    ];

    let actualModel = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
    
    // Sanitize the model name in case the user accidentally pasted an API key into the GEMINI_MODEL environment variable
    if (actualModel.startsWith('AIza') || actualModel.startsWith('AQ.') || actualModel.length > 40) {
      actualModel = "gemini-3.1-flash-lite";
    }

    actualModel = req.config?.model || actualModel;
    const requestConfig: any = {
      model: req.config?.model || actualModel,
      contents: formattedMessages,
      config: {
        systemInstruction: req.systemInstruction,
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: responseSchema
      }
    };

    if (req.signal) {
      // Pass signal to the SDK or handle it manually if SDK doesn't support it directly
      // Note: @google/genai might not natively support AbortSignal in exactly this way yet in all versions.
      // We'll wrap the call in a Promise race if needed, or pass it directly.
    }

    const executeRequest = async () => {
      if (req.signal) {
        return await Promise.race([
          ai.models.generateContent(requestConfig),
          new Promise((_, reject) => {
            req.signal?.addEventListener('abort', () => reject(new Error('Request aborted due to timeout or cancellation')));
            if (req.signal?.aborted) reject(new Error('Request already aborted'));
          })
        ]) as any;
      } else {
        return await ai.models.generateContent(requestConfig);
      }
    };

    let response;
    try {
      response = await executeRequest();
    } catch (error: any) {
      if (error.status === 429 || error.message?.includes('429') || error.message?.includes('Quota') || error.message?.includes('RESOURCE_EXHAUSTED')) {
        traceHeader.push({ step: "API_QUOTA_EXCEEDED", status: "WARNING", details: "Retrying after delay..." });
        // Wait 2 seconds and retry once
        await new Promise(resolve => setTimeout(resolve, 2000));
        try {
          response = await executeRequest();
        } catch (retryError: any) {
          throw new Error(`Gemini Provider Error (Quota Exceeded after retry): ${retryError.message}`);
        }
      } else {
        throw new Error(`Gemini Provider Error: ${error.message}`);
      }
    }

    if (!response.text) {
        throw new Error("No response text from Gemini");
    }
    
    const data = JSON.parse(response.text);
    
    if (data.groundingBoxes) {
      data.groundingBoxes = validateAndNormalizeGroundingBoxes(data.groundingBoxes);
    }
    
    let tokenUsage;
    let cost;
    const usageMetadata = response.usageMetadata;
    
    if (usageMetadata) {
        const inputTokens = usageMetadata.promptTokenCount || 0;
        const outputTokens = usageMetadata.candidatesTokenCount || 0;
        const totalTokens = usageMetadata.totalTokenCount || (inputTokens + outputTokens);
        const cachedTokens = usageMetadata.cachedContentTokenCount || 0;
        
        tokenUsage = {
            inputTokens,
            outputTokens,
            totalTokens,
            cachedTokens
        };
        
        const isPro = actualModel.includes('pro');
        
        // Accurate flash-lite pricing
        const actualCost = isPro ? 
            (inputTokens / 1000000) * 1.25 + (outputTokens / 1000000) * 5.00 :
            (inputTokens / 1000000) * 0.075 + (outputTokens / 1000000) * 0.30;
            
        // Baseline assumes no cross-modal routing and forcing a Pro model for all multimodal ops
        const baselineCost = (inputTokens / 1000000) * 1.25 + (outputTokens / 1000000) * 5.00;
        
        cost = {
            actualCost,
            baselineCost,
            savings: baselineCost - actualCost,
            savingsPercentage: baselineCost > 0 ? ((baselineCost - actualCost) / baselineCost) * 100 : 0
        };
    }

    return {
      provider: "Gemini",
      model: actualModel,
      ...data,
      tokenUsage,
      cost,
      executionTrace: [...traceHeader, { step: "GEMINI_RESPONSE_RECEIVED", status: "SUCCESS" }, ...(data.executionTrace || [])]
    };
  }
}
