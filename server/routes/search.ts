/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Express Router for Semantic Satellite Retrieval (Phase 3, 7 & 8 Hardening).
 * Input validation, feedback-aware reranking, and audit correlation.
 */

import { Router } from 'express';
import { SemanticSearchService } from '../retrieval/semanticSearchService.js';
import { LocalVectorIndex } from '../embedding/vectorIndex.js';
import { EmbeddingEngine } from '../embedding/embeddingEngine.js';
import { FeedbackReranker } from '../review/feedbackReranker.js';
import { RunIdService } from '../review/runIdService.js';
import { AuditTrailService } from '../review/auditTrailService.js';

export const searchRouter = Router();

// 1. Natural-Language Semantic Search with Feedback Reranking
searchRouter.post('/semantic', async (req, res) => {
  try {
    const { query = '', filters = {}, topK = 10 } = req.body;

    const sanitizedTopK = Math.max(1, Math.min(100, Number(topK) || 10));
    const runId = RunIdService.generateRunId('SEMANTIC_RETRIEVAL');

    const response = await SemanticSearchService.search(String(query).trim(), filters, sanitizedTopK);

    // Apply deterministic feedback-aware adjustments from analyst review history
    const adjustedCandidates = await Promise.all(response.candidates.map(async (candidate) => {
      const adjustmentResult = await FeedbackReranker.computeAdjustment(
        candidate.sceneId,
        candidate.finalRankScore,
        {
          query: response.query,
          semanticConcept: candidate.scene.modality
        }
      );

      return {
        ...candidate,
        finalRankScore: adjustmentResult.finalScore,
        feedbackAdjustment: adjustmentResult.feedbackAdjustment,
        feedbackReason: adjustmentResult.appliedRule
      };
    }));

    // Re-sort if any feedback adjustments were applied
    adjustedCandidates.sort((a, b) => b.finalRankScore - a.finalRankScore);

    // Reassign ranks
    const finalCandidates = adjustedCandidates.map((c, idx) => ({
      ...c,
      rank: idx + 1
    }));

    await AuditTrailService.logEvent(
      'QUERY_EXECUTED',
      runId,
      {
        query: response.query,
        retrievedCount: finalCandidates.length,
        totalCatalogScenes: response.totalCatalogScenes
      }
    );

    return res.json({
      ...response,
      runId,
      candidates: finalCandidates
    });
  } catch (error: any) {
    console.error('Semantic Search API Error:', error);
    res.status(500).json({ error: error.message || 'Semantic search execution failed.' });
  }
});

// 2. Image-to-Image Similarity Search
searchRouter.post('/image-to-image', async (req, res) => {
  try {
    const { sceneId, base64Image, topK = 10 } = req.body;
    const sanitizedTopK = Math.max(1, Math.min(100, Number(topK) || 10));

    let vector: number[] | null = null;

    if (sceneId) {
      vector = await LocalVectorIndex.getVector(sceneId);
      if (!vector) {
        return res.status(404).json({ error: `Vector embedding for scene '${sceneId}' not found.` });
      }
    } else if (base64Image) {
      const clean = base64Image.replace(/^data:[^;]+;base64,/, '');
      const buf = Buffer.from(clean, 'base64');
      if (buf.length === 0) {
        return res.status(400).json({ error: 'Provided image buffer is empty.' });
      }
      const embedResult = await EmbeddingEngine.embedImage(
        buf,
        `query_${Date.now()}`,
        `temp_query_${Date.now()}`,
        'PNG',
        'optical',
        3
      );
      vector = embedResult.vector;
    } else {
      return res.status(400).json({ error: 'Either sceneId or base64Image is required.' });
    }

    const matches = await LocalVectorIndex.search(vector, sanitizedTopK + 1);
    // Exclude query scene itself if sceneId was passed
    const filtered = sceneId ? matches.filter(m => m.sceneId !== sceneId).slice(0, sanitizedTopK) : matches.slice(0, sanitizedTopK);

    return res.json({
      matches: filtered.map(m => ({
        sceneId: m.sceneId,
        similarity: Number(((m.similarity + 1.0) / 2.0).toFixed(4)) // scale to [0, 1]
      }))
    });
  } catch (error: any) {
    console.error('Image Search API Error:', error);
    res.status(500).json({ error: error.message || 'Image similarity search failed.' });
  }
});

// 3. Vector Index Status
searchRouter.get('/index-status', async (_req, res) => {
  try {
    const stats = await LocalVectorIndex.getStats();
    return res.json(stats);
  } catch (error: any) {
    console.error('Index Status Error:', error);
    res.status(500).json({ error: error.message || 'Failed to get vector index stats.' });
  }
});

// 4. Query History
searchRouter.get('/history', (_req, res) => {
  try {
    const history = SemanticSearchService.getHistory();
    return res.json({ history });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch query history.' });
  }
});
