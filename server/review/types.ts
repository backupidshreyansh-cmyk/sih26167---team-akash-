/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Analyst Review, Decision, Feedback & Provenance Types (Phase 7).
 * Compliant with ISRO / SIH-26227 §2.2.5 Analyst Workflow and Provenance.
 */

export type ReviewStatus = 
  | 'NEW'
  | 'IN_REVIEW'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'UNCERTAIN'
  | 'ARCHIVED';

export type RejectionReason = 
  | 'SEASONAL_VARIATION'
  | 'FALSE_ALARM'
  | 'REGISTRATION_ERROR'
  | 'LOW_IMAGE_QUALITY'
  | 'WRONG_SEMANTIC_MATCH'
  | 'NO_MEANINGFUL_CHANGE'
  | 'DUPLICATE_SITE'
  | 'OTHER';

export type ConfirmationEvidence = 
  | 'PERSISTENT_CHANGE'
  | 'STRONG_SPATIAL_COHERENCE'
  | 'REGISTRATION_USABLE'
  | 'COMPATIBLE_OBSERVATIONS'
  | 'SEMANTIC_INTERPRETATION_SUPPORTED';

export interface AnalystDecisionRecord {
  decision: 'CONFIRMED' | 'REJECTED' | 'UNCERTAIN';
  timestamp: string;
  rejectionReason?: RejectionReason;
  rejectionNotes?: string;
  confirmedEvidence?: ConfirmationEvidence[];
  analystNotes?: string;
  runId: string;
  processingVersion: string;
}

export interface ReviewCandidateIdentity {
  candidateId: string;
  sceneId: string;
  beforeSceneId?: string;
  afterSceneId?: string;
  subsequentSceneIds?: string[];
  fileName: string;
  locationName: string;
  crs: string | null;
  bounds?: any;
  acquisitionDates: string[];
  sensors: string[];
  satellites: string[];
  modality: string;
  resolution?: string;
}

export interface ReviewCandidateRetrieval {
  originalQuery?: string;
  searchMode: string;
  retrievalMethod: string;
  similarityScore: number;
  filtersUsed: Record<string, any>;
  whyRetrieved: string[];
  clusterId?: number;
  clusterLabel?: string;
  discoveredFromSceneId?: string;
}

export interface ReviewCandidateTemporal {
  hasTemporalComparison: boolean;
  timeDifferenceDays?: number;
  earliestSupportedDateOrRange?: string;
  earliestSupportedSceneId?: string;
  timelineStatement?: string;
  beforeDate?: string;
  afterDate?: string;
  usableObservationsCount?: number;
  excludedObservationsCount?: number;
}

export interface ReviewCandidateChange {
  hasDetectedChange: boolean;
  changePercentage: number;
  changedPixelCount: number;
  totalScenePixels: number;
  changeClassification: string;
  meanMagnitude: number;
  maxMagnitude: number;
  changeRegionsCount: number;
  primaryPhenomenon?: string;
  changeMethod: string;
}

export interface ReviewCandidateQuality {
  overallStatus: 'USABLE' | 'DEGRADED' | 'UNUSABLE';
  registrationStatus: string;
  seasonalDifferenceDetected: boolean;
  seasonalSeverity: string;
  cloudStatus: string;
  radiometricStatus: string;
  spatialCoherenceStatus: string;
  persistenceStatus: string;
  sensorRelationship: string;
  qualityWarnings: string[];
}

export interface ReviewCandidateVisualEvidence {
  beforeImageUrl?: string;
  afterImageUrl?: string;
  changeMapUrl?: string;
  thumbnailUrl?: string;
}

export interface ProcessingHistoryStep {
  step: string;
  status: 'COMPLETED' | 'SKIPPED' | 'FLAGGED';
  timestamp: string;
  details?: string;
}

export interface ReviewCandidate {
  candidateId: string;
  sourceRunId: string;
  sourceType: 'SEMANTIC_RETRIEVAL' | 'TEMPORAL_CHANGE' | 'SIMILAR_SITE_DISCOVERY' | 'IMAGE_SIMILARITY';
  status: ReviewStatus;
  enqueuedAt: string;
  updatedAt: string;
  identity: ReviewCandidateIdentity;
  retrieval: ReviewCandidateRetrieval;
  temporal: ReviewCandidateTemporal;
  change: ReviewCandidateChange;
  quality: ReviewCandidateQuality;
  visualEvidence: ReviewCandidateVisualEvidence;
  analystDecision?: AnalystDecisionRecord;
  processingHistory: ProcessingHistoryStep[];
  provenance: {
    processingVersion: string;
    modelVersion: string;
    embeddingVersion: string;
    algorithm: string;
    timestamps: {
      enqueued: string;
      lastModified: string;
      decisionRecorded?: string;
    };
  };
}

export interface AuditEvent {
  eventId: string;
  timestamp: string;
  runId: string;
  candidateId?: string;
  sceneId?: string;
  operation: 
    | 'SCENE_INGESTED'
    | 'EMBEDDING_CREATED'
    | 'SCENE_INDEXED'
    | 'QUERY_EXECUTED'
    | 'CANDIDATE_RETRIEVED'
    | 'TEMPORAL_ANALYSIS_STARTED'
    | 'CHANGE_DETECTED'
    | 'QUALITY_CHECK_COMPLETED'
    | 'CANDIDATE_QUEUED'
    | 'CANDIDATE_STATUS_CHANGED'
    | 'CANDIDATE_CONFIRMED'
    | 'CANDIDATE_REJECTED'
    | 'CANDIDATE_MARKED_UNCERTAIN'
    | 'BULK_REVIEW_APPLIED'
    | 'FEEDBACK_RECORDED'
    | 'EXPORT_CREATED';
  status: 'SUCCESS' | 'WARNING' | 'ERROR' | 'INFO';
  details: Record<string, any>;
  relevantVersion: string;
  provenanceRef?: string;
}

export interface FeedbackRecord {
  feedbackId: string;
  candidateId: string;
  referenceSceneId?: string;
  query?: string;
  retrievalMethod: string;
  candidateFeatures: {
    sensor: string;
    modality: string;
    changeType: string;
    similarity: number;
    registrationStatus: string;
  };
  systemResult: {
    systemStatus: string;
    changePercentage: number;
  };
  analystDecision: 'CONFIRMED' | 'REJECTED' | 'UNCERTAIN';
  rejectionReason?: RejectionReason;
  rejectionNotes?: string;
  confirmedEvidence?: ConfirmationEvidence[];
  analystNotes?: string;
  timestamp: string;
  runId: string;
}

export interface ReviewQueueFilters {
  status?: 'ALL' | ReviewStatus;
  changeType?: string;
  sensor?: string;
  quality?: 'ALL' | 'USABLE' | 'DEGRADED' | 'UNUSABLE';
  startDate?: string;
  endDate?: string;
  search?: string;
  sortBy?: 'RELEVANCE' | 'NEWEST' | 'OLDEST' | 'CHANGE_PERCENTAGE' | 'QUALITY' | 'STATUS';
  sortOrder?: 'ASC' | 'DESC';
}
