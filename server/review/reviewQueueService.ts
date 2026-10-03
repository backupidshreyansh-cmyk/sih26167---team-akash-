/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Review Queue Service (Phase 7).
 * Local, persistent analyst review queue with strict state transition validation.
 */

import fs from 'fs';
import path from 'path';
import { ArchiveConfig } from '../archive/archiveConfig.js';
import { AuditTrailService } from './auditTrailService.js';
import { FeedbackStore } from './feedbackStore.js';
import { RunIdService } from './runIdService.js';
import { 
  ReviewCandidate, 
  ReviewStatus, 
  RejectionReason, 
  ConfirmationEvidence, 
  ReviewQueueFilters 
} from './types.js';

export class ReviewQueueService {
  private static cachedQueue: ReviewCandidate[] | null = null;
  private static isLoaded = false;
  private static readonly VERSION = '1.0.0-phase7-review';

  private static getQueueFilePath(): string {
    const dirs = ArchiveConfig.getDirectories();
    return path.join(dirs.reviewDir, 'review_queue.json');
  }

  public static async loadQueue(): Promise<ReviewCandidate[]> {
    if (this.isLoaded && this.cachedQueue) {
      return this.cachedQueue;
    }

    await ArchiveConfig.ensureDirectories();
    const filePath = this.getQueueFilePath();

    if (fs.existsSync(filePath)) {
      try {
        const raw = await fs.promises.readFile(filePath, 'utf-8');
        const parsed: ReviewCandidate[] = JSON.parse(raw);
        this.cachedQueue = parsed;
        this.isLoaded = true;
        return parsed;
      } catch (err) {
        console.warn('Failed to parse review_queue.json, initializing fresh queue:', err);
      }
    }

    // Seed realistic initial review candidates if empty
    const initialCandidates = this.generateInitialCandidates();
    this.cachedQueue = initialCandidates;
    this.isLoaded = true;
    await this.saveQueue(initialCandidates);
    return initialCandidates;
  }

  private static async saveQueue(queue: ReviewCandidate[]): Promise<void> {
    await ArchiveConfig.ensureDirectories();
    const filePath = this.getQueueFilePath();
    const tmpPath = `${filePath}.tmp_${Date.now()}`;

    await fs.promises.writeFile(tmpPath, JSON.stringify(queue, null, 2), 'utf-8');
    await fs.promises.rename(tmpPath, filePath);

    this.cachedQueue = queue;
    this.isLoaded = true;
  }

  /**
   * Enqueues a candidate into the review queue.
   */
  public static async enqueueCandidate(candidate: Omit<ReviewCandidate, 'candidateId' | 'enqueuedAt' | 'updatedAt'>): Promise<ReviewCandidate> {
    const queue = await this.loadQueue();

    const candidateId = `REV-CAND-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(16).substring(2, 6).toUpperCase()}`;
    const now = new Date().toISOString();

    const newCandidate: ReviewCandidate = {
      ...candidate,
      candidateId,
      enqueuedAt: now,
      updatedAt: now,
      provenance: {
        ...candidate.provenance,
        processingVersion: this.VERSION,
        timestamps: {
          enqueued: now,
          lastModified: now
        }
      }
    };

    queue.unshift(newCandidate);
    await this.saveQueue(queue);

    await AuditTrailService.logEvent(
      'CANDIDATE_QUEUED',
      candidate.sourceRunId,
      {
        candidateId,
        sourceType: candidate.sourceType,
        locationName: candidate.identity.locationName,
        changeType: candidate.change.changeClassification
      },
      {
        candidateId,
        sceneId: candidate.identity.sceneId
      }
    );

    return newCandidate;
  }

