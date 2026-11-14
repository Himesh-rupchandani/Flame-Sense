import crypto from 'crypto';
import type express from 'express';
import { getDb } from '../database.ts';
import { computeCrewSafetyRelevance } from '../../src/data/nasaExperiments.ts';
import { getComputedRankings } from './rankingService.ts';
import { getExperimentBySlug } from './experimentService.ts';
import type {
  ContentSourceType,
  DatasetStatus,
  DatasetVariableMeta,
  FuelTypeId,
  ParameterAvailability,
  ParameterDataType,
  VerificationStatus,
} from '../../src/types/experiments.ts';

const VALID_VERIFICATION: VerificationStatus[] = ['VERIFIED', 'DEMO', 'PENDING'];
const VALID_FUELS: FuelTypeId[] = ['solid-fabric', 'plastic', 'liquid', 'gas'];

function getAdminSecret(): string {
  return process.env.ADMIN_ACCESS_CODE || 'FLAME-ADMIN-2026';
}

function getSigningKey(): string {
  return process.env.ADMIN_TOKEN_SECRET || 'flame-in-freefall-hmac-signing-key-2026';
}

export function issueAdminSessionToken(passcode: string): { token: string; expiresAt: string } | null {
  const expected = getAdminSecret();
  if (!passcode || passcode !== expected) return null;

  const expiresAtMs = Date.now() + 8 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ role: 'admin', exp: expiresAtMs })).toString('base64url');
  const sig = crypto.createHmac('sha256', getSigningKey()).update(payload).digest('base64url');
  return {
    token: `${payload}.${sig}`,
    expiresAt: new Date(expiresAtMs).toISOString(),
  };
}

export function verifyAdminTokenOrKey(provided: string): boolean {
  if (!provided) return false;
  if (provided === getAdminSecret()) return true;

  const parts = provided.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', getSigningKey()).update(payload).digest('base64url');
  if (sig.length !== expectedSig.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return false;

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      role?: string;
      exp?: number;
    };
    return decoded.role === 'admin' && typeof decoded.exp === 'number' && decoded.exp > Date.now();
  } catch {
    return false;
  }
}

export function requireAdminAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const authHeader = String(req.headers.authorization || '').trim();
  const bearerToken = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';
  const apiKeyHeader = String(req.headers['x-admin-key'] || '').trim();
  const credential = bearerToken || apiKeyHeader;

  if (!credential) {
    res.status(401).json({
      error: 'Unauthorized: Administrative authentication token or key is required.',
    });
    return;
  }

  if (!verifyAdminTokenOrKey(credential)) {
    res.status(403).json({
      error: 'Forbidden: Invalid or expired administrative credentials.',
    });
    return;
  }

  next();
}

