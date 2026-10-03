/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Local Metadata Catalog & Persistence Service (Phase 1).
 * Manages incremental scene records, fast hash indexing for deduplication,
 * and robust atomic persistence to disk.
 */

import fs from 'fs';
import path from 'path';
import { 
  SceneRecord, 
  ArchiveCatalogIndex, 
  ArchiveStats, 
  SceneQueryFilters, 
  ArchiveModality,
  ProvenanceRecord
} from './types.js';
import { ArchiveConfig } from './archiveConfig.js';

export class CatalogService {
  private static cachedCatalog: ArchiveCatalogIndex | null = null;
  private static isLoaded = false;

  /**
   * Initializes or loads the catalog from disk.
   */
  public static async loadCatalog(): Promise<ArchiveCatalogIndex> {
    await ArchiveConfig.ensureDirectories();
    const catalogPath = ArchiveConfig.getCatalogFilePath();

    if (this.isLoaded && this.cachedCatalog) {
      return this.cachedCatalog;
    }

    if (fs.existsSync(catalogPath)) {
      try {
        const raw = await fs.promises.readFile(catalogPath, 'utf-8');
        const parsed = JSON.parse(raw);
        this.cachedCatalog = parsed;
        this.isLoaded = true;
        return parsed;
      } catch (err) {
        console.error('Failed to parse catalog.json; re-initializing clean index:', err);
      }
    }

    // Initialize clean index
    const initialIndex: ArchiveCatalogIndex = {
      version: '1.0.0-phase1-archive',
      lastUpdated: new Date().toISOString(),
      totalScenes: 0,
      scenes: {},
      hashIndex: {}
    };

    await this.saveCatalog(initialIndex);
    this.cachedCatalog = initialIndex;
    this.isLoaded = true;
    return initialIndex;
  }

  /**
   * Atomically saves the catalog index to disk using a temporary file.
   */
  public static async saveCatalog(catalog: ArchiveCatalogIndex): Promise<void> {
    await ArchiveConfig.ensureDirectories();
    const catalogPath = ArchiveConfig.getCatalogFilePath();
    const tempPath = `${catalogPath}.tmp_${Date.now()}`;

    catalog.lastUpdated = new Date().toISOString();
    catalog.totalScenes = Object.keys(catalog.scenes).length;

    const payload = JSON.stringify(catalog, null, 2);
    await fs.promises.writeFile(tempPath, payload, 'utf-8');
    await fs.promises.rename(tempPath, catalogPath);

    this.cachedCatalog = catalog;
    this.isLoaded = true;
  }

  /**
   * Checks if a file hash already exists in the catalog (O(1) deduplication).
   */
  public static async getSceneByHash(fileHash: string): Promise<SceneRecord | null> {
    const catalog = await this.loadCatalog();
    const sceneId = catalog.hashIndex[fileHash];
    if (sceneId && catalog.scenes[sceneId]) {
      return catalog.scenes[sceneId];
    }
    return null;
  }

  /**
   * Retrieves a scene by its stable sceneId.
   */
  public static async getSceneById(sceneId: string): Promise<SceneRecord | null> {
    const catalog = await this.loadCatalog();
    return catalog.scenes[sceneId] || null;
  }

  /**
   * Adds or updates a scene incrementally (CORE Phase 1 requirement).
   * Does NOT rebuild the entire archive index.
   */
  public static async addScene(scene: SceneRecord): Promise<void> {
    const catalog = await this.loadCatalog();
    
    // Register scene in main map and hash index
    catalog.scenes[scene.sceneId] = scene;
    catalog.hashIndex[scene.fileHash] = scene.sceneId;

    // Save individual provenance file to data/provenance/<sceneId>_provenance.json
    try {
      const dirs = ArchiveConfig.getDirectories();
      const provPath = path.join(dirs.provenanceDir, `${scene.sceneId}_provenance.json`);
      await fs.promises.writeFile(provPath, JSON.stringify(scene.provenance, null, 2), 'utf-8');
    } catch (provErr) {
      console.warn(`Could not write provenance record for ${scene.sceneId}:`, provErr);
    }

    await this.saveCatalog(catalog);
  }

  /**
   * Removes a scene from the catalog.
   */
  public static async removeScene(sceneId: string): Promise<boolean> {
    const catalog = await this.loadCatalog();
    const scene = catalog.scenes[sceneId];
    if (!scene) return false;

    delete catalog.scenes[sceneId];
    delete catalog.hashIndex[scene.fileHash];

    await this.saveCatalog(catalog);
    return true;
  }

  /**
   * Retrieves all scenes in the archive.
   */
  public static async getAllScenes(): Promise<SceneRecord[]> {
    const catalog = await this.loadCatalog();
    return Object.values(catalog.scenes);
  }

