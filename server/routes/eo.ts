/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Express Router for Indian Earth Observation Catalog Discovery.
 */

import { Router } from 'express';
import { BhoonidhiConnector } from '../eo/bhoonidhiConnector.js';
import { MosdacConnector } from '../eo/mosdacConnector.js';
import { EODataDiscoveryAgent } from '../eo/eoDiscoveryAgent.js';
import { EOSearchQuery } from '../eo/types.js';

export const eoRouter = Router();

eoRouter.post('/search', async (req, res) => {
  try {
    const { query, aoi, provider, modality, satellite, sensor, maxCloudCover } = req.body;

    const searchQuery: EOSearchQuery = {
      aoi,
      modality,
      satellite,
      sensor,
      maxCloudCover: maxCloudCover !== undefined ? Number(maxCloudCover) : 20
    };

    if (provider === 'MOSDAC') {
      const result = await MosdacConnector.searchCatalog(searchQuery);
      return res.json(result);
    }

    if (provider === 'Bhoonidhi') {
      const result = await BhoonidhiConnector.searchCatalog(searchQuery);
      return res.json(result);
    }

    // Default: use the smart EODataDiscoveryAgent
    const result = query 
      ? await EODataDiscoveryAgent.discoverObservations(query, 0)
      : await BhoonidhiConnector.searchCatalog(searchQuery);

    return res.json(result);
  } catch (error: any) {
    console.error('EO Search Error:', error);
    res.status(500).json({ error: error.message || 'Failed to search EO catalog.' });
  }
});
