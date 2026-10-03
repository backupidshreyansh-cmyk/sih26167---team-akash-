/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * False-Alarm Suppression & Decision Engine (Phase 5).
 * Explicit deterministic decision rules screening out seasonal, cloud,
 * illumination, and sensor confounders before declaring real-world change.
 */

import { SceneRecord } from '../archive/types.js';
import { 
  TemporalQualityChecks, 
  ChangeRegion, 
  FinalChangeStatus, 
  SemanticChangeClass 
} from './types.js';

export interface DecisionGateOutcome {
  finalStatus: FinalChangeStatus;
  semanticClass: SemanticChangeClass;
  analystSummary: string;
  whyDecided: string[];
  whatIsNeededIfUncertain?: string;
  evidenceConfidenceGrade: 'HIGH' | 'MEDIUM' | 'LOW' | 'REJECTED';
}

export class FalseAlarmDecisionEngine {
  /**
   * Applies non-negotiable deterministic rules to determine the true nature of observed differences.
   */
  public static evaluate(
    quality: TemporalQualityChecks,
    changePercentage: number,
    changeRegions: ChangeRegion[],
    beforeScene: SceneRecord,
    afterScene: SceneRecord
  ): DecisionGateOutcome {
    const whyDecided: string[] = [];

    // RULE 1: Registration Failure Gate
    if (quality.registration.status === 'REGISTRATION_FAILED') {
      return {
        finalStatus: 'REGISTRATION_UNCERTAIN',
        semanticClass: 'UNKNOWN',
        analystSummary: 'Spatial comparison rejected due to complete registration/CRS failure.',
        whyDecided: [
          '✗ Incompatible spatial coordinate systems or zero footprint overlap.',
          '✗ Geometric registration failed; cannot compute pixel correspondence.'
        ],
        whatIsNeededIfUncertain: 'Orthorectified imagery with verified spatial CRS in the same projection.',
        evidenceConfidenceGrade: 'REJECTED'
      };
    }

    // RULE 2: Severe Cloud Contamination Gate
    if (quality.cloud.status === 'CONTAMINATED') {
      return {
        finalStatus: 'LOW_QUALITY',
        semanticClass: 'UNKNOWN',
        analystSummary: 'Observed differences contaminated by cloud, haze, or shadow obscuration.',
        whyDecided: [
          `✗ Severe cloud cover (${quality.cloud.beforeCloudCoverPct || quality.cloud.afterCloudCoverPct}%) contaminates raster.`,
          '✗ Apparent pixel divergence represents cloud boundary rather than surface alteration.'
        ],
        whatIsNeededIfUncertain: 'Cloud-free optical observation or cloud-penetrating SAR C-band microwave observation.',
        evidenceConfidenceGrade: 'REJECTED'
      };
    }

    // RULE 3: Cross-Sensor Comparison Gate without Calibrated Transfer
    if (quality.sensorRelationship.relationship === 'CROSS_SENSOR_COMPARISON') {
      // Check if one is Optical and one is SAR
      const isCrossModal = (beforeScene.modality === 'optical' && afterScene.modality === 'sar') ||
                           (beforeScene.modality === 'sar' && afterScene.modality === 'optical');
      if (isCrossModal) {
        return {
          finalStatus: 'CROSS_SENSOR_UNCERTAIN',
          semanticClass: 'UNKNOWN',
          analystSummary: 'Cross-sensor comparison: Optical reflectance cannot be directly subtracted from SAR microwave backscatter.',
          whyDecided: [
            '✗ Cross-sensor physics disparity: Optical solar reflectance vs active microwave dielectric roughness.',
            '✗ Pixel difference does not prove physical land-use change.'
          ],
          whatIsNeededIfUncertain: 'Matched-modality temporal pair (Optical-Optical or SAR-SAR).',
          evidenceConfidenceGrade: 'LOW'
        };
      }
    }

    // RULE 4: No Significant Magnitude Gate
    if (changePercentage < 2.0 && changeRegions.length === 0) {
      return {
        finalStatus: 'NO_SIGNIFICANT_CHANGE',
        semanticClass: 'UNKNOWN',
        analystSummary: 'No significant surface changes detected beyond ambient sensor noise.',
        whyDecided: [
          `✓ Overall scene difference is only ${changePercentage}%, well below alteration threshold (4.0%).`,
          '✓ No coherent spatial change clusters detected.'
        ],
        evidenceConfidenceGrade: 'HIGH'
      };
    }

    // RULE 5: Weak Difference + High Seasonality Confounder Gate
    if (quality.season.severity === 'HIGH' && changePercentage < 18.0) {
      const hasStrongStructuralRegion = changeRegions.some(r => r.potentialSemanticInterpretation === 'CONSTRUCTION' && r.spatialCoherence === 'STRONG');
      if (!hasStrongStructuralRegion) {
        return {
          finalStatus: 'LIKELY_SEASONAL_VARIATION',
          semanticClass: 'VEGETATION_CHANGE',
          analystSummary: 'Diffuse radiometric variance consistent with natural seasonal phenology / monsoon vegetation cycle.',
          whyDecided: [
            '⚠ Strong calendar seasonal divergence (e.g. monsoon vs winter).',
            '⚠ Non-compact, diffuse change patterns characteristic of crop cycle or soil moisture variance.',
            '✓ Suppressed false alarm from premature construction declaration.'
          ],
          whatIsNeededIfUncertain: 'Anniversary date observation (same calendar month in subsequent year) to eliminate seasonal cycle.',
          evidenceConfidenceGrade: 'MEDIUM'
        };
      }
    }

    // RULE 6: Supported Change Gate (Strong spatial coherence + verified registration + usable data)
    const strongRegions = changeRegions.filter(r => r.spatialCoherence === 'STRONG');
    const isRegistrationGood = quality.registration.status === 'ALIGNED' || quality.registration.status === 'PARTIALLY_ALIGNED';

    if (isRegistrationGood && strongRegions.length > 0 && changePercentage >= 8.0) {
      const primaryRegion = strongRegions[0];
      const semanticClass = primaryRegion.potentialSemanticInterpretation;

      whyDecided.push(`✓ Spatially coherent change region verified (${primaryRegion.pixelArea} pixels, density ${primaryRegion.density}).`);
      whyDecided.push(`✓ Registration status verified as ${quality.registration.status}.`);
      whyDecided.push(`✓ Surface change magnitude ΔL = ${primaryRegion.meanMagnitude} DN exceeds noise floor.`);
      
      if (quality.persistence.status === 'PERSISTENT') {
        whyDecided.push('✓ Multi-epoch temporal persistence validated across observation series.');
      }

      return {
        finalStatus: 'SUPPORTED_CHANGE',
        semanticClass,
        analystSummary: `Supported ${semanticClass.toLowerCase().replace(/_/g, ' ')} established by spatially coherent change clustering.`,
        whyDecided,
        evidenceConfidenceGrade: 'HIGH'
      };
    }

    // RULE 7: Possible Change (Difference present but spatial coherence moderate)
    if (changePercentage >= 4.0) {
      return {
        finalStatus: 'POSSIBLE_CHANGE',
        semanticClass: changeRegions[0]?.potentialSemanticInterpretation || 'UNKNOWN',
        analystSummary: 'Candidate difference detected, but evidence is insufficient to verify permanent structural alteration.',
        whyDecided: [
          `✓ Detectable radiometric change observed (${changePercentage}% of scene).`,
          '⚠ Spatial coherence is moderate or registration has minor uncertainty.',
          '⚠ Requires corroborating epoch to confirm permanence.'
        ],
        whatIsNeededIfUncertain: 'Subsequent temporal observation to confirm persistence and eliminate transient clearing.',
        evidenceConfidenceGrade: 'MEDIUM'
      };
    }

    // Default Gate: Insufficient Evidence
    return {
      finalStatus: 'INSUFFICIENT_EVIDENCE',
      semanticClass: 'UNKNOWN',
      analystSummary: 'Available evidence is insufficient to distinguish real ground change from sensor artifacts.',
      whyDecided: [
        '⚠ Change magnitude is low and no coherent spatial regions could be isolated.',
        '⚠ Confounder risks remain unmitigated.'
      ],
      whatIsNeededIfUncertain: 'Calibrated temporal observation pair with authoritative spatial georeferencing.',
      evidenceConfidenceGrade: 'LOW'
    };
  }
}
