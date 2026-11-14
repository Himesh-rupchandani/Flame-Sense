import crypto from 'crypto';
import PDFDocument from 'pdfkit';
import type express from 'express';
import { getDb } from '../database.ts';
import { FUEL_TYPES } from '../../src/data/nasaExperiments.ts';
import type {
  CombustionCompatibilityReport,
  CombustionVariableMatch,
  DataLabAnalyzeResponse,
  DataLabColumnStat,
  DataLabColumnType,
  DataLabCorrelationPair,
  DataLabDatasetDetail,
  DataLabDatasetSummary,
  DataLabHistogramBin,
  DataLabValueCount,
  FuelTypeId,
} from '../../src/types/experiments.ts';
import { evaluateCombustionModel } from './predictionService.ts';

export const MAX_CSV_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_CSV_ROWS = 25000;
export const MAX_CSV_COLUMNS = 100;
const RETENTION_HOURS = 24;

export class DataLabError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function getSessionSecret(): string {
  return process.env.DATALAB_SESSION_SECRET || process.env.ADMIN_TOKEN_SECRET || 'flame-datalab-session-secret-2026';
}

export function issueDataLabSessionToken(): { sessionToken: string; expiresAt: string } {
  const id = crypto.randomUUID();
  const expiresAtMs = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ id, exp: expiresAtMs })).toString('base64url');
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
  return {
    sessionToken: `dl_${payload}.${sig}`,
    expiresAt: new Date(expiresAtMs).toISOString(),
  };
}

export function hashSessionKey(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function extractDataLabSession(req: express.Request): string {
  const headerToken = String(req.headers['x-datalab-session'] || '').trim();
  const queryToken = String(req.query.session || '').trim();
  const raw = headerToken || queryToken;

  if (!raw || raw.length < 12 || raw.length > 512) {
    throw new DataLabError(
      401,
      'Data Lab session token is required (x-datalab-session header). Please initialize a session first.'
    );
  }

  // If formatted as signed dl_ token, validate signature & expiry
  if (raw.startsWith('dl_')) {
    const body = raw.slice(3);
    const parts = body.split('.');
    if (parts.length !== 2) {
      throw new DataLabError(401, 'Malformed Data Lab session token.');
    }
    const [payload, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
    if (
      sig.length !== expectedSig.length ||
      !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))
    ) {
      throw new DataLabError(401, 'Invalid Data Lab session signature.');
    }
    try {
      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: number };
      if (!decoded.exp || decoded.exp <= Date.now()) {
        throw new DataLabError(401, 'Data Lab session has expired.');
      }
    } catch (err) {
      if (err instanceof DataLabError) throw err;
      throw new DataLabError(401, 'Corrupt Data Lab session payload.');
    }
  }

  return hashSessionKey(raw);
}

export function purgeExpiredDataLabDatasets() {
  const db = getDb();
  const nowIso = new Date().toISOString();
  db.prepare('DELETE FROM data_lab_datasets WHERE expires_at <= ?').run(nowIso);
}

export function decodeCsvBuffer(buffer: Buffer): string {
  if (!buffer || buffer.length === 0) return '';
  // UTF-16LE BOM (FF FE)
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.subarray(2).toString('utf16le');
  }
  // UTF-16BE BOM (FE FF) -> swap bytes into LE copy
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    const swapped = Buffer.allocUnsafe(buffer.length - 2);
    for (let i = 2; i + 1 < buffer.length; i += 2) {
      swapped[i - 2] = buffer[i + 1];
      swapped[i - 1] = buffer[i];
    }
    return swapped.toString('utf16le');
  }
  // UTF-8 BOM (EF BB BF)
  const utf8Start =
    buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf ? 3 : 0;
  const utf8Text = buffer.subarray(utf8Start).toString('utf8');
  // Fallback to latin1 if invalid UTF-8 sequences produced U+FFFD replacement characters
  if (utf8Text.includes('\uFFFD')) {
    return buffer.subarray(utf8Start).toString('latin1');
  }
  return utf8Text;
}

function isMissingCell(raw: string | undefined): boolean {
  if (raw === undefined || raw === null) return true;
  const trimmed = raw.trim().toLowerCase();
  return (
    trimmed === '' ||
    trimmed === 'null' ||
    trimmed === 'na' ||
    trimmed === 'n/a' ||
    trimmed === 'n/d' ||
    trimmed === 'nd' ||
    trimmed === 'nan' ||
    trimmed === 'none' ||
    trimmed === '-' ||
    trimmed === '--'
  );
}

function detectDelimiter(sampleText: string): ',' | ';' | '\t' {
  const lines = sampleText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'))
    .slice(0, 8);
  if (lines.length === 0) return ',';

  const countDelimOutsideQuotes = (line: string, delim: string): number => {
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === delim && !inQuotes) count += 1;
    }
    return count;
  };

  const candidates: Array<',' | ';' | '\t'> = [',', ';', '\t'];
  let best: ',' | ';' | '\t' = ',';
  let bestScore = -1;

  for (const d of candidates) {
    const counts = lines.map((l) => countDelimOutsideQuotes(l, d));
    const headerCount = counts[0] || 0;
    if (headerCount === 0) continue;
    const consistentRows = counts.filter((c) => c === headerCount).length;
    const score = headerCount * 10 + consistentRows * 20 + (d === ',' ? 5 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

function parseStrictCsvTable(rawText: string): { headers: string[]; rows: string[][] } {
  const normalized = rawText.replace(/^\uFEFF/, ''); // Strip UTF-8 BOM if present
  if (!normalized.trim()) {
    throw new DataLabError(400, 'Uploaded CSV file is empty.');
  }
  if (normalized.includes('\u0000')) {
    throw new DataLabError(415, 'File appears to contain binary null bytes and is not valid text CSV.');
  }

  // Reject HTML/XML masquerading as CSV
  const firstNonEmpty = normalized.trimStart().slice(0, 64).toLowerCase();
  if (
    firstNonEmpty.startsWith('<!doctype') ||
    firstNonEmpty.startsWith('<html') ||
    firstNonEmpty.startsWith('<?xml')
  ) {
    throw new DataLabError(400, 'Uploaded file contains HTML/XML markup instead of CSV tabular data.');
  }

  const delimiter = detectDelimiter(normalized);
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i += 1) {
    const ch = normalized[i];
    if (ch === '"') {
      if (inQuotes && normalized[i + 1] === '"') {
        currentCell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && normalized[i + 1] === '\n') {
        i += 1;
      }
      currentRow.push(currentCell.trim());
      const nonEmptyRow = currentRow.some((c) => c.length > 0);
      const isCommentLine = rows.length === 0 && (currentRow[0] || '').trimStart().startsWith('#');
      if (nonEmptyRow && !isCommentLine) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += ch;
    }
  }

  if (inQuotes) {
    throw new DataLabError(400, 'Malformed CSV: unclosed quotation mark detected.');
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    const nonEmptyRow = currentRow.some((c) => c.length > 0);
    const isCommentLine = rows.length === 0 && (currentRow[0] || '').trimStart().startsWith('#');
    if (nonEmptyRow && !isCommentLine) {
      rows.push(currentRow);
    }
  }

  if (rows.length < 2) {
    throw new DataLabError(
      400,
      'CSV must include a header row and at least 1 data row.'
    );
  }

  const rawHeaders = [...rows[0]];
  // Trim trailing empty header cell caused by trailing delimiter (e.g. "col1,col2,")
  while (rawHeaders.length > 1 && rawHeaders[rawHeaders.length - 1].trim() === '') {
    const trailingIdx = rawHeaders.length - 1;
    const anyTrailingData = rows.slice(1).some((r) => (r[trailingIdx] || '').trim() !== '');
    if (anyTrailingData) break;
    rawHeaders.pop();
  }

  if (rawHeaders.length < 1 || rawHeaders.length > MAX_CSV_COLUMNS) {
    throw new DataLabError(
      400,
      `CSV column count (${rawHeaders.length}) must be between 1 and ${MAX_CSV_COLUMNS}.`
    );
  }

  if (rawHeaders.every((h) => !h || h.trim().length === 0)) {
    throw new DataLabError(400, 'Malformed CSV header: all column names are empty.');
  }

  const seenHeaders = new Map<string, number>();
  const headers = rawHeaders.map((h, idx) => {
    const base = h.trim() || `Column_${idx + 1}`;
    const key = base.toLowerCase();
    const count = seenHeaders.get(key) || 0;
    seenHeaders.set(key, count + 1);
    return count === 0 ? base : `${base} (${count + 1})`;
  });

  const dataRows = rows.slice(1);
  if (dataRows.length > MAX_CSV_ROWS) {
    throw new DataLabError(
      400,
      `Dataset exceeds maximum supported limit of ${MAX_CSV_ROWS.toLocaleString()} rows.`
    );
  }

  return { headers, rows: dataRows };
}

function parseTypedValue(raw: string | undefined): {
  value: string | number | null;
  kind: 'null' | 'number' | 'boolean' | 'date' | 'string';
} {
  if (isMissingCell(raw)) return { value: null, kind: 'null' };
  const s = String(raw).trim();

  // Numeric check (strict)
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) return { value: n, kind: 'number' };
  }

  // Boolean check
  const low = s.toLowerCase();
  if (low === 'true' || low === 'false') {
    return { value: s, kind: 'boolean' };
  }

  // ISO-like Date check (YYYY-MM-DD or YYYY/MM/DD or ISO timestamp)
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(s) && !Number.isNaN(Date.parse(s))) {
    return { value: s, kind: 'date' };
  }

  return { value: s, kind: 'string' };
}

