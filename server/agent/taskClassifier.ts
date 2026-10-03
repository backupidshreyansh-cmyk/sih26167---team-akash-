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
  const q = query.toLowerCase().trim();

  // 1. Similar-Site Discovery (must check before generic search)
  if (
    q.includes('similar to this') ||
    q.includes('find more like this') ||
    q.includes('similar site') ||
    q.includes('similar locations') ||
    q.includes('comparable sites') ||
    q.includes('locations similar') ||
    q.includes('cluster similar') ||
    q.includes('more like this') ||
    q.includes('find similar')
  ) {
    return 'SIMILAR_SITE_DISCOVERY';
  }

  // 2. Semantic Archive Search / Retrieval (search without an image, or explicit archive search request)
  if (
    q.startsWith('find ') ||
    q.startsWith('search ') ||
    q.startsWith('retrieve ') ||
    q.includes('find areas') ||
    q.includes('find scenes') ||
    q.includes('find newly') ||
    q.includes('find locations') ||
    q.includes('search archive') ||
    q.includes('search for scenes') ||
    q.includes('show scenes showing') ||
    q.includes('locate scenes') ||
    q.includes('retrieve imagery') ||
    q.includes('find structures') ||
    q.includes('find vehicles')
  ) {
    return 'SEMANTIC_RETRIEVAL';
  }

  // 3. Metadata & Provenance inspection
  if (
    q.includes('acquisition date') ||
    q.includes('sensor and source') ||
    q.includes('show metadata') ||
    q.includes('inspect metadata') ||
    q.includes('acquisition metadata') ||
    q.includes('what sensor') ||
    q.includes('what satellite') ||
    q.includes('provenance') ||
    q.includes('epsg') ||
    q.includes('crs') ||
    q.includes('resolution') ||
    q.includes('pixel dimension') ||
    q.includes('dimensions and bands')
  ) {
    return 'METADATA_PROVENANCE';
  }

  // 4. False-Alarm Assessment
  if (
    q.includes('seasonal') ||
    q.includes('false alarm') ||
    q.includes('illumination') ||
    q.includes('sun angle') ||
    q.includes('shadow artifact') ||
    q.includes('sensor artifact') ||
    q.includes('misregistration') ||
    q.includes('registration error') ||
    q.includes('cloud shadow') ||
    q.includes('could this be seasonal') ||
    q.includes('could this difference be seasonal') ||
    q.includes('check for seasonal') ||
    q.includes('haze') ||
    q.includes('radiometric')
  ) {
    return 'FALSE_ALARM_ASSESSMENT';
  }

  // 5. Change Verification (did X appear / did X change / verify change)
  if (
    q.includes('did construction appear') ||
    q.includes('did construction occur') ||
    q.includes('did change occur') ||
    q.includes('verify change') ||
    q.includes('confirm change') ||
    q.includes('did building appear') ||
    q.includes('did structure appear') ||
    q.includes('assess possible construction') ||
    q.includes('assess water extent change') ||
    q.includes('did it appear between') ||
    q.includes('did expansion happen')
  ) {
    return 'CHANGE_VERIFICATION';
  }

  // 6. Multi-Temporal Change (what changed / compare observations)
  if (
    q.includes('what changed') ||
    q.includes('difference between') ||
    q.includes('compare observations') ||
    q.includes('before and after') ||
    q.includes('temporal change') ||
    q.includes('review change evidence') ||
    q.includes('what differs') ||
    q.includes('between these observations') ||
    q.includes('between these dates')
  ) {
    return 'MULTITEMPORAL_CHANGE';
  }

  // 7. Analyst Review & Audit
  if (
    q.includes('analyst review') ||
    q.includes('review queue') ||
    q.includes('audit status') ||
    q.includes('mark confirmed') ||
    q.includes('mark rejected')
  ) {
    return 'ANALYST_REVIEW';
  }

  // Check for optical + SAR cross-modal pair
  const isOpticalSar = images.length === 2 && images.some(i => i.modality === 'OPTICAL') && images.some(i => i.modality === 'SAR');
  if (isOpticalSar && (q.includes('sar') || q.includes('optical') || q.includes('radar') || q.includes('cross-modal') || q.includes('complementary') || q.includes('compare'))) {
    return 'OPTICAL_SAR_ANALYSIS';
  }

  // SAR specialized queries
  if (!isOpticalSar && (q.includes('sar ') || q.includes(' sar') || q.includes('radar') || (images.length === 1 && images[0]?.modality === 'SAR'))) {
    return 'SAR_ANALYSIS';
  }

  // Zero-image input handling
  if (images.length === 0) {
    if (hasSessionContext) {
      return 'FOLLOW_UP';
    }
    if (
      q.startsWith('find ') ||
      q.startsWith('search ') ||
      q.startsWith('retrieve ') ||
      q.includes('find areas') ||
      q.includes('find scenes') ||
      q.includes('find newly') ||
      q.includes('search archive') ||
      q.includes('show scenes')
    ) {
      return 'SEMANTIC_RETRIEVAL';
    }
    return 'UNSUPPORTED_QUERY';
  }

  if (hasSessionContext && (q.includes('what did you mean') || q.includes('why') || q.includes('expand on') || q.includes('tell me more') || q.includes('previous'))) {
    return 'FOLLOW_UP';
  }

  // 8. Multi-image observations
  if (images.length === 2) {
    const isBeforeAfter = images.some(i => i.temporalRole === 'BEFORE') && images.some(i => i.temporalRole === 'AFTER');
    const isOpticalSar = images.some(i => i.modality === 'OPTICAL') && images.some(i => i.modality === 'SAR');
    const intent = classifyQueryIntent(query);

    if (intent === 'VISUAL_OBSERVATION') {
      if (q.includes('describe') || q.includes('what is happening') || q.includes('caption') || q.includes('what is visible')) {
        return 'SCENE_DESCRIPTION';
      }
      if (isOpticalSar) {
        return 'OPTICAL_SAR_ANALYSIS';
      }
      return 'SINGLE_IMAGE_VQA';
    }

    if (isOpticalSar && (q.includes('sar') || q.includes('optical') || q.includes('cross-modal') || q.includes('complementary'))) {
      return 'OPTICAL_SAR_ANALYSIS';
    }

    if (isBeforeAfter || q.includes('change') || q.includes('difference') || q.includes('temporal') || q.includes('expand')) {
      return 'BI_TEMPORAL_ANALYSIS';
    }

    if (isOpticalSar) {
      return 'OPTICAL_SAR_ANALYSIS';
    }
    return 'BI_TEMPORAL_ANALYSIS';
  }

  // 9. Single-image SAR observation
  if (images.length === 1 && images[0].modality === 'SAR' && !q.includes('optical')) {
    return 'SAR_ANALYSIS';
  }

  // 10. Counting & Grounding specialized checks
  if (q.includes('count') || q.includes('how many')) {
    return 'COUNTING';
  }

  if (q.includes('where is') || q.includes('locate') || q.includes('ground') || q.includes('bbox')) {
    return 'TEXT_GUIDED_GROUNDING';
  }

  // 11. Earth-observation Scene Interpretation (Default for 1 observation or visual query)
  return 'SCENE_INTERPRETATION';
}
