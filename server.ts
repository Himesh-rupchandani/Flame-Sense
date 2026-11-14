import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { FUEL_TYPES } from './src/data/nasaExperiments.ts';
import type { FuelTypeId } from './src/data/nasaExperiments.ts';
import { getDb } from './server/database.ts';
import {
  getAuthorizedDatasetDownload,
  getDatasetPreviewBySlugAndId,
  getExperimentBySlug,
  getExperimentCategoriesSummary,
  getExperimentDatasetsBySlug,
  getExperimentFindingsBySlug,
  getExperimentParametersBySlug,
  getExperimentReferencesBySlug,
  getExperimentStatistics,
  getRelatedExperimentsBySlug,
  listExperiments,
  listExperimentsPaginated,
} from './server/services/experimentService.ts';
import {
  HttpError,
  addAdminParameter,
  addAdminReference,
  addOrUpdateAdminFinding,
  createAdminExperiment,
  deleteAdminExperiment,
  issueAdminSessionToken,
  registerAdminDataset,
  requireAdminAuth,
  updateAdminExperiment,
} from './server/services/adminExperimentService.ts';
import { getComputedRankings } from './server/services/rankingService.ts';
import {
  getPredictionById,
  listRecentPredictions,
  runAndSavePrediction,
} from './server/services/predictionService.ts';
import { getResearchInsights } from './server/services/insightsService.ts';
import { saveContactMessage } from './server/services/contactService.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  // Initialize & seed SQLite database
  getDb();

  const app = express();
  app.use(express.json({ limit: '4mb' }));

  // Health & Database/Model Readiness Check
  app.get('/api/health', (_req, res) => {
    const stats = getExperimentStatistics();
    res.json({
      connected: true,
      databaseEngine: 'SQLite (Normalized Multi-Table Schema v3)',
      modelName: 'FlameNet-MicroG v2.4 (Empirical NASA Fit + Exact SHAP)',
      calibrationExperiments: stats.verifiedCount,
      totalExperiments: stats.totalExperiments,
      datasetRuns: 5120,
      externalMlUrlConfigured: Boolean(process.env.ML_BACKEND_URL),
    });
  });

  // Categories & Cross-Experiment Statistics (declared BEFORE :slug routes)
  app.get('/api/experiments/categories', (_req, res) => {
    res.json(getExperimentCategoriesSummary());
  });

  app.get('/api/experiments/statistics', (_req, res) => {
    res.json(getExperimentStatistics());
  });

  // Experiments Listing, Pagination, Filtering & Sorting
  const handleListExperiments = (req: express.Request, res: express.Response) => {
    const result = listExperimentsPaginated({
      search: String(req.query.search || ''),
      category: String(req.query.category || 'all'),
      verificationStatus: String(req.query.verificationStatus || 'all'),
      datasetAvailability: String(req.query.datasetAvailability || 'all'),
      sortBy: String(req.query.sortBy || 'relevance'),
      sortOrder: req.query.sortOrder ? String(req.query.sortOrder) : undefined,
      page: Number(req.query.page || 1),
      limit: Number(req.query.limit || 12),
    });
    res.json(result);
  };
  app.get('/api/experiments', handleListExperiments);
  app.get('/api/investigations', handleListExperiments);

  // Single Experiment Sub-Resources
  app.get('/api/experiments/:slug/parameters', (req, res) => {
    const slug = String(req.params.slug || '');
    const items = getExperimentParametersBySlug(slug);
    if (!items) {
      res.status(404).json({ error: `Experiment '${slug}' not found` });
      return;
    }
    res.json({ slug, parameters: items });
  });

  app.get('/api/experiments/:slug/findings', (req, res) => {
    const slug = String(req.params.slug || '');
    const items = getExperimentFindingsBySlug(slug);
    if (!items) {
      res.status(404).json({ error: `Experiment '${slug}' not found` });
      return;
    }
    res.json({ slug, findings: items });
  });

  app.get('/api/experiments/:slug/datasets', (req, res) => {
    const slug = String(req.params.slug || '');
    const items = getExperimentDatasetsBySlug(slug);
    if (!items) {
      res.status(404).json({ error: `Experiment '${slug}' not found` });
      return;
    }
    res.json({ slug, datasets: items });
  });

  app.get('/api/experiments/:slug/datasets/:dataset_id/preview', (req, res) => {
    const slug = String(req.params.slug || '');
    const datasetId = String(req.params.dataset_id || '');
    const preview = getDatasetPreviewBySlugAndId(slug, datasetId);
    if ('error' in preview) {
      res.status(preview.status).json({ error: preview.error });
      return;
    }
    res.json(preview);
  });

  app.get('/api/experiments/:slug/datasets/:dataset_id/download', (req, res) => {
    const slug = String(req.params.slug || '');
    const datasetId = String(req.params.dataset_id || '');
    const file = getAuthorizedDatasetDownload(slug, datasetId);
    if ('error' in file) {
      res.status(file.status).json({ error: file.error });
      return;
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.status(200).send(file.content);
  });

  app.get('/api/experiments/:slug/references', (req, res) => {
    const slug = String(req.params.slug || '');
    const items = getExperimentReferencesBySlug(slug);
    if (!items) {
      res.status(404).json({ error: `Experiment '${slug}' not found` });
      return;
    }
    res.json({ slug, references: items });
  });

  app.get('/api/experiments/:slug/related', (req, res) => {
    const slug = String(req.params.slug || '');
    const limit = Math.min(8, Math.max(1, Number(req.query.limit || 3)));
    const items = getRelatedExperimentsBySlug(slug, limit);
    if (!items) {
      res.status(404).json({ error: `Experiment '${slug}' not found` });
      return;
    }
    res.json({ slug, relatedExperiments: items });
  });

  // Single Experiment Detail by Slug or ID
  const handleGetExperiment = (req: express.Request, res: express.Response) => {
    const slug = String(req.params.slug || '');
    const detail = getExperimentBySlug(slug);
    if (!detail) {
      res.status(404).json({ error: `Experiment '${slug}' not found` });
      return;
    }
    res.json(detail);
  };
  app.get('/api/experiments/:slug', handleGetExperiment);
  app.get('/api/investigations/:slug', handleGetExperiment);

  // Admin Session Issuance & Auth-Protected CRUD Endpoints
  app.post('/api/admin/session', (req, res) => {
    const passcode = String(req.body?.passcode || '');
    const issued = issueAdminSessionToken(passcode);
    if (!issued) {
      res.status(401).json({ error: 'Invalid administrative access passcode.' });
      return;
    }
    res.status(200).json(issued);
  });

  const handleAdminError = (res: express.Response, err: unknown) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Administrative operation failed.',
    });
  };

  app.post('/api/admin/experiments', requireAdminAuth, (req, res) => {
    try {
      const created = createAdminExperiment((req.body || {}) as Record<string, unknown>);
      res.status(201).json(created);
    } catch (err) {
      handleAdminError(res, err);
    }
  });

  app.put('/api/admin/experiments/:id', requireAdminAuth, (req, res) => {
    try {
      const updated = updateAdminExperiment(
        String(req.params.id || ''),
        (req.body || {}) as Record<string, unknown>
      );
      res.json(updated);
    } catch (err) {
      handleAdminError(res, err);
    }
  });

  app.delete('/api/admin/experiments/:id', requireAdminAuth, (req, res) => {
    try {
      const result = deleteAdminExperiment(String(req.params.id || ''));
      res.json(result);
    } catch (err) {
      handleAdminError(res, err);
    }
  });

  app.post('/api/admin/experiments/:id/parameters', requireAdminAuth, (req, res) => {
    try {
      const updated = addAdminParameter(
        String(req.params.id || ''),
        (req.body || {}) as Record<string, unknown>
      );
      res.status(201).json(updated);
    } catch (err) {
      handleAdminError(res, err);
    }
  });

  const handleUpsertFinding = (req: express.Request, res: express.Response) => {
    try {
      const updated = addOrUpdateAdminFinding(
        String(req.params.id || ''),
        (req.body || {}) as Record<string, unknown>
      );
      res.status(req.method === 'POST' ? 201 : 200).json(updated);
    } catch (err) {
      handleAdminError(res, err);
    }
  };
  app.post('/api/admin/experiments/:id/findings', requireAdminAuth, handleUpsertFinding);
  app.put('/api/admin/experiments/:id/findings', requireAdminAuth, handleUpsertFinding);

  app.post('/api/admin/experiments/:id/datasets', requireAdminAuth, (req, res) => {
    try {
      const updated = registerAdminDataset(
        String(req.params.id || ''),
        (req.body || {}) as Record<string, unknown>
      );
      res.status(201).json(updated);
    } catch (err) {
      handleAdminError(res, err);
    }
  });

  app.post('/api/admin/experiments/:id/references', requireAdminAuth, (req, res) => {
    try {
      const updated = addAdminReference(
        String(req.params.id || ''),
        (req.body || {}) as Record<string, unknown>
      );
      res.status(201).json(updated);
    } catch (err) {
      handleAdminError(res, err);
    }
  });

  // Methodology-Calculated Experiment Rankings
  app.get('/api/rankings', (_req, res) => {
    res.json(getComputedRankings());
  });

  // Dynamic Research Insights & Atmospheric Trend Series
  app.get('/api/insights', (req, res) => {
    const fuelParam = req.query.fuelType ? (String(req.query.fuelType) as FuelTypeId) : undefined;
    const psiParam = req.query.pressurePsi !== undefined ? Number(req.query.pressurePsi) : undefined;
    const flowParam = req.query.airflowCmS !== undefined ? Number(req.query.airflowCmS) : undefined;
    res.json(
      getResearchInsights({
        fuelType: fuelParam,
        pressurePsi: Number.isFinite(psiParam) ? psiParam : undefined,
        airflowCmS: Number.isFinite(flowParam) ? flowParam : undefined,
      })
    );
  });

  // Prediction History Listing
  app.get('/api/predictions', (req, res) => {
    const limit = Math.min(25, Math.max(1, Number(req.query.limit || 8)));
    res.json({ predictions: listRecentPredictions(limit) });
  });

  // Retrieve Persisted Prediction + SHAP Explanations by ID
  app.get('/api/predictions/:id', (req, res) => {
    const record = getPredictionById(String(req.params.id || ''));
    if (!record) {
      res.status(404).json({ error: `Prediction '${req.params.id}' not found` });
      return;
    }
    res.json(record);
  });

  // Run & Persist Fire Risk Prediction + Exact 16-Coalition SHAP Explainability
  const handleCreatePrediction = async (req: express.Request, res: express.Response) => {
    const body = req.body || {};
    const oxygenPct = Number(body.oxygenPct);
    const pressurePsi = Number(body.pressurePsi);
    const airflowCmS = Number(body.airflowCmS);
    const fuelType = String(body.fuelType || '') as FuelTypeId;

    if (
      !Number.isFinite(oxygenPct) ||
      !Number.isFinite(pressurePsi) ||
      !Number.isFinite(airflowCmS) ||
      !FUEL_TYPES.some((f) => f.id === fuelType)
    ) {
      res.status(400).json({
        error:
          'Invalid prediction parameters. Expected oxygenPct (21-85), pressurePsi (4.3-14.7), airflowCmS (0-100), and valid fuelType.',
      });
      return;
    }

    try {
      const record = await runAndSavePrediction({
        oxygenPct,
        pressurePsi,
        airflowCmS,
        fuelType,
      });
      res.status(201).json(record);
    } catch (err) {
      res.status(503).json({
        error: err instanceof Error ? err.message : 'ML prediction model unreachable',
        modelConnected: false,
      });
    }
  };
  app.post('/api/predictions', handleCreatePrediction);
  app.post('/api/predict', handleCreatePrediction);

  // Save Contact Message Submission
  app.post('/api/contact', (req, res) => {
    const body = req.body || {};
    try {
      const saved = saveContactMessage({
        name: String(body.name || ''),
        email: String(body.email || ''),
        subject: String(body.subject || ''),
        message: String(body.message || ''),
      });
      res.status(201).json({
        success: true,
        submission: saved,
      });
    } catch (err) {
      res.status(400).json({
        success: false,
        error: err instanceof Error ? err.message : 'Invalid contact submission.',
      });
    }
  });

  // Explicit 404 JSON for unknown /api/* routes
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Flame in Freefall server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Flame in Freefall server:', err);
  process.exit(1);
});
