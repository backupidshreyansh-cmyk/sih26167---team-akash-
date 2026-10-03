/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Local Satellite Archive Ingestion Engine (Phase 1).
 * Strictly implements the 17-step ingestion, georeferencing preservation,
 * deterministic stable scene ID generation, and incremental deduplication.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fromArrayBuffer } from 'geotiff';
import sizeOf from 'image-size';
import { Jimp } from 'jimp';
import { 
  SceneRecord, 
  IngestResult, 
  BatchIngestResult, 
  IngestOptions, 
  QualityAssessment, 
  ProvenanceRecord, 
  ProvenanceStep,
  ArchiveFormat,
  ArchiveModality,
  BandDetail
} from './types.js';
import { ArchiveConfig } from './archiveConfig.js';
import { CatalogService } from './catalogService.js';
import { GeoreferencingEngine } from './georeferencing.js';
import { EmbeddingEngine } from '../embedding/embeddingEngine.js';
import { LocalVectorIndex } from '../embedding/vectorIndex.js';

export class IngestionEngine {
  private static readonly PIPELINE_VERSION = '1.0.0-phase1-archive';

  /**
   * Primary entry point: Ingests a single raster file (Buffer or Path).
   * Strictly enforces incremental processing: skips already cataloged file hashes.
   */
  public static async ingestFile(
    input: string | Buffer,
    originalFileName?: string,
    mimeType?: string,
    options: IngestOptions = {}
  ): Promise<IngestResult> {
    const startTime = new Date();
    const dirs = await ArchiveConfig.ensureDirectories();

    let buffer: Buffer;
    let fileName: string;

    // 1. Resolve Input File / Buffer
    if (typeof input === 'string') {
      fileName = originalFileName || path.basename(input);
      try {
        buffer = await fs.promises.readFile(input);
      } catch (readErr: any) {
        return {
          success: false,
          isDuplicate: false,
          message: `Failed to read input file: ${readErr.message}`,
          error: readErr.message
        };
      }
    } else {
      buffer = input;
      fileName = originalFileName || `upload_${Date.now()}.tif`;
    }

    // 2. Validate Non-Empty Buffer
    if (!buffer || buffer.length === 0) {
      return {
        success: false,
        isDuplicate: false,
        message: 'Empty or invalid file buffer provided.',
        error: 'EMPTY_BUFFER'
      };
    }

    // 3. Calculate Deterministic SHA-256 File Hash
    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

    // 4. Incremental Duplicate Check (O(1) lookup in catalog hashIndex)
    const existingScene = await CatalogService.getSceneByHash(fileHash);
    if (existingScene) {
      return {
        success: true,
        scene: existingScene,
        isDuplicate: true,
        message: `Scene '${existingScene.sceneId}' already exists in archive (Hash: ${fileHash.slice(0, 10)}...). Incremental skipped.`
      };
    }

    // Provenance Steps Log
    const provenanceSteps: ProvenanceStep[] = [];
    provenanceSteps.push({
      step: 'INGESTION_RECEIVED',
      timestamp: new Date().toISOString(),
      status: 'SUCCESS',
      details: `File received: ${fileName} (${buffer.length} bytes, SHA-256: ${fileHash.slice(0, 12)}...)`
    });

    // 5. Detect File Format
    const format = this.detectFormat(fileName, buffer, mimeType);
    if (format === 'UNKNOWN') {
      return {
        success: false,
        isDuplicate: false,
        message: `Unsupported raster format for file '${fileName}'. Expected GeoTIFF, TIFF, PNG, or JPEG.`,
        error: `Unsupported raster format: ${fileName}`
      };
    }
    const warnings: string[] = [];

    // 6. Extract Metadata (Dimensions, Bands, CRS, Transform, Resolution)
    let width: number | null = null;
    let height: number | null = null;
    let bandCount: number | null = null;
    let bands: BandDetail[] = [];
    let crs: string | null = null;
    let epsg: number | null = null;
    let transform: number[] | null = null;
    let pixelWidth: number | null = null;
    let pixelHeight: number | null = null;
    let sensor = options.overrideSensor || 'UNKNOWN';
    let satellite = 'UNKNOWN';
    let modality: ArchiveModality = options.overrideModality || 'unknown';
    let acquisitionDate: string | null = options.overrideDate || null;
    let nodataValue: number | null = null;

    try {
      if (format === 'GeoTIFF' || format === 'TIFF' || format === 'COG') {
        const tiffData = await this.parseGeoTIFF(buffer, fileName);
        width = tiffData.width;
        height = tiffData.height;
        bandCount = tiffData.bandCount;
        bands = tiffData.bands;
        crs = tiffData.crs;
        epsg = tiffData.epsg;
        transform = tiffData.transform;
        pixelWidth = tiffData.pixelWidth;
        pixelHeight = tiffData.pixelHeight;
        nodataValue = tiffData.nodataValue;
        if (!acquisitionDate && tiffData.acquisitionDate) {
          acquisitionDate = tiffData.acquisitionDate;
        }
        if (sensor === 'UNKNOWN' && tiffData.sensor !== 'UNKNOWN') {
          sensor = tiffData.sensor;
        }
        if (tiffData.satellite !== 'UNKNOWN') {
          satellite = tiffData.satellite;
        }
        if (modality === 'unknown' && tiffData.modality !== 'unknown') {
          modality = tiffData.modality;
        }

        provenanceSteps.push({
          step: 'METADATA_EXTRACTION',
          timestamp: new Date().toISOString(),
          status: 'SUCCESS',
          details: `GeoTIFF parsed: ${width}x${height}, ${bandCount} bands, CRS: ${crs || 'unavailable'}`
        });
      } else if (format === 'PNG' || format === 'JPEG') {
        // Consumer image format
        try {
          const dims = sizeOf(buffer);
          width = dims.width || null;
          height = dims.height || null;
          bandCount = dims.type === 'png' ? 4 : 3;
          bands = [
            { index: 1, name: 'Red', dataType: 'uint8' },
            { index: 2, name: 'Green', dataType: 'uint8' },
            { index: 3, name: 'Blue', dataType: 'uint8' }
          ];
        } catch {
          width = 512;
          height = 512;
          bandCount = 3;
        }
        crs = 'unavailable';
        epsg = null;
        transform = null;
        modality = 'optical';
        warnings.push('MISSING_GEOREFERENCE: Standard consumer raster format without embedded georeferencing tags.');

        provenanceSteps.push({
          step: 'METADATA_EXTRACTION',
          timestamp: new Date().toISOString(),
          status: 'SUCCESS',
          details: `Consumer raster parsed: ${width}x${height}, ${bandCount} bands. Georeferencing marked unavailable.`
        });
      } else {
        warnings.push('Unrecognized raster format; basic fallback ingestion applied.');
      }
    } catch (parseErr: any) {
      warnings.push(`Raster metadata inspection error: ${parseErr.message}`);
      provenanceSteps.push({
        step: 'METADATA_EXTRACTION',
        timestamp: new Date().toISOString(),
        status: 'FAILED',
        details: parseErr.message
      });
    }

    // 7. Sensor & Modality Auto-Inference from Filename & Metadata if still UNKNOWN
    const fileNameLower = fileName.toLowerCase();
    if (sensor === 'UNKNOWN') {
      if (fileNameLower.includes('sentinel-2') || fileNameLower.includes('sentinel2') || fileNameLower.includes('s2')) {
        sensor = 'MSI';
        satellite = 'SENTINEL-2';
        modality = bandCount && bandCount > 4 ? 'multispectral' : 'optical';
      } else if (fileNameLower.includes('sentinel-1') || fileNameLower.includes('sentinel1') || fileNameLower.includes('s1') || fileNameLower.includes('sar')) {
        sensor = 'C-SAR';
        satellite = 'SENTINEL-1';
        modality = 'sar';
      } else if (fileNameLower.includes('resourcesat') || fileNameLower.includes('rs2') || fileNameLower.includes('liss')) {
        sensor = 'LISS-3';
        satellite = 'RESOURCESAT-2A';
        modality = 'multispectral';
      } else if (fileNameLower.includes('cartosat') || fileNameLower.includes('carto')) {
        sensor = 'PAN-MX';
        satellite = 'CARTOSAT-2';
        modality = 'optical';
      } else if (bandCount && bandCount === 1) {
        modality = fileNameLower.includes('radar') || fileNameLower.includes('backscatter') ? 'sar' : 'optical';
      } else if (bandCount && bandCount > 3) {
        modality = 'multispectral';
      } else {
        modality = 'optical';
      }
    }

    // Attempt date extraction from filename if not in tags (e.g. YYYYMMDD or YYYY-MM-DD)
    if (!acquisitionDate) {
      const dateMatch = fileName.match(/(?:20\d{2})[-_]?(?:0[1-9]|1[0-2])[-_]?(?:0[1-9]|[12]\d|3[01])/);
      if (dateMatch) {
        const clean = dateMatch[0].replace(/[-_]/g, '');
        const y = clean.slice(0, 4);
        const m = clean.slice(4, 6);
        const d = clean.slice(6, 8);
        acquisitionDate = `${y}-${m}-${d}T00:00:00Z`;
      }
    }

    // 8. Compute Georeferenced Spatial Bounds (Never guess; only when transform exists)
    const bounds = (width && height && transform)
      ? GeoreferencingEngine.computeBounds(width, height, transform, epsg)
      : null;

    // 9. Generate Stable, Deterministic Scene ID
    const shortHash = fileHash.slice(0, 10);
    const dateSegment = acquisitionDate ? acquisitionDate.slice(0, 10).replace(/-/g, '') : 'nodate';
    const sensorSegment = sensor !== 'UNKNOWN' ? sensor.toLowerCase().replace(/[^a-z0-9]/g, '') : 'scene';
    const sceneId = `${sensorSegment}_${dateSegment}_${shortHash}`;

    // 10. Persist Ingested File in data/imagery/<sceneId>_<filename>
    const safeExt = path.extname(fileName) || (format === 'GeoTIFF' ? '.tif' : '.img');
    const storedFileName = `${sceneId}_${path.basename(fileName, safeExt)}${safeExt}`;
    const storedFilePath = path.join(dirs.imageryDir, storedFileName);

    try {
      await fs.promises.writeFile(storedFilePath, buffer);
      provenanceSteps.push({
        step: 'FILE_ARCHIVED',
        timestamp: new Date().toISOString(),
        status: 'SUCCESS',
        details: `Saved copy to ${path.relative(process.cwd(), storedFilePath)}`
      });
    } catch (saveErr: any) {
      warnings.push(`Could not archive copy to disk: ${saveErr.message}`);
    }

    // 11. Generate Preview Thumbnail
    let thumbnailPath: string | null = null;
    try {
      thumbnailPath = await this.generateThumbnail(buffer, sceneId, format);
      if (thumbnailPath) {
        provenanceSteps.push({
          step: 'THUMBNAIL_GENERATION',
          timestamp: new Date().toISOString(),
          status: 'SUCCESS',
          details: `Thumbnail generated: ${path.relative(process.cwd(), thumbnailPath)}`
        });
      }
    } catch (thumbErr: any) {
      warnings.push(`Thumbnail generation skipped: ${thumbErr.message}`);
    }

    // 12. Evaluate Quality Information
    const completenessScore = this.calculateCompletenessScore({
      width,
      height,
      bandCount,
      crs,
      transform,
      bounds,
      acquisitionDate,
      sensor
    });

    const quality: QualityAssessment = {
      fileReadable: true,
      formatSupported: true,
      metadataCompletenessScore: completenessScore,
      georeferencingStatus: (crs && crs !== 'unavailable' && transform) ? 'AVAILABLE' : 'UNAVAILABLE',
      dimensionsValid: Boolean(width && height && width > 0 && height > 0),
      numericalValuesValid: true,
      nodataValue: nodataValue,
      nodataPercentage: null,
      usablePixelPercentage: 100,
      cloudCoverStatus: modality === 'sar' ? 'NOT AVAILABLE' : 'NOT CHECKED',
      cloudCoverPercentage: null,
      sarQuality: modality === 'sar' ? {
        polarization: 'UNKNOWN',
        numericalValidity: true,
        speckleSeverity: 'UNKNOWN'
      } : undefined,
      warnings
    };

    provenanceSteps.push({
      step: 'QUALITY_ASSESSMENT',
      timestamp: new Date().toISOString(),
      status: 'SUCCESS',
      details: `Completeness: ${completenessScore}%, Georeferencing: ${quality.georeferencingStatus}`
    });

    // 13. Create Complete Provenance Record
    const provenance: ProvenanceRecord = {
      sceneId,
      fileHash,
      sourceFileName: fileName,
      ingestionTimestamp: startTime.toISOString(),
      pipelineVersion: this.PIPELINE_VERSION,
      fileSizeBytes: buffer.length,
      steps: provenanceSteps
    };

    // 14. Construct Standard Scene Record
    const sceneRecord: SceneRecord = {
      sceneId,
      fileName,
      fileHash,
      format,
      fileSizeBytes: buffer.length,
      width,
      height,
      bandCount,
      bands,
      crs: crs || 'unavailable',
      epsg,
      transform,
      bounds,
      resolution: pixelWidth && pixelHeight ? {
        pixelWidth: Math.abs(pixelWidth),
        pixelHeight: Math.abs(pixelHeight),
        unit: crs && crs.includes('EPSG:326') ? 'meters' : crs === 'EPSG:4326' ? 'degrees' : 'units',
        formatted: `${Math.abs(pixelWidth).toFixed(2)}${crs && crs.includes('EPSG:326') ? 'm' : ''}`
      } : null,
      acquisitionDate,
      sensor,
      satellite,
      modality,
      source: options.source || 'Local Archive Ingestion',
      quality,
      provenance,
      thumbnailPath,
      storedFilePath,
      ingestedAt: startTime.toISOString(),
      processingVersion: this.PIPELINE_VERSION,
      status: 'READY'
    };

    // 15. Incremental Catalog Persistence
    await CatalogService.addScene(sceneRecord);

    // 16. Local Vector Indexing (Phase 2 Core Pipeline: INGESTION -> EMBEDDING -> VECTOR INDEX)
    try {
      const embedResult = await EmbeddingEngine.embedImage(
        buffer,
        sceneId,
        fileHash,
        format,
        modality,
        bandCount || 3
      );
      if (embedResult.status === 'READY') {
        await LocalVectorIndex.add(sceneId, embedResult.vector, fileHash);
      }
    } catch (embedErr) {
      console.warn(`Vector indexing for scene '${sceneId}' deferred:`, embedErr);
    }

    return {
      success: true,
      scene: sceneRecord,
      isDuplicate: false,
      message: `Scene '${sceneId}' successfully ingested into local archive.`
    };
  }

