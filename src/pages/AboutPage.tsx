import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Compass, Cpu, Database, Flame, ShieldCheck, Telescope } from 'lucide-react';
import { Breadcrumbs } from '../components/Breadcrumbs.tsx';
import { RevealOnScroll } from '../components/RevealOnScroll.tsx';

const CHALLENGE_CARDS = [
  {
    title: 'Unique Fire Behavior',
    image: '/images/about_spherical_flame_1794640582932.jpg',
    imageAlt: 'Hollow microgravity flame front hovering above woven fiberglass-cotton textile sample',
    icon: Flame,
    points: [
      'Fire forms spherical diffusion flames without buoyant plumes.',
      'Natural convection disappears, leaving diffusion and forced HVAC flow.',
      'Cool flames (~500–800 K) can burn invisibly after soot extinction.',
    ],
  },
  {
    title: 'Crew Safety',
    image: '/images/about_crew_fire_safety_1794640582879.jpg',
    imageAlt: 'Astronaut inspecting cabin fire suppression cylinder and optical smoke sensor console',
    icon: ShieldCheck,
    points: [
      'Even localized electrical or fabric fires threaten closed life-support loops.',
      'Microgravity smoke particles agglomerate into larger chains that delay alarms.',
      'Crew habitats with elevated oxygen (30% O₂) sharply reduce ignition margins.',
    ],
  },
  {
    title: 'NASA Research Data',
    image: '/images/about_nasa_telemetry_rack_1794640585074.jpg',
    imageAlt: 'Orbital combustion science racks, fiber-optic sensor leads, and optical diagnostics',
    icon: Database,
    points: [
      'Built upon ISS MSG, CIR, and Cygnus Saffire flight experiments.',
      'Validated Limiting Oxygen Concentration (LOC) bounds across fuels.',
      'Traceable citations linking directly to NASA Technical Reports (NTRS).',
    ],
  },
];

const GRAVITY_COMPARISON = [
  {
    dimension: 'Flame Geometry',
    earth: 'Teardrop / upward buoyant plume driven by hot gas rising.',
    space: 'Spherical or flat boundary-layer flame hugging fuel surfaces.',
  },
  {
    dimension: 'Ventilation Effect',
    earth: 'High drafts help cool and blow out small fires.',
    space: 'Low cabin airflow (5–20 cm/s) feeds oxygen and sustains flames below 1g LOC.',
  },
  {
    dimension: 'Smoke Transport',
    earth: 'Rises rapidly toward ceiling smoke alarms.',
    space: 'Drifts with HVAC currents and forms 3–5× larger soot agglomerates.',
  },
  {
    dimension: 'Extinction Behavior',
    earth: 'Visual flame extinction marks termination of oxidation.',
    space: 'Alkane droplets can transition into invisible low-temperature cool flames.',
  },
];

const METHODOLOGY_PILLARS = [
  {
    icon: Telescope,
    title: 'Empirical Experiment Indexing',
    description:
      'Normalizes NASA ISS and Cygnus combustion campaigns into searchable parameters, verified NTRS findings, and fuel operating envelopes.',
  },
  {
    icon: Compass,
    title: 'Weighted Crew-Safety Ranking',
    description:
      'Calculates relevance transparently across six safety criteria—crew safety directness, habitat applicability, telemetry fidelity, material breadth, heritage, and recency.',
  },
  {
    icon: Cpu,
    title: 'Physics-Guided AI + Exact SHAP',
    description:
      'Predicts SAFE / CAUTION / DANGER regimes and effective LOC across cabin O₂, pressure, airflow, and fuel types with exact 16-coalition Shapley explanations.',
  },
];

