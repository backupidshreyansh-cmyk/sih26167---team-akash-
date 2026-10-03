export type EvidenceSufficiency = 'STRONG' | 'MODERATE' | 'WEAK' | 'INSUFFICIENT' | 'CONFLICTING';
export type FinalDecision = 'VERIFIED' | 'INCONCLUSIVE' | 'NEEDS_MORE_DATA' | 'NEEDS_MORE_EVIDENCE' | 'EVIDENCE_CONFLICT' | 'INVALID_INPUT';
export type VerificationLevel = 0 | 1 | 2 | 3;

export interface AnalysisContract {
  query: string;
  claim: string;
  requiredEvidence: string[];
  observations: string[];
  observedAndMeasured?: string[];
  inferred?: string[];
  verified?: string[];
  notEstablished?: string[];
  initialHypothesis: string;
  supportingEvidence: string[];
  contradictingEvidence: string[];
  alternativeExplanations: string[];
  confoundersChecked: string[];
  verificationResult: string;
  evidenceSufficiency: EvidenceSufficiency;
  finalDecision: FinalDecision;
  whyNotVerified?: string;
  why?: string;
  whatDataIsRequired?: string;
  whatTheUserShouldUpload?: string;
  requiredObservation?: string;
  recommendedAction?: string;
  answer: string;
  limitations: string[];
  modelConfidence?: string;
  multiImageComparison?: {
    relationship: 'TEMPORAL_CHANGE' | 'MULTI_SENSOR_FUSION' | 'MULTIPLE_VIEWS' | 'SINGLE_IMAGE';
    relationshipLabel: string;
    summary: string;
    whatChangedOrDiffers: string[];
    whatStayedSame: string[];
    whatCannotBeCompared: string[];
  };
}

export interface AuditCheckItem {
  name: string;
  status: 'PASSED' | 'FLAGGED' | 'RESOLVED' | 'INFO';
  details: string;
}

export interface InternalVerificationQuestion {
  question: string;
  check: string;
  outcome: string;
}

export interface AnalysisAudit {
  depth: 'Deterministic Only' | 'Standard' | 'Verified' | 'Deep';
  verificationLevel: VerificationLevel;
  modelsUsed: string[];
  toolsUsed: string[];
  verificationChecks: AuditCheckItem[];
  internalQuestions: InternalVerificationQuestion[];
  apiCalls: number;
  processingTimeMs: number;
  evidenceStatus: EvidenceSufficiency;
  modelConfidence: string;
  finalDecision: FinalDecision;
  cacheHit?: boolean;
}

export interface AnalysisBudget {
  verificationLevel: VerificationLevel;
  verificationLevelLabel: 'Deterministic Only' | 'Standard' | 'Verified' | 'Deep';
  modelCallsCount: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  totalTokens: number;
  toolCallsCount: number;
  processingTimeMs: number;
  actualCost: number;
  baselineCost: number;
  savings: number;
  savingsPercentage: number;
}

export type ConfidenceAssessment = {
  level: string;
  limitations: string[];
  isModelEstimated: boolean;
  evidenceSufficiency?: EvidenceSufficiency;
  finalDecision?: FinalDecision;
};

export type Evidence = {
  observations: string[];
  interpretations: string[];
  supportingEvidence?: string[];
  contradictingEvidence?: string[];
  alternativeExplanations?: string[];
  confoundersChecked?: string[];
};

export type TokenUsageInfo = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedTokens?: number;
};

export type CostInfo = {
  actualCost: number;
  baselineCost: number;
  savings: number;
  savingsPercentage: number;
};

export type AgentResponse = {
  provider: string;
  model: string;
  modelRoute?: string[];
  executionTrace: Array<{step: string, status: string, details?: string, durationMs?: number}>;
  taskClassification: string;
  answer: string;
  evidence: Evidence;
  confidence: ConfidenceAssessment;
  recommendedModality: string;
  detectedModality?: string;
  polarization?: string;
  metadata?: any[];
  groundingBoxes?: Array<{label: string, ymin: number, xmin: number, ymax: number, xmax: number}>;
  tokenUsage?: TokenUsageInfo;
  cost?: CostInfo;
  contract?: AnalysisContract;
  audit?: AnalysisAudit;
  budget?: AnalysisBudget;
  evidencePlan?: any;
  rasterValidations?: any[];
  opticalEvidence?: any;
  sarEvidence?: any;
  temporalEvidence?: any;
  crossModalEvidence?: any;
  groundedEvidenceRegions?: any[];
  evidenceGraph?: any;
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
  multiImageComparison?: {
    relationship: 'TEMPORAL_CHANGE' | 'MULTI_SENSOR_FUSION' | 'MULTIPLE_VIEWS' | 'SINGLE_IMAGE';
    relationshipLabel: string;
    summary: string;
    whatChangedOrDiffers: string[];
    whatStayedSame: string[];
    whatCannotBeCompared: string[];
  };
};

export type Message = {
  id: string;
  role: 'user' | 'model';
  text?: string;
  agentResponse?: AgentResponse;
  images?: string[];
};

export type ImageSlot = 'primary' | 'secondary' | 't1' | 't2' | 'before' | 'after' | 'optical' | 'sar';

export type UploadedImage = {
  id: string;
  file: File;
  previewUrl: string;
  base64Data: string;
  mimeType: string;
  slot?: ImageSlot;
  metadata?: any;
};
