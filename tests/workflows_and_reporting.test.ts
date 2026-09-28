import { describe, it, expect } from 'vitest';
import { classifyTask } from '../server/agent/taskClassifier.js';
import { NormalizedImage } from '../server/imagery/types.js';
import { generateSihReport } from '../src/utils/reportGenerator.js';
import { AgentResponse, UploadedImage } from '../src/types/index.js';
import { globalSessionManager } from '../server/session/sessionManager.js';

describe('Task Classification & Minimum-Sufficient Evidence', () => {
  it('correctly classifies bi-temporal change when before and after roles are set', () => {
    const images: NormalizedImage[] = [
      { id: '1', filename: 't1.tif', mimeType: 'image/tiff', sizeBytes: 1000, width: 800, height: 800, bandCount: 3, modality: 'OPTICAL', temporalRole: 'BEFORE', acquisitionTime: null, geospatialMetadata: null, sourceBase64: '' },
      { id: '2', filename: 't2.tif', mimeType: 'image/tiff', sizeBytes: 1000, width: 800, height: 800, bandCount: 3, modality: 'OPTICAL', temporalRole: 'AFTER', acquisitionTime: null, geospatialMetadata: null, sourceBase64: '' }
    ];
    const task = classifyTask("Did built-up area expand?", images);
    expect(task).toBe('BI_TEMPORAL_ANALYSIS');
  });

  it('correctly classifies optical + sar cross-modal analysis', () => {
    const images: NormalizedImage[] = [
      { id: '1', filename: 'opt.tif', mimeType: 'image/tiff', sizeBytes: 1000, width: 800, height: 800, bandCount: 3, modality: 'OPTICAL', temporalRole: 'PRIMARY', acquisitionTime: null, geospatialMetadata: null, sourceBase64: '' },
      { id: '2', filename: 'sar.tif', mimeType: 'image/tiff', sizeBytes: 1000, width: 800, height: 800, bandCount: 1, modality: 'SAR', temporalRole: 'PRIMARY', acquisitionTime: null, geospatialMetadata: null, sourceBase64: '' }
    ];
    const task = classifyTask("Compare optical and SAR radar returns", images);
    expect(task).toBe('OPTICAL_SAR_ANALYSIS');
  });

  it('routes to SAR specialist for single SAR image without optical keywords', () => {
    const images: NormalizedImage[] = [
      { id: '1', filename: 'sar.tif', mimeType: 'image/tiff', sizeBytes: 1000, width: 800, height: 800, bandCount: 1, modality: 'SAR', temporalRole: 'PRIMARY', acquisitionTime: null, geospatialMetadata: null, sourceBase64: '' }
    ];
    const task = classifyTask("Evaluate radar backscatter intensity", images);
    expect(task).toBe('SAR_ANALYSIS');
  });

  it('returns UNSUPPORTED_QUERY when no images and no session history', () => {
    const task = classifyTask("Where is the forest?", []);
    expect(task).toBe('UNSUPPORTED_QUERY');
  });
});

describe('Report Generation', () => {
  it('generates a complete auditable SIH-26167 technical report', () => {
    const mockResponse: AgentResponse = {
      provider: 'Gemini',
      model: 'models/gemini-2.5-flash',
      taskClassification: 'BI_TEMPORAL_ANALYSIS',
      answer: 'Built-up infrastructure increased significantly (+28%) between T1 and T2.',
      evidence: {
        observations: ['New 4-lane arterial road observed in south quadrant', 'Cleared soil plots'],
        interpretations: ['Conversion of agricultural pasture into industrial logistics facilities']
      },
      confidence: {
        level: 'VERIFIED',
        limitations: ['Minor cloud shadow in northeast corner'],
        isModelEstimated: true
      },
      recommendedModality: 'Optical + SAR Complementary',
      groundingBoxes: [
        { label: 'New Logistics Park', ymin: 420, xmin: 360, ymax: 760, xmax: 700 }
      ],
      executionTrace: [
        { step: 'INPUT_RECEIVED', status: 'SUCCESS', details: '2 images received' },
        { step: 'TASK_CLASSIFIED', status: 'SUCCESS', details: 'BI_TEMPORAL_ANALYSIS' },
        { step: 'TEMPORAL_ANALYSIS_COMPLETED', status: 'SUCCESS', durationMs: 450 }
      ],
      tokenUsage: { inputTokens: 450, outputTokens: 120, totalTokens: 570 }
    };

    const mockImages: UploadedImage[] = [
      {
        id: 'img1',
        file: new File([''], 'before.tif'),
        previewUrl: 'data:image/png;base64,123',
        base64Data: '123',
        mimeType: 'image/tiff',
        slot: 'before',
        metadata: {
          fileName: 'before.tif',
          width: 800,
          height: 800,
          bandCount: 3,
          crs: 'WGS 84 / UTM zone 43N',
          epsg: 32643
        }
      }
    ];

    const report = generateSihReport(
      'Did built-up area expand?',
      mockResponse,
      mockImages,
      'run_test_123'
    );

    expect(report).toContain('SATQUERY AI — OFFICIAL SIH-26167 REMOTE SENSING AUDIT REPORT');
    expect(report).toContain('BI_TEMPORAL_ANALYSIS');
    expect(report).toContain('VERIFIED');
    expect(report).toContain('WGS 84 / UTM zone 43N');
    expect(report).toContain('New Logistics Park');
    expect(report).toContain('TEMPORAL_ANALYSIS_COMPLETED');
  });
});

describe('Session History Management', () => {
  it('isolates sessions and tracks message and evidence history', () => {
    const sId = `test_sess_${Date.now()}`;
    const session = globalSessionManager.getSession(sId);
    expect(session.sessionId).toBe(sId);
    expect(session.messages.length).toBe(0);

    globalSessionManager.addMessage(sId, 'user', 'Analyze port infrastructure');
    globalSessionManager.addMessage(sId, 'model', 'Port infrastructure verified.');
    globalSessionManager.addEvidence(sId, {
      observations: ['Breakwater pier detected'],
      interpretations: ['Commercial harbor facility']
    });

    const updated = globalSessionManager.getSession(sId);
    expect(updated.messages.length).toBe(2);
    expect(updated.evidenceHistory.length).toBe(1);
    expect(updated.evidenceHistory[0].observations).toContain('Breakwater pier detected');
  });
});
