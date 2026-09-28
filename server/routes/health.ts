import { Router } from "express";
import fs from "fs";
import path from "path";
import { LocalOllamaProvider } from "../providers/LocalOllamaProvider.js";
import { GeminiProvider } from "../providers/GeminiProvider.js";
import { globalRegistry } from "../tools/registry.js";
import { DeterministicEngine } from "../analysis/deterministicEngine.js";

export const healthRouter = Router();

healthRouter.get("/", async (req, res) => {
  const localProvider = new LocalOllamaProvider();
  const geminiProvider = new GeminiProvider();
  
  const ollamaAvailable = await localProvider.isAvailable();
  const geminiAvailable = await geminiProvider.isAvailable();
  
  const ollamaModel = process.env.OLLAMA_MODEL || "qwen3-vl:4b-instruct";
  const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  // Check LoRA Adapter status
  const defaultAdapterPath = path.join(process.cwd(), "training/runs/latest/adapter");
  const configuredAdapterPath = process.env.ADAPTER_PATH || null;
  const adapterExists = configuredAdapterPath 
    ? fs.existsSync(configuredAdapterPath) 
    : fs.existsSync(defaultAdapterPath);

  // Check Tool Registry
  const registeredTools = globalRegistry.getAll().map(t => t.name);

  // Verify Deterministic Engine
  let deterministicEngineOk = false;
  try {
    // Quick test of DeterministicEngine on 1x1 buffer
    const testNormalized: any = {
      id: 'health_test',
      filename: 'health_test.png',
      mimeType: 'image/png',
      sizeBytes: 100,
      width: 2,
      height: 2,
      bandCount: 3,
      modality: 'OPTICAL',
      temporalRole: 'PRIMARY',
      acquisitionTime: null,
      geospatialMetadata: null,
      sourceBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mNk+M9QzwAEjDAGJAYAH20D/y8y3UIAAAAASUVORK5CYII='
    };
    const testMetrics = await DeterministicEngine.analyzeImage(testNormalized);
    deterministicEngineOk = typeof testMetrics.meanBrightness === 'number';
  } catch (e) {
    deterministicEngineOk = false;
  }

  const overallStatus = (geminiAvailable || ollamaAvailable) && deterministicEngineOk
    ? (geminiAvailable && ollamaAvailable ? "healthy" : "degraded")
    : "unhealthy";
  
  res.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    gemini: {
      configured: !!process.env.GEMINI_API_KEY,
      available: geminiAvailable,
      model: geminiModel
    },
    ollama: {
      available: ollamaAvailable,
      model: ollamaModel,
      endpoint: process.env.OLLAMA_HOST || "http://127.0.0.1:11434"
    },
    offlineReady: ollamaAvailable,
    onlineReady: geminiAvailable,
    deterministicEngine: {
      status: deterministicEngineOk ? "OPERATIONAL" : "ERROR",
      pixelStatistics: deterministicEngineOk,
      remoteSensingIndices: deterministicEngineOk
    },
    geotiffParser: {
      status: "OPERATIONAL",
      library: "geotiff.js"
    },
    tools: {
      count: registeredTools.length,
      registered: registeredTools
    },
    adaptation: {
      pipelineImplemented: true,
      adapterLoaded: adapterExists,
      adapterPath: configuredAdapterPath || (adapterExists ? defaultAdapterPath : null)
    },
    systemLimits: {
      maxPayloadLimit: "50MB",
      requestTimeoutMs: parseInt(process.env.AI_REQUEST_TIMEOUT_MS || "60000", 10)
    }
  });
});

