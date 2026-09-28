import { DeterministicImageMetrics } from './deterministicEngine.js';
import { NormalizedImage } from '../imagery/types.js';

export interface ImageAnalysisContext {
  id: string;
  filename: string;
  mimeType: string;
  width: number;
  height: number;
  bandCount: number;
  modality: string;
  polarization?: string;
  geospatialMetadata: any;
  deterministicMetrics: DeterministicImageMetrics;
  cachedObservations: string[];
  cachedInterpretations: string[];
  toolOutputs: Record<string, any>;
  lastQuery?: string;
  createdAt: number;
  lastAccessedAt: number;
}

class ContextCacheManager {
  private cache = new Map<string, ImageAnalysisContext>();
  private readonly MAX_ENTRIES = 50;

  private generateKey(image: NormalizedImage): string {
    // Key by image id if unique, or hash of first 100 bytes + size + dimensions
    if (image.id && image.id.length > 0) {
      return `${image.id}_${image.sizeBytes}_${image.width || 0}x${image.height || 0}`;
    }
    const snippet = (image.sourceBase64 || '').slice(0, 100);
    return `${image.sizeBytes}_${image.width}_${image.height}_${snippet}`;
  }

  public get(image: NormalizedImage): ImageAnalysisContext | undefined {
    const key = this.generateKey(image);
    const entry = this.cache.get(key);
    if (entry) {
      entry.lastAccessedAt = Date.now();
      return entry;
    }
    return undefined;
  }

  public set(image: NormalizedImage, metrics: DeterministicImageMetrics, observations: string[] = [], interpretations: string[] = []): ImageAnalysisContext {
    const key = this.generateKey(image);
    
    // Evict oldest if full
    if (this.cache.size >= this.MAX_ENTRIES) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      for (const [k, v] of this.cache.entries()) {
        if (v.lastAccessedAt < oldestTime) {
          oldestTime = v.lastAccessedAt;
          oldestKey = k;
        }
      }
      if (oldestKey) this.cache.delete(oldestKey);
    }

    const context: ImageAnalysisContext = {
      id: image.id,
      filename: image.filename,
      mimeType: image.mimeType,
      width: metrics.width,
      height: metrics.height,
      bandCount: metrics.bandCount,
      modality: image.modality,
      polarization: image.polarization,
      geospatialMetadata: image.geospatialMetadata,
      deterministicMetrics: metrics,
      cachedObservations: observations,
      cachedInterpretations: interpretations,
      toolOutputs: {},
      createdAt: Date.now(),
      lastAccessedAt: Date.now()
    };

    this.cache.set(key, context);
    return context;
  }

  public updateObservations(image: NormalizedImage, observations: string[], interpretations: string[], lastQuery?: string) {
    const key = this.generateKey(image);
    const entry = this.cache.get(key);
    if (entry) {
      // Deduplicate new observations
      const obsSet = new Set([...entry.cachedObservations, ...observations]);
      const intSet = new Set([...entry.cachedInterpretations, ...interpretations]);
      entry.cachedObservations = Array.from(obsSet);
      entry.cachedInterpretations = Array.from(intSet);
      if (lastQuery) entry.lastQuery = lastQuery;
      entry.lastAccessedAt = Date.now();
    }
  }

  public clear() {
    this.cache.clear();
  }

  public size(): number {
    return this.cache.size;
  }
}

export const globalContextCache = new ContextCacheManager();
