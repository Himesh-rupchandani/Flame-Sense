import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import earthHorizonSource from '../assets/images/hero_astronaut_iss_earth_1794638816992.jpg';

export const HeroSection: React.FC = () => {
  const handleScrollDown = () => {
    const target = document.getElementById('fire-in-microgravity');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <section
      id="home"
      className="relative flex w-full flex-col justify-between overflow-hidden bg-[#060607] pt-[72px] min-h-[620px] lg:h-[calc(100vh-120px)] lg:min-h-[620px] lg:max-h-[820px]"
    >
      {/* Layer 1: Bottom-left Curved Earth Horizon & Golden Sunrise Glow (cropped/masked to omit upper-right subjects) */}
      <div
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
        aria-hidden="true"
      >
        <img
          src={earthHorizonSource}
          alt=""
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover object-[8%_92%] scale-[1.06]"
          style={{
            filter: 'saturate(0.76) contrast(1.08) brightness(0.86)',
            WebkitMaskImage:
              'radial-gradient(ellipse 60% 52% at 28% 88%, rgba(0,0,0,0.96) 20%, rgba(0,0,0,0.52) 48%, rgba(0,0,0,0) 74%)',
            maskImage:
              'radial-gradient(ellipse 60% 52% at 28% 88%, rgba(0,0,0,0.96) 20%, rgba(0,0,0,0.52) 48%, rgba(0,0,0,0) 74%)',
          }}
        />
        {/* Subtle bottom-edge vignette blending horizon smoothly into matte black */}
        <div
          className="absolute inset-x-0 bottom-0 h-24"
          style={{
            background:
              'linear-gradient(180deg, rgba(6,6,7,0) 0%, rgba(6,6,7,0.88) 78%, #060607 100%)',
          }}
        />
      </div>

      {/* Layer 2: Right-side Spacecraft Microgravity Combustion Chamber & Spherical Flame */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-full md:w-[68%] lg:w-[62%]"
        aria-hidden="true"
      >
        <img
          src="/images/hero_microgravity_flame_1794122765420.jpg"
          alt=""
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover object-[42%_48%]"
          style={{
            filter: 'contrast(1.12) saturate(1.16) brightness(0.92)',
            WebkitMaskImage:
              'linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.45) 24%, rgba(0,0,0,1) 48%, rgba(0,0,0,0.92) 86%, rgba(0,0,0,0.28) 100%)',
            maskImage:
              'linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.45) 24%, rgba(0,0,0,1) 48%, rgba(0,0,0,0.92) 86%, rgba(0,0,0,0.28) 100%)',
          }}
        />
        {/* Soft top & bottom dark framing */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(6,6,7,0.72) 0%, rgba(6,6,7,0) 20%, rgba(6,6,7,0) 80%, rgba(6,6,7,0.92) 100%)',
          }}
        />
      </div>

      {/* Layer 3: Left Typography Contrast Scrim (minimal & natural) */}
      <div
        className="pointer-events-none absolute inset-0 z-[2]"
        aria-hidden="true"
        style={{
          background:
            'linear-gradient(90deg, rgba(6,6,7,0.86) 0%, rgba(6,6,7,0.62) 34%, rgba(6,6,7,0.08) 58%, rgba(6,6,7,0) 100%)',
        }}
      />

      {/* Main Editorial Hero Content */}
      <div className="relative z-10 mx-auto flex w-full max-w-[1400px] flex-1 flex-col justify-between px-5 py-12 sm:px-8 lg:px-10 lg:py-14">
        <div className="my-auto max-w-[560px]">
          {/* Kicker with horizontal orange rule */}
          <div className="mb-6 flex items-center gap-3.5">
            <span className="h-[1.5px] w-8 bg-[#D97B29] shrink-0" aria-hidden="true" />
            <span className="text-[10px] sm:text-[11px] font-medium uppercase tracking-[0.24em] text-[#A9A39A]">
              Understanding Space Fire. Ensuring Astronaut Safety.
            </span>
          </div>

          {/* Editorial Serif Headline */}
          <h1 className="font-serif-display text-[44px] font-normal leading-[1.03] tracking-[-0.015em] text-[#F3EFE8] sm:text-[60px] lg:text-[74px]">
            Flame Behaves
            <br />
            Differently
            <br />
            <span className="italic text-[#D97B29]">in Orbit.</span>
          </h1>

          {/* Editorial Serif Sub-copy */}
          <p className="font-serif-display mt-6 max-w-[440px] text-[15px] leading-[1.6] text-[#C2BCB2] sm:text-[17px]">
            Explore NASA&apos;s combustion experiments and understand the science behind safer spacecraft environments.
          </p>

          {/* Rectangular Orange-Bordered CTA */}
          <div className="mt-8 sm:mt-9">
            <Link
              to="/experiments"
              className="inline-flex items-center gap-4 border border-[#D97B29]/75 bg-[#060607]/65 px-6 py-3.5 text-[11px] font-medium uppercase tracking-[0.22em] text-[#E68A38] transition-colors duration-200 hover:border-[#D97B29] hover:bg-[#D97B29]/12 hover:text-[#F3EFE8] focus-visible:outline-1 focus-visible:outline-[#D97B29]"
            >
              <span>Explore the Research</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Bottom-Left Scroll Cue matching reference */}
        <div className="pt-8">
          <button
            type="button"
            onClick={handleScrollDown}
            className="group inline-flex cursor-pointer items-center gap-3 text-[10px] font-medium uppercase tracking-[0.24em] text-[#8A847B] transition-colors hover:text-[#F3EFE8] focus-visible:outline-1 focus-visible:outline-[#D97B29]"
          >
            <span className="flex h-6 w-3.5 items-start justify-center rounded-full border border-[#8A847B]/70 p-1 group-hover:border-[#D97B29]">
              <span className="h-1.5 w-[1.5px] rounded-full bg-[#C2BCB2] group-hover:bg-[#D97B29]" />
            </span>
            <span>Scroll to Explore</span>
          </button>
        </div>
      </div>
    </section>
  );
};
