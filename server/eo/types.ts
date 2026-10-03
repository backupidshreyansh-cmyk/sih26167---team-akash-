/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Domain-specific type definitions for Indian Earth-Observation Data Discovery
 * and provenance-aware data selection (ISRO/NRSC Bhoonidhi, SAC MOSDAC, Bhuvan).
 */

export type EOSourceProvider = 'Bhoonidhi' | 'MOSDAC' | 'Bhuvan' | 'LocalArchive' | 'UserUpload';

export type EOAOI = {
  name?: string;
  bbox?: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat] in WGS84
  lat?: number;
  lng?: number;
};

export type EOAscendingDescending = 'ASCENDING' | 'DESCENDING' | 'UNKNOWN' | 'GEOSTATIONARY';

export interface EOObservation {
  source: EOSourceProvider;
  productId: string;
  satellite: string; // e.g. 'RESOURCESAT-2A', 'CARTOSAT-1', 'SENTINEL-1', 'SENTINEL-2', 'INSAT-3D', 'OCEANSAT-3'
  sensor: string; // e.g. 'LISS-3', 'AWiFS', 'C-SAR', 'MSI', 'IMAGER', 'OCM-3'
  acquisitionTime: string; // ISO-8601
  bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  resolution: string; // e.g. '23.5m', '56m', '10m', '1km'
  productType: string; // e.g. 'Standard Ortho', 'L2B Surface Reflectance', 'GRD Radar Backscatter', 'Sea Surface Temperature'
  access: 'open' | 'restricted' | 'priced';
  downloadAvailable: boolean;
  cloudCoverPercentage?: number;
  orbitDirection?: EOAscendingDescending;
  polarization?: string;
  provenanceHash?: string;
  thumbnailUrl?: string;
  rejectionReason?: string;
  metadata?: Record<string, any>;
}

export interface EOSearchQuery {
  aoi?: EOAOI;
  startDate?: string;
  endDate?: string;
  satellite?: string;
  sensor?: string;
  modality?: 'OPTICAL' | 'SAR' | 'MULTISPECTRAL' | 'METEOROLOGICAL';
  maxCloudCover?: number;
  targetTask?: string;
  minResolutionMeters?: number;
}

export interface EODiscoveryResult {
  query: EOSearchQuery;
  provider: EOSourceProvider | 'All';
  totalFound: number;
  candidates: EOObservation[];
  selected: EOObservation[];
  rejected: { observation: EOObservation; reason: string }[];
  status: 'SUCCESS' | 'NO_CANDIDATES' | 'AUTH_REQUIRED' | 'API_UNAVAILABLE';
  accessNotice: string;
  timestamp: string;
  processingTimeMs: number;
}
