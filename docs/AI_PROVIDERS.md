# AI Providers Architecture

ORBITAL EYE implements a strict Provider Pattern for AI inference. This prevents vendor lock-in and allows seamless switching between edge-deployed local models and highly capable cloud models.

## The `AIProvider` Interface
Located in `server/providers/AIProvider.ts`, all engines must conform to this contract:
```typescript
interface AIProvider {
  isAvailable(): Promise<boolean>;
  generateContent(req: AIProviderRequest): Promise<AIProviderResponse>;
}
```

## `GeminiProvider`
- **Location**: `server/providers/GeminiProvider.ts`
- **SDK**: `@google/genai`
- **Model**: `process.env.GEMINI_MODEL` (defaults to `gemini-2.5-pro`)
- **Role**: Highly capable, cloud-backed reasoning. Enforces structured JSON schema constraints directly via API parameters (`responseSchema`).

## `LocalOllamaProvider`
- **Location**: `server/providers/LocalOllamaProvider.ts`
- **SDK**: Native `fetch` (REST API)
- **Model**: `qwen3-vl:4b-instruct`
- **Role**: Complete offline autonomy. 
- **Handling Constraints**: Unlike Gemini, local models occasionally struggle with strict JSON schemas. The `LocalOllamaProvider` attempts to force JSON via Ollama's `format: "json"` flag. If the model hallucinates or breaks JSON, the provider catches the `JSON.parse` error and falls back to a gracefully degraded text structure without crashing the orchestrator.

## Traceability
Both providers append their internal status checks to the `executionTrace` array. This allows analysts to mathematically prove which engine generated the interpretation and what routing fallback paths were triggered.
