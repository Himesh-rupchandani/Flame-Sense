import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { NasaLogo } from './NasaLogo.tsx';

export const Footer: React.FC = () => {
  return (
    <footer className="relative z-10 border-t border-white/10 bg-[#060607] py-6">
      <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-4 px-5 sm:px-8 lg:flex-row lg:px-10">
        <Link to="/" className="flex items-center gap-3 hover:opacity-90">
          <NasaLogo className="h-7 w-9" />
          <span className="font-serif-display text-xs uppercase tracking-[0.14em] text-[#F3EFE8]">
            Flame in Freefall
          </span>
        </Link>

        <nav
          aria-label="Footer Navigation"
          className="flex flex-wrap items-center justify-center gap-4 text-[11px] uppercase tracking-[0.14em] text-[#8A847B]"
        >
          <span>NASA Hackathon 2026</span>
          <span aria-hidden="true">·</span>
          <Link to="/about" className="hover:text-[#D97B29] transition-colors">
            About
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/experiments" className="hover:text-[#D97B29] transition-colors">
            Experiments
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/ranking" className="hover:text-[#D97B29] transition-colors">
            Ranking
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/prediction" className="hover:text-[#D97B29] transition-colors">
            Prediction
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/data-lab" className="hover:text-[#D97B29] transition-colors">
            Data Lab
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/insights" className="hover:text-[#D97B29] transition-colors">
            Insights
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/contact" className="hover:text-[#D97B29] transition-colors">
            Contact
          </Link>
        </nav>

        <a
          href="https://ntrs.nasa.gov/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 border border-white/15 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-[#C2BCB2] transition-colors hover:border-[#D97B29] hover:text-[#D97B29]"
        >
          <span>NASA NTRS</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </footer>
  );
};
