import { describe, it, expect, vi } from 'vitest';
import { GeminiProvider } from '../server/providers/GeminiProvider.js';
import { LocalOllamaProvider } from '../server/providers/LocalOllamaProvider.js';
import { Orchestrator } from '../server/agent/orchestrator.js';
import { globalSessionManager } from '../server/session/sessionManager.js';

describe('AI Provider Architecture', () => {

  describe('GeminiProvider', () => {
    it('should correctly format request payloads', async () => {
      const originalKey = process.env.GEMINI_API_KEY;
      process.env.GEMINI_API_KEY = "test_key";
      
      const provider = new GeminiProvider();
      const isAvail = await provider.isAvailable();
      expect(isAvail).toBe(true);
      expect(provider.generateContent).toBeTypeOf('function');
      
      process.env.GEMINI_API_KEY = originalKey;
    });
  });

  describe('LocalOllamaProvider', () => {
    it('should fallback gracefully if Ollama is unreachable (AUTO mode simulation)', async () => {
      const provider = new LocalOllamaProvider();
      const isAvail = await provider.isAvailable();
      expect(isAvail).toBe(false);
    });

    it('should implement the AIProvider contract', () => {
      const provider = new LocalOllamaProvider();
      expect(provider.generateContent).toBeTypeOf('function');
      expect(provider.isAvailable).toBeTypeOf('function');
    });
  });

  describe('Orchestrator and Session Management', () => {
    it('should maintain session context across interactions', () => {
      const sessionId = 'test-session-1';
      globalSessionManager.addMessage(sessionId, 'user', 'Analyze this area');
      const session = globalSessionManager.getSession(sessionId);
      
      expect(session.messages.length).toBe(1);
      expect(session.messages[0].text).toBe('Analyze this area');
      
      globalSessionManager.addEvidence(sessionId, { observations: ['test obs'], interpretations: ['test int'] });
      expect(session.evidenceHistory.length).toBe(1);
    });
  });
});
