/**
 * Investigation Detail Component
 * Deep-dive view of a single microgravity combustion investigation.
 * Includes executive summary, conditions envelope table, citations,
 * interactive SVG scatter plot (O2 vs Burn Rate), relevance breakdown bars,
 * and prominent action to explore the regime in Risk Explorer.
 */

import { getInvestigation } from "../services/api.js";

export async function renderInvestigationDetail(container, id) {
  container.innerHTML = `
    <div style="margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between;">
      <a href="#/experiments" class="btn btn-outline" style="font-size: 11.5px;">
        &larr; Back to Experiments Directory
      </a>
      <span class="font-mono" style="font-size: 11px; color: var(--muted);">INVESTIGATION ID: ${id.toUpperCase()}</span>
    </div>

    <section class="section-panel" id="detail-panel">
      <div class="panel-header" style="padding: 18px;">
        <div>
          <div class="skeleton-line w-half" style="height: 24px;"></div>
          <div class="skeleton-line w-third"></div>
        </div>
      </div>
      <div class="panel-body">
        <div class="two-col-grid">
          <div>
            <div class="skeleton-line w-full"></div>
            <div class="skeleton-line w-full"></div>
            <div class="skeleton-line w-half"></div>
          </div>
          <div>
            <div class="skeleton-line w-full" style="height: 180px;"></div>
          </div>
        </div>
      </div>
    </section>
  `;

  try {
    const item = await getInvestigation(id);

    // Compute peak scatter point
    const scatterPoints = item.scatter || [];
    let peakPt = scatterPoints[0] || { o2: item.oxygenRange[0], burnRate: 0.2 };
    let highestRate = -1;
    let maxIdx = 0;
    scatterPoints.forEach((pt, idx) => {
      if (pt.burnRate > highestRate) {
        highestRate = pt.burnRate;
        peakPt = pt;
        maxIdx = idx;
      }
    });

    // Map to Risk Explorer fuel
    let targetFuel = "nomex";
    if (item.fuelClass === "solid-plastic") targetFuel = "pmma";
    else if (item.fuelClass === "liquid-droplet") targetFuel = "droplet";
    else if (item.fuelClass === "gas") targetFuel = "gaseous";
    else if (item.fuelClass === "solid-fabric") targetFuel = "cotton";

    const midPressure = ((item.pressureRange[0] + item.pressureRange[1]) / 2).toFixed(1);
    const midAirflow = ((item.airflowRange[0] + item.airflowRange[1]) / 2).toFixed(1);
    const exploreRiskUrl = `#/risk?inv=${encodeURIComponent(item.id)}&o2=${peakPt.o2}&pressure=${midPressure}&airflow=${midAirflow}&fuel=${targetFuel}`;

    // SVG Scatter Plot
    let scatterSvgHtml = "";
    if (scatterPoints.length > 0) {
      const minO2 = Math.min(...scatterPoints.map(p => p.o2));
      const maxO2 = Math.max(...scatterPoints.map(p => p.o2));
      const minRate = Math.min(...scatterPoints.map(p => p.burnRate));
      const maxRate = Math.max(...scatterPoints.map(p => p.burnRate));

      const o2Span = (maxO2 - minO2) || 10;
      const rateSpan = (maxRate - minRate) || 0.5;

      const padLeft = 50;
      const padBottom = 30;
      const padTop = 15;
      const padRight = 24;
      const width = 420;
      const height = 190;
      const plotW = width - padLeft - padRight;
      const plotH = height - padTop - padBottom;

      const pointsCoords = scatterPoints.map((pt, idx) => {
        const x = padLeft + ((pt.o2 - minO2) / o2Span) * plotW;
        const y = padTop + plotH - ((pt.burnRate - minRate) / rateSpan) * plotH;
        return {
          x: x.toFixed(1),
          y: y.toFixed(1),
          o2: pt.o2,
          burnRate: pt.burnRate,
          isMax: idx === maxIdx
        };
      });

      scatterSvgHtml = `
        <svg class="scatter-plot-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Oxygen vs Flame Spread Rate Scatter Plot">
          <!-- Axes lines -->
          <line x1="${padLeft}" y1="${padTop + plotH}" x2="${width - padRight}" y2="${padTop + plotH}" class="scatter-axis" />
          <line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${padTop + plotH}" class="scatter-axis" />

          <!-- Axis Labels -->
          <text x="${padLeft}" y="${height - 8}" class="scatter-axis-label">${minO2}% O2</text>
          <text x="${width - padRight}" y="${height - 8}" class="scatter-axis-label" text-anchor="end">${maxO2}% O2</text>
          <text x="${padLeft - 8}" y="${padTop + 10}" class="scatter-axis-label" text-anchor="end">${maxRate.toFixed(2)}</text>
          <text x="${padLeft - 8}" y="${padTop + plotH}" class="scatter-axis-label" text-anchor="end">${minRate.toFixed(2)}</text>
          <text x="${padLeft + plotW / 2}" y="${height - 8}" class="scatter-axis-label" text-anchor="middle">Oxygen Molar Concentration (% O2)</text>
          <text x="14" y="${padTop + plotH / 2}" class="scatter-axis-label" text-anchor="middle" transform="rotate(-90 14 ${padTop + plotH / 2})">Burn Rate (mm/s)</text>

          <!-- Guideline connecting telemetry points -->
          <polyline
            fill="none"
            stroke="var(--border)"
            stroke-width="1.5"
            stroke-dasharray="3 3"
            points="${pointsCoords.map(p => `${p.x},${p.y}`).join(" ")}"
          />

          <!-- Data Points -->
          ${pointsCoords.map(p => `
            <circle
              cx="${p.x}"
              cy="${p.y}"
              r="${p.isMax ? 5.5 : 3.8}"
              class="scatter-point ${p.isMax ? "max-point" : ""}"
            >
              <title>${p.o2}% O2 &rarr; ${p.burnRate} mm/s ${p.isMax ? "(Peak Velocity)" : ""}</title>
            </circle>
          `).join("")}
        </svg>
      `;
    }

    // Relevance breakdown keys
    const breakdown = item.relevanceBreakdown || {};
    const breakdownKeys = [
      { key: "crewRelevance", label: "Crew Life Safety & Habitation" },
      { key: "moonMarsApplicability", label: "Artemis Lunar / Mars Applicability" },
      { key: "measurementRichness", label: "Diagnostic Sensor Density" },
      { key: "fuelCoverage", label: "Polymer / Fabric Coverage" },
      { key: "recency", label: "Mission Telemetry Recency" },
      { key: "hardwareHeritage", label: "Flight Hardware Heritage" }
    ];

    container.innerHTML = `
      <div style="margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
        <a href="#/experiments" class="btn btn-outline" style="font-size: 11.5px;">
          &larr; Back to Experiments Directory
        </a>
        <a href="${exploreRiskUrl}" class="btn btn-accent" style="font-size: 12px; padding: 6px 14px;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          Explore this regime in Risk Explorer &rarr;
        </a>
      </div>

      <section class="section-panel">
        <header class="panel-header" style="padding: 18px; align-items: flex-start;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap;">
              <h1 style="font-size: 21px; font-weight: 700; color: var(--ink); margin: 0;">${item.name}</h1>
              <span class="badge badge-pillar">${item.pillar.toUpperCase()}</span>
              <span class="badge badge-hardware">${item.hardware}</span>
              <span class="badge" style="background-color: var(--panel-subtle); border-color: var(--border); font-family: var(--font-mono); font-size: 11px;">
                ${item.gravity}
              </span>
            </div>
            <div style="font-size: 13.5px; color: var(--muted);">${item.fullName} &bull; Flight Year ${item.year}</div>
          </div>
          <div style="text-align: right;">
            <div class="font-mono" style="font-size: 26px; font-weight: 700; color: var(--accent); line-height: 1;">
              ${item.relevance}%
            </div>
            <div style="font-size: 10.5px; color: var(--muted); text-transform: uppercase; margin-top: 3px; font-weight: 600;">
              Flight Relevance Score
            </div>
          </div>
        </header>

        <div class="panel-body">
          <div class="two-col-grid">
            <!-- Left Column: Executive Summary & Conditions -->
            <div>
              <h3 style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 8px;">
                Executive Scientific Summary
              </h3>
              <p style="color: var(--ink); font-size: 13px; line-height: 1.6; margin-bottom: 16px;">
                ${item.summary}
              </p>

              <h3 style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 8px;">
                Experimental Boundary Conditions
              </h3>
              <table class="data-table" style="margin-bottom: 18px; border: 1px solid var(--border);">
                <tbody>
                  <tr>
                    <td style="font-weight: 600; width: 140px; background-color: var(--panel-subtle);">Fuel Classification</td>
                    <td style="text-transform: capitalize;">${item.fuelClass.replace("-", " ")}</td>
                  </tr>
                  <tr>
                    <td style="font-weight: 600; background-color: var(--panel-subtle);">Oxygen Range Tested</td>
                    <td class="font-mono">${item.oxygenRange[0]}% &ndash; ${item.oxygenRange[1]}% O<sub>2</sub></td>
                  </tr>
                  <tr>
                    <td style="font-weight: 600; background-color: var(--panel-subtle);">Cabin Pressure</td>
                    <td class="font-mono">${item.pressureRange[0]} &ndash; ${item.pressureRange[1]} psi (${(item.pressureRange[0] * 6.89476).toFixed(1)} &ndash; ${(item.pressureRange[1] * 6.89476).toFixed(1)} kPa)</td>
                  </tr>
                  <tr>
                    <td style="font-weight: 600; background-color: var(--panel-subtle);">Forced Convective Flow</td>
                    <td class="font-mono">${item.airflowRange[0]} &ndash; ${item.airflowRange[1]} cm/s</td>
                  </tr>
                  <tr>
                    <td style="font-weight: 600; background-color: var(--panel-subtle);">Apparatus / Facility</td>
                    <td class="font-mono">${item.hardware} (${item.gravity})</td>
                  </tr>
                </tbody>
              </table>

              <h3 style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 8px;">
                Scientific Citations &amp; NASA Reports
              </h3>
              <ul style="list-style: none; padding: 0;">
                ${item.citations.map((cite, idx) => `
                  <li style="margin-bottom: 8px; font-size: 12px; border-left: 2px solid var(--accent); padding-left: 10px; background-color: var(--panel-subtle); padding-top: 6px; padding-bottom: 6px; border-radius: 0 3px 3px 0;">
                    <a href="${cite.url}" target="_blank" rel="noopener noreferrer" style="font-weight: 600;">
                      <span class="citation-sup">[${idx + 1}]</span> ${cite.label}
                    </a>
                    <div style="font-size: 11px; color: var(--muted); margin-top: 2px;">
                      Page ${cite.page} &bull; NASA Technical Reports Server (NTRS) &bull; Verified Flight Archive
                    </div>
                  </li>
                `).join("")}
              </ul>
            </div>

            <!-- Right Column: Visualizations -->
            <div>
              <!-- Flight Photographic Observation Card -->
              <div class="detail-photo-card">
                <div class="detail-photo-wrap">
                  <img
                    src="${item.image || '/src/assets/images/hero_microgravity_flame_1794122765420.jpg'}"
                    alt="${item.name} flight combustion observation"
                    class="detail-photo-img"
                    loading="eager"
                    referrerpolicy="no-referrer"
                  />
                  <div class="detail-photo-caption">
                    <div>
                      <div class="detail-caption-title">Flight Telemetry Optical Observation</div>
                      <div class="detail-caption-sub">${item.hardware} Apparatus &bull; ${item.gravity.toUpperCase()}</div>
                    </div>
                    <span class="badge" style="background: rgba(15, 23, 42, 0.85); color: #34D399; border-color: rgba(52, 211, 153, 0.4); font-size: 10px;">
                      NASA GRC ARCHIVE
                    </span>
                  </div>
                </div>
              </div>

              <!-- Scatter Plot Card -->
              <div style="border: 1px solid var(--border); border-radius: 12px; padding: 14px; background-color: var(--panel-subtle); margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
                  <h3 style="font-size: 12.5px; font-weight: 600; color: var(--ink);">
                    Measured Flame Spread vs. Oxygen (%)
                  </h3>
                  <span class="font-mono" style="font-size: 10.5px; color: var(--orange); font-weight: 600;">
                    &bull; Orange: Peak Spread Rate
                  </span>
                </div>
                ${scatterSvgHtml || '<div class="empty-state">No telemetry scatter points available.</div>'}
                <div style="font-size: 11px; color: var(--muted); margin-top: 8px; line-height: 1.4; border-top: 1px solid var(--border-subtle); padding-top: 6px;">
                  Telemetry digitized from MSG/CIR radiometer and calibrated video flame edge tracking across microgravity burns.
                </div>
              </div>

              <!-- Relevance Decomposition Card -->
              <div style="border: 1px solid var(--border); border-radius: 12px; padding: 14px; background-color: var(--panel);">
                <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px;">
                  <h3 style="font-size: 12.5px; font-weight: 600; color: var(--ink);">
                    Relevance Score Breakdown
                  </h3>
                  <span class="font-mono" style="font-size: 10.5px; color: var(--muted);">WEIGHTED INDEX</span>
                </div>
                ${breakdownKeys.map(bk => {
                  const val = breakdown[bk.key] || 0;
                  return `
                    <div style="margin-bottom: 9px;">
                      <div style="display: flex; justify-content: space-between; font-size: 11.5px; margin-bottom: 3px;">
                        <span style="color: var(--body);">${bk.label}</span>
                        <span class="font-mono" style="font-weight: 600; color: var(--ink);">${val}%</span>
                      </div>
                      <div class="micro-bar-track" style="width: 100%; height: 6px;">
                        <div class="micro-bar-fill" style="width: ${val}%;"></div>
                      </div>
                    </div>
                  `;
                }).join("")}
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  } catch (err) {
    container.innerHTML = `
      <div class="error-banner">
        <span>Failed to load investigation details: ${err.message}</span>
        <button class="btn btn-outline" id="retry-detail-btn">Retry</button>
      </div>
    `;
    container.querySelector("#retry-detail-btn")?.addEventListener("click", () => renderInvestigationDetail(container, id));
  }
}
