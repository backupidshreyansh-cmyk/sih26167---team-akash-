/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Express Router for Analyst Review, Feedback & Audit Trail (Phase 7).
 */

import { Router } from 'express';
import { ReviewQueueService } from '../review/reviewQueueService.js';
import { AuditTrailService } from '../review/auditTrailService.js';
import { FeedbackStore } from '../review/feedbackStore.js';
import { ExportService } from '../review/exportService.js';
import { RunIdService } from '../review/runIdService.js';

export const reviewRouter = Router();

// 1. Query Review Queue with Filters
reviewRouter.get('/queue', async (req, res) => {
  try {
    const { status, changeType, sensor, quality, search, sortBy, sortOrder } = req.query;

    const result = await ReviewQueueService.queryQueue({
      status: status as any,
      changeType: changeType as string,
      sensor: sensor as string,
      quality: quality as any,
      search: search as string,
      sortBy: sortBy as any,
      sortOrder: sortOrder as any
    });

    return res.json(result);
  } catch (error: any) {
    console.error('Review Queue Query Error:', error);
    res.status(500).json({ error: error.message || 'Failed to query review queue.' });
  }
});

// 2. Get Single Candidate Details
reviewRouter.get('/candidates/:candidateId', async (req, res) => {
  try {
    const { candidateId } = req.params;
    const candidate = await ReviewQueueService.getCandidateById(candidateId);
    if (!candidate) {
      return res.status(404).json({ error: `Review candidate '${candidateId}' not found.` });
    }
    return res.json(candidate);
  } catch (error: any) {
    console.error('Get Candidate Error:', error);
    res.status(500).json({ error: error.message || 'Failed to get review candidate.' });
  }
});

// 3. Record Analyst Decision (CONFIRM, REJECT, UNCERTAIN)
reviewRouter.post('/candidates/:candidateId/decision', async (req, res) => {
  try {
    const { candidateId } = req.params;
    const { decision, rejectionReason, rejectionNotes, confirmedEvidence, analystNotes, runId } = req.body;

    if (!decision || !['CONFIRMED', 'REJECTED', 'UNCERTAIN'].includes(decision)) {
      return res.status(400).json({ error: "decision must be one of: 'CONFIRMED', 'REJECTED', 'UNCERTAIN'" });
    }

    const updated = await ReviewQueueService.updateCandidateDecision(candidateId, decision, {
      rejectionReason,
      rejectionNotes,
      confirmedEvidence,
      analystNotes,
      runId
    });

    return res.json(updated);
  } catch (error: any) {
    console.error('Record Decision Error:', error);
    res.status(500).json({ error: error.message || 'Failed to record analyst decision.' });
  }
});

// 4. Bulk Review Decision
reviewRouter.post('/candidates/bulk-decision', async (req, res) => {
  try {
    const { candidateIds, decision, rejectionReason, confirmedEvidence, analystNotes } = req.body;

    if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
      return res.status(400).json({ error: 'candidateIds array is required and must not be empty.' });
    }
    if (!decision || !['CONFIRMED', 'REJECTED'].includes(decision)) {
      return res.status(400).json({ error: "Bulk decision must be either 'CONFIRMED' or 'REJECTED'." });
    }

    const result = await ReviewQueueService.bulkDecision(candidateIds, decision, {
      rejectionReason,
      confirmedEvidence,
      analystNotes
    });

    return res.json(result);
  } catch (error: any) {
    console.error('Bulk Decision Error:', error);
    res.status(500).json({ error: error.message || 'Failed to apply bulk decision.' });
  }
});

// 5. Enqueue Candidate
reviewRouter.post('/enqueue', async (req, res) => {
  try {
    const candidateData = req.body;
    if (!candidateData.identity || !candidateData.identity.sceneId) {
      return res.status(400).json({ error: 'Valid candidate identity and sceneId required.' });
    }

    const enqueued = await ReviewQueueService.enqueueCandidate(candidateData);
    return res.status(201).json(enqueued);
  } catch (error: any) {
    console.error('Enqueue Candidate Error:', error);
    res.status(500).json({ error: error.message || 'Failed to enqueue candidate.' });
  }
});

// 6. Get Audit Trail Events
reviewRouter.get('/audit-trail', async (req, res) => {
  try {
    const { runId, candidateId, sceneId, operation, limit } = req.query;
    const events = await AuditTrailService.getEvents({
      runId: runId as string,
      candidateId: candidateId as string,
      sceneId: sceneId as string,
      operation: operation as string,
      limit: limit ? parseInt(limit as string, 10) : 100
    });
    return res.json({ total: events.length, events });
  } catch (error: any) {
    console.error('Audit Trail Error:', error);
    res.status(500).json({ error: error.message || 'Failed to get audit trail.' });
  }
});

// 7. Get Historical Feedback
reviewRouter.get('/feedback', async (req, res) => {
  try {
    const { candidateId, referenceSceneId, decision, limit } = req.query;
    const feedback = await FeedbackStore.getFeedback({
      candidateId: candidateId as string,
      referenceSceneId: referenceSceneId as string,
      decision: decision as any,
      limit: limit ? parseInt(limit as string, 10) : 100
    });
    return res.json({ total: feedback.length, feedback });
  } catch (error: any) {
    console.error('Feedback Query Error:', error);
    res.status(500).json({ error: error.message || 'Failed to get feedback records.' });
  }
});

// 8. Export Queue to CSV
reviewRouter.get('/export/csv', async (_req, res) => {
  try {
    const queue = await ReviewQueueService.loadQueue();
    const csv = ExportService.exportToCsv(queue);

    await AuditTrailService.logEvent(
      'EXPORT_CREATED',
      RunIdService.generateRunId('ANALYST_REVIEW'),
      { format: 'CSV', count: queue.length }
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="satquery_review_queue_${Date.now()}.csv"`);
    return res.send(csv);
  } catch (error: any) {
    console.error('CSV Export Error:', error);
    res.status(500).json({ error: error.message || 'Failed to export CSV.' });
  }
});

// 9. Export Queue to JSON
reviewRouter.get('/export/json', async (_req, res) => {
  try {
    const queue = await ReviewQueueService.loadQueue();
    const json = ExportService.exportToJson(queue);

    await AuditTrailService.logEvent(
      'EXPORT_CREATED',
      RunIdService.generateRunId('ANALYST_REVIEW'),
      { format: 'JSON', count: queue.length }
    );

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="satquery_review_queue_${Date.now()}.json"`);
    return res.send(json);
  } catch (error: any) {
    console.error('JSON Export Error:', error);
    res.status(500).json({ error: error.message || 'Failed to export JSON.' });
  }
});

// 10. Generate Candidate Summary Report (Markdown)
reviewRouter.get('/candidates/:candidateId/report', async (req, res) => {
  try {
    const { candidateId } = req.params;
    const candidate = await ReviewQueueService.getCandidateById(candidateId);
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found.' });
    }

    const report = ExportService.generateAnalystSummaryReport(candidate);
    res.setHeader('Content-Type', 'text/markdown');
    return res.send(report);
  } catch (error: any) {
    console.error('Report Generation Error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate summary report.' });
  }
});
