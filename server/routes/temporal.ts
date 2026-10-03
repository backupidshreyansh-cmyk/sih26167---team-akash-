/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Express Router for Multi-Temporal Change Discovery & False-Alarm Suppression (Phase 4 & 5).
 */

import { Router } from 'express';
import { CatalogService } from '../archive/catalogService.js';
import { TemporalGroupingEngine } from '../temporal/temporalGrouping.js';
import { QualityAssessmentEngine } from '../temporal/qualityAssessment.js';
import { ChangeDetectionEngine } from '../temporal/changeDetectionEngine.js';
import { EarliestChangeDetector } from '../temporal/earliestChangeDetector.js';
import { FalseAlarmDecisionEngine } from '../temporal/falseAlarmDecisionEngine.js';
import { SemanticSearchService } from '../retrieval/semanticSearchService.js';
import { ChangeAnalysisResult } from '../temporal/types.js';

export const temporalRouter = Router();

// 1. Group Archive Scenes into Location Time Series
temporalRouter.get('/series', async (_req, res) => {
  try {
    const scenes = await CatalogService.getAllScenes();
    const groups = TemporalGroupingEngine.groupScenesByLocation(scenes);
    return res.json({
      totalLocationGroups: groups.length,
      groups
    });
  } catch (error: any) {
    console.error('Temporal Series Error:', error);
    res.status(500).json({ error: error.message || 'Failed to group temporal series.' });
  }
});

