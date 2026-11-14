import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { FUEL_TYPES } from './src/data/nasaExperiments.ts';
import type { FuelTypeId } from './src/data/nasaExperiments.ts';
import { getDb } from './server/database.ts';
import {
  DataLabError,
  MAX_CSV_UPLOAD_BYTES,
  analyzeDataLabDataset,
  buildDataLabCsvExport,
  buildDataLabJsonReport,
  createDataLabDatasetFromCsv,
  decodeCsvBuffer,
  deleteDataLabDataset,
  extractDataLabSession,
  generateDataLabPdfBuffer,
  getDataLabDatasetDetail,
  issueDataLabSessionToken,
  listSessionDataLabDatasets,
} from './server/services/dataLabService.ts';
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
  fetchMlServiceHealth,
  getLocalModelInfo,
  getMlServiceBaseUrl,
  getMlServiceMode,
  getPredictionById,
  listRecentPredictions,
  runAndSavePrediction,
} from './server/services/predictionService.ts';
import { getResearchInsights } from './server/services/insightsService.ts';
import { saveContactMessage } from './server/services/contactService.ts';

dotenv.config({ quiet: true });

const VALID_ML_FUELS = new Set<string>(FUEL_TYPES.map((fuel) => fuel.id));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Builds the fully configured Express application (API routes + error handling).
 *
 * The static-site / dev-server middleware is deliberately NOT registered here so the
 * same app can be reused by the Vercel serverless entrypoint (see `api/index.ts`).
 */
