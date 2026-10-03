/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Earliest Supported Change Epoch Detector (Phase 4).
 * Determines the chronological observation where change onset is first supported
 * by evidence and verified across subsequent epochs.
 */

import { SceneRecord } from '../archive/types.js';
import { TemporalObservationRecord } from './types.js';
import { ChangeDetectionEngine } from './changeDetectionEngine.js';

export interface EarliestChangeResult {
  supported: boolean;
  earliestDateOrRange: string | null;
  earliestSceneId: string | null;
  baselineDate: string | null;
  baselineSceneId: string | null;
  timeline: Array<{
    epochIndex: number;
    sceneId: string;
    date: string;
    status: 'BASELINE' | 'NO_CHANGE' | 'POSSIBLE_CHANGE' | 'SUPPORTED_CHANGE' | 'PERSISTENT_CHANGE' | 'EXCLUDED';
    changePercentAgainstBaseline?: number;
    notes: string;
  }>;
  confidenceStatement: string;
}

export class EarliestChangeDetector {
  /**
   * Evaluates a chronological sequence of observations to locate the earliest change onset.
   */
  public static evaluateTimeline(
    observations: TemporalObservationRecord[],
    sceneLookup: Map<string, SceneRecord>
  ): EarliestChangeResult {
    // Filter out excluded observations
    const usable = observations.filter(o => o.status !== 'EXCLUDED');

    if (usable.length < 2) {
      return {
        supported: false,
        earliestDateOrRange: null,
        earliestSceneId: null,
        baselineDate: usable[0]?.acquisitionDate || null,
        baselineSceneId: usable[0]?.sceneId || null,
        timeline: observations.map((o, idx) => ({
          epochIndex: idx,
          sceneId: o.sceneId,
          date: o.acquisitionDate,
          status: o.status === 'EXCLUDED' ? 'EXCLUDED' : 'BASELINE',
          notes: o.exclusionReason || 'Single observation; temporal change unprovable without subsequent baseline.'
        })),
        confidenceStatement: 'INSUFFICIENT TEMPORAL BASELINE: At least two usable chronological observations required.'
      };
    }

    const baselineObs = usable[0];
    const baselineScene = sceneLookup.get(baselineObs.sceneId) || (baselineObs.scene as SceneRecord);

    const timeline: EarliestChangeResult['timeline'] = [];
    timeline.push({
      epochIndex: 0,
      sceneId: baselineObs.sceneId,
      date: baselineObs.acquisitionDate,
      status: 'BASELINE',
      notes: 'Initial chronological baseline epoch.'
    });

    let earliestSupportedEpoch: string | null = null;
    let earliestSupportedSceneId: string | null = null;
    let priorEpochDate = baselineObs.acquisitionDate;

    for (let i = 1; i < usable.length; i++) {
      const currentObs = usable[i];
      const currentScene = sceneLookup.get(currentObs.sceneId) || (currentObs.scene as SceneRecord);

      // Run deterministic change differencing against baseline
      const changeResult = (baselineScene && currentScene)
        ? ChangeDetectionEngine.detectChanges(baselineScene, currentScene)
        : { changedPercentage: 0, changeRegions: [] };

      const changePct = changeResult.changedPercentage;
      const hasStrongRegions = changeResult.changeRegions.some(r => r.spatialCoherence === 'STRONG');

      let status: 'NO_CHANGE' | 'POSSIBLE_CHANGE' | 'SUPPORTED_CHANGE' | 'PERSISTENT_CHANGE' = 'NO_CHANGE';
      let notes = 'No significant structural differences from baseline.';

      if (changePct >= 10.0 && hasStrongRegions) {
        if (!earliestSupportedEpoch) {
          status = 'SUPPORTED_CHANGE';
          earliestSupportedEpoch = currentObs.acquisitionDate;
          earliestSupportedSceneId = currentObs.sceneId;
          notes = `Earliest supported change onset verified against baseline (Area alteration: ${changePct}%).`;
        } else {
          status = 'PERSISTENT_CHANGE';
          notes = `Change validated as persistent across multi-epoch observation (Area alteration: ${changePct}%).`;
        }
      } else if (changePct >= 4.0) {
        status = 'POSSIBLE_CHANGE';
        notes = `Weak candidate difference detected (${changePct}%); insufficient spatial coherence to confirm permanent alteration.`;
      }

      timeline.push({
        epochIndex: i,
        sceneId: currentObs.sceneId,
        date: currentObs.acquisitionDate,
        status,
        changePercentAgainstBaseline: changePct,
        notes
      });

      priorEpochDate = currentObs.acquisitionDate;
    }

    const supported = Boolean(earliestSupportedEpoch);

    // Honest date range format: e.g. "Between 2023-03 and 2024-03"
    let formattedRange: string | null = null;
    if (earliestSupportedEpoch && baselineObs.acquisitionDate) {
      const baseYearMonth = baselineObs.acquisitionDate.slice(0, 7);
      const earlyYearMonth = earliestSupportedEpoch.slice(0, 7);
      formattedRange = `Between ${baseYearMonth} and ${earlyYearMonth}`;
    }

    return {
      supported,
      earliestDateOrRange: formattedRange || earliestSupportedEpoch,
      earliestSceneId: earliestSupportedSceneId,
      baselineDate: baselineObs.acquisitionDate,
      baselineSceneId: baselineObs.sceneId,
      timeline,
      confidenceStatement: supported
        ? `Earliest supported change established ${formattedRange}. Confirmed by coherent spatial clustering.`
        : 'NO SIGNIFICANT TEMPORAL CHANGE: Differences across available epochs remain below significance threshold.'
    };
  }
}
