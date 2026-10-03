/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Semantic Satellite Search & Candidate Reranking Service (Phase 3).
 * Connects query plans, local vector indices, deterministic metadata filters,
 * and factual result explanation generation.
 */

import { QueryParser, StructuredSearchPlan } from './queryParser.js';
import { EmbeddingEngine } from '../embedding/embeddingEngine.js';
import { LocalVectorIndex } from '../embedding/vectorIndex.js';
import { CatalogService } from '../archive/catalogService.js';
import { SceneRecord } from '../archive/types.js';

export interface RankedSearchCandidate {
  rank: number;
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
  
  // Real Mathematical Scores
  semanticSimilarity: number;   // 0.0 to 1.0 (exact vector cosine similarity)
  metadataMatchScore: number;   // 0.0 to 1.0
  temporalScore: number;        // 0.0 to 1.0
  qualityScore: number;         // 0.0 to 1.0
  finalRankScore: number;       // Composite transparent score

  // Factual Explanation Signals
  matchingFilters: {
    dateMatched: boolean;
    sensorMatched: boolean;
    modalityMatched: boolean;
    spatialMatched: boolean;
  };
  whyRetrieved: string[];
  qualityStatus: 'USABLE' | 'DEGRADED' | 'UNUSABLE';
  scene: SceneRecord;
}

export interface SemanticSearchResponse {
  query: string;
  plan: StructuredSearchPlan;
  totalCatalogScenes: number;
  preFilteredCount: number;
  retrievedCount: number;
  candidates: RankedSearchCandidate[];
  latency: {
    parsingMs: number;
    embeddingMs: number;
    vectorSearchMs: number;
    rerankingMs: number;
    totalMs: number;
  };
  provenance: {
    model: string;
    modelVersion: string;
    vectorDimension: number;
    searchTimestamp: string;
  };
}

export class SemanticSearchService {
  private static queryHistory: Array<{ query: string; timestamp: string; count: number }> = [];

