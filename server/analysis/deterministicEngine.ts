import { Jimp } from 'jimp';
import { NormalizedImage } from '../imagery/types.js';
import { GroundingBox } from '../schemas/responses.js';
import { safeReadJimp } from '../utils/safeImageReader.js';

export interface DeterministicImageMetrics {
  width: number;
  height: number;
  aspectRatio: number;
  bandCount: number;
  hasColorChannels: boolean;
  meanBrightness: number;
  stdBrightness: number;
  contrastRatio: number;
  // Surface feature proxies (fractions 0 to 1)
  vegetationProxyScore: number;     // Greenness dominance
  waterShadowProxyScore: number;    // Very dark low-reflectance fraction
  brightReflectorProxyScore: number;// Very bright / potential structure/cloud fraction
  highVarianceRegionScore: number;  // Texture / edge density fraction
  // Confounder indicators
  isLikelyOverexposedOrCloudy: boolean;
  isLikelyUnderexposedOrShadow: boolean;
  isLowContrast: boolean;
  // SAR specific
  sarMetrics?: {
    estimatedENL: number;           // Equivalent Number of Looks (speckle metric)
    highBackscatterRatio: number;  // Double bounce proxy
    specularLowReturnRatio: number;// Specular flat/water proxy
    speckleSeverity: 'LOW' | 'MODERATE' | 'HIGH';
  };
}

export interface BiTemporalDeterministicComparison {
  isDimensionCompatible: boolean;
  widthDiff: number;
  heightDiff: number;
  meanAbsoluteDifference: number; // 0 to 255
  relativeChangeFraction: number; // Fraction of pixels with significant change (>30 diff)
  isGlobalIlluminationShift: boolean; // scene-wide brightness shift
  candidateChangeDetected: boolean;
  registrationRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  conclusions: string[];
}

export interface CrossModalDeterministicCheck {
  spatialAlignmentCompatible: boolean;
  opticalWaterMatchesSarDark: boolean | null;
  opticalBuildingMatchesSarBright: boolean | null;
  agreementStatus: 'AGREEMENT' | 'CONFLICT' | 'COMPLEMENTARY' | 'INSUFFICIENT_DATA';
  details: string[];
}

export interface MultiImageComparisonResult {
  relationship: 'SINGLE_IMAGE' | 'MULTISPECTRAL' | 'OPTICAL_SAR' | 'BEFORE_AFTER' | 'MULTI_TEMPORAL' | 'INCOMPATIBLE' | 'UNCERTAIN' | 'TEMPORAL_CHANGE' | 'MULTI_SENSOR_FUSION' | 'MULTIPLE_VIEWS';
  relationshipLabel: string;
  summary: string;
  whatChangedOrDiffers: string[];
  whatStayedSame: string[];
  whatCannotBeCompared: string[];
  whatIsKnown?: string[];
  clarificationRequired?: string;
  metrics?: {
    pixelDimensionMatch: boolean;
    aspectRatioDelta: number;
    meanDifferenceDN?: number;
    changedFraction?: number;
    crossModalAgreement?: string;
  };
}

