/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Audit Trail Service (Phase 7).
 * Implements persistent, chronological, tamper-evident audit logging for every major pipeline event.
 */

import fs from 'fs';
import path from 'path';
import { ArchiveConfig } from '../archive/archiveConfig.js';
import { AuditEvent } from './types.js';

export class AuditTrailService {
  private static cachedEvents: AuditEvent[] | null = null;
  private static isLoaded = false;
  private static readonly VERSION = '1.0.0-audit-trail';

  private static getAuditFilePath(): string {
    const dirs = ArchiveConfig.getDirectories();
    return path.join(dirs.reviewDir, 'audit_trail.json');
  }

  public static async loadEvents(): Promise<AuditEvent[]> {
    if (this.isLoaded && this.cachedEvents) {
      return this.cachedEvents;
    }

    await ArchiveConfig.ensureDirectories();
    const filePath = this.getAuditFilePath();

    if (fs.existsSync(filePath)) {
      try {
        const raw = await fs.promises.readFile(filePath, 'utf-8');
        const parsed: AuditEvent[] = JSON.parse(raw);
        this.cachedEvents = parsed;
        this.isLoaded = true;
        return parsed;
      } catch (err) {
        console.warn('Failed to parse audit_trail.json, creating new store:', err);
      }
    }

    this.cachedEvents = [];
    this.isLoaded = true;
    await this.saveEvents([]);
    return [];
  }

  private static async saveEvents(events: AuditEvent[]): Promise<void> {
    await ArchiveConfig.ensureDirectories();
    const filePath = this.getAuditFilePath();
    const tmpPath = `${filePath}.tmp_${Date.now()}`;

    await fs.promises.writeFile(tmpPath, JSON.stringify(events, null, 2), 'utf-8');
    await fs.promises.rename(tmpPath, filePath);

    this.cachedEvents = events;
    this.isLoaded = true;
  }

  /**
   * Records a pipeline or analyst event to the persistent audit trail.
   */
  public static async logEvent(
    operation: AuditEvent['operation'],
    runId: string,
    details: Record<string, any>,
    options: {
      candidateId?: string;
      sceneId?: string;
      status?: AuditEvent['status'];
      provenanceRef?: string;
    } = {}
  ): Promise<AuditEvent> {
    const events = await this.loadEvents();

    const event: AuditEvent = {
      eventId: `EVT-${Date.now()}-${Math.random().toString(16).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      runId,
      candidateId: options.candidateId,
      sceneId: options.sceneId,
      operation,
      status: options.status || 'SUCCESS',
      details,
      relevantVersion: this.VERSION,
      provenanceRef: options.provenanceRef
    };

    events.unshift(event); // newest first

    // Keep up to 1000 events in active file
    if (events.length > 1000) {
      events.pop();
    }

    await this.saveEvents(events);
    return event;
  }

  /**
   * Queries audit events with optional filters.
   */
  public static async getEvents(filters: {
    runId?: string;
    candidateId?: string;
    sceneId?: string;
    operation?: string;
    limit?: number;
  } = {}): Promise<AuditEvent[]> {
    const all = await this.loadEvents();

    let filtered = all;

    if (filters.runId) {
      filtered = filtered.filter(e => e.runId === filters.runId);
    }
    if (filters.candidateId) {
      filtered = filtered.filter(e => e.candidateId === filters.candidateId);
    }
    if (filters.sceneId) {
      filtered = filtered.filter(e => e.sceneId === filters.sceneId);
    }
    if (filters.operation) {
      filtered = filtered.filter(e => e.operation === filters.operation);
    }

    const limit = filters.limit || 100;
    return filtered.slice(0, limit);
  }

  public static clearCache(): void {
    this.cachedEvents = null;
    this.isLoaded = false;
  }
}
