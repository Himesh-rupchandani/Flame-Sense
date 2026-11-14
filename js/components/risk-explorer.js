/**
 * Risk Explorer Component (Centerpiece)
 * Interactive microgravity combustion risk calculation engine.
 * High-precision instrument sliders, fuel toggles, operational presets,
 * semicircular needle gauge, linear three-zone scale, factor contributions,
 * plain-English engineering verdict, and supporting flight investigations.
 */

import { predictRisk, getEnvironmentCatalog } from "../services/api.js";

export async function renderRiskExplorer(container) {
  // Parse optional prefill params from location hash (e.g., #/risk?o2=30&pressure=10.2&...)
  const hash = window.location.hash;
  const queryIndex = hash.indexOf("?");
  const queryParams = new URLSearchParams(queryIndex !== -1 ? hash.substring(queryIndex + 1) : "");

  const initialO2 = queryParams.get("o2") ? parseFloat(queryParams.get("o2")) : 30.0;
  const initialPressure = queryParams.get("pressure") ? parseFloat(queryParams.get("pressure")) : 10.2;
  const initialAirflow = queryParams.get("airflow") ? parseFloat(queryParams.get("airflow")) : 8.0;
  const initialFuel = queryParams.get("fuel") || "nomex";
  const initialThickness = queryParams.get("thickness") ? parseFloat(queryParams.get("thickness")) : 1.2;
  const prefillInv = queryParams.get("inv");

  container.innerHTML = `
    <!-- Header Notice -->
    <div class="section-panel" style="margin-bottom: 18px;">
      <div class="panel-header" style="flex-wrap: wrap; gap: 10px;">
        <div>
          <h1 class="panel-title" style="font-size: 16.5px;">Spacecraft Cabin Fire-Safety Risk Explorer</h1>
          <div class="panel-subtitle">
            Microgravity combustion envelope model calibrated against NASA Glenn &amp; Marshall flight archives
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          ${prefillInv ? `<span class="badge badge-pillar" style="font-size: 11px;">PRELOADED FROM ${prefillInv.toUpperCase()}</span>` : ""}
          <span class="demo-chip" style="font-size: 10px;">OFFLINE EMPIRICAL MODEL</span>
        </div>
      </div>
    </div>

    <!-- Main Grid: Left = Cabin Conditions Panel, Right = Fire Risk Panel -->
    <div class="risk-grid">
      <!-- 1. Cabin Conditions Panel -->
      <section class="risk-instrument-card" aria-label="Cabin Environmental Conditions">
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px;">
          <h2 style="font-size: 14px; font-weight: 600; color: var(--ink);">Cabin Atmosphere Parameters</h2>
          <span class="font-mono" style="font-size: 10.5px; color: var(--muted);">INPUT STAGE</span>
        </div>

        <!-- Atmospheric Presets Strip -->
        <div style="margin-bottom: 14px;">
          <div style="font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.04em;">
            Operational Exploration Presets
          </div>
          <div class="presets-strip" id="presets-container">
            <!-- Populated from catalog -->
          </div>
        </div>

        <!-- Fuel Material Selection Buttons -->
        <div style="margin-bottom: 16px;">
          <div style="font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.04em;">
            Target Fuel Material Classification
          </div>
          <div class="fuel-button-group" id="fuel-group-container">
            <!-- Populated from catalog -->
          </div>
        </div>

        <!-- 4 Precision Instrument Sliders -->
        <div id="sliders-wrap">
          <!-- Slider 1: Oxygen -->
          <div class="instrument-slider-row" data-tooltip="Ambient oxygen mole fraction. Values >21% correspond to exploration habitats that sharply increase combustion rate.">
            <div class="slider-label-bar">
              <label for="slider-o2" class="slider-name">Oxygen Concentration</label>
              <span class="slider-units">(% molar O<sub>2</sub>)</span>
              <span class="slider-value-box" id="val-o2">${initialO2.toFixed(1)}%</span>
            </div>
            <input
              type="range"
              id="slider-o2"
              class="instrument-range"
              min="14.0"
              max="100.0"
              step="0.5"
              value="${initialO2}"
              aria-label="Oxygen Concentration in percentage"
            />
            <div class="slider-ticks">
              <span>14.0% (Depleted)</span>
              <span>21.0% (Earth Standard)</span>
              <span>30.0% (Lunar Base)</span>
              <span>100% (Suit)</span>
            </div>
          </div>

          <!-- Slider 2: Pressure -->
          <div class="instrument-slider-row" data-tooltip="Total cabin pressure in PSI / kPa. Lower pressure reduces overall gas density, but does not compensate for high O2%.">
            <div class="slider-label-bar">
              <label for="slider-pressure" class="slider-name">Total Environmental Pressure</label>
              <span class="slider-units">(psi / kPa)</span>
              <span class="slider-value-box" id="val-pressure">${initialPressure.toFixed(1)} psi</span>
            </div>
            <input
              type="range"
              id="slider-pressure"
              class="instrument-range"
              min="4.0"
              max="15.0"
              step="0.1"
              value="${initialPressure}"
              aria-label="Total Environmental Pressure in psi"
            />
            <div class="slider-ticks">
              <span>4.3 psi (Spacesuit)</span>
              <span>8.2 psi (Hypobaric)</span>
              <span>10.2 psi (Artemis Habitats)</span>
              <span>14.7 psi (1 atm)</span>
            </div>
          </div>

          <!-- Slider 3: Airflow -->
          <div class="instrument-slider-row" data-tooltip="Forced cabin ventilation velocity from life-support loops. In zero-g, 1-15 cm/s airflow feeds the flame and lowers LOC.">
            <div class="slider-label-bar">
              <label for="slider-airflow" class="slider-name">Ventilation / Forced Airflow</label>
              <span class="slider-units">(cm/s)</span>
              <span class="slider-value-box" id="val-airflow">${initialAirflow.toFixed(1)} cm/s</span>
            </div>
            <input
              type="range"
              id="slider-airflow"
              class="instrument-range"
              min="0.0"
              max="25.0"
              step="0.5"
              value="${initialAirflow}"
              aria-label="Forced Convection Airflow in cm per second"
            />
            <div class="slider-ticks">
              <span>0.0 (Quiescent)</span>
              <span>5.0 (Nominal ISS Loop)</span>
              <span>12.0 (High Flow Duct)</span>
              <span>25.0 (Max Fan Draft)</span>
            </div>
          </div>

          <!-- Slider 4: Thickness -->
          <div class="instrument-slider-row" style="margin-bottom: 0;" data-tooltip="Material sample physical thickness. Thinner films heat up much faster and reach flashover rapidly.">
            <div class="slider-label-bar">
              <label for="slider-thickness" class="slider-name">Material Specimen Thickness</label>
              <span class="slider-units">(mm)</span>
              <span class="slider-value-box" id="val-thickness">${initialThickness.toFixed(1)} mm</span>
            </div>
            <input
              type="range"
              id="slider-thickness"
              class="instrument-range"
              min="0.2"
              max="5.0"
              step="0.1"
              value="${initialThickness}"
              aria-label="Specimen Thickness in millimeters"
            />
            <div class="slider-ticks">
              <span>0.2 mm (Thermally Thin)</span>
              <span>1.0 mm (Fabric/Sheet)</span>
              <span>2.5 mm (Bulk Plastic)</span>
              <span>5.0 mm (Thick)</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 2. Predicted Fire Risk Panel -->
      <section class="risk-gauge-card" aria-label="Predicted Fire Risk Analytics">
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px;">
          <h2 style="font-size: 14px; font-weight: 600; color: var(--ink);">Fire-Safety Risk Evaluation</h2>
          <span class="badge" id="risk-band-badge" style="font-weight: 700;">EVALUATING</span>
        </div>

        <!-- Prominent Semicircular Gauge -->
        <div class="gauge-visual-section">
          <div class="gauge-svg-wrap" data-tooltip="Composite empirical fire risk score (0–100) calibrated against NASA microgravity trials.">
            <svg viewBox="0 0 240 170" width="240" height="170" id="risk-gauge-svg" role="img" aria-label="Semicircular Risk Gauge">
              <!-- Background Arc -->
              <path
                d="M 40 140 A 80 80 0 1 1 200 140"
                fill="none"
                stroke="var(--border)"
                stroke-width="14"
                stroke-linecap="round"
              />
              <!-- Dynamic Filled Arc -->
              <path
                id="gauge-fill-path"
                d="M 40 140 A 80 80 0 1 1 200 140"
                fill="none"
                stroke="var(--accent)"
                stroke-width="14"
                stroke-linecap="round"
                stroke-dasharray="376"
                stroke-dashoffset="376"
                style="transition: stroke-dashoffset 200ms ease-out, stroke 200ms ease-out;"
              />
              <!-- Center Hub -->
              <circle cx="120" cy="122" r="6" fill="var(--ink)" />
              <circle cx="120" cy="122" r="2.5" fill="#FFFFFF" />
              <!-- Needle -->
              <line
                id="gauge-needle"
                x1="120"
                y1="122"
                x2="120"
                y2="52"
                stroke="var(--orange)"
                stroke-width="3"
                stroke-linecap="round"
                style="transform-origin: 120px 122px; transform: rotate(-135deg); transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1);"
              />
            </svg>

            <div class="gauge-center-text">
              <div class="gauge-score" id="gauge-score-val">--</div>
              <div class="gauge-caption">RISK INDEX</div>
            </div>
          </div>

          <!-- Linear Scale with sliding pip -->
          <div class="linear-scale-wrap">
            <div style="display: flex; justify-content: space-between; font-size: 11.5px; color: var(--body); margin-bottom: 4px;">
              <span>Operational Risk Zone</span>
              <span class="font-mono" id="scale-regime-label" style="font-weight: 700;">--</span>
            </div>
            <div class="linear-scale-bar" aria-hidden="true">
              <div class="scale-seg-green" title="Safe (<30)"></div>
              <div class="scale-seg-orange" title="Caution (30-65)"></div>
              <div class="scale-seg-red" title="Critical (>65)"></div>
            </div>
            <div class="scale-needle-marker" aria-hidden="true">
              <div class="scale-needle-pip" id="scale-pip" style="left: 0%;"></div>
            </div>
            <div class="scale-ticks">
              <span>0 SAFE</span>
              <span>30 CAUTION</span>
              <span>65 CRITICAL</span>
              <span>100</span>
            </div>
          </div>
        </div>

        <!-- Simulated Microgravity Flame Optical Telemetry Monitor -->
        <div style="margin-top: 14px; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; background-color: #0B0E14; box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);">
          <div style="position: relative; width: 100%; height: 110px; overflow: hidden; border-radius: 12px;">
            <img
              id="telemetry-flame-img"
              src="/src/assets/images/hero_microgravity_flame_1794122765420.jpg"
              alt="Microgravity Flame Optical Simulation"
              style="width: 100%; height: 100%; object-fit: cover; opacity: 0.9; border-radius: 12px;"
              loading="lazy"
              referrerpolicy="no-referrer"
            />
            <div style="position: absolute; inset: 0; background: linear-gradient(to right, rgba(11, 14, 20, 0.88) 0%, rgba(11, 14, 20, 0.35) 60%, rgba(11, 14, 20, 0.15) 100%);"></div>
            <div style="position: absolute; top: 8px; left: 12px; color: #FFFFFF;">
              <div style="font-family: var(--font-mono); font-size: 9.5px; color: #34D399; font-weight: 700; letter-spacing: 0.05em; display: flex; align-items: center; gap: 5px;">
                <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: #34D399;"></span>
                FLIGHT OPTICAL TELEMETRY MODEL
              </div>
              <div id="telemetry-flame-mode" style="font-size: 11.5px; font-weight: 600; color: #FFFFFF; margin-top: 2px;">
                Quasi-Steady Spherical Diffusion Shell
              </div>
            </div>
            <div style="position: absolute; bottom: 8px; left: 12px; right: 12px; display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 10px; color: #CBD5E1; border-top: 1px solid rgba(255, 255, 255, 0.15); padding-top: 4px;">
              <span>Flame Temp: <strong id="telemetry-temp" style="color: #FBBF24;">1680 K</strong></span>
              <span>Radiative Fraction: <strong id="telemetry-rad" style="color: #38BDF8;">32%</strong></span>
              <span>Regime: <strong id="telemetry-regime" style="color: #34D399;">DIFFUSIVE</strong></span>
            </div>
          </div>
        </div>

        <!-- Plain-English Engineering Verdict -->
        <div id="verdict-container" class="verdict-line">
          Evaluating microgravity combustion regime...
        </div>

        <!-- Physical Quantities Breakdown -->
        <div style="margin-top: 14px; background-color: var(--panel-subtle); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px 14px;">
          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
            <span style="color: var(--muted);">Effective Limiting O<sub>2</sub> (LOC):</span>
            <span class="font-mono" id="loc-percent-val" style="font-weight: 700; color: var(--ink);">--% O2</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 12px;">
            <span style="color: var(--muted);">Habitat Regime:</span>
            <span class="font-mono" id="regime-location-val" style="color: var(--body); text-align: right; max-width: 220px;">--</span>
          </div>
        </div>

        <!-- Factor Contributions -->
        <div style="margin-top: 14px;">
          <div style="font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.04em;">
            Combustion Propensity Factor Decomposition
          </div>
          <div id="contributions-container">
            <div class="skeleton-line w-full"></div>
            <div class="skeleton-line w-full"></div>
          </div>
        </div>

        <!-- Supporting NASA Investigations matching regime -->
        <div class="supporting-regimes-box" id="supporting-investigations-box">
          <div style="font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em;">
            Corroborating Flight Investigations
          </div>
          <div id="supporting-investigations-list">
            <!-- Dynamically populated from predict result -->
          </div>
        </div>

        <div style="font-size: 10px; color: var(--muted); font-family: var(--font-mono); margin-top: 14px; text-align: right;">
          NOTICE: Demo predictions based on empirical fit. Validated ML model replaces this on backend.
        </div>
      </section>
    </div>
  `;

  // State
  let currentFuelId = initialFuel;
  const catalog = await getEnvironmentCatalog();

  // Render Presets
  const presetsContainer = container.querySelector("#presets-container");
  if (presetsContainer) {
    presetsContainer.innerHTML = catalog.presets.map(p => `
      <button
        type="button"
        class="btn btn-outline ${p.id === "moon" && !prefillInv ? "active" : ""}"
        data-preset-id="${p.id}"
        style="font-size: 11px; padding: 4px 9px;"
      >
        ${p.label}
      </button>
    `).join("");
  }

  // Render Fuels
  const fuelGroup = container.querySelector("#fuel-group-container");
  if (fuelGroup) {
    fuelGroup.innerHTML = catalog.fuels.map(f => `
      <button
        type="button"
        class="fuel-btn ${f.id === currentFuelId ? "active" : ""}"
        data-fuel-id="${f.id}"
      >
        <span>${f.label}</span>
        <span class="fuel-btn-sub">Base LOC ~${f.locBase}%</span>
      </button>
    `).join("");
  }

  // Element handles
  const sliderO2 = container.querySelector("#slider-o2");
  const sliderPressure = container.querySelector("#slider-pressure");
  const sliderAirflow = container.querySelector("#slider-airflow");
  const sliderThickness = container.querySelector("#slider-thickness");

  const valO2 = container.querySelector("#val-o2");
  const valPressure = container.querySelector("#val-pressure");
  const valAirflow = container.querySelector("#val-airflow");
  const valThickness = container.querySelector("#val-thickness");

  const gaugeScore = container.querySelector("#gauge-score-val");
  const gaugeNeedle = container.querySelector("#gauge-needle");
  const gaugeFillPath = container.querySelector("#gauge-fill-path");
  const scalePip = container.querySelector("#scale-pip");
  const scaleRegimeLabel = container.querySelector("#scale-regime-label");
  const riskBandBadge = container.querySelector("#risk-band-badge");
  const locPercentVal = container.querySelector("#loc-percent-val");
  const regimeLocationVal = container.querySelector("#regime-location-val");
  const contributionsContainer = container.querySelector("#contributions-container");
  const verdictContainer = container.querySelector("#verdict-container");
  const supportingList = container.querySelector("#supporting-investigations-list");

  // Calculation updater
  const updateRisk = async () => {
    const o2 = parseFloat(sliderO2.value);
    const pressure = parseFloat(sliderPressure.value);
    const airflow = parseFloat(sliderAirflow.value);
    const thickness = parseFloat(sliderThickness.value);

    // Update textual value readouts
    valO2.textContent = `${o2.toFixed(1)}%`;
    valPressure.textContent = `${pressure.toFixed(1)} psi (${(pressure * 6.89476).toFixed(1)} kPa)`;
    valAirflow.textContent = `${airflow.toFixed(1)} cm/s`;
    valThickness.textContent = `${thickness.toFixed(1)} mm`;

    try {
      const result = await predictRisk({
        o2,
        pressure,
        airflow,
        fuelId: currentFuelId,
        thickness
      });

      // Update Gauge Value
      gaugeScore.textContent = result.score;

      // Color scheme based on band
      let bandColor = "var(--success)";
      let bandBg = "var(--success-light)";
      if (result.band === "CRITICAL") {
        bandColor = "var(--danger)";
        bandBg = "var(--danger-light)";
      } else if (result.band === "CAUTION") {
        bandColor = "var(--warn)";
        bandBg = "var(--warn-light)";
      }

      gaugeScore.style.color = bandColor;

      // Rotate needle: -135deg (0) to +135deg (100)
      const deg = -135 + (result.score / 100) * 270;
      gaugeNeedle.style.transform = `rotate(${deg}deg)`;

      // Arc dashoffset: 376 total
      const totalLen = 376;
      const offset = totalLen - (totalLen * (result.score / 100));
      gaugeFillPath.style.strokeDashoffset = offset;
      gaugeFillPath.style.stroke = bandColor;

      // Linear scale pip & band label
      scalePip.style.left = `${Math.min(99, Math.max(1, result.score))}%`;
      scaleRegimeLabel.textContent = `${result.band} (${result.score}/100)`;
      scaleRegimeLabel.style.color = bandColor;

      // Risk Band badge
      riskBandBadge.textContent = result.band;
      riskBandBadge.style.backgroundColor = bandBg;
      riskBandBadge.style.color = bandColor;
      riskBandBadge.style.border = `1px solid ${bandColor}`;

      // LOC & Location info
      locPercentVal.textContent = `${result.locPercent}% O2`;
      regimeLocationVal.textContent = result.location;

      // Verdict
      verdictContainer.className = `verdict-line ${result.band.toLowerCase()}`;
      verdictContainer.textContent = result.verdict;

      // Contributions
      contributionsContainer.innerHTML = result.contributions.map(c => `
        <div class="contribution-row">
          <span class="contribution-label">${c.label}</span>
          <div class="contribution-track">
            <div class="contribution-fill" style="width: ${c.value}%;"></div>
          </div>
          <span class="contribution-val">${c.value}%</span>
        </div>
      `).join("");

      // Update Simulated Optical Telemetry Monitor
      const flameImg = container.querySelector("#telemetry-flame-img");
      const flameMode = container.querySelector("#telemetry-flame-mode");
      const flameTemp = container.querySelector("#telemetry-temp");
      const flameRad = container.querySelector("#telemetry-rad");
      const flameRegime = container.querySelector("#telemetry-regime");

      if (flameTemp) {
        const estTemp = Math.round(1380 + (o2 / 100) * 1150);
        flameTemp.textContent = `${estTemp} K`;
      }
      if (flameRad) {
        const estRad = Math.max(16, Math.min(52, Math.round(46 - (airflow * 0.9) - (o2 * 0.1))));
        flameRad.textContent = `${estRad}%`;
      }
      if (flameMode && flameRegime && flameImg) {
        if (currentFuelId === "droplet") {
          flameImg.src = "/src/assets/images/droplet_cool_flame_1794122766620.jpg";
          flameMode.textContent = "Isolated Spherical Droplet with Cool-Flame Envelope";
          flameRegime.textContent = "DROPLET CO₂";
        } else if (airflow >= 10.0) {
          flameImg.src = "/src/assets/images/saffire_flame_duct_1794122766942.jpg";
          flameMode.textContent = `Forced Convective Flow Duct (${airflow.toFixed(1)} cm/s)`;
          flameRegime.textContent = "CONVECTIVE";
        } else if (airflow <= 3.0) {
          flameImg.src = "/src/assets/images/hero_microgravity_flame_1794122765420.jpg";
          flameMode.textContent = "Quasi-Steady Spherical Diffusion Shell";
          flameRegime.textContent = "DIFFUSIVE";
        } else {
          flameImg.src = "/src/assets/images/iss_glovebox_combustion_1794122767129.jpg";
          flameMode.textContent = `Transition Boundary Layer (${airflow.toFixed(1)} cm/s)`;
          flameRegime.textContent = "TRANSITIONAL";
        }
      }

      // Corroborating NASA flight tests
      if (result.supportingInvestigations && result.supportingInvestigations.length > 0) {
        supportingList.innerHTML = result.supportingInvestigations.map(inv => `
          <a href="#/experiment/${inv.id}" class="supporting-regime-pill" title="View ${inv.name} flight details">
            <div>
              <strong style="color: var(--ink);">${inv.name}</strong>:
              <span style="color: var(--body); font-size: 11px;"> ${inv.matchNote}</span>
            </div>
            <span class="font-mono" style="font-size: 11px; color: var(--accent); margin-left: 8px;">View &rarr;</span>
          </a>
        `).join("");
      } else {
        supportingList.innerHTML = `
          <div style="font-size: 11px; color: var(--muted); margin-top: 6px;">
            Matches NASA Glenn microgravity baseline flammability database.
          </div>
        `;
      }

    } catch (err) {
      verdictContainer.className = "verdict-line critical";
      verdictContainer.textContent = `Prediction Model Failure: ${err.message}`;
    }
  };

  // Bind slider inputs
  sliderO2.addEventListener("input", updateRisk);
  sliderPressure.addEventListener("input", updateRisk);
  sliderAirflow.addEventListener("input", updateRisk);
  sliderThickness.addEventListener("input", updateRisk);

  // Bind Presets
  presetsContainer?.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      const pid = btn.getAttribute("data-preset-id");
      const preset = catalog.presets.find(p => p.id === pid);
      if (preset) {
        sliderO2.value = preset.o2;
        sliderPressure.value = preset.pressure;
        sliderAirflow.value = preset.airflow;

        presetsContainer.querySelectorAll("button").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        updateRisk();
      }
    });
  });

  // Bind Fuels
  fuelGroup?.querySelectorAll(".fuel-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      currentFuelId = btn.getAttribute("data-fuel-id");
      fuelGroup.querySelectorAll(".fuel-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      // Auto-set nominal thickness for fuel
      const f = catalog.fuels.find(item => item.id === currentFuelId);
      if (f && f.thickness) {
        sliderThickness.value = f.thickness;
      }

      updateRisk();
    });
  });

  // Initial calculation
  await updateRisk();
}
