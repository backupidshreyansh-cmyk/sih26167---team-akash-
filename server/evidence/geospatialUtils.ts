/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Deterministic Geospatial Utilities for coordinate transforms and area computations.
 * Adheres strictly to the rule: "Do NOT fabricate geographic coordinates or areas."
 */

export interface GeoCoordinate {
  easting: number;
  northing: number;
  crs: string;
  latLng?: {
    latitude: number;
    longitude: number;
  };
}

export interface AreaCalculationResult {
  status: 'CALCULATED' | 'AREA_UNAVAILABLE';
  areaM2?: number;
  areaHectares?: number;
  areaKm2?: number;
  reason?: string;
}

export class GeospatialUtils {
  /**
   * Converts pixel coordinate (x, y) to projected ground coordinates (X, Y)
   * using authoritative GDAL-standard 6-element geotransform:
   * X = GT[0] + x * GT[1] + y * GT[2]
   * Y = GT[3] + x * GT[4] + y * GT[5]
   */
  public static pixelToGeo(
    x: number,
    y: number,
    geotransform: number[] | null | undefined,
    epsg: number | null | undefined,
    crsName: string | null | undefined
  ): GeoCoordinate | null {
    if (!geotransform || geotransform.length < 6) {
      return null;
    }

    const easting = geotransform[0] + x * geotransform[1] + y * geotransform[2];
    const northing = geotransform[3] + x * geotransform[4] + y * geotransform[5];
    const crs = crsName || (epsg ? `EPSG:${epsg}` : 'PROJECTED_UNKNOWN');

    let latLng: { latitude: number; longitude: number } | undefined = undefined;

    // Direct WGS84 Geographic CRS (EPSG:4326)
    if (epsg === 4326 || (crsName && crsName.includes('4326'))) {
      // In EPSG:4326, easting is lon (degrees) and northing is lat (degrees)
      latLng = {
        latitude: Number(northing.toFixed(6)),
        longitude: Number(easting.toFixed(6))
      };
    } else if (epsg && (epsg >= 32601 && epsg <= 32660)) {
      // UTM Zone North (WGS 84 / UTM Zone 1N to 60N)
      const zone = epsg - 32600;
      latLng = this.utmToLatLng(easting, northing, zone, true);
    } else if (epsg && (epsg >= 32701 && epsg <= 32760)) {
      // UTM Zone South (WGS 84 / UTM Zone 1S to 60S)
      const zone = epsg - 32700;
      latLng = this.utmToLatLng(easting, northing, zone, false);
    } else if (epsg === 3857) {
      // Web Mercator
      latLng = this.webMercatorToLatLng(easting, northing);
    }

    return {
      easting: Number(easting.toFixed(2)),
      northing: Number(northing.toFixed(2)),
      crs,
      latLng
    };
  }

