/**
 * Tab Navigation Component
 * Compact, accessible navigation strip directly beneath topbar.
 */

const TABS = [
  { id: "overview", label: "Overview", hash: "#/overview" },
  { id: "experiments", label: "Experiments", hash: "#/experiments" },
  { id: "risk", label: "Risk Explorer", hash: "#/risk" },
  { id: "ask", label: "Ask FlameSense", hash: "#/ask" },
  { id: "about", label: "About & Architecture", hash: "#/about" }
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
    <div class="tabnav-inner">
      ${TABS.map(tab => {
        const isActive = tab.id === activeTabId;
        return `
          <a
            href="${tab.hash}"
            class="tab-link ${isActive ? "active" : ""}"
            ${isActive ? 'aria-current="page"' : ""}
            data-tab-id="${tab.id}"
          >
            ${tab.label}
          </a>
        `;
      }).join("")}
    </div>
  `;
}
