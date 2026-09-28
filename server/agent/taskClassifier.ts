import { NormalizedImage } from '../imagery/types.js';
import { TaskClassification } from '../schemas/responses.js';

export type QueryIntent = 
  | 'VISUAL_OBSERVATION'
  | 'TEMPORAL_CHANGE'
  | 'CAUSAL_ATTRIBUTION'
  | 'QUANTITATIVE_MEASUREMENT'
  | 'GEO_COORDINATES'
  | 'SPECTRAL_INDEX'
  | 'METADATA'
  | 'FOLLOW_UP'
  | 'GENERAL';

/**
 * Classifies the scientific and logical intent of a user's remote-sensing query.
 * Separates direct visual observations from change detection, causal attribution, and quantitative claims.
 */
export function classifyQueryIntent(query: string): QueryIntent {
  const q = query.toLowerCase().trim();

  // 1. Metadata inspection questions
  if (
    q.includes('metadata') || 
    q.includes('pixel dimension') || 
    q.includes('dimensions and bands') ||
    q.includes('band count') || 
    q.includes('resolution') || 
    q.includes('epsg') || 
    q.includes('crs') || 
    q.includes('raster header') ||
    q.includes('file size')
  ) {
    return 'METADATA';
  }

  // 2. Exact coordinates / geographic geolocation questions
  if (
    q.includes('latitude') || 
    q.includes('longitude') || 
    q.includes('exact coordinates') || 
    q.includes('gps coordinate') || 
    q.includes('lat/long') || 
    q.includes('exact location')
  ) {
    return 'GEO_COORDINATES';
  }

  // 3. Quantitative ground measurement questions
  if (
    q.includes('exact area') || 
    q.includes('square meter') || 
    q.includes('sq meter') || 
    q.includes('square kilometer') || 
    q.includes('sq km') || 
    q.includes('hectare') || 
    q.includes('acre') || 
    q.includes('exact measurement') ||
    q.includes('exact distance') ||
    q.includes('sub-pixel') ||
    q.includes('water depth in meters') ||
    q.includes('salinity percentage')
  ) {
    return 'QUANTITATIVE_MEASUREMENT';
  }

  // 4. Spectral index queries (NDVI, NDWI, EVI)
  if (
    q.includes('ndvi') || 
    q.includes('ndwi') || 
    q.includes('evi') || 
    q.includes('savi') || 
    q.includes('vegetation index') || 
    q.includes('water index')
  ) {
    return 'SPECTRAL_INDEX';
  }

  // 5. Causal attribution & specific land-use claims
  // Questions attributing change to human activity or specific causes (construction, deforestation, flood damage)
  if (
    q.includes('why did') || 
    q.includes('what caused') || 
    q.includes('cause of') || 
    q.includes('caused by') || 
    q.includes('attributed to') || 
    q.includes('attribution') || 
    q.includes('did construction occur') || 
    q.includes('was it construction') || 
    q.includes('deforestation') || 
    q.includes('deforested') || 
    q.includes('flood damage') || 
    q.includes('disaster damage') || 
    q.includes('crop type') || 
    q.includes('specific crop') ||
    q.includes('cleared for agriculture')
  ) {
    return 'CAUSAL_ATTRIBUTION';
  }

  // Check for explicit change keywords
  const hasChangeKeywords = (
    q.includes('change') || 
    q.includes('difference between') || 
    q.includes('expand') || 
    q.includes('increase') || 
    q.includes('decrease') || 
    q.includes('shrink') || 
    q.includes('temporal') || 
    q.includes('before and after') || 
    q.includes('between these observations') || 
    q.includes('between these dates') ||
    q.includes('over time')
  );

  // Check for explicit visual observation queries
  const isExplicitVisualObservation = (
    q.startsWith('what is visible') ||
    q.includes('what is visible') ||
    q.includes('is vegetation present') ||
    q.includes('is water visible') ||
    q.includes('is water present') ||
    q.includes('are buildings visible') ||
    q.startsWith('describe the visible') ||
    q.startsWith('describe what is visible') ||
    q.startsWith('describe visible') ||
    q.includes('visible colors') ||
    q.includes('visible features') ||
    q.includes('colors and patterns') ||
    q.includes('shapes and geometric') ||
    q.includes('textures and light') ||
    q.includes('visible in this image') ||
    q.includes('visible in these images') ||
    q.includes('visible patterns') ||
    q.includes('visible textures') ||
    q.includes('what do you see') ||
    q.includes('what is seen')
  );

  // If asking about visible features, colors, textures, shapes, or vegetation presence:
  // Visual observation takes precedence when not explicitly asking about change over time
  if (isExplicitVisualObservation && !hasChangeKeywords) {
    return 'VISUAL_OBSERVATION';
  }

  // 6. Explicit temporal change queries
  if (hasChangeKeywords) {
    return 'TEMPORAL_CHANGE';
  }

  // 7. General visual observation fallback
  if (
    isExplicitVisualObservation ||
    q.includes('visible') || 
    q.includes('color') || 
    q.includes('pattern') || 
    q.includes('texture') || 
    q.includes('shape') || 
    q.includes('feature') || 
    q.includes('vegetation') || 
    q.includes('appearance') || 
    q.includes('describe') || 
    q.includes('look like')
  ) {
    return 'VISUAL_OBSERVATION';
  }

  return 'GENERAL';
}

