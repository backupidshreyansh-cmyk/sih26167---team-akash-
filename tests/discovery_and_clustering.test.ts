import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ArchiveConfig } from '../server/archive/archiveConfig.js';
import { CatalogService } from '../server/archive/catalogService.js';
import { IngestionEngine } from '../server/archive/ingestionEngine.js';
import { LocalVectorIndex } from '../server/embedding/vectorIndex.js';
import { ClusteringEngine } from '../server/discovery/clusteringEngine.js';
import { SimilarSiteService } from '../server/discovery/similarSiteService.js';

describe('Phase 6: Similar-Site Discovery, Clustering & Spatial Intelligence', () => {
  let tempArchiveDir: string;

  beforeEach(async () => {
    tempArchiveDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satquery_discovery_test_'));
    ArchiveConfig.configureRoot(tempArchiveDir);
    CatalogService.clearCache();
    LocalVectorIndex.clearCache();
    await ArchiveConfig.ensureDirectories();
  });

  afterEach(() => {
    ArchiveConfig.resetRoot();
    CatalogService.clearCache();
    LocalVectorIndex.clearCache();
    if (fs.existsSync(tempArchiveDir)) {
      try {
        fs.rmSync(tempArchiveDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup
      }
    }
  });

  it('1. Clusters high-dimensional embedding vectors using deterministic Spherical K-Means and identifies medoid representatives', () => {
    // Generate synthetic 512-D L2 normalized vectors for 6 items in 2 distinct clusters
    const items = [
      { id: 'site_A1', vec: [0.9, 0.1, 0.0, ...new Array(509).fill(0)] },
      { id: 'site_A2', vec: [0.85, 0.15, 0.0, ...new Array(509).fill(0)] },
      { id: 'site_A3', vec: [0.88, 0.12, 0.0, ...new Array(509).fill(0)] },
      { id: 'site_B1', vec: [0.0, 0.1, 0.9, ...new Array(509).fill(0)] },
      { id: 'site_B2', vec: [0.0, 0.15, 0.85, ...new Array(509).fill(0)] },
      { id: 'site_B3', vec: [0.0, 0.12, 0.88, ...new Array(509).fill(0)] }
    ];

    // Normalize
    for (const item of items) {
      const norm = Math.sqrt(item.vec.reduce((sum, v) => sum + v * v, 0));
      item.vec = item.vec.map(v => v / norm);
    }

    const clusters = ClusteringEngine.cluster(items, i => i.vec, 2);

    expect(clusters.length).toBe(2);
    expect(clusters[0].size).toBe(3);
    expect(clusters[1].size).toBe(3);
    expect(clusters[0].representativeItem).toBeDefined();
    expect(clusters[1].representativeItem).toBeDefined();
    expect(clusters[0].items.every(m => m.similarityToCentroid > 0.9)).toBe(true);
  });

  it('2. Enforces self-exclusion: reference scene is never returned in similar candidate set', async () => {
    // Ingest 2 distinct raster files
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const buf = Buffer.from(pngBase64, 'base64');

    const res1 = await IngestionEngine.ingestFile(buf, 'scene_ref.png', 'image/png');
    expect(res1.success).toBe(true);
    const refSceneId = res1.scene!.sceneId;

    // Ingest a second file with slightly different name
    const pngBase64_2 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbhyQAAAABJRU5ErkJggg==';
    const buf2 = Buffer.from(pngBase64_2, 'base64');
    const res2 = await IngestionEngine.ingestFile(buf2, 'scene_other.png', 'image/png');
    expect(res2.success).toBe(true);

    const discovery = await SimilarSiteService.discoverSimilarSites(refSceneId, { topK: 10, minSimilarity: 0.1 });

    expect(discovery.referenceScene.sceneId).toBe(refSceneId);
    expect(discovery.allCandidates.every(c => c.sceneId !== refSceneId)).toBe(true);
  });

  it('3. Suppresses exact file duplicate hashes from discovery results', async () => {
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const buf = Buffer.from(pngBase64, 'base64');

    const res1 = await IngestionEngine.ingestFile(buf, 'primary_site.png', 'image/png');
    const refSceneId = res1.scene!.sceneId;

    // Ingest duplicate with different name
    const res2 = await IngestionEngine.ingestFile(buf, 'duplicate_site.png', 'image/png');
    expect(res2.isDuplicate).toBe(true);

    const discovery = await SimilarSiteService.discoverSimilarSites(refSceneId, { topK: 10 });
    // Duplicate of reference scene must not appear
    expect(discovery.allCandidates.find(c => c.fileName === 'duplicate_site.png')).toBeUndefined();
  });

  it('4. Records and retrieves analyst feedback on discovered sites', () => {
    SimilarSiteService.recordAnalystFeedback('scene_002', 'scene_ref_001', 'CONFIRM');
    SimilarSiteService.recordAnalystFeedback('scene_003', 'scene_ref_001', 'REJECT');

    const feedback = SimilarSiteService.getFeedback();
    expect(feedback.length).toBeGreaterThanOrEqual(2);
    expect(feedback[0].action).toBe('REJECT');
    expect(feedback[1].action).toBe('CONFIRM');
  });
});
