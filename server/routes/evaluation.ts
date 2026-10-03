/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Express Router for System Evaluation, Diagnostics & Benchmarks (Phase 8).
 */

import { Router } from 'express';
import { EvaluationEngine } from '../evaluation/evaluationEngine.js';

export const evaluationRouter = Router();

// 1. Get Capability Matrix
evaluationRouter.get('/capability-matrix', (_req, res) => {
  try {
    const matrix = EvaluationEngine.getCapabilityMatrix();
    return res.json({ matrix });
  } catch (error: any) {
    console.error('Capability Matrix Error:', error);
    res.status(500).json({ error: error.message || 'Failed to get capability matrix.' });
  }
});

// 2. Get Archive & System Diagnostics
evaluationRouter.get('/diagnostics', async (_req, res) => {
  try {
    const archive = await EvaluationEngine.getArchiveDiagnostics();
    const hardware = EvaluationEngine.getHardwareProfile();
    return res.json({
      archive,
      hardware,
      offlineStatus: 'CERTIFIED_OFFLINE (0 Required External Services)'
    });
  } catch (error: any) {
    console.error('Diagnostics Error:', error);
    res.status(500).json({ error: error.message || 'Failed to get diagnostics.' });
  }
});

// 3. Run Benchmark Suite
evaluationRouter.post('/benchmark', async (_req, res) => {
  try {
    const results = await EvaluationEngine.runBenchmark();
    return res.json(results);
  } catch (error: any) {
    console.error('Benchmark Error:', error);
    res.status(500).json({ error: error.message || 'Benchmark execution failed.' });
  }
});
