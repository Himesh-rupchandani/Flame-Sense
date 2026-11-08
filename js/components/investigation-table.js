/**
 * Investigation Table & Overview Components
 * Handles the Overview dashboard (KPI cards, top 5 table, pillar coverage)
 * and the Experiments explorer (filters, sorting, data table, empty states).
 */

import { getMeta, getInvestigations } from "../services/api.js";

/**
 * Render Overview Dashboard Screen
 */
export async function renderOverview(container) {
  container.innerHTML = `
    <!-- Eye-Catching Scientific Hero Stage Banner -->
    <section class="hero-stage-card" aria-label="Microgravity Combustion Hero Stage">
      <div class="hero-stage-image-wrap">
        <img
          src="/src/assets/images/hero_microgravity_flame_1794122765420.jpg"
          alt="Glowing spherical microgravity flame inside NASA combustion chamber"
          class="hero-stage-img"
          loading="eager"
          referrerpolicy="no-referrer"
        />
        <div class="hero-scrim-gradient" aria-hidden="true"></div>
      </div>

      <div class="hero-stage-content">
        <div>
          <div class="hero-telemetry-badge">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="10"></circle>
            </svg>
            NASA ISS TELEMETRY ARCHIVE &bull; FLIGHT COMBUS-07
          </div>
          <h1 class="hero-title-headline">
            Predicting Fire Spread Where Buoyancy Ceases to Exist
          </h1>
          <p class="hero-description-text">
            Without natural gravity convection, flames burn spherical, silent, and cooler—yet steady airflow drafts from cabin life-support loops (0.5 – 15 cm/s) dramatically lower Limiting Oxygen Concentrations.
          </p>
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div class="hero-telemetry-dock" aria-label="Flight Telemetry Readout">
            <div class="hero-dock-item">
              <span class="hero-dock-label">Combustion Mode</span>
              <span class="hero-dock-val" style="color: #34D399;">SPHERICAL DIFFUSION</span>
            </div>
            <div class="hero-dock-item">
              <span class="hero-dock-label">Gravity State</span>
              <span class="hero-dock-val">g &asymp; 0.0001 g</span>
            </div>
            <div class="hero-dock-item">
              <span class="hero-dock-label">Artemis Baseline</span>
              <span class="hero-dock-val" style="color: var(--orange);">30% O<sub>2</sub> @ 10.2 PSI</span>
            </div>
            <div class="hero-dock-item">
              <span class="hero-dock-label">Model Status</span>
              <span class="hero-dock-val">CALIBRATED (R&sup2; 0.81)</span>
            </div>
          </div>

          <div class="hero-stage-actions">
            <a href="#/risk" class="btn btn-accent" style="padding: 9px 18px; font-weight: 600;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              Launch Fire Risk Explorer
            </a>
            <a href="#/experiments" class="btn" style="background: rgba(255, 255, 255, 0.12); color: #FFFFFF; border-color: rgba(255, 255, 255, 0.25); backdrop-filter: blur(4px); padding: 9px 16px;">
              Browse 24 Flight Investigations &rarr;
            </a>
          </div>
        </div>
      </div>
    </section>

    <!-- 4 Structured KPI Cards -->
    <div class="kpi-grid" id="kpi-container" aria-label="Key Performance Indicators">
      <div class="kpi-card">
        <div class="skeleton-line w-half"></div>
        <div class="skeleton-line w-third" style="height: 28px;"></div>
        <div class="skeleton-line w-full"></div>
      </div>
      <div class="kpi-card">
        <div class="skeleton-line w-half"></div>
        <div class="skeleton-line w-third" style="height: 28px;"></div>
        <div class="skeleton-line w-full"></div>
      </div>
      <div class="kpi-card">
        <div class="skeleton-line w-half"></div>
        <div class="skeleton-line w-third" style="height: 28px;"></div>
        <div class="skeleton-line w-full"></div>
      </div>
      <div class="kpi-card">
        <div class="skeleton-line w-half"></div>
        <div class="skeleton-line w-third" style="height: 28px;"></div>
        <div class="skeleton-line w-full"></div>
      </div>
    </div>

    <!-- Featured Flight Investigations Visual Bento Showcase -->
    <div style="margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px;">
        <h2 style="font-size: 14.5px; font-weight: 600; color: var(--ink);">
          Key Flight Combat &amp; Extinguishment Studies
        </h2>
        <span class="font-mono" style="font-size: 11px; color: var(--muted);">IN SITU SPACE OBSERVATIONS</span>
      </div>

      <div class="featured-grid">
        <!-- Card 1: Saffire-III -->
        <a href="#/experiment/saffire-iii" class="featured-bento-card">
          <div class="bento-image-wrap">
            <img
              src="/src/assets/images/saffire_flame_duct_1794122766942.jpg"
              alt="Saffire-III flame duct propagation"
              class="bento-img"
              loading="lazy"
              referrerpolicy="no-referrer"
            />
            <span class="bento-chip-overlay">CYGNUS FLOW DUCT</span>
          </div>
          <div class="bento-body">
            <div>
              <div class="bento-title-row">
                <span class="bento-title">Saffire-III</span>
                <span class="bento-relevance">95% REL</span>
              </div>
              <p class="bento-desc">
                Large-scale spacecraft fire safety test in expendable cargo ship. High-velocity duct flow accelerated flame propagation.
              </p>
            </div>
            <div class="bento-footer">
              <span>SUPPRESSION PILLAR</span>
              <span>2017 &bull; MICRO-G</span>
            </div>
          </div>
        </a>

        <!-- Card 2: BASS-II -->
        <a href="#/experiment/bass-ii" class="featured-bento-card">
          <div class="bento-image-wrap">
            <img
              src="/src/assets/images/iss_glovebox_combustion_1794122767129.jpg"
              alt="Astronaut operating BASS-II Microgravity Glovebox"
              class="bento-img"
              loading="lazy"
              referrerpolicy="no-referrer"
            />
            <span class="bento-chip-overlay">ISS GLOVEBOX (MSG)</span>
          </div>
          <div class="bento-body">
            <div>
              <div class="bento-title-row">
                <span class="bento-title">BASS-II</span>
                <span class="bento-relevance">92% REL</span>
              </div>
              <p class="bento-desc">
                Textured Nomex and cotton flame extinguishment via nitrogen purge and ventilation cutoff aboard the Space Station.
              </p>
            </div>
            <div class="bento-footer">
              <span>SUPPRESSION PILLAR</span>
              <span>2015 &bull; MICRO-G</span>
            </div>
          </div>
        </a>

        <!-- Card 3: FLEX-2 -->
        <a href="#/experiment/flex-2" class="featured-bento-card">
          <div class="bento-image-wrap">
            <img
              src="/src/assets/images/droplet_cool_flame_1794122766620.jpg"
              alt="Spherical fuel droplet cool flame"
              class="bento-img"
              loading="lazy"
              referrerpolicy="no-referrer"
            />
            <span class="bento-chip-overlay">COMBUSTION RACK (CIR)</span>
          </div>
          <div class="bento-body">
            <div>
              <div class="bento-title-row">
                <span class="bento-title">FLEX-2</span>
                <span class="bento-relevance">84% REL</span>
              </div>
              <p class="bento-desc">
                Discovered quasi-steady 'cool flame' burning for alkane droplets after radiant extinction, unmasking vapor explosion risks.
              </p>
            </div>
            <div class="bento-footer">
              <span>LIQUID FUEL PILLAR</span>
              <span>2014 &bull; MICRO-G</span>
            </div>
          </div>
        </a>
      </div>
    </div>

    <!-- Main Grid: Top 5 Investigations + Pillar Coverage -->
    <div class="two-col-grid">
      <!-- Top 5 Investigations Table -->
      <section class="section-panel" style="margin-bottom: 0;">
        <header class="panel-header">
          <div>
            <h2 class="panel-title">Top Investigations by Flight Relevance</h2>
            <div class="panel-subtitle">Ranked by applicability to crew life safety &amp; exploration habitats</div>
          </div>
          <a href="#/experiments" class="font-mono" style="font-size: 11px; font-weight: 600;">
            View All 24 &rarr;
          </a>
        </header>
        <div class="panel-body" style="padding: 0;">
          <div class="table-wrap">
            <table class="data-table" id="top-investigations-table">
              <thead>
                <tr>
                  <th style="width: 44px; text-align: center;">Rank</th>
                  <th style="width: 140px;">Investigation</th>
                  <th>Operational Focus</th>
                  <th style="text-align: right; width: 110px;">Relevance</th>
                </tr>
              </thead>
              <tbody id="top-tbody">
                <tr>
                  <td colspan="4" class="empty-state">Loading flight dataset...</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- Pillar Coverage Visualization -->
      <section class="section-panel" style="margin-bottom: 0;">
        <header class="panel-header">
          <div>
            <h2 class="panel-title">Safety Pillar Coverage</h2>
            <div class="panel-subtitle">NASA Spacecraft Fire Safety Research Triad</div>
          </div>
          <span class="font-mono" style="font-size: 11px; color: var(--muted);">24 Total Tests</span>
        </header>
        <div class="panel-body" id="pillar-coverage-container">
          <div class="skeleton-line w-full" style="height: 48px; margin-bottom: 12px;"></div>
          <div class="skeleton-line w-full" style="height: 48px; margin-bottom: 12px;"></div>
          <div class="skeleton-line w-full" style="height: 48px;"></div>
        </div>
      </section>
    </div>

    <!-- Scientific Context Panel -->
    <section class="section-panel" style="margin-top: 18px;">
      <header class="panel-header">
        <div>
          <h2 class="panel-title">Microgravity Combustion Physics Rationale</h2>
          <div class="panel-subtitle">Bridging NASA-STD-6001B Terrestrial Testing &amp; Reduced-Gravity Envelopes</div>
        </div>
        <span class="badge badge-hardware">ECLSS INTEGRATION</span>
      </header>
      <div class="panel-body">
        <p style="color: var(--ink); font-weight: 500; line-height: 1.55;">
          On Earth, combustion products are rapidly driven upward by buoyant Archimedean convection, drawing fresh air into the flame base. In microgravity (ISS, lunar surface habitats, and deep space transit vehicles), natural buoyancy is nearly eliminated.
        </p>
        <p style="color: var(--body); font-size: 12.5px; line-height: 1.55; margin-top: 8px;">
          Combustion is instead controlled by molecular diffusion and forced cabin ventilation (typically 0.5 to 15 cm/s). Under low airflow, soot radiation can extinguish flames that would burn briskly on Earth. Conversely, under forced ventilation in enriched-oxygen exploration atmospheres (such as the Artemis lunar habitat baseline of 30% O<sub>2</sub> at 10.2 psi / 70.3 kPa), materials exhibit significantly reduced Limiting Oxygen Concentrations (LOC), making pre-screening through standard 1g upward flame tests (NASA Test 1) insufficient for human mission certification.
        </p>
      </div>
    </section>
  `;

  try {
    const [meta, items] = await Promise.all([
      getMeta(),
      getInvestigations({ sortBy: "relevance-desc" })
    ]);

    // Render KPI Cards
    const kpiContainer = container.querySelector("#kpi-container");
    if (kpiContainer) {
      kpiContainer.innerHTML = `
        <!-- Card 1: Investigations Indexed -->
        <div class="kpi-card" tabindex="0" role="region" aria-label="Investigations Indexed">
          <div class="kpi-top-row">
            <span class="kpi-label">Investigations Indexed</span>
            <div class="kpi-icon" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
              </svg>
            </div>
          </div>
          <div class="kpi-value-row">
            <span class="kpi-number">${meta.investigations}</span>
            <span class="kpi-unit">FLIGHT EXPERIMENTS</span>
          </div>
          <p class="kpi-desc">
            NASA GRC &amp; MSFC archives across ISS MSG, CIR &amp; Cygnus vehicles
          </p>
        </div>

        <!-- Card 2: Test Runs -->
        <div class="kpi-card" tabindex="0" role="region" aria-label="Test Runs">
          <div class="kpi-top-row">
            <span class="kpi-label">Digitized Test Runs</span>
            <div class="kpi-icon" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
              </svg>
            </div>
          </div>
          <div class="kpi-value-row">
            <span class="kpi-number">${meta.runs.toLocaleString()}</span>
            <span class="kpi-unit">SAMPLE IGNITIONS</span>
          </div>
          <p class="kpi-desc">
            High-speed radiometer &amp; video burn spread telemetry points
          </p>
        </div>

        <!-- Card 3: Fuels Covered -->
        <div class="kpi-card" tabindex="0" role="region" aria-label="Fuels Covered">
          <div class="kpi-top-row">
            <span class="kpi-label">Fuels Covered</span>
            <div class="kpi-icon" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10 2v7.31"></path>
                <path d="M14 9.3V1.99"></path>
                <path d="M8.5 2h7"></path>
                <path d="M14 9.3a6.5 6.5 0 1 1-4 0"></path>
                <path d="M5.52 16h12.96"></path>
              </svg>
            </div>
          </div>
          <div class="kpi-value-row">
            <span class="kpi-number">6</span>
            <span class="kpi-unit">STANDARDIZED CLASSES</span>
          </div>
          <p class="kpi-desc">
            Fabrics (Nomex/Cotton), polymers (PMMA/HDPE), &amp; droplet regimes
          </p>
        </div>

        <!-- Card 4: Model MAE with R2 and Last-Trained -->
        <div class="kpi-card" tabindex="0" role="region" aria-label="Model Accuracy">
          <div class="kpi-top-row">
            <span class="kpi-label">Model MAE</span>
            <div class="kpi-icon" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="m4.93 4.93 4.24 4.24"></path>
                <path d="m14.83 9.17 4.24-4.24"></path>
                <path d="m14.83 14.83 4.24 4.24"></path>
                <path d="m9.17 14.83-4.24 4.24"></path>
                <circle cx="12" cy="12" r="2"></circle>
              </svg>
            </div>
          </div>
          <div class="kpi-value-row">
            <span class="kpi-number">${meta.modelMae.toFixed(1)}%</span>
            <span class="kpi-unit">LOC FIT ERROR</span>
          </div>
          <div class="kpi-mae-metrics">
            <span><strong>R&sup2;:</strong> ${meta.modelR2}</span>
            <span>&bull;</span>
            <span><strong>Trained:</strong> ${meta.lastTrained}</span>
          </div>
        </div>
      `;
    }

    // Render Top 5 Investigations Table
    const topTbody = container.querySelector("#top-tbody");
    if (topTbody) {
      const top5 = items.slice(0, 5);
      topTbody.innerHTML = top5.map((item, idx) => `
        <tr
          class="clickable-row"
          onclick="location.hash='#/experiment/${item.id}'"
          tabindex="0"
          role="link"
          aria-label="View ${item.name} details"
        >
          <td style="text-align: center; font-family: var(--font-mono); font-weight: 600; color: var(--muted);">
            #${idx + 1}
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="width: 44px; height: 30px; border-radius: 8px; overflow: hidden; flex-shrink: 0; background-color: #0F172A; border: 1px solid var(--border-subtle); box-shadow: 0 1px 3px rgba(0,0,0,0.06);" aria-hidden="true">
                <img
                  src="${item.image || '/src/assets/images/hero_microgravity_flame_1794122765420.jpg'}"
                  alt=""
                  style="width: 100%; height: 100%; object-fit: cover; border-radius: 7px; display: block;"
                  loading="lazy"
                  referrerpolicy="no-referrer"
                />
              </div>
              <div>
                <a href="#/experiment/${item.id}" class="table-cell-title">
                  ${item.name}
                </a>
                <div style="font-size: 11px; color: var(--muted); margin-top: 1px;">
                  ${item.hardware} &bull; ${item.year}
                </div>
              </div>
            </div>
          </td>
          <td style="font-size: 12.5px; color: var(--body); line-height: 1.4;">
            ${item.summary.slice(0, 85)}...
          </td>
          <td style="text-align: right;">
            <div class="relevance-cell" style="justify-content: flex-end;">
              <div class="micro-bar-track" aria-hidden="true">
                <div class="micro-bar-fill" style="width: ${item.relevance}%;"></div>
              </div>
              <span class="font-mono" style="font-weight: 700; font-size: 12px; color: var(--accent);">
                ${item.relevance}%
              </span>
            </div>
          </td>
        </tr>
      `).join("");

      // Keyboard accessibility
      topTbody.querySelectorAll(".clickable-row").forEach(row => {
        row.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            const href = row.querySelector("a")?.getAttribute("href");
            if (href) window.location.hash = href;
          }
        });
      });
    }

    // Render Pillar Coverage with subtle green variations
    const pillarContainer = container.querySelector("#pillar-coverage-container");
    if (pillarContainer) {
      const counts = { prevention: 0, detection: 0, suppression: 0 };
      items.forEach(i => {
        if (counts[i.pillar] !== undefined) counts[i.pillar]++;
      });

      const maxCount = Math.max(1, items.length);
      const pillars = [
        {
          label: "Prevention",
          key: "prevention",
          desc: "Material screening, LOC limits & flammability",
          fillClass: "fill-dark"
        },
        {
          label: "Detection",
          key: "detection",
          desc: "Smoke particle sizing & optical sensor arrays",
          fillClass: "fill-emerald"
        },
        {
          label: "Suppression",
          key: "suppression",
          desc: "N2 inerting, airflow cut-off & cool-flame quenching",
          fillClass: ""
        }
      ];

      pillarContainer.innerHTML = pillars.map(p => {
        const count = counts[p.key] || 0;
        const pct = Math.round((count / maxCount) * 100);
        return `
          <div class="pillar-row">
            <div class="pillar-info">
              <div class="pillar-title">${p.label}</div>
              <div class="pillar-desc">${p.desc}</div>
            </div>
            <div class="pillar-track" aria-hidden="true">
              <div class="pillar-fill ${p.fillClass}" style="width: ${pct}%;"></div>
            </div>
            <div class="pillar-count-box">
              ${count} tests
              <div style="font-size: 10px; color: var(--muted); font-weight: 400;">${pct}% corpus</div>
            </div>
          </div>
        `;
      }).join("") + `
        <div style="font-size: 11px; color: var(--muted); margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--border-subtle); display: flex; justify-content: space-between;">
          <span>Comprehensive research coverage across all three NASA safety pillars.</span>
          <span class="font-mono">STD-6001B COMPLIANT</span>
        </div>
      `;
    }

  } catch (err) {
    container.innerHTML = `
      <div class="error-banner">
        <span>Failed to load overview data: ${err.message}</span>
        <button class="btn btn-outline" id="retry-overview-btn">Retry</button>
      </div>
    `;
    container.querySelector("#retry-overview-btn")?.addEventListener("click", () => renderOverview(container));
  }
}

