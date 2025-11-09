const DEFAULT_SEVERITIES = ["FATAL", "ERROR", "WARN", "INFO", "DEBUG", "TRACE"];

const state = {
  logs: [],
  filteredLogs: [],
  severityFilters: new Set(DEFAULT_SEVERITIES),
  availableSeverities: [...DEFAULT_SEVERITIES],
  searchText: "",
  selectedLog: null,
  firstError: null,
  preErrorContext: [],
};

const toneStyles = {
  info: "bg-slate-800/80 text-blue-200 border border-blue-500/40",
  success: "bg-emerald-500/10 text-emerald-200 border border-emerald-400/60",
  warn: "bg-amber-500/10 text-amber-200 border border-amber-400/60",
  error: "bg-rose-500/10 text-rose-200 border border-rose-500/60",
};

const elements = {
  form: document.getElementById("uploadForm"),
  fileInput: document.getElementById("logFile"),
  submitBtn: document.getElementById("uploadBtn"),
  tableBody: document.getElementById("logTableBody"),
  searchInput: document.getElementById("searchInput"),
  severityContainer: document.getElementById("severityFilters"),
  summaryBadges: document.getElementById("summaryBadges"),
  statusMessage: document.getElementById("statusMessage"),
  detailPanel: document.getElementById("logDetails"),
  aiButton: document.getElementById("aiExplainBtn"),
  aiOutput: document.getElementById("aiExplanation"),
  aiStatus: document.getElementById("aiInsightStatus"),
  aiExpandBtn: document.getElementById("aiInsightExpandBtn"),
  aiModal: document.getElementById("aiInsightModal"),
  aiModalOutput: document.getElementById("aiExplanationModal"),
  aiModalClose: document.getElementById("aiInsightModalClose"),
  logBoard: document.getElementById("logBoard"),
  logExpandBtn: document.getElementById("logExpandBtn"),
  logOverlay: document.getElementById("logBoardOverlay"),
  firstErrorBtn: document.getElementById("firstErrorBtn"),
  preErrorBtn: document.getElementById("preErrorBtn"),
  firstErrorPanel: document.getElementById("firstErrorPanel"),
  preErrorList: document.getElementById("preErrorList"),
  emptyState: document.getElementById("emptyState"),
};

let bodyLockCount = 0;

function lockBodyScroll() {
  if (bodyLockCount === 0) {
    document.body.classList.add("overflow-hidden");
  }
  bodyLockCount += 1;
}

function unlockBodyScroll() {
  bodyLockCount = Math.max(0, bodyLockCount - 1);
  if (bodyLockCount === 0) {
    document.body.classList.remove("overflow-hidden");
  }
}

