# FlameSense: Mission Console & Floating Segmented Navigation Upgrade

A comprehensive UI evolution for **FlameSense** transitioning the platform into an authentic, NASA-grade mission status console with a modern floating segmented navigation bar, interactive microgravity combustion visualizer, and live telemetry tooltips.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The architectural and design decisions below reflect your confirmed preferences from Phase 1. Review before proceeding to execution:

- **Confirmed Decision 1: Floating Segmented Navigation Bar**
  - Replaces the full-width tab row with a sleek, centered floating segmented navigation bar featuring rounded geometry (`10px–12px`), active state indicators, and subtle badge counters (e.g. `24` on Experiments, `R² 0.81` on Overview).
- **Confirmed Decision 2: Interactive Mission Status Console Overview**
  - Upgrades the Overview screen with a dedicated NASA Mission Status Console: top telemetry ribbon with mission elapsed time & cabin atmosphere status, interactive combustion regime visualizer with live flame shape & color feedback, and direct scenario preset triggers (e.g. Artemis Lunar Base 30% O₂, ISS Standard 21% O₂, Depressurized 10.2 PSI).
- **Confirmed Decision 3: Micro-Animations & Telemetry Tooltips**
  - Introduces smooth CSS micro-interactions (gentle hover elevation, active tab indicator transitions, live pulse indicator for telemetry feed) and clean unboxed scientific tooltips (`data-tooltip` with coordinate and definition popups) across physical metrics without heavy third-party dependencies.

---

## 1. Overview & Core Concept

- **What It Does**: Transforms FlameSense from a static tabular hackathon prototype into an operational flight intelligence workbench. Spacecraft safety engineers and judges can inspect microgravity fire risks, test cabin atmosphere flammability, and browse orbital flight experiments through an intuitive mission-control console.
- **Target Audience / Persona**: NASA Hackathon judges, spacecraft life-support (ECLSS) engineers, aerospace materials specialists, and microgravity combustion researchers.
- **Key Value**: Provides instant situational awareness into how fire behaves when buoyancy convection ceases, pairing empirical flight archives with interactive physical risk calculations.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Mission Console Entry (`#/overview`)**:
   - The user arrives at the top navigation featuring the new floating segmented control bar.
   - The hero area presents the **NASA ISS/Lunar Mission Status Console** displaying live cabin atmosphere metrics (O₂ %, Total Pressure, Draft Velocity).
   - An interactive **Combustion Regime Stage** dynamically previews the spherical diffusion flame geometry, temperature, and soot soot radiative fraction as users switch atmosphere baselines.
   - Below the console, the 4 structured KPI cards highlight indexed flight trials, fuels, and model MAE with interactive telemetry tooltips.
   - The Featured Flight Bento Showcase and Top 5 Investigations table provide immediate deep-links into high-relevance flight archives.
2. **Experiment Navigation & Deep Dive (`#/experiments` & `#/experiment/{id}`)**:
   - The floating navigation shows the exact count of indexed investigations (`24`).
   - Seamless instant filtering by Pillar, Fuel Class, and Hardware Apparatus with active badge counts.
   - Clicking any experiment smoothly transitions to the detailed report with synchronized radiometer scatter charts and NTRS citations.
3. **Interactive Flammability Explorer (`#/risk`)**:
   - Sliders dynamically adjust oxygen concentration and ventilation flow, linked to the optical telemetry simulator with real-time LOC calculations.

### Visual Identity & Theme
- **Color Palette**: Clinical space laboratory aesthetic adhering to the 60-30-10 palette rule:
  - `60% Canvas`: Crisp laboratory light slate (`#F4F6F5`).
  - `30% Panels`: Clean white cards (`#FFFFFF`) with subtle hairline dividers (`#DCE4DF`) and natural `12px–14px` border curves.
  - `10% Aerospace Telemetry Accents`: Deep NASA flight green (`#087C50`), safety warning amber (`#E6A23C`), and active phosphor emerald (`#34D399`).
