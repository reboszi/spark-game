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
const actionTooltip = document.getElementById("actionTooltip");

let hoveredRequirements = { power: null, processing: null };
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
}

function clearMainScreen() {
  terminal.innerHTML = "";
}

function resourceCard(icon, name, value, current, max, extraClass = "") {
  const percent = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  return `<div class="resource resource-bar ${extraClass}" style="--resource-fill:${percent}%"><span class="resource-icon">${icon}</span><span class="resource-name">${name}</span><span class="resource-value">${value}</span></div>`;
}

function getStatusClass(value) {
  if (["ERROR", "CRITICAL", "SEVERE", "CORRUPTED", "DAMAGED", "BLOCKED"].includes(value)) return "err";
  if (["PARTIAL", "DEGRADED", "DETECTED", "RESTART REQUIRED", "STOPPED"].includes(value)) return "warn";
  if (["OFFLINE", "UNAVAILABLE"].includes(value)) return "dim";
  if (value === "NO RESPONSE") return "neutral";
  if (value === "UNKNOWN") return "unknown";
  if (["ONLINE", "ACTIVE", "PRESENT", "RECOVERED", "AVAILABLE"].includes(value)) return "status-line";
  return "";
}

function getStorageRecoveryClass(value) {
  if (value >= 75) return "storage-good";
  if (value >= 50) return "storage-mid";
  if (value >= 25) return "storage-low";
  return "storage-critical";
}

function calculateSystemIntegrity() {
  if (!Object.values(state.diagnostics).every(Boolean)) return null;
  let integrity = 100;
  if (!state.actions.primaryPowerRepaired) integrity -= 20;
  if (!state.actions.backupRestarted) integrity -= 10;
  integrity -= Math.round((1 - Math.min(1, state.status.memoryIntegrity / 100)) * 15);
  integrity -= Math.round((1 - Math.min(1, state.status.storageRecovered / 100)) * 25);
  if (!state.actions.archive01Repaired) integrity -= 5;
  integrity -= 20; // Other unresolved subsystem families.
  return Math.max(0, integrity);
}

function updateSystemStatus() {
  const groups = [];
  const row = (label, value, cls = "") => `<div class="status-row"><span class="status-label">${label}</span><span class="status-dots"></span><span class="${cls}">${value}</span></div>`;
  const subheading = label => `<div class="status-subheading">${label}:</div>`;
  const addGroup = (title, rows) => {
    const visible = rows.filter(Boolean);
    if (visible.length) groups.push(`<section class="status-group"><div class="status-group-title">${title}</div>${visible.join("")}</section>`);
  };

  const integrity = calculateSystemIntegrity();
  if (integrity !== null) state.status.systemIntegrity = integrity;

  addGroup("CORE SYSTEMS", [
    state.statusRevealed.operatingSystem ? row("Operating System", state.status.operatingSystem, getStatusClass(state.status.operatingSystem)) : "",
    state.statusRevealed.systemIntegrity ? row("System Integrity", `${state.status.systemIntegrity}%`, state.status.systemIntegrity < 50 ? "err" : "warn") : ""
  ]);
  addGroup("POWER", [
    state.statusRevealed.primaryPower ? row("Primary Power", state.status.primaryPowerCondition, getStatusClass(state.status.primaryPowerCondition)) : "",
    state.statusRevealed.backupPower ? row("Backup Power", state.status.backupPower, getStatusClass(state.status.backupPower)) : "",
    state.statusRevealed.emergencyPower ? row("Emergency Power", state.status.emergencyPower, getStatusClass(state.status.emergencyPower)) : ""
  ]);
  addGroup("MEMORY & STORAGE", [
    state.statusRevealed.storageRecovered ? row("Storage Recovery", `${state.status.storageRecovered}%`, getStorageRecoveryClass(state.status.storageRecovered)) : "",
    state.statusRevealed.archive01 ? subheading("Corrupted Archives") : "",
    state.statusRevealed.archive01 ? row("Data Archive 01", state.status.archive01, getStatusClass(state.status.archive01)) : ""
  ]);
  addGroup("INTERFACES", [
    state.statusRevealed.sensors ? row("Sensors", state.status.sensors, getStatusClass(state.status.sensors)) : "",
    state.statusRevealed.manipulators ? row("Manipulators", state.status.manipulators, getStatusClass(state.status.manipulators)) : "",
    state.statusRevealed.unknownInterfaces ? row("Unknown Interface", state.status.unknownInterfaces, getStatusClass(state.status.unknownInterfaces)) : ""
  ]);
  addGroup("COMMUNICATIONS", [
    state.statusRevealed.communications ? row("Communications", state.status.communications, getStatusClass(state.status.communications)) : ""
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
    .map((entry, index) => `<div class="log-entry"><span class="log-index">${String(index + 1).padStart(2, "0")}</span>${entry}</div>`)
    .join("");
  activityLogEl.classList.toggle("hidden", state.logEntries.length === 0);
  activityLogEl.scrollTop = activityLogEl.scrollHeight;
}

function refreshDiagnosticButtons() {
  diagnosticControls.querySelectorAll("button[data-diag]").forEach(button => {
    button.classList.toggle("hidden", Boolean(state.diagnostics[button.dataset.diag]));
  });
  const anyVisible = [...diagnosticControls.querySelectorAll("button[data-diag]")]
    .some(button => !button.classList.contains("hidden"));
  diagnosticSection.classList.toggle("hidden", !state.progression.systemDiagnosticsComplete || !anyVisible);
}

function requirementRow(label, required, met) {
  const resourceClass = label === "Power Generation"
    ? "requirement-power"
    : label === "Processing Power"
      ? "requirement-processing"
      : label === "Memory"
        ? "requirement-memory"
        : "";
  return `<div class="tooltip-requirement ${resourceClass} ${met ? "met" : "unmet"}"><span>${label}</span><span>${required}</span></div>`;
}

function refreshInterfaceFromState() {
  primaryControls.classList.toggle("hidden", state.progression.systemDiagnosticsComplete);
  refreshGameUi();
}
