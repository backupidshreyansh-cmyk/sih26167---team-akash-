import { fromArrayBuffer } from 'geotiff';
import sizeOf from 'image-size';
import { Jimp } from 'jimp';
import { processSARImage } from '../utils/sarProcessor.js';
import { cleanBase64, sanitizeImageBuffer } from '../utils/safeImageReader.js';
import { 
  NormalizedImage, 
  InputModality, 
  ImageRole, 
  GeospatialMetadata, 
  StructuredImageryMetadata 
} from './types.js';

/**
 * Extracts dtype string from bits per sample and sample format.
 */
function resolveDataType(bitsPerSample?: number | number[], sampleFormat?: number | number[]): string {
  const bits = Array.isArray(bitsPerSample) ? bitsPerSample[0] : (bitsPerSample || 8);
  const format = Array.isArray(sampleFormat) ? sampleFormat[0] : (sampleFormat || 1);

  if (format === 3) {
    return bits === 64 ? 'float64' : 'float32';
  } else if (format === 2) {
    return bits === 8 ? 'int8' : bits === 16 ? 'int16' : 'int32';
  } else {
    return bits === 16 ? 'uint16' : bits === 32 ? 'uint32' : 'uint8';
  }
}

/**
 * Extracts CRS string or EPSG from geoKeys if present.
 */
function resolveCRS(geoKeys: any): { crs: string | null; epsg: number | null } {
  if (!geoKeys) {
    return { crs: null, epsg: null };
  }

  const projCode = geoKeys.ProjectedCSTypeGeoKey || geoKeys.ProjectionGeoKey;
  const geoCode = geoKeys.GeographicTypeGeoKey;

  if (projCode && projCode !== 32767) {
    return { crs: `EPSG:${projCode}`, epsg: projCode };
  }
  if (geoCode && geoCode !== 32767) {
    return { crs: `EPSG:${geoCode}`, epsg: geoCode };
  }

  return { crs: null, epsg: null };
}

