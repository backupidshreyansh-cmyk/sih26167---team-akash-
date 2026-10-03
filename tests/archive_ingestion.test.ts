import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { IngestionEngine } from '../server/archive/ingestionEngine.js';
import { CatalogService } from '../server/archive/catalogService.js';
import { ArchiveConfig } from '../server/archive/archiveConfig.js';
import { GeoreferencingEngine } from '../server/archive/georeferencing.js';

describe('Phase 1: Local Satellite Archive Foundation', () => {
  let tempArchiveDir: string;

  beforeEach(async () => {
    // Isolated temp data directory for test reproducibility
    tempArchiveDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satquery_archive_test_'));
    ArchiveConfig.configureRoot(tempArchiveDir);
    CatalogService.clearCache();
    await ArchiveConfig.ensureDirectories();
  });

  afterEach(async () => {
    ArchiveConfig.resetRoot();
    CatalogService.clearCache();
    if (fs.existsSync(tempArchiveDir)) {
      try {
        fs.rmSync(tempArchiveDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors on temp
      }
    }
  });

  it('1. Ingests a valid raster file and extracts metadata, stable scene ID, and SHA-256 hash', async () => {
    // 1x1 Minimal valid PNG
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const buffer = Buffer.from(pngBase64, 'base64');

    const result = await IngestionEngine.ingestFile(buffer, 'sentinel2_20240315_test.png', 'image/png');

    expect(result.success).toBe(true);
    expect(result.isDuplicate).toBe(false);
    expect(result.scene).toBeDefined();

    const scene = result.scene!;
    expect(scene.sceneId).toMatch(/^msi_20240315_[a-f0-9]{10}$/);
    expect(scene.fileHash).toHaveLength(64); // SHA-256 hex
    expect(scene.width).toBe(1);
    expect(scene.height).toBe(1);
    expect(scene.format).toBe('PNG');
    expect(scene.status).toBe('READY');
    expect(scene.provenance.steps.length).toBeGreaterThanOrEqual(4);
  });

  it('2. Correctly flags missing CRS as unavailable and does not invent coordinates', async () => {
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const buffer = Buffer.from(pngBase64, 'base64');

    const result = await IngestionEngine.ingestFile(buffer, 'unreferenced_aerial.png', 'image/png');

    expect(result.success).toBe(true);
    const scene = result.scene!;
    expect(scene.crs).toBe('unavailable');
    expect(scene.epsg).toBeNull();
    expect(scene.transform).toBeNull();
    expect(scene.bounds).toBeNull();
    expect(scene.quality.georeferencingStatus).toBe('UNAVAILABLE');
  });

  it('3. Deduplicates identical files using O(1) hash check (Idempotency)', async () => {
    const buffer = Buffer.from('TEST_RASTER_DATA_RESOURCESAT_PAYLOAD_12345');

    // First ingestion
    const firstResult = await IngestionEngine.ingestFile(buffer, 'resourcesat_pass1.tif', 'image/tiff');
    expect(firstResult.success).toBe(true);
    expect(firstResult.isDuplicate).toBe(false);
    const firstSceneId = firstResult.scene!.sceneId;

    // Second ingestion of exact identical file buffer
    const secondResult = await IngestionEngine.ingestFile(buffer, 'resourcesat_pass1_duplicate.tif', 'image/tiff');
    expect(secondResult.success).toBe(true);
    expect(secondResult.isDuplicate).toBe(true);
    expect(secondResult.scene!.sceneId).toBe(firstSceneId);

    // Verify catalog only stores 1 unique record
    const all = await CatalogService.getAllScenes();
    expect(all.length).toBe(1);
  });

  it('4. Handles empty or corrupted files safely without crashing', async () => {
    const emptyBuffer = Buffer.alloc(0);
    const result = await IngestionEngine.ingestFile(emptyBuffer, 'corrupt.tif', 'image/tiff');

    expect(result.success).toBe(false);
    expect(result.error).toBe('EMPTY_BUFFER');
  });

  it('5. Performs incremental catalog updates and persists catalog.json', async () => {
    const buf1 = Buffer.from('RASTER_ONE');
    const buf2 = Buffer.from('RASTER_TWO');

    await IngestionEngine.ingestFile(buf1, 'scene_a.tif');
    let catalog = await CatalogService.loadCatalog();
    expect(catalog.totalScenes).toBe(1);

    // Add second scene incrementally
    await IngestionEngine.ingestFile(buf2, 'scene_b.tif');
    catalog = await CatalogService.loadCatalog();
    expect(catalog.totalScenes).toBe(2);

    // Verify disk file
    const catalogPath = ArchiveConfig.getCatalogFilePath();
    expect(fs.existsSync(catalogPath)).toBe(true);
    const onDisk = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
    expect(onDisk.totalScenes).toBe(2);
  });

  it('6. Supports batch directory ingestion of only new/unprocessed scenes', async () => {
    const incomingDir = path.join(tempArchiveDir, 'incoming');
    fs.mkdirSync(incomingDir, { recursive: true });

    fs.writeFileSync(path.join(incomingDir, 'scene1.png'), Buffer.from('SCENE_1_BYTES'));
    fs.writeFileSync(path.join(incomingDir, 'scene2.png'), Buffer.from('SCENE_2_BYTES'));
    fs.writeFileSync(path.join(incomingDir, 'notes.txt'), 'Not an image');

    const batch1 = await IngestionEngine.batchIngestDirectory(incomingDir);
    expect(batch1.totalDiscovered).toBe(2);
    expect(batch1.newlyIngested).toBe(2);
    expect(batch1.duplicatesSkipped).toBe(0);

    // Add 1 new scene and re-run batch ingestion
    fs.writeFileSync(path.join(incomingDir, 'scene3.png'), Buffer.from('SCENE_3_BYTES'));
    const batch2 = await IngestionEngine.batchIngestDirectory(incomingDir);
    expect(batch2.totalDiscovered).toBe(3);
    expect(batch2.newlyIngested).toBe(1);
    expect(batch2.duplicatesSkipped).toBe(2);
  });

  it('7. Converts pixel to projected coordinates and WGS84 when georeferencing is available', () => {
    // Affine transform for UTM Zone 43N: [originX, pixelWidth, 0, originY, 0, pixelHeight]
    const transform = [272000, 10, 0, 2108000, 0, -10];
    const epsg = 32643; // UTM Zone 43N (Mumbai / Gujarat)

    const projected = GeoreferencingEngine.pixelToProjected(10, 20, transform);
    expect(projected).toEqual({ x: 272100, y: 2107800 });

    const wgs84 = GeoreferencingEngine.pixelToWGS84(0, 0, transform, epsg);
    expect(wgs84).toBeDefined();
    expect(wgs84!.lng).toBeGreaterThan(72.0);
    expect(wgs84!.lng).toBeLessThan(73.5);
    expect(wgs84!.lat).toBeGreaterThan(18.5);
    expect(wgs84!.lat).toBeLessThan(19.5);

    // Bounds computation
    const bounds = GeoreferencingEngine.computeBounds(100, 100, transform, epsg);
    expect(bounds).toBeDefined();
    expect(bounds!.minX).toBe(272000);
    expect(bounds!.maxX).toBe(273000);
    expect(bounds!.minY).toBe(2107000);
    expect(bounds!.maxY).toBe(2108000);
  });

  it('8. Correctly filters and queries scenes by sensor, modality, and date', async () => {
    await IngestionEngine.ingestFile(Buffer.from('SAR_DATA'), 'sentinel1_20240115_sar.tif', undefined, {
      overrideModality: 'sar',
      overrideSensor: 'C-SAR',
      overrideDate: '2024-01-15T00:00:00Z'
    });

    await IngestionEngine.ingestFile(Buffer.from('OPTICAL_DATA'), 'sentinel2_20240220_opt.tif', undefined, {
      overrideModality: 'optical',
      overrideSensor: 'MSI',
      overrideDate: '2024-02-20T00:00:00Z'
    });

    const sarResults = await CatalogService.queryScenes({ modality: 'sar' });
    expect(sarResults.total).toBe(1);
    expect(sarResults.scenes[0].sensor).toBe('C-SAR');

    const optResults = await CatalogService.queryScenes({ sensor: 'msi' });
    expect(optResults.total).toBe(1);
    expect(optResults.scenes[0].sensor).toBe('MSI');

    const stats = await CatalogService.getStats();
    expect(stats.totalScenes).toBe(2);
    expect(stats.byModality.sar).toBe(1);
    expect(stats.byModality.optical).toBe(1);
  });
});
