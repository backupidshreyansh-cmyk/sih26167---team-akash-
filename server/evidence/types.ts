/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Domain-specific type definitions for the Deterministic Remote-Sensing Evidence Engine.
 */

export type FailureState = 
  | 'INVALID_RASTER'
  | 'UNSUPPORTED_FORMAT'
  | 'MISSING_BANDS'
  | 'MISSING_GEOREFERENCE'
  | 'REGISTRATION_REQUIRED'
  | 'REGISTRATION_FAILED'
  | 'INSUFFICIENT_EVIDENCE'
  | 'EVIDENCE_CONFLICT'
  | 'PROCESSING_ERROR';

export type NormalizedBandId = 
  | 'COASTAL_AEROSOL'
  | 'BLUE'
  | 'GREEN'
  | 'RED'
  | 'RED_EDGE_1'
  | 'RED_EDGE_2'
  | 'NIR'
  | 'SWIR1'
  | 'SWIR2'
  | 'PAN'
  | 'SAR_VV'
  | 'SAR_VH'
  | 'SAR_HH'
  | 'SAR_HV'
  | 'SAR_INTENSITY'
  | 'UNKNOWN';

export type SARPolarization = 'VV' | 'VH' | 'HH' | 'HV' | 'VV/VH' | 'HH/HV' | 'UNKNOWN';

export interface RasterValidationResult {
  valid: boolean;
  format: string; // 'GeoTIFF' | 'PNG' | 'JPEG' | 'TIFF' | 'UNKNOWN'
  width: number | null;
  height: number | null;
  bands: number;
  dataType: string;
  crs: string | null;
  epsg: number | null;
  geotransform: number[] | null;
  bounds: [number, number, number, number] | null; // [minX, minY, maxX, maxY]
  pixelSize: [number, number] | null; // [pixelWidth, pixelHeight] in projection units
  readable: boolean;
  warnings: string[];
  failureState?: FailureState;
  error?: string;
}

export interface BandMetadata {
  index: number;
  normalizedId: NormalizedBandId;
  description?: string;
  wavelengthNm?: number;
  dataType?: string;
  isIdentified: boolean;
}

export interface BandStatistics {
  bandIndex: number;
  bandId: NormalizedBandId;
  min: number;
  max: number;
  mean: number;
  stdDev: number;
  validPixelPercentage: number;
  sampleCount: number;
}

export interface SpectralIndexResult {
  indexName: 'NDVI' | 'NDWI' | 'NDBI' | 'EVI' | 'SAVI' | string;
  formula: string;
  bandsUsed: { [key: string]: NormalizedBandId };
  status: 'CALCULATED' | 'REQUIRED_BANDS_UNAVAILABLE' | 'COMPUTATION_ERROR';
  statistics?: {
    min: number;
    max: number;
    mean: number;
    stdDev: number;
    validPixelPercentage: number;
  };
  details?: string;
  previewBase64?: string;
}

export interface OpticalCandidateRegion {
  id: string;
  category: 'VEGETATION_CANDIDATE' | 'WATER_CANDIDATE' | 'BUILT_UP_CANDIDATE' | 'HIGH_REFLECTANCE_CANDIDATE';
  pixelBounds: {
    ymin: number;
    xmin: number;
    ymax: number;
    xmax: number;
  };
  pixelCount: number;
  areaM2?: number;
  areaHectares?: number;
  meanReflectanceOrIndex: number;
  criterionDescription: string;
}

export interface OpticalEvidence {
  type: 'OPTICAL_EVIDENCE';
  hasTrueColorChannels: boolean;
  hasMultispectralNIR: boolean;
  identifiedBands: BandMetadata[];
  statistics: BandStatistics[];
  indices: SpectralIndexResult[];
  candidateRegions: OpticalCandidateRegion[];
  observations: string[];
  measurements: Record<string, number | string | boolean>;
  quality: {
    isLowContrast: boolean;
    isOverexposed: boolean;
    isUnderexposed: boolean;
    validPixelPercentage: number;
  };
  provenance: EvidenceProvenance;
}

export interface SAREvidence {
  type: 'SAR_EVIDENCE';
  polarization: SARPolarization;
  isSingleChannel: boolean;
  statistics: {
    min: number;
    max: number;
    mean: number;
    stdDev: number;
    estimatedENL: number; // Equivalent Number of Looks
    percentile95: number;
    percentile5: number;
  };
  speckleQuality: {
    enl: number;
    speckleSeverity: 'LOW' | 'MODERATE' | 'HIGH';
    dynamicRangeDb?: number;
  };
  candidateRegions: {
    id: string;
    type: 'HIGH_BACKSCATTER_DOUBLE_BOUNCE' | 'LOW_BACKSCATTER_SPECULAR';
    pixelBounds: { ymin: number; xmin: number; ymax: number; xmax: number };
    pixelCount: number;
    meanIntensity: number;
    areaM2?: number;
  }[];
  observations: string[];
  measurements: Record<string, number | string | boolean>;
  quality: {
    missingMetadata: boolean;
    hasCalibration: boolean;
    validPixelPercentage: number;
  };
  provenance: EvidenceProvenance;
}