export async function createApp(): Promise<express.Express> {
  // Initialize & seed SQLite database
  getDb();

  const app = express();

  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : undefined;
  app.use(
    cors({
      origin: allowedOrigins && allowedOrigins.length > 0 ? allowedOrigins : true,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '4mb' }));

  const uploadMiddleware = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: MAX_CSV_UPLOAD_BYTES,
      files: 1,
    },
  });

  // Health & Database/ML Service Readiness Check
  app.get('/api/health', async (_req, res) => {
    const stats = getExperimentStatistics();
    const mlStatus = await fetchMlServiceHealth();
    res.json({
      connected: true,
      mlServiceConnected: mlStatus.connected,
      mlServiceUrl: mlStatus.url,
      databaseEngine: 'SQLite (Normalized Multi-Table Schema v3)',
      modelMode:
        getMlServiceMode() === 'portable' ? 'portable-sklearn-ml' : 'python-sklearn-ml',
      isTrainedMlModel: mlStatus.connected,
      modelName: mlStatus.modelName,
      isSyntheticDemoData: mlStatus.isSyntheticDemoData,
      datasetProvenance: mlStatus.datasetProvenance,
      modelEvaluation: mlStatus.evaluation,
      limitationsNote: mlStatus.connected
        ? `Connected to ${getMlServiceMode() === 'portable' ? 'in-process' : 'Python'} Scikit-learn ML service (${mlStatus.modelName}). Training data provenance: ${mlStatus.datasetProvenance}. Not NASA-validated.`
        : mlStatus.error ||
          `ML prediction service is unavailable (${mlStatus.url}). Predictions will fail cleanly until the ML service is started.`,
      calibrationExperiments: stats.verifiedCount,
      verifiedExperiments: stats.verifiedCount,
      totalExperiments: stats.totalExperiments,
      availableDatasetsCount: stats.availableDatasetsCount,
      indexedDatasetSamples: stats.totalSamples,
      externalMlUrlConfigured: Boolean(process.env.ML_BACKEND_URL),
    });
  });

  app.get('/api/model-info', async (_req, res) => {
    const localInfo = getLocalModelInfo();
    if (localInfo) {
      res.json(localInfo);
      return;
    }
    const baseUrl = getMlServiceBaseUrl();
    try {
      const upstream = await fetch(`${baseUrl}/model-info`, {
        signal: AbortSignal.timeout(2500),
      });
      if (!upstream.ok) {
        const body = await upstream.json().catch(() => null);
        res.status(upstream.status).json({
          error: body?.detail || `ML service returned HTTP ${upstream.status}`,
        });
        return;
      }
      res.json(await upstream.json());
    } catch (err) {
      res.status(503).json({
        error: `Python ML service is unavailable at ${baseUrl}. (${
          err instanceof Error ? err.message : 'Connection refused'
        })`,
      });
    }
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

  // Python ML microservice passthrough (GET /health, POST /predict). In portable mode the
  // inference runs in-process instead, so these routes return the same payloads without
  // requiring a second service.
  app.get('/api/ml/health', async (_req, res) => {
    const status = await fetchMlServiceHealth();
    res.json({
      status: status.modelLoaded ? 'ok' : 'model_missing',
      modelLoaded: status.modelLoaded,
      modelName: status.modelName,
      isSyntheticDemoData: status.isSyntheticDemoData,
      datasetProvenance: status.datasetProvenance,
      evaluation: status.evaluation,
      split: status.split ?? null,
      modelComparison: status.modelComparison ?? null,
    });
  });

  app.post('/api/ml/predict', async (req, res) => {
    const body = req.body || {};
    const localInfo = getLocalModelInfo();
    if (!localInfo) {
      // Python mode: proxy straight through to the FastAPI service.
      const baseUrl = getMlServiceBaseUrl();
      try {
        const upstream = await fetch(`${baseUrl}/predict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(15000),
        });
        const payload = await upstream.json().catch(() => null);
        res.status(upstream.status).json(payload ?? { error: `ML service returned HTTP ${upstream.status}` });
      } catch (err) {
        res.status(503).json({
          error: `Python ML service is unavailable at ${baseUrl}. (${
            err instanceof Error ? err.message : 'Connection refused'
          })`,
        });
      }
      return;
    }

    const oxygenPct = Number(body.oxygenPct);
    const pressurePsi = Number(body.pressurePsi);
    const airflowCmS = Number(body.airflowCmS);
    const fuelType = String(body.fuelType || '');
    const invalid =
      !Number.isFinite(oxygenPct) || oxygenPct < 21 || oxygenPct > 85 ||
      !Number.isFinite(pressurePsi) || pressurePsi < 4.3 || pressurePsi > 14.7 ||
      !Number.isFinite(airflowCmS) || airflowCmS < 0 || airflowCmS > 100 ||
      !VALID_ML_FUELS.has(fuelType);
    if (invalid) {
      res.status(422).json({
        detail: 'Invalid prediction input. Expected oxygenPct 21-85, pressurePsi 4.3-14.7, airflowCmS 0-100, and a known fuelType.',
      });
      return;
    }
    try {
      const { predict: predictLocally } = await import('./server/ml/portableMlService.ts');
      res.json(predictLocally({ oxygenPct, pressurePsi, airflowCmS, fuelType: fuelType as never }));
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Prediction failed.' });
    }
  });

  // Run & Persist Fire Risk Prediction + Exact 16-Coalition SHAP Explainability
  const handleCreatePrediction = async (req: express.Request, res: express.Response) => {
    const body = req.body || {};
    const oxygenPct = Number(body.oxygenPct);
    const pressurePsi = Number(body.pressurePsi);
    const airflowCmS = Number(body.airflowCmS);
    const fuelType = String(body.fuelType || '') as FuelTypeId;

    const validationErrors: string[] = [];
    if (!Number.isFinite(oxygenPct) || oxygenPct < 21 || oxygenPct > 85) {
      validationErrors.push('oxygenPct must be a number between 21 and 85 (% O₂).');
    }
    if (!Number.isFinite(pressurePsi) || pressurePsi < 4.3 || pressurePsi > 14.7) {
      validationErrors.push('pressurePsi must be a number between 4.3 and 14.7 (psi).');
    }
    if (!Number.isFinite(airflowCmS) || airflowCmS < 0 || airflowCmS > 100) {
      validationErrors.push('airflowCmS must be a number between 0 and 100 (cm/s).');
    }
    if (!FUEL_TYPES.some((f) => f.id === fuelType)) {
      validationErrors.push(
        `fuelType must be one of: ${FUEL_TYPES.map((f) => f.id).join(', ')}.`
      );
    }

    if (validationErrors.length > 0) {
      res.status(400).json({
        error: `Validation failed: ${validationErrors.join(' ')}`,
        validationErrors,
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

  // ---------- Data Lab Routes (Session-Isolated User CSV Upload, Analysis & Exports) ----------

  const handleDataLabError = (res: express.Response, err: unknown) => {
    if (err instanceof DataLabError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    if (err instanceof multer.MulterError) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? `Uploaded file exceeds maximum allowed size (${Math.round(MAX_CSV_UPLOAD_BYTES / (1024 * 1024))} MB).`
          : `Multipart upload error (${err.code}): ${err.message}`;
      res.status(status).json({ error: message });
      return;
    }
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Data Lab processing error.',
    });
  };

  app.post('/api/data-lab/session', (_req, res) => {
    res.status(200).json(issueDataLabSessionToken());
  });

  app.get('/api/data-lab/datasets', (req, res) => {
    try {
      const sessionKey = extractDataLabSession(req);
      const datasets = listSessionDataLabDatasets(sessionKey);
      res.json({ datasets });
    } catch (err) {
      handleDataLabError(res, err);
    }
  });

  app.post('/api/data-lab/upload', (req, res) => {
    uploadMiddleware.single('file')(req, res, (multerErr) => {
      if (multerErr) {
        handleDataLabError(res, multerErr);
        return;
      }
      try {
        const sessionKey = extractDataLabSession(req);
        let filename = '';
        let fileSizeBytes = 0;
        let csvText = '';

        if (req.file) {
          filename = req.file.originalname;
          fileSizeBytes = req.file.size;
          csvText = decodeCsvBuffer(req.file.buffer);
        } else if (req.body && typeof req.body.csvContent === 'string') {
          filename = String(req.body.filename || 'uploaded_dataset.csv');
          csvText = req.body.csvContent;
          fileSizeBytes = Buffer.byteLength(csvText, 'utf8');
        } else {
          res.status(400).json({
            error: 'No CSV file provided. Upload a .csv file via multipart/form-data (field "file") or JSON { filename, csvContent }.',
          });
          return;
        }

        const created = createDataLabDatasetFromCsv({
          sessionKey,
          filename,
          fileSizeBytes,
          csvText,
        });
        res.status(201).json(created);
      } catch (err) {
        handleDataLabError(res, err);
      }
    });
  });

  app.get('/api/data-lab/datasets/:id', (req, res) => {
    try {
      const sessionKey = extractDataLabSession(req);
      const detail = getDataLabDatasetDetail(sessionKey, String(req.params.id || ''));
      res.json(detail);
    } catch (err) {
      handleDataLabError(res, err);
    }
  });

  app.post('/api/data-lab/datasets/:id/analyze', (req, res) => {
    try {
      const sessionKey = extractDataLabSession(req);
      const result = analyzeDataLabDataset(
        sessionKey,
        String(req.params.id || ''),
        (req.body || {}) as {
          selectedColumns?: string[];
          chartType?: 'line' | 'bar' | 'scatter' | 'distribution' | 'correlation';
          xColumn?: string | null;
          yColumn?: string | null;
          includeCompatibilityEstimates?: boolean;
        }
      );
      res.json(result);
    } catch (err) {
      handleDataLabError(res, err);
    }
  });

  app.get('/api/data-lab/datasets/:id/report', async (req, res) => {
    try {
      const sessionKey = extractDataLabSession(req);
      const datasetId = String(req.params.id || '');
      const format = String(req.query.format || 'json').toLowerCase();
      const colsParam = req.query.columns
        ? String(req.query.columns)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

      if (format === 'csv') {
        const csvFile = buildDataLabCsvExport(sessionKey, datasetId, colsParam);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${csvFile.filename}"`);
        res.status(200).send(csvFile.content);
        return;
      }

      if (format === 'pdf') {
        const pdfFile = await generateDataLabPdfBuffer(sessionKey, datasetId, colsParam);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${pdfFile.filename}"`);
        res.status(200).send(pdfFile.buffer);
        return;
      }

      if (format === 'json') {
        const report = buildDataLabJsonReport(sessionKey, datasetId, colsParam);
        const safeName = report.dataset.filename.replace(/\.csv$/i, '').replace(/[^a-z0-9_-]/gi, '_');
        if (req.query.download === '1') {
          res.setHeader('Content-Disposition', `attachment; filename="${safeName}_summary.json"`);
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.status(200).json(report);
        return;
      }

      res.status(400).json({ error: "Unsupported report format. Use 'pdf', 'json', or 'csv'." });
    } catch (err) {
      handleDataLabError(res, err);
    }
  });

  app.delete('/api/data-lab/datasets/:id', (req, res) => {
    try {
      const sessionKey = extractDataLabSession(req);
      const deleted = deleteDataLabDataset(sessionKey, String(req.params.id || ''));
      res.json(deleted);
    } catch (err) {
      handleDataLabError(res, err);
    }
  });

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

  // Global JSON error middleware for /api/* (prevents Express default HTML error pages)
  app.use('/api', (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (res.headersSent) return;
    if (err instanceof DataLabError || err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    if (err instanceof multer.MulterError) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      res.status(status).json({ error: err.message });
      return;
    }
    const status =
      err && typeof err === 'object' && 'status' in err && typeof (err as { status?: unknown }).status === 'number'
        ? (err as { status: number }).status
        : err && typeof err === 'object' && 'statusCode' in err && typeof (err as { statusCode?: unknown }).statusCode === 'number'
          ? (err as { statusCode: number }).statusCode
          : 500;
    const message = err instanceof Error ? err.message : 'Unexpected server error.';
    res.status(status).json({ error: message });
  });

  return app;
}

/**
 * Local / container entrypoint: serves the Vite dev server in development and the
 * built `dist/` bundle in production, then listens on PORT.
 *
 * Vercel does not use this function; it imports `createApp()` through `api/index.ts`.
 */
async function startServer() {
  const PORT = Number(process.env.PORT || 3000);
  const isProduction = process.env.NODE_ENV === 'production';
  const app = await createApp();

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

// Only boot the long-running HTTP server when this file is executed directly
// (local dev / container). On Vercel, `api/index.ts` imports `createApp()` and the
// platform owns the HTTP lifecycle.
const isDirectExecution =
  typeof process.argv[1] === 'string' && path.resolve(process.argv[1]) === __filename;

if (isDirectExecution && !process.env.VERCEL) {
  startServer().catch((err) => {
    console.error('Failed to start Flame in Freefall server:', err);
    process.exit(1);
  });
}
