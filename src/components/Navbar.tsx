import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, Menu, X } from 'lucide-react';
import { NasaLogo } from './NasaLogo.tsx';

const DASHBOARD_ITEMS = [
  { to: '/experiments', label: 'Experiments' },
  { to: '/ranking', label: 'Experiment Ranking' },
  { to: '/prediction', label: 'Fire Risk Prediction' },
];

export const Navbar: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();

  const isDashboardActive =
    location.pathname.startsWith('/experiments') ||
    location.pathname.startsWith('/ranking') ||
    location.pathname.startsWith('/prediction');

  useEffect(() => {
    setDashboardOpen(false);
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDashboardOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDashboardOpen(false);
        setMobileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const navLinkClass = (active: boolean) =>
    `relative whitespace-nowrap shrink-0 py-1 text-[13px] font-medium tracking-[0.02em] transition-colors focus-visible:outline-1 focus-visible:outline-[#D97B29] ${
      active ? 'text-[#F3EFE8]' : 'text-[#A9A39A] hover:text-[#F3EFE8]'
    }`;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-[#060607]/90 backdrop-blur-sm">
      <div className="mx-auto flex h-[72px] max-w-[1400px] items-center justify-between gap-6 px-5 sm:px-8 lg:px-10">
        {/* Left Zone: NASA Logo | FLAME IN FREEFALL */}
        <Link
          to="/"
          className="flex items-center gap-4 shrink-0 focus-visible:outline-1 focus-visible:outline-[#D97B29]"
          aria-label="Flame in Freefall Home"
        >
          <NasaLogo className="h-9 w-11" />
          <span className="h-7 w-px bg-white/20" aria-hidden="true" />
          <div className="font-serif-display text-[13px] font-medium uppercase leading-[1.15] tracking-[0.12em] text-[#F3EFE8]">
            <div>FLAME</div>
            <div>IN FREEFALL</div>
          </div>
        </Link>

        {/* Center Zone: Horizontal Text Navigation (Home, About, Dashboard v, Insights, Contact) */}
        <nav aria-label="Primary Navigation" className="hidden lg:flex items-center gap-8">
          <NavLink to="/" end className={({ isActive }) => navLinkClass(isActive)}>
            {({ isActive }) => (
              <>
                <span>Home</span>
                {isActive && (
                  <span className="absolute -bottom-2 left-0 right-0 h-[1.5px] bg-[#D97B29]" />
                )}
              </>
            )}
          </NavLink>

          <NavLink to="/about" className={({ isActive }) => navLinkClass(isActive)}>
            {({ isActive }) => (
              <>
                <span>About</span>
                {isActive && (
                  <span className="absolute -bottom-2 left-0 right-0 h-[1.5px] bg-[#D97B29]" />
                )}
              </>
            )}
          </NavLink>

          {/* Dashboard Dropdown */}
          <div
            ref={dropdownRef}
            className="relative"
            onMouseEnter={() => setDashboardOpen(true)}
            onMouseLeave={() => setDashboardOpen(false)}
          >
            <button
              type="button"
              onClick={() => setDashboardOpen((prev) => !prev)}
              aria-expanded={dashboardOpen}
              aria-haspopup="menu"
              className={`${navLinkClass(isDashboardActive)} inline-flex cursor-pointer items-center gap-1`}
            >
              <span>Dashboard</span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-150 ${
                  dashboardOpen ? 'rotate-180 text-[#D97B29]' : ''
                }`}
              />
              {isDashboardActive && (
                <span className="absolute -bottom-2 left-0 right-0 h-[1.5px] bg-[#D97B29]" />
              )}
            </button>

            {dashboardOpen && (
              <div
                role="menu"
                className="absolute left-0 top-full pt-2 z-50 min-w-[220px]"
              >
                <div className="border border-white/12 bg-[#0C0C0E] py-1.5 shadow-[0_16px_32px_rgba(0,0,0,0.85)]">
                  {DASHBOARD_ITEMS.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      role="menuitem"
                      className={({ isActive }) =>
                        `block px-4 py-2.5 text-xs tracking-[0.04em] transition-colors ${
                          isActive
                            ? 'bg-[#D97B29]/12 text-[#D97B29] font-medium'
                            : 'text-[#C2BCB2] hover:bg-white/5 hover:text-[#F3EFE8]'
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            )}
          </div>

          <NavLink to="/insights" className={({ isActive }) => navLinkClass(isActive)}>
            {({ isActive }) => (
              <>
                <span>Insights</span>
                {isActive && (
                  <span className="absolute -bottom-2 left-0 right-0 h-[1.5px] bg-[#D97B29]" />
                )}
              </>
            )}
          </NavLink>

          <NavLink to="/contact" className={({ isActive }) => navLinkClass(isActive)}>
            {({ isActive }) => (
              <>
                <span>Contact</span>
                {isActive && (
                  <span className="absolute -bottom-2 left-0 right-0 h-[1.5px] bg-[#D97B29]" />
                )}
              </>
            )}
          </NavLink>
        </nav>

        {/* Right Zone: NASA HACKATHON 2026 | Burnt-Orange Orbit Emblem */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="hidden sm:flex items-center gap-4">
            <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#B8B2A8] whitespace-nowrap">
              NASA HACKATHON 2026
            </span>
            <span className="h-6 w-px bg-white/20" aria-hidden="true" />
            <Link
              to="/prediction"
              aria-label="Open Fire Risk Prediction"
              className="flex items-center justify-center text-[#D97B29] transition-opacity hover:opacity-80"
            >
              <svg viewBox="0 0 28 28" className="h-6 w-6" fill="none" aria-hidden="true">
                <circle cx="14" cy="14" r="5.5" stroke="currentColor" strokeWidth="1.35" />
                <ellipse
                  cx="14"
                  cy="14"
                  rx="11.5"
                  ry="4"
                  transform="rotate(-38 14 14)"
                  stroke="currentColor"
                  strokeWidth="1.25"
                />
              </svg>
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="inline-flex lg:hidden cursor-pointer items-center justify-center border border-white/15 bg-[#0E0E11] p-2 text-[#F3EFE8] hover:border-[#D97B29]"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile & Tablet Navigation Drawer */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-white/10 bg-[#08080A] px-5 py-4">
          <nav aria-label="Mobile Navigation" className="flex flex-col gap-1">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `px-3 py-2.5 text-sm font-medium border-l-2 ${
                  isActive
                    ? 'border-[#D97B29] text-[#F3EFE8] bg-white/5'
                    : 'border-transparent text-[#A9A39A]'
                }`
              }
            >
              Home
            </NavLink>
            <NavLink
              to="/about"
              className={({ isActive }) =>
                `px-3 py-2.5 text-sm font-medium border-l-2 ${
                  isActive
                    ? 'border-[#D97B29] text-[#F3EFE8] bg-white/5'
                    : 'border-transparent text-[#A9A39A]'
                }`
              }
            >
              About
            </NavLink>

            <div className="mt-2 pt-2 border-t border-white/10">
              <div className="px-3 pb-1 text-[10px] uppercase tracking-[0.2em] text-[#D97B29]">
                Dashboard
              </div>
              {DASHBOARD_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `block px-5 py-2 text-sm border-l-2 ${
                      isActive
                        ? 'border-[#D97B29] text-[#F3EFE8] bg-white/5'
                        : 'border-transparent text-[#A9A39A]'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>

            <NavLink
              to="/insights"
              className={({ isActive }) =>
                `mt-1 px-3 py-2.5 text-sm font-medium border-l-2 ${
                  isActive
                    ? 'border-[#D97B29] text-[#F3EFE8] bg-white/5'
                    : 'border-transparent text-[#A9A39A]'
                }`
              }
            >
              Insights
            </NavLink>
            <NavLink
              to="/contact"
              className={({ isActive }) =>
                `px-3 py-2.5 text-sm font-medium border-l-2 ${
                  isActive
                    ? 'border-[#D97B29] text-[#F3EFE8] bg-white/5'
                    : 'border-transparent text-[#A9A39A]'
                }`
              }
            >
              Contact
            </NavLink>
          </nav>
        </div>
      )}
    </header>
  );
};
