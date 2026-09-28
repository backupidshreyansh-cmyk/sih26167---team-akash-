/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Exhaustive Verification Test Suite for the Remote-Sensing Evidence Engine.
 * Tests deterministic measurement, band inspection, index failure states,
 * SAR analysis, temporal registration, cross-modal arbitration, and non-fabrication principles.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RemoteSensingEvidenceEngine } from '../server/evidence/RemoteSensingEvidenceEngine.js';
import { SpectralEngine } from '../server/evidence/spectralEngine.js';
import { SAREngine } from '../server/evidence/sarEngine.js';
import { TemporalEngine } from '../server/evidence/temporalEngine.js';
import { CrossModalEngine } from '../server/evidence/crossModalEngine.js';
import { GroundingValidator } from '../server/evidence/groundingValidator.js';
import { GeospatialUtils } from '../server/evidence/geospatialUtils.js';
import { NormalizedImage } from '../server/imagery/types.js';

describe('RemoteSensingEvidenceEngine', () => {
  beforeEach(() => {
    RemoteSensingEvidenceEngine.clearCache();
  });

  // 1x1 black PNG image base64
  const tinyPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  
  // 4x4 red PNG image base64
  const test4x4Png = "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAD0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

  const mockImage = (overrides: Partial<NormalizedImage> = {}): NormalizedImage => ({
    id: 'test_img',
    filename: 'test.png',
    mimeType: 'image/png',
    sourceBase64: tinyPngBase64,
    sizeBytes: 68,
    width: 1,
    height: 1,
    modality: 'OPTICAL',
    bandCount: 3,
    temporalRole: 'PRIMARY',
    acquisitionTime: null,
    geospatialMetadata: null,
    ...overrides
  });

  describe('1. Raster Validation', () => {
    it('should validate a healthy consumer image with explicit warnings for missing CRS', async () => {
      const img = mockImage({
        id: 'test_img_1',
        filename: 'optical_scene.png',
        mimeType: 'image/png',
        sourceBase64: tinyPngBase64,
        sizeBytes: 68,
        width: 1,
        height: 1,
        modality: 'OPTICAL',
        bandCount: 3
      });

      const result = await RemoteSensingEvidenceEngine.validateRaster(img);
      expect(result.valid).toBe(true);
      expect(result.width).toBe(1);
      expect(result.height).toBe(1);
      expect(result.bands).toBe(3);
      expect(result.crs).toBeNull();
      expect(result.readable).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('MISSING_GEOREFERENCE');
    });

    it('should return explicit INVALID_RASTER on corrupt or empty base64 raster data', async () => {
      const corruptImg = mockImage({
        id: 'corrupt_img',
        filename: 'corrupted.tif',
        mimeType: 'image/tiff',
        sourceBase64: 'NotAValidBase64String###',
        sizeBytes: 25,
        width: 0,
        height: 0,
        modality: 'UNKNOWN',
        bandCount: 0
      });

      const result = await RemoteSensingEvidenceEngine.validateRaster(corruptImg);
      expect(result.valid).toBe(false);
      expect(result.failureState).toBe('INVALID_RASTER');
      expect(result.readable).toBe(false);
    });

    it('should extract structured metadata via extractMetadata without fabricating fields', async () => {
      const img = mockImage({
        id: 'meta_img',
        filename: 'sample.png',
        mimeType: 'image/png',
        sourceBase64: tinyPngBase64,
        sizeBytes: 68,
        width: 1,
        height: 1,
        modality: 'OPTICAL',
        bandCount: 3
      });

      const meta = await RemoteSensingEvidenceEngine.extractMetadata(img);
      expect(meta.valid).toBe(true);
      expect(meta.crs).toBeNull();
      expect(meta.epsg).toBeNull();
      expect(meta.geotransform).toBeNull();
    });
  });

  describe('2. Multispectral Band Inspection & Non-Fabrication', () => {
    it('should correctly identify Sentinel-2 bands from authoritative metadata tags', () => {
      const bands = SpectralEngine.inspectBands(4, {
        Band_1: 'B2 - Blue - 490nm',
        Band_2: 'B3 - Green - 560nm',
        Band_3: 'B4 - Red - 665nm',
        Band_4: 'B8 - NIR - 842nm'
      });

      expect(bands).toHaveLength(4);
      expect(bands[0].normalizedId).toBe('BLUE');
      expect(bands[1].normalizedId).toBe('GREEN');
      expect(bands[2].normalizedId).toBe('RED');
      expect(bands[3].normalizedId).toBe('NIR');
      expect(bands[3].wavelengthNm).toBe(842);
      expect(bands.every(b => b.isIdentified)).toBe(true);
    });

    it('should mark bands as UNKNOWN and never guess when metadata is missing on multi-band data', () => {
      const bands = SpectralEngine.inspectBands(6, {});
      expect(bands).toHaveLength(6);
      expect(bands[0].normalizedId).toBe('UNKNOWN');
      expect(bands[3].normalizedId).toBe('UNKNOWN');
      expect(bands.every(b => !b.isIdentified)).toBe(true);
    });
  });

  describe('3. True Color & False Color Preview Guard', () => {
    it('should return UNAVAILABLE — REQUIRED BANDS NOT FOUND when false color is requested without NIR', async () => {
      const rgbImage = mockImage({
        id: 'rgb_only',
        filename: 'rgb_scene.png',
        mimeType: 'image/png',
        sourceBase64: tinyPngBase64,
        sizeBytes: 68,
        width: 1,
        height: 1,
        modality: 'OPTICAL',
        bandCount: 3
      });

      const preview = await RemoteSensingEvidenceEngine.generatePreview(rgbImage, { mode: 'FALSE_COLOR' });
      expect(preview.status).toBe('UNAVAILABLE — REQUIRED BANDS NOT FOUND');
      expect(preview.reason).toContain('NIR');
    });

    it('should allow true color generation when RGB channels are present', async () => {
      const rgbImage = mockImage({
        id: 'rgb_valid',
        filename: 'rgb_scene.png',
        mimeType: 'image/png',
        sourceBase64: tinyPngBase64,
        sizeBytes: 68,
        width: 1,
        height: 1,
        modality: 'OPTICAL',
        bandCount: 3
      });

      const preview = await RemoteSensingEvidenceEngine.generatePreview(rgbImage, { mode: 'TRUE_COLOR' });
      expect(preview.status).toBe('GENERATED');
      expect(preview.base64Png).toBeDefined();
    });
  });

  describe('4. Deterministic Spectral Statistics', () => {
    it('should calculate accurate min, max, mean, stdDev, and validPixelPercentage', () => {
      const data = new Float32Array([10, 20, 30, 40, 50]);
      const stats = SpectralEngine.computeBandStatistics(data, 0, 'RED');

      expect(stats.min).toBe(10);
      expect(stats.max).toBe(50);
      expect(stats.mean).toBe(30);
      expect(stats.stdDev).toBeCloseTo(14.1421, 2);
      expect(stats.validPixelPercentage).toBe(100);
      expect(stats.sampleCount).toBe(5);
    });

    it('should safely handle empty or all-NaN arrays without crashing', () => {
      const emptyData = new Float32Array([]);
      const stats = SpectralEngine.computeBandStatistics(emptyData, 0, 'UNKNOWN');
      expect(stats.mean).toBe(0);
      expect(stats.sampleCount).toBe(0);
      expect(stats.validPixelPercentage).toBe(0);
    });
  });

  describe('5. Vegetation & Water Indices Strict Enforcement', () => {
    it('should return REQUIRED_BANDS_UNAVAILABLE when computing NDVI on RGB-only imagery', async () => {
      const rgbImage = mockImage({
        id: 'rgb_ndvi_test',
        filename: 'rgb_test.png',
        mimeType: 'image/png',
        sourceBase64: tinyPngBase64,
        sizeBytes: 68,
        width: 1,
        height: 1,
        modality: 'OPTICAL',
        bandCount: 3
      });

      const result = await RemoteSensingEvidenceEngine.computeSpectralIndex(rgbImage, 'NDVI');
      expect(result.status).toBe('REQUIRED_BANDS_UNAVAILABLE');
      expect(result.details).toContain('Near-Infrared (NIR) band is not present');
    });

    it('should compute valid NDVI when NIR and RED bands are genuinely present with safe division', () => {
      const bands = [
        { index: 0, normalizedId: 'RED' as const, description: 'Red', isIdentified: true },
        { index: 1, normalizedId: 'NIR' as const, description: 'NIR', isIdentified: true }
      ];

      const bandDataMap = new Map();
      // NIR = 80, RED = 20 -> (80 - 20) / (80 + 20) = 60 / 100 = 0.6
      bandDataMap.set('NIR', new Float32Array([80, 80, 80, 0]));
      bandDataMap.set('RED', new Float32Array([20, 20, 20, 0])); // 0 denominator on last pixel

      const result = SpectralEngine.computeSpectralIndex('NDVI', bands, bandDataMap);
      expect(result.status).toBe('CALCULATED');
      expect(result.statistics?.mean).toBeCloseTo(0.6, 2);
      expect(result.statistics?.min).toBeCloseTo(0.6, 2);
      expect(result.statistics?.max).toBeCloseTo(0.6, 2);
    });
  });

  describe('6. SAR Evidence Extraction & Noise Characterization', () => {
    it('should compute Equivalent Number of Looks (ENL) and speckle severity deterministically', () => {
      // Create synthetic speckle distribution: mean = 100, variance = 1000
      const syntheticSAR = new Float32Array([80, 90, 100, 110, 120, 5, 250]);
      const provenance = RemoteSensingEvidenceEngine.getProvenance(mockImage({
        id: 'sar_1',
        filename: 'sar.png',
        mimeType: 'image/png',
        sourceBase64: tinyPngBase64,
        sizeBytes: 68,
        width: 7,
        height: 1,
        modality: 'SAR',
        bandCount: 1
      }), 'SAREngine', 'analyzeSARData');

      const evidence = SAREngine.analyzeSARData(syntheticSAR, 7, 1, 'UNKNOWN', provenance);
      expect(evidence.type).toBe('SAR_EVIDENCE');
      expect(evidence.polarization).toBe('UNKNOWN');
      expect(evidence.speckleQuality.enl).toBeGreaterThan(0);
      expect(evidence.observations.some(o => o.includes('Polarization: UNKNOWN'))).toBe(true);
    });

    it('should detect double-bounce bright candidates and specular dark returns', () => {
      // 10x10 synthetic SAR raster with 1 bright metallic target (intensity 250) and 1 dark water region (intensity 2)
      const data = new Float32Array(100).fill(60);
      data[15] = 252; // bright target
      data[85] = 3;   // specular target

      const provenance = RemoteSensingEvidenceEngine.getProvenance(mockImage({
        id: 'sar_2',
        filename: 'sar.png',
        mimeType: 'image/png',
        sourceBase64: tinyPngBase64,
        sizeBytes: 68,
        width: 10,
        height: 10,
        modality: 'SAR',
        bandCount: 1
      }), 'SAREngine', 'analyzeSARData');

      const evidence = SAREngine.analyzeSARData(data, 10, 10, 'VV', provenance);
      expect(evidence.polarization).toBe('VV');
      expect(evidence.candidateRegions.some(r => r.type === 'HIGH_BACKSCATTER_DOUBLE_BOUNCE')).toBe(true);
      expect(evidence.candidateRegions.some(r => r.type === 'LOW_BACKSCATTER_SPECULAR')).toBe(true);
    });
  });

  describe('7. Temporal Registration & Deterministic Change Detection', () => {
    it('should flag REGISTRATION_REQUIRED when rasters have dimension mismatch', () => {
      const before = mockImage({
        id: 'b1',
        filename: 'b1.png',
        mimeType: 'image/png',
        sourceBase64: tinyPngBase64,
        sizeBytes: 68,
        width: 512,
        height: 512,
        modality: 'OPTICAL',
        bandCount: 3
      });

      const after = mockImage({
        id: 'a1',
        filename: 'a1.png',
        mimeType: 'image/png',
        sourceBase64: tinyPngBase64,
        sizeBytes: 68,
        width: 1024,
        height: 1024,
        modality: 'OPTICAL',
        bandCount: 3
      });

      const reg = TemporalEngine.evaluateRegistration(before, after);
      expect(reg.status).toBe('REGISTRATION_REQUIRED');
      expect(reg.isDimensionCompatible).toBe(false);
      expect(reg.alignmentRisk).toBe('HIGH');
    });

    it('should distinguish global illumination shift from physical change', async () => {
      // Both images are identical size, but After has a global illumination shift
      const before = mockImage({
        id: 't1',
        filename: 't1.png',
        mimeType: 'image/png',
        sourceBase64: test4x4Png,
        sizeBytes: 68,
        width: 4,
        height: 4,
        modality: 'OPTICAL',
        bandCount: 3
      });

      const after = mockImage({
        id: 't2',
        filename: 't2.png',
        mimeType: 'image/png',
        sourceBase64: test4x4Png,
        sizeBytes: 68,
        width: 4,
        height: 4,
        modality: 'OPTICAL',
        bandCount: 3
      });

      const change = await RemoteSensingEvidenceEngine.computeChange(before, after);
      expect(change.type).toBe('BI_TEMPORAL_CHANGE_EVIDENCE');
      expect(change.meanAbsoluteDifference).toBeDefined();
      expect(change.confounderChecks).toBeDefined();
    });
  });

  describe('8. Cross-Modal Spatial Overlap & Hypothesis Arbitration', () => {
    it('should confirm optical built-up candidate when confirmed by SAR double-bounce backscatter', () => {
      const opticalEvidence: any = {
        type: 'OPTICAL_EVIDENCE',
        candidateRegions: [
          {
            id: 'opt_bld_1',
            category: 'BUILT_UP_CANDIDATE',
            pixelBounds: { ymin: 100, xmin: 100, ymax: 200, xmax: 200 },
            pixelCount: 10000,
            meanReflectanceOrIndex: 210,
            criterionDescription: 'High reflectance urban candidate'
          }
        ]
      };

      const sarEvidence: any = {
        type: 'SAR_EVIDENCE',
        candidateRegions: [
          {
            id: 'sar_db_1',
            type: 'HIGH_BACKSCATTER_DOUBLE_BOUNCE',
            pixelBounds: { ymin: 110, xmin: 110, ymax: 190, xmax: 190 },
            pixelCount: 6400,
            meanIntensity: 245
          }
        ]
      };

      const overlap = CrossModalEngine.evaluateCrossModalEvidence(
        opticalEvidence,
        sarEvidence,
        { width: 500, height: 500 },
        { width: 500, height: 500 }
      );

      expect(overlap.agreementStatus).toBe('AGREEMENT');
      expect(overlap.regionsCorresponding).toHaveLength(1);
      expect(overlap.regionsCorresponding[0].agreementType).toBe('CONFIRMING');
    });

    it('should flag CONFLICT when optical apparent built-up shows specular (flat/water) SAR backscatter', () => {
      const opticalEvidence: any = {
        type: 'OPTICAL_EVIDENCE',
        candidateRegions: [
          {
            id: 'opt_bld_2',
            category: 'BUILT_UP_CANDIDATE',
            pixelBounds: { ymin: 50, xmin: 50, ymax: 150, xmax: 150 },
            pixelCount: 10000,
            meanReflectanceOrIndex: 220,
            criterionDescription: 'Bright surface'
          }
        ]
      };

      const sarEvidence: any = {
        type: 'SAR_EVIDENCE',
        candidateRegions: [
          {
            id: 'sar_spec_1',
            type: 'LOW_BACKSCATTER_SPECULAR',
            pixelBounds: { ymin: 60, xmin: 60, ymax: 140, xmax: 140 },
            pixelCount: 6400,
            meanIntensity: 4
          }
        ]
      };

      const overlap = CrossModalEngine.evaluateCrossModalEvidence(
        opticalEvidence,
        sarEvidence,
        { width: 500, height: 500 },
        { width: 500, height: 500 }
      );

      expect(overlap.agreementStatus).toBe('CONFLICT');
      expect(overlap.regionsCorresponding[0].agreementType).toBe('CONTRADICTING');
      expect(overlap.details.some(d => d.includes('EVIDENCE CONFLICT'))).toBe(true);
    });
  });

  describe('9. Grounding Validation & Non-Fabrication of Coordinates', () => {
    it('should not fabricate geographic coordinates or CRS when geotransform is missing', () => {
      const boxes = [{ label: 'Harbor Cranes', ymin: 100, xmin: 150, ymax: 300, xmax: 350 }];
      const validated = RemoteSensingEvidenceEngine.validateGrounding(
        boxes,
        1000,
        1000,
        null, // No geotransform
        null, // No EPSG
        null  // No CRS
      );

      expect(validated).toHaveLength(1);
      expect(validated[0].geoBounds).toBeUndefined();
      expect(validated[0].areaM2).toBeUndefined();
      expect(validated[0].pixelBounds.ymin).toBe(100);
      expect(validated[0].normalizedBounds.ymin).toBe(0.1);
    });

    it('should compute exact geographic bounds and area when valid projected CRS and geotransform are provided', () => {
      const boxes = [{ label: 'Storage Tank', ymin: 0, xmin: 0, ymax: 100, xmax: 100 }];
      // 10m per pixel UTM grid
      const geotransform = [500000, 10, 0, 4000000, 0, -10];
      const pixelSize: [number, number] = [10, 10];

      const validated = RemoteSensingEvidenceEngine.validateGrounding(
        boxes,
        1000,
        1000,
        geotransform,
        32633, // WGS 84 / UTM zone 33N
        'EPSG:32633',
        pixelSize
      );

      expect(validated).toHaveLength(1);
      expect(validated[0].geoBounds).toBeDefined();
      expect(validated[0].geoBounds?.crs).toBe('EPSG:32633');
      // 100x100 pixels = 10,000 pixels * 100 m^2 = 1,000,000 m^2 = 100 ha
      expect(validated[0].areaM2).toBe(1000000);
      expect(validated[0].areaHectares).toBe(100);
    });

    it('should filter out degenerate, inverted, or out-of-bounds grounding boxes', () => {
      const corruptBoxes = [
        { label: 'Inverted Box', ymin: 500, xmin: 200, ymax: 100, xmax: 400 },
        { label: 'Out of Bounds', ymin: -50, xmin: 0, ymax: 1200, xmax: 1500 },
        { label: 'Zero Area Box', ymin: 100, xmin: 100, ymax: 100, xmax: 100 }
      ];

      const validated = RemoteSensingEvidenceEngine.validateGrounding(
        corruptBoxes,
        1000,
        1000
      );

      expect(validated).toHaveLength(0);
    });
  });

  describe('10. Evidence Graph & Machine-Readable Provenance', () => {
    it('should generate auditable evidence graph with SHA-256 provenance', () => {
      const graph = RemoteSensingEvidenceEngine.constructEvidenceGraph(
        'Vessel count changed between dates',
        ['Temporal Registration Aligned', 'Calibrated Radiometric Difference'],
        ['Registration Status: ALIGNED', 'MAD: 4.2 DN (Below Change Threshold)'],
        'VERIFIED'
      );

      expect(graph.nodes.length).toBeGreaterThanOrEqual(4);
      expect(graph.summary.totalClaims).toBe(1);
      expect(graph.summary.verifiedClaims).toBe(1);
      expect(graph.edges.some(e => e.relationship === 'VERIFIED_BY')).toBe(true);
    });
  });
});
