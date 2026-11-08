# FlameSense — NASA Microgravity Flammability & Combustion Intelligence

Utilitarian internal enterprise dashboard built for NASA microgravity flammability analysis and combustion risk exploration across ISS, Cygnus, and lunar exploration habitats (Artemis program).

---

## 1. Quickstart & How to Run

FlameSense is a **ZERO build, ZERO npm, ZERO backend, ZERO external CDN** application built strictly with standard HTML5, CSS3, and modern ECMAScript Modules (ESM). It runs instantly in any modern browser.

### Option A: Local Python Server (Recommended for ESM)
Because modern browsers restrict ES module imports across `file://` origins for security, run a simple local web server:

```bash
# Python 3
python3 -m http.server 3000

# Open in browser
http://localhost:3000/
```

### Option B: Node / Vite Dev Server (Included in repository)
```bash
npm run dev
# Serves on http://localhost:3000
```

### Option C: Any Static Web Server
Compatible with NGINX, Apache, Caddy, GitHub Pages, or Cloud Run without any transpilation or build step.

---

## 2. File Map

```text
.
├── index.html                       # Semantic HTML entry point, accessibility landmarks, base layout
├── assets/
│   └── styles.css                   # Dense utilitarian enterprise CSS (exact hex palette, system fonts only)
├── js/
│   ├── app.js                       # Hash router (#/overview, #/experiments, #/experiment/{id}, #/risk, #/ask, #/about)
│   ├── config.js                    # Service configuration (API_BASE, USE_MOCK flag, endpoint registry)
│   ├── services/
│   │   ├── api.js                   # Central data access layer (typed ApiError, mock/remote fetch routing)
│   │   └── mock-data.js             # 8 flight investigations, telemetry scatter points, physics prediction formula
│   └── components/
│       ├── topbar.js                # 48px header with flame SVG glyph and DEMO DATA status chip
│       ├── tabnav.js                # Tab navigation strip with active indicator underlined in --accent
│       ├── investigation-table.js   # Overview metrics, top 5, pillar coverage, and searchable experiments table
│       ├── investigation-detail.js  # Deep-dive view with SVG scatter plot and relevance breakdown bars
│       ├── risk-explorer.js         # Centrepiece: circular needle gauge, 4 instrument sliders, fuel toggles
│       ├── ask-panel.js             # Semantic inquiry interface with ruled-line input & flight report citations
│       └── about.js                 # System architecture, NASA data sources, and backend readiness matrix
├── metadata.json                    # AI Studio applet configuration and capabilities
└── README.md                        # Documentation and backend integration roadmap
```

---

## 3. Data Contract & Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/meta` | `GET` | Aggregated flight archive counts (investigations, runs, model MAE, R²) |
| `/investigations` | `GET` | Searchable & filterable array of flight investigations (`search`, `pillar`, `fuelClass`, `hardware`, `sortBy`) |
| `/investigations/{id}` | `GET` | Comprehensive details, scatter telemetry, and citations for a single investigation |
| `/predict` | `POST` | Deterministic combustion risk prediction accepting `{ o2, pressure, airflow, fuelId, thickness }` |
| `/ask` | `POST` | Semantic query interface returning synthesized answer with NTRS citation links |

---

## 4. 6-Step Checklist: Connect Backend Later

Follow these six steps when migrating from the local mock simulation to a production backend service (FastAPI, Flask, Express, or Cloud Run microservices):

1. **Deploy Your API Service**  
   Deploy your backend endpoints exposing `/meta`, `/investigations`, `/investigations/{id}`, `/predict`, and `/ask` matching the schemas outlined in `js/services/mock-data.js`. Ensure CORS headers permit requests from your frontend domain.

2. **Update Service Configuration (`js/config.js`)**  
   Set `USE_MOCK` to `false` and specify your backend base URL:
   ```javascript
   export const CONFIG = {
     API_BASE: "https://api.flamesense.nasa.gov",
     USE_MOCK: false,
     ENDPOINTS: {
       meta: "/meta",
       investigations: "/investigations",
       investigation: "/investigations/{id}",
       predict: "/predict",
       ask: "/ask"
     }
   };
   ```

3. **Verify API Abstraction Layer (`js/services/api.js`)**  
   All components strictly import `api.js` and never touch `mock-data.js`. Verify that the pre-existing `fetch()` branches in `api.js` (tagged with `// BACKEND-TODO:`) handle your authentication headers or tokens (e.g. `Authorization: Bearer <TOKEN>`) if required.

4. **Calibrate the Prediction Model (`/predict`)**  
   Replace the local empirical formula in `mock-data.js` with your trained PyTorch, XGBoost, or Scikit-learn model deployed behind your `/predict` endpoint. Return JSON containing `score` (0-100), `locPercent`, `band`, `verdict`, and `contributions`.

5. **Connect RAG / Document Embeddings (`/ask`)**  
   Connect the `/ask` route to an embedding vector database (e.g. pgvector or Vertex AI Search) populated with NASA Technical Reports Server (NTRS) PDFs and NASA-STD-6001B specifications.

6. **Toggle Frontend Mode Indicator (`js/components/topbar.js`)**  
   Update or remove the `DEMO DATA` badge in `topbar.js` to reflect live connected flight telemetry.