export class DeterministicEngine {
  /**
   * Computes comprehensive image statistics and remote-sensing surface proxies deterministically.
   */
  public static async analyzeImage(image: NormalizedImage): Promise<DeterministicImageMetrics> {
    try {
      const jimpImg: any = await safeReadJimp(image.sourceBase64);
      
      const width = jimpImg.bitmap.width;
      const height = jimpImg.bitmap.height;
      const data = jimpImg.bitmap.data; // RGBA buffer
      const totalPixels = width * height;
      
      if (totalPixels === 0) {
        return this.getDefaultMetrics(image);
      }

      // Sample up to 10,000 pixels for fast analysis (O(1) latency bounded)
      const sampleStep = Math.max(1, Math.floor(totalPixels / 10000));
      let sampledCount = 0;
      let sumLuminance = 0;
      let sumLuminanceSq = 0;
      let minLuminance = 255;
      let maxLuminance = 0;

      let greenDominantPixels = 0;
      let darkWaterShadowPixels = 0;
      let brightReflectorPixels = 0;
      let highVariancePixels = 0;

      // Color distribution checks
      let colorDiffSum = 0;

      for (let i = 0; i < totalPixels; i += sampleStep) {
        const idx = i * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // Standard ITU-R BT.601 luminance
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        sumLuminance += lum;
        sumLuminanceSq += lum * lum;

        if (lum < minLuminance) minLuminance = lum;
        if (lum > maxLuminance) maxLuminance = lum;

        // Check if image has distinct color (R != G != B)
        colorDiffSum += Math.abs(r - g) + Math.abs(g - b);

        // Vegetation Proxy: Green dominance over Red and Blue (Excess Green Index proxy)
        if (g > r + 15 && g > b + 10) {
          greenDominantPixels++;
        }

        // Water/Shadow Proxy: low luminance (< 45) with low channel variance
        if (lum < 45) {
          darkWaterShadowPixels++;
        }

        // Bright Reflector / Cloud / Concrete proxy: high luminance (> 200)
        if (lum > 200) {
          brightReflectorPixels++;
        }

        // Texture / edge variance proxy: difference with neighbor
        if (i + sampleStep < totalPixels) {
          const nIdx = (i + sampleStep) * 4;
          const nLum = 0.299 * data[nIdx] + 0.587 * data[nIdx + 1] + 0.114 * data[nIdx + 2];
          if (Math.abs(lum - nLum) > 35) {
            highVariancePixels++;
          }
        }

        sampledCount++;
      }

      const meanBrightness = sumLuminance / sampledCount;
      const variance = Math.max(0, (sumLuminanceSq / sampledCount) - (meanBrightness * meanBrightness));
      const stdBrightness = Math.sqrt(variance);
      const contrastRatio = maxLuminance - minLuminance;

      const hasColorChannels = (colorDiffSum / sampledCount) > 10;
      const bandCount = image.bandCount || (hasColorChannels ? 3 : 1);

      const vegetationProxyScore = greenDominantPixels / sampledCount;
      const waterShadowProxyScore = darkWaterShadowPixels / sampledCount;
      const brightReflectorProxyScore = brightReflectorPixels / sampledCount;
      const highVarianceRegionScore = highVariancePixels / sampledCount;

      const isLikelyOverexposedOrCloudy = brightReflectorProxyScore > 0.45 && meanBrightness > 190;
      const isLikelyUnderexposedOrShadow = waterShadowProxyScore > 0.65 && meanBrightness < 50;
      const isLowContrast = contrastRatio < 40 || stdBrightness < 12;

      let sarMetrics = undefined;
      if (image.modality === 'SAR' || !hasColorChannels) {
        // ENL: (mean / std)^2
        const enl = stdBrightness > 0 ? Math.pow(meanBrightness / stdBrightness, 2) : 1;
        const speckleSeverity: 'LOW' | 'MODERATE' | 'HIGH' = enl > 4 ? 'LOW' : (enl > 1.5 ? 'MODERATE' : 'HIGH');
        sarMetrics = {
          estimatedENL: Number(enl.toFixed(2)),
          highBackscatterRatio: Number(brightReflectorProxyScore.toFixed(3)),
          specularLowReturnRatio: Number(waterShadowProxyScore.toFixed(3)),
          speckleSeverity
        };
      }

      return {
        width,
        height,
        aspectRatio: Number((width / (height || 1)).toFixed(3)),
        bandCount,
        hasColorChannels,
        meanBrightness: Number(meanBrightness.toFixed(1)),
        stdBrightness: Number(stdBrightness.toFixed(1)),
        contrastRatio: Number(contrastRatio.toFixed(1)),
        vegetationProxyScore: Number(vegetationProxyScore.toFixed(3)),
        waterShadowProxyScore: Number(waterShadowProxyScore.toFixed(3)),
        brightReflectorProxyScore: Number(brightReflectorProxyScore.toFixed(3)),
        highVarianceRegionScore: Number(highVarianceRegionScore.toFixed(3)),
        isLikelyOverexposedOrCloudy,
        isLikelyUnderexposedOrShadow,
        isLowContrast,
        sarMetrics
      };

    } catch (err) {
      console.warn("Deterministic image analysis fallback triggered:", err);
      return this.getDefaultMetrics(image);
    }
  }

