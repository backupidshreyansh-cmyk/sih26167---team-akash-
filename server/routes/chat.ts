import { Router } from "express";
import { GeminiProvider } from "../providers/GeminiProvider.js";
import { LocalOllamaProvider } from "../providers/LocalOllamaProvider.js";
import { Orchestrator } from "../agent/orchestrator.js";
import { extractMetadata } from "../imagery/metadata.js";
import { AIProvider } from "../providers/AIProvider.js";
import { globalSessionManager } from "../session/sessionManager.js";
import '../tools/coreTools.js';
import '../tools/specialistTools.js'; // Ensure tools are registered
import '../tools/eoTools.js'; // Earth observation discovery tools

export const chatRouter = Router();

chatRouter.post("/", async (req, res) => {
  const controller = new AbortController();
  const timeoutMs = parseInt(process.env.AI_REQUEST_TIMEOUT_MS || "60000", 10);
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const { messages, trainingData, images, aiMode, mode, sessionId } = req.body;
    
    if (!sessionId) {
        throw new Error("Missing sessionId in request payload.");
    }
    
    const session = globalSessionManager.getSession(sessionId);

    // 1. Process Images using deterministic metadata extractor
    
    const normalizedImages = [];
    for (let i = 0; i < (images || []).length; i++) {
        const img = images[i];
        if (!img.data || typeof img.data !== 'string') {
             throw new Error("Invalid image data provided. Must be base64 string.");
        }
        if (img.data.length > 50 * 1024 * 1024) {
             throw new Error("Image size exceeds 50MB limit.");
        }
        try {
            const normalized = await extractMetadata(img.data, img.mimeType, i);
            if (img.slot === 'optical') {
                normalized.modality = 'OPTICAL';
            } else if (img.slot === 'sar') {
                normalized.modality = 'SAR';
            } else if (img.slot === 'before') {
                normalized.temporalRole = 'BEFORE';
            } else if (img.slot === 'after') {
                normalized.temporalRole = 'AFTER';
            }
            if (img.name) {
                normalized.filename = img.name;
            }
            normalizedImages.push(normalized);
        } catch (e: any) {
            throw new Error(`Failed to parse image ${i+1}: ${e.message}`);
        }
    }

    if (mode === 'optical-sar' && normalizedImages.length === 2) {
         normalizedImages[0].modality = 'OPTICAL';
         normalizedImages[1].modality = 'SAR';
    } else if (mode === 'bi-temporal' && normalizedImages.length === 2) {
         normalizedImages[0].temporalRole = 'BEFORE';
         normalizedImages[1].temporalRole = 'AFTER';
    }

    // 2. Extract Query
    const userMessages = messages.filter((m: any) => m.role === 'user');
    const query = userMessages.length > 0 ? userMessages[userMessages.length - 1].text : "Analyze these images.";

    globalSessionManager.addMessage(sessionId, 'user', query);

    const systemInstruction = `You are SatQuery AI, an agentic remote-sensing analysis assistant.
You understand concepts including optical imagery, multispectral imagery, SAR, land cover, vegetation, water, built-up areas, roads, agriculture, forests, temporal imagery, change, image evidence, and uncertainty.
You MUST follow the constraints defined below to act as an evidence-grounded remote-sensing analyst.
You must distinguish OBSERVATION from INTERPRETATION and must acknowledge uncertainty.

--- SYSTEM CONSTRAINTS ---
${trainingData || "No constraints provided."}
--- END CONSTRAINTS ---

INSTRUCTIONS FOR OUTPUT FORMAT:
You must provide a structured JSON response corresponding to the schema below.
Do not hallucinate coordinates, CRS, geographic locations, exact area, exact sensor, acquisition date, or spectral bands unless explicitly provided.
Base your response ONLY on the provided images or explicit conversation context.
If you cannot answer with certainty, state INSUFFICIENT EVIDENCE.

GROUNDING BOXES (OPTIONAL):
- For any detected objects or regions you mention, you may optionally provide bounding boxes.
- Coordinates MUST be normalized to a 0-1000 scale.
- ymin MUST be less than ymax, and xmin MUST be less than xmax.
- Coordinate values MUST be within the 0 to 1000 range.
- The "label" MUST describe the detected object/region.
- Return an empty array [] for "groundingBoxes" when no reliable grounding is possible.
- NEVER invent a box merely to satisfy the schema.

JSON STRUCTURE:
{
  "answer": "string",
  "evidence": { "observations": ["string"], "interpretations": ["string"] },
  "confidence": { "level": "VERIFIED | HIGH | MEDIUM | LOW | CONFLICTING EVIDENCE | INSUFFICIENT EVIDENCE | NEEDS_MORE_EVIDENCE | INCONCLUSIVE", "limitations": ["string"], "isModelEstimated": true },
  "recommendedModality": "string",
  "groundingBoxes": [
    { "ymin": 0, "xmin": 0, "ymax": 1000, "xmax": 1000, "label": "string" }
  ]
}`;

    const geminiProvider = new GeminiProvider();
    const localProvider = new LocalOllamaProvider();

    let activeProvider: AIProvider | null = null;
    let finalTrace: any[] = [];
    
    const requestedMode = aiMode || "auto";

    if (requestedMode === "offline") {
      finalTrace.push({ step: "NETWORK_MODE", status: "INFO", details: "OFFLINE" });
      finalTrace.push({ step: "AI_PROVIDER", status: "INFO", details: "OLLAMA" });
      if (!(await localProvider.isAvailable())) {
        throw new Error("OLLAMA_UNAVAILABLE: Local AI is not currently available. Start Ollama and ensure the model is installed.");
      }
      activeProvider = localProvider;
      finalTrace.push({ step: "OFFLINE_MODE", status: "SUCCESS" });
      
      const adapterPath = process.env.ADAPTER_PATH;
      if (adapterPath) {
          finalTrace.push({ step: "ADAPTATION_STATUS", status: "INFO", details: "LOADED (LoRA Adapter Active)" });
          finalTrace.push({ step: "ADAPTER_PATH", status: "INFO", details: adapterPath });
      } else {
          finalTrace.push({ step: "ADAPTATION_STATUS", status: "INFO", details: "BASE_MODEL_ONLY" });
      }
    } else if (requestedMode === "online") {
      if (!(await geminiProvider.isAvailable())) {
          throw new Error("GEMINI_NOT_CONFIGURED: Gemini API Key is missing.");
      }
      activeProvider = geminiProvider;
      finalTrace.push({ step: "ONLINE_MODE", status: "SUCCESS" });
    } else {
      // Auto mode
      finalTrace.push({ step: "AUTO_MODE", status: "SUCCESS" });
      finalTrace.push({ step: "GEMINI_ATTEMPT", status: "INFO" });
      if (await geminiProvider.isAvailable()) {
        activeProvider = geminiProvider;
      } else {
        finalTrace.push({ step: "GEMINI_UNAVAILABLE", status: "WARNING" });
        finalTrace.push({ step: "LOCAL_FALLBACK", status: "SUCCESS" });
        if (await localProvider.isAvailable()) {
          activeProvider = localProvider;
        } else {
          throw new Error("No AI providers available. Gemini API key is missing and local Ollama is not running.");
        }
      }
    }

    // 3. Orchestrate
    const orchestrator = new Orchestrator(activeProvider, systemInstruction, session, controller.signal, timeoutMs);
    const agentResponse = await orchestrator.execute(query, normalizedImages);

    // Merge routing trace with orchestrator trace
    agentResponse.executionTrace = [...finalTrace, ...agentResponse.executionTrace];

    globalSessionManager.addMessage(sessionId, 'model', agentResponse.answer);
    globalSessionManager.addEvidence(sessionId, agentResponse.evidence);
    globalSessionManager.addTrace(sessionId, agentResponse.executionTrace);
    
    // Add time details
    const hasError = agentResponse.executionTrace.some((t: any) => t.status === 'ERROR');
    agentResponse.executionTrace.push({ 
        step: hasError ? 'REQUEST_FAILED' : 'REQUEST_COMPLETED', 
        status: hasError ? 'ERROR' : 'SUCCESS' 
    });

    clearTimeout(timeoutId);
    res.json(agentResponse);
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error("API Error:", error);
    
    const isTimeout = error.message?.includes('aborted');
    const msg = isTimeout ? 'REQUEST_TIMEOUT: Analysis took too long and was aborted.' : error.message || "Failed to generate response";
    
    res.status(isTimeout ? 408 : 500).json({ error: msg });
  }
});
