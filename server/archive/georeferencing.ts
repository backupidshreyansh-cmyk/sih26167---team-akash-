/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Geospatial Georeferencing & Coordinate Conversion Engine (Phase 1).
 * Strictly preserves georeferencing tags and calculates real spatial coordinates
 * only when source raster tags exist.
 */

import { GeoreferenceBounds } from './types.js';

export class GeoreferencingEngine {
  /**
   * Converts raster pixel coordinates (X, Y) to projected CRS coordinates (East, North)
   * using a standard 6-parameter GDAL/GeoTIFF affine transform:
   * [xOrigin, pixelWidth, xRotation, yOrigin, yRotation, pixelHeight]
   *
   * X_proj = transform[0] + pixelX * transform[1] + pixelY * transform[2]
   * Y_proj = transform[3] + pixelX * transform[4] + pixelY * transform[5]
   */
  public static pixelToProjected(
    pixelX: number,
    pixelY: number,
    transform: number[] | null
  ): { x: number; y: number } | null {
    if (!transform || transform.length < 6) {
      return null;
    }
    const x = transform[0] + pixelX * transform[1] + pixelY * transform[2];
    const y = transform[3] + pixelX * transform[4] + pixelY * transform[5];
    return { x, y };
  }

  /**
   * Converts projected coordinates to geographic WGS84 (longitude, latitude)
   * Supports standard geographic WGS84 (EPSG:4326), Web Mercator (EPSG:3857),
   * and UTM Northern Hemisphere zones (EPSG:32601 to 32660).
   * Returns null if projection conversion cannot be verified mathematically.
   */
  public static projectedToWGS84(
    projX: number,
    projY: number,
    epsg: number | null
  ): { lng: number; lat: number } | null {
    if (!epsg) return null;

    // 1. Native WGS84 (EPSG:4326)
    if (epsg === 4326) {
      // GeoTIFF typically stores [x=lng, y=lat]
      return { lng: projX, lat: projY };
    }

    // 2. Web Mercator (EPSG:3857 / EPSG:900913)
    if (epsg === 3857 || epsg === 900913) {
      const R = 6378137.0;
      const lng = (projX / R) * (180.0 / Math.PI);
      const lat = (Math.atan(Math.exp(projY / R)) * 2 - Math.PI / 2) * (180.0 / Math.PI);
      return {
        lng: Number(lng.toFixed(6)),
        lat: Number(lat.toFixed(6))
      };
    }

    // 3. Universal Transverse Mercator (UTM) Northern Hemisphere (EPSG:32601 - 32660)
    // Covers Indian subcontinent (Zones 42N, 43N, 44N, 45N, 46N)
    if (epsg >= 32601 && epsg <= 32660) {
      const zone = epsg - 32600;
      return this.utmToLatLon(projX, projY, zone, false);
    }

    // 4. UTM Southern Hemisphere (EPSG:32701 - 32760)
    if (epsg >= 32701 && epsg <= 32760) {
      const zone = epsg - 32700;
      return this.utmToLatLon(projX, projY, zone, true);
    }

    // Projection conversion not verified for this EPSG; do not invent coordinates
    return null;
  }

  /**
   * Converts pixel coordinate to WGS84 lat/lng if transform and CRS are available.
   */
  public static pixelToWGS84(
    pixelX: number,
    pixelY: number,
    transform: number[] | null,
    epsg: number | null
  ): { lng: number; lat: number } | null {
    const projected = this.pixelToProjected(pixelX, pixelY, transform);
    if (!projected) return null;
    return this.projectedToWGS84(projected.x, projected.y, epsg);
  }