  /**
   * Converts projected coordinates back to pixel coordinates (x, y)
   */
  public static geoToPixel(
    X: number,
    Y: number,
    geotransform: number[] | null | undefined
  ): { x: number; y: number } | null {
    if (!geotransform || geotransform.length < 6) return null;

    const [gt0, gt1, gt2, gt3, gt4, gt5] = geotransform;
    const det = gt1 * gt5 - gt2 * gt4;
    if (Math.abs(det) < 1e-12) return null; // non-invertible

    const x = (gt5 * (X - gt0) - gt2 * (Y - gt3)) / det;
    const y = (-gt4 * (X - gt0) + gt1 * (Y - gt3)) / det;

    return {
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2))
    };
  }

  /**
   * Calculates deterministic area from pixel count and pixel scale.
   * If geospatial information is missing or units are in degrees without local projection,
   * returns AREA_UNAVAILABLE. Never fabricates area from screen pixels.
   */
  public static calculateGeospatialArea(
    pixelCount: number,
    pixelSize: [number, number] | null | undefined,
    epsg: number | null | undefined,
    geotransform: number[] | null | undefined
  ): AreaCalculationResult {
    if (pixelCount <= 0) {
      return { status: 'AREA_UNAVAILABLE', reason: 'Pixel count must be positive.' };
    }

    let resX = pixelSize ? Math.abs(pixelSize[0]) : null;
    let resY = pixelSize ? Math.abs(pixelSize[1]) : null;

    if ((!resX || !resY) && geotransform && geotransform.length >= 6) {
      resX = Math.abs(geotransform[1]);
      resY = Math.abs(geotransform[5]);
    }

    if (!resX || !resY) {
      return {
        status: 'AREA_UNAVAILABLE',
        reason: 'Pixel ground resolution (m/pixel) is not present in raster metadata.'
      };
    }

    // Check if CRS is EPSG:4326 (degrees, not meters)
    if (epsg === 4326 || (resX < 0.01 && resY < 0.01)) {
      // In degree space without a projected UTM/metric CRS, direct pixel multiplication is invalid.
      // Need projected metric units or explicit UTM zone.
      return {
        status: 'AREA_UNAVAILABLE',
        reason: 'Raster coordinates are in unprojected angular degrees (EPSG:4326). Metric area calculation requires a projected metric CRS.'
      };
    }

    // Standard metric calculation (e.g. Sentinel-2: 10m x 10m = 100 m^2 per pixel)
    const pixelAreaM2 = resX * resY;
    const areaM2 = pixelCount * pixelAreaM2;
    const areaHectares = areaM2 / 10000;
    const areaKm2 = areaM2 / 1000000;

    return {
      status: 'CALCULATED',
      areaM2: Number(areaM2.toFixed(1)),
      areaHectares: Number(areaHectares.toFixed(3)),
      areaKm2: Number(areaKm2.toFixed(4))
    };
  }

  /**
   * Computes spatial overlap and intersection between two 2D bounding boxes in normalized [0-1] coordinates.
   */
  public static computeBoxIntersection(
    boxA: { ymin: number; xmin: number; ymax: number; xmax: number },
    boxB: { ymin: number; xmin: number; ymax: number; xmax: number }
  ): {
    intersectionArea: number;
    unionArea: number;
    iou: number;
    overlapPctA: number;
    overlapPctB: number;
    intersectionBox: { ymin: number; xmin: number; ymax: number; xmax: number } | null;
  } {
    const interYmin = Math.max(boxA.ymin, boxB.ymin);
    const interXmin = Math.max(boxA.xmin, boxB.xmin);
    const interYmax = Math.min(boxA.ymax, boxB.ymax);
    const interXmax = Math.min(boxA.xmax, boxB.xmax);

    if (interYmin >= interYmax || interXmin >= interXmax) {
      const areaA = (boxA.ymax - boxA.ymin) * (boxA.xmax - boxA.xmin);
      const areaB = (boxB.ymax - boxB.ymin) * (boxB.xmax - boxB.xmin);
      return {
        intersectionArea: 0,
        unionArea: areaA + areaB,
        iou: 0,
        overlapPctA: 0,
        overlapPctB: 0,
        intersectionBox: null
      };
    }

    const interArea = (interYmax - interYmin) * (interXmax - interXmin);
    const areaA = (boxA.ymax - boxA.ymin) * (boxA.xmax - boxA.xmin);
    const areaB = (boxB.ymax - boxB.ymin) * (boxB.xmax - boxB.xmin);
    const unionArea = Math.max(1e-9, areaA + areaB - interArea);

    const iou = interArea / unionArea;
    const overlapPctA = areaA > 0 ? (interArea / areaA) * 100 : 0;
    const overlapPctB = areaB > 0 ? (interArea / areaB) * 100 : 0;

    return {
      intersectionArea: Number(interArea.toFixed(6)),
      unionArea: Number(unionArea.toFixed(6)),
      iou: Number(iou.toFixed(4)),
      overlapPctA: Number(overlapPctA.toFixed(1)),
      overlapPctB: Number(overlapPctB.toFixed(1)),
      intersectionBox: {
        ymin: Number(interYmin.toFixed(4)),
        xmin: Number(interXmin.toFixed(4)),
        ymax: Number(interYmax.toFixed(4)),
        xmax: Number(interXmax.toFixed(4))
      }
    };
  }

  // --- Internal Coordinate Transformation Math (WGS84 Ellipsoid) ---

  private static utmToLatLng(
    easting: number,
    northing: number,
    zone: number,
    isNorth: boolean
  ): { latitude: number; longitude: number } {
    const a = 6378137.0; // WGS84 semi-major axis
    const f = 1 / 298.257223563;
    const b = a * (1 - f);
    const e = Math.sqrt((a * a - b * b) / (a * a));
    const ePrime = Math.sqrt((a * a - b * b) / (b * b));
    const k0 = 0.9996;

    const x = easting - 500000.0;
    const y = isNorth ? northing : northing - 10000000.0;

    const M = y / k0;
    const mu = M / (a * (1 - (e * e) / 4 - (3 * e * e * e * e) / 64 - (5 * e * e * e * e * e * e) / 256));

    const e1 = (1 - Math.sqrt(1 - e * e)) / (1 + Math.sqrt(1 - e * e));
    const J1 = (3 * e1) / 2 - (27 * e1 * e1 * e1) / 32;
    const J2 = (21 * e1 * e1) / 16 - (55 * e1 * e1 * e1 * e1) / 32;
    const J3 = (151 * e1 * e1 * e1) / 96;

    const fp = mu + J1 * Math.sin(2 * mu) + J2 * Math.sin(4 * mu) + J3 * Math.sin(6 * mu);

    const C1 = ePrime * ePrime * Math.cos(fp) * Math.cos(fp);
    const T1 = Math.tan(fp) * Math.tan(fp);
    const R1 = (a * (1 - e * e)) / Math.pow(1 - e * e * Math.sin(fp) * Math.sin(fp), 1.5);
    const N1 = a / Math.sqrt(1 - e * e * Math.sin(fp) * Math.sin(fp));
    const D = x / (N1 * k0);

    const lat = fp - ((N1 * Math.tan(fp)) / R1) * (
      (D * D) / 2 -
      ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ePrime * ePrime) * Math.pow(D, 4)) / 24 +
      ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ePrime * ePrime - 3 * C1 * C1) * Math.pow(D, 6)) / 720
    );

    const lon = (
      D -
      ((1 + 2 * T1 + C1) * Math.pow(D, 3)) / 6 +
      ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ePrime * ePrime + 24 * T1 * T1) * Math.pow(D, 5)) / 120
    ) / Math.cos(fp);

    const centralLon = ((zone - 1) * 6 - 180 + 3) * (Math.PI / 180);

    return {
      latitude: Number(((lat * 180) / Math.PI).toFixed(6)),
      longitude: Number((((centralLon + lon) * 180) / Math.PI).toFixed(6))
    };
  }

  private static webMercatorToLatLng(
    x: number,
    y: number
  ): { latitude: number; longitude: number } {
    const lon = (x / 20037508.34) * 180;
    let lat = (y / 20037508.34) * 180;
    lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);

    return {
      latitude: Number(lat.toFixed(6)),
      longitude: Number(lon.toFixed(6))
    };
  }
}
