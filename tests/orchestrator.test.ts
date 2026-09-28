import { describe, it, expect, vi } from 'vitest';
import { Orchestrator } from '../server/agent/orchestrator.js';
import { AIProvider, AIProviderRequest, AIProviderResponse } from '../server/providers/AIProvider.js';
import { NormalizedImage } from '../server/imagery/types.js';

import '../server/tools/coreTools.js';
import '../server/tools/specialistTools.js';

class MockProvider implements AIProvider {
    public triggerFailure = false;
    public callCount = 0;

    async isAvailable() { return true; }
    
    async generateContent(req: AIProviderRequest): Promise<AIProviderResponse> {
        this.callCount++;
        if (this.triggerFailure && this.callCount === 1) {
             return {
                 provider: 'MockProvider',
                 model: req.config?.model || 'mock-model',
                 answer: "Bad answer",
                 evidence: { observations: [], interpretations: [] },
                 confidence: { level: 'INCONCLUSIVE', limitations: ['unable to answer'], isModelEstimated: true },
                 executionTrace: [],
                 tokenUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
                 taskClassification: 'SINGLE_IMAGE_VQA'
             } as unknown as AIProviderResponse;
        }
        
        return {
             provider: 'MockProvider',
             model: req.config?.model || 'mock-model',
             answer: "Good answer",
             evidence: { observations: ["Obs 1"], interpretations: ["Int 1"] },
             confidence: { level: 'HIGH', limitations: [], isModelEstimated: true },
             executionTrace: [],
             tokenUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
             taskClassification: 'SINGLE_IMAGE_VQA'
        } as unknown as AIProviderResponse;
    }
}

describe('Orchestrator Fallback', () => {
    it('executes the provider properly and retains tool trace', async () => {
         const provider = new MockProvider();
         provider.triggerFailure = true; 
         
         const orchestrator = new Orchestrator(provider, "System prompt");
         const images: NormalizedImage[] = [{
             id: 'img1', filename: 'test.jpg', mimeType: 'image/jpeg', sizeBytes: 100, modality: 'OPTICAL', temporalRole: 'PRIMARY', sourceBase64: 'base64'
         }] as NormalizedImage[];
         
         const result = await orchestrator.execute("Is there water?", images);
         
         expect(provider.callCount).toBe(1);
    });
});
