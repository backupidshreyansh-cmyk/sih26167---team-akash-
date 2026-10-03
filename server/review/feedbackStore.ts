/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Local Analyst Feedback Store (Phase 7).
 * Persists analyst decisions, rejection reasons, and confirmation evidence locally.
 */

import fs from 'fs';
import path from 'path';
import { ArchiveConfig } from '../archive/archiveConfig.js';
import { FeedbackRecord } from './types.js';

export class FeedbackStore {
  private static cachedFeedback: FeedbackRecord[] | null = null;
  private static isLoaded = false;

  private static getFilePath(): string {
    const dirs = ArchiveConfig.getDirectories();
    return path.join(dirs.reviewDir, 'feedback.json');
  }

  public static async loadFeedback(): Promise<FeedbackRecord[]> {
    if (this.isLoaded && this.cachedFeedback) {
      return this.cachedFeedback;
    }

    await ArchiveConfig.ensureDirectories();
    const filePath = this.getFilePath();

    if (fs.existsSync(filePath)) {
      try {
        const raw = await fs.promises.readFile(filePath, 'utf-8');
        const parsed: FeedbackRecord[] = JSON.parse(raw);
        this.cachedFeedback = parsed;
        this.isLoaded = true;
        return parsed;
      } catch (err) {
        console.warn('Failed to parse feedback.json, initializing fresh store:', err);
      }
    }

    this.cachedFeedback = [];
    this.isLoaded = true;
    await this.saveFeedback([]);
    return [];
  }

  private static async saveFeedback(records: FeedbackRecord[]): Promise<void> {
    await ArchiveConfig.ensureDirectories();
    const filePath = this.getFilePath();
    const tmpPath = `${filePath}.tmp_${Date.now()}`;

    await fs.promises.writeFile(tmpPath, JSON.stringify(records, null, 2), 'utf-8');
    await fs.promises.rename(tmpPath, filePath);

    this.cachedFeedback = records;
    this.isLoaded = true;
  }

  /**
   * Appends an analyst feedback record.
   */
  public static async recordFeedback(feedback: Omit<FeedbackRecord, 'feedbackId' | 'timestamp'>): Promise<FeedbackRecord> {
    const list = await this.loadFeedback();

    const record: FeedbackRecord = {
      ...feedback,
      feedbackId: `FB-${Date.now()}-${Math.random().toString(16).substring(2, 6)}`,
      timestamp: new Date().toISOString()
    };

    list.unshift(record);
    await this.saveFeedback(list);
    return record;
  }

  /**
   * Retrieves all feedback records or filters by scene/query.
   */
  public static async getFeedback(filters: {
    candidateId?: string;
    referenceSceneId?: string;
    decision?: FeedbackRecord['analystDecision'];
    limit?: number;
  } = {}): Promise<FeedbackRecord[]> {
    const list = await this.loadFeedback();
    let filtered = list;

    if (filters.candidateId) {
      filtered = filtered.filter(f => f.candidateId === filters.candidateId);
    }
    if (filters.referenceSceneId) {
      filtered = filtered.filter(f => f.referenceSceneId === filters.referenceSceneId);
    }
    if (filters.decision) {
      filtered = filtered.filter(f => f.analystDecision === filters.decision);
    }

    const limit = filters.limit || 100;
    return filtered.slice(0, limit);
  }

  public static clearCache(): void {
    this.cachedFeedback = null;
    this.isLoaded = false;
  }
}
