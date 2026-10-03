/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Local Satellite Archive Foundation - Type Definitions (Phase 1).
 * Strictly enforces honest metadata:
 * - Does not invent georeferencing or coordinates
 * - Populates only verified values or flags as "unavailable"
 * - Maintains comprehensive provenance and quality information
 */

export type ArchiveFormat = 'GeoTIFF' | 'TIFF' | 'COG' | 'PNG' | 'JPEG' | 'UNKNOWN';
export type ArchiveModality = 'optical' | 'sar' | 'multispectral' | 'unknown';
export type ArchiveSceneStatus = 'READY' | 'PROCESSING' | 'FAILED';

export interface BandDetail {
  index: number;
  name: string;
  dataType: string;
  min?: number | null;
  max?: number | null;
  mean?: number | null;
  stdDev?: number | null;
  nodataValue?: number | null;
  wavelengthNm?: number | null;
}

export interface GeoreferenceBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  // Geographic coordinates when available (WGS84)
  minLng?: number | null;
  minLat?: number | null;
  maxLng?: number | null;
  maxLat?: number | null;
}

export interface QualityAssessment {
  fileReadable: boolean;
  formatSupported: boolean;
  metadataCompletenessScore: number; // 0 - 100 percentage
  georeferencingStatus: 'AVAILABLE' | 'UNAVAILABLE';
  dimensionsValid: boolean;
  numericalValuesValid: boolean;
  nodataValue: number | null;
  nodataPercentage: number | null;
  usablePixelPercentage: number | null;
  
  // Optical quality fields
  cloudCoverStatus: 'IMPLEMENTED' | 'NOT AVAILABLE' | 'NOT CHECKED';
  cloudCoverPercentage: number | null;

  // SAR quality fields
  sarQuality?: {
    polarization: string;
    speckleSeverity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
    numericalValidity: boolean;
    enl?: number;
  };

  warnings: string[];
}

export interface ProvenanceStep {
  step: string;
  timestamp: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  details?: string;
  tool?: string;
}

export interface ProvenanceRecord {
  sceneId: string;
  fileHash: string;
  sourceFileName: string;
  ingestionTimestamp: string;
  pipelineVersion: string;
  fileSizeBytes: number;
  steps: ProvenanceStep[];
}

export interface SceneRecord {
  sceneId: string;
  fileName: string;
  fileHash: string; // SHA-256
  format: ArchiveFormat;
  fileSizeBytes: number;
  width: number | null;
  height: number | null;
  bandCount: number | null;
  bands: BandDetail[];
  crs: string | null; // e.g. "EPSG:32643" or null / "unavailable"
  epsg: number | null;
  transform: number[] | null; // 6-element affine matrix [a, b, c, d, e, f]
  bounds: GeoreferenceBounds | null;
  resolution: {
    pixelWidth: number | null;
    pixelHeight: number | null;
    unit: string;
    formatted: string | null;
  } | null;
  acquisitionDate: string | null; // ISO-8601 if detected, otherwise null
  sensor: string; // e.g. "MSI", "LISS-3", "C-SAR", "UNKNOWN"
  satellite: string; // e.g. "SENTINEL-2", "RESOURCESAT-2A", "UNKNOWN"
  modality: ArchiveModality;
  source: string;
  quality: QualityAssessment;
  provenance: ProvenanceRecord;
  thumbnailPath: string | null;
  storedFilePath: string;
  ingestedAt: string; // ISO-8601
  processingVersion: string;
  status: ArchiveSceneStatus;
  rejectionReason?: string | null;
}

export interface ArchiveCatalogIndex {
  version: string;
  lastUpdated: string;
  totalScenes: number;
  scenes: Record<string, SceneRecord>; // Keyed by sceneId
  hashIndex: Record<string, string>;   // fileHash -> sceneId (for O(1) duplicate checks)
}

export interface ArchiveStats {
  totalScenes: number;
  readyCount: number;
  processingCount: number;
  failedCount: number;
  totalBytes: number;
  byModality: Record<ArchiveModality, number>;
  byFormat: Record<string, number>;
  georeferencedCount: number;
  unreferencedCount: number;
  lastIngestionTimestamp: string | null;
}

export interface IngestOptions {
  source?: string;
  overrideSensor?: string;
  overrideModality?: ArchiveModality;
  overrideDate?: string;
  generateThumbnail?: boolean;
}

export interface IngestResult {
  success: boolean;
  scene?: SceneRecord;
  isDuplicate: boolean;
  message: string;
  error?: string;
}

export interface BatchIngestResult {
  totalDiscovered: number;
  newlyIngested: number;
  duplicatesSkipped: number;
  failed: number;
  results: IngestResult[];
}

export interface SceneQueryFilters {
  search?: string;
  sensor?: string;
  satellite?: string;
  modality?: ArchiveModality | 'all';
  format?: ArchiveFormat | 'all';
  hasCrs?: boolean;
  startDate?: string;
  endDate?: string;
  status?: ArchiveSceneStatus;
  limit?: number;
  offset?: number;
  sortBy?: 'ingestedAt' | 'acquisitionDate' | 'fileName';
  sortOrder?: 'asc' | 'desc';
}