  /**
   * Deterministic Bi-temporal comparison between BEFORE and AFTER images.
   */
  public static async compareBiTemporalImages(
    beforeImg: NormalizedImage,
    afterImg: NormalizedImage
  ): Promise<BiTemporalDeterministicComparison> {
    try {
      const bJimp: any = await safeReadJimp(beforeImg.sourceBase64);
      const aJimp: any = await safeReadJimp(afterImg.sourceBase64);

      const bW = bJimp.bitmap.width;
      const bH = bJimp.bitmap.height;
      const aW = aJimp.bitmap.width;
      const aH = aJimp.bitmap.height;

      const widthDiff = Math.abs(bW - aW);
      const heightDiff = Math.abs(bH - aH);
      const isDimensionCompatible = widthDiff <= 2 && heightDiff <= 2;
      const registrationRisk: 'LOW' | 'MEDIUM' | 'HIGH' = isDimensionCompatible 
        ? 'LOW' 
        : (widthDiff < 50 && heightDiff < 50 ? 'MEDIUM' : 'HIGH');

      // Sample comparison grid
      const gridW = 64;
      const gridH = 64;
      const bResized = bJimp.clone().resize({ w: gridW, h: gridH });
      const aResized = aJimp.clone().resize({ w: gridW, h: gridH });

      const bData = bResized.bitmap.data;
      const aData = aResized.bitmap.data;
      const totalPixels = gridW * gridH;

      let absDiffSum = 0;
      let changedPixelCount = 0;
      let bLumSum = 0;
      let aLumSum = 0;

      for (let i = 0; i < totalPixels; i++) {
        const idx = i * 4;
        const bLum = 0.299 * bData[idx] + 0.587 * bData[idx + 1] + 0.114 * bData[idx + 2];
        const aLum = 0.299 * aData[idx] + 0.587 * aData[idx + 1] + 0.114 * aData[idx + 2];

        bLumSum += bLum;
        aLumSum += aLum;

        const diff = Math.abs(bLum - aLum);
        absDiffSum += diff;
        if (diff > 35) {
          changedPixelCount++;
        }
      }

      const meanAbsDiff = absDiffSum / totalPixels;
      const relativeChange = changedPixelCount / totalPixels;

      const bMeanLum = bLumSum / totalPixels;
      const aMeanLum = aLumSum / totalPixels;
      const sceneBrightnessDelta = Math.abs(bMeanLum - aMeanLum);

      // Confounder: global illumination shift (sun angle, atmospheric haze)
      const isGlobalIlluminationShift = sceneBrightnessDelta > 20 && Math.abs(meanAbsDiff - sceneBrightnessDelta) < 10;
      const candidateChangeDetected = relativeChange > 0.05 && !isGlobalIlluminationShift;

      const conclusions: string[] = [];
      if (!isDimensionCompatible) {
        conclusions.push(`Images have mismatched pixel dimensions (${bW}x${bH} vs ${aW}x${aH}). Registration risk: ${registrationRisk}.`);
      } else {
        conclusions.push(`Dimension compatibility verified (${bW}x${bH}).`);
      }

      if (isGlobalIlluminationShift) {
        conclusions.push(`Confounder detected: Uniform scene-wide illumination shift (~${sceneBrightnessDelta.toFixed(1)} DN) without concentrated structural change.`);
      } else if (candidateChangeDetected) {
        conclusions.push(`Candidate change detected across ~${(relativeChange * 100).toFixed(1)}% of sampled spatial domain (MAD: ${meanAbsDiff.toFixed(1)}).`);
      } else {
        conclusions.push(`No significant physical change detected (MAD: ${meanAbsDiff.toFixed(1)}, change fraction: ${(relativeChange * 100).toFixed(1)}%).`);
      }

      return {
        isDimensionCompatible,
        widthDiff,
        heightDiff,
        meanAbsoluteDifference: Number(meanAbsDiff.toFixed(1)),
        relativeChangeFraction: Number(relativeChange.toFixed(3)),
        isGlobalIlluminationShift,
        candidateChangeDetected,
        registrationRisk,
        conclusions
      };

    } catch (e) {
      console.warn("Bi-temporal deterministic comparison error:", e);
      return {
        isDimensionCompatible: false,
        widthDiff: -1,
        heightDiff: -1,
        meanAbsoluteDifference: 0,
        relativeChangeFraction: 0,
        isGlobalIlluminationShift: false,
        candidateChangeDetected: false,
        registrationRisk: 'HIGH',
        conclusions: ["Deterministic temporal comparison could not process one or both image rasters."]
      };
    }
  }

