/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Similar-Site Discovery & Intelligence Service (Phase 6).
 * Given a reference scene of interest, discovers similar locations across the archive,
 * enforces spatial diversity, clusters related sites, and prepares for temporal verification.
 */

import crypto from 'crypto';
import { CatalogService } from '../archive/catalogService.js';
import { SceneRecord } from '../archive/types.js';
import { LocalVectorIndex } from '../embedding/vectorIndex.js';
import { ClusteringEngine, ClusterGroup } from './clusteringEngine.js';

export interface DiscoveredSiteCandidate {
  sceneId: string;
  fileName: string;
  satellite: string;
  sensor: string;
  modality: string;
  acquisitionDate: string | null;
  resolution: string | null;
  crs: string | null;
  bounds: any;
  thumbnailPath: string | null;
  similarityToReference: number; // Exact cosine similarity to reference vector
  clusterId: number;
  qualityStatus: 'USABLE' | 'DEGRADED' | 'UNUSABLE';
  isClusterRepresentative: boolean;
  temporalSeriesAvailable: boolean;
  scene: SceneRecord;
}

export interface DiscoveredClusterSummary {
  clusterId: number;
  clusterLabel: string;
  siteCount: number;
  representativeSite: DiscoveredSiteCandidate;
  sites: DiscoveredSiteCandidate[];
}

export interface SimilarSiteDiscoveryResponse {
  referenceScene: {
    sceneId: string;
    fileName: string;
    satellite: string;
    sensor: string;
    modality: string;
    acquisitionDate: string | null;
    crs: string | null;
  };
  totalDiscovered: number;
  clustersCount: number;
  clusters: DiscoveredClusterSummary[];
  allCandidates: DiscoveredSiteCandidate[];
  spatialDeduplicationApplied: boolean;
  isCacheHit: boolean;
  processingTimeMs: number;
}

export class SimilarSiteService {
  private static discoveryCache = new Map<string, SimilarSiteDiscoveryResponse>();
  private static analystActions: Array<{
    sceneId: string;
    referenceSceneId: string;
    action: 'CONFIRM' | 'REJECT';
    timestamp: string;
  }> = [];

  /**
   * "FIND MORE LIKE THIS": Discovers similar satellite locations from a reference scene.
   */
  public static async discoverSimilarSites(
    referenceSceneId: string,
    options: {
      topK?: number;
      clusterCount?: number;
      minSimilarity?: number;
      sensorFilter?: string;
      modalityFilter?: string;
    } = {}
  ): Promise<SimilarSiteDiscoveryResponse> {
    const startTime = performance.now();
    const topK = options.topK || 20;
    const requestedK = options.clusterCount || 3;
    const minSim = options.minSimilarity !== undefined ? options.minSimilarity : 0.40;

    // 1. Fetch Reference Scene
    const refScene = await CatalogService.getSceneById(referenceSceneId);
    if (!refScene) {
      throw new Error(`Reference scene '${referenceSceneId}' not found in archive.`);
    }

    // 2. Fetch Reference Vector
    const refVector = await LocalVectorIndex.getVector(referenceSceneId);
    if (!refVector) {
      throw new Error(`Vector embedding for reference scene '${referenceSceneId}' not found in vector index.`);
    }

    // 3. Cache Check
    const cacheKey = crypto.createHash('sha256')
      .update(`${refScene.fileHash}:${topK}:${requestedK}:${minSim}:${options.sensorFilter || ''}:${options.modalityFilter || ''}`)
      .digest('hex');

    if (this.discoveryCache.has(cacheKey)) {
      const cached = this.discoveryCache.get(cacheKey)!;
      return {
        ...cached,
        isCacheHit: true,
        processingTimeMs: Number((performance.now() - startTime).toFixed(2))
      };
    }

    // 4. Local Vector Search
    const searchMatches = await LocalVectorIndex.search(refVector, topK * 3);

    // 5. Exclude Reference Scene Itself & Duplicate File Hashes
    const allScenes = await CatalogService.getAllScenes();
    const sceneLookup = new Map(allScenes.map(s => [s.sceneId, s]));

    const seenHashes = new Set<string>();
    seenHashes.add(refScene.fileHash);

    const filteredMatches = searchMatches.filter(m => {
      if (m.sceneId === referenceSceneId) return false; // Self-exclusion
      const scene = sceneLookup.get(m.sceneId);
      if (!scene) return false;
      if (seenHashes.has(scene.fileHash)) return false; // Duplicate file suppression
      seenHashes.add(scene.fileHash);

      // Filters
      if (options.sensorFilter && !scene.sensor.toLowerCase().includes(options.sensorFilter.toLowerCase())) {
        return false;
      }
      if (options.modalityFilter && options.modalityFilter !== 'all' && scene.modality !== options.modalityFilter) {
        return false;
      }

      // Convert similarity to [0, 1] range
      const normSim = (m.similarity + 1.0) / 2.0;
      return normSim >= minSim;
    });

    // 6. Spatial Diversity: Suppress near-identical spatial tiles (overlap > 70%)
    const spatiallyDeduplicated = this.applySpatialDeduplication(filteredMatches, sceneLookup);

    // 7. Cluster Similar Candidates using Spherical K-Means
    const candidatesWithVectors: Array<{ scene: SceneRecord; vector: number[]; similarity: number }> = [];

    for (const m of spatiallyDeduplicated.slice(0, topK)) {
      const scene = sceneLookup.get(m.sceneId);
      const vec = await LocalVectorIndex.getVector(m.sceneId);
      if (scene && vec) {
        const normSim = (m.similarity + 1.0) / 2.0;
        candidatesWithVectors.push({
          scene,
          vector: vec,
          similarity: Number(normSim.toFixed(4))
        });
      }
    }

    if (candidatesWithVectors.length === 0) {
      return {
        referenceScene: {
          sceneId: refScene.sceneId,
          fileName: refScene.fileName,
          satellite: refScene.satellite,
          sensor: refScene.sensor,
          modality: refScene.modality,
          acquisitionDate: refScene.acquisitionDate,
          crs: refScene.crs
        },
        totalDiscovered: 0,
        clustersCount: 0,
        clusters: [],
        allCandidates: [],
        spatialDeduplicationApplied: true,
        isCacheHit: false,
        processingTimeMs: Number((performance.now() - startTime).toFixed(2))
      };
    }

    const clusters = ClusteringEngine.cluster(
      candidatesWithVectors,
      item => item.vector,
      Math.min(requestedK, Math.max(1, Math.floor(candidatesWithVectors.length / 2)))
    );

    // 8. Construct Discovered Site Candidates and Cluster Summaries
    const clusterSummaries: DiscoveredClusterSummary[] = [];
    const allCandidates: DiscoveredSiteCandidate[] = [];

    for (const group of clusters) {
      const clusterCandidates: DiscoveredSiteCandidate[] = [];

      for (const member of group.items) {
        const { scene, similarity } = member.item;
        const isRep = scene.sceneId === group.representativeItem.scene.sceneId;

        const candidate: DiscoveredSiteCandidate = {
          sceneId: scene.sceneId,
          fileName: scene.fileName,
          satellite: scene.satellite,
          sensor: scene.sensor,
          modality: scene.modality,
          acquisitionDate: scene.acquisitionDate,
          resolution: scene.resolution?.formatted || null,
          crs: scene.crs,
          bounds: scene.bounds,
          thumbnailPath: scene.thumbnailPath,
          similarityToReference: similarity,
          clusterId: group.clusterId,
          qualityStatus: scene.quality?.metadataCompletenessScore >= 75 ? 'USABLE' : 'DEGRADED',
          isClusterRepresentative: isRep,
          temporalSeriesAvailable: true,
          scene
        };

        clusterCandidates.push(candidate);
        allCandidates.push(candidate);
      }

      clusterCandidates.sort((a, b) => b.similarityToReference - a.similarityToReference);

      const rep = clusterCandidates.find(c => c.isClusterRepresentative) || clusterCandidates[0];

      clusterSummaries.push({
        clusterId: group.clusterId,
        clusterLabel: group.clusterLabel,
        siteCount: clusterCandidates.length,
        representativeSite: rep,
        sites: clusterCandidates
      });
    }

    const response: SimilarSiteDiscoveryResponse = {
      referenceScene: {
        sceneId: refScene.sceneId,
        fileName: refScene.fileName,
        satellite: refScene.satellite,
        sensor: refScene.sensor,
        modality: refScene.modality,
        acquisitionDate: refScene.acquisitionDate,
        crs: refScene.crs
      },
      totalDiscovered: allCandidates.length,
      clustersCount: clusterSummaries.length,
      clusters: clusterSummaries,
      allCandidates,
      spatialDeduplicationApplied: true,
      isCacheHit: false,
      processingTimeMs: Number((performance.now() - startTime).toFixed(2))
    };

    this.discoveryCache.set(cacheKey, response);
    return response;
  }