export const AboutPage: React.FC = () => {
  return (
    <main className="relative min-h-screen bg-[#060607] pt-28 pb-20">
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-10">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'About' }]} />

        {/* Header */}
        <RevealOnScroll className="max-w-3xl mb-14">
          <div className="mb-4 flex items-center gap-3">
            <span className="h-[1.5px] w-8 bg-[#D97B29] shrink-0" aria-hidden="true" />
            <span className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#A9A39A]">
              Combustion Physics
            </span>
          </div>
          <h1 className="font-serif-display text-4xl font-normal tracking-tight text-[#F3EFE8] sm:text-5xl">
            Why Is <span className="italic text-[#D97B29]">Space Fire</span> Different?
          </h1>
          <p className="mt-4 text-sm sm:text-base leading-relaxed text-[#C2BCB2]">
            Fire behaves fundamentally differently in microgravity. Without natural buoyancy-driven convection,
            flames become spherical, sustain combustion at lower oxygen thresholds, and pose distinct detection
            and suppression challenges for spacecraft crews.
          </p>
        </RevealOnScroll>

        {/* Three Challenge Editorial Cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 mb-16">
          {CHALLENGE_CARDS.map((card, index) => {
            const Icon = card.icon;
            return (
              <RevealOnScroll key={card.title} delay={index * 0.08}>
                <article className="editorial-card flex h-full flex-col p-5">
                  <div className="relative mb-5 aspect-[16/9] w-full overflow-hidden border border-white/10 bg-[#060607]">
                    <img
                      src={card.image}
                      alt={card.imageAlt}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                      style={{ filter: 'contrast(1.06) brightness(0.9)' }}
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#060607]/60 via-transparent to-transparent" />
                  </div>

                  <div className="mb-4 flex items-center gap-2.5">
                    <Icon className="h-4 w-4 shrink-0 text-[#D97B29]" />
                    <h2 className="font-serif-display text-xl font-normal text-[#F3EFE8]">{card.title}</h2>
                  </div>

                  <ul className="space-y-2.5 text-sm text-[#C2BCB2]">
                    {card.points.map((point) => (
                      <li key={point} className="flex items-start gap-2.5">
                        <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#D97B29]" />
                        <span className="leading-snug">{point}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              </RevealOnScroll>
            );
          })}
        </div>

        {/* 1g vs 0g Combustion Physics Table */}
        <RevealOnScroll className="mb-16">
          <div className="editorial-panel overflow-hidden p-6 sm:p-8">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-serif-display text-2xl sm:text-3xl font-normal text-[#F3EFE8]">
                  Terrestrial (1g) vs. <span className="italic text-[#D97B29]">Microgravity (0g)</span> Combustion
                </h2>
                <p className="mt-1.5 text-xs sm:text-sm text-[#A9A39A]">
                  Physical differences observed across NASA BASS, BASS-II, Saffire, FLEX-2, and SAME-R flight tests.
                </p>
              </div>
              <Link
                to="/experiments"
                className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] font-medium text-[#D97B29] hover:text-[#E68A38]"
              >
                <span>Browse Source Experiments</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-white/12 text-[11px] uppercase tracking-[0.16em] text-[#8A847B]">
                    <th className="py-3 pr-4">Physical Regime</th>
                    <th className="py-3 px-4">Earth Gravity (1g)</th>
                    <th className="py-3 pl-4 text-[#D97B29]">Spacecraft Microgravity (~10⁻⁶ g)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {GRAVITY_COMPARISON.map((row) => (
                    <tr key={row.dimension} className="hover:bg-white/[0.02]">
                      <td className="py-3.5 pr-4 font-medium text-[#F3EFE8]">{row.dimension}</td>
                      <td className="py-3.5 px-4 text-[#8A847B]">{row.earth}</td>
                      <td className="py-3.5 pl-4 text-[#C2BCB2]">{row.space}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </RevealOnScroll>

        {/* Project Objectives & Methodology */}
        <RevealOnScroll>
          <div className="mb-8">
            <h2 className="font-serif-display text-2xl sm:text-3xl font-normal text-[#F3EFE8]">
              Objectives &amp; <span className="italic text-[#D97B29]">Platform Methodology</span>
            </h2>
            <p className="mt-2 text-sm text-[#A9A39A] max-w-2xl">
              Flame in Freefall translates NASA microgravity combustion archives into an operational decision-support
              platform for exploration mission planners and habitat safety engineers.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {METHODOLOGY_PILLARS.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div key={pillar.title} className="editorial-panel p-6">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center border border-[#D97B29]/45 bg-[#D97B29]/10 text-[#D97B29]">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="font-serif-display text-lg font-normal text-[#F3EFE8]">{pillar.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-[#A9A39A]">{pillar.description}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              to="/experiments"
              className="inline-flex items-center gap-3 border border-[#D97B29]/75 bg-[#D97B29]/10 px-6 py-3 text-[11px] font-medium uppercase tracking-[0.2em] text-[#E68A38] transition-colors hover:bg-[#D97B29] hover:text-[#060607]"
            >
              <span>Explore NASA Experiments</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              to="/prediction"
              className="inline-flex items-center gap-3 border border-white/15 bg-[#0E0E11] px-6 py-3 text-[11px] font-medium uppercase tracking-[0.2em] text-[#C2BCB2] transition-colors hover:border-[#D97B29]/60 hover:text-[#F3EFE8]"
            >
              <span>Launch Fire Risk Predictor</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </RevealOnScroll>
      </div>
    </main>
  );
};