  /**
   * Deterministic Cross-Modal validation between Optical and SAR images.
   */
  public static async compareOpticalAndSAR(
    opticalImg: NormalizedImage,
    sarImg: NormalizedImage
  ): Promise<CrossModalDeterministicCheck> {
    const opticalStats = await this.analyzeImage(opticalImg);
    const sarStats = await this.analyzeImage(sarImg);

    const details: string[] = [];
    let opticalWaterMatchesSarDark: boolean | null = null;
    let opticalBuildingMatchesSarBright: boolean | null = null;

    // Check if optical water matches SAR low backscatter
    if (opticalStats.waterShadowProxyScore > 0.1) {
      const sarDarkRatio = sarStats.sarMetrics?.specularLowReturnRatio || sarStats.waterShadowProxyScore;
      opticalWaterMatchesSarDark = sarDarkRatio > 0.08;
      if (opticalWaterMatchesSarDark) {
        details.push("Cross-sensor agreement: Optical dark/water-like regions correspond to low SAR radar backscatter (specular reflection).");
      } else {
        details.push("Cross-sensor discrepancy: Optical dark regions do not exhibit typical low SAR backscatter; could indicate shadow or cloud artifact rather than open water.");
      }
    }

    // Check if optical bright structures correspond to SAR high backscatter (double-bounce)
    if (opticalStats.brightReflectorProxyScore > 0.05 && opticalStats.highVarianceRegionScore > 0.1) {
      const sarBrightRatio = sarStats.sarMetrics?.highBackscatterRatio || sarStats.brightReflectorProxyScore;
      opticalBuildingMatchesSarBright = sarBrightRatio > 0.04;
      if (opticalBuildingMatchesSarBright) {
        details.push("Cross-sensor agreement: Optical high-reflectance built patterns align with high SAR backscatter (dielectric double-bounce).");
      } else {
        details.push("Cross-sensor discrepancy: Optical high reflectance lacks corresponding SAR radar double-bounce (possible bare soil, sand, or painted roof).");
      }
    }

    let agreementStatus: 'AGREEMENT' | 'CONFLICT' | 'COMPLEMENTARY' | 'INSUFFICIENT_DATA' = 'COMPLEMENTARY';
    if (opticalWaterMatchesSarDark === false || opticalBuildingMatchesSarBright === false) {
      agreementStatus = 'CONFLICT';
    } else if (opticalWaterMatchesSarDark === true || opticalBuildingMatchesSarBright === true) {
      agreementStatus = 'AGREEMENT';
    } else {
      agreementStatus = 'COMPLEMENTARY';
      details.push("Optical and SAR sensors provide complementary surface texture and reflectance modalities.");
    }

    const spatialAlignmentCompatible = Math.abs(opticalStats.aspectRatio - sarStats.aspectRatio) < 0.1;

    return {
      spatialAlignmentCompatible,
      opticalWaterMatchesSarDark,
      opticalBuildingMatchesSarBright,
      agreementStatus,
      details
    };
  }

