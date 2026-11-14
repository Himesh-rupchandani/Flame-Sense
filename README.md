# Flame in Freefall (Flame-Sense)

**Understanding Space Fire. Ensuring Astronaut Safety.**  
*NASA Hackathon 2026 — Microgravity Combustion Research, Data Lab & Spacecraft Fire-Risk Exploration Platform.*

Flame in Freefall is a full-stack React + TypeScript + Express + SQLite research application for exploring microgravity combustion experiments (BASS, BASS-II, Saffire, FLEX-2, CFI, and dynamic admin-managed studies), inspecting arbitrary `.csv` telemetry datasets in an interactive **Data Lab**, ranking crew-safety relevance, and simulating cabin flammability limits with exact Shapley (SHAP) attribution.

---

## 1. Tech Stack

- **Frontend**: React 19, TypeScript, Vite 6, Tailwind CSS 4, React Router 7, Lucide Icons
- **Backend**: Node.js, Express (`server.ts`), `tsx`, `multer` (multipart CSV upload), `pdfkit` (binary PDF report generation), `cors`
- **Database**: Built-in SQLite via `node:sqlite` (`DatabaseSync`) stored in `data/flame_in_freefall.db`
- **ML Prediction Service**: Python 3.11+, Scikit-learn, Pandas, NumPy, Joblib, FastAPI + Uvicorn (`ml/service.py`)
- **Optional Integrations**:
  - `GEMINI_API_KEY`: Server-side research explanation enhancement via `@google/genai`
  - `ML_BACKEND_URL`: URL of the Python ML microservice (default `http://127.0.0.1:8001`)

---

## 2. Quickstart & Commands

### Install Node & Python Dependencies
```bash
npm install
pip3 install -r ml/requirements.txt
# On PEP 668 systems (e.g., Debian/Ubuntu system Python):
# python3 -m pip install --break-system-packages -r ml/requirements.txt
```

### Prepare Training Dataset & Train the ML Classifier
```bash
# 1. Extract project CSV datasets from SQLite & build labeled training CSV (clearly tagged DEMO/SYNTHETIC DATA)
npm run ml:prepare
# Or: python3 ml/prepare_dataset.py

# 2. Validate dataset, compare Random Forest vs Logistic Regression vs Gradient Boosting, evaluate metrics & save .joblib
npm run ml:train
# Or: python3 ml/train_model.py
```

### Re-train on a Custom / Real Experimental CSV Later
```bash
python3 ml/train_model.py --dataset /path/to/your_experimental_dataset.csv --provenance "Verified Experimental Dataset"
```
Expected CSV columns: `oxygen_pct` (`21–85`), `pressure_psi` (`4.3–14.7`), `airflow_cm_s` (`0–100`), `fuel_type` (`solid-fabric | plastic | liquid | gas`), `risk_category` (`SAFE | CAUTION | DANGER`).

### Run Both Services (Python ML Service + Node.js Express Backend)
Open two terminals:

**Terminal 1 — Python ML Prediction Service (Port 8001):**
```bash
npm run ml:serve
# Starts FastAPI + Uvicorn at http://127.0.0.1:8001
```

**Terminal 2 — Node.js Express + Vite Frontend Server (Port 3000):**
```bash
npm run dev
# Opens http://localhost:3000 and connects to ML_BACKEND_URL=http://127.0.0.1:8001
```

### Type-Check & Build Production Bundle
```bash
npm run lint
npm run build
npm start
```

---

## 3. Environment Variables (`.env.example`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3000` | HTTP server port for Express & Vite dev middleware |
| `ML_BACKEND_URL` | Yes (for `/prediction`) | `http://127.0.0.1:8001` | Python FastAPI + Scikit-learn ML microservice endpoint (`GET /health`, `GET /model-info`, `POST /predict`) |
| `GEMINI_API_KEY` | No | — | Optional Gemini API key for server-side scientific explanation enrichment |
| `ADMIN_ACCESS_CODE` | Recommended in Prod | `FLAME-ADMIN-2026` (dev fallback) | Passcode for `POST /api/admin/session` research admin CRUD |
| `CORS_ORIGINS` | No | `http://localhost:3000,...` | Comma-separated allowed origins for cross-origin API requests |
| `DATALAB_SESSION_SECRET` | Recommended in Prod | Ephemeral dev secret | HMAC secret signing session-isolated Data Lab tokens |

---

## 4. Architecture & Project Structure

```text
.
├── ml/
│   ├── requirements.txt               # scikit-learn, pandas, numpy, joblib, fastapi, uvicorn, pydantic
│   ├── prepare_dataset.py             # Extracts project CSVs from SQLite & builds tagged DEMO/SYNTHETIC training CSV
│   ├── train_model.py                 # Schema/bounds validation, 80/20 split, RF vs LR vs GB comparison, .joblib export
│   ├── service.py                     # FastAPI inference server (/health, /model-info, /predict + ML Shapley)
│   ├── data/                          # Generated project CSV extracts & flame_sense_training.csv
│   └── artifacts/                     # Saved flame_risk_model.joblib & model_metadata.json
├── server.ts                          # Express HTTP server, Vite dev/prod mounting, REST API & ML proxy routes
├── server/
│   ├── database.ts                    # SQLite schema initialization, migrations & NASA/demo seed data
│   └── services/
│       ├── dataLabService.ts          # CSV validation, profiling, Pearson correlations, exploratory bridge, PDFKit
│       ├── experimentService.ts       # Dynamic experiments, parameters, findings, datasets, references
│       ├── insightsService.ts         # Sensitivity sweeps & empirical summary synthesis
│       ├── predictionService.ts       # Strict Python ML service proxy (returns HTTP 503 if ML service offline) & SQLite persistence
│       └── rankingService.ts          # Weighted crew-safety relevance scoring & breakdown
├── src/
│   ├── App.tsx                        # React Router 7 routes (/, /about, /experiments, /experiments/:slug, /ranking, /prediction, /data-lab, /insights, /contact)
│   ├── services/apiClient.ts          # Typed REST client & Data Lab session storage helpers
│   ├── types/experiments.ts           # Shared TypeScript contracts for experiments, datasets, Data Lab
│   ├── components/                    # Navbar, Footer, DynamicChartRenderer, DatasetExplorer, VerificationBadge, AdminExperimentDrawer
│   └── pages/                         # HomePage, AboutPage, ExperimentsPage, ExperimentDetailPage, RankingPage, PredictionPage, DataLabPage, InsightsPage, ContactPage
└── data/                              # Runtime SQLite database directory (gitignored)
```