  /**
   * Spatial Deduplication: Suppresses nearly identical geographic tiles (>70% overlap).
   */
  private static applySpatialDeduplication(
    matches: Array<{ sceneId: string; similarity: number }>,
    sceneLookup: Map<string, SceneRecord>
  ): Array<{ sceneId: string; similarity: number }> {
    const retained: Array<{ sceneId: string; similarity: number }> = [];

    for (const match of matches) {
      const scene = sceneLookup.get(match.sceneId);
      if (!scene) continue;

      let isOverlappingWithRetained = false;
      for (const r of retained) {
        const retainedScene = sceneLookup.get(r.sceneId);
        if (retainedScene && this.computeSpatialIoU(scene, retainedScene) > 0.70) {
          isOverlappingWithRetained = true;
          break;
        }
      }

      if (!isOverlappingWithRetained) {
        retained.push(match);
      }
    }

    return retained;
  }

  private static computeSpatialIoU(s1: SceneRecord, s2: SceneRecord): number {
    if (!s1.bounds?.minLng || !s1.bounds?.maxLng || !s2.bounds?.minLng || !s2.bounds?.maxLng) {
      return 0;
    }
    const xOverlap = Math.max(0, Math.min(s1.bounds.maxLng, s2.bounds.maxLng) - Math.max(s1.bounds.minLng, s2.bounds.minLng));
    const yOverlap = Math.max(0, Math.min(s1.bounds.maxLat!, s2.bounds.maxLat!) - Math.max(s1.bounds.minLat!, s2.bounds.minLat!));
    const interArea = xOverlap * yOverlap;

    const area1 = (s1.bounds.maxLng - s1.bounds.minLng) * (s1.bounds.maxLat! - s1.bounds.minLat!);
    const area2 = (s2.bounds.maxLng - s2.bounds.minLng) * (s2.bounds.maxLat! - s2.bounds.minLat!);
    const unionArea = area1 + area2 - interArea;

    return unionArea > 0 ? interArea / unionArea : 0;
  }

  /**
   * Records analyst confirmation or rejection for discovery audit.
   */
  public static recordAnalystFeedback(
    sceneId: string,
    referenceSceneId: string,
    action: 'CONFIRM' | 'REJECT'
  ): void {
    this.analystActions.unshift({
      sceneId,
      referenceSceneId,
      action,
      timestamp: new Date().toISOString()
    });
  }

  public static getFeedback(): typeof SimilarSiteService.analystActions {
    return [...this.analystActions];
  }
}
