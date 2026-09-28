import { describe, it, expect, beforeEach } from 'vitest';
import { SelfQuestioningEngine } from '../server/agent/selfQuestioningEngine.js';
import { DeterministicEngine } from '../server/analysis/deterministicEngine.js';
import { validateAndNormalizeAnalysisContract } from '../server/analysis/analysisContract.js';
import { globalContextCache } from '../server/analysis/contextCache.js';
import { NormalizedImage } from '../server/imagery/types.js';
import { AIProvider, AIProviderRequest, AIProviderResponse } from '../server/providers/AIProvider.js';

// 1x1 valid PNG base64 for fast deterministic testing
const TEST_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

class TestMockProvider implements AIProvider {
  public callCount = 0;
  public mockResponse: any = null;
  public responseSequence: any[] = [];

  async isAvailable() { return true; }

  async generateContent(req: AIProviderRequest): Promise<AIProviderResponse> {
    this.callCount++;
    const res = this.responseSequence.length > 0 
      ? this.responseSequence.shift() 
      : (this.mockResponse || {
          answer: "Default mock response",
          evidence: { observations: ["Obs 1"], interpretations: ["Int 1"] },
          confidence: { level: "HIGH", limitations: [], isModelEstimated: true }
        });

    return {
      provider: "TestMockProvider",
      model: "test-model-v1",
      executionTrace: [{ step: "MOCK_GENERATE", status: "SUCCESS" }],
      tokenUsage: { inputTokens: 120, outputTokens: 80, totalTokens: 200, cachedTokens: 0 },
      ...res
    };
  }
}

function createTestImage(id = 'img1', modality: 'OPTICAL' | 'SAR' = 'OPTICAL'): NormalizedImage {
  return {
    id,
    filename: `${id}.png`,
    mimeType: 'image/png',
    sizeBytes: 68,
    width: 1,
    height: 1,
    bandCount: 3,
    modality,
    temporalRole: 'PRIMARY',
    acquisitionTime: null,
    geospatialMetadata: null,
    sourceBase64: TEST_PNG_BASE64
  };
}

