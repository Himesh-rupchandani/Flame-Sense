/**
 * FlameSense API Service
 * Central data abstraction layer. Components ONLY read data through this service.
 * Supports seamless switching between local deterministic mock models and future remote backend APIs.
 */

import { CONFIG } from "../config.js";
import { MOCK_DATA, predictRiskMock } from "./mock-data.js";

/**
 * Custom Error for API service failures
 */
export class ApiError extends Error {
  constructor(message, status = 500, endpoint = "") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.endpoint = endpoint;
  }
}

/**
 * Internal artificial delay to simulate realistic network latency in mock mode
 */
const delay = (ms = 120) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch database metadata and model training statistics
 * @returns {Promise<{investigations: number, runs: number, modelMae: number, modelR2: number, lastTrained: string}>}
 */
export async function getMeta() {
  if (CONFIG.USE_MOCK) {
    await delay(80);
    return JSON.parse(JSON.stringify(MOCK_DATA.meta));
  }

  // BACKEND-TODO: Replace mock with GET {CONFIG.API_BASE}/meta
  try {
    const res = await fetch(`${CONFIG.API_BASE}${CONFIG.ENDPOINTS.meta}`);
    if (!res.ok) {
      throw new ApiError(`Failed to fetch metadata (HTTP ${res.status})`, res.status, CONFIG.ENDPOINTS.meta);
    }
    return await res.json();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(err.message || "Network error fetching metadata", 500, CONFIG.ENDPOINTS.meta);
  }
}

/**
 * Fetch list of investigations with optional filters and sorting
 * @param {Object} options
 * @param {string} [options.search]
 * @param {string} [options.pillar]
 * @param {string} [options.fuelClass]
 * @param {string} [options.hardware]
 * @param {string} [options.sortBy]
 * @returns {Promise<Array>}
 */
export async function getInvestigations(options = {}) {
  const { search = "", pillar = "all", fuelClass = "all", hardware = "all", sortBy = "relevance-desc" } = options;

  if (CONFIG.USE_MOCK) {
    await delay(120);
    let list = [...MOCK_DATA.investigations];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(item =>
        item.name.toLowerCase().includes(q) ||
        item.fullName.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        item.fuelClass.toLowerCase().includes(q) ||
        item.hardware.toLowerCase().includes(q)
      );
    }

    if (pillar && pillar !== "all") {
      list = list.filter(item => item.pillar === pillar);
    }

    if (fuelClass && fuelClass !== "all") {
      list = list.filter(item => item.fuelClass === fuelClass);
    }

    if (hardware && hardware !== "all") {
      list = list.filter(item => item.hardware === hardware);
    }

    // Sort order
    if (sortBy === "relevance-desc") {
      list.sort((a, b) => b.relevance - a.relevance);
    } else if (sortBy === "relevance-asc") {
      list.sort((a, b) => a.relevance - b.relevance);
    } else if (sortBy === "year-desc") {
      list.sort((a, b) => b.year - a.year);
    } else if (sortBy === "year-asc") {
      list.sort((a, b) => a.year - b.year);
    } else if (sortBy === "name-asc") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    return JSON.parse(JSON.stringify(list));
  }

  // BACKEND-TODO: Replace mock with GET {CONFIG.API_BASE}/investigations?query...
  try {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (pillar && pillar !== "all") params.append("pillar", pillar);
    if (fuelClass && fuelClass !== "all") params.append("fuelClass", fuelClass);
    if (hardware && hardware !== "all") params.append("hardware", hardware);
    if (sortBy) params.append("sortBy", sortBy);

    const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.investigations}?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new ApiError(`Failed to fetch investigations (HTTP ${res.status})`, res.status, url);
    }
    return await res.json();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(err.message || "Network error fetching investigations", 500, CONFIG.ENDPOINTS.investigations);
  }
}

/**
 * Fetch single investigation by ID
 * @param {string} id
 * @returns {Promise<Object>}
 */