function escapeHtml(text = "") {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function applyInlineFormatting(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function blockToHtml(block) {
  const trimmed = block.trim();
  if (!trimmed) return "";

  if (/^---+$/.test(trimmed)) {
    return "<hr class='border-slate-700/40'/>";
  }

  if (/^#{1,6}\s+/.test(trimmed)) {
    const headingText = trimmed.replace(/^#{1,6}\s+/, "");
    return `<h4>${applyInlineFormatting(headingText)}</h4>`;
  }

  if (/^(\*|-)\s+/m.test(trimmed)) {
    const items = trimmed
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^(\*|-)\s+/.test(line))
      .map((line) => {
        const content = line.replace(/^(\*|-)\s+/, "");
        return `<li>${applyInlineFormatting(content)}</li>`;
      })
      .join("");
    return `<ul>${items}</ul>`;
  }

  return `<p>${applyInlineFormatting(trimmed).replace(/\n/g, "<br>")}</p>`;
}

function formatAiExplanation(rawText) {
  const safe = escapeHtml(rawText || "").replace(/\r\n/g, "\n").trim();
  if (!safe) {
    return `<p class="ai-output__placeholder">No explanation returned.</p>`;
  }
  const sections = safe.split(/\n{2,}/);
  return `<div class="space-y-3">${sections.map(blockToHtml).filter(Boolean).join("")}</div>`;
}

function setAiExplanationPlaceholder(message) {
  if (!elements.aiOutput) return;
  const text =
    message ||
    'Select a log entry and tap "Explain with AI" to see Gemini\'s guidance.';
  elements.aiOutput.innerHTML = `<p class="ai-output__placeholder">${escapeHtml(text)}</p>`;
  elements.aiOutput.scrollTop = 0;
  syncAiModalContent();
}

function setAiExplanationContent(rawText) {
  if (!elements.aiOutput) return;
  elements.aiOutput.innerHTML = formatAiExplanation(rawText);
  elements.aiOutput.scrollTop = 0;
  syncAiModalContent();
}

function setAiInsightStatus(state) {
  const indicator = elements.aiStatus;
  if (!indicator) return;
  const styles = {
    loading: { text: "fetching", className: "text-amber-300/80" },
    success: { text: "live", className: "text-emerald-300/80" },
    error: { text: "error", className: "text-rose-300/80" },
  };
  if (!state || !styles[state]) {
    indicator.classList.add("hidden");
    indicator.textContent = "";
    return;
  }
  indicator.textContent = styles[state].text;
  indicator.className = `text-xs uppercase tracking-widest ${styles[state].className}`;
}

function syncAiModalContent() {
  if (!elements.aiModalOutput || !elements.aiOutput) return;
  elements.aiModalOutput.innerHTML = elements.aiOutput.innerHTML;
  elements.aiModalOutput.scrollTop = 0;
}

function openAiModal() {
  if (!elements.aiModal) return;
  syncAiModalContent();
  elements.aiModal.classList.remove("hidden");
  elements.aiModal.classList.add("flex");
  lockBodyScroll();
}

function closeAiModal() {
  if (!elements.aiModal) return;
  elements.aiModal.classList.add("hidden");
  elements.aiModal.classList.remove("flex");
  unlockBodyScroll();
}

function handleAiModalBackground(event) {
  if (event.target === elements.aiModal) {
    closeAiModal();
  }
}

function isLogBoardExpanded() {
  return elements.logBoard?.classList.contains("log-board--expanded");
}

function setLogBoardExpanded(expanded) {
  if (!elements.logBoard) return;
  const alreadyExpanded = isLogBoardExpanded();
  if (expanded === alreadyExpanded) return;
  elements.logBoard.classList.toggle("log-board--expanded", expanded);
  elements.logBoard.setAttribute("aria-live", expanded ? "polite" : "off");
  if (elements.logOverlay) {
    elements.logOverlay.classList.toggle("hidden", !expanded);
  }
  if (expanded) {
    elements.logBoard.scrollTop = 0;
    lockBodyScroll();
  } else {
    unlockBodyScroll();
  }
  if (elements.logExpandBtn) {
    elements.logExpandBtn.textContent = expanded ? "Close" : "Expand";
    elements.logExpandBtn.setAttribute("aria-expanded", String(expanded));
  }
}

function setStatus(message, tone = "info") {
  if (!elements.statusMessage) return;
  elements.statusMessage.textContent = message || "";
  elements.statusMessage.className =
    "text-sm px-4 py-3 rounded-xl " + (toneStyles[tone] || toneStyles.info);
  elements.statusMessage.classList.toggle("hidden", !message);
}

function setButtonVisualState(button, isActive) {
  if (!button) return;
  button.classList.toggle("bg-slate-200", isActive);
  button.classList.toggle("text-slate-900", isActive);
  button.classList.toggle("bg-slate-800", !isActive);
  button.classList.toggle("text-slate-200", !isActive);
}

function buildSeverityOrder(uniqueSeverities) {
  const seen = new Set();
  const ordered = [];
  DEFAULT_SEVERITIES.forEach((level) => {
    if (uniqueSeverities.includes(level)) {
      ordered.push(level);
      seen.add(level);
    }
  });
  uniqueSeverities.forEach((level) => {
    if (!seen.has(level)) {
      ordered.push(level);
      seen.add(level);
    }
  });
  return ordered.length ? ordered : [...DEFAULT_SEVERITIES];
}

function syncSeverityFilters(resetSelection = false) {
  const uniqueSeverities = Array.from(new Set(state.logs.map((log) => log.severity)));
  state.availableSeverities = buildSeverityOrder(uniqueSeverities);
  if (resetSelection || !state.severityFilters.size) {
    state.severityFilters = new Set(state.availableSeverities);
  } else {
    const intersection = state.availableSeverities.filter((level) =>
      state.severityFilters.has(level),
    );
    state.severityFilters = new Set(
      intersection.length ? intersection : state.availableSeverities,
    );
  }
}

function renderSeverityFilters() {
  const container = elements.severityContainer;
  if (!container) return;
  container.innerHTML = "";
  state.availableSeverities.forEach((level) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.severityToggle = level;
    button.className = "px-3 py-1 rounded-full text-xs font-semibold";
    button.textContent = level;
    setButtonVisualState(button, state.severityFilters.has(level));
    button.addEventListener("click", () => toggleSeverity(level, button));
    container.appendChild(button);
  });
}

function updateSummary(summary) {
  if (!elements.summaryBadges) return;
  elements.summaryBadges.innerHTML = "";
  const entries = Object.entries(summary || {});
  entries.forEach(([key, value]) => {
    const badge = document.createElement("span");
    badge.className =
      "px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-200";
    badge.textContent = `${key}: ${value}`;
    elements.summaryBadges.appendChild(badge);
  });
}

function highlightSelection(logId) {
  document
    .querySelectorAll("[data-log-id]")
    .forEach((row) => row.classList.remove("selected-row"));
  const targetRow = document.querySelector(`[data-log-id="${logId}"]`);
  if (targetRow) {
    targetRow.classList.add("selected-row");
    targetRow.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function renderDetails() {
  const panel = elements.detailPanel;
  const { selectedLog } = state;
  if (!panel) return;
  if (!selectedLog) {
    panel.innerHTML =
      "<p class='text-sm text-slate-400'>Select a log line to inspect its details.</p>";
    elements.aiButton.disabled = true;
    setAiInsightStatus(null);
    setAiExplanationPlaceholder();
    return;
  }

  panel.innerHTML = `
    <p class="text-xs uppercase tracking-wide text-slate-400 mb-1">Timestamp</p>
    <p class="font-mono text-sm mb-3">${selectedLog.timestamp}</p>
    <div class="grid grid-cols-2 gap-4 mb-4 text-sm">
      <div>
        <p class="text-xs uppercase text-slate-500">Severity</p>
        <p class="font-semibold">${selectedLog.severity}</p>
      </div>
      <div>
        <p class="text-xs uppercase text-slate-500">Thread</p>
        <p>${selectedLog.thread}</p>
      </div>
      <div>
        <p class="text-xs uppercase text-slate-500">Component</p>
        <p>${selectedLog.component}</p>
      </div>
      <div>
        <p class="text-xs uppercase text-slate-500">Logger</p>
        <p>${selectedLog.logger}</p>
      </div>
    </div>
    <p class="text-xs uppercase text-slate-400 mb-1">Message</p>
    <p class="text-sm leading-relaxed">${selectedLog.message}</p>
  `;
  elements.aiButton.disabled = false;
}

function renderFirstErrorPanel() {
  if (!elements.firstErrorPanel) return;
  if (!state.firstError) {
    elements.firstErrorPanel.innerHTML =
      "<p class='text-sm text-slate-400'>Upload logs to surface the earliest ERROR/FATAL entry.</p>";
    return;
  }
  const entry = state.firstError;
  elements.firstErrorPanel.innerHTML = `
    <p class="text-sm mb-2">
      <span class="font-semibold">${entry.severity}</span> detected at
      <span class="font-mono">${entry.timestamp}</span>
    </p>
    <p class="text-xs uppercase text-slate-400 mb-1">Message</p>
    <p class="text-sm text-slate-200">${entry.message}</p>
  `;
}

function renderPreErrorContext() {
  if (!elements.preErrorList) return;
  elements.preErrorList.innerHTML = "";
  if (!state.preErrorContext || state.preErrorContext.length === 0) {
    elements.preErrorList.innerHTML =
      "<li class='text-sm text-slate-400'>No context entries available.</li>";
    return;
  }
  state.preErrorContext.forEach((entry) => {
    const item = document.createElement("li");
    item.className =
      "border border-slate-800 rounded-lg p-3 bg-slate-900/60 text-sm";
    item.innerHTML = `
      <p class="font-mono text-xs text-slate-400">${entry.timestamp}</p>
      <p class="text-slate-300"><span class="font-semibold">${entry.severity}</span> · ${entry.message}</p>
    `;
    elements.preErrorList.appendChild(item);
  });
}

function renderLogs() {
  if (!elements.tableBody) return;
  elements.tableBody.innerHTML = "";
  if (state.filteredLogs.length === 0) {
    elements.emptyState.classList.remove("hidden");
    return;
  }
  elements.emptyState.classList.add("hidden");
  const fragment = document.createDocumentFragment();
  state.filteredLogs.forEach((log) => {
    const row = document.createElement("tr");
    row.dataset.logId = log.id;
    row.className =
      "border-b border-slate-800 hover:bg-slate-800/50 cursor-pointer";
    row.innerHTML = `
      <td class="py-2 px-3 font-mono text-xs text-slate-400">${log.timestamp}</td>
      <td class="py-2 px-3">
        <span class="severity-pill severity-${log.severity}">${log.severity}</span>
      </td>
      <td class="py-2 px-3">${log.thread}</td>
      <td class="py-2 px-3">${log.component}</td>
      <td class="py-2 px-3 text-slate-200">${log.message}</td>
    `;
    row.addEventListener("click", () => {
      state.selectedLog = log;
      renderDetails();
      highlightSelection(log.id);
    });
    fragment.appendChild(row);
  });
  elements.tableBody.appendChild(fragment);
}

function applyFilters() {
  const searchTerm = state.searchText.toLowerCase();
  state.filteredLogs = state.logs.filter((log) => {
    if (!state.severityFilters.has(log.severity)) {
      return false;
    }
    if (!searchTerm) {
      return true;
    }
    const haystack = `${log.timestamp} ${log.severity} ${log.thread} ${log.component} ${log.message}`.toLowerCase();
    return haystack.includes(searchTerm);
  });
  renderLogs();
}

function toggleSeverity(severity, buttonEl) {
  if (!severity) return;
  const targetButton =
    buttonEl ||
    elements.severityContainer?.querySelector(`[data-severity-toggle="${severity}"]`);
  if (!targetButton) return;
  if (state.severityFilters.has(severity)) {
    state.severityFilters.delete(severity);
    setButtonVisualState(targetButton, false);
  } else {
    state.severityFilters.add(severity);
    setButtonVisualState(targetButton, true);
  }
  if (state.severityFilters.size === 0) {
    state.severityFilters = new Set(state.availableSeverities);
    renderSeverityFilters();
  }
  applyFilters();
}

async function handleUpload(event) {
  event.preventDefault();
  if (!elements.fileInput.files.length) {
    setStatus("Select a messages.log file to continue.", "warn");
    return;
  }
  const formData = new FormData();
  formData.append("logFile", elements.fileInput.files[0]);
  elements.submitBtn.disabled = true;
  setStatus("Parsing logs...", "info");
  try {
    const response = await fetch("/analyze", {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Unable to parse logs.");
    }
    state.logs = data.logs || [];
    state.firstError = data.firstError || null;
    state.preErrorContext = data.preErrorContext || [];
    state.selectedLog = null;
    state.searchText = "";
    elements.searchInput.value = "";
    syncSeverityFilters(true);
    renderSeverityFilters();
    updateSummary(data.summary || {});
    renderFirstErrorPanel();
    renderPreErrorContext();
    renderDetails();
    applyFilters();
    setStatus(`Loaded ${state.logs.length} log entries.`, "success");
  } catch (err) {
    console.error(err);
    setStatus(err.message, "error");
  } finally {
    elements.submitBtn.disabled = false;
  }
}

async function handleAiExplain() {
  if (!state.selectedLog) return;
  elements.aiButton.disabled = true;
  elements.aiButton.textContent = "Explaining…";
  setAiInsightStatus("loading");
  setAiExplanationPlaceholder("Contacting Gemini for insights…");
  try {
    const response = await fetch("/ai_explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logText: state.selectedLog.raw_line || state.selectedLog.message }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "AI explanation failed.");
    }
    setAiExplanationContent(data.explanation || "");
    setAiInsightStatus("success");
  } catch (err) {
    setAiExplanationPlaceholder(err.message);
    setAiInsightStatus("error");
  } finally {
    elements.aiButton.disabled = false;
    elements.aiButton.textContent = "Explain with AI";
  }
}

function initEventListeners() {
  elements.form?.addEventListener("submit", handleUpload);
  elements.searchInput?.addEventListener("input", (event) => {
    state.searchText = event.target.value;
    applyFilters();
  });
  elements.aiButton?.addEventListener("click", handleAiExplain);
  elements.firstErrorBtn?.addEventListener("click", () => {
    if (!state.firstError) {
      setStatus("No ERROR or FATAL entries were detected.", "warn");
      return;
    }
    const found = state.logs.find((log) => log.id === state.firstError.id);
    if (found) {
      state.selectedLog = found;
      renderDetails();
      highlightSelection(found.id);
    }
  });
  elements.preErrorBtn?.addEventListener("click", () => {
    renderPreErrorContext();
    if (!state.preErrorContext.length) {
      setStatus("No log entries exist prior to the first error.", "info");
    } else {
      setStatus(
        `Showing ${state.preErrorContext.length} events before the first error.`,
        "info",
      );
    }
  });
  elements.logExpandBtn?.addEventListener("click", () => {
    setLogBoardExpanded(!isLogBoardExpanded());
  });
  elements.logOverlay?.addEventListener("click", () => setLogBoardExpanded(false));
  elements.aiExpandBtn?.addEventListener("click", openAiModal);
  elements.aiModalClose?.addEventListener("click", closeAiModal);
  elements.aiModal?.addEventListener("click", handleAiModalBackground);
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (isLogBoardExpanded()) {
      setLogBoardExpanded(false);
      event.preventDefault();
      return;
    }
    if (elements.aiModal && !elements.aiModal.classList.contains("hidden")) {
      closeAiModal();
      event.preventDefault();
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initEventListeners();
  renderDetails();
  renderFirstErrorPanel();
  renderPreErrorContext();
  syncSeverityFilters(true);
  renderSeverityFilters();
});
