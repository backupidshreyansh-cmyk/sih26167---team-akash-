/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Query Understanding & Semantic Search Plan Engine (Phase 3).
 * Transforms free-form natural language queries into structured search plans
 * without ever inventing dates or sensors not present in the user prompt.
 */

export type SearchIntent = 
  | 'GENERAL_SEMANTIC'
  | 'OBJECT_SCENE_SEARCH'
  | 'RELATIONAL_SEARCH'
  | 'TEMPORAL_CHANGE_DISCOVERY'
  | 'SENSOR_CONSTRAINED_SEARCH'
  | 'MULTIMODAL_SEARCH'
  | 'IMAGE_SIMILARITY_SEARCH';

export interface StructuredSearchPlan {
  rawQuery: string;
  intent: SearchIntent;
  semanticQuery: string; // Cleaned core semantic terms for vector embedding
  objects: string[];
  actions: string[];
  environment: string[];
  spatialRelation: {
    relation: string; // e.g. "near", "along", "within"
    feature: string;  // e.g. "river", "coast", "lake"
  } | null;
  dateRange: {
    start: string | null; // ISO-8601 YYYY-MM-DD
    end: string | null;
  } | null;
  sensor: string | null;     // e.g. "MSI", "C-SAR", "LISS-3"
  satellite: string | null;  // e.g. "SENTINEL-2", "SENTINEL-1", "RESOURCESAT-2A"
  modality: 'optical' | 'sar' | 'multispectral' | null;
  aoiHint: string | null;
  operations: Array<
    | 'METADATA_FILTER'
    | 'TEXT_EMBEDDING'
    | 'VECTOR_SEARCH'
    | 'CANDIDATE_RERANKING'
    | 'TEMPORAL_OBSERVATION_COLLECTION'
    | 'TEMPORAL_CHANGE_DETECTION'
    | 'EARLIEST_CHANGE_VERIFICATION'
    | 'QUALITY_FILTERING'
  >;
  parsedAt: string;
}

export class QueryParser {
  /**
   * Parses natural-language user query into an explicit, deterministic search plan.
   */
  public static parse(rawQuery: string): StructuredSearchPlan {
    const qLower = (rawQuery || '').trim().toLowerCase();
    const now = new Date().toISOString();

    if (!qLower) {
      return {
        rawQuery: '',
        intent: 'GENERAL_SEMANTIC',
        semanticQuery: '',
        objects: [],
        actions: [],
        environment: [],
        spatialRelation: null,
        dateRange: null,
        sensor: null,
        satellite: null,
        modality: null,
        aoiHint: null,
        operations: ['METADATA_FILTER', 'TEXT_EMBEDDING', 'VECTOR_SEARCH'],
        parsedAt: now
      };
    }

    // 1. Date Range Extraction (e.g. "between 2023 and 2025", "from 2021 to 2024", "in 2024")
    const dateRange = this.extractDateRange(qLower);

    // 2. Sensor & Satellite Extraction
    const { sensor, satellite, modality } = this.extractSensorAndSatellite(qLower);

    // 3. Spatial Relation Extraction (e.g. "near river", "along coast", "around port")
    const spatialRelation = this.extractSpatialRelation(qLower);

    // 4. Object & Action Concepts
    const objects = this.extractObjects(qLower);
    const actions = this.extractActions(qLower);
    const environment = this.extractEnvironment(qLower);

    // 5. Determine Intent & Operation Pipeline
    const hasTemporalIntent = Boolean(
      dateRange || 
      actions.some(a => ['new construction', 'expansion', 'change', 'deforestation', 'inundation', 'clearing'].includes(a)) ||
      /change|expand|growth|newly|before|after|earliest|over time|transition/i.test(qLower)
    );

    const hasSarIntent = modality === 'sar' || /sar|radar|microwave|backscatter/i.test(qLower);
    const isMultimodalIntent = /multimodal|optical.*sar|sar.*optical|cross-modal|both optical and sar/i.test(qLower);

    let intent: SearchIntent = 'GENERAL_SEMANTIC';
    const operations: StructuredSearchPlan['operations'] = [
      'METADATA_FILTER',
      'TEXT_EMBEDDING',
      'VECTOR_SEARCH',
      'CANDIDATE_RERANKING',
      'QUALITY_FILTERING'
    ];

    if (isMultimodalIntent) {
      intent = 'MULTIMODAL_SEARCH';
    } else if (hasTemporalIntent) {
      intent = 'TEMPORAL_CHANGE_DISCOVERY';
      operations.push(
        'TEMPORAL_OBSERVATION_COLLECTION',
        'TEMPORAL_CHANGE_DETECTION',
        'EARLIEST_CHANGE_VERIFICATION'
      );
    } else if (hasSarIntent || sensor || satellite) {
      intent = 'SENSOR_CONSTRAINED_SEARCH';
    } else if (spatialRelation) {
      intent = 'RELATIONAL_SEARCH';
    } else if (objects.length > 0) {
      intent = 'OBJECT_SCENE_SEARCH';
    }

    // 6. Clean Semantic Query (for vector model without stopwords)
    const semanticQuery = this.buildCoreSemanticQuery(qLower, objects, actions, environment);

    // 7. AOI Geographic Named Location Hint
    const aoiHint = this.extractAoiHint(qLower);

    return {
      rawQuery,
      intent,
      semanticQuery,
      objects,
      actions,
      environment,
      spatialRelation,
      dateRange,
      sensor,
      satellite,
      modality,
      aoiHint,
      operations,
      parsedAt: now
    };
  }