  /**
   * Queries and filters scenes from the catalog.
   */
  public static async queryScenes(filters: SceneQueryFilters): Promise<{
    total: number;
    scenes: SceneRecord[];
    offset: number;
    limit: number;
  }> {
    const catalog = await this.loadCatalog();
    let items = Object.values(catalog.scenes);

    // 1. Text Search (sceneId or fileName)
    if (filters.search) {
      const term = filters.search.toLowerCase().trim();
      items = items.filter(s => 
        s.fileName.toLowerCase().includes(term) ||
        s.sceneId.toLowerCase().includes(term) ||
        s.sensor.toLowerCase().includes(term) ||
        s.satellite.toLowerCase().includes(term)
      );
    }

    // 2. Modality Filter
    if (filters.modality && filters.modality !== 'all') {
      items = items.filter(s => s.modality === filters.modality);
    }

    // 3. Sensor Filter
    if (filters.sensor && filters.sensor !== 'all') {
      const sLower = filters.sensor.toLowerCase();
      items = items.filter(s => s.sensor.toLowerCase().includes(sLower));
    }

    // 4. Satellite Filter
    if (filters.satellite && filters.satellite !== 'all') {
      const satLower = filters.satellite.toLowerCase();
      items = items.filter(s => s.satellite.toLowerCase().includes(satLower));
    }

    // 5. Georeferenced Status Filter
    if (filters.hasCrs !== undefined) {
      items = items.filter(s => {
        const isGeo = s.crs !== null && s.crs !== 'unavailable' && s.quality.georeferencingStatus === 'AVAILABLE';
        return filters.hasCrs ? isGeo : !isGeo;
      });
    }

    // 6. Format Filter
    if (filters.format && filters.format !== 'all') {
      items = items.filter(s => s.format === filters.format);
    }

    // 7. Status Filter
    if (filters.status) {
      items = items.filter(s => s.status === filters.status);
    }

    // 8. Date Range
    if (filters.startDate) {
      const start = new Date(filters.startDate).getTime();
      items = items.filter(s => s.acquisitionDate ? new Date(s.acquisitionDate).getTime() >= start : false);
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate).getTime();
      items = items.filter(s => s.acquisitionDate ? new Date(s.acquisitionDate).getTime() <= end : false);
    }

    // Sorting
    const sortBy = filters.sortBy || 'ingestedAt';
    const sortOrder = filters.sortOrder || 'desc';

    items.sort((a, b) => {
      let valA: any = a[sortBy] || '';
      let valB: any = b[sortBy] || '';
      if (sortOrder === 'desc') {
        return valB > valA ? 1 : valB < valA ? -1 : 0;
      }
      return valA > valB ? 1 : valA < valB ? -1 : 0;
    });

    const total = items.length;
    const offset = filters.offset || 0;
    const limit = filters.limit || 50;
    const paged = items.slice(offset, offset + limit);

    return {
      total,
      scenes: paged,
      offset,
      limit
    };
  }

  /**
   * Computes accurate archive statistics.
   */
  public static async getStats(): Promise<ArchiveStats> {
    const catalog = await this.loadCatalog();
    const scenes = Object.values(catalog.scenes);

    const stats: ArchiveStats = {
      totalScenes: scenes.length,
      readyCount: 0,
      processingCount: 0,
      failedCount: 0,
      totalBytes: 0,
      byModality: {
        optical: 0,
        sar: 0,
        multispectral: 0,
        unknown: 0
      },
      byFormat: {},
      georeferencedCount: 0,
      unreferencedCount: 0,
      lastIngestionTimestamp: null
    };

    for (const s of scenes) {
      if (s.status === 'READY') stats.readyCount++;
      else if (s.status === 'PROCESSING') stats.processingCount++;
      else if (s.status === 'FAILED') stats.failedCount++;

      stats.totalBytes += s.fileSizeBytes || 0;

      // Modality tally
      const mod = s.modality || 'unknown';
      stats.byModality[mod] = (stats.byModality[mod] || 0) + 1;

      // Format tally
      stats.byFormat[s.format] = (stats.byFormat[s.format] || 0) + 1;

      // Georeferenced tally
      if (s.crs && s.crs !== 'unavailable' && s.quality?.georeferencingStatus === 'AVAILABLE') {
        stats.georeferencedCount++;
      } else {
        stats.unreferencedCount++;
      }

      // Latest timestamp
      if (!stats.lastIngestionTimestamp || s.ingestedAt > stats.lastIngestionTimestamp) {
        stats.lastIngestionTimestamp = s.ingestedAt;
      }
    }

    return stats;
  }

  /**
   * Resets the in-memory cache (useful for testing).
   */
  public static clearCache(): void {
    this.cachedCatalog = null;
    this.isLoaded = false;
  }
}