export async function extractMetadata(
  rawBase64Data: string, 
  mimeType: string,
  index: number
): Promise<NormalizedImage> {
  let base64Data = cleanBase64(rawBase64Data);
  let buffer = sanitizeImageBuffer(Buffer.from(base64Data, 'base64'));
  base64Data = buffer.toString('base64');
  
  let width: number | null = null;
  let height: number | null = null;
  let bandCount: number | null = null;
  let dtype: string = 'uint8';
  let nodataValue: number | null = null;
  let sensor = 'UNKNOWN';
  let bandDescriptions: string[] = [];
  let wavelengths: (number | null)[] = [];
  let calibrationStatus: 'CALIBRATED' | 'UNCALIBRATED' | 'UNKNOWN' = 'UNKNOWN';
  let detectedModality: InputModality = 'UNKNOWN';
  let polarization = 'UNKNOWN';
  let hasGeoTIFFTags = false;

  let geospatialMetadata: GeospatialMetadata = {
    crs: null,
    epsg: null,
    geotransform: null,
    bounds: null,
    pixelSize: null,
    metadataTags: {}
  };
  
  let hasGeoMeta = false;

  try {
    // Standard image dimension extraction for consumer formats (PNG, JPEG)
    if (mimeType.includes('png') || mimeType.includes('jpeg') || mimeType.includes('jpg')) {
      try {
        const dimensions = sizeOf(buffer);
        width = dimensions.width || null;
        height = dimensions.height || null;
        bandCount = 3;
        dtype = 'uint8';
      } catch (dimErr) {
        // Fallback for custom or synthetic buffers
        width = 512;
        height = 512;
        bandCount = 3;
      }
    }

    // GeoTIFF extraction
    if (mimeType.includes('tiff') || mimeType.includes('tif') || buffer.slice(0, 4).toString('ascii').startsWith('II*') || buffer.slice(0, 4).toString('ascii').startsWith('MM\0')) {
      try {
        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        const tiff = await fromArrayBuffer(arrayBuffer);
        const image = await tiff.getImage();
        width = image.getWidth();
        height = image.getHeight();
        bandCount = image.getSamplesPerPixel();
        hasGeoTIFFTags = true;

        const fd = image.getFileDirectory() as any;
        dtype = resolveDataType(fd.BitsPerSample, fd.SampleFormat);

        // Nodata extraction (GDAL_NODATA or geotiff getGDALNoData)
        try {
          const rawNoData = (image as any).getGDALNoData ? (image as any).getGDALNoData() : fd.GDAL_NODATA;
          if (rawNoData !== undefined && rawNoData !== null) {
            const parsed = parseFloat(rawNoData);
            if (!isNaN(parsed)) nodataValue = parsed;
          }
        } catch {}

        // Sensor identification from tags (sensor-agnostic)
        if (fd.Software) geospatialMetadata.metadataTags['Software'] = fd.Software;
        if (fd.Model) {
          geospatialMetadata.metadataTags['Model'] = fd.Model;
          sensor = String(fd.Model);
        } else if (fd.Make) {
          geospatialMetadata.metadataTags['Make'] = fd.Make;
          sensor = String(fd.Make);
        }

        // Band descriptions extraction
        if (fd.PageName) {
          bandDescriptions = [String(fd.PageName)];
        } else if (fd.GDAL_METADATA) {
          geospatialMetadata.metadataTags['GDAL_METADATA'] = fd.GDAL_METADATA;
        }

        // Description parsing (e.g. for polarization or calibration indicators)
        if (fd.ImageDescription) {
          geospatialMetadata.metadataTags['ImageDescription'] = fd.ImageDescription;
          const desc = fd.ImageDescription.toUpperCase();
          if (desc.includes('VV') && desc.includes('VH')) {
            polarization = 'VV/VH';
          } else if (desc.includes('VV')) {
            polarization = 'VV';
          } else if (desc.includes('VH')) {
            polarization = 'VH';
          } else if (desc.includes('HH')) {
            polarization = 'HH';
          } else if (desc.includes('HV')) {
            polarization = 'HV';
          }

          if (desc.includes('CALIBRATED') || desc.includes('SIGMA0') || desc.includes('GAMMA0') || desc.includes('BETA0')) {
            calibrationStatus = 'CALIBRATED';
          } else if (desc.includes('RAW') || desc.includes('UNRESOLVED') || desc.includes('DN')) {
            calibrationStatus = 'UNCALIBRATED';
          }

          if (desc.includes('SAR') || desc.includes('RADAR') || polarization !== 'UNKNOWN') {
            detectedModality = 'SAR';
          } else if (desc.includes('OPTICAL') || desc.includes('MSI') || desc.includes('RGB')) {
            detectedModality = bandCount && bandCount > 3 ? 'MULTISPECTRAL' : 'OPTICAL';
          }
        }

        // CRS resolution from GeoKeys
        const geoKeys = image.getGeoKeys();
        if (geoKeys) {
          const resolved = resolveCRS(geoKeys);
          if (resolved.crs || resolved.epsg) {
            hasGeoMeta = true;
            geospatialMetadata.crs = resolved.crs;
            geospatialMetadata.epsg = resolved.epsg;
          }
        }

        // Affine transform & bounds
        const modelTiepoint = fd.ModelTiepoint;
        const modelPixelScale = fd.ModelPixelScale;
        const modelTransformation = fd.ModelTransformation;

        if (modelTransformation) {
          hasGeoMeta = true;
          geospatialMetadata.geotransform = Array.from(modelTransformation as number[]);
          const m = geospatialMetadata.geotransform;
          const minX = m[3];
          const maxY = m[7];
          const maxX = minX + (width * (m[0] || 1));
          const minY = maxY + (height * (m[5] || -1));
          geospatialMetadata.bounds = [minX, Math.min(minY, maxY), maxX, Math.max(minY, maxY)];
          geospatialMetadata.pixelSize = [Math.abs(m[0] || 1), Math.abs(m[5] || 1)];
        } else if (modelTiepoint && modelPixelScale) {
          hasGeoMeta = true;
          geospatialMetadata.pixelSize = [modelPixelScale[0], modelPixelScale[1]];
          geospatialMetadata.geotransform = [
            modelTiepoint[3], // origin X
            modelPixelScale[0], // pixel width
            0, 
            modelTiepoint[4], // origin Y
            0,
            -modelPixelScale[1] // pixel height (negative)
          ];
          
          const minX = modelTiepoint[3];
          const maxY = modelTiepoint[4];
          const maxX = minX + (width * modelPixelScale[0]);
          const minY = maxY - (height * modelPixelScale[1]);
          geospatialMetadata.bounds = [minX, minY, maxX, maxY];
        }

        // If SAR or single-band, preprocess raster to PNG visualization for LLM vision pipeline
        if (detectedModality === 'SAR' || (bandCount && bandCount === 1)) {
          try {
            const rasters = await image.readRasters();
            const rasterData = rasters[0] as any;
            const processed = await processSARImage(rasterData, width, height);
            base64Data = processed.base64Data;
            mimeType = processed.mimeType;
            geospatialMetadata.metadataTags['Preprocessing'] = 'SAR_VISUALIZATION_DERIVED_FROM_INPUT';
          } catch (preprocessErr) {
            console.warn("Failed to preprocess TIFF for Gemini. Keeping original.", preprocessErr);
          }
        }
      } catch (geoError) {
        console.warn("Failed to parse GeoTIFF metadata, treating as normal image.", geoError);
        try {
          const dimensions = sizeOf(buffer);
          width = dimensions.width || null;
          height = dimensions.height || null;
        } catch {}
      }
    }
  } catch (e) {
    console.error("Failed to extract image metadata", e);
  }

  // Modality auto-detection if still UNKNOWN
  if (detectedModality === 'UNKNOWN') {
    if (polarization !== 'UNKNOWN' || mimeType.includes('sar')) {
      detectedModality = 'SAR';
    } else if (hasGeoTIFFTags) {
      if (bandCount && bandCount > 3) {
        detectedModality = 'MULTISPECTRAL';
      } else {
        detectedModality = 'OPTICAL';
      }
    } else {
      detectedModality = 'UNKNOWN';
    }
  }

  geospatialMetadata.metadataTags['polarization'] = polarization;
  geospatialMetadata.metadataTags['sensor'] = sensor;

  // Build the complete StructuredImageryMetadata object
  const structuredMetadata: StructuredImageryMetadata = {
    width,
    height,
    bands: bandCount,
    dtype,
    crs: hasGeoMeta ? geospatialMetadata.crs : null,
    epsg: hasGeoMeta ? geospatialMetadata.epsg : null,
    transform: hasGeoMeta ? geospatialMetadata.geotransform : null,
    bounds: hasGeoMeta && geospatialMetadata.bounds ? [
      geospatialMetadata.bounds[0],
      geospatialMetadata.bounds[1],
      geospatialMetadata.bounds[2],
      geospatialMetadata.bounds[3]
    ] : null,
    resolution: hasGeoMeta ? geospatialMetadata.pixelSize : null,
    bandDescriptions,
    wavelengths,
    nodata: nodataValue,
    sensor,
    modality: detectedModality,
    hasGeoTIFFTags,
    calibrationStatus
  };

  geospatialMetadata.structured = structuredMetadata;

  return {
    id: `img_${Date.now()}_${index}`,
    filename: `upload_${index}`,
    mimeType,
    sizeBytes: buffer.length,
    width,
    height,
    bandCount,
    modality: detectedModality,
    polarization,
    temporalRole: index === 0 ? 'PRIMARY' : 'AFTER',
    acquisitionTime: null,
    geospatialMetadata: hasGeoMeta ? geospatialMetadata : null,
    sourceBase64: base64Data,
    structuredMetadata
  };
}
