import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Droplet, Flame, ShieldCheck } from 'lucide-react';
import { HeroSection } from '../components/HeroSection.tsx';

export const HomePage: React.FC = () => {
  return (
    <main className="w-full overflow-hidden bg-[#060607]">
      <HeroSection />

      {/* Section 2: Fire in Microgravity (Peeks cleanly at bottom of 100vh desktop fold matching reference) */}
      <section
        id="fire-in-microgravity"
        className="border-t border-white/10 bg-[#060607]"
      >
        <div className="mx-auto max-w-[1400px]">
          <div className="grid grid-cols-1 items-stretch lg:grid-cols-12">
            {/* Left Photographic Panel: Desaturated low-key NASA suit & spacecraft hardware */}
            <div className="relative min-h-[240px] overflow-hidden bg-[#09090B] lg:col-span-5 lg:min-h-[340px]">
              <img
                src="/images/iss_glovebox_combustion_1794122767129.jpg"
                alt="Microgravity combustion glovebox and NASA flight hardware"
                loading="lazy"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover object-[78%_48%]"
                style={{
                  filter: 'grayscale(62%) contrast(1.22) brightness(0.72)',
                }}
              />
              {/* Soft vignette blending right & vertical edges cleanly into #060607 */}
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'linear-gradient(90deg, rgba(6,6,7,0.35) 0%, rgba(6,6,7,0.12) 45%, rgba(6,6,7,0.92) 96%, #060607 100%)',
                }}
              />
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-16"
                style={{
                  background: 'linear-gradient(180deg, rgba(6,6,7,0.65) 0%, rgba(6,6,7,0) 100%)',
                }}
              />
            </div>

            {/* Center Editorial Copy: THE SCIENCE / Fire in Microgravity */}
            <div className="flex flex-col justify-center px-5 py-10 sm:px-8 lg:col-span-4 lg:px-10 lg:py-14">
              <div className="flex items-center gap-3">
                <span className="h-[1.5px] w-8 bg-[#D97B29] shrink-0" aria-hidden="true" />
                <span className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#A9A39A]">
                  The Science
                </span>
              </div>

              <h2 className="font-serif-display mt-4 text-3xl font-normal leading-[1.15] text-[#F3EFE8] sm:text-[38px]">
                Fire in Microgravity
              </h2>

              <p className="font-serif-display mt-4 text-[15px] leading-[1.68] text-[#B8B2A8]">
                In space, fire behaves differently. Without natural convection, flames can spread unpredictably, posing unique risks to astronauts.
              </p>

              <div className="mt-6">
                <Link
                  to="/about"
                  className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-[#D97B29] transition-colors hover:text-[#E68A38] focus-visible:outline-1 focus-visible:outline-[#D97B29]"
                >
                  <span>Read Microgravity Physics</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Right Key Phenomena Column separated by subtle hairline divider */}
            <div className="flex flex-col justify-center gap-6 px-5 pb-12 pt-2 sm:px-8 lg:col-span-3 lg:border-l lg:border-white/10 lg:px-10 lg:py-14">
              <div className="flex items-center gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#D97B29]/55 text-[#D97B29]">
                  <Flame className="h-4 w-4 stroke-[1.5]" />
                </span>
                <span className="text-sm font-normal tracking-[0.01em] text-[#C2BCB2]">
                  Altered Flame Behavior
                </span>
              </div>

              <div className="flex items-center gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#D97B29]/55 text-[#D97B29]">
                  <Droplet className="h-4 w-4 stroke-[1.5]" />
                </span>
                <span className="text-sm font-normal tracking-[0.01em] text-[#C2BCB2]">
                  Unique Oxygen Dynamics
                </span>
              </div>

              <div className="flex items-center gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#D97B29]/55 text-[#D97B29]">
                  <ShieldCheck className="h-4 w-4 stroke-[1.5]" />
                </span>
                <span className="text-sm font-normal tracking-[0.01em] text-[#C2BCB2]">
                  Greater Safety Challenges
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};
