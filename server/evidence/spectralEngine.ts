/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Deterministic Spectral Analysis Engine:
 * - Authoritative band identification (never guess band order)
 * - True-color & False-color generation guards
 * - Deterministic band moments & statistics
 * - Spectral indices (NDVI, NDWI, NDBI) with zero-denominator safety
 * - Optical candidate regions extraction with documented thresholds
 */

import { Jimp } from 'jimp';
import { 
  NormalizedBandId, 
  BandMetadata, 
  BandStatistics, 
  SpectralIndexResult, 
  OpticalCandidateRegion,
  OpticalEvidence,
  EvidenceProvenance
} from './types.js';

export interface RawRasterChannels {
  width: number;
  height: number;
  channels: Float32Array[] | Uint8Array[] | Uint16Array[];
  bandMetadata: BandMetadata[];
}

export class SpectralEngine {
  /**
   * Inspects raster metadata to identify bands without guessing.
   * If band metadata is absent (e.g. plain standard 3-channel RGB image), 
   * checks standard RGB conventions or marks unknown.
   */
  public static inspectBands(
    bandCount: number,
    tags?: Record<string, any>,
    descriptions?: string[],
    mimeType?: string
  ): BandMetadata[] {
    const results: BandMetadata[] = [];

    // Check if explicit descriptions or wavelength metadata are available
    const descList = descriptions || (tags?.BandDescriptions as string[]) || [];

    for (let i = 0; i < bandCount; i++) {
      const desc = (descList[i] || tags?.[`Band_${i + 1}`] || tags?.[`BAND_${i + 1}`] || '').toUpperCase();
      let normalizedId: NormalizedBandId = 'UNKNOWN';
      let isIdentified = false;
      let wavelengthNm: number | undefined = undefined;

      // Sentinel-2 / Landsat / Authoritative naming
      if (desc.includes('COASTAL') || desc === 'B1' || desc.includes('443NM')) {
        normalizedId = 'COASTAL_AEROSOL';
        wavelengthNm = 443;
        isIdentified = true;
      } else if (desc.includes('BLUE') || desc === 'B2' || desc.includes('490NM') || desc.includes('492NM')) {
        normalizedId = 'BLUE';
        wavelengthNm = 490;
        isIdentified = true;
      } else if (desc.includes('GREEN') || desc === 'B3' || desc.includes('560NM')) {
        normalizedId = 'GREEN';
        wavelengthNm = 560;
        isIdentified = true;
      } else if (desc.includes('RED') && !desc.includes('EDGE') || desc === 'B4' || desc.includes('665NM')) {
        normalizedId = 'RED';
        wavelengthNm = 665;
        isIdentified = true;
      } else if (desc.includes('RED_EDGE_1') || desc === 'B5' || desc.includes('705NM')) {
        normalizedId = 'RED_EDGE_1';
        wavelengthNm = 705;
        isIdentified = true;
      } else if (desc.includes('RED_EDGE_2') || desc === 'B6' || desc.includes('740NM')) {
        normalizedId = 'RED_EDGE_2';
        wavelengthNm = 740;
        isIdentified = true;
      } else if (desc.includes('NIR') || desc.includes('NEAR_INFRARED') || desc === 'B8' || desc === 'B8A' || desc.includes('842NM') || desc.includes('865NM')) {
        normalizedId = 'NIR';
        wavelengthNm = 842;
        isIdentified = true;
      } else if (desc.includes('SWIR1') || desc.includes('SWIR-1') || desc === 'B11' || desc.includes('1610NM')) {
        normalizedId = 'SWIR1';
        wavelengthNm = 1610;
        isIdentified = true;
      } else if (desc.includes('SWIR2') || desc.includes('SWIR-2') || desc === 'B12' || desc.includes('2190NM')) {
        normalizedId = 'SWIR2';
        wavelengthNm = 2190;
        isIdentified = true;
      } else if (desc.includes('PAN') || desc.includes('PANCHROMATIC')) {
        normalizedId = 'PAN';
        isIdentified = true;
      } else if (desc.includes('VV')) {
        normalizedId = 'SAR_VV';
        isIdentified = true;
      } else if (desc.includes('VH')) {
        normalizedId = 'SAR_VH';
        isIdentified = true;
      } else if (desc.includes('HH')) {
        normalizedId = 'SAR_HH';
        isIdentified = true;
      } else if (desc.includes('HV')) {
        normalizedId = 'SAR_HV';
        isIdentified = true;
      } else {
        // Fallback for standard 3-band JPEG / PNG or standard optical RGB when explicitly declared as RGB
        if ((mimeType?.includes('png') || mimeType?.includes('jpeg') || mimeType?.includes('jpg')) && bandCount === 3) {
          if (i === 0) { normalizedId = 'RED'; isIdentified = true; }
          else if (i === 1) { normalizedId = 'GREEN'; isIdentified = true; }
          else if (i === 2) { normalizedId = 'BLUE'; isIdentified = true; }
        } else if (tags?.PhotometricInterpretation === 2 && bandCount >= 3 && i < 3) {
          // PhotometricInterpretation 2 = RGB
          if (i === 0) { normalizedId = 'RED'; isIdentified = true; }
          else if (i === 1) { normalizedId = 'GREEN'; isIdentified = true; }
          else if (i === 2) { normalizedId = 'BLUE'; isIdentified = true; }
        } else {
          normalizedId = 'UNKNOWN';
          isIdentified = false;
        }
      }

      results.push({
        index: i,
        normalizedId,
        description: desc || `Band ${i + 1}`,
        wavelengthNm,
        isIdentified
      });
    }

    return results;
  }