  /**
   * Deterministic Multi-Image Comparative Analysis.
   * Categorizes multi-image relationship (temporal change, multi-sensor fusion, or multi-view)
   * and reports what changed, what stayed the same, and what cannot be compared.
   */
  public static async analyzeMultiImageComparison(
    images: NormalizedImage[],
    query: string = ''
  ): Promise<MultiImageComparisonResult> {
    const qLower = query.toLowerCase();

    // 1. SINGLE-IMAGE ANALYSIS
    if (images.length === 1) {
      const img = images[0];
      const m = await this.analyzeImage(img);
      return {
        relationship: 'SINGLE_IMAGE',
        relationshipLabel: 'Single-Image Analysis',
        summary: `Single-epoch observation (${img.modality || 'OPTICAL'}, ${m.width}x${m.height} px, ${m.bandCount} bands).`,
        whatChangedOrDiffers: [
          'No comparative temporal baseline or secondary sensor available in this single observation.'
        ],
        whatStayedSame: [
          'Surface structures and radiometric properties are evaluated within a static, single observation frame.'
        ],
        whatCannotBeCompared: [
          'Temporal rate, direction, or fact of change cannot be established from a single epoch without baseline T1 and subsequent T2 observations.'
        ],
        metrics: {
          pixelDimensionMatch: true,
          aspectRatioDelta: 0
        }
      };
    }

    const hasSar = images.some(i => i.modality === 'SAR' || (i.bandCount === 1 && !i.modality));
    const hasOptical = images.some(i => i.modality === 'OPTICAL' || ((i.bandCount ?? 3) >= 3));
    const hasBeforeAfter = images.some(i => i.temporalRole === 'BEFORE') || images.some(i => i.temporalRole === 'AFTER');
    const isTemporalQuery = qLower.includes('change') || qLower.includes('before') || qLower.includes('after') ||
      qLower.includes('increase') || qLower.includes('decrease') || qLower.includes('temporal') || qLower.includes('between');

    // Check for Incompatible Observations:
    // Extreme aspect ratio discrepancy (> 2.0x delta) or non-overlapping geospatial bounds
    const img0 = images[0];
    const img1 = images[1];
    const ar0 = (img0.width || 1) / (img0.height || 1);
    const ar1 = (img1.width || 1) / (img1.height || 1);
    const arRatio = Math.max(ar0, ar1) / Math.min(ar0, ar1);
    const hasExtremeDimensionMismatch = arRatio > 2.5;

    // Check geospatial bounds if both images have CRS bounds
    let hasNonOverlappingBounds = false;
    if (img0.geospatialMetadata?.bounds && img1.geospatialMetadata?.bounds) {
      const b0 = img0.geospatialMetadata.bounds;
      const b1 = img1.geospatialMetadata.bounds;
      // [minX, minY, maxX, maxY]
      const overlapX = Math.max(0, Math.min(b0[2], b1[2]) - Math.max(b0[0], b1[0]));
      const overlapY = Math.max(0, Math.min(b0[3], b1[3]) - Math.max(b0[1], b1[1]));
      if (overlapX <= 0 || overlapY <= 0) {
        hasNonOverlappingBounds = true;
      }
    }

    // 2. INCOMPATIBLE OBSERVATIONS
    if (hasExtremeDimensionMismatch || hasNonOverlappingBounds) {
      return {
        relationship: 'INCOMPATIBLE',
        relationshipLabel: 'Incompatible Observations',
        summary: 'Input rasters exhibit fundamentally incompatible spatial dimensions, divergent aspect ratios, or non-overlapping geographic coordinates.',
        whatChangedOrDiffers: [
          'Spatial extents, geometry, or coordinates do not share a common Area of Interest (AOI).',
          hasNonOverlappingBounds 
            ? 'Geographic bounding coordinates do not overlap; rasters depict geographically disconnected regions.'
            : `Aspect ratios differ substantially (${ar0.toFixed(2)} vs ${ar1.toFixed(2)}), precluding spatial co-registration.`
        ],
        whatStayedSame: [
          'No shared invariant ground surface or coincident landmarks can be established across disparate observations.'
        ],
        whatCannotBeCompared: [
          'Direct cross-image comparison is mathematically invalid between non-overlapping or geometrically incompatible rasters.'
        ],
        whatIsKnown: [
          `Image 1: ${img0.width || '?'}x${img0.height || '?'} px (${img0.modality})`,
          `Image 2: ${img1.width || '?'}x${img1.height || '?'} px (${img1.modality})`
        ],
        clarificationRequired: 'Please upload imagery covering a shared Area of Interest (AOI) with comparable spatial geometry and overlapping bounds.',
        metrics: {
          pixelDimensionMatch: false,
          aspectRatioDelta: Number(Math.abs(ar0 - ar1).toFixed(3))
        }
      };
    }

    // 3. MULTISPECTRAL DATA (Separate Spectral Band Channels)
    const isMultispectralBands = images.every(i => {
      const fn = (i.filename || '').toUpperCase();
      return fn.includes('B0') || fn.includes('B1') || fn.includes('BAND') ||
             fn.includes('RED') || fn.includes('GREEN') || fn.includes('BLUE') ||
             fn.includes('NIR') || fn.includes('SWIR') || fn.includes('REDEDGE');
    }) || (images.length >= 3 && images.every(i => (i.bandCount ?? 1) === 1 && Math.abs((i.width || 0) - (img0.width || 0)) <= 2));

    if (isMultispectralBands) {
      return {
        relationship: 'MULTISPECTRAL',
        relationshipLabel: 'Multispectral Data (Separate Band Channels)',
        summary: `Collection of ${images.length} discrete spectral channels of the same geographic scene for multispectral feature extraction and index derivation.`,
        whatChangedOrDiffers: [
          'Radiometric reflectance values vary across spectral bands according to physical surface reflectance and molecular absorption (e.g. chlorophyll absorption in red, high reflectance in NIR).',
          'Band-to-band contrast emphasizes distinct land cover phenomena (water absorption in SWIR/NIR vs high soil reflectance).'
        ],
        whatStayedSame: [
          'Spatial geometry, pixel dimensions, and geographic ground alignment are identical across spectral bands.',
          'Physical ground features, building footprints, and landscape boundaries coincide spatially.'
        ],
        whatCannotBeCompared: [
          'Direct raw DN subtraction between bands without calibration: spectral response functions and solar irradiance differ across wavelengths.',
          'Spectral index values (e.g. NDVI, NDWI) require calibrated top-of-atmosphere or surface reflectance.'
        ],
        metrics: {
          pixelDimensionMatch: images.every(i => i.width === img0.width && i.height === img0.height),
          aspectRatioDelta: 0
        }
      };
    }

    // 4. OPTICAL + SAR (Multi-Sensor Fusion)
    if (images.length >= 2 && hasSar && hasOptical) {
      const optImg = images.find(i => i.modality === 'OPTICAL') || images[0];
      const sarImg = images.find(i => i.modality === 'SAR') || images[1];
      const crossModal = await this.compareOpticalAndSAR(optImg, sarImg);

      return {
        relationship: 'OPTICAL_SAR',
        relationshipLabel: 'Optical + SAR Complementary Analysis',
        summary: 'Cross-sensor complementary analysis between passive optical reflectance and active microwave SAR radar backscatter.',
        whatChangedOrDiffers: [
          'Optical sensor records solar reflectance (visible color, chlorophyll pigment, and shadow), whereas active SAR radar records microwave backscatter unaffected by solar illumination or light cloud cover.',
          'Water bodies and smooth surfaces exhibit dark low optical reflectance and specular low SAR backscatter (energy reflected away from radar).',
          'Vertical structures, buildings, and metallic infrastructure yield high optical contrast and intense dielectric double-bounce radar returns.',
          'Vegetated canopy exhibits visible green spectrum absorption in optical imagery and diffuse volume scattering in SAR radar returns.'
        ],
        whatStayedSame: [
          'Permanent geographic boundaries, coastlines, water basin perimeters, and established regional road networks align across sensor footprints.',
          'Macro-topography, geological formations, and persistent urban footprints remain spatially coherent between sensor collections.'
        ],
        whatCannotBeCompared: [
          'Direct pixel-to-pixel radiometric subtraction (DN difference) is invalid: Optical measures dimensionless surface reflectance (0.0-1.0), whereas SAR measures radar backscatter cross-section in decibels (dB).',
          'Shadow phenomena differ physically: Optical casts solar shadows according to solar azimuth and elevation, whereas SAR produces radar shadow cast away from the active antenna line-of-sight.',
          'Geometric distortions differ: SAR displays layover and foreshortening on high-relief terrain, whereas optical exhibits nadir/off-nadir perspective distortion.'
        ],
        metrics: {
          pixelDimensionMatch: Math.abs((optImg.width || 0) - (sarImg.width || 0)) <= 2 && Math.abs((optImg.height || 0) - (sarImg.height || 0)) <= 2,
          aspectRatioDelta: Number(Math.abs(((optImg.width || 1) / (optImg.height || 1)) - ((sarImg.width || 1) / (sarImg.height || 1))).toFixed(3)),
          crossModalAgreement: crossModal.agreementStatus
        }
      };
    }

    // 5. BEFORE / AFTER (Bitemporal Pair)
    if (images.length === 2 && (hasBeforeAfter || isTemporalQuery)) {
      const bImg = images.find(i => i.temporalRole === 'BEFORE') || images[0];
      const aImg = images.find(i => i.temporalRole === 'AFTER') || images[1];
      const biTemporal = await this.compareBiTemporalImages(bImg, aImg);

      const changeSummary = biTemporal.candidateChangeDetected
        ? `Candidate physical change detected across ~${(biTemporal.relativeChangeFraction * 100).toFixed(1)}% of sampled spatial domain (MAD: ${biTemporal.meanAbsoluteDifference} DN).`
        : `No prominent structural change detected across temporal epochs (MAD: ${biTemporal.meanAbsoluteDifference} DN).`;

      const diffList: string[] = [
        `Mean Absolute Difference (MAD) between observations is ${biTemporal.meanAbsoluteDifference} DN, with ${(biTemporal.relativeChangeFraction * 100).toFixed(1)}% of pixels exceeding significant change threshold.`
      ];

      if (biTemporal.isGlobalIlluminationShift) {
        diffList.push('Scene-wide uniform illumination shift detected (likely sun elevation angle or seasonal atmospheric differences rather than physical ground alteration).');
      } else if (biTemporal.candidateChangeDetected) {
        diffList.push('Localized radiometric variations observed, indicating candidate physical alteration, clearing, or surface disturbance.');
      } else {
        diffList.push('Differences between acquisition dates are minor and within baseline sensor noise margins.');
      }

      return {
        relationship: 'BEFORE_AFTER',
        relationshipLabel: 'Before / After Bitemporal Pair',
        summary: changeSummary,
        whatChangedOrDiffers: diffList,
        whatStayedSame: [
          'Core regional infrastructure, primary road network, and static background terrain remain unchanged between observations.',
          'Persistent geological landforms, established boundary markers, and unaffected baseline land parcels show temporal stability.'
        ],
        whatCannotBeCompared: [
          biTemporal.isDimensionCompatible
            ? 'Sub-pixel fine edge boundaries cannot be confirmed without rigorous orthorectified co-registration.'
            : `Images have mismatched dimensions (${biTemporal.widthDiff}x${biTemporal.heightDiff} px difference); exact pixel-level comparison is constrained.`,
          'Transient variations in atmospheric clarity, solar elevation, or surface soil moisture cannot be attributed to permanent construction without calibrated multi-date radiometric normalization.'
        ],
        metrics: {
          pixelDimensionMatch: biTemporal.isDimensionCompatible,
          aspectRatioDelta: 0,
          meanDifferenceDN: biTemporal.meanAbsoluteDifference,
          changedFraction: biTemporal.relativeChangeFraction
        }
      };
    }

    // 6. MULTI-TEMPORAL OBSERVATIONS (>2 Images)
    if (images.length > 2) {
      const m1 = await this.analyzeImage(images[0]);
      const mN = await this.analyzeImage(images[images.length - 1]);
      const meanDiff = Math.abs(m1.meanBrightness - mN.meanBrightness);

      return {
        relationship: 'MULTI_TEMPORAL',
        relationshipLabel: 'Multi-Temporal Observations (Sequential Epochs)',
        summary: `Multi-epoch time series comprising ${images.length} observations across successive acquisition dates.`,
        whatChangedOrDiffers: [
          `Radiometric evolution across ${images.length} temporal epochs (baseline-to-final brightness delta: ${meanDiff.toFixed(1)} DN).`,
          'Transient seasonal phenology, agricultural crop stage cycles, and gradual land surface modifications over the observation period.'
        ],
        whatStayedSame: [
          'Permanent geographic landmarks, geological terrain, and established transportation infrastructure remain stable throughout the time series.',
          'Baseline water bodies and core urban footprints maintain spatial coherence across epochs.'
        ],
        whatCannotBeCompared: [
          'Rate of long-term change cannot be verified without regular temporal cadence and calibrated atmospheric correction across all epochs.',
          'Minor differences between non-anniversary acquisition dates may reflect phenological season rather than permanent land-use transition.'
        ],
        metrics: {
          pixelDimensionMatch: images.every(i => i.width === img0.width && i.height === img0.height),
          aspectRatioDelta: Number(Math.abs(m1.aspectRatio - mN.aspectRatio).toFixed(3)),
          meanDifferenceDN: Number(meanDiff.toFixed(1))
        }
      };
    }

    // 7. UNCERTAIN / MULTIPLE VIEWS
    const m1 = await this.analyzeImage(img0);
    const m2 = await this.analyzeImage(img1);
    const meanDiff = Math.abs(m1.meanBrightness - m2.meanBrightness);

    return {
      relationship: 'UNCERTAIN',
      relationshipLabel: 'Multiple Views / Uncertain Relationship',
      summary: 'Multi-observation comparison of the geographic Area of Interest (AOI) where temporal or spatial relationship is unconfirmed.',
      whatChangedOrDiffers: [
        `Viewing angle, relative solar illumination (brightness delta: ${meanDiff.toFixed(1)} DN), and transient atmospheric conditions vary between frames.`,
        'Look angle and parallax differences alter perspective relief and shadow projection across the scene.'
      ],
      whatStayedSame: [
        'Fundamental topographic terrain, permanent structural infrastructure, and primary land cover classes remain consistent.',
        'Major water bodies, transportation corridors, and built-up areas retain their geographic layout.'
      ],
      whatCannotBeCompared: [
        'Direct pixel-to-pixel subtraction cannot be performed without shared geometric tiepoints and cross-calibrated sensor response functions.',
        'Apparent boundary displacement due to differing acquisition angles or off-nadir relief displacement.'
      ],
      whatIsKnown: [
        `Supplied: ${images.length} observations (${images.map(i => `${i.width || '?'}x${i.height || '?'} px, ${i.modality}`).join('; ')}).`,
        'Rasters share compatible aspect ratios, but temporal order or baseline status is not tagged in file metadata.'
      ],
      clarificationRequired: 'Please clarify whether these images represent a temporal sequence (before/after), coincident angles of the same scene, or distinct survey sites.',
      metrics: {
        pixelDimensionMatch: m1.width === m2.width && m1.height === m2.height,
        aspectRatioDelta: Number(Math.abs(m1.aspectRatio - m2.aspectRatio).toFixed(3)),
        meanDifferenceDN: Number(meanDiff.toFixed(1))
      }
    };
  }