- **Typography**:
  - System UI typography for hierarchy (`-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif`).
  - Tabular monospace numbers (`ui-monospace, SF Mono, Menlo, monospace` with `font-variant-numeric: tabular-nums`) ensuring no layout jitter during live value scrubbers.
- **Micro-Interactions & Motion**:
  - Smooth 150ms ease-out transitions on tab selection, slider updates, and hover states.
  - Accessible tooltip popups on metric labels (LOC, Radiative Fraction, R² Accuracy, Flame Spread Rate).
  - Reduced-motion support (`@media (prefers-reduced-motion)`).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Zero-Build Vanilla Architecture Preservation**
  - *Chosen Approach*: Implement the floating navigation and interactive console using vanilla ES modules and clean CSS, avoiding runtime npm bundlers.
  - *Why*: Strict NASA hackathon constraint requirement; allows immediate double-click running from local disk or static server.
- **Decision 2: Floating Segmented Navigation vs. Heavy Fixed Header**
  - *Chosen Approach*: Center-aligned floating segmented bar with embedded icon badges and counter pills.
  - *Why*: Frees up vertical viewport height, elevates visual sophistication, and feels distinctly engineered rather than template-generated.
- **Decision 3: Integrated Live Telemetry Stage in Overview**
  - *Chosen Approach*: Place an interactive atmosphere simulator directly inside the Overview header that previews combustion regimes before visiting the full Risk Explorer.
  - *Why*: Gives judges an immediate interactive "aha!" moment within the first 5 seconds of loading the applet.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                         FLAMESENSE APP SHELL                           │
├────────────────────────────────────────────────────────────────────────┤
│ Topbar: NASA Brand Lockup  •  Live Telemetry Beacon  •  Hackathon Badge│
├────────────────────────────────────────────────────────────────────────┤
│ [ Floating Segmented Nav: Overview(Live) | Experiments(24) | Risk | Ask | About ]
├────────────────────────────────────────────────────────────────────────┤
│ VIEWPORT ROUTER (#/overview, #/experiments, #/risk, #/ask, #/about)    │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ OVERVIEW: MISSION STATUS CONSOLE                               │   │
│   │ ┌───────────────────────────┐  ┌─────────────────────────────┐ │   │
│   │ │ Live Atmosphere Ribbon    │  │ Optical Telemetry Monitor   │ │   │
│   │ │ (Pressure, O2, Airflow)   │  │ (Dynamic Flame Visualizer)  │ │   │
│   │ └───────────────────────────┘  └─────────────────────────────┘ │   │
│   │ Quick Presets: [Artemis 30% O2] [ISS 21% O2] [Depress 10.2 PSI]│   │
│   └────────────────────────────────────────────────────────────────┘   │
│   │                                                                │   │
│   │ 4 Enhanced KPI Cards (with Telemetry Tooltips & R² Readout)    │   │
│   │ Featured Bento Cards (Organic 14px Curves & In Situ Images)    │   │
│   │ Top 5 Investigations Table & Pillar Coverage Progress Visuals  │   │
└────────────────────────────────────────────────────────────────────────┘
```

### Component & State Changes:
1. `assets/styles.css`:
   - Add `.floating-nav-container`, `.floating-nav-bar`, `.nav-segment-btn`, `.nav-badge-chip`.
   - Add `.mission-console-stage`, `.atmosphere-telemetry-strip`, `.telemetry-tooltip`, `.console-preset-btn`.
   - Add smooth micro-animation classes (`.fade-in-up`, `.telemetry-pulse`).
2. `js/components/topbar.js` & `js/app.js`:
   - Replace standard tab row with the floating segmented navigation bar.
   - Update active hash indicator logic and dynamic badge counter rendering.
3. `js/components/investigation-table.js`:
   - Revamp `renderOverview()` with the interactive Mission Status Console and live combustion atmosphere switcher.
   - Attach interactive tooltips for scientific metrics across KPI cards and table columns.
4. `js/components/risk-explorer.js`:
   - Enhance the optical flame monitor with coordinated telemetry readouts and tooltips.
