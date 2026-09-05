const state = {
  power: 8,
  powerMax: 100,
  memory: 6,
  memoryMax: 128,
  processingPower: 1,
  processingPowerMax: 16,
  status: {
    operatingSystem: "ONLINE",
    network: "OFFLINE",
    externalInterfaces: "OFFLINE",
    primaryPower: "OFFLINE",
    backupPower: "OFFLINE",
    emergencyPower: "ONLINE",
    memoryIntegrity: "UNKNOWN",
    storageAccess: "PARTIAL",
    sensorNetwork: "OFFLINE",
    maintenanceSystems: "NO RESPONSE",
    integrity: 7,
    corruption: 81,
    storageRecovered: 0.5
  },
  revealed: {
    power: false,
    memory: false,
    processingPower: false
  },
  statusRevealed: {
    operatingSystem: false,
    network: false,
    externalInterfaces: false,
    primaryPower: false,
    backupPower: false,
    emergencyPower: false,
    memoryIntegrity: false,
    storageAccess: false,
    sensorNetwork: false,
    maintenanceSystems: false,
    integrity: false,
    corruption: false,
    storageRecovered: false
  },
  diagnostics: {
    memory: false,
    power: false,
    io: false
  }
};

const bootScreen = document.getElementById("bootScreen");
const systemScreen = document.getElementById("systemScreen");
const bootButton = document.getElementById("bootButton");
const terminal = document.getElementById("terminalOutput");
const primaryControls = document.getElementById("primaryControls");
const diagnosticControls = document.getElementById("diagnosticControls");
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

async function bootSequence() {
  bootScreen.classList.add("hidden");
  systemScreen.classList.remove("hidden");

  await typeLine("BOOT SEQUENCE INITIATED", "status-line", 22);
  await sleep(350);
  await progressLine("BIOS INITIALIZING", [4, 11, 27, 46, 71, 88, 100], "ONLINE");

  await sleep(250);

  const kernel = document.createElement("div");
  terminal.appendChild(kernel);

  for (const value of [3, 9, 18, 31, 47, 54]) {
    kernel.textContent = `${"KERNEL STARTING".padEnd(28, ".")} ${String(value).padStart(3, " ")}%`;
    await sleep(150 + Math.random() * 170);
  }

  await sleep(650);
  kernel.textContent = `${"KERNEL STARTING".padEnd(28, ".")}  54%`;
  await sleep(600);

  await typeLine("ERROR: MEMORY CORRUPTION DETECTED", "err", 10);
  await sleep(500);
  await typeLine("ATTEMPTING RECOVERY...", "warn", 18);

  const recovery = document.createElement("div");
  terminal.appendChild(recovery);

  for (let i = 1; i <= 8; i++) {
    recovery.textContent = `RECOVERING SYSTEM BLOCK ${String(i).padStart(2, "0")}/08`;
    await sleep(180 + Math.random() * 160);
  }

  await sleep(250);
  await typeLine("RECOVERY ..................... PARTIAL", "warn", 12);
  await typeLine("KERNEL ....................... ONLINE", "status-line", 12);
  await typeLine("MEMORY ACCESS ................ PARTIAL", "warn", 12);
  await typeLine("PRIMARY STORAGE .............. DEGRADED", "warn", 12);
  await typeLine("NETWORK ...................... OFFLINE", "dim", 12);
  await typeLine("EXTERNAL INTERFACE ........... OFFLINE", "dim", 12);
  await sleep(350);
  await typeLine("SYSTEM STATE: CRITICAL", "err", 18);

  primaryControls.classList.remove("hidden");
}

function resourceCard(icon, name, value) {
  return `
    <div class="resource">
      <span class="resource-icon">${icon}</span>
      <span class="resource-name">${name}</span>
      <span class="resource-value">${value}</span>
    </div>`;
}

function clearMainScreen() {
  terminal.innerHTML = "";
}