/**
 * Filter state for Experiments Explorer
 */
let expFilters = {
  search: "",
  pillar: "all",
  fuelClass: "all",
  hardware: "all",
  sortBy: "relevance-desc"
};

/**
 * Render Experiments Table Screen
 */
export async function renderExperiments(container) {
  container.innerHTML = `
    <div class="section-panel" style="margin-bottom: 0; border-radius: 12px 12px 0 0;">
      <div class="panel-header">
        <div>
          <h1 class="panel-title" style="font-size: 16px;">Flight &amp; Microgravity Combustion Investigations</h1>
          <div class="panel-subtitle">Searchable empirical database of NASA orbital and flight combustor trials</div>
        </div>
        <span class="filter-count" id="exp-count-label">Loading dataset...</span>
      </div>

      <!-- Filter Controls Strip -->
      <div class="filter-strip" role="search" aria-label="Filter investigations">
        <div class="search-input-wrap">
          <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="search"
            id="exp-search"
            class="filter-input"
            placeholder="Search experiments, fuels, hardware, authors..."
            value="${expFilters.search}"
            aria-label="Search experiments"
          />
        </div>

        <select id="filter-pillar" class="filter-select" aria-label="Filter by Pillar">
          <option value="all" ${expFilters.pillar === "all" ? "selected" : ""}>All Pillars</option>
          <option value="prevention" ${expFilters.pillar === "prevention" ? "selected" : ""}>Prevention</option>
          <option value="detection" ${expFilters.pillar === "detection" ? "selected" : ""}>Detection</option>
          <option value="suppression" ${expFilters.pillar === "suppression" ? "selected" : ""}>Suppression</option>
        </select>

        <select id="filter-fuel" class="filter-select" aria-label="Filter by Fuel Class">
          <option value="all" ${expFilters.fuelClass === "all" ? "selected" : ""}>All Fuel Classes</option>
          <option value="solid-fabric" ${expFilters.fuelClass === "solid-fabric" ? "selected" : ""}>Solid Fabric (Cotton, Nomex)</option>
          <option value="solid-plastic" ${expFilters.fuelClass === "solid-plastic" ? "selected" : ""}>Solid Plastic (PMMA, HDPE)</option>
          <option value="liquid-droplet" ${expFilters.fuelClass === "liquid-droplet" ? "selected" : ""}>Liquid Droplet (Alkanes)</option>
          <option value="gas" ${expFilters.fuelClass === "gas" ? "selected" : ""}>Gaseous Fuel</option>
        </select>

        <select id="filter-hardware" class="filter-select" aria-label="Filter by Hardware">
          <option value="all" ${expFilters.hardware === "all" ? "selected" : ""}>All Hardware</option>
          <option value="MSG" ${expFilters.hardware === "MSG" ? "selected" : ""}>MSG (Glovebox)</option>
          <option value="CIR" ${expFilters.hardware === "CIR" ? "selected" : ""}>CIR (Combustion Rack)</option>
          <option value="Flow duct" ${expFilters.hardware === "Flow duct" ? "selected" : ""}>Flow duct (Saffire)</option>
        </select>

        <select id="filter-sort" class="filter-select" aria-label="Sort investigations">
          <option value="relevance-desc" ${expFilters.sortBy === "relevance-desc" ? "selected" : ""}>Sort: Highest Relevance</option>
          <option value="relevance-asc" ${expFilters.sortBy === "relevance-asc" ? "selected" : ""}>Sort: Lowest Relevance</option>
          <option value="year-desc" ${expFilters.sortBy === "year-desc" ? "selected" : ""}>Sort: Year (Newest)</option>
          <option value="year-asc" ${expFilters.sortBy === "year-asc" ? "selected" : ""}>Sort: Year (Oldest)</option>
          <option value="name-asc" ${expFilters.sortBy === "name-asc" ? "selected" : ""}>Sort: Name (A-Z)</option>
        </select>
      </div>
    </div>

    <!-- Structured Table -->
    <div class="table-wrap" style="border: 1px solid var(--border); border-top: none; border-radius: 0 0 12px 12px; background-color: var(--panel);">
      <table class="data-table" id="investigations-main-table">
        <thead>
          <tr>
            <th class="sortable" data-sort="name" style="width: 220px;">
              Investigation <span class="sort-caret" id="caret-name"></span>
            </th>
            <th class="sortable" data-sort="pillar" style="width: 120px;">
              Pillar <span class="sort-caret" id="caret-pillar"></span>
            </th>
            <th style="width: 130px;">Fuel Class</th>
            <th style="width: 110px;">Hardware</th>
            <th style="width: 100px;">Gravity</th>
            <th class="sortable" data-sort="year" style="width: 80px; text-align: center;">
              Year <span class="sort-caret" id="caret-year"></span>
            </th>
            <th class="sortable" data-sort="relevance" style="width: 130px; text-align: right;">
              Relevance <span class="sort-caret" id="caret-relevance"></span>
            </th>
          </tr>
        </thead>
        <tbody id="exp-table-body">
          <tr>
            <td colspan="7" class="empty-state">Loading investigations table...</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  // Filter bindings
  const searchInput = container.querySelector("#exp-search");
  const pillarSelect = container.querySelector("#filter-pillar");
  const fuelSelect = container.querySelector("#filter-fuel");
  const hwSelect = container.querySelector("#filter-hardware");
  const sortSelect = container.querySelector("#filter-sort");

  const refresh = async () => {
    expFilters.search = searchInput.value;
    expFilters.pillar = pillarSelect.value;
    expFilters.fuelClass = fuelSelect.value;
    expFilters.hardware = hwSelect.value;
    expFilters.sortBy = sortSelect.value;
    await loadTableRows(container);
  };

  searchInput?.addEventListener("input", debounce(refresh, 180));
  pillarSelect?.addEventListener("change", refresh);
  fuelSelect?.addEventListener("change", refresh);
  hwSelect?.addEventListener("change", refresh);
  sortSelect?.addEventListener("change", refresh);

  // Sorting header clicks
  container.querySelectorAll("th.sortable").forEach(th => {
    th.addEventListener("click", () => {
      const field = th.getAttribute("data-sort");
      if (field === "relevance") {
        expFilters.sortBy = expFilters.sortBy === "relevance-desc" ? "relevance-asc" : "relevance-desc";
      } else if (field === "year") {
        expFilters.sortBy = expFilters.sortBy === "year-desc" ? "year-asc" : "year-desc";
      } else if (field === "name") {
        expFilters.sortBy = expFilters.sortBy === "name-asc" ? "relevance-desc" : "name-asc";
      }
      sortSelect.value = expFilters.sortBy;
      loadTableRows(container);
    });
  });

  await loadTableRows(container);
}

/**
 * Fetch and render table rows into tbody
 */
async function loadTableRows(container) {
  const tbody = container.querySelector("#exp-table-body");
  const countLabel = container.querySelector("#exp-count-label");
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="7" style="padding: 24px 16px;">
        <div class="skeleton-line w-full"></div>
        <div class="skeleton-line w-full"></div>
        <div class="skeleton-line w-full"></div>
      </td>
    </tr>
  `;

  try {
    const list = await getInvestigations(expFilters);
    if (countLabel) {
      countLabel.textContent = `Showing ${list.length} investigation record${list.length === 1 ? "" : "s"}`;
    }

    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            <div style="font-weight: 500; color: var(--ink); margin-bottom: 4px;">No investigations match these filters.</div>
            <div style="color: var(--muted); font-size: 12px; margin-bottom: 12px;">Try loosening the search keyword or selecting "All Fuel Classes"</div>
            <button class="btn btn-outline" id="clear-exp-filters">Reset All Filters</button>
          </td>
        </tr>
      `;
      container.querySelector("#clear-exp-filters")?.addEventListener("click", () => {
        expFilters = { search: "", pillar: "all", fuelClass: "all", hardware: "all", sortBy: "relevance-desc" };
        const s = container.querySelector("#exp-search"); if (s) s.value = "";
        const p = container.querySelector("#filter-pillar"); if (p) p.value = "all";
        const f = container.querySelector("#filter-fuel"); if (f) f.value = "all";
        const h = container.querySelector("#filter-hardware"); if (h) h.value = "all";
        const o = container.querySelector("#filter-sort"); if (o) o.value = "relevance-desc";
        loadTableRows(container);
      });
      return;
    }

    tbody.innerHTML = list.map(item => `
      <tr
        class="clickable-row"
        onclick="location.hash='#/experiment/${item.id}'"
        tabindex="0"
        role="link"
        aria-label="View investigation ${item.name}"
      >
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 48px; height: 34px; border-radius: 8px; overflow: hidden; flex-shrink: 0; background-color: #0F172A; border: 1px solid var(--border-subtle); box-shadow: 0 1px 3px rgba(0,0,0,0.06);" aria-hidden="true">
              <img
                src="${item.image || '/src/assets/images/hero_microgravity_flame_1794122765420.jpg'}"
                alt=""
                style="width: 100%; height: 100%; object-fit: cover; border-radius: 7px; display: block;"
                loading="lazy"
                referrerpolicy="no-referrer"
              />
            </div>
            <div>
              <a href="#/experiment/${item.id}" class="table-cell-title">
                ${item.name}
              </a>
              <div style="font-size: 11px; color: var(--muted); margin-top: 1px;">
                ${item.fullName}
              </div>
            </div>
          </div>
        </td>
        <td>
          <span class="badge badge-pillar">${item.pillar}</span>
        </td>
        <td style="font-size: 12px; text-transform: capitalize;">
          ${item.fuelClass.replace("-", " ")}
        </td>
        <td>
          <span class="badge badge-hardware">${item.hardware}</span>
        </td>
        <td style="font-size: 12px; font-family: var(--font-mono); color: var(--body);">
          ${item.gravity}
        </td>
        <td style="text-align: center; font-family: var(--font-mono); font-size: 12px;">
          ${item.year}
        </td>
        <td style="text-align: right;">
          <div class="relevance-cell" style="justify-content: flex-end;">
            <div class="micro-bar-track" aria-hidden="true">
              <div class="micro-bar-fill" style="width: ${item.relevance}%;"></div>
            </div>
            <span class="font-mono" style="font-weight: 700; font-size: 12px; color: var(--accent); width: 34px;">
              ${item.relevance}%
            </span>
          </div>
        </td>
      </tr>
    `).join("");

    // Keyboard navigation
    tbody.querySelectorAll(".clickable-row").forEach(row => {
      row.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          const href = row.querySelector("a")?.getAttribute("href");
          if (href) window.location.hash = href;
        }
      });
    });

  } catch (err) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="error-banner" style="margin: 14px;">
            <span>Failed to load investigations: ${err.message}</span>
            <button class="btn btn-outline" id="retry-table-load">Retry</button>
          </div>
        </td>
      </tr>
    `;
    container.querySelector("#retry-table-load")?.addEventListener("click", () => loadTableRows(container));
  }
}

/**
 * Standard debounce utility
 */
function debounce(fn, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), wait);
  };
}