function computeMedian(sortedNums: number[]): number | null {
  if (sortedNums.length === 0) return null;
  const mid = Math.floor(sortedNums.length / 2);
  if (sortedNums.length % 2 === 0) {
    return Number(((sortedNums[mid - 1] + sortedNums[mid]) / 2).toFixed(4));
  }
  return Number(sortedNums[mid].toFixed(4));
}

function buildHistogram(nums: number[]): DataLabHistogramBin[] {
  if (nums.length === 0) return [];
  let minV = nums[0];
  let maxV = nums[0];
  for (let i = 1; i < nums.length; i += 1) {
    if (nums[i] < minV) minV = nums[i];
    if (nums[i] > maxV) maxV = nums[i];
  }
  if (minV === maxV) {
    return [{ label: String(Number(minV.toFixed(2))), count: nums.length }];
  }
  const binCount = Math.min(8, Math.max(4, Math.ceil(Math.sqrt(nums.length))));
  const span = maxV - minV;
  const width = span / binCount;
  const bins = Array.from({ length: binCount }, (_, i) => ({
    label: `${(minV + i * width).toFixed(1)}–${(minV + (i + 1) * width).toFixed(1)}`,
    count: 0,
  }));
  for (const v of nums) {
    const idx = Math.min(binCount - 1, Math.floor(((v - minV) / span) * binCount));
    bins[idx].count += 1;
  }
  return bins;
}

function normalizeFuelString(raw: unknown): FuelTypeId | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  if (
    s === 'solid-fabric' ||
    s.includes('fabric') ||
    s.includes('cotton') ||
    s.includes('nomex') ||
    s.includes('sibal') ||
    s.includes('fiberglass') ||
    s.includes('kimwipe') ||
    s.includes('paper') ||
    s.includes('cellulos') ||
    s.includes('textile')
  ) {
    return 'solid-fabric';
  }
  if (
    s === 'plastic' ||
    s.includes('plastic') ||
    s.includes('pmma') ||
    s.includes('ultem') ||
    s.includes('acrylic') ||
    s.includes('polycarbonate') ||
    s.includes('kapton') ||
    s.includes('teflon') ||
    s.includes('hdpe') ||
    s.includes('ldpe') ||
    s.includes('polymer') ||
    s.includes('poly')
  ) {
    return 'plastic';
  }
  if (
    s === 'liquid' ||
    s.includes('liquid') ||
    s.includes('heptane') ||
    s.includes('alkane') ||
    s.includes('octane') ||
    s.includes('dodecane') ||
    s.includes('methanol') ||
    s.includes('ethanol') ||
    s.includes('alcohol') ||
    s.includes('fuel')
  ) {
    return 'liquid';
  }
  if (
    s === 'gas' ||
    s.includes('gas') ||
    s.includes('methane') ||
    s.includes('ethylene') ||
    s.includes('ethane') ||
    s.includes('propane') ||
    s.includes('hydrogen')
  ) {
    return 'gas';
  }
  return null;
}

function inspectCsvFull(headers: string[], rawRows: string[][]) {
  const totalRows = rawRows.length;
  const typedRecords: Array<Array<string | number | null>> = [];
  const rowSignatures = new Map<string, number>();
  let duplicateRowCount = 0;

  for (const rawRow of rawRows) {
    const parsedRow: Array<string | number | null> = headers.map((_, colIdx) => {
      const parsed = parseTypedValue(rawRow[colIdx]);
      return parsed.value;
    });
    typedRecords.push(parsedRow);

    const sig = JSON.stringify(parsedRow);
    const prev = rowSignatures.get(sig) || 0;
    if (prev >= 1) {
      duplicateRowCount += 1;
    }
    rowSignatures.set(sig, prev + 1);
  }

  const columnStats: DataLabColumnStat[] = headers.map((colName, colIdx) => {
    let missingCount = 0;
    const numericVals: number[] = [];
    const boolVals: number[] = [];
    const dateVals: number[] = [];
    const freqMap = new Map<string, number>();

    for (let rIdx = 0; rIdx < rawRows.length; rIdx += 1) {
      const parsed = parseTypedValue(rawRows[rIdx][colIdx]);
      if (parsed.kind === 'null') {
        missingCount += 1;
      } else {
        const keyStr = String(parsed.value);
        freqMap.set(keyStr, (freqMap.get(keyStr) || 0) + 1);
        if (parsed.kind === 'number' && typeof parsed.value === 'number') {
          numericVals.push(parsed.value);
        } else if (parsed.kind === 'boolean') {
          boolVals.push(1);
        } else if (parsed.kind === 'date') {
          dateVals.push(1);
        }
      }
    }

    const nonNullCount = totalRows - missingCount;
    let dataType: DataLabColumnType = 'string';
    if (nonNullCount > 0 && numericVals.length >= Math.max(1, Math.ceil(nonNullCount * 0.7))) {
      dataType = 'number';
    } else if (nonNullCount > 0 && boolVals.length === nonNullCount) {
      dataType = 'boolean';
    } else if (nonNullCount > 0 && dateVals.length >= Math.max(1, Math.ceil(nonNullCount * 0.8))) {
      dataType = 'date';
    }

    let min: number | null = null;
    let max: number | null = null;
    let mean: number | null = null;
    let median: number | null = null;
    let stdDev: number | null = null;
    let histogram: DataLabHistogramBin[] = [];

    if (dataType === 'number' && numericVals.length > 0) {
      const sorted = [...numericVals].sort((a, b) => a - b);
      min = Number(sorted[0].toFixed(4));
      max = Number(sorted[sorted.length - 1].toFixed(4));
      const sum = numericVals.reduce((acc, v) => acc + v, 0);
      const avg = sum / numericVals.length;
      mean = Number(avg.toFixed(4));
      median = computeMedian(sorted);
      const variance = numericVals.reduce((acc, v) => acc + (v - avg) ** 2, 0) / numericVals.length;
      stdDev = Number(Math.sqrt(variance).toFixed(4));
      histogram = buildHistogram(numericVals);
    }

    const topValues: DataLabValueCount[] = Array.from(freqMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([value, count]) => ({ value, count }));

    return {
      name: colName,
      dataType,
      totalCount: totalRows,
      nonNullCount,
      missingCount,
      missingPct: totalRows > 0 ? Number(((missingCount / totalRows) * 100).toFixed(1)) : 0,
      uniqueCount: freqMap.size,
      min,
      max,
      mean,
      median,
      stdDev,
      histogram,
      topValues,
    };
  });

  // Compute pairwise Pearson correlations across numeric columns (capped at 15 numeric columns)
  const numericIndices = columnStats
    .map((c, idx) => (c.dataType === 'number' && c.nonNullCount >= 2 ? idx : -1))
    .filter((idx) => idx !== -1)
    .slice(0, 15);

  const correlations: DataLabCorrelationPair[] = [];
  for (let i = 0; i < numericIndices.length; i += 1) {
    for (let j = i + 1; j < numericIndices.length; j += 1) {
      const idxA = numericIndices[i];
      const idxB = numericIndices[j];
      const pairs: Array<[number, number]> = [];
      for (const row of typedRecords) {
        const a = row[idxA];
        const b = row[idxB];
        if (typeof a === 'number' && typeof b === 'number') {
          pairs.push([a, b]);
        }
      }
      if (pairs.length >= 2) {
        const meanA = pairs.reduce((s, p) => s + p[0], 0) / pairs.length;
        const meanB = pairs.reduce((s, p) => s + p[1], 0) / pairs.length;
        let num = 0;
        let denA = 0;
        let denB = 0;
        for (const [a, b] of pairs) {
          const da = a - meanA;
          const db = b - meanB;
          num += da * db;
          denA += da * da;
          denB += db * db;
        }
        const denom = Math.sqrt(denA * denB);
        const r = denom > 0 ? Number((num / denom).toFixed(4)) : 0;
        correlations.push({
          colA: headers[idxA],
          colB: headers[idxB],
          r,
          n: pairs.length,
        });
      }
    }
  }

  correlations.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

  const toRowObj = (row: Array<string | number | null>): Record<string, string | number | null> => {
    const obj: Record<string, string | number | null> = {};
    headers.forEach((h, i) => {
      obj[h] = row[i];
    });
    return obj;
  };

  const objectRows = typedRecords.map(toRowObj);
  const combustionCompatibility = inspectCombustionCompatibility(columnStats, objectRows);

  return {
    columns: headers,
    totalRows,
    duplicateRowCount,
    columnStats,
    correlations,
    combustionCompatibility,
    objectRows,
    previewRows: objectRows.slice(0, 50),
    chartRows: objectRows.slice(0, 300),
  };
}

interface ResolvedCombustionFactors {
  o2Col: string | null;
  o2Factor: number;
  psiCol: string | null;
  psiFactor: number;
  flowCol: string | null;
  flowFactor: number;
  fuelCol: string | null;
}

