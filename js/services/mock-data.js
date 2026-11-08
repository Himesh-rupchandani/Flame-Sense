/**
 * FlameSense Mock Data & Offline Model Simulation
 * NASA Microgravity Flammability & Combustion Intelligence corpus
 */

export const MOCK_DATA = {
  meta: {
    investigations: 24,
    runs: 5120,
    modelMae: 2.4,
    modelR2: 0.81,
    lastTrained: "2026-11-14"
  },

  presets: [
    { id: "earth", label: "Earth Standard", o2: 21, pressure: 14.7, airflow: 5 },
    { id: "suit", label: "EVA Spacesuit", o2: 100, pressure: 4.3, airflow: 2 },
    { id: "moon", label: "Artemis Lunar Habitat", o2: 30, pressure: 10.2, airflow: 8 },
    { id: "rover", label: "Pressurized Rover", o2: 30, pressure: 10.2, airflow: 12 }
  ],

  fuels: [
    { id: "cotton", label: "Cotton Fabric", class: "solid-fabric", thickness: 0.8, locBase: 16.5 },
    { id: "nomex", label: "Nomex Aramid", class: "solid-fabric", thickness: 1.0, locBase: 29.5 },
    { id: "polyethylene", label: "Polyethylene (HDPE)", class: "solid-plastic", thickness: 1.5, locBase: 17.2 },
    { id: "pmma", label: "PMMA (Acrylic)", class: "solid-plastic", thickness: 2.0, locBase: 17.8 },
    { id: "droplet", label: "Heptane Droplet", class: "liquid-droplet", thickness: 1.0, locBase: 14.0 },
    { id: "gaseous", label: "Methane / Ethylene Gas", class: "gas", thickness: 0.5, locBase: 12.0 }
  ],

  investigations: [
    {
      id: "bass",
      name: "BASS",
      fullName: "Burning and Suppression of Solids",
      pillar: "prevention",
      fuelClass: "solid-plastic",
      hardware: "MSG",
      gravity: "microgravity",
      year: 2012,
      relevance: 96,
      image: "/src/assets/images/iss_glovebox_combustion_1794122767129.jpg",
      relevanceBreakdown: {
        crewRelevance: 98,
        moonMarsApplicability: 94,
        measurementRichness: 92,
        fuelCoverage: 95,
        recency: 82,
        hardwareHeritage: 98
      },
      oxygenRange: [16, 30],
      pressureRange: [10.2, 14.7],
      airflowRange: [0.5, 15],
      summary: "Examined the burning and extinction characteristics of a wide variety of fuel samples in the Microgravity Science Glovebox (MSG). Validated that steady flame spread can persist at lower airflows than in normal gravity, and determined critical extinction limits for flat plastic and wax rods in quiescent and low-speed flow environments.",
      citations: [
        { label: "BASS Final Science Report (NASA/TM-2015-218485)", page: 14, url: "https://ntrs.nasa.gov/citations/20150019565" },
        { label: "Combustion and Flame, Vol 161 (Microgravity Flammability of Solids)", page: 1102, url: "https://doi.org/10.1016/j.combustflame.2013.11.002" }
      ],
      scatter: [
        { o2: 17.0, burnRate: 0.08 },
        { o2: 18.5, burnRate: 0.14 },
        { o2: 20.9, burnRate: 0.22 },
        { o2: 23.0, burnRate: 0.35 },
        { o2: 25.5, burnRate: 0.52 },
        { o2: 28.0, burnRate: 0.74 },
        { o2: 30.0, burnRate: 0.95 }
      ]
    },
    {
      id: "bass-ii",
      name: "BASS-II",
      fullName: "Burning and Suppression of Solids - II",
      pillar: "suppression",
      fuelClass: "solid-fabric",
      hardware: "MSG",
      gravity: "microgravity",
      year: 2015,
      relevance: 92,
      image: "/src/assets/images/iss_glovebox_combustion_1794122767129.jpg",
      relevanceBreakdown: {
        crewRelevance: 95,
        moonMarsApplicability: 96,
        measurementRichness: 89,
        fuelCoverage: 91,
        recency: 88,
        hardwareHeritage: 96
      },
      oxygenRange: [15, 35],
      pressureRange: [10.0, 14.7],
      airflowRange: [1.0, 20],
      summary: "Extended BASS research to assess gaseous nitrogen extinguishment thresholds and depressurization strategies on textured fabrics (cotton and Nomex blends). Documented low-speed blow-off limits and the influence of opposed flow velocities simulating spacecraft cabin air circulation loops.",
      citations: [
        { label: "BASS-II Flight Telemetry Summary (NASA-TP-2016-219102)", page: 42, url: "https://ntrs.nasa.gov/citations/20160003411" },
        { label: "Proc. Combust. Inst. Vol 36 (Extinction Boundaries)", page: 3181, url: "https://doi.org/10.1016/j.proci.2016.06.128" }
      ],
      scatter: [
        { o2: 18.0, burnRate: 0.11 },
        { o2: 21.0, burnRate: 0.27 },
        { o2: 24.5, burnRate: 0.44 },
        { o2: 27.0, burnRate: 0.61 },
        { o2: 31.0, burnRate: 0.88 },
        { o2: 35.0, burnRate: 1.15 }
      ]
    },
    {
      id: "saffire-iii",
      name: "Saffire-III",
      fullName: "Spacecraft Fire Safety Demonstration Project - III",
      pillar: "suppression",
      fuelClass: "solid-fabric",
      hardware: "Flow duct",
      gravity: "microgravity",
      year: 2017,
      relevance: 95,
      image: "/src/assets/images/saffire_flame_duct_1794122766942.jpg",
      relevanceBreakdown: {
        crewRelevance: 99,
        moonMarsApplicability: 92,
        measurementRichness: 98,
        fuelCoverage: 94,
        recency: 93,
        hardwareHeritage: 95
      },
      oxygenRange: [21, 75],
      pressureRange: [8.5, 14.7],
      airflowRange: [5.0, 25],
      summary: "Conducted large-scale combustion experiments inside an uncrewed Cygnus cargo vehicle after undocking from the ISS. Evaluated full-scale flame propagation across cotton-fiberglass fabrics and Nomex sheets at elevated airflow rates, demonstrating that microgravity flame spread accelerates dramatically when forced ventilation exceeds 10 cm/s.",
      citations: [
        { label: "Saffire Large-Scale Combustion Results (NASA/TM-2018-219904)", page: 28, url: "https://ntrs.nasa.gov/citations/20180005118" },
        { label: "Acta Astronautica Vol 158 (In-Flight Demonstration)", page: 114, url: "https://doi.org/10.1016/j.actaastro.2018.05.029" }
      ],
      scatter: [
        { o2: 21.0, burnRate: 0.32 },
        { o2: 32.0, burnRate: 0.78 },
        { o2: 45.0, burnRate: 1.45 },
        { o2: 58.0, burnRate: 2.15 },
        { o2: 70.0, burnRate: 3.02 }
      ]
    },
    {
      id: "flex-2",
      name: "FLEX-2",
      fullName: "Flame Extinguishment Experiment - 2",
      pillar: "suppression",
      fuelClass: "liquid-droplet",
      hardware: "CIR",
      gravity: "microgravity",
      year: 2014,
      relevance: 84,
      image: "/src/assets/images/droplet_cool_flame_1794122766620.jpg",
      relevanceBreakdown: {
        crewRelevance: 78,
        moonMarsApplicability: 82,
        measurementRichness: 94,
        fuelCoverage: 80,
        recency: 84,
        hardwareHeritage: 90
      },
      oxygenRange: [14, 40],
      pressureRange: [7.3, 14.7],
      airflowRange: [0, 5],
      summary: "Investigated spherical droplet combustion in the Combustion Integrated Rack (CIR). Discovered low-temperature quasi-steady 'cool flame' burning regime for alkane droplets after radiant extinction, highlighting critical risks of unmonitored vapor accumulation in enclosed microgravity habitats.",
      citations: [
        { label: "FLEX-2 Final Science Review (NASA/CP-2015-218764)", page: 55, url: "https://ntrs.nasa.gov/citations/20150022419" },
        { label: "Science Vol 340 (Cool-Flame Extinction in Microgravity)", page: 1530, url: "https://doi.org/10.1126/science.1235141" }
      ],
      scatter: [
        { o2: 15.0, burnRate: 0.05 },
        { o2: 21.0, burnRate: 0.18 },
        { o2: 26.0, burnRate: 0.38 },
        { o2: 32.0, burnRate: 0.69 },
        { o2: 38.0, burnRate: 0.96 }
      ]
    },
    {
      id: "cfi",
      name: "CFI",
      fullName: "Confined Combustion Investigation",
      pillar: "prevention",
      fuelClass: "solid-plastic",
      hardware: "MSG",
      gravity: "microgravity",
      year: 2020,
      relevance: 91,
      image: "/src/assets/images/hero_microgravity_flame_1794122765420.jpg",
      relevanceBreakdown: {
        crewRelevance: 92,
        moonMarsApplicability: 93,
        measurementRichness: 90,
        fuelCoverage: 88,
        recency: 96,
        hardwareHeritage: 89
      },
      oxygenRange: [18, 30],
      pressureRange: [10.2, 14.7],
      airflowRange: [0.5, 12],
      summary: "Studied flame spread in complex enclosed geometrical gaps and boundary-layer conduits simulating electronics enclosures and duct channels in spacecraft. Identified that thermal confinement traps radiant heat and lowers the material LOC by 3-5% compared to open-chamber testing.",
      citations: [
        { label: "CFI Flight Science Assessment (NASA-TP-2021-001341)", page: 19, url: "https://ntrs.nasa.gov/citations/20210014299" }
      ],
      scatter: [
        { o2: 18.0, burnRate: 0.14 },
        { o2: 21.0, burnRate: 0.31 },
        { o2: 24.0, burnRate: 0.54 },
        { o2: 27.0, burnRate: 0.81 },
        { o2: 30.0, burnRate: 1.12 }
      ]
    },
    {
      id: "same-r",
      name: "SAME-R",
      fullName: "Smoke and Aerosol Measurement Experiment - Reflight",
      pillar: "detection",
      fuelClass: "solid-fabric",
      hardware: "MSG",
      gravity: "microgravity",
      year: 2011,
      relevance: 88,
      image: "/src/assets/images/saffire_flame_duct_1794122766942.jpg",
      relevanceBreakdown: {
        crewRelevance: 96,
        moonMarsApplicability: 86,
        measurementRichness: 88,
        fuelCoverage: 84,
        recency: 78,
        hardwareHeritage: 94
      },
      oxygenRange: [21, 21],
      pressureRange: [14.7, 14.7],
      airflowRange: [2, 10],
      summary: "Measured particle size distribution, concentration, and morphology of smoke particulates emitted by overheating spacecraft materials before ignition. Established that microgravity agglomeration produces smoke particles 3 to 5 times larger than terrestrial counterparts, causing ionization smoke detectors to lag optical obscuration sensors.",
      citations: [
        { label: "SAME-R Final Analysis (NASA/CR-2012-217621)", page: 34, url: "https://ntrs.nasa.gov/citations/20120016843" }
      ],
      scatter: [
        { o2: 21.0, burnRate: 0.20 },
        { o2: 21.0, burnRate: 0.22 },
        { o2: 21.0, burnRate: 0.25 }
      ]
    },
    {
      id: "spice",
      name: "SPICE",
      fullName: "Smoke Point in Co-flow Experiment",
      pillar: "detection",
      fuelClass: "gas",
      hardware: "CIR",
      gravity: "microgravity",
      year: 2013,
      relevance: 82,
      image: "/src/assets/images/hero_microgravity_flame_1794122765420.jpg",
      relevanceBreakdown: {
        crewRelevance: 75,
        moonMarsApplicability: 84,
        measurementRichness: 89,
        fuelCoverage: 82,
        recency: 80,
        hardwareHeritage: 86
      },
      oxygenRange: [21, 50],
      pressureRange: [7.3, 14.7],
      airflowRange: [2, 18],
      summary: "Examined soot generation and laminar smoke point thresholds for gaseous fuels under microgravity co-flow. Validated optical diagnostics algorithms for early precursor pyrolytic gas detection in closed environmental control and life support systems (ECLSS).",
      citations: [
        { label: "SPICE Experiment Report (NASA/TM-2014-218201)", page: 22, url: "https://ntrs.nasa.gov/citations/20140008544" }
      ],
      scatter: [
        { o2: 21.0, burnRate: 0.15 },
        { o2: 28.0, burnRate: 0.32 },
        { o2: 35.0, burnRate: 0.58 },
        { o2: 42.0, burnRate: 0.88 },
        { o2: 50.0, burnRate: 1.25 }
      ]
    },
    {
      id: "acme-bre",
      name: "ACME-BRE",
      fullName: "Advanced Combustion via Microgravity Experiments - Burning Rate Emulator",
      pillar: "prevention",
      fuelClass: "gas",
      hardware: "CIR",
      gravity: "microgravity",
      year: 2019,
      relevance: 89,
      image: "/src/assets/images/droplet_cool_flame_1794122766620.jpg",
      relevanceBreakdown: {
        crewRelevance: 87,
        moonMarsApplicability: 92,
        measurementRichness: 93,
        fuelCoverage: 86,
        recency: 92,
        hardwareHeritage: 89
      },
      oxygenRange: [16, 40],
      pressureRange: [8.0, 14.7],
      airflowRange: [0, 20],
      summary: "Emulated solid fuel burning using porous flat burners to systematically evaluate fuel regression rate, radiation heat loss, and extinction boundaries without the confounding complexity of solid fuel thermal degradation. Provided baseline mathematical models for Artemis habitat materials screening.",
      citations: [
        { label: "ACME-BRE Technical Publication (NASA/TP-2020-500213)", page: 48, url: "https://ntrs.nasa.gov/citations/20205002130" }
      ],
      scatter: [
        { o2: 17.0, burnRate: 0.09 },
        { o2: 20.9, burnRate: 0.24 },
        { o2: 25.0, burnRate: 0.46 },
        { o2: 30.0, burnRate: 0.77 },
        { o2: 35.0, burnRate: 1.12 },
        { o2: 40.0, burnRate: 1.54 }
      ]
    }
  ],

  // Knowledge base for structured Ask Q&A
  knowledgeBase: [
    {
      keywords: ["loc", "limiting oxygen", "nomex", "cotton", "threshold"],
      question: "What is the limiting oxygen concentration for Nomex vs Cotton in microgravity?",
      answer: "Under quiescent or low convective flow conditions (<5 cm/s) in microgravity, the Limiting Oxygen Concentration (LOC) of Nomex aramid fabric increases to approximately 29.5% by volume at 101 kPa (14.7 psi), compared to ~25% under normal terrestrial 1g buoyancy. For standard cellulosic cotton, the microgravity LOC sits at approximately 16.5% to 17.0%. However, when forced ventilation airflows exceed 8 cm/s, flame stabilization improves significantly, lowering Nomex's effective LOC down to 26.2% due to enhanced oxidizer flux without convective heat quenching.",
      citations: [
        { label: "BASS-II Flight Telemetry Summary (NASA-TP-2016-219102)", page: 42, url: "https://ntrs.nasa.gov/citations/20160003411" },
        { label: "Saffire Large-Scale Combustion Results (NASA/TM-2018-219904)", page: 28, url: "https://ntrs.nasa.gov/citations/20180005118" }
      ]
    },
    {
      keywords: ["quench", "quenching", "suppression", "extinction", "nitrogen"],
      question: "Which experiments studied quenching in microgravity?",
      answer: "Microgravity quenching and extinction boundaries have been principally investigated by BASS, BASS-II, and FLEX-2. BASS and BASS-II focused on solid fuel suppression through inert gas dilution (nitrogen purge) and airflow cutoff, finding that flame extinction occurs at higher residual oxygen percentages if airflow drops to zero, because radiational cooling overwhelms the diffusion flame. FLEX-2 studied droplet radiational extinction, observing that large droplets frequently extinguish radiatively before completing fuel consumption, leaving behind unreacted fuel clouds.",
      citations: [
        { label: "BASS Final Science Report (NASA/TM-2015-218485)", page: 14, url: "https://ntrs.nasa.gov/citations/20150019565" },
        { label: "FLEX-2 Final Science Review (NASA/CP-2015-218764)", page: 55, url: "https://ntrs.nasa.gov/citations/20150022419" }
      ]
    },
    {
      keywords: ["airflow", "ventilation", "velocity", "pmma", "spread"],
      question: "How does ventilation airflow affect flame spread on PMMA?",
      answer: "In microgravity, flame spread on polymethyl methacrylate (PMMA) displays a non-monotonic response to forced airflow. In perfectly quiescent environments (0 cm/s), thick PMMA flames often self-extinguish due to oxidizer starvation and spherical soot radiation build-up. As forced flow rises from 2 to 10 cm/s, flame spread velocity increases by up to 340% because fresh oxidizer is supplied while residence times remain long enough for robust gas-phase chemistry. Above 25 cm/s, aerodynamic blow-off effects begin to destabilize the flame base.",
      citations: [
        { label: "CFI Flight Science Assessment (NASA-TP-2021-001341)", page: 19, url: "https://ntrs.nasa.gov/citations/20210014299" },
        { label: "Combustion and Flame, Vol 161", page: 1102, url: "https://doi.org/10.1016/j.combustflame.2013.11.002" }
      ]
    },
    {
      keywords: ["detection", "smoke", "saffire", "detector", "particle"],
      question: "What detection mechanisms were evaluated on Saffire and SAME-R?",
      answer: "SAME-R and Saffire experiments demonstrated that microgravity pyrolytic smoke particles agglomerate into chains 3x to 5x larger in average diameter (0.5 to 1.8 microns) compared to terrestrial soot (0.1 to 0.3 microns). Standard ionization smoke detectors tuned for terrestrial ultrafine aerosols exhibit delayed detection times of up to 45 seconds in microgravity. Consequently, dual-wavelength optical obscuration sensors and carbon monoxide laser absorption detectors are recommended for Artemis lunar surface habitats and Deep Space Gateway architectures.",
      citations: [
        { label: "SAME-R Final Analysis (NASA/CR-2012-217621)", page: 34, url: "https://ntrs.nasa.gov/citations/20120016843" },
        { label: "Saffire Large-Scale Combustion Results (NASA/TM-2018-219904)", page: 31, url: "https://ntrs.nasa.gov/citations/20180005118" }
      ]
    }
  ]
};