function slugify(text: string): string {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function createAdminExperiment(body: Record<string, unknown>) {
  const db = getDb();

  const name = String(body.name || '').trim();
  const acronym = String(body.acronym || name).trim();
  const fullName = String(body.fullName || name).trim();
  const rawSlug = String(body.slug || slugify(name || acronym));
  const slug = slugify(rawSlug);
  const category = String(body.category || 'Combustion').trim();
  const shortDescription = String(body.shortDescription || '').trim();
  const summary = String(body.summary || body.fullDescription || '').trim();

  if (name.length < 2 || !slug || shortDescription.length < 5) {
    throw new HttpError(
      400,
      'Validation failed: name, slug, and shortDescription (min 5 chars) are required.'
    );
  }

  const existingSlug = db
    .prepare('SELECT id FROM experiments WHERE LOWER(slug) = ? LIMIT 1')
    .get(slug) as { id: string } | undefined;
  if (existingSlug) {
    throw new HttpError(409, `An experiment with slug '${slug}' already exists.`);
  }

  const verificationStatus: VerificationStatus = VALID_VERIFICATION.includes(
    body.verificationStatus as VerificationStatus
  )
    ? (body.verificationStatus as VerificationStatus)
    : 'DEMO';

  const contentSourceType: ContentSourceType =
    verificationStatus === 'DEMO'
      ? 'ILLUSTRATIVE_DEMO'
      : verificationStatus === 'PENDING'
        ? 'PENDING_ACQUISITION'
        : ((String(body.contentSourceType || 'ADMIN_ENTRY') as ContentSourceType));

  const fuelType: FuelTypeId = VALID_FUELS.includes(body.fuelType as FuelTypeId)
    ? (body.fuelType as FuelTypeId)
    : 'solid-fabric';

  const pillarRaw = String(body.pillar || 'prevention');
  const pillar = ['prevention', 'detection', 'suppression'].includes(pillarRaw)
    ? pillarRaw
    : 'prevention';

  const year = Number(body.year) || new Date().getFullYear();
  const startDate = body.startDate ? String(body.startDate) : null;
  const endDate = body.endDate ? String(body.endDate) : null;
  const image = String(body.image || '/images/orbital_planet_backdrop_1794638817321.jpg').trim();

  const o2Min = Number(body.oxygenMin ?? 21);
  const o2Max = Number(body.oxygenMax ?? 30);
  const psiMin = Number(body.pressureMin ?? 10.2);
  const psiMax = Number(body.pressureMax ?? 14.7);
  const flowMin = Number(body.airflowMin ?? 0);
  const flowMax = Number(body.airflowMax ?? 20);

  const objectives = Array.isArray(body.scientificObjectives)
    ? body.scientificObjectives.map((s) => String(s).trim()).filter(Boolean)
    : typeof body.scientificObjectives === 'string'
      ? body.scientificObjectives
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  const criteria = {
    crewSafetyDirectness: Math.min(100, Math.max(0, Number(body.crewSafetyDirectness ?? 65))),
    habitatApplicability: Math.min(100, Math.max(0, Number(body.habitatApplicability ?? 65))),
    telemetryFidelity: Math.min(100, Math.max(0, Number(body.telemetryFidelity ?? 55))),
    materialBreadth: Math.min(100, Math.max(0, Number(body.materialBreadth ?? 55))),
    hardwareHeritage: Math.min(100, Math.max(0, Number(body.hardwareHeritage ?? 50))),
    recency: Math.min(100, Math.max(0, Number(body.recency ?? 85))),
  };
  const relevanceScore = computeCrewSafetyRelevance(criteria);

  const id = slug;
  const nowIso = new Date().toISOString();

  db.exec('BEGIN');
  try {
    db.prepare(
      `INSERT INTO experiments (
        id, slug, name, acronym, full_name, category, pillar, combustion_type,
        fuel_type, fuel_class, research_platform, hardware, gravity, year,
        start_date, end_date, image, short_description, overview,
        scientific_objectives_json, research_background, experimental_setup,
        combustion_characteristics, why_it_matters, related_slugs_json,
        verification_status, content_source_type, is_demo, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      slug,
      name,
      acronym,
      fullName,
      category,
      pillar,
      String(body.combustionType || 'Microgravity Combustion Campaign'),
      fuelType,
      String(body.fuelClass || 'Spacecraft Test Materials'),
      String(body.researchPlatform || 'International Space Station / Research Chamber'),
      String(body.hardware || 'Modular Microgravity Test Hardware'),
      String(body.gravity || 'microgravity (~10⁻⁶ g)'),
      year,
      startDate,
      endDate,
      image,
      shortDescription,
      summary || shortDescription,
      JSON.stringify(objectives),
      String(body.researchBackground || ''),
      String(body.experimentalSetup || ''),
      String(body.combustionCharacteristics || ''),
      String(body.whyItMatters || shortDescription),
      '[]',
      verificationStatus,
      contentSourceType,
      verificationStatus === 'DEMO' ? 1 : 0,
      nowIso,
      nowIso
    );

    db.prepare(
      `INSERT INTO experiment_parameters (
        experiment_id, oxygen_min, oxygen_max, pressure_min, pressure_max,
        airflow_min, airflow_max, parameter_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      o2Min,
      o2Max,
      psiMin,
      psiMax,
      flowMin,
      flowMax,
      String(body.parameterNotes || 'Database-managed experiment operating envelope.')
    );

    db.prepare(
      `INSERT INTO experiment_rankings (
        experiment_id, crew_safety_directness, habitat_applicability, telemetry_fidelity,
        material_breadth, hardware_heritage, recency, computed_relevance_score, rank_position,
        methodology_version, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      criteria.crewSafetyDirectness,
      criteria.habitatApplicability,
      criteria.telemetryFidelity,
      criteria.materialBreadth,
      criteria.hardwareHeritage,
      criteria.recency,
      relevanceScore,
      99,
      'NASA-Weighted-v1.0',
      nowIso
    );

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  getComputedRankings();
  return getExperimentBySlug(slug);
}

export function updateAdminExperiment(idOrSlug: string, body: Record<string, unknown>) {
  const db = getDb();
  const normalized = String(idOrSlug || '').trim().toLowerCase();
  const existing = db
    .prepare('SELECT * FROM experiments WHERE LOWER(id) = ? OR LOWER(slug) = ? LIMIT 1')
    .get(normalized, normalized) as Record<string, unknown> | undefined;

  if (!existing) {
    throw new HttpError(404, `Experiment '${idOrSlug}' not found.`);
  }

  const expId = String(existing.id);
  const nowIso = new Date().toISOString();

  const verificationStatus = VALID_VERIFICATION.includes(
    body.verificationStatus as VerificationStatus
  )
    ? (body.verificationStatus as VerificationStatus)
    : (String(existing.verification_status) as VerificationStatus);

  const contentSourceType = body.contentSourceType
    ? String(body.contentSourceType)
    : verificationStatus === 'DEMO'
      ? 'ILLUSTRATIVE_DEMO'
      : String(existing.content_source_type);

  const objectivesJson =
    body.scientificObjectives !== undefined
      ? JSON.stringify(
          Array.isArray(body.scientificObjectives)
            ? body.scientificObjectives.map((s) => String(s).trim()).filter(Boolean)
            : String(body.scientificObjectives)
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean)
        )
      : String(existing.scientific_objectives_json);

  const strOr = (val: unknown, fallback: unknown) =>
    val !== undefined ? String(val).trim() : fallback == null ? '' : String(fallback);
  const nullableStrOr = (val: unknown, fallback: unknown) =>
    val !== undefined ? (val ? String(val) : null) : fallback == null ? null : String(fallback);
  const numOr = (val: unknown, fallback: unknown) =>
    val !== undefined ? Number(val) : Number(fallback ?? 0);

  db.prepare(
    `UPDATE experiments SET
      name = ?,
      acronym = ?,
      full_name = ?,
      category = ?,
      combustion_type = ?,
      fuel_class = ?,
      research_platform = ?,
      hardware = ?,
      year = ?,
      start_date = ?,
      end_date = ?,
      image = ?,
      short_description = ?,
      overview = ?,
      scientific_objectives_json = ?,
      research_background = ?,
      experimental_setup = ?,
      combustion_characteristics = ?,
      why_it_matters = ?,
      verification_status = ?,
      content_source_type = ?,
      is_demo = ?,
      updated_at = ?
     WHERE id = ?`
  ).run(
    strOr(body.name, existing.name),
    strOr(body.acronym, existing.acronym),
    strOr(body.fullName, existing.full_name),
    strOr(body.category, existing.category),
    strOr(body.combustionType, existing.combustion_type),
    strOr(body.fuelClass, existing.fuel_class),
    strOr(body.researchPlatform, existing.research_platform),
    strOr(body.hardware, existing.hardware),
    numOr(body.year, existing.year),
    nullableStrOr(body.startDate, existing.start_date),
    nullableStrOr(body.endDate, existing.end_date),
    strOr(body.image, existing.image),
    strOr(body.shortDescription, existing.short_description),
    strOr(body.summary, existing.overview),
    objectivesJson,
    body.researchBackground !== undefined ? String(body.researchBackground) : String(existing.research_background ?? ''),
    body.experimentalSetup !== undefined ? String(body.experimentalSetup) : String(existing.experimental_setup ?? ''),
    body.combustionCharacteristics !== undefined
      ? String(body.combustionCharacteristics)
      : String(existing.combustion_characteristics ?? ''),
    body.whyItMatters !== undefined ? String(body.whyItMatters) : String(existing.why_it_matters ?? ''),
    verificationStatus,
    contentSourceType,
    verificationStatus === 'DEMO' ? 1 : 0,
    nowIso,
    expId
  );

  if (
    body.crewSafetyDirectness !== undefined ||
    body.habitatApplicability !== undefined ||
    body.telemetryFidelity !== undefined ||
    body.materialBreadth !== undefined ||
    body.hardwareHeritage !== undefined ||
    body.recency !== undefined
  ) {
    const rankRow = db
      .prepare('SELECT * FROM experiment_rankings WHERE experiment_id = ? LIMIT 1')
      .get(expId) as Record<string, number> | undefined;
    if (rankRow) {
      const criteria = {
        crewSafetyDirectness: Number(body.crewSafetyDirectness ?? rankRow.crew_safety_directness),
        habitatApplicability: Number(body.habitatApplicability ?? rankRow.habitat_applicability),
        telemetryFidelity: Number(body.telemetryFidelity ?? rankRow.telemetry_fidelity),
        materialBreadth: Number(body.materialBreadth ?? rankRow.material_breadth),
        hardwareHeritage: Number(body.hardwareHeritage ?? rankRow.hardware_heritage),
        recency: Number(body.recency ?? rankRow.recency),
      };
      const score = computeCrewSafetyRelevance(criteria);
      db.prepare(
        `UPDATE experiment_rankings SET
          crew_safety_directness = ?, habitat_applicability = ?, telemetry_fidelity = ?,
          material_breadth = ?, hardware_heritage = ?, recency = ?,
          computed_relevance_score = ?, updated_at = ?
         WHERE experiment_id = ?`
      ).run(
        criteria.crewSafetyDirectness,
        criteria.habitatApplicability,
        criteria.telemetryFidelity,
        criteria.materialBreadth,
        criteria.hardwareHeritage,
        criteria.recency,
        score,
        nowIso,
        expId
      );
    }
  }

  getComputedRankings();
  return getExperimentBySlug(String(existing.slug));
}

export function deleteAdminExperiment(idOrSlug: string) {
  const db = getDb();
  const normalized = String(idOrSlug || '').trim().toLowerCase();
  const row = db
    .prepare('SELECT id, slug, name FROM experiments WHERE LOWER(id) = ? OR LOWER(slug) = ? LIMIT 1')
    .get(normalized, normalized) as { id: string; slug: string; name: string } | undefined;

  if (!row) {
    throw new HttpError(404, `Experiment '${idOrSlug}' not found.`);
  }

  db.prepare('DELETE FROM experiments WHERE id = ?').run(row.id);
  getComputedRankings();
  return { deleted: true, id: row.id, slug: row.slug, name: row.name };
}

export function addAdminParameter(idOrSlug: string, body: Record<string, unknown>) {
  const db = getDb();
  const normalized = String(idOrSlug || '').trim().toLowerCase();
  const exp = db
    .prepare('SELECT id, slug, verification_status FROM experiments WHERE LOWER(id) = ? OR LOWER(slug) = ? LIMIT 1')
    .get(normalized, normalized) as { id: string; slug: string; verification_status: string } | undefined;

  if (!exp) throw new HttpError(404, `Experiment '${idOrSlug}' not found.`);

  const name = String(body.name || '').trim();
  const value = String(body.value || '').trim();
  if (!name || !value) {
    throw new HttpError(400, 'Parameter name and value are required.');
  }

  const paramId = `prm-${crypto.randomUUID().slice(0, 8)}`;
  const nowIso = new Date().toISOString();
  const countRow = db
    .prepare('SELECT COALESCE(MAX(sort_order), 0) as max_ord FROM experiment_dynamic_parameters WHERE experiment_id = ?')
    .get(exp.id) as { max_ord: number };

  const minVal = body.minValue !== undefined && body.minValue !== '' && body.minValue !== null ? Number(body.minValue) : null;
  const maxVal = body.maxValue !== undefined && body.maxValue !== '' && body.maxValue !== null ? Number(body.maxValue) : null;
  const verStatus: VerificationStatus = VALID_VERIFICATION.includes(body.verificationStatus as VerificationStatus)
    ? (body.verificationStatus as VerificationStatus)
    : (exp.verification_status as VerificationStatus);

  db.prepare(
    `INSERT INTO experiment_dynamic_parameters (
      id, experiment_id, param_name, param_description, param_value, unit,
      min_value, max_value, data_type, measurement_source, availability_status,
      verification_status, sort_order, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    paramId,
    exp.id,
    name,
    String(body.description || name),
    value,
    String(body.unit || ''),
    Number.isFinite(minVal) ? minVal : null,
    Number.isFinite(maxVal) ? maxVal : null,
    (String(body.dataType || 'string') as ParameterDataType),
    String(body.measurementSource || 'Administrative Entry'),
    (String(body.availabilityStatus || 'AVAILABLE') as ParameterAvailability),
    verStatus,
    (countRow?.max_ord || 0) + 1,
    nowIso
  );

  db.prepare('UPDATE experiments SET updated_at = ? WHERE id = ?').run(nowIso, exp.id);
  return getExperimentBySlug(exp.slug);
}

export function addOrUpdateAdminFinding(idOrSlug: string, body: Record<string, unknown>) {
  const db = getDb();
  const normalized = String(idOrSlug || '').trim().toLowerCase();
  const exp = db
    .prepare('SELECT id, slug, verification_status FROM experiments WHERE LOWER(id) = ? OR LOWER(slug) = ? LIMIT 1')
    .get(normalized, normalized) as { id: string; slug: string; verification_status: string } | undefined;

  if (!exp) throw new HttpError(404, `Experiment '${idOrSlug}' not found.`);

  const text = String(body.text || '').trim();
  if (text.length < 5) {
    throw new HttpError(400, 'Finding text must be at least 5 characters.');
  }

  const verStatus: VerificationStatus = VALID_VERIFICATION.includes(body.verificationStatus as VerificationStatus)
    ? (body.verificationStatus as VerificationStatus)
    : (exp.verification_status as VerificationStatus);
  const title = String(body.title || text.split('.')[0].slice(0, 64)).trim();
  const sourceLabel = String(
    body.sourceLabel || (verStatus === 'DEMO' ? 'Illustrative Demo Finding (Non-NASA)' : 'Research Documentation')
  ).trim();
  const nowIso = new Date().toISOString();

  if (body.findingId) {
    db.prepare(
      `UPDATE experiment_findings
       SET finding_title = ?, finding_text = ?, verification_status = ?, source_label = ?
       WHERE id = ? AND experiment_id = ?`
    ).run(title, text, verStatus, sourceLabel, Number(body.findingId), exp.id);
  } else {
    const maxRow = db
      .prepare('SELECT COALESCE(MAX(finding_order), 0) as max_ord FROM experiment_findings WHERE experiment_id = ?')
      .get(exp.id) as { max_ord: number };

    db.prepare(
      `INSERT INTO experiment_findings (
        experiment_id, finding_order, finding_title, finding_text, verification_status, source_label, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(exp.id, (maxRow?.max_ord || 0) + 1, title, text, verStatus, sourceLabel, nowIso);
  }

  db.prepare('UPDATE experiments SET updated_at = ? WHERE id = ?').run(nowIso, exp.id);
  return getExperimentBySlug(exp.slug);
}

export function registerAdminDataset(idOrSlug: string, body: Record<string, unknown>) {
  const db = getDb();
  const normalized = String(idOrSlug || '').trim().toLowerCase();
  const exp = db
    .prepare('SELECT id, slug, verification_status FROM experiments WHERE LOWER(id) = ? OR LOWER(slug) = ? LIMIT 1')
    .get(normalized, normalized) as { id: string; slug: string; verification_status: string } | undefined;

  if (!exp) throw new HttpError(404, `Experiment '${idOrSlug}' not found.`);

  const datasetName = String(body.datasetName || '').trim();
  if (!datasetName) {
    throw new HttpError(400, 'datasetName is required.');
  }

  const csvContent = String(body.csvContent || '').trim();
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  const headers = lines.length > 0 ? lines[0].split(',').map((h) => h.trim()) : [];
  const rowCount = Math.max(0, lines.length - 1);
  const sampleCount = Number(body.sampleCount ?? rowCount);

  const variables: DatasetVariableMeta[] = Array.isArray(body.variables)
    ? (body.variables as DatasetVariableMeta[])
    : headers.map((h) => ({
        name: h,
        unit: '',
        description: h.replace(/_/g, ' '),
        dataType: 'number',
      }));

  const verStatus: VerificationStatus = VALID_VERIFICATION.includes(body.verificationStatus as VerificationStatus)
    ? (body.verificationStatus as VerificationStatus)
    : (exp.verification_status as VerificationStatus);

  const datasetStatus: DatasetStatus = body.datasetStatus
    ? (String(body.datasetStatus) as DatasetStatus)
    : !csvContent
      ? 'UNAVAILABLE'
      : verStatus === 'DEMO'
        ? 'DEMO_ONLY'
        : 'AVAILABLE';

  const dsId = `ds-${crypto.randomUUID().slice(0, 8)}`;
  const nowIso = new Date().toISOString();

  // Strictly block claiming unauthorized official NASA downloads when adding illustrative CSVs
  const downloadAuthorized = verStatus === 'DEMO' && csvContent.length > 0 ? 1 : Number(Boolean(body.downloadAuthorized));

  db.prepare(
    `INSERT INTO experiment_datasets (
      id, experiment_id, dataset_name, description, file_format, sample_count,
      variables_json, source_name, source_url, ntrs_id, dataset_status,
      verification_status, download_authorized, csv_content, scatter_json,
      citations_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    dsId,
    exp.id,
    datasetName,
    String(body.description || 'Registered experimental dataset record.'),
    String(body.fileFormat || (csvContent ? 'CSV' : 'Unavailable')),
    sampleCount,
    JSON.stringify(variables),
    String(
      body.sourceName ||
        (verStatus === 'DEMO'
          ? 'Illustrative Demo Data — Not NASA Experimental Measurements'
          : 'Research Repository')
    ),
    String(body.sourceUrl || ''),
    String(body.ntrsId || (verStatus === 'DEMO' ? 'DEMO-ONLY' : 'PENDING')),
    datasetStatus,
    verStatus,
    downloadAuthorized,
    csvContent,
    '[]',
    '[]',
    nowIso,
    nowIso
  );

  db.prepare('UPDATE experiments SET updated_at = ? WHERE id = ?').run(nowIso, exp.id);
  return getExperimentBySlug(exp.slug);
}

export function addAdminReference(idOrSlug: string, body: Record<string, unknown>) {
  const db = getDb();
  const normalized = String(idOrSlug || '').trim().toLowerCase();
  const exp = db
    .prepare('SELECT id, slug, verification_status FROM experiments WHERE LOWER(id) = ? OR LOWER(slug) = ? LIMIT 1')
    .get(normalized, normalized) as { id: string; slug: string; verification_status: string } | undefined;

  if (!exp) throw new HttpError(404, `Experiment '${idOrSlug}' not found.`);

  const title = String(body.title || '').trim();
  const url = String(body.url || '').trim();
  if (!title || !url) {
    throw new HttpError(400, 'Reference title and url are required.');
  }

  const refId = `ref-${crypto.randomUUID().slice(0, 8)}`;
  const verStatus: VerificationStatus = VALID_VERIFICATION.includes(body.verificationStatus as VerificationStatus)
    ? (body.verificationStatus as VerificationStatus)
    : (exp.verification_status as VerificationStatus);

  db.prepare(
    `INSERT INTO experiment_references (
      id, experiment_id, title, authors, publication_year, document_id,
      page_ref, url, source_type, verification_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    refId,
    exp.id,
    title,
    String(body.authors || 'Research Team'),
    Number(body.publicationYear || new Date().getFullYear()),
    String(body.documentId || 'REF'),
    String(body.pageRef || 'Full Document'),
    url,
    String(body.sourceType || (verStatus === 'DEMO' ? 'ILLUSTRATIVE_DEMO' : 'NASA_NTRS')),
    verStatus
  );

  db.prepare('UPDATE experiments SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), exp.id);
  return getExperimentBySlug(exp.slug);
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
