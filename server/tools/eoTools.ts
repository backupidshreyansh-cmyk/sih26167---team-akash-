/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Earth Observation Data Discovery Tool.
 * Registered in the SatQuery tool registry for programmatic discovery of
 * official Indian Earth Observation datasets (Bhoonidhi, MOSDAC).
 */

import { Tool, globalRegistry } from './registry.js';
import { EODataDiscoveryAgent } from '../eo/eoDiscoveryAgent.js';

export const EODiscoveryTool: Tool = {
  name: 'eo_data_discovery',
  description: 'Searches official Indian Earth Observation catalogues (ISRO NRSC Bhoonidhi, SAC MOSDAC) for matching satellite observations by AOI, date, and sensor modality.',
  version: '1.0.0',
  supportedTasks: [
    'OPTICAL_ANALYSIS', 
    'SAR_ANALYSIS', 
    'OPTICAL_SAR_ANALYSIS', 
    'BI_TEMPORAL_ANALYSIS', 
    'CHANGE_VQA', 
    'TEXT_GUIDED_GROUNDING'
  ],
  supportedModalities: ['ALL'],
  isImplemented: true,
  async execute(input, context) {
    const discoveryResult = await EODataDiscoveryAgent.discoverObservations(input.query, input.images.length);
    return {
      status: discoveryResult.status,
      provider: discoveryResult.provider,
      totalFound: discoveryResult.totalFound,
      selected: discoveryResult.selected,
      rejected: discoveryResult.rejected,
      accessNotice: discoveryResult.accessNotice,
      executionTrace: [
        {
          step: 'EO_DATA_DISCOVERY_COMPLETED',
          status: 'SUCCESS',
          details: `Queried ${discoveryResult.provider}: Found ${discoveryResult.totalFound}, Selected ${discoveryResult.selected.length} minimum-sufficient observations.`
        }
      ]
    };
  }
};

globalRegistry.register(EODiscoveryTool);
