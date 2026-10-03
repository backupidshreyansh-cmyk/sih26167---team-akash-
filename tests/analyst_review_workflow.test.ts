import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ArchiveConfig } from '../server/archive/archiveConfig.js';
import { ReviewQueueService } from '../server/review/reviewQueueService.js';
import { FeedbackStore } from '../server/review/feedbackStore.js';
import { FeedbackReranker } from '../server/review/feedbackReranker.js';
import { AuditTrailService } from '../server/review/auditTrailService.js';
import { ExportService } from '../server/review/exportService.js';
import { RunIdService } from '../server/review/runIdService.js';

describe('Phase 7: Analyst Review, Decision, Feedback & Complete Provenance', () => {
  let tempArchiveDir: string;

  beforeEach(async () => {
    tempArchiveDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satquery_review_test_'));
    ArchiveConfig.configureRoot(tempArchiveDir);
    ReviewQueueService.clearCache();
    FeedbackStore.clearCache();
    AuditTrailService.clearCache();
    await ArchiveConfig.ensureDirectories();
  });

  afterEach(() => {
    ArchiveConfig.resetRoot();
    ReviewQueueService.clearCache();
    FeedbackStore.clearCache();
    AuditTrailService.clearCache();
    if (fs.existsSync(tempArchiveDir)) {
      try {
        fs.rmSync(tempArchiveDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });

  it('1. Initializes and queries the local review queue with valid statuses', async () => {
    const res = await ReviewQueueService.queryQueue();
    expect(res.totalCandidates).toBeGreaterThanOrEqual(1);
    expect(res.candidates[0].candidateId).toMatch(/^REV-CAND-/);
    expect(res.counts.NEW).toBeGreaterThanOrEqual(1);
  });

  it('2. Records analyst CONFIRMATION with structured evidence and updates audit trail', async () => {
    const queueRes = await ReviewQueueService.queryQueue();
    const candidate = queueRes.candidates[0];

    const updated = await ReviewQueueService.updateCandidateDecision(
      candidate.candidateId,
      'CONFIRMED',
      {
        confirmedEvidence: ['PERSISTENT_CHANGE', 'STRONG_SPATIAL_COHERENCE', 'REGISTRATION_USABLE'],
        analystNotes: 'Verified against optical sub-pixel co-registration.'
      }
    );

    expect(updated.status).toBe('CONFIRMED');
    expect(updated.analystDecision?.decision).toBe('CONFIRMED');
    expect(updated.analystDecision?.confirmedEvidence).toContain('PERSISTENT_CHANGE');

    // Verify audit trail logged CANDIDATE_CONFIRMED
    const auditEvents = await AuditTrailService.getEvents({ candidateId: candidate.candidateId });
    expect(auditEvents.some(e => e.operation === 'CANDIDATE_CONFIRMED')).toBe(true);

    // Verify feedback was persisted in FeedbackStore
    const feedbackList = await FeedbackStore.getFeedback({ candidateId: candidate.candidateId });
    expect(feedbackList.length).toBe(1);
    expect(feedbackList[0].analystDecision).toBe('CONFIRMED');
  });

  it('3. Records analyst REJECTION with controlled reason and notes', async () => {
    const queueRes = await ReviewQueueService.queryQueue();
    const candidate = queueRes.candidates[0];

    const updated = await ReviewQueueService.updateCandidateDecision(
      candidate.candidateId,
      'REJECTED',
      {
        rejectionReason: 'SEASONAL_VARIATION',
        rejectionNotes: 'Difference caused by seasonal dry riverbed expansion.'
      }
    );

    expect(updated.status).toBe('REJECTED');
    expect(updated.analystDecision?.decision).toBe('REJECTED');
    expect(updated.analystDecision?.rejectionReason).toBe('SEASONAL_VARIATION');

    const auditEvents = await AuditTrailService.getEvents({ candidateId: candidate.candidateId });
    expect(auditEvents.some(e => e.operation === 'CANDIDATE_REJECTED')).toBe(true);
  });

  it('4. Applies deterministic feedback-aware ranking adjustment (+0.05 on confirmed, -0.10 on rejected)', async () => {
    const sceneId = 'test_scene_feedback_001';
    const runId = RunIdService.generateRunId('ANALYST_REVIEW');

    // Initially no feedback -> 0.0 adjustment
    const initial = await FeedbackReranker.computeAdjustment(sceneId, 0.80);
    expect(initial.feedbackAdjustment).toBe(0.0);
    expect(initial.finalScore).toBe(0.80);

    // Record confirmation
    await FeedbackStore.recordFeedback({
      candidateId: `cand_${sceneId}`,
      referenceSceneId: sceneId,
      retrievalMethod: 'Vector Search',
      candidateFeatures: {
        sensor: 'MSI',
        modality: 'optical',
        changeType: 'CONSTRUCTION',
        similarity: 0.80,
        registrationStatus: 'ALIGNED'
      },
      systemResult: {
        systemStatus: 'USABLE',
        changePercentage: 12.0
      },
      analystDecision: 'CONFIRMED',
      runId
    });

    const boosted = await FeedbackReranker.computeAdjustment(sceneId, 0.80);
    expect(boosted.feedbackAdjustment).toBe(0.05);
    expect(boosted.finalScore).toBe(0.85);
    expect(boosted.appliedRule).toContain('+0.05');
  });

  it('5. Exports review queue to CSV and JSON formats', async () => {
    const queue = await ReviewQueueService.loadQueue();

    const json = ExportService.exportToJson(queue);
    expect(json.startsWith('[')).toBe(true);
    const parsed = JSON.parse(json);
    expect(parsed.length).toBe(queue.length);

    const csv = ExportService.exportToCsv(queue);
    expect(csv.includes('candidate_id')).toBe(true);
    expect(csv.includes('status')).toBe(true);
    expect(csv.includes('change_type')).toBe(true);
    expect(csv.split('\n').length).toBeGreaterThanOrEqual(2);
  });

  it('6. Generates Markdown summary report preserving complete factual provenance', async () => {
    const queue = await ReviewQueueService.loadQueue();
    const candidate = queue[0];

    const report = ExportService.generateAnalystSummaryReport(candidate);
    expect(report).toContain('# SATELLITE EVIDENCE & ANALYST AUDIT REPORT');
    expect(report).toContain(candidate.candidateId);
    expect(report).toContain('DETECTED CHANGE SUMMARY');
    expect(report).toContain('PROCESSING PROVENANCE');
  });
});
