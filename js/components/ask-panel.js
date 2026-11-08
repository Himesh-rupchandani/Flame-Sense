/**
 * Ask FlameSense Component
 * Scientific research assistant and semantic query interface.
 * Clean conversation layout, suggested research questions, message history,
 * citation chips, and flight disclaimer.
 */

import { ask } from "../services/api.js";

const SUGGESTIONS = [
  "What is the limiting oxygen concentration for Nomex vs Cotton in microgravity?",
  "Which experiments studied quenching in microgravity?",
  "How does ventilation airflow affect flame spread on PMMA?",
  "What detection mechanisms were evaluated on Saffire and SAME-R?"
];

export function renderAskPanel(container) {
  container.innerHTML = `
    <section class="section-panel" style="margin-bottom: 0;">
      <header class="panel-header">
        <div>
          <h1 class="panel-title" style="font-size: 16.5px;">Ask FlameSense &bull; Combustion Intelligence Assistant</h1>
          <div class="panel-subtitle">
            Semantic inquiry across 24 indexed NASA microgravity flight reports, NTRS technical memorandums &amp; STD-6001B
          </div>
        </div>
        <span class="font-mono" style="font-size: 10.5px; color: var(--muted);">NASA CORPUS EMBEDDINGS</span>
      </header>

      <div class="panel-body">
        <!-- Suggested Research Inquiries -->
        <div style="margin-bottom: 18px;">
          <div style="font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.04em;">
            Suggested Exploration Inquiries
          </div>
          <div class="ask-suggestions-grid">
            ${SUGGESTIONS.map(s => `
              <button type="button" class="ask-sug-button" data-question="${s}">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent); flex-shrink: 0;" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                <span>${s}</span>
              </button>
            `).join("")}
          </div>
        </div>

        <!-- Conversation History Container -->
        <div class="ask-conversation-stream" id="ask-stream" role="region" aria-label="Conversation history">
          <!-- Initial Assistant Welcome -->
          <div class="ask-assistant-card ask-msg-bubble">
            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
              <strong style="color: var(--accent-dark); font-size: 12.5px;">
                FlameSense Research Assistant
              </strong>
              <span class="font-mono" style="font-size: 10.5px; color: var(--muted);">SYSTEM READY</span>
            </div>
            <p style="color: var(--ink); font-size: 13px; line-height: 1.55;">
              Welcome to the NASA Microgravity Flammability Intelligence Console. Ask any question regarding material limiting oxygen concentrations (LOC), convective ventilation effects on flame spread, aerosol particle size shifts, or extinguishment thresholds across BASS, Saffire, and FLEX flight trials.
            </p>
          </div>
        </div>

        <!-- Input Dock -->
        <form id="ask-form" class="ask-input-dock" role="search" aria-label="Ask research question">
          <input
            type="text"
            id="ask-query-input"
            class="ask-input-field"
            placeholder="Type your combustion research question (e.g. How does airflow affect PMMA burning rate?)..."
            autocomplete="off"
            required
          />
          <button type="submit" class="btn btn-accent" id="ask-send-btn" style="padding: 0 18px; font-weight: 600;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
            <span>Query</span>
          </button>
        </form>

        <div style="margin-top: 10px; font-size: 11px; color: var(--muted); display: flex; justify-content: space-between; align-items: center;">
          <span>Queries cross-reference peer-reviewed NASA technical reports.</span>
          <span class="font-mono" style="font-size: 10px;">NOT A SUBSTITUTE FOR PHYSICAL TEST 1 FLIGHT CERTIFICATION</span>
        </div>
      </div>
    </section>
  `;

  const form = container.querySelector("#ask-form");
  const input = container.querySelector("#ask-query-input");
  const sendBtn = container.querySelector("#ask-send-btn");
  const stream = container.querySelector("#ask-stream");

  const submitQuery = async (queryText) => {
    if (!queryText.trim()) return;

    input.value = "";
    sendBtn.disabled = true;

    // Append User Message
    const userDiv = document.createElement("div");
    userDiv.className = "ask-user-msg ask-msg-bubble";
    userDiv.innerHTML = `
      <div style="font-size: 11px; font-weight: 600; color: var(--muted); margin-bottom: 2px;">RESEARCHER INQUIRY</div>
      <div style="color: var(--ink); font-weight: 500;">${escapeHtml(queryText)}</div>
    `;
    stream.appendChild(userDiv);

    // Append Loading Placeholder
    const loadingDiv = document.createElement("div");
    loadingDiv.className = "ask-assistant-card ask-msg-bubble";
    loadingDiv.innerHTML = `
      <div style="font-size: 11px; color: var(--accent); font-weight: 600; margin-bottom: 8px;">
        SYNTHESIZING NASA FLIGHT ARCHIVE...
      </div>
      <div class="skeleton-line w-full"></div>
      <div class="skeleton-line w-full"></div>
      <div class="skeleton-line w-half"></div>
    `;
    stream.appendChild(loadingDiv);
    stream.scrollTop = stream.scrollHeight;

    try {
      const res = await ask(queryText);

      const citationsHtml = res.citations && res.citations.length > 0
        ? `
          <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border-subtle);">
            <div style="font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; margin-bottom: 6px;">
              Primary Citations &amp; NTRS Reports
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
              ${res.citations.map((c, i) => `
                <a
                  href="${c.url}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="badge"
                  style="background-color: var(--panel-subtle); border-color: var(--border); color: var(--accent-dark); text-decoration: none; padding: 4px 8px;"
                >
                  <span class="citation-sup">[${i + 1}]</span> ${c.label} (p. ${c.page}) &rarr;
                </a>
              `).join("")}
            </div>
          </div>
        `
        : "";

      loadingDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
          <strong style="color: var(--accent-dark); font-size: 12.5px;">
            Scientific Synthesis
          </strong>
          <span class="font-mono" style="font-size: 10.5px; color: ${res.confidence > 0.5 ? "var(--accent)" : "var(--muted)"};">
            Match Confidence: ${(res.confidence * 100).toFixed(0)}% &bull; ${res.latencyMs}ms
          </span>
        </div>
        <p style="color: var(--ink); font-size: 13px; line-height: 1.6;">
          ${res.answer}
        </p>
        ${citationsHtml}
        <div style="margin-top: 10px; font-size: 10.5px; font-family: var(--font-mono); color: var(--muted);">
          DEMO SYNTHESIS: Verify against formal NASA Technical Publications prior to critical design decisions.
        </div>
      `;

    } catch (err) {
      loadingDiv.className = "error-banner";
      loadingDiv.innerHTML = `<span>Inquiry failed: ${err.message}</span>`;
    } finally {
      sendBtn.disabled = false;
      stream.scrollTop = stream.scrollHeight;
    }
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    submitQuery(input.value);
  });

  container.querySelectorAll(".ask-sug-button").forEach(btn => {
    btn.addEventListener("click", () => {
      const q = btn.getAttribute("data-question");
      if (q) submitQuery(q);
    });
  });
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
