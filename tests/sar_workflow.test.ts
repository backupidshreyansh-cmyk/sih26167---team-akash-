import { describe, it, expect } from 'vitest';
import { extractMetadata } from '../server/imagery/metadata.js';
import { Orchestrator } from '../server/agent/orchestrator.js';
import { LocalOllamaProvider } from '../server/providers/LocalOllamaProvider.js';
import { globalSessionManager } from '../server/session/sessionManager.js';
import { globalRegistry } from '../server/tools/registry.js';
import '../server/tools/coreTools.js';
import '../server/tools/specialistTools.js';

// A minimal mocked AI provider to ensure we don't actually hit external APIs or need Ollama running in the test environment,
// but we CAN verify that the tool routing and metadata extraction worked perfectly.
class MockProvider extends LocalOllamaProvider {
    async isAvailable() { return true; }
    async generateContent(payload: any) {
        // Return a mock response matching what Gemini would output for a SAR analysis tool
        return {
            provider: 'Mock',
            model: 'mock-model',
            taskClassification: 'SAR_ANALYSIS' as any,
            answer: 'Mock Answer',
            evidence: { observations: ['Mock Observation'], interpretations: ['Mock Interpretation'] },
            confidence: { level: 'HIGH' as any, limitations: [], isModelEstimated: false },
            recommendedModality: 'SAR',
            executionTrace: [{ step: 'MOCK_INFERENCE', status: 'SUCCESS' }]
        };
    }
}

describe('End-to-End SAR Workflow', () => {
  it('should correctly process a simulated SAR image and route to SAR Specialist', async () => {
    
    // 1. Simulate a 1x1 base64 png image
    const fakePngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    
    const normalizedImage = await extractMetadata(fakePngBase64, 'image/png', 0);
    expect(normalizedImage.width).toBe(1);
    expect(normalizedImage.height).toBe(1);
    expect(normalizedImage.modality).toBe('UNKNOWN'); // Defaults to UNKNOWN
    
    // 2. Set up orchestrator with mock provider
    const mockProvider = new MockProvider();
    const systemInstruction = 'Test instruction';
    const sessionId = 'test-sar-session';
    globalSessionManager.addMessage(sessionId, 'user', 'What are the most prominent spatial patterns visible in this SAR observation?');
    const session = globalSessionManager.getSession(sessionId);
    
    const orchestrator = new Orchestrator(mockProvider, systemInstruction, session);

    // 3. Execute query (this should auto-detect SAR from query and route to SAR_ANALYSIS)
    const response = await orchestrator.execute(
        'What are the most prominent spatial patterns visible in this SAR observation?',
        [normalizedImage]
    );
    console.log(JSON.stringify(response, null, 2));
    
    // 4. Verify routing and output
    expect(response.taskClassification).toBe('SAR_ANALYSIS');
    expect(response.detectedModality).toBe('SAR');
    expect(response.polarization).toBe('UNKNOWN'); // We didn't supply GeoTIFF with VV/VH
    
    // Check if SAR_ANALYSIS_COMPLETED is in trace
    const hasSarTrace = response.executionTrace.some(t => t.step === 'SAR_ANALYSIS_COMPLETED');
    expect(hasSarTrace).toBe(true);
  });
});
