const bootScreen = document.getElementById("bootScreen");
const systemScreen = document.getElementById("systemScreen");
const bootButton = document.getElementById("bootButton");
const terminal = document.getElementById("terminalOutput");
const primaryControls = document.getElementById("primaryControls");
const diagnosticSection = document.getElementById("diagnosticSection");
const diagnosticControls = document.getElementById("diagnosticControls");
const maintenanceSection = document.getElementById("maintenanceSection");
const repairControls = document.getElementById("repairControls");
const resourcesEl = document.getElementById("resources");
const systemStatusEl = document.getElementById("systemStatus");
const statusContentEl = document.getElementById("statusContent");
const systemDiagnosticsButton = document.getElementById("systemDiagnosticsButton");

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

function resourceCard(icon, name, value) {
  return `
    <div class="resource">
      <span class="resource-icon">${icon}</span>
      <span class="resource-name">${name}</span>
      <span class="resource-value">${value}</span>
    </div>`;
}

function updateResources() {
  let html = "";

  if (state.revealed.powerGeneration) {
    html += resourceCard(
      "⚡",
      "POWER GENERATION",
      `${state.powerGeneration} / ${state.powerGenerationMax}`
    );
  }

  if (state.revealed.powerStorage) {
    html += resourceCard(
      "🔋",
      "POWER STORAGE",
      `${state.powerStorage} / ${state.powerStorageMax}`
    );
  }

  if (state.revealed.memory) {
    html += resourceCard("◫", "MEMORY", `${state.memory} / ${state.memoryMax}`);
  }

  if (state.revealed.processingPower) {
    html += resourceCard(
      "◈",
      "PROCESSING POWER",
      `${state.processingPower} / ${state.processingPowerMax}`
    );
  }

  resourcesEl.innerHTML = html;
  resourcesEl.classList.toggle("hidden", !html);
  updateButtons();
}

function getStatusClass(value) {
  if (["ERROR", "CRITICAL", "SEVERE"].includes(value)) return "err";
  if (["PARTIAL", "UNKNOWN", "DEGRADED", "DETECTED"].includes(value)) return "warn";
  if (["OFFLINE", "NO RESPONSE", "UNAVAILABLE"].includes(value)) return "dim";
  if (["ONLINE", "ACTIVE", "PRESENT"].includes(value)) return "status-line";
  return "";
}

function updateSystemStatus() {
  let html = "";

  function addStatusRow(label, value, cls = "") {
    html += `
      <div class="status-row">
        <span class="status-label">${label}</span>
        <span class="status-dots"></span>
        <span class="${cls}">${value}</span>
      </div>`;
  }

  const statusRows = [
    ["operatingSystem", "Operating System"],
    ["network", "Network"],
    ["externalInterfaces", "External Interfaces"],
    ["primaryPower", "Primary Power"],
    ["backupPower", "Backup Power"],
    ["emergencyPower", "Emergency Power"],
    ["memoryIntegrity", "Memory Integrity"],
    ["storageAccess", "Storage Access"],
    ["sensorNetwork", "Sensor Network"],
    ["maintenanceSystems", "Maintenance Systems"]
  ];

  for (const [key, label] of statusRows) {
    if (state.statusRevealed[key]) {
      addStatusRow(label, state.status[key], getStatusClass(state.status[key]));
    }
  }

  if (state.statusRevealed.integrity) {
    addStatusRow("Integrity", `${state.status.integrity}%`, "warn");
  }

  if (state.statusRevealed.corruption) {
    addStatusRow("Corruption", `${state.status.corruption}%`, "err");
  }

  if (state.statusRevealed.storageRecovered) {
    addStatusRow("Storage Recovery", `${state.status.storageRecovered}%`, "warn");
  }

  statusContentEl.innerHTML = html;
  systemStatusEl.classList.toggle("hidden", !html);
}

function getAvailablePower() {
  return state.powerGeneration;
}

function updateButtons() {
  document.querySelectorAll("[data-power-requirement]").forEach(button => {
    const requirement = Number(button.dataset.powerRequirement);
    const insufficientPower = state.revealed.powerGeneration && getAvailablePower() < requirement;
    button.disabled = state.isBusy || state.isShuttingDown || insufficientPower;
  });
}

function setAllActionButtonsDisabled(disabled) {
  state.isBusy = disabled;
  document.querySelectorAll(".controls button").forEach(button => {
    button.disabled = disabled;
  });

  if (!disabled) updateButtons();
}

function refreshActionUnlocks() {
  const memoryRepair = repairControls.querySelector('[data-repair="memory"]');
  const storageRepair = repairControls.querySelector('[data-repair="storage"]');
  const corruptionRepair = repairControls.querySelector('[data-repair="corruption"]');

  memoryRepair.classList.toggle("hidden", !state.diagnostics.memory || state.memory >= state.memoryMax);
  corruptionRepair.classList.toggle("hidden", !state.diagnostics.memory || state.status.corruption <= 0);
  storageRepair.classList.toggle("hidden", !state.diagnostics.io || state.status.storageRecovered >= 100);

  const anyVisible = [...repairControls.querySelectorAll("button")]
    .some(button => !button.classList.contains("hidden"));

  maintenanceSection.classList.toggle("hidden", !anyVisible);
}
