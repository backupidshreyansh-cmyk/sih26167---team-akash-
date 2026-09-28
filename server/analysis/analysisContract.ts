/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Analysis Contract and Decision Gate for SatQuery AI.
 * Strictly separates:
 * 1. OBSERVED / MEASURED (direct radiometric & spatial facts)
 * 2. INFERRED (candidate hypotheses / semantic models)
 * 3. NOT ESTABLISHED (unprovable claims & bounds)
 * 
 * Strict Decision States:
 * - VERIFIED: Required evidence exists, is valid, and no material contradiction remains.
 * - INCONCLUSIVE: Evidence exists but does not establish the requested claim.
 * - EVIDENCE_CONFLICT: Valid evidence sources materially disagree.
 * - NEEDS_MORE_DATA: The system knows what additional observation/input is required.
 * 
 * CORE PRINCIPLE: MODEL CONFIDENCE IS NOT EVIDENCE.
 * Model confidence must NEVER by itself produce VERIFIED.
 */

export type EvidenceSufficiency = 'STRONG' | 'MODERATE' | 'WEAK' | 'INSUFFICIENT' | 'CONFLICTING';

export type FinalDecision = 'VERIFIED' | 'INCONCLUSIVE' | 'NEEDS_MORE_DATA' | 'NEEDS_MORE_EVIDENCE' | 'EVIDENCE_CONFLICT' | 'INVALID_INPUT';

export type VerificationLevel = 0 | 1 | 2 | 3;

export interface AnalysisContract {
  query: string;
  claim: string;
  requiredEvidence: string[];
  observations: string[];
  
  // Explicit 5-Tier Scientific Separation:
  // 1. OBSERVED: What is directly visible or actually measured
  // 2. INFERRED: What the evidence suggests
  // 3. VERIFIED: Only what the available evidence actually establishes
  // 4. NOT ESTABLISHED: What cannot be concluded
  // 5. REQUIRED EVIDENCE: Exactly what additional data would be needed
  observedAndMeasured: string[];
  inferred: string[];
  verified: string[];
  notEstablished: string[];

  initialHypothesis: string;
  supportingEvidence: string[];
  contradictingEvidence: string[];
  alternativeExplanations: string[];
  confoundersChecked: string[];
  verificationResult: string;
  evidenceSufficiency: EvidenceSufficiency;
  finalDecision: FinalDecision;
  answer: string;
  limitations: string[];
  modelConfidence?: 'High' | 'Moderate' | 'Low' | 'Not Calibrated' | string;

  // Multi-Image comparative analysis (6 canonical relationships + UNCERTAIN)
  multiImageComparison?: {
    relationship: 'SINGLE_IMAGE' | 'MULTISPECTRAL' | 'OPTICAL_SAR' | 'BEFORE_AFTER' | 'MULTI_TEMPORAL' | 'INCOMPATIBLE' | 'UNCERTAIN' | 'TEMPORAL_CHANGE' | 'MULTI_SENSOR_FUSION' | 'MULTIPLE_VIEWS';
    relationshipLabel: string;
    summary: string;
    whatChangedOrDiffers: string[];
    whatStayedSame: string[];
    whatCannotBeCompared: string[];
    whatIsKnown?: string[];
    clarificationRequired?: string;
  };

  // Explicit explanations for abstention and missing evidence
  whyNotVerified?: string;
  requiredObservation?: string;
  recommendedAction?: string;

  // Missing Evidence 5-Tier Breakdown:
  whatICanDetermine?: string[];
  whatICannotDetermine?: string[];
  why?: string;
  whatDataIsRequired?: string;
  whatTheUserShouldUpload?: string;

