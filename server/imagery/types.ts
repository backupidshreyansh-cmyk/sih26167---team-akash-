export type InputModality = 'OPTICAL' | 'SAR' | 'MULTISPECTRAL' | 'UNKNOWN';
export type ImageRole = 'PRIMARY' | 'BEFORE' | 'AFTER' | 'REFERENCE';

export interface StructuredImageryMetadata {
  width: number | null;
  height: number | null;
  bands: number | null;
  dtype: string; // e.g. 'uint8', 'uint16', 'float32', 'UNKNOWN'
  crs: string | null; // e.g. 'EPSG:32643', 'WGS 84 / UTM zone 43N', or null
  epsg: number | null;
  transform: number[] | null; // [originX, pixelWidth, 0, originY, 0, -pixelHeight]
  bounds: [number, number, number, number] | null; // [minX, minY, maxX, maxY]
  resolution: [number, number] | null; // [resX, resY] in ground units
  bandDescriptions: string[]; // Band names or descriptions if metadata provided
  wavelengths: (number | null)[]; // Wavelength in nm if available
  nodata: number | null;
  sensor: string; // Sensor or satellite model if provided, or 'UNKNOWN'
  modality: InputModality;
  hasGeoTIFFTags: boolean;
  calibrationStatus: 'CALIBRATED' | 'UNCALIBRATED' | 'UNKNOWN';
}

export interface GeospatialMetadata {
  crs: string | null;
  epsg: number | null;
  geotransform: number[] | null;
  bounds: number[] | null; // [minX, minY, maxX, maxY]
  pixelSize: [number, number] | null;
  metadataTags: Record<string, any>;
  structured?: StructuredImageryMetadata;
}

export interface NormalizedImage {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  bandCount: number | null;
  modality: InputModality;
  polarization?: string;
  temporalRole: ImageRole;
  acquisitionTime: Date | null;
  geospatialMetadata: GeospatialMetadata | null;
  sourceBase64: string; // The raw data
  structuredMetadata?: StructuredImageryMetadata;
}
