/**
 * QA Intelligence Engine API Routes
 * Proxies requests to the QA engine service on port 3005
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();
const QA_ENGINE_URL = process.env.QA_ENGINE_URL || 'http://localhost:3005';

/**
 * POST /api/qa/run
 * Start a new QA run against a repository
 */
router.post('/run', async (req: Request, res: Response) => {
  try {
    const response = await axios.post(`${QA_ENGINE_URL}/qa/run`, req.body);
    res.status(response.status).json(response.data);
  } catch (error: any) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(503).json({
        error: 'QA Engine unavailable',
        message: 'The QA Intelligence Engine is not running. Start it on port 3005.',
      });
    }
  }
});

/**
 * GET /api/qa/runs
 * List all QA runs
 */
router.get('/runs', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${QA_ENGINE_URL}/qa/runs`, { params: req.query });
    res.json(response.data);
  } catch (error: any) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(503).json({ error: 'QA Engine unavailable' });
    }
  }
});

/**
 * GET /api/qa/runs/:runId
 * Get status of a specific QA run
 */
router.get('/runs/:runId', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${QA_ENGINE_URL}/qa/runs/${req.params.runId}`);
    res.json(response.data);
  } catch (error: any) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(503).json({ error: 'QA Engine unavailable' });
    }
  }
});

/**
 * GET /api/qa/results/:runId
 * Get full results of a QA run
 */
router.get('/results/:runId', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${QA_ENGINE_URL}/qa/results/${req.params.runId}`);
    res.json(response.data);
  } catch (error: any) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(503).json({ error: 'QA Engine unavailable' });
    }
  }
});

/**
 * GET /api/qa/health
 * QA Engine health check
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${QA_ENGINE_URL}/health`);
    res.json(response.data);
  } catch (error: any) {
    res.status(503).json({
      service: 'qa-engine',
      status: 'unavailable',
      message: 'QA Engine is not running',
    });
  }
});

export default router;