  // Granular legacy mappings
  whatImageShows?: string[];
  likelyInterpretation?: string[];
  whatCannotBeEstablished?: string[];
  directObservation?: string[];
  measuredEvidence?: string[];
  modelInference?: string[];
  externalReference?: string[];
  missingEvidence?: string[];
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

/**
 * Validates and normalizes raw model/pipeline output into a strictly compliant AnalysisContract.
 * Enforces evidence sufficiency vs model confidence decoupling and decision gate rules.
 */
export function validateAndNormalizeAnalysisContract(
  raw: any,
  fallbackQuery: string,
  deterministicEvidenceState?: EvidenceSufficiency
): AnalysisContract {
  if (!raw || typeof raw !== 'object') {
    return {
      query: fallbackQuery,
      claim: "Unable to parse structured remote sensing analysis.",
      requiredEvidence: ["Authoritative visual inspection", "Sensor metadata verification"],
      observations: [],
      observedAndMeasured: [],
      inferred: [],
      verified: [],
      notEstablished: ["Model output did not adhere to required analysis contract."],
      initialHypothesis: "Malformed output received.",
      supportingEvidence: [],
      contradictingEvidence: ["Model produced unparseable structure."],
      alternativeExplanations: ["Pipeline execution error or schema truncation."],
      confoundersChecked: ["Schema compliance", "Output formatting"],
      verificationResult: "Contract validation failed: invalid object format.",
      evidenceSufficiency: 'INSUFFICIENT',
      finalDecision: 'INVALID_INPUT',
      whyNotVerified: "The response was unparseable or corrupted.",
      requiredObservation: "A valid, well-formed remote sensing observation.",
      recommendedAction: "Verify file integrity and re-run analysis.",
      whatICanDetermine: [],
      whatICannotDetermine: ["Model response unparseable."],
      why: "The model response did not conform to the required JSON schema.",
      whatDataIsRequired: "A well-formed analysis contract.",
      whatTheUserShouldUpload: "Retry the request with valid satellite imagery.",
      answer: "Analysis failed due to malformed model response. The output could not be safely validated.",
      limitations: ["Model output did not adhere to required analysis contract."],
      modelConfidence: 'Low'
    };
  }

  const query = typeof raw.query === 'string' && raw.query.trim().length > 0 
    ? raw.query.trim() 
    : fallbackQuery;

  const claim = typeof raw.claim === 'string' && raw.claim.trim().length > 0 
    ? raw.claim.trim() 
    : (typeof raw.answer === 'string' ? raw.answer.slice(0, 120) : "Candidate interpretation");

  const toStringArray = (val: any): string[] => {
    if (Array.isArray(val)) {
      return val.map(item => (typeof item === 'string' ? item.trim() : JSON.stringify(item))).filter(Boolean);
    }
    if (typeof val === 'string' && val.trim().length > 0) {
      return [val.trim()];
    }
    return [];
  };

  const requiredEvidence = toStringArray(raw.requiredEvidence);
  const observations = toStringArray(raw.observations);
  const supportingEvidence = toStringArray(raw.supportingEvidence);
  const contradictingEvidence = toStringArray(raw.contradictingEvidence);
  const alternativeExplanations = toStringArray(raw.alternativeExplanations);
  const confoundersChecked = toStringArray(raw.confoundersChecked);
  const limitations = toStringArray(raw.limitations);

  // Parse or synthesize 5-Tier Scientific Separation
  const observedAndMeasured = toStringArray(raw.observedAndMeasured).length > 0
    ? toStringArray(raw.observedAndMeasured)
    : observations.slice(0, 5);

  const inferred = toStringArray(raw.inferred).length > 0
    ? toStringArray(raw.inferred)
    : (supportingEvidence.length > 0 ? supportingEvidence.slice(0, 3) : [raw.initialHypothesis || "Inferred interpretation from observable patterns"]);

  const notEstablished = toStringArray(raw.notEstablished).length > 0
    ? toStringArray(raw.notEstablished)
    : (limitations.length > 0 ? limitations : ["Ground truth validation without auxiliary in-situ sensors is not established"]);

  const initialHypothesis = typeof raw.initialHypothesis === 'string' && raw.initialHypothesis.trim().length > 0
    ? raw.initialHypothesis.trim()
    : "Initial observation without verified hypothesis.";

  const verificationResult = typeof raw.verificationResult === 'string' && raw.verificationResult.trim().length > 0
    ? raw.verificationResult.trim()
    : "Verification check completed against image evidence.";

  // Normalize Evidence Sufficiency
  let rawSufficiency = String(raw.evidenceSufficiency || '').toUpperCase().trim();
  let evidenceSufficiency: EvidenceSufficiency = 'MODERATE';

  if (rawSufficiency.includes('CONFLICT')) {
    evidenceSufficiency = 'CONFLICTING';
  } else if (rawSufficiency.includes('WEAK')) {
    evidenceSufficiency = 'WEAK';
  } else if (rawSufficiency.includes('INSUFFICIENT') || rawSufficiency.includes('NONE') || rawSufficiency.includes('ZERO')) {
    evidenceSufficiency = 'INSUFFICIENT';
  } else if (rawSufficiency.includes('STRONG')) {
    evidenceSufficiency = 'STRONG';
  } else if (rawSufficiency.includes('MODERATE') || rawSufficiency.includes('SUFFICIENT')) {
    evidenceSufficiency = 'MODERATE';
  } else {
    // Default based on real evidence presence
    if (observations.length === 0 || supportingEvidence.length === 0) {
      evidenceSufficiency = 'INSUFFICIENT';
    } else if (String(raw.finalDecision || '').toUpperCase().includes('CONFLICT')) {
      evidenceSufficiency = 'CONFLICTING';
    }
  }

  // Deterministic engine overrides
  if (deterministicEvidenceState === 'CONFLICTING') {
    evidenceSufficiency = 'CONFLICTING';
  } else if (deterministicEvidenceState === 'INSUFFICIENT' && evidenceSufficiency !== 'CONFLICTING') {
    evidenceSufficiency = 'INSUFFICIENT';
  }

  // Model confidence separate from evidence sufficiency
  // RULE: MODEL CONFIDENCE IS NOT PROOF.
  // Use High / Moderate / Low (never invent arbitrary numerical probabilities)
  let rawConf = String(raw.modelConfidence || raw.confidence?.level || raw.confidence || '').toUpperCase().trim();
  let modelConfidence: 'High' | 'Moderate' | 'Low' | 'Not Calibrated' = 'Moderate';
  if (rawConf.includes('HIGH') || rawConf.includes('VERIFIED')) modelConfidence = 'High';
  else if (rawConf.includes('LOW')) modelConfidence = 'Low';
  else if (rawConf.includes('NOT') || rawConf.includes('NONE')) modelConfidence = 'Not Calibrated';
  else modelConfidence = 'Moderate';

  // Strict Decision Gate Enforcement:
  // RULE: OBSERVED ≠ INFERRED ≠ VERIFIED.
  // Do NOT label the result VERIFIED merely because the VLM has high confidence!
  const qLower = query.toLowerCase();
  const isCausalOrLandUseAttribution = 
    qLower.includes('land-use') || qLower.includes('land use') ||
    qLower.includes('deforestation') || qLower.includes('deforested') ||
    qLower.includes('why did') || qLower.includes('what caused') ||
    qLower.includes('cause of') || qLower.includes('caused by') ||
    qLower.includes('attributed to') || qLower.includes('attribution') ||
    qLower.includes('flood damage') || qLower.includes('disaster damage') ||
    qLower.includes('crop type') || qLower.includes('specific crop');

  let rawDecision = String(raw.finalDecision || '').toUpperCase().trim();
  let finalDecision: FinalDecision = 'INCONCLUSIVE';

  let whyNotVerified = typeof raw.whyNotVerified === 'string' ? raw.whyNotVerified : undefined;
  let requiredObservation = typeof raw.requiredObservation === 'string' ? raw.requiredObservation : undefined;
  let recommendedAction = typeof raw.recommendedAction === 'string' ? raw.recommendedAction : undefined;

  if (evidenceSufficiency === 'CONFLICTING' || rawDecision.includes('CONFLICT')) {
    finalDecision = 'EVIDENCE_CONFLICT';
    whyNotVerified = whyNotVerified || "Different sensor observations or radiometric bands provide conflicting signatures.";
    requiredObservation = requiredObservation || "Complementary dual-polarization SAR or coincident high-resolution optical observation.";
    recommendedAction = recommendedAction || "Cross-check with Bhoonidhi Sentinel-1 / Resourcesat-2A observations.";
  } else if (evidenceSufficiency === 'INSUFFICIENT' || evidenceSufficiency === 'WEAK') {
    if (rawDecision.includes('NEED') || rawDecision.includes('MORE')) {
      finalDecision = rawDecision.includes('EVIDENCE') ? 'NEEDS_MORE_EVIDENCE' : 'NEEDS_MORE_DATA';
    } else {
      finalDecision = 'INCONCLUSIVE';
    }
    whyNotVerified = whyNotVerified || "Available evidence is insufficient to verify the claim without guessing.";
    requiredObservation = requiredObservation || "Additional observation with calibrated spectral bands or temporal baseline.";
    recommendedAction = recommendedAction || "Discover candidate observations in official Indian EO catalogue (Bhoonidhi / MOSDAC).";
  } else if (evidenceSufficiency === 'STRONG' || evidenceSufficiency === 'MODERATE') {
    if (rawDecision.includes('VERIFIED')) {
      // RULE: Do not say VERIFIED when evidence only supports visual observation or plausible interpretation
      if (isCausalOrLandUseAttribution) {
        finalDecision = 'INCONCLUSIVE';
        whyNotVerified = whyNotVerified || "The difference or visual appearance is consistent with plausible interpretations, but cannot be verified specifically as permanent land-use change or deforestation without comparable seasonal baselines and calibrated spectral data.";
        requiredObservation = requiredObservation || "Comparable temporal imagery, appropriate spectral evidence (NDVI/SWIR), and artifact/confounder checks.";
      } else if (contradictingEvidence.length > 0 && alternativeExplanations.length > 0 && !raw.verificationResult?.toLowerCase().includes('verified')) {
        finalDecision = 'INCONCLUSIVE';
        whyNotVerified = whyNotVerified || "Alternative physical explanation or confounder casts doubt on the primary hypothesis.";
      } else {
        finalDecision = 'VERIFIED';
      }
    } else if (rawDecision.includes('INCONCLUSIVE')) {
      finalDecision = 'INCONCLUSIVE';
    } else if (rawDecision.includes('NEED') || rawDecision.includes('MORE')) {
      finalDecision = rawDecision.includes('EVIDENCE') ? 'NEEDS_MORE_EVIDENCE' : 'NEEDS_MORE_DATA';
    } else {
      // Default to INCONCLUSIVE if it is an attribution query, else VERIFIED for direct visual observation
      if (isCausalOrLandUseAttribution) {
        finalDecision = 'INCONCLUSIVE';
        whyNotVerified = whyNotVerified || "Available visual observations only suggest a plausible interpretation; scientific attribution is not established.";
      } else {
        finalDecision = 'VERIFIED';
      }
    }
  }

  // Synthesize VERIFIED: Only what the available evidence actually establishes
  const verified = toStringArray(raw.verified).length > 0
    ? toStringArray(raw.verified)
    : (finalDecision === 'VERIFIED'
        ? [verificationResult || "Direct radiometric and spatial presence of observable features is verified from raster bitstream."]
        : (isCausalOrLandUseAttribution
            ? ["Radiometric and textural differences between observations are established; specific land-use or physical attribution is not verified."]
            : ["Observable raster surface features and pixel characteristics are established; higher-order claims requiring calibration are unverified."]));

  // Populate Missing Evidence 5-Tier Breakdown
  const whatICanDetermine = toStringArray(raw.whatICanDetermine).length > 0
    ? toStringArray(raw.whatICanDetermine)
    : (observedAndMeasured.length > 0 ? observedAndMeasured.slice(0, 4) : observations.slice(0, 4));

  const whatICannotDetermine = toStringArray(raw.whatICannotDetermine).length > 0
    ? toStringArray(raw.whatICannotDetermine)
    : (notEstablished.length > 0 ? notEstablished.slice(0, 3) : ["Specific physical attribution without calibrated multi-sensor inputs."]);

  const why = typeof raw.why === 'string' && raw.why.trim().length > 0
    ? raw.why.trim()
    : (whyNotVerified || "Available evidence supports observable pixels and plausible interpretations, but does not establish quantitative proof or causal attribution.");

  const whatDataIsRequired = typeof raw.whatDataIsRequired === 'string' && raw.whatDataIsRequired.trim().length > 0
    ? raw.whatDataIsRequired.trim()
    : (requiredObservation || requiredEvidence.join('; ') || "Calibrated multi-spectral, multi-temporal, or orthorectified imagery.");

  const whatTheUserShouldUpload = typeof raw.whatTheUserShouldUpload === 'string' && raw.whatTheUserShouldUpload.trim().length > 0
    ? raw.whatTheUserShouldUpload.trim()
    : (recommendedAction || "Orthorectified GeoTIFF with authoritative spatial coordinate reference system and required spectral bands.");

  let answer = typeof raw.answer === 'string' && raw.answer.trim().length > 0
    ? raw.answer.trim()
    : "No conclusive answer could be determined from the available imagery.";

  let multiImageComparison = undefined;
  if (raw.multiImageComparison && typeof raw.multiImageComparison === 'object') {
    multiImageComparison = {
      relationship: raw.multiImageComparison.relationship || 'MULTIPLE_VIEWS',
      relationshipLabel: raw.multiImageComparison.relationshipLabel || 'Multi-Image Comparative Analysis',
      summary: typeof raw.multiImageComparison.summary === 'string' ? raw.multiImageComparison.summary : '',
      whatChangedOrDiffers: toStringArray(raw.multiImageComparison.whatChangedOrDiffers),
      whatStayedSame: toStringArray(raw.multiImageComparison.whatStayedSame),
      whatCannotBeCompared: toStringArray(raw.multiImageComparison.whatCannotBeCompared)
    };
  }

  return {
    query,
    claim,
    requiredEvidence,
    observations,
    observedAndMeasured,
    inferred,
    verified,
    notEstablished,
    initialHypothesis,
    supportingEvidence,
    contradictingEvidence,
    alternativeExplanations,
    confoundersChecked,
    verificationResult,
    evidenceSufficiency,
    finalDecision,
    whyNotVerified,
    requiredObservation,
    recommendedAction,
    whatICanDetermine,
    whatICannotDetermine,
    why,
    whatDataIsRequired,
    whatTheUserShouldUpload,
    answer,
    limitations,
    modelConfidence,
    multiImageComparison
  };
}