  /**
   * Computes spatial bounding box from raster dimensions, affine transform, and EPSG.
   */
  public static computeBounds(
    width: number,
    height: number,
    transform: number[] | null,
    epsg: number | null
  ): GeoreferenceBounds | null {
    if (!transform || transform.length < 6 || width <= 0 || height <= 0) {
      return null;
    }

    // 4 Corners of raster
    const c1 = this.pixelToProjected(0, 0, transform);
    const c2 = this.pixelToProjected(width, 0, transform);
    const c3 = this.pixelToProjected(width, height, transform);
    const c4 = this.pixelToProjected(0, height, transform);

    if (!c1 || !c2 || !c3 || !c4) return null;

    const xs = [c1.x, c2.x, c3.x, c4.x];
    const ys = [c1.y, c2.y, c3.y, c4.y];

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const bounds: GeoreferenceBounds = {
      minX,
      minY,
      maxX,
      maxY
    };

    // Calculate WGS84 geographic bounding coordinates if projection is known
    const w1 = this.projectedToWGS84(minX, minY, epsg);
    const w2 = this.projectedToWGS84(maxX, maxY, epsg);

    if (w1 && w2) {
      bounds.minLng = Math.min(w1.lng, w2.lng);
      bounds.maxLng = Math.max(w1.lng, w2.lng);
      bounds.minLat = Math.min(w1.lat, w2.lat);
      bounds.maxLat = Math.max(w1.lat, w2.lat);
    }

    return bounds;
  }

  /**
   * Deterministic Standard UTM to Latitude/Longitude conversion (WGS84 Ellipsoid).
   */
  private static utmToLatLon(
    easting: number,
    northing: number,
    zone: number,
    southHemi: boolean
  ): { lng: number; lat: number } | null {
    const a = 6378137.0; // WGS84 semi-major axis
    const f = 1 / 298.257223563; // flattening
    const e = Math.sqrt(2 * f - f * f); // eccentricity
    const ePrimeSq = (e * e) / (1 - e * e);
    const k0 = 0.9996;

    const x = easting - 500000.0; // remove false easting
    let y = northing;
    if (southHemi) {
      y -= 10000000.0; // remove false northing
    }

    const M = y / k0;
    const mu = M / (a * (1 - (e * e) / 4 - (3 * e * e * e * e) / 64 - (5 * e * e * e * e * e * e) / 256));

    const e1 = (1 - Math.sqrt(1 - e * e)) / (1 + Math.sqrt(1 - e * e));

    const J1 = (3 * e1) / 2 - (27 * e1 * e1 * e1) / 32;
    const J2 = (21 * e1 * e1) / 16 - (55 * e1 * e1 * e1 * e1) / 32;
    const J3 = (151 * e1 * e1 * e1) / 96;
    const J4 = (1097 * e1 * e1 * e1 * e1) / 512;

    const fp = mu + J1 * Math.sin(2 * mu) + J2 * Math.sin(4 * mu) + J3 * Math.sin(6 * mu) + J4 * Math.sin(8 * mu);

    const C1 = ePrimeSq * Math.cos(fp) * Math.cos(fp);
    const T1 = Math.tan(fp) * Math.tan(fp);
    const R1 = (a * (1 - e * e)) / Math.pow(1 - e * e * Math.sin(fp) * Math.sin(fp), 1.5);
    const N1 = a / Math.sqrt(1 - e * e * Math.sin(fp) * Math.sin(fp));

    const D = x / (N1 * k0);

    // Latitude calculation
    const fact1 = (N1 * Math.tan(fp)) / R1;
    const fact2 = (D * D) / 2;
    const fact3 = ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ePrimeSq) * Math.pow(D, 4)) / 24;
    const fact4 = ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ePrimeSq - 3 * C1 * C1) * Math.pow(D, 6)) / 720;

    let lat = fp - fact1 * (fact2 - fact3 + fact4);
    lat = (lat * 180.0) / Math.PI;

    // Longitude calculation
    const lfact1 = D;
    const lfact2 = ((1 + 2 * T1 + C1) * Math.pow(D, 3)) / 6;
    const lfact3 = ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ePrimeSq + 24 * T1 * T1) * Math.pow(D, 5)) / 120;

    let deltaLng = (lfact1 - lfact2 + lfact3) / Math.cos(fp);
    deltaLng = (deltaLng * 180.0) / Math.PI;

    const lambda0 = (zone - 1) * 6 - 180 + 3; // central meridian
    const lng = lambda0 + deltaLng;

    return {
      lng: Number(lng.toFixed(6)),
      lat: Number(lat.toFixed(6))
    };
  }
}
