/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Deterministic Cross-Modal Evidence Engine (Optical + SAR):
 * - Builds common spatial grid representations
 * - Computes spatial overlap, IoU, and region intersections
 * - Detects cross-modal agreements and conflicts (e.g. optical built-up vs SAR smooth specular)
 * - Returns structured EVIDENCE_CONFLICT state when modalities disagree
 */

import { OpticalEvidence, SAREvidence, SpatialOverlapResult } from './types.js';
import { GeospatialUtils } from './geospatialUtils.js';

export class CrossModalEngine {
  /**
   * Evaluates spatial overlap and radiometric consistency between Optical and SAR evidence.
   */
  public static evaluateCrossModalEvidence(
    optical: OpticalEvidence,
    sar: SAREvidence,
    opticalDimensions: { width: number; height: number },
    sarDimensions: { width: number; height: number }
  ): SpatialOverlapResult {
    const details: string[] = [];
    const regionsCorresponding: SpatialOverlapResult['regionsCorresponding'] = [];

    // Check if aspect ratios match within 10%
    const optAspect = opticalDimensions.width / Math.max(1, opticalDimensions.height);
    const sarAspect = sarDimensions.width / Math.max(1, sarDimensions.height);
    const hasCommonSpatialGrid = Math.abs(optAspect - sarAspect) < 0.12;

    if (!hasCommonSpatialGrid) {
      details.push(`Spatial grids have disparate aspect ratios (Optical: ${optAspect.toFixed(2)}, SAR: ${sarAspect.toFixed(2)}).`);
    } else {
      details.push(`Spatial geometry is aligned on common spatial grid (aspect ratio ~${optAspect.toFixed(2)}).`);
    }

    // Compare Candidate Regions in normalized [0-1] coordinates
    let hasDirectConflict = false;
    let hasConfirmation = false;

    for (const optReg of optical.candidateRegions) {
      // Normalize optical bounds
      const optNorm = {
        ymin: optReg.pixelBounds.ymin / opticalDimensions.height,
        xmin: optReg.pixelBounds.xmin / opticalDimensions.width,
        ymax: optReg.pixelBounds.ymax / opticalDimensions.height,
        xmax: optReg.pixelBounds.xmax / opticalDimensions.width
      };

      for (const sarReg of sar.candidateRegions) {
        // Normalize SAR bounds
        const sarNorm = {
          ymin: sarReg.pixelBounds.ymin / sarDimensions.height,
          xmin: sarReg.pixelBounds.xmin / sarDimensions.width,
          ymax: sarReg.pixelBounds.ymax / sarDimensions.height,
          xmax: sarReg.pixelBounds.xmax / sarDimensions.width
        };

        const inter = GeospatialUtils.computeBoxIntersection(optNorm, sarNorm);

        if (inter.iou > 0.15 || inter.overlapPctA > 25 || inter.overlapPctB > 25) {
          // Regions overlap in space! Now evaluate physical radiometric consistency:
          if (optReg.category === 'WATER_CANDIDATE' && sarReg.type === 'LOW_BACKSCATTER_SPECULAR') {
            hasConfirmation = true;
            regionsCorresponding.push({
              opticalRegionId: optReg.id,
              sarRegionId: sarReg.id,
              overlapFraction: inter.iou,
              agreementType: 'CONFIRMING',
              notes: 'Optical dark/water body confirmed by SAR low radar specular backscatter.'
            });
            details.push(`Agreement in region [${optReg.id} <-> ${sarReg.id}]: Optical water confirmed by SAR specular return (IoU: ${inter.iou}).`);
          } else if (optReg.category === 'BUILT_UP_CANDIDATE' && sarReg.type === 'HIGH_BACKSCATTER_DOUBLE_BOUNCE') {
            hasConfirmation = true;
            regionsCorresponding.push({
              opticalRegionId: optReg.id,
              sarRegionId: sarReg.id,
              overlapFraction: inter.iou,
              agreementType: 'CONFIRMING',
              notes: 'Optical built structures confirmed by SAR dielectric corner-reflector double-bounce.'
            });
            details.push(`Agreement in region [${optReg.id} <-> ${sarReg.id}]: Optical built-up confirmed by SAR double-bounce backscatter.`);
          } else if (optReg.category === 'BUILT_UP_CANDIDATE' && sarReg.type === 'LOW_BACKSCATTER_SPECULAR') {
            hasDirectConflict = true;
            regionsCorresponding.push({
              opticalRegionId: optReg.id,
              sarRegionId: sarReg.id,
              overlapFraction: inter.iou,
              agreementType: 'CONTRADICTING',
              notes: 'EVIDENCE CONFLICT: Optical features suggest built structure, but SAR radar backscatter is completely flat/specular without vertical corner reflection.'
            });
            details.push(`EVIDENCE CONFLICT in region [${optReg.id} <-> ${sarReg.id}]: Optical apparent built-up contradicts SAR specular backscatter (possible bare soil, sand, or painted ground).`);
          } else if (optReg.category === 'WATER_CANDIDATE' && sarReg.type === 'HIGH_BACKSCATTER_DOUBLE_BOUNCE') {
            hasDirectConflict = true;
            regionsCorresponding.push({
              opticalRegionId: optReg.id,
              sarRegionId: sarReg.id,
              overlapFraction: inter.iou,
              agreementType: 'CONTRADICTING',
              notes: 'EVIDENCE CONFLICT: Optical dark region shows intense SAR backscatter; likely cloud shadow rather than water, or partially submerged metallic structure.'
            });
            details.push(`EVIDENCE CONFLICT in region [${optReg.id} <-> ${sarReg.id}]: Optical dark region has intense SAR backscatter (possible cloud shadow artifact).`);
          }
        }
      }
    }

    let agreementStatus: SpatialOverlapResult['agreementStatus'] = 'COMPLEMENTARY';
    if (hasDirectConflict) {
      agreementStatus = 'CONFLICT';
    } else if (hasConfirmation) {
      agreementStatus = 'AGREEMENT';
    } else if (optical.candidateRegions.length === 0 && sar.candidateRegions.length === 0) {
      agreementStatus = 'INSUFFICIENT_DATA';
      details.push('No localized discrete candidate regions detected in either modality.');
    } else {
      details.push('Optical and SAR sensors provide complementary surface texture and reflectance perspectives without direct region overlap.');
    }

    return {
      hasCommonSpatialGrid,
      overlapPercentageA: hasCommonSpatialGrid ? 100 : 0,
      overlapPercentageB: hasCommonSpatialGrid ? 100 : 0,
      regionsCorresponding,
      agreementStatus,
      details
    };
  }
}