// 2. Perform Staged Multi-Temporal Change Analysis & False-Alarm Screening
temporalRouter.post('/analyze', async (req, res) => {
  try {
    const startTime = performance.now();
    const { beforeSceneId, afterSceneId, subsequentSceneIds = [] } = req.body;

    if (!beforeSceneId || !afterSceneId) {
      return res.status(400).json({ error: 'beforeSceneId and afterSceneId are required.' });
    }

    const beforeScene = await CatalogService.getSceneById(beforeSceneId);
    const afterScene = await CatalogService.getSceneById(afterSceneId);

    if (!beforeScene || !afterScene) {
      return res.status(404).json({ error: 'One or both specified scenes were not found in the archive.' });
    }

    const subsequentScenes = [];
    for (const subId of subsequentSceneIds) {
      const s = await CatalogService.getSceneById(subId);
      if (s) subsequentScenes.push(s);
    }

    // STAGE 1: Registration & Quality Screening
    const quality = QualityAssessmentEngine.assessQuality(beforeScene, afterScene, subsequentScenes);

    // If registration completely failed, stop early (minimum-sufficient analysis)
    if (quality.registration.status === 'REGISTRATION_FAILED') {
      const decision = FalseAlarmDecisionEngine.evaluate(quality, 0, [], beforeScene, afterScene);
      const elapsed = Number((performance.now() - startTime).toFixed(2));

      const earlyResult: ChangeAnalysisResult = {
        analysisId: `analysis_${Date.now()}`,
        beforeSceneId,
        afterSceneId,
        beforeDate: beforeScene.acquisitionDate || 'unknown',
        afterDate: afterScene.acquisitionDate || 'unknown',
        timeDifferenceDays: 0,
        quality,
        changeMetrics: {
          totalScenePixels: 0,
          changedPixelCount: 0,
          changedPercentage: 0,
          meanChangeMagnitude: 0,
          maxChangeMagnitude: 0,
          changeRegions: []
        },
        earliestSupportedChange: {
          supported: false,
          earliestDateOrRange: null,
          earliestSceneId: null,
          confidenceStatement: 'Analysis aborted at Stage 1 due to registration failure.'
        },
        finalDecision: decision.finalStatus,
        semanticClassification: decision.semanticClass,
        analystSummary: decision.analystSummary,
        whyDecided: decision.whyDecided,
        whatIsNeededIfUncertain: decision.whatIsNeededIfUncertain,
        visualEvidence: {
          beforePreviewUrl: beforeScene.thumbnailPath || undefined,
          afterPreviewUrl: afterScene.thumbnailPath || undefined
        },
        provenance: {
          algorithm: ChangeDetectionEngine.VERSION,
          algorithmVersion: '1.2.0',
          analysisTimestamp: new Date().toISOString(),
          isCacheHit: false,
          processingTimeMs: elapsed,
          pipelineStageReached: 'STAGE_1_REGISTRATION'
        }
      };

      return res.json(earlyResult);
    }

    // STAGE 2: Deterministic Pixel Differencing & Change Region Extraction
    const changeResult = ChangeDetectionEngine.detectChanges(beforeScene, afterScene);

    // STAGE 3: Earliest Supported Change Epoch
    const allChronological = [beforeScene, afterScene, ...subsequentScenes].sort((a, b) => {
      const ta = a.acquisitionDate ? new Date(a.acquisitionDate).getTime() : 0;
      const tb = b.acquisitionDate ? new Date(b.acquisitionDate).getTime() : 0;
      return ta - tb;
    });

    const sceneMap = new Map(allChronological.map(s => [s.sceneId, s]));
    const observationRecords = allChronological.map((s, idx) => ({
      sceneId: s.sceneId,
      acquisitionDate: s.acquisitionDate || 'unknown_date',
      sensor: s.sensor,
      satellite: s.satellite,
      modality: s.modality,
      status: (idx === 0 ? 'USABLE_BASELINE' : 'SUPPORTED_CHANGE') as any,
      cloudCoverPct: s.quality.cloudCoverPercentage,
      scene: s
    }));

    const earliestChange = EarliestChangeDetector.evaluateTimeline(observationRecords, sceneMap);

    // STAGE 4: False-Alarm Suppression Decision Gate
    const decision = FalseAlarmDecisionEngine.evaluate(
      quality,
      changeResult.changedPercentage,
      changeResult.changeRegions,
      beforeScene,
      afterScene
    );

    const timeDiffDays = (beforeScene.acquisitionDate && afterScene.acquisitionDate)
      ? Math.round(Math.abs(new Date(afterScene.acquisitionDate).getTime() - new Date(beforeScene.acquisitionDate).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    const elapsed = Number((performance.now() - startTime).toFixed(2));

    const finalResult: ChangeAnalysisResult = {
      analysisId: `analysis_${Date.now()}`,
      beforeSceneId,
      afterSceneId,
      beforeDate: beforeScene.acquisitionDate || 'unknown',
      afterDate: afterScene.acquisitionDate || 'unknown',
      timeDifferenceDays: timeDiffDays,
      quality,
      changeMetrics: {
        totalScenePixels: changeResult.totalScenePixels,
        changedPixelCount: changeResult.changedPixelCount,
        changedPercentage: changeResult.changedPercentage,
        meanChangeMagnitude: changeResult.meanChangeMagnitude,
        maxChangeMagnitude: changeResult.maxChangeMagnitude,
        changeRegions: changeResult.changeRegions
      },
      earliestSupportedChange: {
        supported: earliestChange.supported,
        earliestDateOrRange: earliestChange.earliestDateOrRange,
        earliestSceneId: earliestChange.earliestSceneId,
        confidenceStatement: earliestChange.confidenceStatement
      },
      finalDecision: decision.finalStatus,
      semanticClassification: decision.semanticClass,
      analystSummary: decision.analystSummary,
      whyDecided: decision.whyDecided,
      whatIsNeededIfUncertain: decision.whatIsNeededIfUncertain,
      visualEvidence: {
        beforePreviewUrl: beforeScene.thumbnailPath || undefined,
        afterPreviewUrl: afterScene.thumbnailPath || undefined
      },
      provenance: {
        algorithm: ChangeDetectionEngine.VERSION,
        algorithmVersion: '1.2.0',
        analysisTimestamp: new Date().toISOString(),
        isCacheHit: false,
        processingTimeMs: elapsed,
        pipelineStageReached: 'STAGE_4_FULL_VERIFICATION'
      }
    };

    return res.json(finalResult);
  } catch (error: any) {
    console.error('Temporal Analysis Error:', error);
    res.status(500).json({ error: error.message || 'Temporal change analysis failed.' });
  }
});

// 3. Natural-Language Temporal Discovery ("Find new construction between 2023 and 2025")
temporalRouter.post('/discover', async (req, res) => {
  try {
    const { query = '', topK = 5 } = req.body;

    // Step 1: Semantic Retrieval of candidate locations
    const searchRes = await SemanticSearchService.search(query, {}, topK * 2);

    // Step 2: Fetch all archive scenes and group by location
    const allScenes = await CatalogService.getAllScenes();
    const locationGroups = TemporalGroupingEngine.groupScenesByLocation(allScenes);

    // Step 3: For each top candidate, match with location series and evaluate temporal change
    const results = [];

    for (const candidate of searchRes.candidates.slice(0, topK)) {
      // Find location group containing this candidate scene
      const group = locationGroups.find(g => g.observations.some(o => o.sceneId === candidate.sceneId));

      if (group && group.observations.length >= 2) {
        const usable = group.observations.filter(o => o.status !== 'EXCLUDED');
        if (usable.length >= 2) {
          const beforeObs = usable[0];
          const afterObs = usable[usable.length - 1];

          const beforeScene = allScenes.find(s => s.sceneId === beforeObs.sceneId);
          const afterScene = allScenes.find(s => s.sceneId === afterObs.sceneId);

          if (beforeScene && afterScene) {
            const quality = QualityAssessmentEngine.assessQuality(beforeScene, afterScene);
            const change = ChangeDetectionEngine.detectChanges(beforeScene, afterScene);
            const decision = FalseAlarmDecisionEngine.evaluate(quality, change.changedPercentage, change.changeRegions, beforeScene, afterScene);

            results.push({
              candidateRank: candidate.rank,
              sceneId: candidate.sceneId,
              locationName: group.name,
              semanticSimilarity: candidate.semanticSimilarity,
              temporalBaseline: beforeScene.acquisitionDate?.slice(0, 10),
              changeObservationDate: afterScene.acquisitionDate?.slice(0, 10),
              earliestSupported: beforeScene.acquisitionDate && afterScene.acquisitionDate 
                ? `Between ${beforeScene.acquisitionDate.slice(0, 7)} and ${afterScene.acquisitionDate.slice(0, 7)}`
                : 'Single epoch',
              changePercentage: change.changedPercentage,
              finalStatus: decision.finalStatus,
              changeType: decision.semanticClass,
              qualityStatus: quality.overallStatus,
              registrationStatus: quality.registration.status,
              whyDecided: decision.whyDecided,
              beforeScene,
              afterScene
            });
            continue;
          }
        }
      }

      // Single epoch candidate where temporal baseline is unavailable
      results.push({
        candidateRank: candidate.rank,
        sceneId: candidate.sceneId,
        locationName: candidate.fileName,
        semanticSimilarity: candidate.semanticSimilarity,
        temporalBaseline: candidate.acquisitionDate?.slice(0, 10) || 'Unknown',
        changeObservationDate: candidate.acquisitionDate?.slice(0, 10) || 'Unknown',
        earliestSupported: 'INSUFFICIENT_TEMPORAL_DATA (Single observation in archive)',
        changePercentage: 0,
        finalStatus: 'INSUFFICIENT_EVIDENCE',
        changeType: 'UNKNOWN',
        qualityStatus: candidate.qualityStatus,
        registrationStatus: 'NOT_AVAILABLE',
        whyDecided: ['Single observation in archive; historical comparison requires prior baseline epoch.'],
        beforeScene: candidate.scene,
        afterScene: candidate.scene
      });
    }

    return res.json({
      query,
      plan: searchRes.plan,
      totalTemporalCandidates: results.length,
      candidates: results
    });
  } catch (error: any) {
    console.error('Temporal Discovery Error:', error);
    res.status(500).json({ error: error.message || 'Temporal discovery execution failed.' });
  }
});
