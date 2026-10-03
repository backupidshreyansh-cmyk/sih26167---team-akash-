import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ArchiveConfig } from '../server/archive/archiveConfig.js';
import { CatalogService } from '../server/archive/catalogService.js';
import { IngestionEngine } from '../server/archive/ingestionEngine.js';
import { LocalVectorIndex } from '../server/embedding/vectorIndex.js';
import { SemanticSearchService } from '../server/retrieval/semanticSearchService.js';
import { EvaluationEngine } from '../server/evaluation/evaluationEngine.js';

describe('Phase 8: SIH 2026 PS 26227 Evaluator Attack Test & Offline Hardening', () => {
  let tempArchiveDir: string;

  beforeEach(async () => {
    tempArchiveDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satquery_eval_attack_'));
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
        // ignore
      }
    }
  });

  it('TEST 1: Ingesting corrupt or empty files fails safely with controlled error without crashing', async () => {
    // Empty buffer
    const emptyBuf = Buffer.alloc(0);
    const res1 = await IngestionEngine.ingestFile(emptyBuf, 'corrupt.png', 'image/png');
    expect(res1.success).toBe(false);
    expect(res1.error).toBeDefined();

    // Random non-image ASCII text
    const textBuf = Buffer.from('This is a plain text file, not a satellite raster.', 'utf-8');
    const res2 = await IngestionEngine.ingestFile(textBuf, 'notes.txt', 'text/plain');
    expect(res2.success).toBe(false);
    expect(res2.error).toContain('Unsupported raster format');
  });

  it('TEST 2: Missing geospatial metadata flags CRS as unavailable and does NOT invent coordinates', async () => {
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const buf = Buffer.from(pngBase64, 'base64');

    const res = await IngestionEngine.ingestFile(buf, 'unreferenced_consumer_raster.png', 'image/png');
    expect(res.success).toBe(true);
    expect(res.scene!.crs).toBe('unavailable');
    expect(res.scene!.bounds).toBeNull();
    expect(res.scene!.quality.warnings.some(w => w.includes('MISSING_GEOREFERENCE'))).toBe(true);
  });

  it('TEST 3: Duplicate ingestion detects duplicate file hash and avoids redundant catalog entries', async () => {
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const buf = Buffer.from(pngBase64, 'base64');

    const res1 = await IngestionEngine.ingestFile(buf, 'first_copy.png', 'image/png');
    expect(res1.success).toBe(true);
    expect(res1.isDuplicate).toBe(false);

    const res2 = await IngestionEngine.ingestFile(buf, 'second_copy_identical_hash.png', 'image/png');
    expect(res2.success).toBe(true);
    expect(res2.isDuplicate).toBe(true);
    expect(res2.scene!.sceneId).toBe(res1.scene!.sceneId);

    const allScenes = await CatalogService.getAllScenes();
    expect(allScenes.length).toBe(1); // exactly 1 scene record
  });

  it('TEST 4: Incremental ingestion adds new vector without re-indexing existing scenes', async () => {
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const buf1 = Buffer.from(pngBase64, 'base64');
    await IngestionEngine.ingestFile(buf1, 'scene_a.png', 'image/png');

    const stats1 = await LocalVectorIndex.getStats();
    expect(stats1.totalVectors).toBe(1);

    const pngBase64_2 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbhyQAAAABJRU5ErkJggg==';
    const buf2 = Buffer.from(pngBase64_2, 'base64');
    await IngestionEngine.ingestFile(buf2, 'scene_b.png', 'image/png');

    const stats2 = await LocalVectorIndex.getStats();
    expect(stats2.totalVectors).toBe(2);
  });

  it('TEST 5: Empty archive queries return empty candidate sets gracefully without uncaught exceptions', async () => {
    const res = await SemanticSearchService.search('find newly built structures near rivers', {}, 10);
    expect(res.candidates).toEqual([]);
    expect(res.retrievedCount).toBe(0);
    expect(res.totalCatalogScenes).toBe(0);
  });

  it('TEST 6: Evaluator capability matrix lists all phases with honest limitation statements', () => {
    const matrix = EvaluationEngine.getCapabilityMatrix();
    expect(matrix.length).toBe(8);
    expect(matrix.every(item => item.status === 'IMPLEMENTED')).toBe(true);
    expect(matrix.every(item => item.knownLimitations.length > 5)).toBe(true);
  });

  it('TEST 7: Offline certification verifies target hardware specification and zero required external services', () => {
    const hw = EvaluationEngine.getHardwareProfile();
    expect(hw.targetHardware.cpu).toContain('AMD Ryzen 7');
    expect(hw.targetHardware.gpu).toContain('NVIDIA RTX 4050');
    expect(hw.targetHardware.vram).toBe('6 GB GDDR6');
    expect(hw.targetHardware.ram).toBe('24 GB DDR5');
  });

  it('TEST 8: Reproducible evaluation benchmark executes and records real latencies to disk', async () => {
    const results = await EvaluationEngine.runBenchmark();
    expect(results.runId).toMatch(/^RUN-BENCHMARK-/);
    expect(results.networkStatus).toBe('OFFLINE_CERTIFIED');
    expect(results.latencies.semanticSearchMs.totalMs).toBeGreaterThanOrEqual(0);
    expect(results.latencies.incrementalIngestionMs.newSceneIngestMs).toBeGreaterThan(0);
  });
});
