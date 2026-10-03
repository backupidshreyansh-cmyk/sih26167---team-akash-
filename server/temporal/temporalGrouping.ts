/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Temporal Scene Grouping & Observation Collection Engine (Phase 4).
 * Groups satellite observations by true geospatial footprint overlap,
 * chronologically sorts them, and qualifies observations against quality criteria.
 */

import { SceneRecord } from '../archive/types.js';
import { TemporalLocationGroup, TemporalObservationRecord } from './types.js';

export class TemporalGroupingEngine {
  /**
   * Groups archive scenes into distinct geospatial location series based on bounding box overlap.
   */
  public static groupScenesByLocation(scenes: SceneRecord[]): TemporalLocationGroup[] {
    const groups: TemporalLocationGroup[] = [];
    const assignedSceneIds = new Set<string>();

    for (const scene of scenes) {
      if (assignedSceneIds.has(scene.sceneId)) continue;

      // Create new candidate location group
      const currentBounds = scene.bounds;
      const matchedScenes: SceneRecord[] = [scene];
      assignedSceneIds.add(scene.sceneId);

      // Find all other scenes that geometrically overlap with this scene
      for (const other of scenes) {
        if (assignedSceneIds.has(other.sceneId)) continue;

        if (this.haveSpatialOverlap(scene, other)) {
          matchedScenes.push(other);
          assignedSceneIds.add(other.sceneId);
        }
      }

      // Chronological sort: T1 < T2 < ... < Tn
      matchedScenes.sort((a, b) => {
        const timeA = a.acquisitionDate ? new Date(a.acquisitionDate).getTime() : 0;
        const timeB = b.acquisitionDate ? new Date(b.acquisitionDate).getTime() : 0;
        return timeA - timeB;
      });

      // Qualify each observation in the series
      const observations: TemporalObservationRecord[] = matchedScenes.map((s, idx) => {
        const cloudCover = s.quality.cloudCoverPercentage;
        const isCloudy = cloudCover !== null && cloudCover > 50.0;
        const isCorrupt = !s.quality.fileReadable || !s.quality.dimensionsValid;

        let status: TemporalObservationRecord['status'] = idx === 0 ? 'USABLE_BASELINE' : 'POSSIBLE_CHANGE_ONSET';
        let exclusionReason: string | undefined;

        if (isCloudy) {
          status = 'EXCLUDED';
          exclusionReason = `Cloud cover contamination (${cloudCover?.toFixed(1)}% exceeds 50% limit)`;
        } else if (isCorrupt) {
          status = 'EXCLUDED';
          exclusionReason = 'Raster dimensions or file unreadable';
        }

        return {
          sceneId: s.sceneId,
          acquisitionDate: s.acquisitionDate || 'unknown_date',
          sensor: s.sensor,
          satellite: s.satellite,
          modality: s.modality,
          status,
          exclusionReason,
          cloudCoverPct: cloudCover,
          scene: s
        };
      });

      const locationName = scene.bounds?.minLng && scene.bounds?.minLat
        ? `Location [${scene.bounds.minLng.toFixed(2)}°E, ${scene.bounds.minLat.toFixed(2)}°N]`
        : `Location Group (${scene.sensor} Series)`;

      groups.push({
        locationId: `loc_${scene.sceneId.slice(0, 14)}`,
        name: locationName,
        bounds: scene.bounds ? {
          minLng: scene.bounds.minLng,
          minLat: scene.bounds.minLat,
          maxLng: scene.bounds.maxLng,
          maxLat: scene.bounds.maxLat
        } : null,
        spatialCertainty: scene.bounds ? 'VERIFIED_FOOTPRINT_OVERLAP' : 'UNCERTAIN',
        observations
      });
    }

    return groups;
  }

  /**
   * Filters and collects usable observations for a specific time window.
   */
  public static collectObservationsInWindow(
    group: TemporalLocationGroup,
    startDate?: string | null,
    endDate?: string | null
  ): {
    usableObservations: TemporalObservationRecord[];
    excludedObservations: TemporalObservationRecord[];
  } {
    const startTime = startDate ? new Date(startDate).getTime() : 0;
    const endTime = endDate ? new Date(endDate).getTime() : Infinity;

    const usable: TemporalObservationRecord[] = [];
    const excluded: TemporalObservationRecord[] = [];

    for (const obs of group.observations) {
      const obsTime = new Date(obs.acquisitionDate).getTime();
      const inWindow = obsTime >= startTime && obsTime <= endTime;

      if (!inWindow) {
        excluded.push({
          ...obs,
          status: 'EXCLUDED',
          exclusionReason: 'Outside requested temporal window'
        });
        continue;
      }

      if (obs.status === 'EXCLUDED') {
        excluded.push(obs);
      } else {
        usable.push(obs);
      }
    }

    return {
      usableObservations: usable,
      excludedObservations: excluded
    };
  }

  /**
   * Deterministic spatial overlap calculation between two scene bounding boxes.
   */
  private static haveSpatialOverlap(s1: SceneRecord, s2: SceneRecord): boolean {
    // 1. If geographic coordinates exist in WGS84
    if (s1.bounds?.minLng && s1.bounds?.maxLng && s2.bounds?.minLng && s2.bounds?.maxLng) {
      const xOverlap = Math.max(0, Math.min(s1.bounds.maxLng, s2.bounds.maxLng) - Math.max(s1.bounds.minLng, s2.bounds.minLng));
      const yOverlap = Math.max(0, Math.min(s1.bounds.maxLat!, s2.bounds.maxLat!) - Math.max(s1.bounds.minLat!, s2.bounds.minLat!));
      const overlapArea = xOverlap * yOverlap;

      const area1 = (s1.bounds.maxLng - s1.bounds.minLng) * (s1.bounds.maxLat! - s1.bounds.minLat!);
      const area2 = (s2.bounds.maxLng - s2.bounds.minLng) * (s2.bounds.maxLat! - s2.bounds.minLat!);
      const minArea = Math.min(area1, area2);

      // Overlap ratio > 35% constitutes shared geographic sector
      return minArea > 0 && (overlapArea / minArea) >= 0.35;
    }

    // 2. If projected coordinates exist in same EPSG CRS
    if (s1.epsg && s2.epsg && s1.epsg === s2.epsg && s1.bounds && s2.bounds) {
      const xOverlap = Math.max(0, Math.min(s1.bounds.maxX, s2.bounds.maxX) - Math.max(s1.bounds.minX, s2.bounds.minX));
      const yOverlap = Math.max(0, Math.min(s1.bounds.maxY, s2.bounds.maxY) - Math.max(s1.bounds.minY, s2.bounds.minY));
      const overlapArea = xOverlap * yOverlap;

      const area1 = (s1.bounds.maxX - s1.bounds.minX) * (s1.bounds.maxY - s1.bounds.minY);
      const area2 = (s2.bounds.maxX - s2.bounds.minX) * (s2.bounds.maxY - s2.bounds.minY);
      const minArea = Math.min(area1, area2);

      return minArea > 0 && (overlapArea / minArea) >= 0.35;
    }

    // 3. Unreferenced fallback: match if filenames or sensor tags explicitly link them
    const s1Prefix = s1.fileName.replace(/(_before|_after|_t1|_t2|_epoch\d+).*/i, '');
    const s2Prefix = s2.fileName.replace(/(_before|_after|_t1|_t2|_epoch\d+).*/i, '');
    if (s1Prefix && s1Prefix === s2Prefix) {
      return true;
    }

    return false;
  }
}
