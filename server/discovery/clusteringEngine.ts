/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Embedding-Based Clustering Engine (Phase 6).
 * Implements deterministic Spherical K-Means / Medoid clustering on 512-D
 * L2-normalized embedding vectors for unsupervised candidate grouping.
 */

export interface ClusterGroup<T> {
  clusterId: number;
  clusterLabel: string;
  size: number;
  centroid: number[]; // 512-D
  representativeItem: T;
  representativeIndex: number;
  items: Array<{
    item: T;
    distanceToCentroid: number;
    similarityToCentroid: number;
  }>;
}

export class ClusteringEngine {
  /**
   * Clusters embedding items into k distinct semantic groups using Spherical K-Means.
   * Deterministic initialization ensures reproducible clustering.
   */
  public static cluster<T>(
    items: T[],
    getVector: (item: T) => number[],
    k: number = 3,
    maxIterations: number = 20
  ): ClusterGroup<T>[] {
    if (!items || items.length === 0) {
      return [];
    }

    const n = items.length;
    const effectiveK = Math.min(k, n);

    if (effectiveK <= 1) {
      const vec0 = getVector(items[0]);
      return [{
        clusterId: 1,
        clusterLabel: 'Primary Cluster',
        size: n,
        centroid: vec0,
        representativeItem: items[0],
        representativeIndex: 0,
        items: items.map(item => ({
          item,
          distanceToCentroid: 0,
          similarityToCentroid: 1.0
        }))
      }];
    }

    const dimension = getVector(items[0]).length;
    const vectors = items.map(item => getVector(item));

    // 1. Deterministic Centroid Initialization (K-Means++ style seeded deterministically)
    const centroids: number[][] = [];
    centroids.push([...vectors[0]]);

    while (centroids.length < effectiveK) {
      let maxDist = -1;
      let bestIdx = 0;

      for (let i = 0; i < n; i++) {
        let minDistToCentroids = Infinity;
        for (const c of centroids) {
          const dist = 1.0 - this.dotProduct(vectors[i], c);
          if (dist < minDistToCentroids) {
            minDistToCentroids = dist;
          }
        }
        if (minDistToCentroids > maxDist) {
          maxDist = minDistToCentroids;
          bestIdx = i;
        }
      }
      centroids.push([...vectors[bestIdx]]);
    }

    // 2. Iterative Spherical K-Means Assignments
    let assignments = new Int32Array(n).fill(-1);

    for (let iter = 0; iter < maxIterations; iter++) {
      let changed = false;

      // Assignment step
      for (let i = 0; i < n; i++) {
        let maxSim = -Infinity;
        let bestCluster = 0;

        for (let c = 0; c < effectiveK; c++) {
          const sim = this.dotProduct(vectors[i], centroids[c]);
          if (sim > maxSim) {
            maxSim = sim;
            bestCluster = c;
          }
        }

        if (assignments[i] !== bestCluster) {
          assignments[i] = bestCluster;
          changed = true;
        }
      }

      if (!changed && iter > 0) break;

      // Update centroids (Spherical normalization)
      for (let c = 0; c < effectiveK; c++) {
        const sumVec = new Float64Array(dimension);
        let count = 0;

        for (let i = 0; i < n; i++) {
          if (assignments[i] === c) {
            count++;
            const v = vectors[i];
            for (let d = 0; d < dimension; d++) {
              sumVec[d] += v[d];
            }
          }
        }

        if (count > 0) {
          // L2 Normalize centroid to stay on unit hypersphere
          let norm = 0;
          for (let d = 0; d < dimension; d++) {
            norm += sumVec[d] * sumVec[d];
          }
          norm = Math.sqrt(norm) || 1.0;
          for (let d = 0; d < dimension; d++) {
            centroids[c][d] = sumVec[d] / norm;
          }
        }
      }
    }

    // 3. Assemble Cluster Groups & Select Medoid Representatives
    const groups: ClusterGroup<T>[] = [];

    for (let c = 0; c < effectiveK; c++) {
      const clusterMembers: Array<{ item: T; idx: number; sim: number; dist: number }> = [];

      for (let i = 0; i < n; i++) {
        if (assignments[i] === c) {
          const sim = this.dotProduct(vectors[i], centroids[c]);
          const dist = Math.max(0, 1.0 - sim);
          clusterMembers.push({
            item: items[i],
            idx: i,
            sim,
            dist
          });
        }
      }

      if (clusterMembers.length === 0) continue;

      // Medoid is member with highest similarity to centroid
      clusterMembers.sort((a, b) => b.sim - a.sim);
      const representative = clusterMembers[0];

      groups.push({
        clusterId: c + 1,
        clusterLabel: `Cluster ${c + 1} (${clusterMembers.length} sites)`,
        size: clusterMembers.length,
        centroid: centroids[c],
        representativeItem: representative.item,
        representativeIndex: representative.idx,
        items: clusterMembers.map(m => ({
          item: m.item,
          distanceToCentroid: Number(m.dist.toFixed(4)),
          similarityToCentroid: Number(m.sim.toFixed(4))
        }))
      });
    }

    // Sort clusters descending by size
    return groups.sort((a, b) => b.size - a.size);
  }

  private static dotProduct(v1: number[], v2: number[]): number {
    let dot = 0;
    const len = Math.min(v1.length, v2.length);
    for (let i = 0; i < len; i++) {
      dot += v1[i] * v2[i];
    }
    return dot;
  }
}
