/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Deterministic SAR (Synthetic Aperture Radar) Evidence Engine.
 * Extracts physical radar backscatter moments, speckle metrics (ENL),
 * and validates polarizations (VV, VH, HH, HV) without fabrication.
 */

import { SAREvidence, SARPolarization, EvidenceProvenance } from './types.js';

export class SAREngine {
  /**
   * Identifies authoritative polarization from TIFF description or metadata tags.
   * Returns 'UNKNOWN' if no authoritative polarization is documented.
   * NEVER invents or assumes polarizations.
   */
  public static extractPolarization(
    description?: string,
    tags?: Record<string, any>
  ): SARPolarization {
    const raw = `${description || ''} ${tags?.ImageDescription || ''} ${tags?.polarization || ''}`.toUpperCase();

    if (raw.includes('VV') && raw.includes('VH')) {
      return 'VV/VH';
    } else if (raw.includes('HH') && raw.includes('HV')) {
      return 'HH/HV';
    } else if (raw.includes('VV')) {
      return 'VV';
    } else if (raw.includes('VH')) {
      return 'VH';
    } else if (raw.includes('HH')) {
      return 'HH';
    } else if (raw.includes('HV')) {
      return 'HV';
    }

    return 'UNKNOWN';
  }

  /**
   * Deterministically analyzes SAR radar backscatter data (single-band or multi-polarization).
   */
  public static analyzeSARData(
    data: ArrayLike<number>,
    width: number,
    height: number,
    polarization: SARPolarization,
    provenance: EvidenceProvenance,
    noDataValue?: number
  ): SAREvidence {
    const totalPixels = data.length;
    if (totalPixels === 0) {
      return {
        type: 'SAR_EVIDENCE',
        polarization,
        isSingleChannel: true,
        statistics: {
          min: 0,
          max: 0,
          mean: 0,
          stdDev: 0,
          estimatedENL: 1,
          percentile95: 0,
          percentile5: 0
        },
        speckleQuality: {
          enl: 1,
          speckleSeverity: 'HIGH'
        },
        candidateRegions: [],
        observations: ['Zero pixels in input SAR raster.'],
        measurements: { pixelCount: 0 },
        quality: {
          missingMetadata: true,
          hasCalibration: false,
          validPixelPercentage: 0
        },
        provenance
      };
    }

    // Subsample up to 25,000 pixels for fast deterministic evaluation
    const step = Math.max(1, Math.floor(totalPixels / 25000));
    const sampledValues: number[] = [];
    let sum = 0;
    let sumSq = 0;
    let min = Infinity;
    let max = -Infinity;

    for (let i = 0; i < totalPixels; i += step) {
      const val = data[i];
      if (noDataValue !== undefined && val === noDataValue) continue;
      if (isNaN(val) || !isFinite(val)) continue;

      sampledValues.push(val);
      if (val < min) min = val;
      if (val > max) max = val;
      sum += val;
      sumSq += val * val;
    }

    const validCount = sampledValues.length;
    const validPixelPercentage = Number(((validCount / (totalPixels / step)) * 100).toFixed(1));

    if (validCount === 0) {
      return {
        type: 'SAR_EVIDENCE',
        polarization,
        isSingleChannel: true,
        statistics: {
          min: 0,
          max: 0,
          mean: 0,
          stdDev: 0,
          estimatedENL: 1,
          percentile95: 0,
          percentile5: 0
        },
        speckleQuality: {
          enl: 1,
          speckleSeverity: 'HIGH'
        },
        candidateRegions: [],
        observations: ['No valid numeric pixels found in SAR raster.'],
        measurements: { validCount: 0 },
        quality: {
          missingMetadata: true,
          hasCalibration: false,
          validPixelPercentage: 0
        },
        provenance
      };
    }

    // Sort sampled values for percentiles
    sampledValues.sort((a, b) => a - b);
    const p5 = sampledValues[Math.floor(validCount * 0.05)];
    const p95 = sampledValues[Math.floor(validCount * 0.95)];

    const mean = sum / validCount;
    const variance = Math.max(0, (sumSq / validCount) - (mean * mean));
    const stdDev = Math.sqrt(variance);

    // Equivalent Number of Looks (ENL): (mean / std)^2
    const enl = stdDev > 0 ? Math.pow(mean / stdDev, 2) : 1;
    const speckleSeverity: 'LOW' | 'MODERATE' | 'HIGH' = enl > 4.0 ? 'LOW' : (enl > 1.8 ? 'MODERATE' : 'HIGH');

    // Dynamic range estimation in dB (approx 10 * log10(max/min))
    let dynamicRangeDb: number | undefined = undefined;
    if (min > 0 && max > min) {
      dynamicRangeDb = Number((10 * Math.log10(max / Math.max(1e-6, min))).toFixed(1));
    }

    // Spatial candidate regions:
    // 1. High backscatter candidates (double-bounce structures / metallic maritime vessels) -> top 2% intensity
    // 2. Low backscatter candidates (specular water / smooth runway / shadow) -> bottom 5% intensity
    const highThreshold = p95;
    const lowThreshold = p5;

    let highPixels = 0;
    let lowPixels = 0;
    let highMinX = width, highMaxX = 0, highMinY = height, highMaxY = 0;
    let lowMinX = width, lowMaxX = 0, lowMinY = height, lowMaxY = 0;

    for (let i = 0; i < totalPixels; i += step) {
      const val = data[i];
      if (isNaN(val) || !isFinite(val)) continue;

      const x = i % width;
      const y = Math.floor(i / width);

      if (val >= highThreshold) {
        highPixels++;
        if (x < highMinX) highMinX = x;
        if (x > highMaxX) highMaxX = x;
        if (y < highMinY) highMinY = y;
        if (y > highMaxY) highMaxY = y;
      }

      if (val <= lowThreshold) {
        lowPixels++;
        if (x < lowMinX) lowMinX = x;
        if (x > lowMaxX) lowMaxX = x;
        if (y < lowMinY) lowMinY = y;
        if (y > lowMaxY) lowMaxY = y;
      }
    }

    const candidateRegions: SAREvidence['candidateRegions'] = [];

    if (highPixels >= 10 && highMaxX > highMinX && highMaxY > highMinY) {
      candidateRegions.push({
        id: 'sar_region_high_01',
        type: 'HIGH_BACKSCATTER_DOUBLE_BOUNCE',
        pixelBounds: { ymin: highMinY, xmin: highMinX, ymax: highMaxY, xmax: highMaxX },
        pixelCount: highPixels * step,
        meanIntensity: Number(p95.toFixed(2))
      });
    }

    if (lowPixels >= 10 && lowMaxX > lowMinX && lowMaxY > lowMinY) {
      candidateRegions.push({
        id: 'sar_region_specular_01',
        type: 'LOW_BACKSCATTER_SPECULAR',
        pixelBounds: { ymin: lowMinY, xmin: lowMinX, ymax: lowMaxY, xmax: lowMaxX },
        pixelCount: lowPixels * step,
        meanIntensity: Number(p5.toFixed(2))
      });
    }

    const observations: string[] = [
      `SAR Backscatter Mean: ${mean.toFixed(2)}, StdDev: ${stdDev.toFixed(2)}, ENL: ${enl.toFixed(2)} (${speckleSeverity} speckle).`,
      `Polarization: ${polarization}.`
    ];

    if (polarization === 'UNKNOWN') {
      observations.push('Authoritative polarization unavailable in raster tags; physical polarimetric decomposition not performed.');
    }

    return {
      type: 'SAR_EVIDENCE',
      polarization,
      isSingleChannel: true,
      statistics: {
        min: Number(min.toFixed(2)),
        max: Number(max.toFixed(2)),
        mean: Number(mean.toFixed(2)),
        stdDev: Number(stdDev.toFixed(2)),
        estimatedENL: Number(enl.toFixed(2)),
        percentile95: Number(p95.toFixed(2)),
        percentile5: Number(p5.toFixed(2))
      },
      speckleQuality: {
        enl: Number(enl.toFixed(2)),
        speckleSeverity,
        dynamicRangeDb
      },
      candidateRegions,
      observations,
      measurements: {
        meanBackscatter: Number(mean.toFixed(2)),
        stdDev: Number(stdDev.toFixed(2)),
        enl: Number(enl.toFixed(2)),
        p5: Number(p5.toFixed(2)),
        p95: Number(p95.toFixed(2)),
        speckleSeverity
      },
      quality: {
        missingMetadata: polarization === 'UNKNOWN',
        hasCalibration: false, // Unless explicit radiometrically calibrated sigma0/gamma0 tag is present
        validPixelPercentage
      },
      provenance
    };
  }
}