function buildCompatibilityAndFactors(
  columnStats: DataLabColumnStat[],
  rows: Array<Record<string, string | number | null>>
): { report: CombustionCompatibilityReport; factors: ResolvedCombustionFactors } {
  const lower = (s: string) => s.toLowerCase();

  // Oxygen: O2_Percent, O2 (%), O2 [pct], Oxygen Concentration, XO2, O2 Mole Fraction, etc.
  const o2Col = columnStats.find((c) => {
    const n = lower(c.name);
    if (/(co2|h2o|n2o|no2|so2|sensor|status|flag|id)/.test(n)) return false;
    return /(^|[^a-z0-9])(o2|xo2|oxygen)([^a-z0-9]|$)/.test(n) || /o2[\s_]?(pct|percent|conc|frac|vol)/.test(n);
  });

  // Pressure: Pressure_psi, Pressure (kPa), Ambient Pressure (bar/atm/Torr), Cabin_P, Chamber_P (exclude differential/delta P)
  const psiCol = columnStats.find((c) => {
    const n = lower(c.name);
    if (/(diff|delta[\s_]?p|\bdp\b|dynamic|drop|notes|id|flag)/.test(n)) return false;
    return (
      /press|psia|psig|\bpsi\b|kpa|hpa|mbar|cabin[\s_]?p|chamber[\s_]?p|amb[\s_]?p|static[\s_]?p|\bp[\s_]?(?:kpa|psi|psia|bar|atm|torr|mmhg)\b/.test(n) ||
      /^p\s*[\[(]\s*(?:psi|psia|kpa|hpa|mbar|bar|atm|torr|mmhg|pa)\s*[\])]/.test(n)
    );
  });

  // Airflow: Airflow_cm_s, Forced Flow (cm/s), Flow Velocity (m/s), Tunnel Flow (mm/s), V_air, U_inf
  // Exclude flame spread / burn rate / regression columns!
  const flowCol = columnStats.find((c) => {
    const n = lower(c.name);
    if (/(spread|flame|burn|regression|propagat|ignition|heat|notes|id)/.test(n)) return false;
    return (
      /airflow|air[\s_]?flow|forced[\s_]?flow|ventilation|air[\s_]?vel|flow[\s_]?vel|flow[\s_]?speed|flow[\s_]?rate|tunnel[\s_]?vel|tunnel[\s_]?flow|gas[\s_]?vel|blower[\s_]?vel|\bu[\s_]?(?:inf|flow)\b|\bv[\s_]?(?:air|flow)\b|velocity/.test(n) ||
      /^flow(?:_|\s|$|[\[(])/.test(n)
    );
  });

  const fuelCol = columnStats.find((c) => {
    const n = lower(c.name);
    if (/(notes|id|width|thick)/.test(n)) return false;
    return /(fuel[\s_]?type|fuel[\s_]?class|sample[\s_]?material|specimen[\s_]?material|\bmaterial\b|\bfuel\b|\bsubstrate\b|\bfabric\b|\bspecimen\b)/.test(n);
  });

  const tempCol = columnStats.find((c) => /(temp|temperature|flame[\s_]?temp|kelvin|celsius|degc)/i.test(c.name));
  const flameCol = columnStats.find((c) =>
    /(burn[\s_]?rate|flame[\s_]?speed|spread[\s_]?rate|flame[\s_]?len|heat[\s_]?flux|extinction|radiance|burn[\s_]?duration|ignition[\s_]?time|loc)/i.test(c.name)
  );

  const detectedVariables: CombustionVariableMatch[] = [];
  const missingRequiredFeatures: string[] = [];
  const warnings: string[] = [];
  const matchedColumns: NonNullable<CombustionCompatibilityReport['matchedColumns']> = [];
  const unitConversions: NonNullable<CombustionCompatibilityReport['unitConversions']> = [];
  const missingParameters: NonNullable<CombustionCompatibilityReport['missingParameters']> = [];
  const unsupportedParameters: NonNullable<CombustionCompatibilityReport['unsupportedParameters']> = [];

  const matchedColNames = new Set<string>();
  let o2Factor = 1;
  let psiFactor = 1;
  let flowFactor = 1;
  let o2CompatibleCol: string | null = null;
  let psiCompatibleCol: string | null = null;
  let flowCompatibleCol: string | null = null;
  let fuelCompatibleCol: string | null = null;

  // 1. Oxygen Concentration (% O2)
  if (!o2Col) {
    missingRequiredFeatures.push('Oxygen Concentration (% O₂)');
    missingParameters.push({
      role: 'oxygenPct',
      label: 'Oxygen Concentration',
      required: true,
      reason: 'No O₂ concentration column detected in CSV headers.',
    });
    detectedVariables.push({
      role: 'oxygenPct',
      label: 'Oxygen Concentration',
      columnName: null,
      detectedUnit: 'missing',
      targetUnit: '% O₂',
      valueOrigin: 'missing',
      conversionFormula: null,
      required: true,
      compatible: false,
      note: 'No oxygen concentration column detected.',
    });
  } else {
    matchedColNames.add(o2Col.name);
    const n = lower(o2Col.name);
    const hasExplicitFraction = /(mole[\s_]?frac|mol[\s_]?frac|mol\/mol|fraction|\bxo2\b)/.test(n);
    const hasExplicitPct = /(%|pct|percent|vol%|mol%)/.test(n);

    if (o2Col.dataType !== 'number' || o2Col.min === null || o2Col.max === null) {
      missingRequiredFeatures.push('Oxygen Concentration (numeric % O₂)');
      unsupportedParameters.push({
        columnName: o2Col.name,
        observedUnitOrType: o2Col.dataType,
        reason: `Oxygen column '${o2Col.name}' is non-numeric (${o2Col.dataType}).`,
      });
      detectedVariables.push({
        role: 'oxygenPct',
        label: 'Oxygen Concentration',
        columnName: o2Col.name,
        detectedUnit: 'non-numeric',
        targetUnit: '% O₂',
        valueOrigin: 'unsupported',
        conversionFormula: null,
        required: true,
        compatible: false,
        note: `Column '${o2Col.name}' is non-numeric and cannot map to % O₂.`,
      });
    } else if (hasExplicitFraction && o2Col.max <= 1.0 && o2Col.min >= 0) {
      o2Factor = 100;
      const convMin = Number((o2Col.min * 100).toFixed(2));
      const convMax = Number((o2Col.max * 100).toFixed(2));
      const validInRange = convMin >= 10 && convMax <= 100;
      const formula = 'mole fraction × 100 → % O₂';
      if (convMin < 21 || convMax > 85) {
        warnings.push(
          `Converted '${o2Col.name}' spans ${convMin}–${convMax}% O₂ (rows outside 21–85% will be skipped by the empirical estimator).`
        );
      }
      if (validInRange) {
        o2CompatibleCol = o2Col.name;
        matchedColumns.push({
          role: 'oxygenPct',
          label: 'Oxygen Concentration',
          columnName: o2Col.name,
          originalUnit: 'mole fraction (0–1)',
          targetUnit: '% O₂',
          valueOrigin: 'unit_converted',
        });
        unitConversions.push({
          columnName: o2Col.name,
          fromUnit: 'mole fraction (0–1)',
          toUnit: '% O₂',
          formula,
          measuredVsConvertedNote: 'Measured mole fraction mathematically scaled × 100.',
        });
      } else {
        missingRequiredFeatures.push('Oxygen Concentration (valid % O₂ range)');
      }
      detectedVariables.push({
        role: 'oxygenPct',
        label: 'Oxygen Concentration',
        columnName: o2Col.name,
        detectedUnit: 'mole fraction → % O₂',
        targetUnit: '% O₂',
        valueOrigin: validInRange ? 'unit_converted' : 'unsupported',
        conversionFormula: formula,
        required: true,
        compatible: validInRange,
        note: validInRange
          ? `Converted '${o2Col.name}' (${o2Col.min}–${o2Col.max} frac → ${convMin}–${convMax}% O₂).`
          : `Converted values (${convMin}–${convMax}%) outside plausible % O₂ range.`,
      });
    } else if (o2Col.max <= 1.0 && o2Col.min >= 0) {
      missingRequiredFeatures.push('Oxygen Concentration (% O₂ — undocumented 0–1 scale)');
      warnings.push(
        `Column '${o2Col.name}' has values 0–1 without a documented mole-fraction unit in the header; unit conversion was NOT guessed.`
      );
      unsupportedParameters.push({
        columnName: o2Col.name,
        observedUnitOrType: 'undocumented 0–1 scale',
        reason: 'Values lie in 0–1 without documented fraction/mol-fraction unit header.',
      });
      detectedVariables.push({
        role: 'oxygenPct',
        label: 'Oxygen Concentration',
        columnName: o2Col.name,
        detectedUnit: 'undocumented (0–1)',
        targetUnit: '% O₂',
        valueOrigin: 'unsupported',
        conversionFormula: null,
        required: true,
        compatible: false,
        note: 'Unit not documented as mole fraction; requires % O₂ or explicit fraction header.',
      });
    } else {
      const validInRange = o2Col.min >= 10 && o2Col.max <= 100;
      if (!hasExplicitPct && validInRange) {
        warnings.push(`Column '${o2Col.name}' omitted '%' in header; 10–100 scale interpreted as measured % O₂.`);
      }
      if (o2Col.min < 21 || o2Col.max > 85) {
        warnings.push(
          `Measured '${o2Col.name}' spans ${o2Col.min}–${o2Col.max}% O₂ (rows below 21% or above 85% are skipped by the 21–85% estimator rather than extrapolated).`
        );
      }
      if (validInRange) {
        o2CompatibleCol = o2Col.name;
        matchedColumns.push({
          role: 'oxygenPct',
          label: 'Oxygen Concentration',
          columnName: o2Col.name,
          originalUnit: '% O₂',
          targetUnit: '% O₂',
          valueOrigin: 'measured',
        });
      } else {
        missingRequiredFeatures.push('Oxygen Concentration (% O₂)');
        unsupportedParameters.push({
          columnName: o2Col.name,
          observedUnitOrType: `${o2Col.min}–${o2Col.max}`,
          reason: 'Oxygen values fall outside plausible 10–100% O₂ scale.',
        });
      }
      detectedVariables.push({
        role: 'oxygenPct',
        label: 'Oxygen Concentration',
        columnName: o2Col.name,
        detectedUnit: '% O₂',
        targetUnit: '% O₂',
        valueOrigin: validInRange ? 'measured' : 'unsupported',
        conversionFormula: null,
        required: true,
        compatible: validInRange,
        note: validInRange
          ? `Measured '${o2Col.name}' (${o2Col.min}–${o2Col.max}% O₂).`
          : `Values (${o2Col.min}–${o2Col.max}) outside plausible % O₂ range.`,
      });
    }
  }

  // 2. Cabin / Chamber Pressure (psi) — Never invent or fill constants when missing!
  if (!psiCol) {
    missingRequiredFeatures.push('Cabin Pressure (psi)');
    missingParameters.push({
      role: 'pressurePsi',
      label: 'Cabin Pressure',
      required: true,
      reason: 'No ambient or chamber pressure column present in CSV. Pressure values are never fabricated.',
    });
    detectedVariables.push({
      role: 'pressurePsi',
      label: 'Cabin Pressure',
      columnName: null,
      detectedUnit: 'missing',
      targetUnit: 'psi',
      valueOrigin: 'missing',
      conversionFormula: null,
      required: true,
      compatible: false,
      note: 'Missing from dataset — never filled with a constant pressure value.',
    });
  } else {
    matchedColNames.add(psiCol.name);
    const n = lower(psiCol.name);
    if (psiCol.dataType !== 'number' || psiCol.min === null || psiCol.max === null) {
      missingRequiredFeatures.push('Cabin Pressure (numeric psi)');
      unsupportedParameters.push({
        columnName: psiCol.name,
        observedUnitOrType: psiCol.dataType,
        reason: `Pressure column '${psiCol.name}' is non-numeric.`,
      });
      detectedVariables.push({
        role: 'pressurePsi',
        label: 'Cabin Pressure',
        columnName: psiCol.name,
        detectedUnit: 'non-numeric',
        targetUnit: 'psi',
        valueOrigin: 'unsupported',
        conversionFormula: null,
        required: true,
        compatible: false,
        note: `Column '${psiCol.name}' is non-numeric.`,
      });
    } else {
      let fromUnit: string | null = null;
      let factor = 1;
      let formula: string | null = null;
      let rejectReason: string | null = null;

      if (/(?:^|[^a-z])psig(?:[^a-z]|$)/.test(n)) {
        rejectReason = 'Gauge pressure (psig) requires ambient barometric reference to convert to psia.';
      } else if (/(?:^|[^a-z])(psia|psi)(?:[^a-z]|$)/.test(n)) {
        fromUnit = 'psi';
        factor = 1;
      } else if (/(?:^|[^a-z])kpa(?:[^a-z]|$)/.test(n)) {
        fromUnit = 'kPa';
        factor = 0.1450377377;
        formula = 'kPa × 0.145038 → psi';
      } else if (/(?:^|[^a-z])(hpa|mbar)(?:[^a-z]|$)/.test(n)) {
        fromUnit = 'hPa/mbar';
        factor = 0.01450377377;
        formula = 'hPa × 0.014504 → psi';
      } else if (/(?:^|[^a-z])bar(?:[^a-z]|$)/.test(n)) {
        fromUnit = 'bar';
        factor = 14.50377377;
        formula = 'bar × 14.503774 → psi';
      } else if (/(?:^|[^a-z])atm(?:[^a-z]|$)/.test(n)) {
        fromUnit = 'atm';
        factor = 14.6959488;
        formula = 'atm × 14.695949 → psi';
      } else if (/(?:^|[^a-z])(torr|mmhg)(?:[^a-z]|$)/.test(n)) {
        fromUnit = 'Torr/mmHg';
        factor = 0.0193367747;
        formula = 'Torr × 0.019337 → psi';
      } else if (/(?:^|[^a-z])pa(?:[^a-z]|$)/.test(n)) {
        fromUnit = 'Pa';
        factor = 0.0001450377377;
        formula = 'Pa × 0.000145 → psi';
      } else if (psiCol.min >= 4.0 && psiCol.max <= 16.0) {
        fromUnit = 'psi (undocumented header, 4–16 range)';
        factor = 1;
        warnings.push(`Column '${psiCol.name}' omitted unit in header; 4.0–16.0 scale interpreted as measured psi.`);
      } else {
        rejectReason = `Pressure column '${psiCol.name}' (${psiCol.min}–${psiCol.max}) lacks documented units (kPa, bar, atm, psi, Torr); conversion is not guessed.`;
      }

      if (rejectReason || !fromUnit) {
        missingRequiredFeatures.push('Cabin Pressure (documented psi or convertible SI unit)');
        if (rejectReason) warnings.push(rejectReason);
        unsupportedParameters.push({
          columnName: psiCol.name,
          observedUnitOrType: `${psiCol.min}–${psiCol.max} (unit undocumented/unsupported)`,
          reason: rejectReason || 'Unsupported pressure unit.',
        });
        detectedVariables.push({
          role: 'pressurePsi',
          label: 'Cabin Pressure',
          columnName: psiCol.name,
          detectedUnit: 'unsupported unit',
          targetUnit: 'psi',
          valueOrigin: 'unsupported',
          conversionFormula: null,
          required: true,
          compatible: false,
          note: rejectReason || 'Pressure unit missing or incompatible.',
        });
      } else {
        psiFactor = factor;
        const convMin = Number((psiCol.min * factor).toFixed(2));
        const convMax = Number((psiCol.max * factor).toFixed(2));
        const inPlausibleBounds = convMin > 0 && convMax <= 25;
        if (convMin < 4.3 || convMax > 14.7) {
          warnings.push(
            `Converted/measured '${psiCol.name}' spans ${convMin}–${convMax} psi (rows outside 4.3–14.7 psi are skipped by the estimator).`
          );
        }
        if (inPlausibleBounds) {
          psiCompatibleCol = psiCol.name;
          const origin = factor === 1 ? 'measured' : 'unit_converted';
          matchedColumns.push({
            role: 'pressurePsi',
            label: 'Cabin Pressure',
            columnName: psiCol.name,
            originalUnit: fromUnit,
            targetUnit: 'psi',
            valueOrigin: origin,
          });
          if (formula) {
            unitConversions.push({
              columnName: psiCol.name,
              fromUnit,
              toUnit: 'psi',
              formula,
              measuredVsConvertedNote: `Converted from documented ${fromUnit} (${psiCol.min}–${psiCol.max}) to ${convMin}–${convMax} psi.`,
            });
          }
        } else {
          missingRequiredFeatures.push('Cabin Pressure (4.3–14.7 psi)');
          unsupportedParameters.push({
            columnName: psiCol.name,
            observedUnitOrType: `${convMin}–${convMax} psi`,
            reason: `Converted pressure (${convMin}–${convMax} psi) exceeds plausible cabin pressure scale.`,
          });
        }
        detectedVariables.push({
          role: 'pressurePsi',
          label: 'Cabin Pressure',
          columnName: psiCol.name,
          detectedUnit: factor === 1 ? 'psi' : `${fromUnit} → psi`,
          targetUnit: 'psi',
          valueOrigin: inPlausibleBounds ? (factor === 1 ? 'measured' : 'unit_converted') : 'unsupported',
          conversionFormula: formula,
          required: true,
          compatible: inPlausibleBounds,
          note:
            factor === 1
              ? `Measured '${psiCol.name}' (${convMin}–${convMax} psi).`
              : `Converted '${psiCol.name}' from ${fromUnit} (${psiCol.min}–${psiCol.max}) → ${convMin}–${convMax} psi.`,
        });
      }
    }
  }

  // 3. Ventilation / Forced Flow Velocity (cm/s)
  if (!flowCol) {
    missingRequiredFeatures.push('Ventilation Airflow (cm/s)');
    missingParameters.push({
      role: 'airflowCmS',
      label: 'Ventilation Airflow',
      required: true,
      reason: 'No airflow or forced flow velocity column detected in CSV headers.',
    });
    detectedVariables.push({
      role: 'airflowCmS',
      label: 'Ventilation Airflow',
      columnName: null,
      detectedUnit: 'missing',
      targetUnit: 'cm/s',
      valueOrigin: 'missing',
      conversionFormula: null,
      required: true,
      compatible: false,
      note: 'No ventilation airflow column detected.',
    });
  } else {
    matchedColNames.add(flowCol.name);
    const n = lower(flowCol.name);
    if (flowCol.dataType !== 'number' || flowCol.min === null || flowCol.max === null) {
      missingRequiredFeatures.push('Ventilation Airflow (numeric cm/s)');
      unsupportedParameters.push({
        columnName: flowCol.name,
        observedUnitOrType: flowCol.dataType,
        reason: `Airflow column '${flowCol.name}' is non-numeric.`,
      });
      detectedVariables.push({
        role: 'airflowCmS',
        label: 'Ventilation Airflow',
        columnName: flowCol.name,
        detectedUnit: 'non-numeric',
        targetUnit: 'cm/s',
        valueOrigin: 'unsupported',
        conversionFormula: null,
        required: true,
        compatible: false,
        note: `Column '${flowCol.name}' is non-numeric.`,
      });
    } else {
      let fromUnit: string | null = null;
      let factor = 1;
      let formula: string | null = null;
      let rejectReason: string | null = null;

      if (/(lpm|l\/min|slpm|cfm|sccm|m3\/|m3_)/.test(n)) {
        rejectReason = `Volumetric flow '${flowCol.name}' cannot convert to linear cm/s without documented flow duct area.`;
      } else if (/(cm\/?s|cm_?s|cm_?sec|cms|cm\s*s-1)/.test(n)) {
        fromUnit = 'cm/s';
        factor = 1;
      } else if (/(mm\/?s|mm_?s|mm_?sec|mms|mm\s*s-1)/.test(n)) {
        fromUnit = 'mm/s';
        factor = 0.1;
        formula = 'mm/s × 0.1 → cm/s';
      } else if (/(?:^|[^a-z])(m\/s|m_s|mps|m_sec|m\s*s-1)(?:[^a-z]|$)/.test(n)) {
        fromUnit = 'm/s';
        factor = 100;
        formula = 'm/s × 100 → cm/s';
      } else if (flowCol.min >= 0 && flowCol.max <= 120) {
        fromUnit = 'cm/s (undocumented header, 0–120 range)';
        factor = 1;
        warnings.push(`Column '${flowCol.name}' omitted velocity unit in header; 0–120 range interpreted as cm/s.`);
      } else {
        rejectReason = `Airflow column '${flowCol.name}' (${flowCol.min}–${flowCol.max}) has undocumented velocity units (cm/s, m/s, mm/s).`;
      }

      if (rejectReason || !fromUnit) {
        missingRequiredFeatures.push('Ventilation Airflow (cm/s or convertible m/s, mm/s)');
        if (rejectReason) warnings.push(rejectReason);
        unsupportedParameters.push({
          columnName: flowCol.name,
          observedUnitOrType: `${flowCol.min}–${flowCol.max}`,
          reason: rejectReason || 'Unsupported airflow unit.',
        });
        detectedVariables.push({
          role: 'airflowCmS',
          label: 'Ventilation Airflow',
          columnName: flowCol.name,
          detectedUnit: 'unsupported unit',
          targetUnit: 'cm/s',
          valueOrigin: 'unsupported',
          conversionFormula: null,
          required: true,
          compatible: false,
          note: rejectReason || 'Unit mismatch: requires cm/s, m/s, or mm/s.',
        });
      } else {
        flowFactor = factor;
        const convMin = Number((flowCol.min * factor).toFixed(2));
        const convMax = Number((flowCol.max * factor).toFixed(2));
        const validFlow = convMin >= 0 && convMax <= 250;
        if (convMax > 100) {
          warnings.push(`Converted/measured '${flowCol.name}' reaches ${convMax} cm/s (>100 cm/s rows will be skipped).`);
        }
        if (validFlow) {
          flowCompatibleCol = flowCol.name;
          const origin = factor === 1 ? 'measured' : 'unit_converted';
          matchedColumns.push({
            role: 'airflowCmS',
            label: 'Ventilation Airflow',
            columnName: flowCol.name,
            originalUnit: fromUnit,
            targetUnit: 'cm/s',
            valueOrigin: origin,
          });
          if (formula) {
            unitConversions.push({
              columnName: flowCol.name,
              fromUnit,
              toUnit: 'cm/s',
              formula,
              measuredVsConvertedNote: `Converted from documented ${fromUnit} (${flowCol.min}–${flowCol.max}) to ${convMin}–${convMax} cm/s.`,
            });
          }
        } else {
          missingRequiredFeatures.push('Ventilation Airflow (0–100 cm/s)');
          unsupportedParameters.push({
            columnName: flowCol.name,
            observedUnitOrType: `${convMin}–${convMax} cm/s`,
            reason: 'Negative or implausible linear airflow velocity.',
          });
        }
        detectedVariables.push({
          role: 'airflowCmS',
          label: 'Ventilation Airflow',
          columnName: flowCol.name,
          detectedUnit: factor === 1 ? 'cm/s' : `${fromUnit} → cm/s`,
          targetUnit: 'cm/s',
          valueOrigin: validFlow ? (factor === 1 ? 'measured' : 'unit_converted') : 'unsupported',
          conversionFormula: formula,
          required: true,
          compatible: validFlow,
          note:
            factor === 1
              ? `Measured '${flowCol.name}' (${convMin}–${convMax} cm/s).`
              : `Converted '${flowCol.name}' from ${fromUnit} (${flowCol.min}–${flowCol.max}) → ${convMin}–${convMax} cm/s.`,
        });
      }
    }
  }

  // 4. Fuel Type / Sample Material
  if (!fuelCol) {
    missingRequiredFeatures.push('Fuel Type / Material');
    missingParameters.push({
      role: 'fuelType',
      label: 'Fuel Type',
      required: true,
      reason: 'No fuel phase or sample material column detected in CSV headers.',
    });
    detectedVariables.push({
      role: 'fuelType',
      label: 'Fuel Type',
      columnName: null,
      detectedUnit: 'missing',
      targetUnit: 'phase category',
      valueOrigin: 'missing',
      conversionFormula: null,
      required: true,
      compatible: false,
      note: 'No fuel material or fuel_type column detected.',
    });
  } else {
    matchedColNames.add(fuelCol.name);
    const sampleMapped = rows.filter((r) => normalizeFuelString(r[fuelCol.name]) !== null).length;
    const isFuelOk = sampleMapped > 0;
    if (!isFuelOk) {
      missingRequiredFeatures.push('Fuel Type (mappable category: solid-fabric, plastic, liquid, gas)');
      warnings.push(
        `Column '${fuelCol.name}' values could not be mapped to supported fuel phases (solid-fabric, plastic, liquid, gas).`
      );
      unsupportedParameters.push({
        columnName: fuelCol.name,
        observedUnitOrType: 'unrecognized categories',
        reason: 'Material descriptions do not map to known solid-fabric, plastic, liquid, or gas categories.',
      });
    } else {
      fuelCompatibleCol = fuelCol.name;
      matchedColumns.push({
        role: 'fuelType',
        label: 'Fuel Type',
        columnName: fuelCol.name,
        originalUnit: 'material descriptor',
        targetUnit: 'phase category',
        valueOrigin: 'normalized_category',
      });
      if (sampleMapped < rows.length) {
        warnings.push(
          `${rows.length - sampleMapped}/${rows.length} rows in '${fuelCol.name}' had missing or unmapped material labels and will be skipped.`
        );
      }
    }
    detectedVariables.push({
      role: 'fuelType',
      label: 'Fuel Type',
      columnName: fuelCol.name,
      detectedUnit: 'category',
      targetUnit: 'phase category',
      valueOrigin: isFuelOk ? 'normalized_category' : 'unsupported',
      conversionFormula: null,
      required: true,
      compatible: isFuelOk,
      note: isFuelOk
        ? `Normalized ${sampleMapped}/${rows.length} rows in '${fuelCol.name}' to phase category.`
        : `Unrecognized fuel categories in '${fuelCol.name}'.`,
    });
  }

  // Optional measured research telemetry (never fed into 4-input estimator; tracked transparently)
  if (tempCol) {
    matchedColNames.add(tempCol.name);
    const tUnit = /(\b|_)(k|kelvin)(\b|_)/i.test(tempCol.name)
      ? 'K'
      : /(\b|_)(c|celsius|degc)(\b|_)/i.test(tempCol.name)
        ? '°C'
        : 'thermal';
    detectedVariables.push({
      role: 'temperature',
      label: 'Temperature',
      columnName: tempCol.name,
      detectedUnit: tUnit,
      targetUnit: tUnit,
      valueOrigin: 'measured',
      conversionFormula: null,
      required: false,
      compatible: tempCol.dataType === 'number',
      note: `Measured experimental thermal variable (${tempCol.dataType}).`,
    });
    unsupportedParameters.push({
      columnName: tempCol.name,
      observedUnitOrType: `${tUnit} (${tempCol.dataType})`,
      reason: 'Measured post-ignition thermal outcome (not an input to the pre-ignition cabin risk estimator).',
    });
  }

  if (flameCol) {
    matchedColNames.add(flameCol.name);
    detectedVariables.push({
      role: 'flameCharacteristic',
      label: 'Flame Characteristic',
      columnName: flameCol.name,
      detectedUnit: 'measured outcome',
      targetUnit: 'n/a',
      valueOrigin: 'measured',
      conversionFormula: null,
      required: false,
      compatible: flameCol.dataType === 'number' || flameCol.dataType === 'string',
      note: `Measured post-ignition response (${flameCol.dataType}).`,
    });
    unsupportedParameters.push({
      columnName: flameCol.name,
      observedUnitOrType: flameCol.dataType,
      reason: 'Measured post-ignition flame outcome (used for statistical charts, not model input).',
    });
  }

  // Document remaining CSV columns cleanly in unsupportedParameters
  for (const col of columnStats) {
    if (matchedColNames.has(col.name)) continue;
    const n = lower(col.name);
    let reason = 'Not part of the 4-input cabin combustion model schema (available for charts & statistics).';
    if (/(burn|spread|flame|ignit|extinct|radiat|smoke|heat_flux|max_temp)/.test(n)) {
      reason = 'Measured experimental outcome variable (not a pre-ignition model input).';
    } else if (/(thick|width|length|mass|geom)/.test(n)) {
      reason = 'Measured specimen geometry parameter (not supported by 4-input cabin model).';
    } else if (/(test_id|date|crew|video|notes|exp|comment)/.test(n)) {
      reason = 'Test log metadata / identifier.';
    }
    unsupportedParameters.push({
      columnName: col.name,
      observedUnitOrType: col.dataType,
      reason,
    });
  }

  const isPredictionCompatible = missingRequiredFeatures.length === 0;
  const eligibilityReason = isPredictionCompatible
    ? unitConversions.length > 0
      ? `All 4 required inputs verified (${unitConversions.length} column unit conversion applied using documented units). Row-level heuristic estimates compute strictly from measured/converted in-bounds rows (missing values are never treated as 0).`
      : 'All 4 required inputs (O₂ %, Pressure psi, Airflow cm/s, Fuel phase) verified directly from measured CSV columns. Rows with missing or out-of-range cells are skipped.'
    : `Disabled: ${missingRequiredFeatures.join(', ')} missing or lacks documented units. Missing parameters are never fabricated or defaulted to constants; statistics and charts remain fully available.`;

  const summary = isPredictionCompatible
    ? `Prediction-Compatible Inputs Verified: Matched ${matchedColumns.length}/4 required variables${
        unitConversions.length > 0 ? ` (${unitConversions.length} documented unit conversion)` : ''
      }. Computed row estimates are empirical heuristics, distinct from measured NASA outcome columns.`
    : `Stats Only: Missing or unit-incompatible required parameters (${missingRequiredFeatures.join(
        ', '
      )}). Three-variable fire-risk prediction is disabled so missing parameters are never invented.`;

  return {
    report: {
      isPredictionCompatible,
      mode: isPredictionCompatible ? 'PREDICTION_COMPATIBLE_ESTIMATE' : 'STATISTICAL_ANALYSIS_ONLY',
      detectedVariables,
      missingRequiredFeatures,
      warnings,
      summary,
      predictionEligibility: {
        eligible: isPredictionCompatible,
        reason: eligibilityReason,
        modelRequirement: 'Requires measured/converted O₂ (21–85%), Pressure (4.3–14.7 psi), Airflow (0–100 cm/s), and Fuel Phase.',
      },
      matchedColumns,
      unitConversions,
      missingParameters,
      unsupportedParameters,
    },
    factors: {
      o2Col: o2CompatibleCol,
      o2Factor,
      psiCol: psiCompatibleCol,
      psiFactor,
      flowCol: flowCompatibleCol,
      flowFactor,
      fuelCol: fuelCompatibleCol,
    },
  };
}

export function inspectCombustionCompatibility(
  columnStats: DataLabColumnStat[],
  rows: Array<Record<string, string | number | null>>
): CombustionCompatibilityReport {
  return buildCompatibilityAndFactors(columnStats, rows).report;
}

export function listSessionDataLabDatasets(sessionKey: string): DataLabDatasetSummary[] {
  purgeExpiredDataLabDatasets();
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, original_filename, file_size_bytes, row_count, column_count,
              duplicate_row_count, column_stats_json, combustion_compatibility_json,
              raw_csv, expires_at, created_at, updated_at
       FROM data_lab_datasets
       WHERE session_token = ?
       ORDER BY created_at DESC`
    )
    .all(sessionKey) as Array<{
    id: string;
    original_filename: string;
    file_size_bytes: number;
    row_count: number;
    column_count: number;
    duplicate_row_count: number;
    column_stats_json: string;
    combustion_compatibility_json: string;
    raw_csv: string;
    expires_at: string;
    created_at: string;
    updated_at: string;
  }>;

  return rows.map((r) => {
    const stats = JSON.parse(r.column_stats_json) as DataLabColumnStat[];
    let compat = JSON.parse(r.combustion_compatibility_json) as CombustionCompatibilityReport;
    if (!compat.predictionEligibility) {
      const parsed = parseStrictCsvTable(r.raw_csv);
      compat = inspectCsvFull(parsed.headers, parsed.rows).combustionCompatibility;
      db.prepare('UPDATE data_lab_datasets SET combustion_compatibility_json = ? WHERE id = ?').run(
        JSON.stringify(compat),
        r.id
      );
    }
    const totalMissingCells = stats.reduce((sum, s) => sum + s.missingCount, 0);
    return {
      id: r.id,
      originalFilename: r.original_filename,
      fileSizeBytes: r.file_size_bytes,
      rowCount: r.row_count,
      columnCount: r.column_count,
      duplicateRowCount: r.duplicate_row_count,
      totalMissingCells,
      provenanceLabel: 'User-Uploaded Data',
      isPredictionCompatible: compat.isPredictionCompatible,
      expiresAt: r.expires_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  });
}

export function createDataLabDatasetFromCsv(params: {
  sessionKey: string;
  filename: string;
  fileSizeBytes: number;
  csvText: string;
}): DataLabDatasetDetail {
  purgeExpiredDataLabDatasets();

  const filename = String(params.filename || '').trim();
  if (!filename || !filename.toLowerCase().endsWith('.csv')) {
    throw new DataLabError(415, 'Unsupported file type: only .csv files are accepted.');
  }

  if (params.fileSizeBytes <= 0 || params.fileSizeBytes > MAX_CSV_UPLOAD_BYTES) {
    throw new DataLabError(
      413,
      `File size must be between 1 byte and ${Math.round(MAX_CSV_UPLOAD_BYTES / (1024 * 1024))} MB.`
    );
  }

  const { headers, rows } = parseStrictCsvTable(params.csvText);
  const inspected = inspectCsvFull(headers, rows);

  const db = getDb();
  const id = `dl-${crypto.randomUUID()}`;
  const now = new Date();
  const nowIso = now.toISOString();
  const expiresIso = new Date(now.getTime() + RETENTION_HOURS * 60 * 60 * 1000).toISOString();

  db.prepare(
    `INSERT INTO data_lab_datasets (
      id, session_token, original_filename, file_size_bytes, row_count, column_count,
      duplicate_row_count, columns_json, column_stats_json, correlations_json,
      combustion_compatibility_json, raw_csv, last_analysis_json, expires_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    params.sessionKey,
    filename,
    params.fileSizeBytes,
    inspected.totalRows,
    headers.length,
    inspected.duplicateRowCount,
    JSON.stringify(headers),
    JSON.stringify(inspected.columnStats),
    JSON.stringify(inspected.correlations),
    JSON.stringify(inspected.combustionCompatibility),
    params.csvText,
    null,
    expiresIso,
    nowIso,
    nowIso
  );

  return getDataLabDatasetDetail(params.sessionKey, id);
}

function fetchOwnedDatasetRow(sessionKey: string, datasetId: string) {
  purgeExpiredDataLabDatasets();
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM data_lab_datasets WHERE id = ? LIMIT 1')
    .get(datasetId) as
    | {
        id: string;
        session_token: string;
        original_filename: string;
        file_size_bytes: number;
        row_count: number;
        column_count: number;
        duplicate_row_count: number;
        columns_json: string;
        column_stats_json: string;
        correlations_json: string;
        combustion_compatibility_json: string;
        raw_csv: string;
        last_analysis_json: string | null;
        expires_at: string;
        created_at: string;
        updated_at: string;
      }
    | undefined;

  if (!row) {
    throw new DataLabError(404, `Uploaded dataset '${datasetId}' not found or expired.`);
  }
  if (row.session_token !== sessionKey) {
    throw new DataLabError(403, 'Forbidden: you do not have access to another session’s uploaded dataset.');
  }
  return row;
}

export function getDataLabDatasetDetail(sessionKey: string, datasetId: string): DataLabDatasetDetail {
  const row = fetchOwnedDatasetRow(sessionKey, datasetId);
  const columns = JSON.parse(row.columns_json) as string[];
  const columnStats = JSON.parse(row.column_stats_json) as DataLabColumnStat[];
  const correlations = JSON.parse(row.correlations_json) as DataLabCorrelationPair[];

  const { headers, rows } = parseStrictCsvTable(row.raw_csv);
  const inspected = inspectCsvFull(headers, rows);
  const combustionCompatibility = inspected.combustionCompatibility;
  const totalMissingCells = columnStats.reduce((sum, c) => sum + c.missingCount, 0);

  return {
    id: row.id,
    originalFilename: row.original_filename,
    fileSizeBytes: row.file_size_bytes,
    rowCount: row.row_count,
    columnCount: row.column_count,
    duplicateRowCount: row.duplicate_row_count,
    totalMissingCells,
    provenanceLabel: 'User-Uploaded Data',
    isPredictionCompatible: combustionCompatibility.isPredictionCompatible,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    columns,
    columnStats,
    correlations,
    combustionCompatibility,
    previewRows: inspected.previewRows,
    chartRows: inspected.chartRows,
  };
}

export function analyzeDataLabDataset(
  sessionKey: string,
  datasetId: string,
  body: {
    selectedColumns?: string[];
    chartType?: 'line' | 'bar' | 'scatter' | 'distribution' | 'correlation';
    xColumn?: string | null;
    yColumn?: string | null;
    includeCompatibilityEstimates?: boolean;
  }
): DataLabAnalyzeResponse {
  const row = fetchOwnedDatasetRow(sessionKey, datasetId);
  const allColumns = JSON.parse(row.columns_json) as string[];
  const allStats = JSON.parse(row.column_stats_json) as DataLabColumnStat[];
  const allCorrs = JSON.parse(row.correlations_json) as DataLabCorrelationPair[];

  const requestedCols = Array.isArray(body.selectedColumns) && body.selectedColumns.length > 0
    ? body.selectedColumns.filter((c) => allColumns.includes(c))
    : allColumns;

  if (requestedCols.length === 0) {
    throw new DataLabError(400, 'At least one valid dataset column must be selected for analysis.');
  }

  const validCharts = ['line', 'bar', 'scatter', 'distribution', 'correlation'] as const;
  const chartType = validCharts.includes(body.chartType as (typeof validCharts)[number])
    ? (body.chartType as (typeof validCharts)[number])
    : 'line';

  const { headers, rows } = parseStrictCsvTable(row.raw_csv);
  const inspected = inspectCsvFull(headers, rows);
  const { report: compat, factors } = buildCompatibilityAndFactors(allStats, inspected.objectRows);

  const selectedSet = new Set(requestedCols);
  const selectedColumnStats = allStats.filter((s) => selectedSet.has(s.name));
  const filteredCorrelations = allCorrs.filter(
    (c) => selectedSet.has(c.colA) && selectedSet.has(c.colB)
  );

  // Filter chartRows down to requested columns
  const chartRows = inspected.chartRows.map((fullObj) => {
    const slim: Record<string, string | number | null> = {};
    for (const col of requestedCols) {
      slim[col] = fullObj[col];
    }
    return slim;
  });

  // Careful Combustion Prediction Compatibility Gate
  let combustionEstimates: DataLabAnalyzeResponse['combustionEstimates'] = {
    performed: false,
    disclaimer:
      'No fire-risk estimates computed. Statistical inspection only.',
    reasonIfSkipped: compat.isPredictionCompatible
      ? 'Row-level estimation not requested.'
      : compat.summary,
    rowsEvaluated: 0,
    rowsSkippedOutOfRange: 0,
    results: [],
  };

  if (body.includeCompatibilityEstimates) {
    if (
      !compat.isPredictionCompatible ||
      !factors.o2Col ||
      !factors.psiCol ||
      !factors.flowCol ||
      !factors.fuelCol
    ) {
      combustionEstimates = {
        performed: false,
        disclaimer:
          'Blocked: Uploaded dataset is not compatible with all 4 required combustion model variables and units. Missing parameters are never fabricated.',
        reasonIfSkipped: compat.predictionEligibility?.reason || compat.summary,
        rowsEvaluated: 0,
        rowsSkippedOutOfRange: inspected.objectRows.length,
        results: [],
      };
    } else {
      const estResults: DataLabAnalyzeResponse['combustionEstimates']['results'] = [];
      let skipped = 0;

      inspected.objectRows.forEach((r, idx) => {
        const rawO2 = r[factors.o2Col!];
        const rawPsi = r[factors.psiCol!];
        const rawFlow = r[factors.flowCol!];
        const rawFuel = r[factors.fuelCol!];

        // CRITICAL: Never coerce null / missing cells into 0 via Number(null) === 0!
        if (
          typeof rawO2 !== 'number' ||
          !Number.isFinite(rawO2) ||
          typeof rawPsi !== 'number' ||
          !Number.isFinite(rawPsi) ||
          typeof rawFlow !== 'number' ||
          !Number.isFinite(rawFlow)
        ) {
          skipped += 1;
          return;
        }

        const o2 = Number((rawO2 * factors.o2Factor).toFixed(2));
        const psi = Number((rawPsi * factors.psiFactor).toFixed(2));
        const flow = Number((rawFlow * factors.flowFactor).toFixed(2));
        const fuel = normalizeFuelString(rawFuel);

        const inBounds =
          Number.isFinite(o2) &&
          o2 >= 21 &&
          o2 <= 85 &&
          Number.isFinite(psi) &&
          psi >= 4.3 &&
          psi <= 14.7 &&
          Number.isFinite(flow) &&
          flow >= 0 &&
          flow <= 100 &&
          fuel !== null &&
          FUEL_TYPES.some((f) => f.id === fuel);

        if (!inBounds) {
          skipped += 1;
          return;
        }

        const evalRes = evaluateCombustionModel({
          oxygenPct: o2,
          pressurePsi: psi,
          airflowCmS: flow,
          fuelType: fuel,
        });
        const band: 'SAFE' | 'CAUTION' | 'DANGER' =
          evalRes.riskScore >= 65 ? 'DANGER' : evalRes.riskScore >= 32 ? 'CAUTION' : 'SAFE';

        estResults.push({
          rowIndex: idx + 1,
          oxygenPct: o2,
          pressurePsi: psi,
          airflowCmS: flow,
          fuelType: fuel,
          estimatedRiskScore: evalRes.riskScore,
          estimatedLocPct: evalRes.locPercent,
          estimatedBand: band,
        });
      });

      const conversionNote =
        compat.unitConversions && compat.unitConversions.length > 0
          ? ` Unit conversions applied from documented headers: ${compat.unitConversions.map((u) => u.formula).join('; ')}.`
          : '';

      combustionEstimates = {
        performed: true,
        disclaimer:
          `Estimated using empirical microgravity formula heuristics on measured/converted inputs (NOT measured flight outcome columns and NOT a NASA certification).${conversionNote} Rows with missing or out-of-bounds values were skipped (never filled with zero or constants).`,
        rowsEvaluated: estResults.length,
        rowsSkippedOutOfRange: skipped,
        results: estResults,
      };
    }
  }

  const nowIso = new Date().toISOString();
  const analysisPayload: DataLabAnalyzeResponse = {
    datasetId,
    analyzedAt: nowIso,
    provenanceLabel: 'User-Uploaded Data',
    selectedColumns: requestedCols,
    chartType,
    xColumn: body.xColumn && requestedCols.includes(body.xColumn) ? body.xColumn : requestedCols[0] || null,
    yColumn: body.yColumn && requestedCols.includes(body.yColumn) ? body.yColumn : requestedCols[1] || requestedCols[0] || null,
    selectedColumnStats,
    filteredCorrelations,
    chartRows,
    combustionEstimates,
  };

  const db = getDb();
  db.prepare(
    'UPDATE data_lab_datasets SET last_analysis_json = ?, updated_at = ? WHERE id = ? AND session_token = ?'
  ).run(JSON.stringify(analysisPayload), nowIso, datasetId, sessionKey);

  return analysisPayload;
}

function escapeCsvCell(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildDataLabCsvExport(
  sessionKey: string,
  datasetId: string,
  selectedColumnsParam?: string[]
): { filename: string; content: string } {
  const detail = getDataLabDatasetDetail(sessionKey, datasetId);
  const cols =
    selectedColumnsParam && selectedColumnsParam.length > 0
      ? selectedColumnsParam.filter((c) => detail.columns.includes(c))
      : detail.columns;
  const activeCols = cols.length > 0 ? cols : detail.columns;

  const { headers, rows } = parseStrictCsvTable(fetchOwnedDatasetRow(sessionKey, datasetId).raw_csv);
  const inspected = inspectCsvFull(headers, rows);

  const lines: string[] = [
    `# PROVENANCE: User-Uploaded Data (Analyzed in Flame in Freefall Data Lab)`,
    `# SOURCE_FILE: ${detail.originalFilename} | ROWS: ${detail.rowCount} | DUPLICATE_ROWS: ${detail.duplicateRowCount} | EXPORTED_AT: ${new Date().toISOString()}`,
    activeCols.map(escapeCsvCell).join(','),
    ...inspected.objectRows.map((r) => activeCols.map((c) => escapeCsvCell(r[c])).join(',')),
  ];

  const baseName = detail.originalFilename.replace(/\.csv$/i, '').replace(/[^a-z0-9_-]/gi, '_');
  return {
    filename: `${baseName}_analyzed.csv`,
    content: lines.join('\n'),
  };
}

export function buildDataLabJsonReport(
  sessionKey: string,
  datasetId: string,
  selectedColumnsParam?: string[]
) {
  const row = fetchOwnedDatasetRow(sessionKey, datasetId);
  const detail = getDataLabDatasetDetail(sessionKey, datasetId);
  const activeCols =
    selectedColumnsParam && selectedColumnsParam.length > 0
      ? selectedColumnsParam.filter((c) => detail.columns.includes(c))
      : detail.columns;
  const activeSet = new Set(activeCols.length > 0 ? activeCols : detail.columns);
  const lastAnalysis = row.last_analysis_json
    ? (JSON.parse(row.last_analysis_json) as DataLabAnalyzeResponse)
    : null;

  return {
    reportTitle: 'Flame in Freefall — Data Lab Statistical Inspection Report',
    generatedAt: new Date().toISOString(),
    provenance: {
      classification: 'User-Uploaded Data',
      note: 'Derived strictly from user-uploaded CSV values. Not verified NASA telemetry.',
    },
    dataset: {
      id: detail.id,
      filename: detail.originalFilename,
      fileSizeBytes: detail.fileSizeBytes,
      rowCount: detail.rowCount,
      columnCount: detail.columnCount,
      duplicateRowCount: detail.duplicateRowCount,
      totalMissingCells: detail.totalMissingCells,
      uploadedAt: detail.createdAt,
      expiresAt: detail.expiresAt,
    },
    selectedColumns: Array.from(activeSet),
    columnStatistics: detail.columnStats.filter((c) => activeSet.has(c.name)),
    correlations: detail.correlations.filter((c) => activeSet.has(c.colA) && activeSet.has(c.colB)),
    combustionResearchCompatibility: detail.combustionCompatibility,
    lastInteractiveAnalysis: lastAnalysis,
  };
}

export function generateDataLabPdfBuffer(
  sessionKey: string,
  datasetId: string,
  selectedColumnsParam?: string[]
): Promise<{ filename: string; buffer: Buffer }> {
  const report = buildDataLabJsonReport(sessionKey, datasetId, selectedColumnsParam);
  const baseName = report.dataset.filename.replace(/\.csv$/i, '').replace(/[^a-z0-9_-]/gi, '_');

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 44, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve({ filename: `${baseName}_analysis_report.pdf`, buffer: Buffer.concat(chunks) }));
    doc.on('error', reject);

    // Header
    doc.rect(0, 0, doc.page.width, 72).fill('#0B0B0E');
    doc.fillColor('#D97B29').fontSize(9).text('FLAME IN FREEFALL — DATA LAB REPORT', 44, 20);
    doc.fillColor('#F3EFE8').fontSize(17).text(report.dataset.filename, 44, 34);
    doc.fillColor('#A9A39A').fontSize(8.5).text(`Generated UTC: ${report.generatedAt}`, 44, 55);

    doc.moveDown(2.2);
    doc.fillColor('#111111');

    // Provenance Banner
    doc.rect(44, doc.y, doc.page.width - 88, 28).fillAndStroke('#FFF4EB', '#D97B29');
    doc
      .fillColor('#8A4208')
      .fontSize(9)
      .text(
        `PROVENANCE: ${report.provenance.classification.toUpperCase()} — ${report.provenance.note}`,
        52,
        doc.y - 20,
        { width: doc.page.width - 104 }
      );
    doc.moveDown(1.4);

    // Dataset Overview
    doc.fillColor('#111111').fontSize(12).text('1. Dataset Summary');
    doc.moveDown(0.3);
    doc.fontSize(9.5).fillColor('#333333');
    doc.text(
      `Rows: ${report.dataset.rowCount}   |   Columns: ${report.dataset.columnCount}   |   Duplicate Rows: ${report.dataset.duplicateRowCount}   |   Missing Cells: ${report.dataset.totalMissingCells}   |   Size: ${(report.dataset.fileSizeBytes / 1024).toFixed(1)} KB`
    );
    doc.text(`Selected Columns (${report.selectedColumns.length}): ${report.selectedColumns.join(', ')}`);
    doc.moveDown(0.9);

    // Column Descriptive Statistics Table
    doc.fillColor('#111111').fontSize(12).text('2. Column Statistics');
    doc.moveDown(0.4);

    const colWidths = [115, 52, 52, 46, 56, 56, 56, 56];
    const tableHeaders = ['Column', 'Type', 'Missing', 'Unique', 'Min', 'Max', 'Mean', 'StdDev'];

    const drawRow = (vals: string[], isHeader = false) => {
      if (doc.y > doc.page.height - 90) doc.addPage();
      const startY = doc.y;
      if (isHeader) {
        doc.rect(44, startY - 2, doc.page.width - 88, 16).fill('#1F2026');
        doc.fillColor('#F3EFE8').fontSize(8);
      } else {
        doc.fillColor('#222222').fontSize(8);
      }
      let x = 48;
      vals.forEach((v, i) => {
        doc.text(v.slice(0, 20), x, startY + 2, { width: colWidths[i] - 4, lineBreak: false });
        x += colWidths[i];
      });
      doc.y = startY + 17;
    };

    drawRow(tableHeaders, true);
    for (const st of report.columnStatistics.slice(0, 25)) {
      drawRow([
        st.name,
        st.dataType,
        `${st.missingCount} (${st.missingPct}%)`,
        String(st.uniqueCount),
        st.min !== null ? String(st.min) : '-',
        st.max !== null ? String(st.max) : '-',
        st.mean !== null ? String(st.mean) : '-',
        st.stdDev !== null ? String(st.stdDev) : '-',
      ]);
    }
    doc.moveDown(0.8);

    // Numeric Summary Bar Visual (Embedded Visualization)
    const numericCols = report.columnStatistics.filter((c) => c.dataType === 'number' && c.mean !== null).slice(0, 6);
    if (numericCols.length > 0) {
      if (doc.y > doc.page.height - 160) doc.addPage();
      doc.fillColor('#111111').fontSize(12).text('3. Numeric Mean Profile Visualization');
      doc.moveDown(0.4);
      const maxAbsMean = Math.max(...numericCols.map((c) => Math.abs(c.mean || 0)), 1);
      for (const nc of numericCols) {
        const y = doc.y;
        const barWidth = Math.max(6, Math.round((Math.abs(nc.mean || 0) / maxAbsMean) * 260));
        doc.fillColor('#333333').fontSize(8.5).text(nc.name.slice(0, 22), 44, y + 2, { width: 130, lineBreak: false });
        doc.rect(180, y + 1, 260, 10).fill('#ECECEC');
        doc.rect(180, y + 1, barWidth, 10).fill('#D97B29');
        doc.fillColor('#111111').fontSize(8.5).text(String(nc.mean), 450, y + 2);
        doc.y = y + 16;
      }
      doc.moveDown(0.7);
    }

    // Correlations
    if (report.correlations.length > 0) {
      if (doc.y > doc.page.height - 120) doc.addPage();
      doc.fillColor('#111111').fontSize(12).text('4. Top Pearson Correlations');
      doc.moveDown(0.3);
      doc.fontSize(9).fillColor('#333333');
      for (const pair of report.correlations.slice(0, 8)) {
        doc.text(`• ${pair.colA} vs ${pair.colB}: r = ${pair.r} (n = ${pair.n})`);
      }
      doc.moveDown(0.7);
    }

    // Combustion Research Compatibility
    if (doc.y > doc.page.height - 140) doc.addPage();
    const compatReport = report.combustionResearchCompatibility;
    doc.fillColor('#111111').fontSize(12).text('5. Microgravity Combustion Compatibility Assessment');
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor('#333333').text(
      `Mode: ${compatReport.mode}   |   Prediction Eligible: ${compatReport.isPredictionCompatible ? 'YES' : 'NO (Disabled)'}`,
      { continued: false }
    );
    if (compatReport.predictionEligibility?.reason) {
      doc.text(`Eligibility: ${compatReport.predictionEligibility.reason}`, { width: doc.page.width - 88 });
    } else {
      doc.text(compatReport.summary, { width: doc.page.width - 88 });
    }
    if (compatReport.matchedColumns && compatReport.matchedColumns.length > 0) {
      doc.moveDown(0.25);
      doc.text(
        `Matched Inputs (${compatReport.matchedColumns.length}): ${compatReport.matchedColumns
          .map((m) => `${m.label} <- ${m.columnName} [${m.valueOrigin}, ${m.originalUnit} -> ${m.targetUnit}]`)
          .join('; ')}`,
        { width: doc.page.width - 88 }
      );
    }
    if (compatReport.unitConversions && compatReport.unitConversions.length > 0) {
      doc.moveDown(0.2);
      doc.text(
        `Unit Conversions: ${compatReport.unitConversions.map((u) => `${u.columnName}: ${u.formula}`).join('; ')}`,
        { width: doc.page.width - 88 }
      );
    }
    if (compatReport.missingParameters && compatReport.missingParameters.length > 0) {
      doc.moveDown(0.2);
      doc.text(
        `Missing Required Parameters: ${compatReport.missingParameters.map((m) => `${m.label} (${m.reason})`).join('; ')}`,
        { width: doc.page.width - 88 }
      );
    }
    if (report.lastInteractiveAnalysis?.combustionEstimates?.performed) {
      const est = report.lastInteractiveAnalysis.combustionEstimates;
      doc.moveDown(0.3);
      doc.fillColor('#8A4208').text(
        `Row Estimates Executed (Heuristic, Not NASA Certification): ${est.rowsEvaluated} rows evaluated (${est.rowsSkippedOutOfRange} skipped out of bounds or missing). Disclaimer: ${est.disclaimer}`,
        { width: doc.page.width - 88 }
      );
    }

    doc.end();
  });
}

export function deleteDataLabDataset(sessionKey: string, datasetId: string) {
  const row = fetchOwnedDatasetRow(sessionKey, datasetId);
  const db = getDb();
  db.prepare('DELETE FROM data_lab_datasets WHERE id = ? AND session_token = ?').run(
    row.id,
    sessionKey
  );
  return { deleted: true, id: row.id, originalFilename: row.original_filename };
}
