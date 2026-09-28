/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Indian Earth-Observation Data Discovery Agent.
 * Connects natural-language queries and missing evidence states to official
 * Indian EO catalogues (ISRO NRSC Bhoonidhi and SAC MOSDAC).
 * Strictly applies minimum-sufficient evidence principles:
 * - Only selects necessary observations
 * - Distinguishes Open vs Restricted access products
 * - Provides cryptographic provenance hashes for selected observations
 */

import { EOObservation, EOSearchQuery, EODiscoveryResult } from './types.js';
import { BhoonidhiConnector } from './bhoonidhiConnector.js';
import { MosdacConnector } from './mosdacConnector.js';

export class EODataDiscoveryAgent {
  /**
   * Evaluates a user query or missing-evidence state to determine the appropriate EO data search query.
   */
  public static planDataDiscovery(query: string, currentImageCount: number): EOSearchQuery {
    const qLower = query.toLowerCase();
    const eosQuery: EOSearchQuery = {};

    // 1. Detect Modality Requirement
    if (qLower.includes('sar') || qLower.includes('radar') || qLower.includes('backscatter') || qLower.includes('roughness')) {
      eosQuery.modality = 'SAR';
      eosQuery.satellite = 'SENTINEL-1';
    } else if (qLower.includes('cyclone') || qLower.includes('rainfall') || qLower.includes('weather') || qLower.includes('sea surface temperature') || qLower.includes('sst') || qLower.includes('ocean color')) {
      eosQuery.modality = 'METEOROLOGICAL';
      eosQuery.satellite = 'INSAT-3D';
    } else if (qLower.includes('ndvi') || qLower.includes('vegetation') || qLower.includes('chlorophyll') || qLower.includes('multispectral')) {
      eosQuery.modality = 'MULTISPECTRAL';
    } else {
      eosQuery.modality = 'OPTICAL';
    }

    // 2. Detect AOI Location Mentions
    if (qLower.includes('mumbai') || qLower.includes('bombay') || qLower.includes('maharashtra') || qLower.includes('western ghats')) {
      eosQuery.aoi = {
        name: 'Mumbai / Western Coastal Zone',
        bbox: [72.8, 18.9, 73.1, 19.2],
        lat: 19.076,
        lng: 72.877
      };
    } else if (qLower.includes('gujarat') || qLower.includes('arabian sea')) {
      eosQuery.aoi = {
        name: 'Gujarat / Arabian Sea Sector',
        bbox: [68.0, 20.0, 73.0, 24.0]
      };
    } else {
      // Default to general Indian Subcontinent reference bounds
      eosQuery.aoi = {
        name: 'Indian Subcontinent Reference Sector',
        bbox: [68.0, 8.0, 96.0, 36.0]
      };
    }

    // 3. Detect Temporal Baseline Requirements
    if (qLower.includes('change') || qLower.includes('increase') || qLower.includes('decrease') || qLower.includes('flood') || qLower.includes('temporal') || qLower.includes('before') || qLower.includes('after')) {
      eosQuery.targetTask = 'BI_TEMPORAL_ANALYSIS';
    }

    eosQuery.maxCloudCover = 20;
    return eosQuery;
  }

  /**
   * Executes discovery across official Indian EO catalogues.
   */
  public static async discoverObservations(query: string, currentImageCount: number): Promise<EODiscoveryResult> {
    const plan = this.planDataDiscovery(query, currentImageCount);

    // Route to appropriate catalogue
    if (plan.modality === 'METEOROLOGICAL') {
      return await MosdacConnector.searchCatalog(plan);
    }

    // Land observation, optical, SAR, water change -> ISRO NRSC Bhoonidhi
    return await BhoonidhiConnector.searchCatalog(plan);
  }
}
