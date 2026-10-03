/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Multi-Temporal Change Discovery & False-Alarm Suppression Types (Phase 4 & 5).
 * Enforces strict scientific decoupling between:
 * - DATA QUALITY
 * - EVIDENCE SUFFICIENCY
 * - SEMANTIC INTERPRETATION
 */

import { SceneRecord } from '../archive/types.js';

export type RegistrationStatus = 
  | 'ALIGNED'
  | 'PARTIALLY_ALIGNED'
  | 'REGISTRATION_UNCERTAIN'
  | 'REGISTRATION_FAILED'
  | 'NOT_AVAILABLE';

export type SeasonalDifferenceSeverity = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';

export type SpatialCoherenceGrade = 'STRONG' | 'MODERATE' | 'WEAK' | 'NOT_AVAILABLE';

export type PersistenceStatus = 'PERSISTENT' | 'TRANSIENT' | 'UNCERTAIN' | 'NOT_AVAILABLE';

export type RadiometricStatus = 'CONSISTENT' | 'POTENTIAL_DIFFERENCE' | 'NOT_AVAILABLE';

export type FinalChangeStatus = 
  | 'SUPPORTED_CHANGE'
  | 'POSSIBLE_CHANGE'
  | 'LIKELY_SEASONAL_VARIATION'
  | 'LOW_QUALITY'
  | 'REGISTRATION_UNCERTAIN'
  | 'INSUFFICIENT_EVIDENCE'
  | 'NO_SIGNIFICANT_CHANGE'
  | 'CROSS_SENSOR_UNCERTAIN'
  | 'EVIDENCE_CONFLICT';

export type SemanticChangeClass = 
  | 'CONSTRUCTION'
  | 'CLEARANCE'
  | 'WATER_EXTENT_CHANGE'
  | 'ROAD_DEVELOPMENT'
  | 'VEGETATION_CHANGE'
  | 'APPEARANCE'
  | 'DISAPPEARANCE'
  | 'EXPANSION'
  | 'CONTRACTION'
  | 'UNKNOWN';

export interface ChangeRegion {
  regionId: string;
  bboxPixels: [number, number, number, number]; // [minX, minY, maxX, maxY]
  pixelArea: number;
  physicalAreaM2: number | 'AREA_UNAVAILABLE';
  physicalAreaFormatted: string;
  meanMagnitude: number;
  maxMagnitude: number;
  spatialCoherence: SpatialCoherenceGrade;
  density: number; // compactness ratio 0 - 1
  detectedPhenomenon: string;
  potentialSemanticInterpretation: SemanticChangeClass;
}

export interface TemporalQualityChecks {
  overallStatus: 'USABLE' | 'DEGRADED' | 'UNUSABLE';
  registration: {
    status: RegistrationStatus;
    method: string;
    details: string;
  };
  season: {
    differenceDetected: boolean;
    severity: SeasonalDifferenceSeverity;
    beforeMonth?: number;
    afterMonth?: number;
    details: string;
  };
  cloud: {
    status: 'USABLE' | 'CONTAMINATED' | 'NOT_AVAILABLE';
    beforeCloudCoverPct: number | null;
    afterCloudCoverPct: number | null;
    details: string;
  };
  radiometric: {
    status: RadiometricStatus;
    meanLuminanceShift: number;
    details: string;
  };
  sensorRelationship: {
    relationship: 'SAME_SENSOR' | 'CROSS_SENSOR_COMPARISON' | 'UNKNOWN';
    beforeSensor: string;
    afterSensor: string;
    details: string;
  };
  spatialCoherence: {
    status: SpatialCoherenceGrade;
    totalCoherentRegions: number;
    maxRegionPixelArea: number;
    details: string;
  };
  persistence: {
    status: PersistenceStatus;
    evaluatedEpochCount: number;
    persistentRegionRatio?: number;
    details: string;
  };
}

export interface TemporalObservationRecord {
  sceneId: string;
  acquisitionDate: string;
  sensor: string;
  satellite: string;
  modality: string;
  status: 'USABLE_BASELINE' | 'POSSIBLE_CHANGE_ONSET' | 'SUPPORTED_CHANGE' | 'PERSISTENT_CHANGE' | 'EXCLUDED';
  exclusionReason?: string;
  cloudCoverPct: number | null;
  changeScoreAgainstBaseline?: number;
  scene?: SceneRecord;
}

export interface TemporalLocationGroup {
  locationId: string;
  name: string;
  bounds: {
    minLng?: number | null;
    minLat?: number | null;
    maxLng?: number | null;
    maxLat?: number | null;
  } | null;
  spatialCertainty: 'VERIFIED_FOOTPRINT_OVERLAP' | 'UNCERTAIN';
  observations: TemporalObservationRecord[];
}

export interface ChangeAnalysisResult {
  analysisId: string;
  beforeSceneId: string;
  afterSceneId: string;
  beforeDate: string;
  afterDate: string;
  timeDifferenceDays: number;
  
  // Staged Quality Assessment & False-Alarm Screening
  quality: TemporalQualityChecks;
  
  // Deterministic Change Detection Measurements
  changeMetrics: {
    totalScenePixels: number;
    changedPixelCount: number;
    changedPercentage: number;
    meanChangeMagnitude: number;
    maxChangeMagnitude: number;
    changeRegions: ChangeRegion[];
  };

  // Earliest Supported Change Epoch
  earliestSupportedChange: {
    supported: boolean;
    earliestDateOrRange: string | null;
    earliestSceneId: string | null;
    confidenceStatement: string;
  };

  // Final False-Alarm Enforced State
  finalDecision: FinalChangeStatus;
  semanticClassification: SemanticChangeClass;
  analystSummary: string;
  whyDecided: string[];
  whatIsNeededIfUncertain?: string;

  // Derived Visual Artifacts
  visualEvidence: {
    beforePreviewUrl?: string;
    afterPreviewUrl?: string;
    differenceDataUrl?: string;
    changeMaskDataUrl?: string;
  };

  provenance: {
    algorithm: string;
    algorithmVersion: string;
    analysisTimestamp: string;
    isCacheHit: boolean;
    processingTimeMs: number;
    pipelineStageReached: 'STAGE_1_REGISTRATION' | 'STAGE_2_DIFFERENCING' | 'STAGE_3_CONFOUNDER_SCREEN' | 'STAGE_4_FULL_VERIFICATION';
  };
}