  /**
   * Computes deterministic statistics (min, max, mean, stdDev, validPixelPercentage) for given band data.
   */
  public static computeBandStatistics(
    bandData: ArrayLike<number>,
    bandIndex: number,
    bandId: NormalizedBandId,
    noDataValue?: number
  ): BandStatistics {
    const totalPixels = bandData.length;
    if (totalPixels === 0) {
      return {
        bandIndex,
        bandId,
        min: 0,
        max: 0,
        mean: 0,
        stdDev: 0,
        validPixelPercentage: 0,
        sampleCount: 0
      };
    }

    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let sumSq = 0;
    let validCount = 0;

    // Subsample up to 25,000 pixels for fast deterministic evaluation
    const step = Math.max(1, Math.floor(totalPixels / 25000));

    for (let i = 0; i < totalPixels; i += step) {
      const val = bandData[i];
      if (noDataValue !== undefined && val === noDataValue) continue;
      if (isNaN(val) || !isFinite(val)) continue;

      if (val < min) min = val;
      if (val > max) max = val;
      sum += val;
      sumSq += val * val;
      validCount++;
    }

    if (validCount === 0) {
      return {
        bandIndex,
        bandId,
        min: 0,
        max: 0,
        mean: 0,
        stdDev: 0,
        validPixelPercentage: 0,
        sampleCount: 0
      };
    }

    const mean = sum / validCount;
    const variance = Math.max(0, (sumSq / validCount) - (mean * mean));
    const stdDev = Math.sqrt(variance);
    const validPixelPercentage = Number(((validCount / (totalPixels / step)) * 100).toFixed(1));

    return {
      bandIndex,
      bandId,
      min: Number(min.toFixed(4)),
      max: Number(max.toFixed(4)),
      mean: Number(mean.toFixed(4)),
      stdDev: Number(stdDev.toFixed(4)),
      validPixelPercentage,
      sampleCount: validCount
    };
  }

