/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Deterministic Grounding Validator:
 * - Distinguishes MODEL_PROPOSED_REGION from MEASURED_EVIDENCE_REGION
 * - Validates coordinate bounds, sizes, and formats
 * - Computes pixel coordinates and georeferenced coordinates
 * - Extracts region statistics deterministically
 */

import { GroundedEvidenceRegion } from './types.js';
import { GeospatialUtils } from './geospatialUtils.js';

export class GroundingValidator {
  /**
   * Validates model-proposed grounding boxes against image dimensions and georeferencing metadata.
   */
  public static validateModelProposedBox(
    box: any,
    imageWidth: number,
    imageHeight: number,
    geotransform?: number[] | null,
    epsg?: number | null,
    crsName?: string | null,
    pixelSize?: [number, number] | null,
    rasterData?: ArrayLike<number>
  ): GroundedEvidenceRegion | null {
    if (!box || typeof box !== 'object') return null;

    let { ymin, xmin, ymax, xmax, label } = box;

    if (typeof ymin !== 'number' || typeof xmin !== 'number' || typeof ymax !== 'number' || typeof xmax !== 'number') {
      return null;
    }

    const cleanLabel = typeof label === 'string' && label.trim() ? label.trim() : 'Unlabeled Region';

    // Reject negative coordinates or out of range coordinates
    if (ymin < 0 || xmin < 0 || ymax < 0 || xmax < 0) {
      return null;
    }

    // Handle 0-1000 integer vs 0-1.0 float normalization
    let normYmin: number, normXmin: number, normYmax: number, normXmax: number;

    if (ymin <= 1.0 && xmin <= 1.0 && ymax <= 1.0 && xmax <= 1.0 && (ymax > 0 || xmax > 0)) {
      normYmin = ymin;
      normXmin = xmin;
      normYmax = ymax;
      normXmax = xmax;
    } else if (ymin <= 1000 && xmin <= 1000 && ymax <= 1000 && xmax <= 1000) {
      normYmin = ymin / 1000;
      normXmin = xmin / 1000;
      normYmax = ymax / 1000;
      normXmax = xmax / 1000;
    } else {
      // Exceeds standard 0-1000 normalized range
      return null;
    }

    if (normYmin >= normYmax || normXmin >= normXmax) {
      return null; // Inverted or degenerate box
    }

    const normArea = (normYmax - normYmin) * (normXmax - normXmin);
    const labelLower = cleanLabel.toLowerCase();
    const isExplicitWholeScene = labelLower.includes('entire') || labelLower.includes('full') || labelLower.includes('whole') || labelLower.includes('scene');
    if (normArea >= 0.90 && !isExplicitWholeScene) {
      return null; // Reject meaningless full-image box
    }

    // Convert to pixel coordinates
    const pixelYmin = Math.round(normYmin * imageHeight);
    const pixelXmin = Math.round(normXmin * imageWidth);
    const pixelYmax = Math.round(normYmax * imageHeight);
    const pixelXmax = Math.round(normXmax * imageWidth);

    const boxPixelWidth = Math.max(1, pixelXmax - pixelXmin);
    const boxPixelHeight = Math.max(1, pixelYmax - pixelYmin);
    const totalBoxPixels = boxPixelWidth * boxPixelHeight;

    // Reject degenerate sub-pixel bounding box
    if (totalBoxPixels < 4) return null;

    // If georeferencing exists, calculate geoBounds
    let geoBounds: GroundedEvidenceRegion['geoBounds'] | undefined = undefined;
    if (geotransform && geotransform.length >= 6) {
      const minCoord = GeospatialUtils.pixelToGeo(pixelXmin, pixelYmax, geotransform, epsg, crsName);
      const maxCoord = GeospatialUtils.pixelToGeo(pixelXmax, pixelYmin, geotransform, epsg, crsName);

      if (minCoord && maxCoord) {
        geoBounds = {
          minEasting: minCoord.easting,
          maxEasting: maxCoord.easting,
          minNorthing: minCoord.northing,
          maxNorthing: maxCoord.northing,
          crs: minCoord.crs,
          latLng: (minCoord.latLng && maxCoord.latLng) ? {
            minLat: Math.min(minCoord.latLng.latitude, maxCoord.latLng.latitude),
            maxLat: Math.max(minCoord.latLng.latitude, maxCoord.latLng.latitude),
            minLng: Math.min(minCoord.latLng.longitude, maxCoord.latLng.longitude),
            maxLng: Math.max(minCoord.latLng.longitude, maxCoord.latLng.longitude)
          } : undefined
        };
      }
    }

    // Calculate real area if resolution is available
    const areaResult = GeospatialUtils.calculateGeospatialArea(totalBoxPixels, pixelSize, epsg, geotransform);

    // Calculate region pixel statistics if raster data buffer is provided
    let regionStatistics: GroundedEvidenceRegion['regionStatistics'] | undefined = undefined;
    if (rasterData && rasterData.length >= imageWidth * imageHeight) {
      let sum = 0;
      let sumSq = 0;
      let count = 0;
      const step = Math.max(1, Math.floor(totalBoxPixels / 2000));

      for (let y = pixelYmin; y < pixelYmax; y += step) {
        for (let x = pixelXmin; x < pixelXmax; x += step) {
          const idx = y * imageWidth + x;
          const val = rasterData[idx];
          if (!isNaN(val) && isFinite(val)) {
            sum += val;
            sumSq += val * val;
            count++;
          }
        }
      }

      if (count > 0) {
        const mean = sum / count;
        const variance = Math.max(0, (sumSq / count) - (mean * mean));
        regionStatistics = {
          meanLuminance: Number(mean.toFixed(2)),
          stdDev: Number(Math.sqrt(variance).toFixed(2)),
          pixelCount: totalBoxPixels
        };
      }
    }

    const attachedEvidenceNotes: string[] = [
      `Hypothesis bounding box: [${Math.round(normYmin * 1000)}, ${Math.round(normXmin * 1000)}, ${Math.round(normYmax * 1000)}, ${Math.round(normXmax * 1000)}].`,
      `Pixel Span: ${boxPixelWidth}x${boxPixelHeight} (${totalBoxPixels} pixels).`
    ];

    if (areaResult.status === 'CALCULATED') {
      attachedEvidenceNotes.push(`Estimated ground footprint: ${areaResult.areaM2} m² (${areaResult.areaHectares} ha).`);
    } else {
      attachedEvidenceNotes.push(`Geospatial area: AREA_UNAVAILABLE (${areaResult.reason}).`);
    }

    return {
      id: `region_model_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      classification: 'MODEL_PROPOSED_REGION',
      label: cleanLabel,
      pixelBounds: {
        ymin: pixelYmin,
        xmin: pixelXmin,
        ymax: pixelYmax,
        xmax: pixelXmax
      },
      normalizedBounds: {
        ymin: Number(normYmin.toFixed(4)),
        xmin: Number(normXmin.toFixed(4)),
        ymax: Number(normYmax.toFixed(4)),
        xmax: Number(normXmax.toFixed(4))
      },
      geoBounds,
      areaM2: areaResult.status === 'CALCULATED' ? areaResult.areaM2 : undefined,
      areaHectares: areaResult.status === 'CALCULATED' ? areaResult.areaHectares : undefined,
      regionStatistics,
      attachedEvidenceNotes
    };
  }
}
