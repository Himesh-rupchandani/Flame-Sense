/**
 * Floating Segmented Navigation Bar Component
 * Featuring embedded badge counters, micro-icons, and organic active states.
 */

const TABS = [
  {
    id: "overview",
    label: "Overview",
    hash: "#/overview",
    badge: "LIVE",
    isLive: true,
    icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>`
  },
  {
    id: "experiments",
    label: "Experiments",
    hash: "#/experiments",
    badge: "24",
    isCount: true,
    icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg>`
  },
  {
    id: "risk",
    label: "Risk Explorer",
    hash: "#/risk",
    badge: "LOC CALC",
    icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`
  },
  {
    id: "ask",
    label: "Ask FlameSense",
    hash: "#/ask",
    badge: "NTRS",
    icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`
  },
  {
    id: "about",
    label: "About & Docs",
    hash: "#/about",
    badge: "NASA",
    icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`
  }
];

export function renderTabnav(container, currentRoute) {
  let activeTabId = "overview";
  if (currentRoute.startsWith("#/experiment")) {
    activeTabId = "experiments";
  } else if (currentRoute.startsWith("#/risk")) {
    activeTabId = "risk";
  } else if (currentRoute.startsWith("#/ask")) {
    activeTabId = "ask";
  } else if (currentRoute.startsWith("#/about")) {
    activeTabId = "about";
  }

  container.innerHTML = `
    <div class="floating-nav-wrap">
      <nav class="floating-nav-bar" role="tablist" aria-label="Main Subsystem Navigation">
        ${TABS.map(tab => {
          const isActive = tab.id === activeTabId;
          return `
            <a
              href="${tab.hash}"
              class="nav-segment-btn ${isActive ? "active" : ""}"
              ${isActive ? 'aria-current="page"' : ""}
              data-tab-id="${tab.id}"
              role="tab"
            >
              ${tab.icon}
              <span>${tab.label}</span>
              <span class="nav-badge-chip ${tab.isLive ? "badge-live" : ""}">
                ${tab.isLive ? '<span class="live-pip" aria-hidden="true"></span>' : ""}
                ${tab.badge}
              </span>
            </a>
          `;
        }).join("")}
      </nav>
    </div>
  `;
}
