/**
 * FlameSense Main Application Entry & Hash Router
 * Supports zero-build execution directly in browser ES modules.
 */

import { renderTopbar } from "./components/topbar.js";
import { renderTabnav } from "./components/tabnav.js";
import { renderOverview, renderExperiments } from "./components/investigation-table.js";
import { renderInvestigationDetail } from "./components/investigation-detail.js";
import { renderRiskExplorer } from "./components/risk-explorer.js";
import { renderAskPanel } from "./components/ask-panel.js";
import { renderAbout } from "./components/about.js";

/**
 * Route Dispatcher
 */
async function router() {
  const hash = window.location.hash || "#/overview";
  const mainContent = document.getElementById("main-content");
  const tabnavContainer = document.getElementById("tabnav-container");

  if (!mainContent) return;

  // Render navigation with updated active tab
  if (tabnavContainer) {
    renderTabnav(tabnavContainer, hash);
  }

  // Scroll to top of content container
  window.scrollTo({ top: 0, behavior: "instant" });

  // Route matching
  if (hash === "#/overview" || hash === "#" || hash === "" || hash.startsWith("#/overview?")) {
    await renderOverview(mainContent);
  } else if (hash === "#/experiments" || hash.startsWith("#/experiments?")) {
    await renderExperiments(mainContent);
  } else if (hash.startsWith("#/experiment/")) {
    const raw = hash.replace("#/experiment/", "").trim();
    const id = raw.split("?")[0];
    await renderInvestigationDetail(mainContent, id);
  } else if (hash === "#/risk" || hash.startsWith("#/risk?")) {
    await renderRiskExplorer(mainContent);
  } else if (hash === "#/ask" || hash.startsWith("#/ask?")) {
    renderAskPanel(mainContent);
  } else if (hash === "#/about" || hash.startsWith("#/about?")) {
    renderAbout(mainContent);
  } else {
    // 404 fallback
    mainContent.innerHTML = `
      <section class="section-panel" style="text-align: center; padding: 40px 16px;">
        <h2 style="font-size: 18px; color: var(--ink); margin-bottom: 8px;">Route Not Found</h2>
        <p style="color: var(--muted); font-size: 13px; margin-bottom: 16px;">
          The route <code>${escapeHtml(hash)}</code> does not correspond to any FlameSense subsystem.
        </p>
        <a href="#/overview" class="btn btn-accent">Return to Overview</a>
      </section>
    `;
  }

  // Accessibility: shift focus to main container
  mainContent.focus({ preventScroll: true });
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * App Initialization
 */
function init() {
  const topbarContainer = document.getElementById("topbar-container");
  if (topbarContainer) {
    renderTopbar(topbarContainer);
  }

  // Initialize router
  window.addEventListener("hashchange", router);
  router();
}

// Bootstrap once DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
