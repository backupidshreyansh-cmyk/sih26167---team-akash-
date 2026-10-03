/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Local Embedding Cache (Phase 2).
 * Fast O(1) in-memory and on-disk caching using deterministic hash keys:
 * hash(fileHash + ':' + modelVersion + ':' + preprocessorVersion)
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { ArchiveConfig } from '../archive/archiveConfig.js';

export interface CachedEmbeddingRecord {
  cacheKey: string;
  targetId: string; // sceneId or normalized query
  targetType: 'IMAGE' | 'TEXT';
  vector: number[]; // 512-D
  dimension: number;
  modelVersion: string;
  preprocessorVersion: string;
  createdAt: string;
}

export class EmbeddingCache {
  private static memoryCache = new Map<string, CachedEmbeddingRecord>();

  /**
   * Generates a deterministic cache key.
   */
  public static generateKey(
    identifier: string, // fileHash for images, or normalized text for queries
    modelVersion: string,
    preprocessorVersion: string
  ): string {
    const raw = `${identifier.trim()}:${modelVersion.trim()}:${preprocessorVersion.trim()}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Retrieves an embedding from cache (Memory first, then Disk).
   */
  public static async get(cacheKey: string): Promise<CachedEmbeddingRecord | null> {
    // 1. Check in-memory
    if (this.memoryCache.has(cacheKey)) {
      return this.memoryCache.get(cacheKey)!;
    }

    // 2. Check disk
    const dirs = ArchiveConfig.getDirectories();
    const diskPath = path.join(dirs.embeddingsDir, `${cacheKey}.json`);

    if (fs.existsSync(diskPath)) {
      try {
        const raw = await fs.promises.readFile(diskPath, 'utf-8');
        const parsed: CachedEmbeddingRecord = JSON.parse(raw);
        this.memoryCache.set(cacheKey, parsed);
        return parsed;
      } catch (err) {
        console.warn(`Failed to read cached embedding ${cacheKey}:`, err);
      }
    }

    return null;
  }

  /**
   * Stores an embedding in both in-memory cache and on disk.
   */
  public static async set(record: CachedEmbeddingRecord): Promise<void> {
    this.memoryCache.set(record.cacheKey, record);

    const dirs = await ArchiveConfig.ensureDirectories();
    const diskPath = path.join(dirs.embeddingsDir, `${record.cacheKey}.json`);

    try {
      await fs.promises.writeFile(diskPath, JSON.stringify(record, null, 2), 'utf-8');
    } catch (err) {
      console.warn(`Failed writing embedding to disk for ${record.cacheKey}:`, err);
    }
  }

  /**
   * Clears in-memory cache (for testing).
   */
  public static clearMemoryCache(): void {
    this.memoryCache.clear();
  }
}