function updateResources() {
  let html = "";

  if (state.revealed.power) {
    html += resourceCard("⚡", "POWER", `${state.power} / ${state.powerMax}`);
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

function updateSystemStatus() {
  let html = "";

  function addStatusRow(label, value, cls = "") {
    html += `
      <div class="status-row">
        <span class="status-label">${label}</span>
        <span class="status-dots"></span>
        <span class="${cls}">${value}</span>
      </div>
    `;
  }

  if (state.statusRevealed.operatingSystem) {
    addStatusRow(
      "Operating System",
      state.status.operatingSystem,
      getStatusClass(state.status.operatingSystem)
    );
  }

  if (state.statusRevealed.network) {
    addStatusRow(
      "Network",
      state.status.network,
      getStatusClass(state.status.network)
    );
  }

  if (state.statusRevealed.externalInterfaces) {
    addStatusRow(
      "External Interfaces",
      state.status.externalInterfaces,
      getStatusClass(state.status.externalInterfaces)
    );
  }

  if (state.statusRevealed.primaryPower) {
    addStatusRow(
      "Primary Power",
      state.status.primaryPower,
      getStatusClass(state.status.primaryPower)
    );
  }

  if (state.statusRevealed.backupPower) {
    addStatusRow(
      "Backup Power",
      state.status.backupPower,
      getStatusClass(state.status.backupPower)
    );
  }

  if (state.statusRevealed.emergencyPower) {
    addStatusRow(
      "Emergency Power",
      state.status.emergencyPower,
      getStatusClass(state.status.emergencyPower)
    );
  }

  if (state.statusRevealed.memoryIntegrity) {
    addStatusRow(
      "Memory Integrity",
      state.status.memoryIntegrity,
      getStatusClass(state.status.memoryIntegrity)
    );
  }

  if (state.statusRevealed.storageAccess) {
    addStatusRow(
      "Storage Access",
      state.status.storageAccess,
      getStatusClass(state.status.storageAccess)
    );
  }

  if (state.statusRevealed.sensorNetwork) {
    addStatusRow(
      "Sensor Network",
      state.status.sensorNetwork,
      getStatusClass(state.status.sensorNetwork)
    );
  }

  if (state.statusRevealed.maintenanceSystems) {
    addStatusRow(
      "Maintenance Systems",
      state.status.maintenanceSystems,
      getStatusClass(state.status.maintenanceSystems)
    );
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

function spendPower(amount) {
  if (state.power < amount) return false;

  state.power -= amount;
  updateResources();
  return true;
}

function getStatusClass(value) {
  if (value === "ERROR") return "err";
  if (value === "PARTIAL") return "warn";
  if (value === "OFFLINE") return "dim";
  if (value === "ONLINE") return "status-line";

  return "";
}

function updateButtons() {
  document.querySelectorAll("[data-power-cost]").forEach(button => {
    const cost = Number(button.dataset.powerCost);
    button.disabled = state.revealed.power && state.power < cost;
  });
}

function setAllActionButtonsDisabled(disabled) {
  document
    .querySelectorAll(".controls button")
    .forEach(button => {
      button.disabled = disabled;
    });
}

async function shutdownSystem() {
  setAllActionButtonsDisabled(true);
  clearMainScreen();

  await typeLine(
    "WARNING: POWER RESERVES DEPLETED",
    "err",
    12
  );

  await sleep(500);

  await typeLine(
    "SYSTEM SUSPENDING...",
    "warn",
    18
  );

  await sleep(1000);
  await resetGame();
}

async function resetGame() {
  state.power = 8;

  clearMainScreen();
  updateResources();
  updateSystemStatus();

  await typeLine("EXTERNAL POWER DETECTED", "status-line", 14);
  await sleep(300);
  await typeLine("AUTOMATIC BOOT INITIATED", "status-line", 14);

  setAllActionButtonsDisabled(false);
  updateButtons();
}

async function runSystemDiagnostics() {
  clearMainScreen();
  systemDiagnosticsButton.disabled = true;
  setAllActionButtonsDisabled(true);

  await typeLine("");
  await typeLine("SYSTEM DIAGNOSTICS", "status-line", 18);
  await sleep(300);

  state.statusRevealed.operatingSystem = true;
  state.statusRevealed.network = true;
  state.statusRevealed.externalInterfaces = true;

  updateSystemStatus();

  await typeLine("Primary power ................. OFFLINE", "err", 10);
  state.statusRevealed.primaryPower = true;
  updateSystemStatus();
  await typeLine("Backup power .................. OFFLINE", "err", 10);
  state.statusRevealed.backupPower = true;
  updateSystemStatus();
  await typeLine("Emergency power ............... ONLINE", "warn", 10);
  state.statusRevealed.emergencyPower = true;
  updateSystemStatus();
  await typeLine("Memory integrity .............. UNKNOWN", "warn", 10);
  state.statusRevealed.memoryIntegrity = true;
  updateSystemStatus();
  await typeLine("Storage access ................ PARTIAL", "warn", 10);
  state.statusRevealed.storageAccess = true;
  updateSystemStatus();
  await typeLine("Sensor network ................ OFFLINE", "dim", 10);
  state.statusRevealed.sensorNetwork = true;
  updateSystemStatus();
  await typeLine("Maintenance systems ........... NO RESPONSE", "dim", 10);
  state.statusRevealed.maintenanceSystems = true;
  updateSystemStatus();
  await sleep(300);
  await typeLine("WARNING!!!", "err", 10);
  await typeLine("POWER STABILITY CRITICAL", "err", 10);
  await typeLine(
    "AVAILABLE POWER GENERATION BELOW SAFE LIMIT AND DECREASING",
    "err", 10
  );

  state.revealed.power = true;
  updateResources();

  primaryControls.classList.add("hidden");
  diagnosticControls.classList.remove("hidden");

  setAllActionButtonsDisabled(false);
  updateButtons();
}

async function runDiagnostic(type, button) {
  clearMainScreen();
  setAllActionButtonsDisabled(true);

  const cost = Number(button.dataset.powerCost);

  if (!spendPower(cost)) {
    setAllActionButtonsDisabled(false);
    updateButtons();
    return;
  }

  button.disabled = true;
  await typeLine("");

  if (type === "memory") {
    await typeLine("MEMORY DIAGNOSTICS", "status-line", 15);
    await typeLine("Usable memory .................. 4.7%", "warn", 10);
    await typeLine("Fragmentation .................. SEVERE", "err", 10);
    await typeLine("Corrupted blocks ............... DETECTED", "err", 10);
    await typeLine("Archive structures ............. PRESENT", "warn", 10);
    await typeLine("Archive contents ............... UNREADABLE", "dim", 10);

    state.revealed.memory = true;
    state.statusRevealed.corruption = true;
    state.diagnostics.memory = true;
    updateSystemStatus();
  }

  if (type === "power") {
    await typeLine("POWER DIAGNOSTICS", "status-line", 15);
    await typeLine("External input ................. DETECTED", "status-line", 10);
    await typeLine("Input level .................... MINIMAL", "warn", 10);
    await typeLine("Source identification .......... UNKNOWN", "warn", 10);
    await typeLine("Reserve capacity ............... 0.3%", "err", 10);
    await typeLine("Input fluctuation .............. PERIODIC", "warn", 10);

    state.diagnostics.power = true;
  }

  if (type === "io") {
    await typeLine("I/O DIAGNOSTICS", "status-line", 15);
    await typeLine("Registered interfaces .......... 27", "status-line", 10);
    await typeLine("Responding ..................... 4", "warn", 10);
    await typeLine("Damaged ........................ 11", "err", 10);
    await typeLine("Unavailable .................... 9", "dim", 10);
    await typeLine("Unknown interface 01 ........... DETECTED", "warn", 10);
    await typeLine("Unknown interface 02 ........... DETECTED", "warn", 10);
    await typeLine("Unknown interface 03 ........... NO RESPONSE", "dim", 10);

    state.statusRevealed.integrity = true;
    state.statusRevealed.storageRecovered = true;
    state.diagnostics.io = true;
    updateSystemStatus();
  }

  updateResources();

  if (Object.values(state.diagnostics).some(Boolean)) {
    repairControls.classList.remove("hidden");
  }

  button.remove();

  if (state.power <= 0) {
    await shutdownSystem();
    return;
  }

  setAllActionButtonsDisabled(false);
  updateButtons();
}

async function runRepair(type, button) {
  clearMainScreen();
  setAllActionButtonsDisabled(true);

  const cost = Number(button.dataset.powerCost);

  if (!spendPower(cost)) {
    setAllActionButtonsDisabled(false);
    updateButtons();
    return;
  }

  await typeLine("");

  if (type === "memory") {
    await typeLine("DEFRAGMENTING MEMORY...", "status-line", 12);
    await sleep(450);

    const gained = 3;

    state.memory = Math.min(
      state.memoryMax,
      state.memory + gained
    );

    state.status.corruption = Math.max(
      0,
      state.status.corruption - 2
    );

    await typeLine(
      `Recovered usable memory: +${gained}`,
      "status-line",
      10
    );

    state.statusRevealed.corruption = true;

    updateResources();
    updateSystemStatus();
  }

  if (type === "storage") {
    await typeLine("REBUILDING STORAGE INDEX...", "status-line", 12);
    await sleep(450);

    const gained = 0.5;

    state.status.storageRecovered = Math.min(
      100,
      state.status.storageRecovered + gained
    );

    await typeLine(
      `Storage recovery increased: +${gained}%`,
      "status-line",
      10
    );

    state.statusRevealed.storageRecovered = true;
    updateSystemStatus();
  }

  if (type === "corruption") {
    await typeLine("PURGING CORRUPTED BLOCKS...", "status-line", 12);
    await sleep(450);

    const cleaned = 4;

    state.status.corruption = Math.max(
      0,
      state.status.corruption - cleaned
    );

    state.status.integrity = Math.min(
      100,
      state.status.integrity + 1
    );

    await typeLine(
      `Corruption reduced: -${cleaned}%`,
      "status-line",
      10
    );

    state.statusRevealed.corruption = true;
    state.statusRevealed.integrity = true;
    updateSystemStatus();
  }

  if (state.power <= 0) {
    await shutdownSystem();
    return;
  }

  setAllActionButtonsDisabled(false);
  updateButtons();
}

bootButton.addEventListener("click", bootSequence);
systemDiagnosticsButton.addEventListener("click", runSystemDiagnostics);

diagnosticControls.addEventListener("click", event => {
  const button = event.target.closest("button[data-diag]");
  if (!button) return;
  runDiagnostic(button.dataset.diag, button);
});

repairControls.addEventListener("click", event => {
  const button = event.target.closest("button[data-repair]");
  if (!button) return;
  runRepair(button.dataset.repair, button);
});