---

## 5. REST API Reference

### Health & Core Research Catalog
- `GET /api/health` — Database status, live Python ML microservice connectivity (`mlServiceConnected`), active Scikit-learn model name, dataset provenance (`isSyntheticDemoData`), and held-out test evaluation metrics.
- `GET /api/model-info` — Proxies full Scikit-learn model metadata, algorithm comparison table, validation report, and confusion matrix from the Python service.
- `GET /api/experiments` — Paginated, filterable, sortable experiment catalog (`search`, `category`, `verificationStatus`, `datasetAvailability`, `sortBy`, `page`, `limit`).
- `GET /api/experiments/categories` — Aggregated categories and verification status counts.
- `GET /api/experiments/statistics` — Summary counts and peer comparison metrics.
- `GET /api/experiments/:slug` — Full experiment record including dynamic parameters, findings, datasets, references, and related studies.
- `GET /api/experiments/:slug/datasets/:datasetId/preview` & `/download` — Dynamic CSV column statistics, row preview, and verified/authorized CSV download.
- `GET /api/rankings` — Weighted crew-safety relevance rankings and criteria weights.
- `GET /api/insights` — Parameter sensitivity series (`fuelType`, `pressurePsi`, `airflowCmS`) and research highlights.
- `POST /api/contact` — Validates and persists contact/research inquiries in SQLite.

### Fire Risk Prediction & Explainability
- `POST /api/predictions` (alias `POST /api/predict`) — Validates bounds (`oxygenPct` 21–85%, `pressurePsi` 4.3–14.7 psi, `airflowCmS` 0–100 cm/s, `fuelType` in `solid-fabric | plastic | liquid | gas`), forwards to the Python Scikit-learn ML service (`ML_BACKEND_URL/predict`), stores the predicted category (`SAFE | CAUTION | DANGER`), confidence %, class probabilities, evaluation summary, and exact ML Shapley values in SQLite. **Returns HTTP `503` explicitly if the Python ML service is unavailable (never falls back to a formula).**
- `GET /api/predictions` & `GET /api/predictions/:id` — Retrieve persisted prediction runs.

### Interactive Data Lab (`/data-lab`)
- `POST /api/data-lab/session` — Issues an HMAC-signed Data Lab session token (`x-datalab-session`).
- `GET /api/data-lab/datasets` — Lists uploaded datasets belonging strictly to the caller's session.
- `POST /api/data-lab/upload` — Accepts multipart `.csv` upload (≤ 5 MB, ≤ 25,000 rows, ≤ 100 columns) or JSON CSV payload; validates encoding/structure and computes column types, missingness, duplicates, histograms, Pearson correlations, and combustion compatibility.
- `GET /api/data-lab/datasets/:id` — Retrieves full parsed inspection metadata and row preview for a session-owned dataset.
- `POST /api/data-lab/datasets/:id/analyze` — Evaluates selected columns, chart series (`line`, `bar`, `scatter`, `distribution`, `correlation`), and compatibility checks.
- `GET /api/data-lab/datasets/:id/report?format=pdf|json|csv` — Downloads an analyzed CSV subset, structured JSON report, or generated binary PDF summary (`pdfkit`).
- `DELETE /api/data-lab/datasets/:id` — Deletes a session-owned dataset from SQLite.

### Protected Research Admin (`Authorization: Bearer <token>`)
- `POST /api/admin/session` — Exchanges `ADMIN_ACCESS_CODE` for a temporary admin bearer token.
- `POST|PUT|DELETE /api/admin/experiments` and nested sub-resources (`/parameters`, `/findings`, `/datasets`, `/references`) — Full dynamic research catalog management.

---

## 6. Scientific Provenance, Methodology & Honest Limitations

1. **Provenance Labels Everywhere**: Records are explicitly tagged as **NASA Verified**, **Illustrative Demo**, **Pending Verification**, or **User-Uploaded Data** (`Data Lab`). Illustrative/synthetic sample rows are never presented as official NASA flight telemetry.
2. **ML Training Data Disclosure (`DEMO / SYNTHETIC DATA`)**: The initial Scikit-learn classifier is trained on `ml/data/flame_sense_training.csv`, which combines parameter snapshots from the project's existing CSV datasets with clearly tagged synthetic microgravity sweeps across `SAFE`, `CAUTION`, and `DANGER`. It is designed for hackathon research demonstration and can be re-trained immediately when real NASA experimental labeled datasets are supplied.
3. **Strict No-Formula-Fallback Guarantee**: The `/api/predictions` endpoint strictly requires the Python Scikit-learn ML microservice (`ml/service.py`). If the Python service is stopped or unreachable, Express returns HTTP `503` and the UI displays an explicit `Python ML Prediction Service Unavailable` banner rather than fabricating formula results.
