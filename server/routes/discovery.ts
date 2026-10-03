/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Express Router for Similar-Site Discovery & Clustering (Phase 6).
 */

import { Router } from 'express';
import { SimilarSiteService } from '../discovery/similarSiteService.js';
import { ClusteringEngine } from '../discovery/clusteringEngine.js';
import { LocalVectorIndex } from '../embedding/vectorIndex.js';
import { CatalogService } from '../archive/catalogService.js';
import { RunIdService } from '../review/runIdService.js';
import { AuditTrailService } from '../review/auditTrailService.js';

export const discoveryRouter = Router();

// 1. "FIND MORE LIKE THIS" / Similar-Site Discovery
discoveryRouter.post('/similar', async (req, res) => {
  try {
    const { referenceSceneId, topK = 20, clusterCount = 3, minSimilarity = 0.40, sensorFilter, modalityFilter } = req.body;

    if (!referenceSceneId) {
      return res.status(400).json({ error: 'referenceSceneId is required.' });
    }

    const runId = RunIdService.generateRunId('SIMILAR_SITE_DISCOVERY');

    const result = await SimilarSiteService.discoverSimilarSites(referenceSceneId, {
      topK: Number(topK),
      clusterCount: Number(clusterCount),
      minSimilarity: Number(minSimilarity),
      sensorFilter,
      modalityFilter
    });

    await AuditTrailService.logEvent(
      'CANDIDATE_RETRIEVED',
      runId,
      {
        referenceSceneId,
        totalDiscovered: result.totalDiscovered,
        clustersCount: result.clustersCount,
        isCacheHit: result.isCacheHit
      },
      { sceneId: referenceSceneId }
    );

    return res.json({
      ...result,
      runId
    });
  } catch (error: any) {
    console.error('Similar Site Discovery Error:', error);
    res.status(500).json({ error: error.message || 'Failed to discover similar sites.' });
  }
});

// 2. Unsupervised / Embedding-Based Grouping on arbitrary candidates
discoveryRouter.post('/cluster', async (req, res) => {
  try {
    const { sceneIds, k = 3 } = req.body;

    if (!Array.isArray(sceneIds) || sceneIds.length === 0) {
      return res.status(400).json({ error: 'sceneIds array is required.' });
    }

    const allScenes = await CatalogService.getAllScenes();
    const sceneLookup = new Map(allScenes.map(s => [s.sceneId, s]));

    const items: Array<{ sceneId: string; scene: any; vector: number[] }> = [];

    for (const id of sceneIds) {
      const vec = await LocalVectorIndex.getVector(id);
      const scene = sceneLookup.get(id);
      if (vec && scene) {
        items.push({ sceneId: id, scene, vector: vec });
      }
    }

    if (items.length === 0) {
      return res.json({ clusters: [] });
    }

    const clusters = ClusteringEngine.cluster(
      items,
      item => item.vector,
      Math.min(Number(k), items.length)
    );

    return res.json({
      totalItems: items.length,
      clusterCount: clusters.length,
      clusters: clusters.map(c => ({
        clusterId: c.clusterId,
        clusterLabel: c.clusterLabel,
        size: c.size,
        representativeSceneId: c.representativeItem.sceneId,
        representativeScene: c.representativeItem.scene,
        members: c.items.map(m => ({
          sceneId: m.item.sceneId,
          scene: m.item.scene,
          similarityToCentroid: m.similarityToCentroid
        }))
      }))
    });
  } catch (error: any) {
    console.error('Clustering Error:', error);
    res.status(500).json({ error: error.message || 'Clustering failed.' });
  }
});

// 3. Record Analyst Confirmation / Rejection for Discovery
discoveryRouter.post('/feedback', async (req, res) => {
  try {
    const { sceneId, referenceSceneId, action } = req.body;
    if (!sceneId || !referenceSceneId || !['CONFIRM', 'REJECT'].includes(action)) {
      return res.status(400).json({ error: "sceneId, referenceSceneId, and action ('CONFIRM' | 'REJECT') are required." });
    }

    SimilarSiteService.recordAnalystFeedback(sceneId, referenceSceneId, action);
    return res.json({ success: true, sceneId, referenceSceneId, action });
  } catch (error: any) {
    console.error('Discovery Feedback Error:', error);
    res.status(500).json({ error: error.message || 'Failed to record discovery feedback.' });
  }
});

// 4. Get Discovery Feedback
discoveryRouter.get('/feedback', async (_req, res) => {
  try {
    const feedback = SimilarSiteService.getFeedback();
    return res.json({ feedback });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get feedback.' });
  }
});