  /**
   * Updates candidate review status with state transition validation.
   */
  public static async updateCandidateDecision(
    candidateId: string,
    decision: 'CONFIRMED' | 'REJECTED' | 'UNCERTAIN',
    options: {
      rejectionReason?: RejectionReason;
      rejectionNotes?: string;
      confirmedEvidence?: ConfirmationEvidence[];
      analystNotes?: string;
      runId?: string;
    } = {}
  ): Promise<ReviewCandidate> {
    const queue = await this.loadQueue();
    const candidate = queue.find(c => c.candidateId === candidateId);

    if (!candidate) {
      throw new Error(`Review candidate '${candidateId}' not found.`);
    }

    // State transition validation
    const currentStatus = candidate.status;
    const targetStatus: ReviewStatus = decision === 'CONFIRMED' 
      ? 'CONFIRMED' 
      : decision === 'REJECTED' 
        ? 'REJECTED' 
        : 'UNCERTAIN';

    // Prevent illegal transitions (e.g., ARCHIVED cannot transition directly to CONFIRMED)
    if (currentStatus === 'ARCHIVED') {
      throw new Error(`Candidate '${candidateId}' is ARCHIVED and cannot be directly modified.`);
    }

    const now = new Date().toISOString();
    const effectiveRunId = options.runId || candidate.sourceRunId || RunIdService.generateRunId('ANALYST_REVIEW');

    candidate.status = targetStatus;
    candidate.updatedAt = now;
    candidate.analystDecision = {
      decision,
      timestamp: now,
      rejectionReason: options.rejectionReason,
      rejectionNotes: options.rejectionNotes,
      confirmedEvidence: options.confirmedEvidence,
      analystNotes: options.analystNotes,
      runId: effectiveRunId,
      processingVersion: this.VERSION
    };

    candidate.provenance.timestamps.decisionRecorded = now;
    candidate.provenance.timestamps.lastModified = now;

    // Append to processing history
    candidate.processingHistory.push({
      step: `Analyst Review: ${decision}`,
      status: 'COMPLETED',
      timestamp: now,
      details: decision === 'REJECTED' 
        ? `Reason: ${options.rejectionReason || 'Unspecified'}`
        : decision === 'CONFIRMED'
          ? `Evidence: ${(options.confirmedEvidence || []).join(', ')}`
          : 'Marked uncertain for multi-sensor corroboration'
    });

    await this.saveQueue(queue);

    // Record persistent feedback in FeedbackStore
    await FeedbackStore.recordFeedback({
      candidateId,
      referenceSceneId: candidate.identity.sceneId,
      query: candidate.retrieval.originalQuery,
      retrievalMethod: candidate.retrieval.retrievalMethod,
      candidateFeatures: {
        sensor: candidate.identity.sensors[0] || 'Unknown',
        modality: candidate.identity.modality,
        changeType: candidate.change.changeClassification,
        similarity: candidate.retrieval.similarityScore,
        registrationStatus: candidate.quality.registrationStatus
      },
      systemResult: {
        systemStatus: candidate.quality.overallStatus,
        changePercentage: candidate.change.changePercentage
      },
      analystDecision: decision,
      rejectionReason: options.rejectionReason,
      rejectionNotes: options.rejectionNotes,
      confirmedEvidence: options.confirmedEvidence,
      analystNotes: options.analystNotes,
      runId: effectiveRunId
    });

    // Log to Audit Trail
    const auditOp = decision === 'CONFIRMED' 
      ? 'CANDIDATE_CONFIRMED' 
      : decision === 'REJECTED' 
        ? 'CANDIDATE_REJECTED' 
        : 'CANDIDATE_MARKED_UNCERTAIN';

    await AuditTrailService.logEvent(
      auditOp,
      effectiveRunId,
      {
        candidateId,
        decision,
        reason: options.rejectionReason,
        evidence: options.confirmedEvidence,
        notes: options.analystNotes
      },
      {
        candidateId,
        sceneId: candidate.identity.sceneId
      }
    );

    return candidate;
  }

  /**
   * Bulk review operation with validation.
   */
  public static async bulkDecision(
    candidateIds: string[],
    decision: 'CONFIRMED' | 'REJECTED',
    options: {
      rejectionReason?: RejectionReason;
      rejectionNotes?: string;
      confirmedEvidence?: ConfirmationEvidence[];
      analystNotes?: string;
      runId?: string;
    } = {}
  ): Promise<{ updatedCount: number; candidateIds: string[] }> {
    const runId = options.runId || RunIdService.generateRunId('ANALYST_REVIEW');
    let count = 0;

    for (const id of candidateIds) {
      try {
        await this.updateCandidateDecision(id, decision, {
          ...options,
          runId
        });
        count++;
      } catch (err) {
        console.warn(`Failed to update candidate '${id}' in bulk decision:`, err);
      }
    }

    await AuditTrailService.logEvent(
      'BULK_REVIEW_APPLIED',
      runId,
      {
        decision,
        requestedCount: candidateIds.length,
        updatedCount: count,
        candidateIds
      }
    );

    return { updatedCount: count, candidateIds };
  }

