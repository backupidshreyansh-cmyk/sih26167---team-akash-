/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Feedback-Aware Deterministic Reranker (Phase 7).
 * Applies scoped, explainable positive (+0.04) and negative (-0.10) ranking adjustments
 * based on verified historical analyst decisions without modifying underlying embeddings or models.
 * 
 * FORMULA:
 * finalRankScore = clamp(baseScore + feedbackAdjustment, 0.0, 1.0)
 * 
 * Scoped by:
 * - Specific scene ID matching previous decision
 * - Query concept / semantic classification alignment
 */

import { FeedbackStore } from './feedbackStore.js';
import { FeedbackRecord } from './types.js';

export interface FeedbackAdjustmentResult {
  baseScore: number;
  feedbackAdjustment: number;
  finalScore: number;
  appliedRule: string | null;
  historicalFeedbackCount: number;
}

export class FeedbackReranker {
  /**
   * Evaluates deterministic feedback adjustment for a candidate scene under a query context.
   */
  public static async computeAdjustment(
    sceneId: string,
    baseScore: number,
    context: {
      query?: string;
      semanticConcept?: string;
      modality?: string;
    } = {}
  ): Promise<FeedbackAdjustmentResult> {
    const feedbackList = await FeedbackStore.loadFeedback();

    if (feedbackList.length === 0) {
      return {
        baseScore,
        feedbackAdjustment: 0.0,
        finalScore: baseScore,
        appliedRule: null,
        historicalFeedbackCount: 0
      };
    }

    // 1. Direct Scene Confirmation / Rejection Check (Highest specificity)
    const directSceneFeedback = feedbackList.find(f => 
      f.candidateId.includes(sceneId) || 
      f.referenceSceneId === sceneId
    );

    if (directSceneFeedback) {
      if (directSceneFeedback.analystDecision === 'CONFIRMED') {
        const adjustment = 0.05;
        const finalScore = Number(Math.min(1.0, baseScore + adjustment).toFixed(4));
        return {
          baseScore,
          feedbackAdjustment: adjustment,
          finalScore,
          appliedRule: `+0.05: Analyst previously confirmed scene '${sceneId}' as verified positive evidence.`,
          historicalFeedbackCount: 1
        };
      } else if (directSceneFeedback.analystDecision === 'REJECTED') {
        const adjustment = -0.10;
        const finalScore = Number(Math.max(0.0, baseScore + adjustment).toFixed(4));
        const reason = directSceneFeedback.rejectionReason || 'FALSE_ALARM';
        return {
          baseScore,
          feedbackAdjustment: adjustment,
          finalScore,
          appliedRule: `-0.10: Analyst previously rejected scene '${sceneId}' (Reason: ${reason}).`,
          historicalFeedbackCount: 1
        };
      }
    }

    // 2. Scoped Concept & Modality Feedback Check
    if (context.semanticConcept) {
      const conceptRejections = feedbackList.filter(f => 
        f.analystDecision === 'REJECTED' && 
        f.candidateFeatures.changeType.toLowerCase() === context.semanticConcept?.toLowerCase()
      );

      const conceptConfirmations = feedbackList.filter(f => 
        f.analystDecision === 'CONFIRMED' && 
        f.candidateFeatures.changeType.toLowerCase() === context.semanticConcept?.toLowerCase()
      );

      if (conceptConfirmations.length > conceptRejections.length && conceptConfirmations.length >= 2) {
        const adjustment = 0.02;
        const finalScore = Number(Math.min(1.0, baseScore + adjustment).toFixed(4));
        return {
          baseScore,
          feedbackAdjustment: adjustment,
          finalScore,
          appliedRule: `+0.02: Scoped boost based on ${conceptConfirmations.length} confirmed '${context.semanticConcept}' candidates.`,
          historicalFeedbackCount: conceptConfirmations.length
        };
      }
    }

    return {
      baseScore,
      feedbackAdjustment: 0.0,
      finalScore: baseScore,
      appliedRule: null,
      historicalFeedbackCount: 0
    };
  }
}
