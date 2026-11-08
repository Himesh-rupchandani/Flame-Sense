/**
 * FlameSense Configuration & Service Endpoints
 * Flipping USE_MOCK to false and configuring API_BASE connects to the real backend service.
 */
export const CONFIG = {
  API_BASE: "",
  USE_MOCK: true,
  ENDPOINTS: {
    meta: "/meta",
    investigations: "/investigations",
    investigation: "/investigations/{id}",
    predict: "/predict",
    ask: "/ask"
  }
};
