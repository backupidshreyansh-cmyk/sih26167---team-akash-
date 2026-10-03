import { describe, it, expect, beforeEach } from 'vitest';
import { SelfQuestioningEngine } from '../server/agent/selfQuestioningEngine.js';
import { classifyTask, classifyQueryIntent } from '../server/agent/taskClassifier.js';
import { validateAndNormalizeAnalysisContract } from '../server/analysis/analysisContract.js';
import { globalContextCache } from '../server/analysis/contextCache.js';
import { NormalizedImage } from '../server/imagery/types.js';
import { AIProvider, AIProviderRequest, AIProviderResponse } from '../server/providers/AIProvider.js';

const TEST_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

class RegressionMockProvider implements AIProvider {
  public callCount = 0;
  public mockResponse: any = null;

  async isAvailable() { return true; }

  async generateContent(req: AIProviderRequest): Promise<AIProviderResponse> {
    this.callCount++;
    const res = this.mockResponse || {
      claim: "Visual features identified in scene",
      observations: ["Green-toned vegetation pixels observed in central area.", "Dark water-like texture visible."],
      supportingEvidence: ["Pixel hue and texture consistent with surface vegetation."],
      contradictingEvidence: [],
      alternativeExplanations: [],
      confoundersChecked: [],
      verificationResult: "Presence of vegetation and surface patterns directly visible.",
      evidenceSufficiency: "STRONG",
      finalDecision: "VERIFIED",
      answer: "Vegetation and distinct surface features are visible in the scene."
    };

    return {
      provider: "RegressionMockProvider",
      model: "test-model-v1",
      executionTrace: [{ step: "MOCK_GENERATE", status: "SUCCESS" }],
      tokenUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150, cachedTokens: 0 },
      ...res
    };
  }
}

function makeImage(id: string, role: 'PRIMARY' | 'BEFORE' | 'AFTER' = 'PRIMARY', hasGeoref = false): NormalizedImage {
  return {
    id,
    filename: `${id}.png`,
    mimeType: 'image/png',
    sizeBytes: 68,
    width: 1,
    height: 1,
    bandCount: 3,
    modality: 'OPTICAL',
    temporalRole: role,
    acquisitionTime: null, // intentionally missing acquisition date
    geospatialMetadata: hasGeoref ? {
      crs: 'WGS 84 / UTM zone 43N',
      epsg: 32643,
      bounds: [100, 200, 300, 400],
      pixelSize: [10, 10],
      geotransform: [100, 10, 0, 400, 0, -10],
      metadataTags: {}
    } : null, // intentionally missing georeferencing
    sourceBase64: TEST_PNG_BASE64
  };
}

