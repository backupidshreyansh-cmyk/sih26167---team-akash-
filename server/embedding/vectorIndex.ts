/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Local Vector Index (Phase 2).
 * 100% offline, local vector index with cosine similarity search and incremental indexing.
 * Links: VECTOR -> SCENE ID -> CATALOG RECORD -> ORIGINAL RASTER.
 */

import fs from 'fs';
import path from 'path';
import { ArchiveConfig } from '../archive/archiveConfig.js';
import { LOCAL_EMBEDDING_MODEL_SPEC } from './modelSpec.js';

export interface VectorIndexEntry {
  sceneId: string;
  fileHash: string;
  vector: number[]; // 512-D L2-normalized float array
  addedAt: string;
  dimension: number;
}

export interface VectorSearchResult {
  sceneId: string;
  similarity: number; // -1.0 to 1.0 (exact cosine similarity)
}

export interface VectorIndexMetadata {
  version: string;
  modelName: string;
  dimension: number;
  totalVectors: number;
  lastUpdated: string;
  entries: Record<string, VectorIndexEntry>; // Keyed by sceneId
}

export class LocalVectorIndex {
  private static cachedIndex: VectorIndexMetadata | null = null;
  private static isLoaded = false;
  private static readonly DIMENSION = LOCAL_EMBEDDING_MODEL_SPEC.dimension;

  /**
   * Loads or initializes the vector index from disk.
   */
  public static async loadIndex(): Promise<VectorIndexMetadata> {
    if (this.isLoaded && this.cachedIndex) {
      return this.cachedIndex;
    }

    await ArchiveConfig.ensureDirectories();
    const dirs = ArchiveConfig.getDirectories();
    const indexPath = path.join(dirs.indexesDir, 'vector_index.json');

    if (fs.existsSync(indexPath)) {
      try {
        const raw = await fs.promises.readFile(indexPath, 'utf-8');
        const parsed = JSON.parse(raw);
        this.cachedIndex = parsed;
        this.isLoaded = true;
        return parsed;
      } catch (err) {
        console.warn('Failed to parse vector_index.json; initializing fresh index:', err);
      }
    }

    const initial: VectorIndexMetadata = {
      version: '1.0.0-phase2-vector-index',
      modelName: LOCAL_EMBEDDING_MODEL_SPEC.modelName,
      dimension: this.DIMENSION,
      totalVectors: 0,
      lastUpdated: new Date().toISOString(),
      entries: {}
    };

    await this.saveIndex(initial);
    this.cachedIndex = initial;
    this.isLoaded = true;
    return initial;
  }

  /**
   * Atomically saves the vector index to disk.
   */
  public static async saveIndex(index: VectorIndexMetadata): Promise<void> {
    await ArchiveConfig.ensureDirectories();
    const dirs = ArchiveConfig.getDirectories();
    const indexPath = path.join(dirs.indexesDir, 'vector_index.json');
    const tempPath = `${indexPath}.tmp_${Date.now()}`;

    index.lastUpdated = new Date().toISOString();
    index.totalVectors = Object.keys(index.entries).length;

    await fs.promises.writeFile(tempPath, JSON.stringify(index, null, 2), 'utf-8');
    await fs.promises.rename(tempPath, indexPath);

    this.cachedIndex = index;
    this.isLoaded = true;
  }

  /**
   * Incremental Index Addition (Phase 2 Core Requirement).
   * Adds ONLY the new vector without recomputing any existing vectors!
   */
  public static async add(sceneId: string, vector: number[], fileHash: string): Promise<void> {
    if (vector.length !== this.DIMENSION) {
      throw new Error(`Vector dimension mismatch: expected ${this.DIMENSION}, received ${vector.length}`);
    }

    const index = await this.loadIndex();

    index.entries[sceneId] = {
      sceneId,
      fileHash,
      vector,
      addedAt: new Date().toISOString(),
      dimension: vector.length
    };

    await this.saveIndex(index);
  }

  /**
   * Checks if an embedding for sceneId already exists in the vector index.
   */
  public static async contains(sceneId: string): Promise<boolean> {
    const index = await this.loadIndex();
    return Boolean(index.entries[sceneId]);
  }

  /**
   * Retrieves the raw vector for a scene.
   */
  public static async getVector(sceneId: string): Promise<number[] | null> {
    const index = await this.loadIndex();
    return index.entries[sceneId]?.vector || null;
  }

  /**
   * Fast Vector Search: Computes exact cosine similarity across candidate vectors.
   * If candidateSceneIds is provided, only searches within pre-filtered candidates (pre-filtering).
   */
  public static async search(
    queryVector: number[],
    topK: number = 10,
    candidateSceneIds?: Set<string>
  ): Promise<VectorSearchResult[]> {
    if (!queryVector || queryVector.length !== this.DIMENSION) {
      return [];
    }

    const index = await this.loadIndex();
    const allEntries = Object.values(index.entries);

    if (allEntries.length === 0) {
      return [];
    }

    const results: VectorSearchResult[] = [];

    for (const entry of allEntries) {
      // Pre-filter check if candidate IDs were specified
      if (candidateSceneIds && !candidateSceneIds.has(entry.sceneId)) {
        continue;
      }

      // Exact Cosine Similarity (dot product of L2-normalized vectors)
      const sim = this.cosineSimilarity(queryVector, entry.vector);
      results.push({
        sceneId: entry.sceneId,
        similarity: Number(sim.toFixed(4))
      });
    }

    // Sort descending by similarity
    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, Math.max(1, topK));
  }

  /**
   * Removes a vector from the index.
   */
  public static async remove(sceneId: string): Promise<boolean> {
    const index = await this.loadIndex();
    if (!index.entries[sceneId]) return false;

    delete index.entries[sceneId];
    await this.saveIndex(index);
    return true;
  }

  /**
   * Calculates index statistics.
   */
  public static async getStats(): Promise<{
    totalVectors: number;
    dimension: number;
    modelName: string;
    lastUpdated: string;
  }> {
    const index = await this.loadIndex();
    return {
      totalVectors: index.totalVectors,
      dimension: index.dimension,
      modelName: index.modelName,
      lastUpdated: index.lastUpdated
    };
  }

  /**
   * Helper: Computes exact cosine similarity.
   */
  private static cosineSimilarity(v1: number[], v2: number[]): number {
    let dot = 0;
    let norm1 = 0;
    let norm2 = 0;
    const len = Math.min(v1.length, v2.length);

    for (let i = 0; i < len; i++) {
      dot += v1[i] * v2[i];
      norm1 += v1[i] * v1[i];
      norm2 += v2[i] * v2[i];
    }

    const denom = Math.sqrt(norm1) * Math.sqrt(norm2);
    if (denom === 0) return 0;
    return dot / denom;
  }

  public static clearCache(): void {
    this.cachedIndex = null;
    this.isLoaded = false;
  }
}