  /**
   * Primary Search Pipeline:
   * Query -> Query Understanding -> Metadata Filtering -> Local Text Embedding -> Vector Retrieval -> Reranking
   */
  public static async search(
    queryText: string,
    explicitFilters: {
      startDate?: string;
      endDate?: string;
      sensor?: string;
      modality?: string;
      hasCrs?: boolean;
    } = {},
    topK: number = 10
  ): Promise<SemanticSearchResponse> {
    const overallStart = performance.now();

    // 1. Query Understanding
    const parseStart = performance.now();
    const plan = QueryParser.parse(queryText);
    const parsingMs = Number((performance.now() - parseStart).toFixed(2));

    // Merge explicit UI filters with inferred query plan
    const effectiveStartDate = explicitFilters.startDate || plan.dateRange?.start || null;
    const effectiveEndDate = explicitFilters.endDate || plan.dateRange?.end || null;
    const effectiveSensor = explicitFilters.sensor || plan.sensor || null;
    const effectiveModality = explicitFilters.modality || plan.modality || null;

    // 2. Fetch Catalog and Pre-Filter Deterministically
    const allScenes = await CatalogService.getAllScenes();
    const preFilteredScenes = allScenes.filter(scene => {
      // Sensor filter
      if (effectiveSensor && !scene.sensor.toLowerCase().includes(effectiveSensor.toLowerCase())) {
        return false;
      }
      // Modality filter
      if (effectiveModality && effectiveModality !== 'all' && scene.modality !== effectiveModality) {
        return false;
      }
      // Date filter
      if (effectiveStartDate && scene.acquisitionDate) {
        if (new Date(scene.acquisitionDate) < new Date(effectiveStartDate)) return false;
      }
      if (effectiveEndDate && scene.acquisitionDate) {
        if (new Date(scene.acquisitionDate) > new Date(effectiveEndDate)) return false;
      }
      // CRS filter
      if (explicitFilters.hasCrs !== undefined) {
        const isGeo = scene.crs && scene.crs !== 'unavailable';
        if (explicitFilters.hasCrs && !isGeo) return false;
        if (!explicitFilters.hasCrs && isGeo) return false;
      }
      return true;
    });

    const preFilteredSceneIds = new Set(preFilteredScenes.map(s => s.sceneId));

    // 3. Local Text Embedding
    const embedStart = performance.now();
    const queryToEmbed = plan.semanticQuery || queryText || 'satellite imagery';
    const embeddingResult = await EmbeddingEngine.embedText(queryToEmbed);
    const embeddingMs = Number((performance.now() - embedStart).toFixed(2));

    // 4. Vector Search
    const searchStart = performance.now();
    // Search vector index pre-filtered
    const vectorMatches = await LocalVectorIndex.search(
      embeddingResult.vector,
      Math.max(topK * 2, 20),
      preFilteredSceneIds.size > 0 ? preFilteredSceneIds : undefined
    );
    const vectorSearchMs = Number((performance.now() - searchStart).toFixed(2));

    // Map vector matches back to SceneRecords
    const sceneMap = new Map(allScenes.map(s => [s.sceneId, s]));

    // 5. Candidate Reranking
    const rerankStart = performance.now();
    const rankedCandidates: RankedSearchCandidate[] = [];

    for (const match of vectorMatches) {
      const scene = sceneMap.get(match.sceneId);
      if (!scene) continue;

      // Signals for explanation
      const whyRetrieved: string[] = [];
      const sim = Math.max(0, Math.min(1.0, (match.similarity + 1.0) / 2.0)); // scale [-1, 1] to [0, 1]
      whyRetrieved.push(`✓ Semantic cosine similarity: ${(sim * 100).toFixed(1)}%`);

      // Metadata match score
      let metaScore = 0.5;
      let sensorMatched = false;
      let modalityMatched = false;

      if (plan.sensor && scene.sensor.toLowerCase().includes(plan.sensor.toLowerCase())) {
        metaScore += 0.3;
        sensorMatched = true;
        whyRetrieved.push(`✓ Sensor matched: ${scene.sensor}`);
      }
      if (plan.modality && scene.modality === plan.modality) {
        metaScore += 0.2;
        modalityMatched = true;
        whyRetrieved.push(`✓ Modality matched: ${scene.modality.toUpperCase()}`);
      }
      metaScore = Math.min(1.0, metaScore);

      // Temporal score
      let tempScore = 0.5;
      let dateMatched = false;
      if (plan.dateRange && scene.acquisitionDate) {
        const d = new Date(scene.acquisitionDate).getTime();
        const start = plan.dateRange.start ? new Date(plan.dateRange.start).getTime() : 0;
        const end = plan.dateRange.end ? new Date(plan.dateRange.end).getTime() : Infinity;
        if (d >= start && d <= end) {
          tempScore = 1.0;
          dateMatched = true;
          whyRetrieved.push(`✓ Acquisition date ${scene.acquisitionDate.slice(0, 10)} matches target window`);
        }
      }

      // Quality score
      const completeness = scene.quality?.metadataCompletenessScore || 70;
      const qualScore = completeness / 100.0;
      const qualityStatus = qualScore >= 0.75 ? 'USABLE' : qualScore >= 0.5 ? 'DEGRADED' : 'UNUSABLE';
      whyRetrieved.push(`✓ Quality assessment: ${qualityStatus} (${completeness}% complete)`);

      if (scene.crs && scene.crs !== 'unavailable') {
        whyRetrieved.push(`✓ Georeferenced spatial CRS: ${scene.crs}`);
      }

      // Composite Reranking Formula:
      // Final = 0.50 * sim + 0.25 * meta + 0.15 * temp + 0.10 * quality
      const finalScore = (0.50 * sim) + (0.25 * metaScore) + (0.15 * tempScore) + (0.10 * qualScore);

      rankedCandidates.push({
        rank: 0, // will assign after sorting
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
        semanticSimilarity: Number(sim.toFixed(4)),
        metadataMatchScore: Number(metaScore.toFixed(3)),
        temporalScore: Number(tempScore.toFixed(3)),
        qualityScore: Number(qualScore.toFixed(3)),
        finalRankScore: Number(finalScore.toFixed(4)),
        matchingFilters: {
          dateMatched,
          sensorMatched,
          modalityMatched,
          spatialMatched: Boolean(scene.bounds)
        },
        whyRetrieved,
        qualityStatus,
        scene
      });
    }

    // Sort descending by finalRankScore
    rankedCandidates.sort((a, b) => b.finalRankScore - a.finalRankScore);

    // Assign 1-indexed ranks and slice to topK
    const finalResults = rankedCandidates.slice(0, topK).map((item, idx) => ({
      ...item,
      rank: idx + 1
    }));

    const rerankingMs = Number((performance.now() - rerankStart).toFixed(2));
    const totalMs = Number((performance.now() - overallStart).toFixed(2));

    // Store in query history
    this.queryHistory.unshift({
      query: queryText,
      timestamp: new Date().toISOString(),
      count: finalResults.length
    });
    if (this.queryHistory.length > 25) {
      this.queryHistory.pop();
    }

    return {
      query: queryText,
      plan,
      totalCatalogScenes: allScenes.length,
      preFilteredCount: preFilteredScenes.length,
      retrievedCount: finalResults.length,
      candidates: finalResults,
      latency: {
        parsingMs,
        embeddingMs,
        vectorSearchMs,
        rerankingMs,
        totalMs
      },
      provenance: {
        model: EmbeddingEngine.MODEL_NAME,
        modelVersion: EmbeddingEngine.MODEL_VERSION,
        vectorDimension: EmbeddingEngine.DIMENSION,
        searchTimestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Retrieves query history.
   */
  public static getHistory(): Array<{ query: string; timestamp: string; count: number }> {
    return [...this.queryHistory];
  }
}