describe('Visual Observation vs Change Analysis Intent Separation & Strict Gates', () => {

  beforeEach(() => {
    globalContextCache.clear();
  });

  // 1. INTENT CLASSIFICATION UNIT CHECKS
  describe('Query Intent Classification', () => {
    it('classifies visual observation queries correctly', () => {
      expect(classifyQueryIntent("What is visible in this image?")).toBe('VISUAL_OBSERVATION');
      expect(classifyQueryIntent("Is vegetation present?")).toBe('VISUAL_OBSERVATION');
      expect(classifyQueryIntent("Describe the visible features")).toBe('VISUAL_OBSERVATION');
      expect(classifyQueryIntent("What colors and patterns are visible?")).toBe('VISUAL_OBSERVATION');
      expect(classifyQueryIntent("Describe the visible textures and light/dark regions.")).toBe('VISUAL_OBSERVATION');
    });

    it('classifies temporal change queries correctly', () => {
      expect(classifyQueryIntent("Did built-up area expand?")).toBe('TEMPORAL_CHANGE');
      expect(classifyQueryIntent("Has vegetation decreased between these dates?")).toBe('TEMPORAL_CHANGE');
      expect(classifyQueryIntent("What changed between these observations?")).toBe('TEMPORAL_CHANGE');
    });

    it('classifies causal attribution queries correctly', () => {
      expect(classifyQueryIntent("Did construction occur?")).toBe('CAUSAL_ATTRIBUTION');
      expect(classifyQueryIntent("What caused this deforestation?")).toBe('CAUSAL_ATTRIBUTION');
      expect(classifyQueryIntent("Why did vegetation decrease?")).toBe('CAUSAL_ATTRIBUTION');
      expect(classifyQueryIntent("Is this change caused by flood damage?")).toBe('CAUSAL_ATTRIBUTION');
    });

    it('classifies geolocation and measurement queries correctly', () => {
      expect(classifyQueryIntent("What are the exact GPS coordinates?")).toBe('GEO_COORDINATES');
      expect(classifyQueryIntent("What is the exact area in hectares?")).toBe('QUANTITATIVE_MEASUREMENT');
      expect(classifyQueryIntent("What are the pixel dimensions and bands?")).toBe('METADATA');
      expect(classifyQueryIntent("Calculate NDVI index")).toBe('SPECTRAL_INDEX');
    });
  });

  // 2. VISUAL OBSERVATION ON SINGLE IMAGE
  describe('Visual Observation on Single Image', () => {
    it('allows a VERIFIED answer when the image directly supports the observation without dates or georeferencing', async () => {
      const provider = new RegressionMockProvider();
      provider.mockResponse = {
        claim: "Presence of visible vegetation and surface textures",
        observations: ["Green-toned vegetation pixels directly visible in image.", "Clear contrast between light and dark regions."],
        supportingEvidence: ["Color spectrum and spatial pattern indicate vegetation."],
        contradictingEvidence: [],
        alternativeExplanations: [],
        confoundersChecked: [],
        verificationResult: "Direct visual inspection confirms presence of vegetation features.",
        evidenceSufficiency: "STRONG",
        finalDecision: "VERIFIED",
        answer: "Vegetation is clearly visible in the image based on direct surface coloration and pattern."
      };

      const engine = new SelfQuestioningEngine(provider, "System prompt");
      const unreferencedImage = makeImage('single_img', 'PRIMARY', false); // No CRS, no date

      const result = await engine.analyze("Is vegetation present?", [unreferencedImage], "SINGLE_IMAGE_VQA");

      // Visual observation MUST be VERIFIED because the image directly supports the observation
      expect(result.contract.finalDecision).toBe('VERIFIED');
      expect(result.contract.evidenceSufficiency).toBe('STRONG');
      expect(result.contract.whyNotVerified).toBeUndefined();
      expect(result.contract.answer).toContain('DIRECT OBSERVATIONS');
      expect(result.contract.answer).toContain('**DECISION**:\nVERIFIED');
    });

    it('answers "What is visible in this image?" with VERIFIED when features are directly isolated', async () => {
      const provider = new RegressionMockProvider();
      const engine = new SelfQuestioningEngine(provider, "System prompt");
      const unreferencedImage = makeImage('single_obs', 'PRIMARY', false);

      const result = await engine.analyze("What is visible in this image?", [unreferencedImage], "SCENE_DESCRIPTION");

      expect(result.contract.finalDecision).toBe('VERIFIED');
      expect(result.contract.whyNotVerified).toBeUndefined();
    });
  });

  // 3. VISUAL OBSERVATION ON IMAGES LABELED BEFORE / AFTER
  describe('Visual Observation on Images Labeled Before/After', () => {
    it('does not force BI_TEMPORAL_ANALYSIS when query is visual observation on before/after images', () => {
      const beforeImg = makeImage('img_t1', 'BEFORE');
      const afterImg = makeImage('img_t2', 'AFTER');

      const task = classifyTask("What is visible in this image?", [beforeImg, afterImg]);
      expect(task).not.toBe('BI_TEMPORAL_ANALYSIS');
      expect(task).toBe('SCENE_DESCRIPTION');
    });

    it('allows a VERIFIED answer for visual features even when multiple images are present in the bay', async () => {
      const provider = new RegressionMockProvider();
      provider.mockResponse = {
        claim: "Visible features across observations",
        observations: ["Surface pattern with distinct linear features visible in both observations."],
        supportingEvidence: ["Direct geometric line features visible in raster pixels."],
        contradictingEvidence: [],
        alternativeExplanations: [],
        confoundersChecked: [],
        verificationResult: "Observable surface features directly verified in raster bitstream.",
        evidenceSufficiency: "STRONG",
        finalDecision: "VERIFIED",
        answer: "Visible linear features and surface textures are observable in the images."
      };

      const engine = new SelfQuestioningEngine(provider, "System prompt");
      const beforeImg = makeImage('img_t1', 'BEFORE');
      const afterImg = makeImage('img_t2', 'AFTER');

      const result = await engine.analyze(
        "Describe the visible features", 
        [beforeImg, afterImg], 
        "SCENE_DESCRIPTION"
      );

      // Must NOT be clamped to inconclusive or fail on temporal gates
      expect(result.contract.finalDecision).toBe('VERIFIED');
      expect(result.contract.whyNotVerified).toBeUndefined();
    });
  });

  // 4. STRICT GATES FOR STRONGER CLAIMS
  describe('Strict Evidence Gates for Stronger Claims', () => {

    it('strictly abstains with NEEDS_MORE_DATA for temporal change inquiry on a single image', async () => {
      const provider = new RegressionMockProvider();
      const engine = new SelfQuestioningEngine(provider, "System prompt");
      const singleImage = makeImage('single_img', 'PRIMARY');

      const result = await engine.analyze("Did built-up area expand?", [singleImage], "SINGLE_IMAGE_VQA");

      expect(result.contract.finalDecision).toBe('NEEDS_MORE_DATA');
      expect(result.contract.evidenceSufficiency).toBe('INSUFFICIENT');
      expect(result.contract.whyNotVerified).toContain('Establishing change requires comparing at least two observations');
      expect(result.contract.requiredObservation).toContain('A comparable observation of this Area of Interest');
    });

    it('strictly enforces INCONCLUSIVE for causal claims (e.g. did construction occur) even when surface differences exist', async () => {
      const provider = new RegressionMockProvider();
      // Model tries to claim VERIFIED that construction occurred
      provider.mockResponse = {
        claim: "Construction occurred between observations",
        observations: ["Surface pixel reflectance changed from green to gray-brown."],
        supportingEvidence: ["Change pattern is consistent with ground clearing."],
        contradictingEvidence: [],
        alternativeExplanations: ["Seasonal vegetation senescence", "Agricultural tilling"],
        confoundersChecked: [],
        verificationResult: "Surface difference verified.",
        evidenceSufficiency: "STRONG",
        finalDecision: "VERIFIED", // Model overclaiming causality!
        answer: "Construction is confirmed to have occurred."
      };

      const engine = new SelfQuestioningEngine(provider, "System prompt");
      const beforeImg = makeImage('b1', 'BEFORE');
      const afterImg = makeImage('a1', 'AFTER');

      const result = await engine.analyze("Did construction occur?", [beforeImg, afterImg], "BI_TEMPORAL_ANALYSIS");

      // STRICT GATE: Visual difference does NOT prove construction caused it.
      expect(result.contract.finalDecision).toBe('INCONCLUSIVE');
      expect(result.contract.whyNotVerified).toBeDefined();
      expect(result.contract.whyNotVerified).toContain('cannot be verified specifically as permanent land-use change, construction cause, or deforestation');
    });

    it('strictly enforces INCONCLUSIVE for deforestation attribution claims without calibrated seasonal baseline', async () => {
      const contract = validateAndNormalizeAnalysisContract(
        {
          claim: "Deforestation took place",
          observations: ["Lower green reflectance in east quadrant."],
          supportingEvidence: ["Canopy difference observed."],
          contradictingEvidence: [],
          alternativeExplanations: ["Deciduous leaf drop", "Drought stress"],
          confoundersChecked: ["Sun illumination angle"],
          verificationResult: "Visual change observed.",
          evidenceSufficiency: "STRONG",
          finalDecision: "VERIFIED",
          answer: "Deforestation verified."
        },
        "What caused this deforestation?"
      );

      expect(contract.finalDecision).toBe('INCONCLUSIVE');
      expect(contract.whyNotVerified).toContain('cannot be verified specifically as permanent land-use change');
    });

    it('strictly enforces abstention when exact GPS coordinates are requested on unreferenced raster', async () => {
      const provider = new RegressionMockProvider();
      const engine = new SelfQuestioningEngine(provider, "System prompt");
      const unreferencedImage = makeImage('no_geo', 'PRIMARY', false);

      const result = await engine.analyze("What are the exact GPS coordinates?", [unreferencedImage], "SINGLE_IMAGE_VQA");

      expect(result.contract.finalDecision).toBe('INCONCLUSIVE');
      expect(result.contract.evidenceSufficiency).toBe('INSUFFICIENT');
      expect(result.contract.whyNotVerified).toContain('The supplied image does not contain authoritative GeoTIFF georeferencing tags');
    });
  });

  // 5. RESULT PRESENTATION ORDER & PLAIN LANGUAGE EXPLANATIONS
  describe('Result Presentation & Plain Language Explanations', () => {
    it('formats answer with Direct Observations first, then Interpretation, Decision, Limitations', async () => {
      const provider = new RegressionMockProvider();
      const engine = new SelfQuestioningEngine(provider, "System prompt");
      const image = makeImage('test_img', 'PRIMARY');

      const result = await engine.analyze("What is visible in this image?", [image], "SINGLE_IMAGE_VQA");

      const ans = result.contract.answer;
      const obsIdx = ans.indexOf('**DIRECT OBSERVATIONS**:');
      const intIdx = ans.indexOf('**INTERPRETATION**:');
      const decIdx = ans.indexOf('**DECISION**:');
      const limIdx = ans.indexOf('**LIMITATIONS**:');

      expect(obsIdx).toBeGreaterThanOrEqual(0);
      expect(intIdx).toBeGreaterThan(obsIdx);
      expect(decIdx).toBeGreaterThan(intIdx);
      expect(limIdx).toBeGreaterThan(decIdx);
    });

    it('provides plain-language explanation of missing evidence when abstaining', async () => {
      const provider = new RegressionMockProvider();
      const engine = new SelfQuestioningEngine(provider, "System prompt");
      const singleImage = makeImage('single_test', 'PRIMARY');

      const result = await engine.analyze("Did built-up area expand?", [singleImage], "SINGLE_IMAGE_VQA");

      const ans = result.contract.answer;
      expect(ans).toContain('**WHAT IS NOT ESTABLISHED**:');
      expect(ans).toContain('**WHY SYSTEM ABSTAINED**:');
      expect(ans).toContain('**REQUIRED EVIDENCE**:');
      expect(ans).toContain('**RECOMMENDED UPLOAD**:');
    });
  });
});
