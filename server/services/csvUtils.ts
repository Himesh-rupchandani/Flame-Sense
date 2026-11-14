import type { DatasetColumnStats, DatasetVariableMeta } from '../../src/types/experiments.ts';

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function isMissingToken(raw: string | undefined): boolean {
  if (raw === undefined || raw === null) return true;
  const trimmed = raw.trim().toLowerCase();
  return trimmed === '' || trimmed === 'null' || trimmed === 'na' || trimmed === 'n/a' || trimmed === 'nan' || trimmed === 'none';
}

function computeMedian(sortedNums: number[]): number | null {
  if (sortedNums.length === 0) return null;
  const mid = Math.floor(sortedNums.length / 2);
  if (sortedNums.length % 2 === 0) {
    return Number(((sortedNums[mid - 1] + sortedNums[mid]) / 2).toFixed(4));
  }
  return Number(sortedNums[mid].toFixed(4));
}

export interface ParsedCsvAnalysis {
  columns: string[];
  totalRows: number;
  previewRows: Array<Record<string, string | number | null>>;
  chartRows: Array<Record<string, string | number | null>>;
  columnStats: DatasetColumnStats[];
}

export function analyzeCsvDataset(
  csvContent: string,
  variablesMeta: DatasetVariableMeta[] = [],
  previewLimit = 25,
  chartLimit = 120
): ParsedCsvAnalysis {
  const cleanLines = String(csvContent || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  if (cleanLines.length === 0) {
    return {
      columns: [],
      totalRows: 0,
      previewRows: [],
      chartRows: [],
      columnStats: [],
    };
  }

  const columns = splitCsvLine(cleanLines[0]);
  const dataLines = cleanLines.slice(1);
  const rawRecords: Array<Array<string | number | null>> = [];

  for (const line of dataLines) {
    const cells = splitCsvLine(line);
    const parsedRow: Array<string | number | null> = columns.map((_, idx) => {
      const cell = cells[idx];
      if (isMissingToken(cell)) return null;
      const num = Number(cell);
      return Number.isFinite(num) && cell !== '' ? num : String(cell);
    });
    rawRecords.push(parsedRow);
  }

  const columnStats: DatasetColumnStats[] = columns.map((colName, colIdx) => {
    const meta = variablesMeta.find((v) => v.name.toLowerCase() === colName.toLowerCase());
    const totalCount = rawRecords.length;
    let missingCount = 0;
    const numericVals: number[] = [];
    const stringSet = new Set<string>();

    for (const row of rawRecords) {
      const val = row[colIdx];
      if (val === null) {
        missingCount += 1;
      } else if (typeof val === 'number') {
        numericVals.push(val);
        stringSet.add(String(val));
      } else {
        stringSet.add(String(val));
      }
    }

    const nonNullCount = totalCount - missingCount;
    const isNumeric = nonNullCount > 0 && numericVals.length === nonNullCount;

    let min: number | null = null;
    let max: number | null = null;
    let mean: number | null = null;
    let median: number | null = null;
    let stdDev: number | null = null;

    if (isNumeric && numericVals.length > 0) {
      const sorted = [...numericVals].sort((a, b) => a - b);
      min = Number(sorted[0].toFixed(4));
      max = Number(sorted[sorted.length - 1].toFixed(4));
      const sum = numericVals.reduce((acc, v) => acc + v, 0);
      const avg = sum / numericVals.length;
      mean = Number(avg.toFixed(4));
      median = computeMedian(sorted);
      const variance =
        numericVals.reduce((acc, v) => acc + (v - avg) ** 2, 0) / numericVals.length;
      stdDev = Number(Math.sqrt(variance).toFixed(4));
    }

    return {
      name: colName,
      unit: meta?.unit || '',
      description: meta?.description || colName.replace(/_/g, ' '),
      dataType: isNumeric ? 'number' : 'string',
      totalCount,
      nonNullCount,
      missingCount,
      missingPct: totalCount > 0 ? Number(((missingCount / totalCount) * 100).toFixed(1)) : 0,
      uniqueCount: stringSet.size,
      min,
      max,
      mean,
      median,
      stdDev,
    };
  });

  const toObjectRow = (row: Array<string | number | null>): Record<string, string | number | null> => {
    const obj: Record<string, string | number | null> = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  };

  return {
    columns,
    totalRows: rawRecords.length,
    previewRows: rawRecords.slice(0, previewLimit).map(toObjectRow),
    chartRows: rawRecords.slice(0, chartLimit).map(toObjectRow),
    columnStats,
  };
}