describe('Remote Sensing Analysis Engine & Self-Questioning Architecture', () => {

  beforeEach(() => {
    globalContextCache.clear();
  });

  // 1. ANALYSIS PLANNING & CLAIM DECOMPOSITION
  it('1. decomposes query and plans evidence requirements into structured stages', async () => {
    const provider = new TestMockProvider();
    provider.mockResponse = {
      claim: "Presence of built-up urban structures",
      requiredEvidence: ["High geometric edge density", "Clustered rectilinear features"],
      observations: ["Rectangular high-reflectance features arranged along linear axis."],
      initialHypothesis: "Possible small commercial complex.",
      supportingEvidence: ["Straight line boundaries visible."],
      contradictingEvidence: [],
      alternativeExplanations: ["Could be bare graded soil or agricultural sheds."],
      confoundersChecked: ["Cloud shadow", "Sensor blooming"],
      verificationResult: "Visual features consistent with built structures.",
      evidenceSufficiency: "STRONG",
      finalDecision: "VERIFIED",
      answer: "The scene contains a confirmed built-up area.",
      limitations: ["Sub-meter building footprints cannot be confirmed at this resolution."]
    };

    const engine = new SelfQuestioningEngine(provider, "System prompt");
    const result = await engine.analyze("Is there a built-up area in this image?", [createTestImage()], "SINGLE_IMAGE_VQA");

    expect(result.contract.claim).toContain("built-up");
    expect(result.contract.requiredEvidence.length).toBeGreaterThan(0);
    expect(result.contract.observations.length).toBeGreaterThan(0);
    expect(result.trace.some(t => t.step === 'QUERY_UNDERSTANDING')).toBe(true);
    expect(result.trace.some(t => t.step === 'PRIMARY_ANALYSIS_COMPLETED')).toBe(true);
  });

  // 2. ADAPTIVE ESCALATION (Level 0, Level 1, Level 2)
  it('2. executes Level 0 deterministic analysis for metadata queries with ZERO model calls', async () => {
    const provider = new TestMockProvider();
    const engine = new SelfQuestioningEngine(provider, "System prompt");
    
    const result = await engine.analyze("What are the pixel dimensions and bands of this image?", [createTestImage()], "SINGLE_IMAGE_VQA");

    expect(result.budget.verificationLevel).toBe(0);
    expect(result.budget.modelCallsCount).toBe(0);
    expect(provider.callCount).toBe(0);
    expect(result.contract.finalDecision).toBe('VERIFIED');
    expect(result.audit.depth).toBe('Deterministic Only');
  });

  it('2b. executes Level 1 standard analysis with exactly ONE model call for clear queries', async () => {
    const provider = new TestMockProvider();
    provider.mockResponse = {
      claim: "Identified open water reservoir",
      requiredEvidence: ["Low surface reflectance", "Smooth texture"],
      observations: ["Uniform dark low-reflectance boundary."],
      initialHypothesis: "Water reservoir.",
      supportingEvidence: ["Low reflectance matches water signature."],
      contradictingEvidence: [],
      alternativeExplanations: ["Deep topographic shadow."],
      confoundersChecked: ["Cloud shadow"],
      verificationResult: "Feature verified as open water body.",
      evidenceSufficiency: "STRONG",
      finalDecision: "VERIFIED",
      answer: "Open water reservoir detected."
    };

    const engine = new SelfQuestioningEngine(provider, "System prompt");
    const result = await engine.analyze("Is there water?", [createTestImage()], "SINGLE_IMAGE_VQA");

    expect(result.budget.verificationLevel).toBe(1);
    expect(result.budget.modelCallsCount).toBe(1);
    expect(provider.callCount).toBe(1);
    expect(result.contract.finalDecision).toBe('VERIFIED');
  });

  // 3. EVIDENCE SUFFICIENCY VS MODEL CONFIDENCE DECOUPLING
  it('3. enforces INCONCLUSIVE decision gate when model claims HIGH confidence but evidence is INSUFFICIENT', async () => {
    const provider = new TestMockProvider();
    // Model expresses HIGH confidence, but evidence is empty/insufficient
    provider.mockResponse = {
      claim: "Military vehicle column",
      observations: [],
      supportingEvidence: [],
      contradictingEvidence: [],
      evidenceSufficiency: "INSUFFICIENT",
      modelConfidence: "HIGH",
      finalDecision: "VERIFIED", // Overconfident model trying to assert verified
      answer: "I can clearly see military vehicles.",
      limitations: []
    };

    const engine = new SelfQuestioningEngine(provider, "System prompt");
    const result = await engine.analyze("Are there military vehicles?", [createTestImage()], "SINGLE_IMAGE_VQA");

    // The gate must decouple confidence and downgrade decision to INCONCLUSIVE
    expect(result.contract.finalDecision).toBe('INCONCLUSIVE');
    expect(result.contract.evidenceSufficiency).toBe('INSUFFICIENT');
    expect(result.trace.some(t => t.step === 'CONFIDENCE_DECOUPLING_ENFORCED')).toBe(true);
  });

  // 4. SELF-CHALLENGE & COUNTER-ANALYSIS
  it('4. checks alternative explanations and confounders during self-challenge', async () => {
    const provider = new TestMockProvider();
    provider.mockResponse = {
      claim: "Deforestation detected",
      requiredEvidence: ["Canopy removal", "Bare soil exposure"],
      observations: ["Dark brown patch where green cover was expected."],
      initialHypothesis: "Possible clear-cutting.",
      supportingEvidence: ["Discoloration in forested zone."],
      contradictingEvidence: ["Linear cloud shadow cast directly adjacent."],
      alternativeExplanations: ["Cloud shadow masking forest canopy", "Seasonal leaf drop"],
      confoundersChecked: ["Sun elevation angle", "Cloud proximity"],
      verificationResult: "Discoloration matches shadow projection.",
      evidenceSufficiency: "INSUFFICIENT",
      finalDecision: "INCONCLUSIVE",
      answer: "Apparent clearing is likely an artifact of cloud shadow rather than deforestation."
    };

    const engine = new SelfQuestioningEngine(provider, "System prompt");
    const result = await engine.analyze("Was this forest cut down?", [createTestImage()], "SINGLE_IMAGE_VQA");

    expect(result.contract.alternativeExplanations.length).toBeGreaterThan(0);
    expect(result.contract.confoundersChecked.length).toBeGreaterThan(0);
    expect(result.contract.finalDecision).toBe('INCONCLUSIVE');
    expect(result.audit.internalQuestions.length).toBe(6);
  });

  // 5. CONFLICTING EVIDENCE HANDLING (OPTICAL VS SAR)
  it('5. triggers Level 2 escalation and produces EVIDENCE_CONFLICT when optical and SAR disagree', async () => {
    const provider = new TestMockProvider();
    // Primary pass detects optical built structures, but flags SAR discrepancy
    provider.responseSequence = [
      {
        claim: "New construction verified by optical and SAR",
        observations: ["Optical shows bright rectangular shapes."],
        initialHypothesis: "New industrial warehouse.",
        supportingEvidence: ["High optical brightness."],
        contradictingEvidence: ["SAR radar backscatter is completely flat with no corner reflector double-bounce."],
        alternativeExplanations: ["Flat gravel patch or temporary plastic sheeting."],
        confoundersChecked: ["Sensor registration"],
        evidenceSufficiency: "CONFLICTING",
        finalDecision: "VERIFIED"
      },
      // Secondary verification pass arbitrates and downgrades
      {
        claim: "New construction evaluated across optical and SAR",
        observations: ["Optical shows bright patch; SAR shows flat specular return."],
        initialHypothesis: "New warehouse candidate.",
        supportingEvidence: ["Optical brightness."],
        contradictingEvidence: ["Zero double-bounce in radar backscatter."],
        alternativeExplanations: ["Graded soil or flat membrane."],
        confoundersChecked: ["Dielectric properties", "Radar wavelength"],
        verificationResult: "Sensors conflict: optical suggests building but SAR confirms absence of 3D vertical structure.",
        evidenceSufficiency: "CONFLICTING",
        finalDecision: "EVIDENCE_CONFLICT",
        answer: "EVIDENCE CONFLICT: Optical features suggest built structure, but SAR radar backscatter shows no vertical corner reflection."
      }
    ];

    const engine = new SelfQuestioningEngine(provider, "System prompt");
    const opticalImg = createTestImage('opt1', 'OPTICAL');
    const sarImg = createTestImage('sar1', 'SAR');

    const result = await engine.analyze("Does SAR confirm the optical change?", [opticalImg, sarImg], "OPTICAL_SAR_ANALYSIS");

    expect(result.budget.verificationLevel).toBe(2);
    expect(result.budget.modelCallsCount).toBe(2);
    expect(result.contract.finalDecision).toBe('EVIDENCE_CONFLICT');
    expect(result.contract.evidenceSufficiency).toBe('CONFLICTING');
  });

  // 6. MALFORMED MODEL RESPONSE VALIDATION & RECOVERY
  it('6. safely validates and normalizes malformed or incomplete model responses', () => {
    // Completely invalid object
    const nullContract = validateAndNormalizeAnalysisContract(null, "Test query");
    expect(nullContract.finalDecision).toBe('INVALID_INPUT');
    expect(nullContract.evidenceSufficiency).toBe('INSUFFICIENT');

    // Partial object missing required fields
    const partialRaw = {
      answer: "Partial text without schema",
      evidenceSufficiency: "garbage_value",
      observations: "A single string instead of array"
    };

    const recovered = validateAndNormalizeAnalysisContract(partialRaw, "Fallback query");
    expect(Array.isArray(recovered.observations)).toBe(true);
    expect(recovered.observations[0]).toBe("A single string instead of array");
    expect(Array.isArray(recovered.requiredEvidence)).toBe(true);
    expect(recovered.finalDecision).toBeDefined();
    expect(recovered.query).toBe("Fallback query");
  });

  // 7. CACHED ANALYSIS REUSE ACROSS QUERIES
  it('7. reuses cached analysis context and observations when querying the same image', async () => {
    const provider = new TestMockProvider();
    provider.mockResponse = {
      claim: "Water body detected",
      observations: ["Dark basin with distinct shoreline."],
      supportingEvidence: ["Water absorption signature."],
      contradictingEvidence: [],
      alternativeExplanations: [],
      confoundersChecked: [],
      verificationResult: "Water verified.",
      evidenceSufficiency: "STRONG",
      finalDecision: "VERIFIED",
      answer: "Water is present."
    };

    const engine = new SelfQuestioningEngine(provider, "System prompt");
    const image = createTestImage('reused_img');

    // Query 1: Initial inspection
    const res1 = await engine.analyze("Is there water?", [image], "SINGLE_IMAGE_VQA");
    expect(res1.audit.cacheHit).toBe(false);

    // Query 2: Follow-up question on same image
    const res2 = await engine.analyze("What about the shoreline?", [image], "SINGLE_IMAGE_VQA");
    expect(res2.audit.cacheHit).toBe(true);
    expect(res2.trace.some(t => t.step === 'CONTEXT_CACHE_HIT')).toBe(true);
  });

  // 8. API-CALL BUDGETING & TRACKING
  it('8. tracks model calls, tokens, and calculates cost savings against baseline', async () => {
    const provider = new TestMockProvider();
    provider.mockResponse = {
      claim: "General scene assessment",
      observations: ["Agricultural parcels."],
      supportingEvidence: ["Field boundaries."],
      contradictingEvidence: [],
      alternativeExplanations: [],
      confoundersChecked: [],
      verificationResult: "Agricultural land verified.",
      evidenceSufficiency: "STRONG",
      finalDecision: "VERIFIED",
      answer: "Agricultural land use."
    };

    const engine = new SelfQuestioningEngine(provider, "System prompt");
    const result = await engine.analyze("What land cover is this?", [createTestImage()], "SINGLE_IMAGE_VQA");

    expect(result.budget.modelCallsCount).toBe(1);
    expect(result.budget.inputTokens).toBe(120);
    expect(result.budget.outputTokens).toBe(80);
    expect(result.budget.totalTokens).toBe(200);
    expect(result.budget.actualCost).toBeGreaterThan(0);
    expect(result.budget.savings).toBeGreaterThan(0);
    expect(result.budget.savingsPercentage).toBeGreaterThan(0);
  });

  // 9. GROUNDING VALIDATION & BOX FILTERING
  it('9. validates, clamps, and filters invalid or inverted bounding boxes', () => {
    const rawBoxes = [
      { ymin: 100, xmin: 200, ymax: 500, xmax: 600, label: "Building 1" },    // Valid 0-1000 scale
      { ymin: 0.2, xmin: 0.3, ymax: 0.6, xmax: 0.7, label: "Water Reservoir" },// Valid 0-1 scale
      { ymin: 800, xmin: 500, ymax: 200, xmax: 300, label: "Inverted Box" },    // Inverted (ymin > ymax) -> must reject
      { ymin: 500, xmin: 500, ymax: 500, xmax: 500, label: "Zero Area Box" },    // Zero area -> must reject
      { ymin: -50, xmin: 0, ymax: 1200, xmax: 1000, label: "Clamped Box" },      // Out of bounds -> clamps & keeps if valid
      { ymin: "abc", xmin: 10, ymax: 50, xmax: 60, label: "Malformed Types" }   // Non-numeric -> must reject
    ];

    const validated = DeterministicEngine.validateGroundingBoxes(rawBoxes);
    expect(validated.length).toBe(3); // Only 3 are valid or clampable to non-zero valid regions
    expect(validated.some(b => b.label === "Building 1")).toBe(true);
    expect(validated.some(b => b.label === "Water Reservoir")).toBe(true);
    expect(validated.some(b => b.label === "Inverted Box")).toBe(false);
    expect(validated.some(b => b.label === "Zero Area Box")).toBe(false);
    
    // Check normalized 0-1 representation
    for (const b of validated) {
      expect(b.ymin).toBeGreaterThanOrEqual(0);
      expect(b.ymin).toBeLessThanOrEqual(1);
      expect(b.ymax).toBeGreaterThan(b.ymin);
      expect(b.xmax).toBeGreaterThan(b.xmin);
    }
  });

  // 10. FINAL DECISION GATE & ABSTENTION
  it('10. enforces abstention with NEEDS_MORE_EVIDENCE when evidence is weak', async () => {
    const provider = new TestMockProvider();
    provider.mockResponse = {
      claim: "Sub-surface pipeline leakage",
      observations: ["Subtle moisture hue in bare soil."],
      initialHypothesis: "Possible sub-surface pipe rupture.",
      supportingEvidence: ["Faint soil darkening."],
      contradictingEvidence: ["No thermal or hyperspectral SWIR band available."],
      alternativeExplanations: ["Topographic depression holding rainwater", "Organic soil matter patch"],
      confoundersChecked: ["Sensor band limitations"],
      verificationResult: "RGB imagery cannot definitively differentiate soil moisture from pipe leakage.",
      evidenceSufficiency: "WEAK",
      finalDecision: "NEEDS_MORE_EVIDENCE",
      answer: "Evidence is insufficient to confirm pipeline leakage. Thermal or SWIR multispectral bands are required."
    };

    const engine = new SelfQuestioningEngine(provider, "System prompt");
    const result = await engine.analyze("Is there a pipe leak here?", [createTestImage()], "SINGLE_IMAGE_VQA");

    expect(result.contract.finalDecision).toBe('NEEDS_MORE_EVIDENCE');
    expect(result.contract.evidenceSufficiency).toBe('WEAK');
    expect(result.formattedAnswer).toContain('DECISION\nNEEDS MORE EVIDENCE');
  });

});