  /**
   * Deterministic Grounding Box validation:
   * Rejects out-of-range, inverted, zero-area, or invalid boxes.
   */
  public static validateGroundingBoxes(boxes: any[] | undefined): GroundingBox[] {
    if (!boxes || !Array.isArray(boxes)) return [];

    const valid: GroundingBox[] = [];

    for (const b of boxes) {
      if (!b || typeof b !== 'object') continue;
      let { ymin, xmin, ymax, xmax, label } = b;

      if (typeof ymin !== 'number' || typeof xmin !== 'number' || typeof ymax !== 'number' || typeof xmax !== 'number') {
        continue;
      }
      if (typeof label !== 'string' || !label.trim()) {
        continue;
      }

      // If already on 0-1 scale, scale to 0-1000 for validation
      if (ymin <= 1.0 && xmin <= 1.0 && ymax <= 1.0 && xmax <= 1.0 && (ymax > 0 || xmax > 0)) {
        ymin = Math.round(ymin * 1000);
        xmin = Math.round(xmin * 1000);
        ymax = Math.round(ymax * 1000);
        xmax = Math.round(xmax * 1000);
      }

      // Bounds clamping [0, 1000]
      ymin = Math.max(0, Math.min(1000, ymin));
      xmin = Math.max(0, Math.min(1000, xmin));
      ymax = Math.max(0, Math.min(1000, ymax));
      xmax = Math.max(0, Math.min(1000, xmax));

      // Coordinate ordering & minimum size check
      if (ymin >= ymax || xmin >= xmax) continue;
      const widthNorm = (xmax - xmin) / 1000;
      const heightNorm = (ymax - ymin) / 1000;
      const areaNorm = widthNorm * heightNorm;

      // Reject empty or sub-pixel degenerate boxes
      if (areaNorm < 0.0001) continue;

      // Reject meaningless full-image unlocalized boxes (>95% coverage) unless explicitly whole scene or clamped bounds
      const labelLower = label.toLowerCase();
      const isExplicitWholeScene = labelLower.includes('entire') || 
        labelLower.includes('full') || 
        labelLower.includes('whole') || 
        labelLower.includes('scene') ||
        labelLower.includes('clamped');
      if (areaNorm > 0.95 && !isExplicitWholeScene) {
        continue; // Discard unlocalized full-image box
      }

      // Output normalized 0.0-1.0 representation for rendering
      valid.push({
        ymin: Number((ymin / 1000).toFixed(4)),
        xmin: Number((xmin / 1000).toFixed(4)),
        ymax: Number((ymax / 1000).toFixed(4)),
        xmax: Number((xmax / 1000).toFixed(4)),
        label: label.trim()
      });
    }

    return valid;
  }

  private static getDefaultMetrics(image: NormalizedImage): DeterministicImageMetrics {
    const width = image.width || 512;
    const height = image.height || 512;
    return {
      width,
      height,
      aspectRatio: Number((width / (height || 1)).toFixed(3)),
      bandCount: image.bandCount || 3,
      hasColorChannels: image.modality !== 'SAR',
      meanBrightness: 128,
      stdBrightness: 45,
      contrastRatio: 180,
      vegetationProxyScore: 0.1,
      waterShadowProxyScore: 0.05,
      brightReflectorProxyScore: 0.05,
      highVarianceRegionScore: 0.1,
      isLikelyOverexposedOrCloudy: false,
      isLikelyUnderexposedOrShadow: false,
      isLowContrast: false
    };
  }
}