  private static extractDateRange(query: string): { start: string | null; end: string | null } | null {
    // "between 2023 and 2025" or "between 2022-01 and 2024-12"
    const betweenMatch = query.match(/between\s+(\d{4})(?:-\d{2})?\s+and\s+(\d{4})(?:-\d{2})?/);
    if (betweenMatch) {
      return {
        start: `${betweenMatch[1]}-01-01`,
        end: `${betweenMatch[2]}-12-31`
      };
    }

    // "from 2021 to 2024"
    const fromToMatch = query.match(/from\s+(\d{4})\s+to\s+(\d{4})/);
    if (fromToMatch) {
      return {
        start: `${fromToMatch[1]}-01-01`,
        end: `${fromToMatch[2]}-12-31`
      };
    }

    // "in 2024" or "during 2023"
    const singleYearMatch = query.match(/(?:in|during|for)\s+(20\d{2})/);
    if (singleYearMatch) {
      return {
        start: `${singleYearMatch[1]}-01-01`,
        end: `${singleYearMatch[1]}-12-31`
      };
    }

    return null;
  }

  private static extractSensorAndSatellite(query: string): {
    sensor: string | null;
    satellite: string | null;
    modality: 'optical' | 'sar' | 'multispectral' | null;
  } {
    let sensor: string | null = null;
    let satellite: string | null = null;
    let modality: 'optical' | 'sar' | 'multispectral' | null = null;

    if (query.includes('sentinel-2') || query.includes('sentinel 2') || query.includes('s2')) {
      satellite = 'SENTINEL-2';
      sensor = 'MSI';
      modality = 'optical';
    } else if (query.includes('sentinel-1') || query.includes('sentinel 1') || query.includes('s1')) {
      satellite = 'SENTINEL-1';
      sensor = 'C-SAR';
      modality = 'sar';
    } else if (query.includes('resourcesat') || query.includes('rs2') || query.includes('liss')) {
      satellite = 'RESOURCESAT-2A';
      sensor = 'LISS-3';
      modality = 'multispectral';
    } else if (query.includes('cartosat') || query.includes('carto')) {
      satellite = 'CARTOSAT-2';
      sensor = 'PAN-MX';
      modality = 'optical';
    } else if (query.includes('sar') || query.includes('radar') || query.includes('backscatter')) {
      modality = 'sar';
    } else if (query.includes('multispectral') || query.includes('ndvi') || query.includes('nir')) {
      modality = 'multispectral';
    } else if (query.includes('optical')) {
      modality = 'optical';
    }

    return { sensor, satellite, modality };
  }

  private static extractSpatialRelation(query: string): { relation: string; feature: string } | null {
    const relationMatch = query.match(/(near|along|around|close to|adjacent to|within)\s+([a-z\s]+?)(?=\s+(?:between|from|in|using|with|during|$))/);
    if (relationMatch) {
      const rel = relationMatch[1].trim();
      const feat = relationMatch[2].trim();
      return { relation: rel, feature: feat };
    }
    return null;
  }

  private static extractObjects(query: string): string[] {
    const objects: string[] = [];
    const keywords = [
      { trigger: /build|structure|building/i, label: 'built structures' },
      { trigger: /road|highway|street/i, label: 'road network' },
      { trigger: /port|harbor|dock|pier|quay/i, label: 'port infrastructure' },
      { trigger: /vessel|ship|boat/i, label: 'maritime vessels' },
      { trigger: /bridge/i, label: 'bridge' },
      { trigger: /dam|reservoir/i, label: 'reservoir / dam' },
      { trigger: /crop|farmland|field/i, label: 'agricultural parcels' }
    ];

    for (const kw of keywords) {
      if (kw.trigger.test(query)) {
        objects.push(kw.label);
      }
    }
    return objects;
  }

  private static extractActions(query: string): string[] {
    const actions: string[] = [];
    if (/newly built|new construction|construction|building/i.test(query)) actions.push('new construction');
    if (/expansion|expanding|growth|growing/i.test(query)) actions.push('expansion');
    if (/clearance|clearing|cleared/i.test(query)) actions.push('clearing');
    if (/deforestation|tree loss/i.test(query)) actions.push('deforestation');
    if (/flood|inundation|water spread/i.test(query)) actions.push('inundation');
    return actions;
  }

  private static extractEnvironment(query: string): string[] {
    const env: string[] = [];
    if (/river|stream/i.test(query)) env.push('river');
    if (/water|lake|basin/i.test(query)) env.push('water body');
    if (/coast|coastal|shore/i.test(query)) env.push('coastal zone');
    if (/forest|vegetation|green/i.test(query)) env.push('vegetation / forest');
    if (/delta/i.test(query)) env.push('delta');
    if (/urban|city|suburb/i.test(query)) env.push('urban zone');
    return env;
  }

  private static extractAoiHint(query: string): string | null {
    const locations = [
      'mumbai', 'ahmedabad', 'gujarat', 'visakhapatnam', 'godavari', 
      'assam', 'brahmaputra', 'sundarbans', 'bengaluru', 'chennai', 'delhi'
    ];
    for (const loc of locations) {
      if (query.includes(loc)) {
        return loc.charAt(0).toUpperCase() + loc.slice(1);
      }
    }
    return null;
  }

  private static buildCoreSemanticQuery(
    raw: string, 
    objects: string[], 
    actions: string[], 
    environment: string[]
  ): string {
    // If structured concepts were identified, build a focused semantic query
    if (objects.length > 0 || actions.length > 0 || environment.length > 0) {
      return [...actions, ...objects, ...environment].join(' ');
    }
    // Clean stopwords from query
    return raw
      .replace(/\b(find|show|search|locate|detect|images|imagery|scenes|where|that|with|using|between|and|from|to|in|of|the|a|an)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