export async function getInvestigation(id) {
  if (!id) throw new ApiError("Investigation ID is required", 400);

  if (CONFIG.USE_MOCK) {
    await delay(90);
    const item = MOCK_DATA.investigations.find(inv => inv.id.toLowerCase() === id.toLowerCase());
    if (!item) {
      throw new ApiError(`Investigation '${id}' not found`, 404, `/investigations/${id}`);
    }
    return JSON.parse(JSON.stringify(item));
  }

  // BACKEND-TODO: Replace mock with GET {CONFIG.API_BASE}/investigations/{id}
  const endpoint = CONFIG.ENDPOINTS.investigation.replace("{id}", encodeURIComponent(id));
  try {
    const res = await fetch(`${CONFIG.API_BASE}${endpoint}`);
    if (!res.ok) {
      throw new ApiError(`Failed to fetch investigation ${id} (HTTP ${res.status})`, res.status, endpoint);
    }
    return await res.json();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(err.message || `Error loading investigation ${id}`, 500, endpoint);
  }
}

/**
 * Predict combustion risk score and limiting oxygen boundaries
 * @param {Object} params
 * @param {number} params.o2 - Oxygen % (14 - 100)
 * @param {number} params.pressure - Pressure in psi (4.0 - 15.0)
 * @param {number} params.airflow - Forced airflow in cm/s (0 - 25)
 * @param {string} params.fuelId - Fuel identifier ('cotton', 'nomex', 'polyethylene', etc.)
 * @param {number} params.thickness - Material thickness in mm (0.2 - 5.0)
 * @returns {Promise<{score: number, locPercent: number, band: string, verdict: string, location: string, contributions: Array<{label: string, value: number}>}>}
 */
export async function predictRisk(params) {
  if (CONFIG.USE_MOCK) {
    await delay(100);
    return predictRiskMock(params);
  }

  // BACKEND-TODO: Replace mock with POST {CONFIG.API_BASE}/predict
  try {
    const res = await fetch(`${CONFIG.API_BASE}${CONFIG.ENDPOINTS.predict}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params)
    });
    if (!res.ok) {
      throw new ApiError(`Risk prediction service failed (HTTP ${res.status})`, res.status, CONFIG.ENDPOINTS.predict);
    }
    return await res.json();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(err.message || "Failed to contact risk prediction model", 500, CONFIG.ENDPOINTS.predict);
  }
}

/**
 * Ask a combustion intelligence question
 * @param {string} question
 * @returns {Promise<{answer: string, citations: Array<{label: string, page: number, url: string}>, confidence: number, latencyMs: number}>}
 */
export async function ask(question) {
  if (!question || !question.trim()) {
    throw new ApiError("Question cannot be empty", 400);
  }

  if (CONFIG.USE_MOCK) {
    const start = performance.now();
    await delay(220);
    const qNorm = question.toLowerCase();

    // Match against indexed knowledgebase
    const match = MOCK_DATA.knowledgeBase.find(kb =>
      kb.keywords.some(kw => qNorm.includes(kw))
    );

    const latencyMs = Math.round(performance.now() - start);

    if (match) {
      return {
        answer: match.answer,
        citations: match.citations,
        confidence: 0.94,
        latencyMs
      };
    }

    // Default unknown response
    return {
      answer: "I could not find this in the indexed NASA documents.",
      citations: [],
      confidence: 0.12,
      latencyMs
    };
  }

  // BACKEND-TODO: Replace mock with POST {CONFIG.API_BASE}/ask
  try {
    const res = await fetch(`${CONFIG.API_BASE}${CONFIG.ENDPOINTS.ask}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question })
    });
    if (!res.ok) {
      throw new ApiError(`Combustion query failed (HTTP ${res.status})`, res.status, CONFIG.ENDPOINTS.ask);
    }
    return await res.json();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(err.message || "Failed to query combustion intelligence service", 500, CONFIG.ENDPOINTS.ask);
  }
}

/**
 * Fetch available preset environments and fuels for risk calculations
 * @returns {Promise<{presets: Array, fuels: Array}>}
 */
export async function getEnvironmentCatalog() {
  await delay(40);
  return {
    presets: JSON.parse(JSON.stringify(MOCK_DATA.presets)),
    fuels: JSON.parse(JSON.stringify(MOCK_DATA.fuels))
  };
}