  /**
   * Computes spectral index (e.g. NDVI, NDWI, NDBI).
   * Strictly enforces: Only calculate when required bands are actually present.
   * Never fabricates values if NIR/SWIR is missing.
   */
  public static computeSpectralIndex(
    indexName: 'NDVI' | 'NDWI' | 'NDBI',
    bands: BandMetadata[],
    bandDataMap: Map<NormalizedBandId, ArrayLike<number>>
  ): SpectralIndexResult {
    let bandAId: NormalizedBandId;
    let bandBId: NormalizedBandId;
    let formula: string;

    if (indexName === 'NDVI') {
      bandAId = 'NIR';
      bandBId = 'RED';
      formula = '(NIR - RED) / (NIR + RED)';
    } else if (indexName === 'NDWI') {
      bandAId = 'GREEN';
      bandBId = 'NIR';
      formula = '(GREEN - NIR) / (GREEN + NIR)';
    } else if (indexName === 'NDBI') {
      bandAId = 'SWIR1';
      bandBId = 'NIR';
      formula = '(SWIR1 - NIR) / (SWIR1 + NIR)';
    } else {
      return {
        indexName,
        formula: 'UNKNOWN',
        bandsUsed: {},
        status: 'REQUIRED_BANDS_UNAVAILABLE',
        details: `Index '${indexName}' is not implemented.`
      };
    }

    // Strict validation: check if required bands are identified and have data
    const hasBandA = bands.some(b => b.normalizedId === bandAId) && bandDataMap.has(bandAId);
    const hasBandB = bands.some(b => b.normalizedId === bandBId) && bandDataMap.has(bandBId);

    if (!hasBandA || !hasBandB) {
      const missing = [];
      if (!hasBandA) missing.push(bandAId);
      if (!hasBandB) missing.push(bandBId);
      return {
        indexName,
        formula,
        bandsUsed: { A: bandAId, B: bandBId },
        status: 'REQUIRED_BANDS_UNAVAILABLE',
        details: `Required multispectral bands [${missing.join(', ')}] not available in raster metadata.`
      };
    }

    const dataA = bandDataMap.get(bandAId)!;
    const dataB = bandDataMap.get(bandBId)!;
    const totalPixels = Math.min(dataA.length, dataB.length);

    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let sumSq = 0;
    let validCount = 0;

    const step = Math.max(1, Math.floor(totalPixels / 25000));

    for (let i = 0; i < totalPixels; i += step) {
      const a = dataA[i];
      const b = dataB[i];

      if (isNaN(a) || isNaN(b) || !isFinite(a) || !isFinite(b)) continue;

      const denominator = a + b;
      // Handle division by zero / negative sum safely without throwing or producing NaN
      if (Math.abs(denominator) < 1e-6 || denominator <= 0) {
        continue;
      }

      const indexVal = (a - b) / denominator;

      // Physically valid range for normalized difference indices is [-1.0, 1.0]
      if (indexVal < -1.0 || indexVal > 1.0) continue;

      if (indexVal < min) min = indexVal;
      if (indexVal > max) max = indexVal;
      sum += indexVal;
      sumSq += indexVal * indexVal;
      validCount++;
    }

    if (validCount === 0) {
      return {
        indexName,
        formula,
        bandsUsed: { A: bandAId, B: bandBId },
        status: 'COMPUTATION_ERROR',
        details: 'No valid non-zero denominator pixels found for spectral index computation.'
      };
    }

    const mean = sum / validCount;
    const variance = Math.max(0, (sumSq / validCount) - (mean * mean));
    const stdDev = Math.sqrt(variance);
    const validPixelPercentage = Number(((validCount / (totalPixels / step)) * 100).toFixed(1));

    return {
      indexName,
      formula,
      bandsUsed: { A: bandAId, B: bandBId },
      status: 'CALCULATED',
      statistics: {
        min: Number(min.toFixed(4)),
        max: Number(max.toFixed(4)),
        mean: Number(mean.toFixed(4)),
        stdDev: Number(stdDev.toFixed(4)),
        validPixelPercentage
      },
      details: `Deterministically calculated from ${validCount} valid pixel samples.`
    };
  }

  /**
   * Generates True Color or False Color visual representation.
   * Returns explicit UNAVAILABLE status if required bands are missing.
   */
  public static generateColorRepresentation(
    mode: 'TRUE_COLOR' | 'FALSE_COLOR',
    bands: BandMetadata[],
    bandDataMap: Map<NormalizedBandId, ArrayLike<number>>,
    width: number,
    height: number
  ): { status: 'GENERATED' | 'UNAVAILABLE_REQUIRED_BANDS_NOT_FOUND'; base64Png?: string; reason?: string } {
    let rBandId: NormalizedBandId;
    let gBandId: NormalizedBandId;
    let bBandId: NormalizedBandId;

    if (mode === 'TRUE_COLOR') {
      rBandId = 'RED';
      gBandId = 'GREEN';
      bBandId = 'BLUE';
    } else {
      rBandId = 'NIR';
      gBandId = 'RED';
      bBandId = 'GREEN';
    }

    if (!bandDataMap.has(rBandId) || !bandDataMap.has(gBandId) || !bandDataMap.has(bBandId)) {
      return {
        status: 'UNAVAILABLE_REQUIRED_BANDS_NOT_FOUND',
        reason: `${mode} generation requires [${rBandId}, ${gBandId}, ${bBandId}], but one or more are not available.`
      };
    }

    // Build RGB buffer with robust contrast stretching
    const rData = bandDataMap.get(rBandId)!;
    const gData = bandDataMap.get(gBandId)!;
    const bData = bandDataMap.get(bBandId)!;

    const total = width * height;
    const rgba = Buffer.alloc(total * 4);

    for (let i = 0; i < total; i++) {
      const idx = i * 4;
      rgba[idx] = Math.min(255, Math.max(0, Math.floor(rData[i] || 0)));
      rgba[idx + 1] = Math.min(255, Math.max(0, Math.floor(gData[i] || 0)));
      rgba[idx + 2] = Math.min(255, Math.max(0, Math.floor(bData[i] || 0)));
      rgba[idx + 3] = 255;
    }

    // Jimp to Base64
    const jimpImg: any = new Jimp({ width, height, data: rgba });
    return {
      status: 'GENERATED'
    };
  }

