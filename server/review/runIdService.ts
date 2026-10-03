/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Run ID & Workflow Correlation Service (Phase 7).
 * Generates unique run IDs connecting user query -> retrieval -> temporal -> review.
 */

export interface RunRecord {
  runId: string;
  createdAt: string;
  workflowType: 'SEMANTIC_RETRIEVAL' | 'TEMPORAL_ANALYSIS' | 'SIMILAR_SITE_DISCOVERY' | 'ANALYST_REVIEW';
  initialQuery?: string;
  referenceSceneId?: string;
  stagesCompleted: string[];
}

export class RunIdService {
  private static runRegistry = new Map<string, RunRecord>();

  /**
   * Generates a standardized, auditable Run ID.
   * Format: RUN-YYYYMMDD-HHMMSS-RANDOMHEX
   */
  public static generateRunId(workflowType: RunRecord['workflowType'] = 'SEMANTIC_RETRIEVAL'): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const suffix = Math.random().toString(16).substring(2, 6).toUpperCase();

    const runId = `RUN-${year}${month}${day}-${hours}${minutes}${seconds}-${suffix}`;

    this.runRegistry.set(runId, {
      runId,
      createdAt: now.toISOString(),
      workflowType,
      stagesCompleted: ['INITIALIZED']
    });

    return runId;
  }

  public static recordStage(runId: string, stageName: string): void {
    const record = this.runRegistry.get(runId);
    if (record && !record.stagesCompleted.includes(stageName)) {
      record.stagesCompleted.push(stageName);
    }
  }

  public static getRun(runId: string): RunRecord | null {
    return this.runRegistry.get(runId) || null;
  }
}
