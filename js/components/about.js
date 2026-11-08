/**
 * About & Architecture Component
 * Project background, NASA hackathon context, objectives, data sources,
 * technical approach, known limitations, and backend readiness matrix.
 */

import { CONFIG } from "../config.js";

export function renderAbout(container) {
  container.innerHTML = `
    <!-- Hero Project Introduction -->
    <section class="section-panel">
      <header class="panel-header">
        <div>
          <h1 class="panel-title" style="font-size: 16.5px;">About FlameSense &bull; Spacecraft Fire Safety Analytics</h1>
          <div class="panel-subtitle">NASA Space Apps &amp; Combustion Science Challenge</div>
        </div>
        <span class="hackathon-chip">NASA HACKATHON RESEARCH INITIATIVE</span>
      </header>
      <div class="panel-body">
        <p style="color: var(--ink); font-size: 13.5px; line-height: 1.6; margin-bottom: 12px;">
          <strong>FlameSense</strong> is an open empirical intelligence workbench engineered for spacecraft fire-safety engineers, mission architecture planners, and life-support specialists. Fire in enclosed human spaceflight environments remains one of the most hazardous catastrophic failure modes. Because buoyant thermal convection vanishes in zero-gravity, materials burn with lower heat release yet remain sustained under subtle cabin ventilation loops, creating deceptively dangerous conditions.
        </p>
        <p style="color: var(--body); font-size: 13px; line-height: 1.6;">
          Developed for the NASA Hackathon, FlameSense digitizes and synthesizes flight experiments from the International Space Station (ISS) Microgravity Science Glovebox (MSG), the Combustion Integrated Rack (CIR), and the Cygnus Saffire flight series. The platform enables engineers to interactively explore ignition and flame spread boundaries under candidate exploration atmospheres—including the Artemis Lunar Surface Base regime (30% O<sub>2</sub> at 10.2 psi / 70.3 kPa) and EVA suit pre-breathe cycles.
        </p>
      </div>
    </section>

    <!-- Two Column Grid: Objectives & Data Sources -->
    <div class="two-col-grid">
      <!-- Project Objectives -->
      <section class="section-panel" style="margin-bottom: 0;">
        <header class="panel-header">
          <h2 class="panel-title">Project Objectives &amp; Technical Approach</h2>
        </header>
        <div class="panel-body">
          <ul style="list-style: none; padding: 0;">
            <li style="margin-bottom: 12px; border-left: 2px solid var(--accent); padding-left: 10px;">
              <strong style="color: var(--ink);">1. Microgravity LOC Prediction</strong>
              <div style="font-size: 12px; color: var(--body); margin-top: 2px;">
                Calculate effective Limiting Oxygen Concentrations (LOC) as a function of forced ventilation velocity and total cabin pressure, preventing reliance on inaccurate 1g upward flammability tests.
              </div>
            </li>
            <li style="margin-bottom: 12px; border-left: 2px solid var(--accent); padding-left: 10px;">
              <strong style="color: var(--ink);">2. Cross-Experiment Flight Telemetry Index</strong>
              <div style="font-size: 12px; color: var(--body); margin-top: 2px;">
                Unify disparate NASA Glenn Research Center (GRC) and Marshall Space Flight Center (MSFC) flight data into a structured queryable database.
              </div>
            </li>
            <li style="margin-bottom: 12px; border-left: 2px solid var(--accent); padding-left: 10px;">
              <strong style="color: var(--ink);">3. Precursor Smoke Particle Analysis</strong>
              <div style="font-size: 12px; color: var(--body); margin-top: 2px;">
                Incorporate findings from SAME-R regarding microgravity soot particle agglomeration to inform detector placement in lunar habitats.
              </div>
            </li>
            <li style="border-left: 2px solid var(--accent); padding-left: 10px;">
              <strong style="color: var(--ink);">4. Zero-Dependency Enterprise Deployment</strong>
              <div style="font-size: 12px; color: var(--body); margin-top: 2px;">
                Engineered with vanilla standards to ensure reliable execution in isolated laboratory workstations without external network leaks.
              </div>
            </li>
          </ul>
        </div>
      </section>

      <!-- Indexed Data Sources -->
      <section class="section-panel" style="margin-bottom: 0;">
        <header class="panel-header">
          <h2 class="panel-title">Indexed NASA Technical Data Sources</h2>
        </header>
        <div class="panel-body">
          <ul style="list-style: none; padding: 0;">
            <li style="margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid var(--border-subtle);">
              <div style="font-weight: 600; color: var(--ink);">NASA-STD-6001B</div>
              <div style="font-size: 11.5px; color: var(--muted); margin-top: 1px;">
                Flammability, Odor, Off-gassing, and Compatibility Requirements and Test Procedures for Materials in Spacecraft.
              </div>
            </li>
            <li style="margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid var(--border-subtle);">
              <div style="font-weight: 600; color: var(--ink);">BASS &amp; BASS-II (Burning and Suppression of Solids)</div>
              <div style="font-size: 11.5px; color: var(--muted); margin-top: 1px;">
                NASA GRC technical reports TM-2015-218485 &amp; TP-2016-219102 covering extinction limits in the Microgravity Science Glovebox.
              </div>
            </li>
            <li style="margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid var(--border-subtle);">
              <div style="font-weight: 600; color: var(--ink);">Saffire Project (Spacecraft Fire Safety Demonstration I–VI)</div>
              <div style="font-size: 11.5px; color: var(--muted); margin-top: 1px;">
                Large-scale duct combustion experiments aboard Northrop Grumman Cygnus automated resupply vehicles.
              </div>
            </li>
            <li>
              <div style="font-weight: 600; color: var(--ink);">FLEX-2 &amp; SAME-R Telemetry Records</div>
              <div style="font-size: 11.5px; color: var(--muted); margin-top: 1px;">
                Droplet cool-flame extinction limits and pre-ignition smoke particulate sizing from Combustion Integrated Rack runs.
              </div>
            </li>
          </ul>
        </div>
      </section>
    </div>

    <!-- Known Limitations -->
    <section class="section-panel" style="margin-top: 18px;">
      <header class="panel-header">
        <h2 class="panel-title">Engineering Assumptions &amp; Known Limitations</h2>
        <span class="font-mono" style="font-size: 11px; color: var(--muted);">RISK BOUNDARIES</span>
      </header>
      <div class="panel-body">
        <ul style="list-style: square; padding-left: 20px; font-size: 12.5px; color: var(--body); line-height: 1.6;">
          <li style="margin-bottom: 6px;">
            <strong>Thermal Thickness Approximations:</strong> Calculations utilize analytical 1D energy balances for thin films and semi-infinite solids. Multi-layer composite materials and 3D geometries require verified computational fluid dynamics (CFD) modeling.
          </li>
          <li style="margin-bottom: 6px;">
            <strong>Quiescent Extinction Precision:</strong> At near-zero flow (<0.5 cm/s), localized radiant heat loss and oxygen depletion produce high sensitivity to chamber ambient wall temperatures (estimated &plusmn;1.5% O<sub>2</sub> uncertainty).
          </li>
          <li style="margin-bottom: 6px;">
            <strong>Pre-Ignition Pyrolysis:</strong> Unmonitored electrical overheating can emit toxic and flammable pyrolysis gas mixtures into quiescent pockets before open flaming occurs.
          </li>
          <li>
            <strong>Mission Qualification Mandate:</strong> FlameSense is an analytical pre-screening and situational awareness tool. Flight hardware certification strictly requires testing per NASA-STD-6001 Test 1 and Test 2.
          </li>
        </ul>
      </div>
    </section>

    <!-- Backend Readiness Matrix -->
    <section class="section-panel" style="margin-top: 18px;">
      <header class="panel-header">
        <div>
          <h2 class="panel-title">Backend Architecture &amp; Service Readiness Matrix</h2>
          <div class="panel-subtitle">Clean abstraction layer ready for remote API connection</div>
        </div>
        <span class="demo-chip" style="font-size: 10px;">CONFIG.USE_MOCK = ${CONFIG.USE_MOCK}</span>
      </header>
      <div class="panel-body" style="padding: 0;">
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Service Domain</th>
                <th>Method</th>
                <th>Configured Endpoint</th>
                <th>Operational Status</th>
                <th>Target Backend Architecture</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="font-weight: 600; color: var(--ink);">Database Metadata</td>
                <td><span class="badge badge-hardware">GET</span></td>
                <td class="font-mono">${CONFIG.ENDPOINTS.meta}</td>
                <td><span class="badge badge-pillar">ACTIVE MOCK</span></td>
                <td style="font-size: 12px;">Relational database aggregate view (PostgreSQL / Cloud SQL)</td>
              </tr>
              <tr>
                <td style="font-weight: 600; color: var(--ink);">Investigations Directory</td>
                <td><span class="badge badge-hardware">GET</span></td>
                <td class="font-mono">${CONFIG.ENDPOINTS.investigations}</td>
                <td><span class="badge badge-pillar">ACTIVE MOCK</span></td>
                <td style="font-size: 12px;">Indexed search engine (Elasticsearch / Meilisearch)</td>
              </tr>
              <tr>
                <td style="font-weight: 600; color: var(--ink);">Investigation Telemetry</td>
                <td><span class="badge badge-hardware">GET</span></td>
                <td class="font-mono">${CONFIG.ENDPOINTS.investigation}</td>
                <td><span class="badge badge-pillar">ACTIVE MOCK</span></td>
                <td style="font-size: 12px;">Time-series flight data store with radiometer curve JSON</td>
              </tr>
              <tr>
                <td style="font-weight: 600; color: var(--ink);">Combustion Risk Predictor</td>
                <td><span class="badge badge-hardware" style="color: var(--warn); border-color: var(--warn);">POST</span></td>
                <td class="font-mono">${CONFIG.ENDPOINTS.predict}</td>
                <td><span class="badge badge-pillar">ACTIVE MOCK</span></td>
                <td style="font-size: 12px;">Trained gradient-boosted regression model (ONNX / PyTorch)</td>
              </tr>
              <tr>
                <td style="font-weight: 600; color: var(--ink);">Semantic Q&amp;A Assistant</td>
                <td><span class="badge badge-hardware" style="color: var(--warn); border-color: var(--warn);">POST</span></td>
                <td class="font-mono">${CONFIG.ENDPOINTS.ask}</td>
                <td><span class="badge badge-pillar">ACTIVE MOCK</span></td>
                <td style="font-size: 12px;">RAG vector search over NASA Technical Reports Server documents</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `;
}
