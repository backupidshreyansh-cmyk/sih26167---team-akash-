/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Express Router for Local Satellite Archive Foundation (Phase 1).
 * Ingestion, catalog management, scene inspection, and provenance endpoints.
 */

import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { IngestionEngine } from '../archive/ingestionEngine.js';
import { CatalogService } from '../archive/catalogService.js';
import { ArchiveConfig } from '../archive/archiveConfig.js';
import { SceneQueryFilters } from '../archive/types.js';

export const archiveRouter = Router();

// 1. Ingest Scene (Base64 raster payload or local file path)
archiveRouter.post('/ingest', async (req, res) => {
  try {
    const { base64Data, filePath, fileName, mimeType, options } = req.body;

    if (!base64Data && !filePath) {
      return res.status(400).json({ error: 'Either base64Data or filePath must be provided.' });
    }

    let input: Buffer | string;
    if (base64Data) {
      const clean = base64Data.replace(/^data:[^;]+;base64,/, '');
      input = Buffer.from(clean, 'base64');
    } else {
      input = filePath;
    }

    const result = await IngestionEngine.ingestFile(input, fileName, mimeType, options);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    console.error('Archive Ingestion Error:', error);
    res.status(500).json({ error: error.message || 'Failed to ingest raster.' });
  }
});

// 2. Batch Ingest Directory
archiveRouter.post('/batch-ingest', async (req, res) => {
  try {
    const { directoryPath } = req.body;
    const targetDir = directoryPath || path.join(ArchiveConfig.getRootDir(), 'incoming');

    const result = await IngestionEngine.batchIngestDirectory(targetDir);
    return res.json(result);
  } catch (error: any) {
    console.error('Archive Batch Ingest Error:', error);
    res.status(500).json({ error: error.message || 'Failed to batch ingest directory.' });
  }
});

// 3. Query / List Archive Scenes
archiveRouter.get('/scenes', async (req, res) => {
  try {
    const { 
      search, 
      sensor, 
      satellite, 
      modality, 
      format, 
      hasCrs, 
      startDate, 
      endDate, 
      status,
      limit, 
      offset,
      sortBy,
      sortOrder
    } = req.query;

    const filters: SceneQueryFilters = {
      search: search as string,
      sensor: sensor as string,
      satellite: satellite as string,
      modality: modality as any,
      format: format as any,
      hasCrs: hasCrs !== undefined ? hasCrs === 'true' : undefined,
      startDate: startDate as string,
      endDate: endDate as string,
      status: status as any,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0,
      sortBy: sortBy as any,
      sortOrder: sortOrder as any
    };

    const results = await CatalogService.queryScenes(filters);
    return res.json(results);
  } catch (error: any) {
    console.error('Archive Query Error:', error);
    res.status(500).json({ error: error.message || 'Failed to query archive scenes.' });
  }
});

// 4. Archive Statistics (Total, Ready, Failed, Modalities, Sensors)
archiveRouter.get('/stats', async (_req, res) => {
  try {
    const stats = await CatalogService.getStats();
    return res.json(stats);
  } catch (error: any) {
    console.error('Archive Stats Error:', error);
    res.status(500).json({ error: error.message || 'Failed to get archive stats.' });
  }
});

// 5. Get Single Scene Metadata & Quality
archiveRouter.get('/scenes/:sceneId', async (req, res) => {
  try {
    const { sceneId } = req.params;
    const scene = await CatalogService.getSceneById(sceneId);
    if (!scene) {
      return res.status(404).json({ error: `Scene '${sceneId}' not found in local archive.` });
    }
    return res.json(scene);
  } catch (error: any) {
    console.error('Archive Get Scene Error:', error);
    res.status(500).json({ error: error.message || 'Failed to get scene.' });
  }
});

// 6. Get Scene Provenance Audit Trail
archiveRouter.get('/scenes/:sceneId/provenance', async (req, res) => {
  try {
    const { sceneId } = req.params;
    const scene = await CatalogService.getSceneById(sceneId);
    if (!scene) {
      return res.status(404).json({ error: `Scene '${sceneId}' not found.` });
    }
    return res.json(scene.provenance);
  } catch (error: any) {
    console.error('Archive Provenance Error:', error);
    res.status(500).json({ error: error.message || 'Failed to get provenance.' });
  }
});

// 7. Get Scene Thumbnail Preview
archiveRouter.get('/scenes/:sceneId/thumbnail', async (req, res) => {
  try {
    const { sceneId } = req.params;
    const scene = await CatalogService.getSceneById(sceneId);
    if (!scene || !scene.thumbnailPath || !fs.existsSync(scene.thumbnailPath)) {
      return res.status(404).json({ error: 'Thumbnail not found for scene.' });
    }

    const ext = path.extname(scene.thumbnailPath).toLowerCase();
    const contentType = ext === '.svg' ? 'image/svg+xml' : 'image/png';
    res.setHeader('Content-Type', contentType);
    const stream = fs.createReadStream(scene.thumbnailPath);
    return stream.pipe(res);
  } catch (error: any) {
    console.error('Archive Thumbnail Error:', error);
    res.status(500).json({ error: error.message || 'Failed to serve thumbnail.' });
  }
});