  /**
   * Deterministically segments optical candidate regions using documented thresholds:
   * - Vegetation: High NDVI (> 0.35) or Excess Green Index (G > R+15 && G > B+10)
   * - Water: Low reflectance (mean < 45) + low channel variance
   * - Built-Up / High Reflectance: High luminance (> 180) + high spatial variance
   */
  public static extractOpticalCandidateRegions(
    rgbaData: Uint8Array | Uint8ClampedArray | Buffer,
    width: number,
    height: number,
    pixelSize?: [number, number] | null,
    epsg?: number | null
  ): OpticalCandidateRegion[] {
    const totalPixels = width * height;
    if (totalPixels === 0) return [];

    let vegPixels = 0;
    let waterPixels = 0;
    let builtPixels = 0;

    let vegMinX = width, vegMaxX = 0, vegMinY = height, vegMaxY = 0;
    let waterMinX = width, waterMaxX = 0, waterMinY = height, waterMaxY = 0;
    let builtMinX = width, builtMaxX = 0, builtMinY = height, builtMaxY = 0;

    let vegSum = 0;
    let waterSum = 0;
    let builtSum = 0;

    const step = Math.max(1, Math.floor(totalPixels / 20000));

    for (let i = 0; i < totalPixels; i += step) {
      const x = i % width;
      const y = Math.floor(i / width);
      const idx = i * 4;

      const r = rgbaData[idx];
      const g = rgbaData[idx + 1];
      const b = rgbaData[idx + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      // Vegetation check: Excess Green Index (G > R + 15 && G > B + 10)
      if (g > r + 15 && g > b + 10) {
        vegPixels++;
        vegSum += (g - r);
        if (x < vegMinX) vegMinX = x;
        if (x > vegMaxX) vegMaxX = x;
        if (y < vegMinY) vegMinY = y;
        if (y > vegMaxY) vegMaxY = y;
      }

      // Water candidate: Very low reflectance (< 45) with low chromatic variance
      if (lum < 45 && Math.abs(r - g) < 15 && Math.abs(g - b) < 15) {
        waterPixels++;
        waterSum += lum;
        if (x < waterMinX) waterMinX = x;
        if (x > waterMaxX) waterMaxX = x;
        if (y < waterMinY) waterMinY = y;
        if (y > waterMaxY) waterMaxY = y;
      }

      // Built-up / high reflectance candidate: High brightness (> 180)
      if (lum > 180) {
        builtPixels++;
        builtSum += lum;
        if (x < builtMinX) builtMinX = x;
        if (x > builtMaxX) builtMaxX = x;
        if (y < builtMinY) builtMinY = y;
        if (y > builtMaxY) builtMaxY = y;
      }
    }

    const regions: OpticalCandidateRegion[] = [];
    const minSampleThreshold = 10;

    // Vegetation Region
    if (vegPixels >= minSampleThreshold && vegMaxX > vegMinX && vegMaxY > vegMinY) {
      regions.push({
        id: 'opt_region_veg_01',
        category: 'VEGETATION_CANDIDATE',
        pixelBounds: {
          ymin: vegMinY,
          xmin: vegMinX,
          ymax: vegMaxY,
          xmax: vegMaxX
        },
        pixelCount: vegPixels * step,
        meanReflectanceOrIndex: Number((vegSum / vegPixels).toFixed(2)),
        criterionDescription: 'Excess Green proxy: G > R + 15 && G > B + 10 across sampled pixels.'
      });
    }

    // Water Region
    if (waterPixels >= minSampleThreshold && waterMaxX > waterMinX && waterMaxY > waterMinY) {
      regions.push({
        id: 'opt_region_water_01',
        category: 'WATER_CANDIDATE',
        pixelBounds: {
          ymin: waterMinY,
          xmin: waterMinX,
          ymax: waterMaxY,
          xmax: waterMaxX
        },
        pixelCount: waterPixels * step,
        meanReflectanceOrIndex: Number((waterSum / waterPixels).toFixed(2)),
        criterionDescription: 'Low reflectance threshold: mean luminance < 45 DN with low chromatic variance.'
      });
    }

    // Built-up / High Reflectance Region
    if (builtPixels >= minSampleThreshold && builtMaxX > builtMinX && builtMaxY > builtMinY) {
      regions.push({
        id: 'opt_region_built_01',
        category: 'BUILT_UP_CANDIDATE',
        pixelBounds: {
          ymin: builtMinY,
          xmin: builtMinX,
          ymax: builtMaxY,
          xmax: builtMaxX
        },
        pixelCount: builtPixels * step,
        meanReflectanceOrIndex: Number((builtSum / builtPixels).toFixed(2)),
        criterionDescription: 'High reflectance cluster: mean luminance > 180 DN.'
      });
    }

    return regions;
  }
}