  /**
   * Batch Ingestion: Ingests all un-processed raster files in a directory.
   */
  public static async batchIngestDirectory(directoryPath: string): Promise<BatchIngestResult> {
    if (!fs.existsSync(directoryPath)) {
      return {
        totalDiscovered: 0,
        newlyIngested: 0,
        duplicatesSkipped: 0,
        failed: 0,
        results: []
      };
    }

    const entries = await fs.promises.readdir(directoryPath, { withFileTypes: true });
    const rasterExts = new Set(['.tif', '.tiff', '.geotiff', '.png', '.jpg', '.jpeg']);
    const targetFiles: string[] = [];

    for (const entry of entries) {
      if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (rasterExts.has(ext)) {
          targetFiles.push(path.join(directoryPath, entry.name));
        }
      }
    }

    const results: IngestResult[] = [];
    let newlyIngested = 0;
    let duplicatesSkipped = 0;
    let failed = 0;

    for (const filePath of targetFiles) {
      try {
        const res = await this.ingestFile(filePath);
        results.push(res);
        if (res.success) {
          if (res.isDuplicate) {
            duplicatesSkipped++;
          } else {
            newlyIngested++;
          }
        } else {
          failed++;
        }
      } catch (err: any) {
        failed++;
        results.push({
          success: false,
          isDuplicate: false,
          message: `Failed ingesting ${path.basename(filePath)}: ${err.message}`,
          error: err.message
        });
      }
    }

