const bootScreen = document.getElementById("bootScreen");
const standbyScreen = document.getElementById("standbyScreen");
const systemScreen = document.getElementById("systemScreen");
const bootButton = document.getElementById("bootButton");
const continueButton = document.getElementById("continueButton");
const newGameButton = document.getElementById("newGameButton");
const terminal = document.getElementById("terminalOutput");
const primaryControls = document.getElementById("primaryControls");
const diagnosticSection = document.getElementById("diagnosticSection");
const diagnosticControls = document.getElementById("diagnosticControls");
const maintenanceSection = document.getElementById("maintenanceSection");
const repairControls = document.getElementById("repairControls");
const plannedSection = document.getElementById("plannedSection");
const plannedControls = document.getElementById("plannedControls");
const resourcesEl = document.getElementById("resources");
const systemStatusEl = document.getElementById("systemStatus");
const statusContentEl = document.getElementById("statusContent");
const activityLogEl = document.getElementById("activityLog");
const logContentEl = document.getElementById("logContent");
const systemDiagnosticsButton = document.getElementById("systemDiagnosticsButton");

let hoveredRequirements = {
  power: null,
  processing: null
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function typeLine(text, cls = "", speed = 14) {
  const line = document.createElement("div");
  if (cls) line.className = cls;
  terminal.appendChild(line);

  for (let i = 0; i < text.length; i++) {
    line.textContent += text[i];
    await sleep(speed);
  }

  terminal.scrollTop = terminal.scrollHeight;
  return line;
}

async function progressLine(label, values, finalText = "ONLINE") {
  const line = document.createElement("div");
  terminal.appendChild(line);

  for (const value of values) {
    line.textContent = `${label.padEnd(28, ".")} ${String(value).padStart(3, " ")}%`;
    await sleep(120 + Math.random() * 180);
  }

  await sleep(250);
  line.textContent = `${label.padEnd(28, ".")} ${finalText}`;
  terminal.scrollTop = terminal.scrollHeight;
}

function clearMainScreen() {
  terminal.innerHTML = "";
}

function resourceCard(icon, name, value, extraClass = "", requirement = null, sufficient = true) {
  const requirementHtml = requirement !== null
    ? `<span class="power-requirement ${sufficient ? "" : "err"}">REQ ${requirement}</span>`
    : "";

  return `
    <div class="resource ${extraClass}">
      <span class="resource-icon">${icon}</span>
      <span class="resource-name">${name}</span>
      <span class="resource-value">${value}</span>
      ${requirementHtml}
    </div>`;
}

function updateResources() {
  let html = "";

  if (state.revealed.powerGeneration) {
    const requirement = hoveredRequirements.power;
    const active = requirement !== null;
    const sufficient = !active || state.powerGeneration >= requirement;
    html += resourceCard(
      "⚡",
      "POWER GENERATION",
      `${state.powerGeneration} / ${state.powerGenerationMax}`,
      `power-resource ${active ? "requirement-active" : ""} ${sufficient ? "" : "requirement-insufficient"}`,
      requirement,
      sufficient
    );
  }

  if (state.revealed.powerStorage) {
    html += resourceCard("🔋", "POWER STORAGE", `${state.powerStorage} / ${state.powerStorageMax}`);
  }

  if (state.revealed.memory) {
    html += resourceCard("◫", "MEMORY", `${state.memory} / ${state.memoryMax}`);
  }

  if (state.revealed.processingPower) {
    const requirement = hoveredRequirements.processing;
    const active = requirement !== null;
    const sufficient = !active || state.processingPower >= requirement;
    html += resourceCard(
      "◈",
      "PROCESSING POWER",
      `${state.processingPower} / ${state.processingPowerMax}`,
      `${active ? "requirement-active" : ""} ${sufficient ? "" : "requirement-insufficient"}`,
      requirement,
      sufficient
    );
  }

  resourcesEl.innerHTML = html;
  resourcesEl.classList.toggle("hidden", !html);
  updateButtons();
}

function getStatusClass(value) {
  if (["ERROR", "CRITICAL", "SEVERE", "CORRUPTED"].includes(value)) return "err";
  if (["PARTIAL", "DEGRADED", "DETECTED", "RESTART REQUIRED"].includes(value)) return "warn";
  if (["OFFLINE", "UNAVAILABLE"].includes(value)) return "dim";
  if (value === "NO RESPONSE") return "neutral";
  if (value === "UNKNOWN") return "unknown";
  if (["ONLINE", "ACTIVE", "PRESENT", "RECOVERED"].includes(value)) return "status-line";
  return "";
}

function calculateSystemIntegrity() {
  if (!Object.values(state.diagnostics).every(Boolean)) return null;

  let integrity = 100;

  if (!state.actions.primaryPowerRepaired) integrity -= 20;
  if (!state.actions.backupRestarted) integrity -= 10;

  const memoryFraction = Math.min(1, state.memory / state.memoryMax);
  integrity -= Math.round((1 - memoryFraction) * 15);

  const storageFraction = Math.min(1, state.status.storageRecovered / 100);
  integrity -= Math.round((1 - storageFraction) * 25);

  if (!state.actions.archive01Repaired) integrity -= 5;

  integrity -= 5; // Sensors unresolved
  integrity -= 5; // Manipulators unresolved
  integrity -= 5; // Communications unresolved
  integrity -= 5; // Unknown interface unresolved

  return Math.max(0, integrity);
}

function updateSystemStatus() {
  const groups = [];

  function row(label, value, cls = "") {
    return `
      <div class="status-row">
        <span class="status-label">${label}</span>
        <span class="status-dots"></span>
        <span class="${cls}">${value}</span>
      </div>`;
  }

  function addGroup(title, rows) {
    const visibleRows = rows.filter(Boolean);
    if (!visibleRows.length) return;
    groups.push(`
      <section class="status-group">
        <div class="status-group-title">${title}</div>
        ${visibleRows.join("")}
      </section>`);
  }

  const integrity = calculateSystemIntegrity();
  if (integrity !== null) state.status.systemIntegrity = integrity;

  addGroup("CORE SYSTEMS", [
    state.statusRevealed.operatingSystem
      ? row("Operating System", state.status.operatingSystem, getStatusClass(state.status.operatingSystem))
      : "",
    state.statusRevealed.systemIntegrity
      ? row("System Integrity", `${state.status.systemIntegrity}%`, state.status.systemIntegrity < 50 ? "err" : "warn")
      : ""
  ]);

  addGroup("POWER", [
    state.statusRevealed.primaryPower
      ? row("Primary Power", state.status.primaryPower, getStatusClass(state.status.primaryPower))
      : "",
    state.statusRevealed.backupPower
      ? row("Backup Power", state.status.backupPower, getStatusClass(state.status.backupPower))
      : "",
    state.statusRevealed.emergencyPower
      ? row("Emergency Power", state.status.emergencyPower, getStatusClass(state.status.emergencyPower))
      : ""
  ]);

  addGroup("MEMORY & STORAGE", [
    state.statusRevealed.memoryIntegrity
      ? row("Memory Integrity", state.status.memoryIntegrity, getStatusClass(state.status.memoryIntegrity))
      : "",
    state.statusRevealed.storageAccess
      ? row("Storage Access", state.status.storageAccess, getStatusClass(state.status.storageAccess))
      : "",
    state.statusRevealed.storageRecovered
      ? row("Storage Recovery", `${state.status.storageRecovered}%`, "warn")
      : "",
    state.statusRevealed.corruptedArchivesFound
      ? row("Corrupted Archives", state.status.corruptedArchivesFound, state.status.corruptedArchivesFound ? "err" : "status-line")
      : "",
    state.statusRevealed.archive01
      ? row("Data Archive 01", state.status.archive01, getStatusClass(state.status.archive01))
      : ""
  ]);

  addGroup("INTERFACES", [
    state.statusRevealed.sensors
      ? row("Sensors", state.status.sensors, getStatusClass(state.status.sensors))
      : "",
    state.statusRevealed.manipulators
      ? row("Manipulators", state.status.manipulators, getStatusClass(state.status.manipulators))
      : "",
    state.statusRevealed.unknownInterfaces
      ? row("Unknown Interface", state.status.unknownInterfaces, getStatusClass(state.status.unknownInterfaces))
      : ""
  ]);

  addGroup("COMMUNICATIONS", [
    state.statusRevealed.communications
      ? row("Communications", state.status.communications, getStatusClass(state.status.communications))
      : ""
  ]);

  statusContentEl.innerHTML = groups.join("");
  systemStatusEl.classList.toggle("hidden", groups.length === 0);
}

function addLogEntry(text) {
  state.logEntries.push(text);
  if (state.logEntries.length > 80) state.logEntries.shift();
  renderActivityLog();
}

function renderActivityLog() {
  logContentEl.innerHTML = state.logEntries
    .map((entry, index) => `
      <div class="log-entry">
        <span class="log-index">${String(index + 1).padStart(2, "0")}</span>${entry}
      </div>`)
    .join("");

  activityLogEl.classList.toggle("hidden", state.logEntries.length === 0);
  activityLogEl.scrollTop = activityLogEl.scrollHeight;
}

function getAvailablePower() {
  return state.powerGeneration;
}

function buttonRequirementsMet(button) {
  const powerRequirement = Number(button.dataset.powerRequirement || 0);
  const processingRequirement = Number(button.dataset.processingRequirement || 0);

  return state.powerGeneration >= powerRequirement &&
    state.processingPower >= processingRequirement;
}

function updateButtons() {
  document.querySelectorAll("[data-power-requirement]").forEach(button => {
    const locked = !buttonRequirementsMet(button);
    button.classList.toggle("power-insufficient", state.powerGeneration < Number(button.dataset.powerRequirement || 0));
    button.classList.toggle("requirement-locked", locked);
    button.setAttribute("aria-disabled", String(state.isBusy || state.isShuttingDown || locked));
    button.disabled = state.isBusy || state.isShuttingDown;
  });
}

function setAllActionButtonsDisabled(disabled) {
  state.isBusy = disabled;
  document.querySelectorAll(".controls button").forEach(button => {
    button.disabled = disabled;
  });
  if (!disabled) updateButtons();
}

function refreshDiagnosticButtons() {
  diagnosticControls.querySelectorAll("button[data-diag]").forEach(button => {
    button.classList.toggle("hidden", Boolean(state.diagnostics[button.dataset.diag]));
  });

  const anyVisible = [...diagnosticControls.querySelectorAll("button[data-diag]")]
    .some(button => !button.classList.contains("hidden"));

  diagnosticSection.classList.toggle("hidden", !state.progression.systemDiagnosticsComplete || !anyVisible);
}

function refreshActionUnlocks() {
  const memoryRepair = repairControls.querySelector('[data-repair="memory"]');
  const storageRepair = repairControls.querySelector('[data-repair="storage"]');
  const archiveRepair = repairControls.querySelector('[data-repair="archive01"]');

  memoryRepair.classList.toggle("hidden", !state.diagnostics.memory || state.memory >= state.memoryMax);
  storageRepair.classList.toggle("hidden", !state.diagnostics.memory || state.status.storageRecovered >= 100);
  archiveRepair.classList.toggle("hidden", !state.diagnostics.memory || state.actions.archive01Repaired);

  const anyMaintenance = [...repairControls.querySelectorAll("button")]
    .some(button => !button.classList.contains("hidden"));
  maintenanceSection.classList.toggle("hidden", !anyMaintenance);

  const plannedVisibility = {
    backup: state.diagnostics.power && !state.actions.backupRestarted,
    primary: state.diagnostics.power && !state.actions.primaryPowerRepaired,
    sensors: state.diagnostics.io,
    manipulators: state.diagnostics.io,
    communications: state.diagnostics.io,
    unknown: state.diagnostics.io
  };

  plannedControls.querySelectorAll("button[data-planned]").forEach(button => {
    button.classList.toggle("hidden", !plannedVisibility[button.dataset.planned]);
  });

  const anyPlanned = [...plannedControls.querySelectorAll("button")]
    .some(button => !button.classList.contains("hidden"));
  plannedSection.classList.toggle("hidden", !anyPlanned);

  if (Object.values(state.diagnostics).every(Boolean)) {
    state.statusRevealed.systemIntegrity = true;
  }
}

function refreshInterfaceFromState() {
  updateResources();
  updateSystemStatus();
  renderActivityLog();
  refreshDiagnosticButtons();
  refreshActionUnlocks();
  updateSystemStatus();

  primaryControls.classList.toggle("hidden", state.progression.systemDiagnosticsComplete);
  systemDiagnosticsButton.disabled = state.progression.systemDiagnosticsComplete;
}

function showRequirements(button) {
  hoveredRequirements.power = Number(button.dataset.powerRequirement || 0);
  hoveredRequirements.processing = button.dataset.processingRequirement !== undefined
    ? Number(button.dataset.processingRequirement)
    : null;
  updateResources();
}

function hideRequirements() {
  hoveredRequirements.power = null;
  hoveredRequirements.processing = null;
  updateResources();
}

document.querySelectorAll("[data-power-requirement]").forEach(button => {
  button.addEventListener("mouseenter", () => showRequirements(button));
  button.addEventListener("mouseleave", hideRequirements);
  button.addEventListener("focus", () => showRequirements(button));
  button.addEventListener("blur", hideRequirements);
});