// MOCK_MODEL - replace with POST {API_BASE}/predict
export function predictRiskMock({ o2, pressure, airflow, fuelId, thickness }) {
  const fuel = MOCK_DATA.fuels.find(f => f.id === fuelId) || MOCK_DATA.fuels[0];
  const o2Val = Number(o2);
  const pVal = Number(pressure);
  const flowVal = Number(airflow);
  const thickVal = Number(thickness);

  // LOC derivation based on fuel base LOC adjusted by airflow and pressure
  // Microgravity LOC drops as forced airflow supplies oxygen up to 15 cm/s
  const flowAdjustment = flowVal < 15 ? -(flowVal * 0.25) : -(15 * 0.25) + ((flowVal - 15) * 0.1);
  const pressureAdjustment = (14.7 - pVal) * 0.15;
  const locPercent = Math.max(11.0, +(fuel.locBase + flowAdjustment + pressureAdjustment).toFixed(1));

  // Risk Score calculation (0 to 100)
  // 1. Oxygen term: ratio against LOC
  const o2Ratio = o2Val / locPercent;
  let o2Score = Math.min(100, Math.max(0, (o2Ratio - 0.7) * 110));

  // 2. Pressure factor: high pressure increases gas density & flame heat transfer
  const pFactor = Math.min(1.25, Math.max(0.65, pVal / 14.7));

  // 3. Airflow factor: peak danger around 8-16 cm/s in microgravity
  let flowFactor = 1.0;
  if (flowVal <= 12) {
    flowFactor = 0.7 + (flowVal / 12) * 0.6; // 0.7 up to 1.3
  } else {
    flowFactor = 1.3 - ((flowVal - 12) / 25) * 0.35;
  }

  // 4. Thickness factor: thin fuels (low thermal mass) ignite and spread much faster
  const thickFactor = Math.max(0.6, Math.min(1.4, 1.3 / (thickVal * 0.8 + 0.4)));

  let rawScore = o2Score * pFactor * flowFactor * thickFactor;
  const score = Math.round(Math.min(100, Math.max(0, rawScore)));

  // Risk band categorization
  let band = "SAFE";
  if (score >= 66) {
    band = "CRITICAL";
  } else if (score >= 30) {
    band = "CAUTION";
  }

  // Determine Habitat / Operational Regime
  let location = "Nominal Habitat Atmosphere";
  if (o2Val >= 90) {
    location = "EVA Spacesuit 100% O2 Purge";
  } else if (o2Val >= 28 && pVal <= 11.0) {
    location = "Artemis Lunar / Mars Habitat Regime (30% O2 @ 10.2 psi)";
  } else if (pVal < 8.0) {
    location = "Depressurized / Airlock Transient";
  } else if (Math.abs(o2Val - 21.0) <= 1.0 && Math.abs(pVal - 14.7) <= 0.5) {
    location = "Standard Terrestrial / ISS Baseline";
  }

  // Dynamic Engineering Verdict string
  let verdict = "";
  if (score >= 66) {
    verdict = `CRITICAL: Flammability threshold exceeded (${o2Val}% O2 vs LOC ${locPercent}%). Rapid flame propagation supported under ${flowVal} cm/s convection.`;
  } else if (score >= 30) {
    verdict = `CAUTION: Marginal flammability envelope. Sustained smoldering or slow spread possible on ${fuel.label} (${thickVal} mm). Continuous airflow monitoring mandatory.`;
  } else {
    verdict = `SAFE: Non-propagating regime. Environmental oxygen (${o2Val}%) is safely below effective extinction LOC (${locPercent}%).`;
  }

  // Detailed factor contributions (sum to 100%)
  const cO2 = Math.round(Math.min(65, Math.max(20, (o2Val / 60) * 45)));
  const cPres = Math.round(Math.min(30, Math.max(10, (pVal / 15) * 20)));
  const cFlow = Math.round(Math.min(30, Math.max(10, (flowVal / 25) * 22)));
  const cThick = Math.max(5, 100 - (cO2 + cPres + cFlow));

  const contributions = [
    { label: "Oxygen Enrichment", value: cO2 },
    { label: "Pressure Derating", value: cPres },
    { label: "Forced Convection", value: cFlow },
    { label: "Sample Thickness", value: cThick }
  ];

  // Supporting NASA Flight Investigations matching current regime
  const supporting = [];
  if (flowVal >= 5.0) {
    supporting.push({
      id: "saffire-iii",
      name: "Saffire-III",
      matchNote: `Validated convective flow acceleration up to ${flowVal} cm/s aboard Cygnus`
    });
  }
  if (fuelId === "nomex" || fuelId === "cotton") {
    supporting.push({
      id: "bass-ii",
      name: "BASS-II",
      matchNote: `Measured fabric extinction LOC and N2 suppression in MSG on ISS`
    });
  }
  if (fuelId === "pmma" || fuelId === "polyethylene") {
    supporting.push({
      id: "cfi",
      name: "CFI",
      matchNote: `Quantified thermal confinement and radiation traps in polymer channels`
    });
    supporting.push({
      id: "bass",
      name: "BASS",
      matchNote: `Established solid fuel thickness thresholds and low-flow burning boundaries`
    });
  }
  if (fuelId === "droplet") {
    supporting.push({
      id: "flex-2",
      name: "FLEX-2",
      matchNote: `Examined radiational cool-flame extinction in the CIR`
    });
  }
  if (fuelId === "gaseous") {
    supporting.push({
      id: "acme-bre",
      name: "ACME-BRE",
      matchNote: `Emulated solid burning and blow-off limits for Artemis screening`
    });
  }
  if (supporting.length === 0) {
    supporting.push({
      id: "bass",
      name: "BASS",
      matchNote: `Baseline solid material flammability tests in Microgravity Science Glovebox`
    });
  }

  return {
    score,
    locPercent,
    band,
    verdict,
    location,
    contributions,
    supportingInvestigations: supporting.slice(0, 2)
  };
}