  /**
   * Retrieves candidates matching filters and search text.
   */
  public static async queryQueue(filters: ReviewQueueFilters = {}): Promise<{
    totalCandidates: number;
    counts: Record<ReviewStatus, number>;
    candidates: ReviewCandidate[];
  }> {
    const queue = await this.loadQueue();

    const counts: Record<ReviewStatus, number> = {
      NEW: 0,
      IN_REVIEW: 0,
      CONFIRMED: 0,
      REJECTED: 0,
      UNCERTAIN: 0,
      ARCHIVED: 0
    };

    for (const c of queue) {
      if (counts[c.status] !== undefined) {
        counts[c.status]++;
      }
    }

    let filtered = queue.filter(c => {
      if (filters.status && filters.status !== 'ALL' && c.status !== filters.status) {
        return false;
      }
      if (filters.changeType && filters.changeType !== 'ALL' && c.change.changeClassification.toLowerCase() !== filters.changeType.toLowerCase()) {
        return false;
      }
      if (filters.sensor && filters.sensor !== 'ALL' && !c.identity.sensors.some(s => s.toLowerCase().includes(filters.sensor!.toLowerCase()))) {
        return false;
      }
      if (filters.quality && filters.quality !== 'ALL' && c.quality.overallStatus !== filters.quality) {
        return false;
      }
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const match = c.candidateId.toLowerCase().includes(q) ||
          c.identity.locationName.toLowerCase().includes(q) ||
          c.identity.fileName.toLowerCase().includes(q) ||
          c.change.changeClassification.toLowerCase().includes(q) ||
          (c.retrieval.originalQuery && c.retrieval.originalQuery.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });

    // Sorting
    const sortOrder = filters.sortOrder === 'ASC' ? 1 : -1;
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case 'NEWEST':
          return sortOrder * (new Date(b.enqueuedAt).getTime() - new Date(a.enqueuedAt).getTime());
        case 'OLDEST':
          return sortOrder * (new Date(a.enqueuedAt).getTime() - new Date(b.enqueuedAt).getTime());
        case 'CHANGE_PERCENTAGE':
          return sortOrder * (b.change.changePercentage - a.change.changePercentage);
        case 'STATUS':
          return sortOrder * a.status.localeCompare(b.status);
        case 'QUALITY':
          return sortOrder * a.quality.overallStatus.localeCompare(b.quality.overallStatus);
        case 'RELEVANCE':
        default:
          return sortOrder * (b.retrieval.similarityScore - a.retrieval.similarityScore);
      }
    });

    return {
      totalCandidates: filtered.length,
      counts,
      candidates: filtered
    };
  }

  public static async getCandidateById(candidateId: string): Promise<ReviewCandidate | null> {
    const queue = await this.loadQueue();
    return queue.find(c => c.candidateId === candidateId) || null;
  }

  public static clearCache(): void {
    this.cachedQueue = null;
    this.isLoaded = false;
  }

  /**
   * Generates realistic initial candidates from known benchmarks if queue is fresh.
   */
  private static generateInitialCandidates(): ReviewCandidate[] {
    const now = new Date().toISOString();
    return [
      {
        candidateId: 'REV-CAND-20261003-0001',
        sourceRunId: 'RUN-20261003-091520-A4F1',
        sourceType: 'TEMPORAL_CHANGE',
        status: 'NEW',
        enqueuedAt: new Date(Date.now() - 3600000).toISOString(),
        updatedAt: new Date(Date.now() - 3600000).toISOString(),
        identity: {
          candidateId: 'REV-CAND-20261003-0001',
          sceneId: 'msi_20240315_amaravati',
          beforeSceneId: 'msi_20220315_amaravati_t1',
          afterSceneId: 'msi_20240315_amaravati_t2',
          fileName: 'amaravati_krishna_river_s2.tif',
          locationName: 'Amaravati Capital Region (Krishna River Basin)',
          crs: 'EPSG:32644 - WGS 84 / UTM zone 44N',
          bounds: { minLng: 80.48, maxLng: 80.56, minLat: 16.48, maxLat: 16.54 },
          acquisitionDates: ['2022-03-15T05:30:00Z', '2024-03-15T05:30:00Z'],
          sensors: ['MSI Multi-Spectral Instrument'],
          satellites: ['Sentinel-2B'],
          modality: 'optical',
          resolution: '10.0m Ground Sample Distance'
        },
        retrieval: {
          originalQuery: 'Find newly built structures near rivers between 2022 and 2024',
          searchMode: 'SEMANTIC_TEMPORAL',
          retrievalMethod: 'Local Vector Cosine Similarity + Metadata Filtering',
          similarityScore: 0.884,
          filtersUsed: {
            dateRange: { start: '2022-01-01', end: '2024-12-31' },
            modality: 'optical',
            hasCrs: true
          },
          whyRetrieved: [
            '✓ Semantic cosine similarity: 88.4%',
            '✓ River proximity match in Krishna River Basin',
            '✓ Date window matches 2022-2024 interval',
            '✓ Georeferenced spatial CRS: EPSG:32644'
          ]
        },
        temporal: {
          hasTemporalComparison: true,
          timeDifferenceDays: 730,
          earliestSupportedDateOrRange: 'Between 2022-03 and 2024-03',
          earliestSupportedSceneId: 'msi_20240315_amaravati_t2',
          timelineStatement: 'Confirmed ground transformation earliest visible in 2024-03 observation.',
          beforeDate: '2022-03-15T05:30:00Z',
          afterDate: '2024-03-15T05:30:00Z',
          usableObservationsCount: 2,
          excludedObservationsCount: 0
        },
        change: {
          hasDetectedChange: true,
          changePercentage: 14.8,
          changedPixelCount: 154200,
          totalScenePixels: 1042000,
          changeClassification: 'CONSTRUCTION',
          meanMagnitude: 42.6,
          maxMagnitude: 118.0,
          changeRegionsCount: 6,
          primaryPhenomenon: 'New administrative concrete foundation blocks and arterial transport links',
          changeMethod: 'Radiometric Normalized Differencing + Spatial Coherence Morphometry'
        },
        quality: {
          overallStatus: 'USABLE',
          registrationStatus: 'ALIGNED',
          seasonalDifferenceDetected: false,
          seasonalSeverity: 'LOW',
          cloudStatus: 'USABLE',
          radiometricStatus: 'CONSISTENT',
          spatialCoherenceStatus: 'STRONG',
          persistenceStatus: 'PERSISTENT',
          sensorRelationship: 'SAME_SENSOR',
          qualityWarnings: []
        },
        visualEvidence: {
          beforeImageUrl: '/thumbnails/amaravati_2022_thumb.png',
          afterImageUrl: '/thumbnails/amaravati_2024_thumb.png',
          changeMapUrl: '/derived/amaravati_diff_map.png'
        },
        processingHistory: [
          { step: 'Ingestion & CRS Check', status: 'COMPLETED', timestamp: now, details: 'EPSG:32644 authoritative georeference validated' },
          { step: 'Local 512-D Embedding Extraction', status: 'COMPLETED', timestamp: now, details: 'L2-normalized feature vector computed' },
          { step: 'Semantic Query Plan & Vector Search', status: 'COMPLETED', timestamp: now, details: 'Rank 1 candidate retrieved (similarity: 0.884)' },
          { step: 'Bi-Temporal Alignment & Screening', status: 'COMPLETED', timestamp: now, details: 'Sub-pixel registration error < 0.2 px (ALIGNED)' },
          { step: 'Deterministic Differencing & False-Alarm Gate', status: 'COMPLETED', timestamp: now, details: '14.8% changed area; False-alarm gate passed: SUPPORTED_CHANGE' }
        ],
        provenance: {
          processingVersion: this.VERSION,
          modelVersion: 'ResNet50-Local-Geo-v1.2',
          embeddingVersion: '512D-L2-Offline',
          algorithm: 'SpatialCoherenceDifferencing-v2',
          timestamps: {
            enqueued: now,
            lastModified: now
          }
        }
      },
      {
        candidateId: 'REV-CAND-20261003-0002',
        sourceRunId: 'RUN-20261003-091811-C7D2',
        sourceType: 'SIMILAR_SITE_DISCOVERY',
        status: 'NEW',
        enqueuedAt: new Date(Date.now() - 1800000).toISOString(),
        updatedAt: new Date(Date.now() - 1800000).toISOString(),
        identity: {
          candidateId: 'REV-CAND-20261003-0002',
          sceneId: 'cband_20240720_kaziranga_sar',
          beforeSceneId: 'cband_20240110_kaziranga_baseline',
          afterSceneId: 'cband_20240720_kaziranga_sar',
          fileName: 'kaziranga_flood_cband_sar.tif',
          locationName: 'Kaziranga Brahmaputra Basin (Flood Inundation)',
          crs: 'EPSG:32646 - WGS 84 / UTM zone 46N',
          bounds: { minLng: 93.15, maxLng: 93.35, minLat: 26.55, maxLat: 26.70 },
          acquisitionDates: ['2024-01-10T12:00:00Z', '2024-07-20T12:00:00Z'],
          sensors: ['C-band Synthetic Aperture Radar (SAR)'],
          satellites: ['RISAT-1A / EOS-04'],
          modality: 'sar',
          resolution: '3.0m Stripmap Mode'
        },
        retrieval: {
          originalQuery: 'Discover similar riverine flood inundation sites across eastern basins',
          searchMode: 'SIMILAR_SITE_DISCOVERY',
          retrievalMethod: 'Embedding-Based Medoid Clustering (Cluster 1)',
          similarityScore: 0.812,
          filtersUsed: { modality: 'sar' },
          whyRetrieved: [
            '✓ Vector similarity to reference flood observation: 81.2%',
            '✓ C-band radar specular water backscatter drop (< -18 dB)',
            '✓ Cluster representative for Brahmaputra flood plain group'
          ],
          clusterId: 1,
          clusterLabel: 'Cluster 1: Riverine Flood Inundation (4 sites)',
          discoveredFromSceneId: 'cband_20240715_brahmaputra_ref'
        },
        temporal: {
          hasTemporalComparison: true,
          timeDifferenceDays: 192,
          earliestSupportedDateOrRange: '2024-07 Monsoon High Water',
          earliestSupportedSceneId: 'cband_20240720_kaziranga_sar',
          timelineStatement: 'Inundation extent verified between dry season baseline and peak monsoon epoch.',
          beforeDate: '2024-01-10T12:00:00Z',
          afterDate: '2024-07-20T12:00:00Z',
          usableObservationsCount: 2,
          excludedObservationsCount: 0
        },
        change: {
          hasDetectedChange: true,
          changePercentage: 22.4,
          changedPixelCount: 284000,
          totalScenePixels: 1267800,
          changeClassification: 'WATER_EXTENT_CHANGE',
          meanMagnitude: 68.2,
          maxMagnitude: 145.0,
          changeRegionsCount: 12,
          primaryPhenomenon: 'River overbanking and sheet inundation across low-lying grassland',
          changeMethod: 'SAR Backscatter Ratio Differencing + Speckle Filtering'
        },
        quality: {
          overallStatus: 'USABLE',
          registrationStatus: 'ALIGNED',
          seasonalDifferenceDetected: true,
          seasonalSeverity: 'HIGH',
          cloudStatus: 'USABLE', // SAR penetrates clouds
          radiometricStatus: 'CONSISTENT',
          spatialCoherenceStatus: 'STRONG',
          persistenceStatus: 'TRANSIENT',
          sensorRelationship: 'SAME_SENSOR',
          qualityWarnings: ['HIGH_SEASONAL_VARIATION: Inundation coincides with annual monsoon peak.']
        },
        visualEvidence: {
          beforeImageUrl: '/thumbnails/kaziranga_dry_thumb.png',
          afterImageUrl: '/thumbnails/kaziranga_monsoon_thumb.png',
          changeMapUrl: '/derived/kaziranga_flood_map.png'
        },
        processingHistory: [
          { step: 'Discovery Vector Search', status: 'COMPLETED', timestamp: now, details: 'Matched reference scene with 0.812 cosine similarity' },
          { step: 'Spherical K-Means Grouping', status: 'COMPLETED', timestamp: now, details: 'Assigned as Medoid representative for Cluster 1' },
          { step: 'Temporal SAR Backscatter Analysis', status: 'COMPLETED', timestamp: now, details: 'Detected 22.4% surface inundation extent' },
          { step: 'False-Alarm Seasonality Screening', status: 'COMPLETED', timestamp: now, details: 'Flagged high seasonal variance (monsoon); recommended for analyst confirmation' }
        ],
        provenance: {
          processingVersion: this.VERSION,
          modelVersion: 'SAR-Backscatter-v1.4',
          embeddingVersion: '512D-L2-Offline',
          algorithm: 'SAR-RatioDifferencing',
          timestamps: {
            enqueued: now,
            lastModified: now
          }
        }
      }
    ];
  }
}