export function classifyTask(query: string, images: NormalizedImage[], hasSessionContext = false): TaskClassification {
  const q = query.toLowerCase();
  
  if (images.length === 0) {
      if (hasSessionContext) {
          return 'FOLLOW_UP';
      }
      return 'UNSUPPORTED_QUERY';
  }

  if (hasSessionContext && (q.includes('what did you mean') || q.includes('why') || q.includes('expand on') || q.includes('tell me more') || q.includes('previous'))) {
      return 'FOLLOW_UP';
  }

  const intent = classifyQueryIntent(query);

  if (images.length === 2) {
      const isBeforeAfter = images.some(i => i.temporalRole === 'BEFORE') && images.some(i => i.temporalRole === 'AFTER');
      const isOpticalSar = images.some(i => i.modality === 'OPTICAL') && images.some(i => i.modality === 'SAR');
      
      // If the intent is explicitly VISUAL_OBSERVATION, do NOT force BI_TEMPORAL_ANALYSIS!
      // A visual-observation question on images labeled before/after asks about visible features, not temporal change.
      if (intent === 'VISUAL_OBSERVATION') {
          if (q.includes('describe') || q.includes('what is happening') || q.includes('caption') || q.includes('what is visible')) {
              return 'SCENE_DESCRIPTION';
          }
          if (isOpticalSar) {
              return 'OPTICAL_SAR_ANALYSIS';
          }
          return 'SINGLE_IMAGE_VQA';
      }

      if (isBeforeAfter || q.includes('change') || q.includes('difference') || q.includes('before') || q.includes('after') || q.includes('increase') || q.includes('decrease') || q.includes('temporal')) {
          return 'BI_TEMPORAL_ANALYSIS';
      }
      if (isOpticalSar || q.includes('sar') || q.includes('optical') || q.includes('radar') || q.includes('cross-modal') || q.includes('complementary')) {
          return 'OPTICAL_SAR_ANALYSIS';
      }
      return 'OPTICAL_SAR_ANALYSIS'; 
  }

  if (images.length === 1 && images[0].modality === 'SAR' && !q.includes('optical')) {
      return 'SAR_ANALYSIS';
  }

  if (q.includes('count') || q.includes('how many')) {
      return 'COUNTING';
  }

  if (q.includes('where is') || q.includes('locate') || q.includes('ground') || q.includes('bbox')) {
      return 'TEXT_GUIDED_GROUNDING';
  }

  if (q.includes('describe') || q.includes('what is happening') || q.includes('caption')) {
      return 'SCENE_DESCRIPTION';
  }

  if (q.includes('sar ') || q.includes('radar')) {
      return 'SAR_ANALYSIS';
  }
  
  if (q.includes('optical')) {
      return 'OPTICAL_ANALYSIS';
  }
  
  if (q.match(/\b(not|no|none)\b/)) {
      return 'NEGATIVE_QUERY';
  }

  return 'SINGLE_IMAGE_VQA';
}
