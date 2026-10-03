import { AnalysisContract, AnalysisAudit, AnalysisBudget, EvidenceSufficiency, FinalDecision, VerificationLevel } from '../analysis/analysisContract.js';
import { 
  RasterValidationResult, 
  OpticalEvidence, 
  SAREvidence, 
  BiTemporalChangeEvidence, 
  SpatialOverlapResult, 
  GroundedEvidenceRegion, 
  EvidencePlan, 
  EvidenceGraph 
} from '../evidence/types.js';

export * from '../evidence/types.js';

export type TaskClassification = 
  | 'SEMANTIC_RETRIEVAL'
  | 'SCENE_INTERPRETATION'
  | 'MULTITEMPORAL_CHANGE'
  | 'CHANGE_VERIFICATION'
  | 'FALSE_ALARM_ASSESSMENT'
  | 'SIMILAR_SITE_DISCOVERY'
  | 'ANALYST_REVIEW'
  | 'METADATA_PROVENANCE'
  | 'SINGLE_IMAGE_VQA'
  | 'IMAGE_CAPTIONING'
  | 'SCENE_DESCRIPTION'
  | 'TEXT_GUIDED_GROUNDING'
  | 'OPTICAL_ANALYSIS'
  | 'SAR_ANALYSIS'
  | 'OPTICAL_SAR_ANALYSIS'
  | 'BI_TEMPORAL_ANALYSIS'
  | 'CHANGE_VQA'
  | 'COUNTING'
  | 'SPATIAL_REASONING'
  | 'NEGATIVE_QUERY'
  | 'GEOREFERENCED_QUERY'
  | 'FOLLOW_UP'
  | 'UNSUPPORTED_QUERY';

export interface ExecutionTraceStep {
  step: string;
  status: 'SUCCESS' | 'INFO' | 'WARNING' | 'ERROR';
  details?: string;
  durationMs?: number;
}

export interface ToolCall {
  toolName: string;
  arguments: any;
  status: 'PENDING' | 'SUCCESS' | 'ERROR';
  result?: any;
  error?: string;
}

export interface ExecutionPlan {
  steps: { action: string; tool?: string; description: string }[];
}

export type ConfidenceLevel = 
  | 'VERIFIED'
  | 'HIGH' 
  | 'MEDIUM' 
  | 'LOW' 
  | 'CONFLICTING EVIDENCE' 
  | 'INSUFFICIENT EVIDENCE' 
  | 'NEEDS_MORE_EVIDENCE'
  | 'EVIDENCE_CONFLICT'
  | 'INCONCLUSIVE'
  | 'NOT CALIBRATED';

export interface GroundingBox {
  label: string;
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

export interface EvidenceSource {
  imageId?: string;
  modality?: string;
  tool?: string;
  provider?: string;
  model?: string;
}

export interface EvidenceItem {
  text: string;
  source?: EvidenceSource;
}

export interface Evidence {
  observations: string[] | EvidenceItem[];
  interpretations: string[] | EvidenceItem[];
  supportingEvidence?: string[];
  contradictingEvidence?: string[];
  alternativeExplanations?: string[];
  confoundersChecked?: string[];
}

export interface ConfidenceAssessment {
  level: ConfidenceLevel;
  limitations: string[];
  isModelEstimated: boolean;
  evidenceSufficiency?: EvidenceSufficiency;
  finalDecision?: FinalDecision;
}

export interface AgentResponse {
  executionTrace: ExecutionTraceStep[];
  taskClassification: TaskClassification;
  answer: string;
  evidence: Evidence;
  confidence: ConfidenceAssessment;
  recommendedModality?: string;
  detectedModality?: string;
  polarization?: string;
  metadata?: any;
  groundingBoxes?: GroundingBox[];
  provider?: string;
  model?: string;
  modelRoute?: string[];
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cachedTokens?: number;
  };
  cost?: {
    actualCost: number;
    baselineCost: number;
    savings: number;
    savingsPercentage: number;
  };
  contract?: AnalysisContract;
  audit?: AnalysisAudit;
  budget?: AnalysisBudget;
  evidencePlan?: EvidencePlan;
  rasterValidations?: RasterValidationResult[];
  opticalEvidence?: OpticalEvidence;
  sarEvidence?: SAREvidence;
  temporalEvidence?: BiTemporalChangeEvidence;
  crossModalEvidence?: SpatialOverlapResult;
  groundedEvidenceRegions?: GroundedEvidenceRegion[];
  evidenceGraph?: EvidenceGraph;
  dataQuality?: {
    valid: boolean;
    format: string;
    hasCrs: boolean;
    warnings: string[];
  };
  measurementQuality?: {
    confidence: string;
    deterministicChecksCount: number;
    confoundersDetectedCount: number;
  };
  multiImageComparison?: any;
}