export interface TemporalRegistrationResult {
  status: 'ALIGNED' | 'REGISTRATION_REQUIRED' | 'REGISTRATION_UNAVAILABLE' | 'INCOMPATIBLE_RASTERS';
  isDimensionCompatible: boolean;
  isCrsCompatible: boolean;
  isResolutionCompatible: boolean;
  dimensionDelta: { widthDiff: number; heightDiff: number };
  resolutionDelta?: { scaleDiffX: number; scaleDiffY: number };
  spatialOverlapFraction: number; // 0 to 1
  alignmentRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  warnings: string[];
}

export interface ChangeRegion {
  id: string;
  pixelBounds: {
    ymin: number;
    xmin: number;
    ymax: number;
    xmax: number;
  };
  pixelCount: number;
  areaM2?: number;
  areaHectares?: number;
  changeMagnitude: number; // mean absolute delta 0-255 or calibrated scale
  changeType: 'INCREASE' | 'DECREASE' | 'STRUCTURAL_DELTA' | 'UNKNOWN';
  source: 'DETERMINISTIC_CHANGE_ENGINE';
}

export interface BiTemporalChangeEvidence {
  type: 'BI_TEMPORAL_CHANGE_EVIDENCE';
  registration: TemporalRegistrationResult;
  meanAbsoluteDifference: number;
  relativeChangeFraction: number; // fraction of pixels changed
  candidateChangeDetected: boolean;
  detectedChangeRegions: ChangeRegion[];
  confounderChecks: {
    isGlobalIlluminationShift: boolean;
    illuminationShiftMagnitude: number;
    hasCloudOrShadowArtifact: boolean;
    hasResolutionMismatch: boolean;
    possibleConfounders: string[];
  };
  observations: string[];
  provenance: EvidenceProvenance;
}

export interface SpatialOverlapResult {
  hasCommonSpatialGrid: boolean;
  overlapAreaM2?: number;
  overlapPercentageA: number; // % of Image A covered by B
  overlapPercentageB: number; // % of Image B covered by A
  intersectionBounds?: [number, number, number, number];
  regionsCorresponding: {
    opticalRegionId: string;
    sarRegionId: string;
    overlapFraction: number;
    agreementType: 'CONFIRMING' | 'CONTRADICTING' | 'COMPLEMENTARY';
    notes: string;
  }[];
  agreementStatus: 'AGREEMENT' | 'CONFLICT' | 'COMPLEMENTARY' | 'INSUFFICIENT_DATA';
  details: string[];
}

export interface GroundedEvidenceRegion {
  id: string;
  classification: 'MODEL_PROPOSED_REGION' | 'MEASURED_EVIDENCE_REGION';
  label: string;
  pixelBounds: {
    ymin: number; // pixel coords
    xmin: number;
    ymax: number;
    xmax: number;
  };
  normalizedBounds: {
    ymin: number; // 0.0 - 1.0
    xmin: number;
    ymax: number;
    xmax: number;
  };
  geoBounds?: {
    minEasting: number;
    maxEasting: number;
    minNorthing: number;
    maxNorthing: number;
    crs: string;
    latLng?: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  };
  areaM2?: number;
  areaHectares?: number;
  regionStatistics?: {
    meanLuminance: number;
    stdDev: number;
    pixelCount: number;
  };
  attachedEvidenceNotes: string[];
}

export interface EvidenceProvenance {
  sourceFile: string;
  fileSizeBytes: number;
  fileSha256: string;
  tool: string;
  toolVersion: string;
  operation: string;
  parameters: Record<string, any>;
  timestamp: string;
}

export interface EvidenceGraphNode {
  id: string;
  type: 'CLAIM' | 'REQUIRED_EVIDENCE' | 'MEASURED_EVIDENCE' | 'SPATIAL_REGION' | 'TOOL_RESULT' | 'VERIFICATION_GATE' | 'DECISION';
  label: string;
  status: 'VERIFIED' | 'REFUTED' | 'UNAVAILABLE' | 'PENDING' | 'CONFLICT';
  data?: any;
  provenance?: EvidenceProvenance;
}

export interface EvidenceGraphEdge {
  from: string;
  to: string;
  relationship: 'REQUIRES' | 'PROVES' | 'MEASURED_BY' | 'LOCATED_AT' | 'VERIFIED_BY' | 'CONTRADICTS' | 'YIELDS';
}

export interface EvidenceGraph {
  nodes: EvidenceGraphNode[];
  edges: EvidenceGraphEdge[];
  summary: {
    totalClaims: number;
    verifiedClaims: number;
    conflictedClaims: number;
    insufficientClaims: number;
  };
}

export interface EvidencePlan {
  query: string;
  identifiedTask: string;
  requiredMeasurements: string[];
  selectedTools: string[];
  canBeResolvedDeterministically: boolean;
  expectedIndices: string[];
}