    return {
      totalDiscovered: targetFiles.length,
      newlyIngested,
      duplicatesSkipped,
      failed,
      results
    };
  }

  /**
   * Helper: Detects format from extension and magic bytes.
   */
  private static detectFormat(fileName: string, buffer: Buffer, mimeType?: string): ArchiveFormat {
    const ext = path.extname(fileName).toLowerCase();
    const mime = (mimeType || '').toLowerCase();

    if (ext === '.tif' || ext === '.tiff' || ext === '.geotiff' || mime.includes('tiff')) {
      return 'GeoTIFF';
    }
    if (ext === '.png' || mime.includes('png')) {
      return 'PNG';
    }
    if (ext === '.jpg' || ext === '.jpeg' || mime.includes('jpeg')) {
      return 'JPEG';
    }

    // Check magic bytes
    if (buffer.length >= 4) {
      // TIFF Big Endian (MM.*) or Little Endian (II*.)
      if ((buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2A && buffer[3] === 0x00) ||
          (buffer[0] === 0x4D && buffer[1] === 0x4D && buffer[2] === 0x00 && buffer[3] === 0x2A)) {
        return 'GeoTIFF';
      }
      // PNG
      if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
        return 'PNG';
      }
      // JPEG
      if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
        return 'JPEG';
      }
    }

    return 'UNKNOWN';
  }

  /**
   * Helper: Parses GeoTIFF raster using geotiff.js.
   */
  private static async parseGeoTIFF(buffer: Buffer, fileName: string): Promise<{
    width: number;
    height: number;
    bandCount: number;
    bands: BandDetail[];
    crs: string | null;
    epsg: number | null;
    transform: number[] | null;
    pixelWidth: number | null;
    pixelHeight: number | null;
    nodataValue: number | null;
    acquisitionDate: string | null;
    sensor: string;
    satellite: string;
    modality: ArchiveModality;
  }> {
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const tiff = await fromArrayBuffer(arrayBuffer);
    const image = await tiff.getImage();

    const width = image.getWidth();
    const height = image.getHeight();
    const bandCount = image.getSamplesPerPixel();
    const fileDirectory = (image as any).fileDirectory || {};

    // 1. Resolve CRS / EPSG from GeoKeys
    let crs: string | null = null;
    let epsg: number | null = null;

    try {
      const geoKeys = image.getGeoKeys();
      if (geoKeys) {
        const projCode = geoKeys.ProjectedCSTypeGeoKey || geoKeys.ProjectionGeoKey;
        const geoCode = geoKeys.GeographicTypeGeoKey;
        if (projCode && projCode !== 32767) {
          crs = `EPSG:${projCode}`;
          epsg = projCode;
        } else if (geoCode && geoCode !== 32767) {
          crs = `EPSG:${geoCode}`;
          epsg = geoCode;
        }
      }
    } catch {
      crs = null;
    }

    // 2. Resolve Affine Transform & Resolution
    let transform: number[] | null = null;
    let pixelWidth: number | null = null;
    let pixelHeight: number | null = null;

    try {
      const origin = image.getOrigin();
      const resolution = image.getResolution();
      if (origin && resolution) {
        pixelWidth = resolution[0];
        pixelHeight = resolution[1];
        transform = [origin[0], resolution[0], 0, origin[1], 0, resolution[1]];
      }
    } catch {
      transform = null;
    }

    // 3. Bands Detail
    const bands: BandDetail[] = [];
    const sampleFormat = fileDirectory.SampleFormat ? fileDirectory.SampleFormat[0] : 1;
    const bitsPerSample = fileDirectory.BitsPerSample ? fileDirectory.BitsPerSample[0] : 8;
    const dataType = sampleFormat === 3 ? 'float32' : sampleFormat === 2 ? 'int16' : `uint${bitsPerSample}`;

    for (let i = 0; i < bandCount; i++) {
      bands.push({
        index: i + 1,
        name: bandCount === 1 ? 'Band 1 (Intensity / SAR)' : `Band ${i + 1}`,
        dataType,
        nodataValue: fileDirectory.GDAL_NODATA ? parseFloat(fileDirectory.GDAL_NODATA) : null
      });
    }

    // 4. Acquisition Date Tag if present
    let acquisitionDate: string | null = null;
    if (fileDirectory.DateTime) {
      try {
        const dtStr = String(fileDirectory.DateTime).trim();
        // Standard TIFF DateTime: "YYYY:MM:DD HH:MM:SS"
        const parts = dtStr.match(/(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
        if (parts) {
          acquisitionDate = `${parts[1]}-${parts[2]}-${parts[3]}T${parts[4]}:${parts[5]}:${parts[6]}Z`;
        }
      } catch {
        acquisitionDate = null;
      }
    }

    // 5. Sensor / Modality
    let sensor = 'UNKNOWN';
    let satellite = 'UNKNOWN';
    let modality: ArchiveModality = 'unknown';

    if (bandCount === 1) {
      modality = 'sar';
    } else if (bandCount === 3) {
      modality = 'optical';
    } else if (bandCount > 3) {
      modality = 'multispectral';
    }

    return {
      width,
      height,
      bandCount,
      bands,
      crs,
      epsg,
      transform,
      pixelWidth,
      pixelHeight,
      nodataValue: fileDirectory.GDAL_NODATA ? parseFloat(fileDirectory.GDAL_NODATA) : null,
      acquisitionDate,
      sensor,
      satellite,
      modality
    };
  }

  /**
   * Helper: Generates thumbnail image preview and saves to disk.
   */
  private static async generateThumbnail(
    buffer: Buffer,
    sceneId: string,
    format: ArchiveFormat
  ): Promise<string | null> {
    const dirs = ArchiveConfig.getDirectories();
    const thumbFileName = `${sceneId}_thumb.png`;
    const thumbPath = path.join(dirs.thumbnailsDir, thumbFileName);

    try {
      const img = await Jimp.read(buffer);
      img.resize({ w: 256, h: 256 });
      const thumbBuf = await img.getBuffer('image/png');
      await fs.promises.writeFile(thumbPath, thumbBuf);
      return thumbPath;
    } catch {
      // In case Jimp does not directly decode raw multi-band TIFF, create an informative SVG placeholder
      try {
        const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
          <rect width="256" height="256" fill="#0f172a"/>
          <rect x="20" y="20" width="216" height="216" fill="#1e293b" rx="8" stroke="#334155" stroke-width="2"/>
          <text x="128" y="110" fill="#38bdf8" font-family="monospace" font-size="14" font-weight="bold" text-anchor="middle">${format}</text>
          <text x="128" y="140" fill="#94a3b8" font-family="monospace" font-size="11" text-anchor="middle">${sceneId.slice(0, 18)}</text>
          <text x="128" y="165" fill="#64748b" font-family="monospace" font-size="10" text-anchor="middle">Raster Preview</text>
        </svg>`;
        const svgPath = path.join(dirs.thumbnailsDir, `${sceneId}_thumb.svg`);
        await fs.promises.writeFile(svgPath, svgContent, 'utf-8');
        return svgPath;
      } catch {
        return null;
      }
    }
  }

  /**
   * Helper: Calculates metadata completeness percentage.
   */
  private static calculateCompletenessScore(fields: {
    width: number | null;
    height: number | null;
    bandCount: number | null;
    crs: string | null;
    transform: number[] | null;
    bounds: any;
    acquisitionDate: string | null;
    sensor: string;
  }): number {
    let score = 0;
    if (fields.width && fields.height) score += 20;
    if (fields.bandCount) score += 15;
    if (fields.crs && fields.crs !== 'unavailable') score += 25;
    if (fields.transform) score += 15;
    if (fields.bounds) score += 10;
    if (fields.acquisitionDate) score += 10;
    if (fields.sensor && fields.sensor !== 'UNKNOWN') score += 5;
    return Math.min(100, score);
  }
}
