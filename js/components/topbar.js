/**
 * Topbar Component
 * 50px height, NASA-inspired deep green branding, flame glyph,
 * subtle NASA HACKATHON project identifier, and DEMO DATA chip.
 */

export function renderTopbar(container) {
  container.innerHTML = `
    <div class="topbar-inner">
      <div style="display: flex; align-items: center; gap: 14px;">
        <a href="#/overview" class="brand-lockup" title="FlameSense — Spacecraft Combustion Intelligence">
          <div class="brand-icon-wrap" aria-hidden="true">
            <svg width="16" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C10.5 5.5 8 8 8 11.5c0 2.2 1.8 4 4 4s4-1.8 4-4c0-1.8-.8-3.4-2-4.5.3 1.2-.2 2.5-1.2 3.2-.2-1.7-.8-3.3-1.8-4.7C9.8 8.2 9 10 9 12c0 1.7 1.3 3 3 3s3-1.3 3-3c0-2-1.5-4-3-10z" />
            </svg>
          </div>
          <span class="brand-title">
            Flame<span class="accent-text">Sense</span>
          </span>
          <span class="brand-tagline">Microgravity Flammability Analytics</span>
        </a>
      </div>

      <div class="topbar-meta-cluster">
        <span class="hackathon-chip" title="Project built for NASA Space Apps / Hackathon Challenge">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path>
            <path d="M2 12h20"></path>
          </svg>
          NASA HACKATHON
        </span>
        <span class="demo-chip" title="Local empirical simulation mode enabled">DEMO DATA</span>
      </div>
    </div>
  `;
}
