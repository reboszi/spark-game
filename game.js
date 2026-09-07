let powerCycleTimer = null;

function getProcessRequirement(button) {
  return Number(button.dataset.powerRequirement || 0);
}

function canRunProcess(button) {
  return getAvailablePower() >= getProcessRequirement(button);
}

function startPowerCycle() {
  if (powerCycleTimer) return;

  powerCycleTimer = setInterval(async () => {
    if (state.isShuttingDown) return;

    if (state.powerGeneration > 0) {
      state.powerGeneration -= 1;
      updateResources();
    }

    if (
      state.powerGeneration <= 0 &&
      state.powerStorage <= 0 &&
      !state.isBusy
    ) {
      await shutdownSystem();
    }
  }, GAME_CONFIG.generationTickMs);
}

function stopPowerCycle() {
  if (!powerCycleTimer) return;
  clearInterval(powerCycleTimer);
  powerCycleTimer = null;
}

async function finishProcess() {
  setAllActionButtonsDisabled(false);
  updateButtons();

  if (state.powerGeneration <= 0 && state.powerStorage <= 0) {
    await shutdownSystem();
  }
}

async function bootSequence() {
  bootButton.disabled = true;
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

async function shutdownSystem() {
  if (state.isShuttingDown) return;

  state.isShuttingDown = true;
  stopPowerCycle();
  setAllActionButtonsDisabled(true);
  clearMainScreen();

  await typeLine("WARNING: POWER GENERATION LOST", "err", 12);
  await typeLine("POWER STORAGE ................. UNAVAILABLE", "err", 12);
  await sleep(500);
  await typeLine("SYSTEM SUSPENDING...", "warn", 18);
  await sleep(1200);

  await beginNextPowerCycle();
}

async function beginNextPowerCycle() {
  clearMainScreen();

  await typeLine("EXTERNAL POWER DETECTED", "status-line", 14);
  await sleep(300);
  await typeLine("INPUT LEVEL RISING...", "status-line", 14);
  await sleep(500);

  state.powerGeneration = GAME_CONFIG.generationStart;
  state.isShuttingDown = false;
  state.isBusy = false;

  updateResources();
  updateSystemStatus();
  refreshActionUnlocks();
  updateButtons();

  await typeLine("AUTOMATIC RECOVERY COMPLETE", "status-line", 14);
  startPowerCycle();
}

async function runSystemDiagnostics() {
  clearMainScreen();
  systemDiagnosticsButton.disabled = true;
  setAllActionButtonsDisabled(true);

  await typeLine("SYSTEM DIAGNOSTICS", "status-line", 18);
  await sleep(300);

  state.statusRevealed.operatingSystem = true;
  state.statusRevealed.network = true;
  state.statusRevealed.externalInterfaces = true;
  updateSystemStatus();

  await typeLine("Primary power ................. OFFLINE", "dim", 10);
  state.statusRevealed.primaryPower = true;
  updateSystemStatus();

  await typeLine("Backup power .................. OFFLINE", "dim", 10);
  state.statusRevealed.backupPower = true;
  updateSystemStatus();

  await typeLine("Emergency power ............... ONLINE", "status-line", 10);
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

  await typeLine("Processing capacity ........... MINIMAL", "warn", 10);
  await sleep(300);
  await typeLine("WARNING!!!", "err", 10);
  await typeLine("POWER GENERATION UNSTABLE", "err", 10);
  await typeLine("AVAILABLE GENERATION BELOW SAFE LIMIT AND DECREASING", "err", 10);

  state.revealed.powerGeneration = true;
  state.revealed.processingPower = true;
  updateResources();

  primaryControls.classList.add("hidden");
  diagnosticSection.classList.remove("hidden");

  setAllActionButtonsDisabled(false);
  updateButtons();
  startPowerCycle();
}

async function runDiagnostic(type, button) {
  if (!canRunProcess(button) || state.isBusy || state.isShuttingDown) return;

  clearMainScreen();
  setAllActionButtonsDisabled(true);

  const requirement = getProcessRequirement(button);
  await typeLine(`${button.textContent.trim()} — POWER REQUIREMENT ${requirement}`, "dim", 5);
  await typeLine("");

  if (type === "memory") {
    await typeLine("MEMORY DIAGNOSTICS", "status-line", 15);
    await typeLine("Usable memory .................. 4.7%", "warn", 10);
    await typeLine("Fragmentation .................. SEVERE", "err", 10);
    await typeLine("Corrupted blocks ............... DETECTED", "warn", 10);
    await typeLine("Archive structures ............. PRESENT", "status-line", 10);
    await typeLine("Archive contents ............... UNREADABLE", "dim", 10);

    state.revealed.memory = true;
    state.statusRevealed.corruption = true;
    state.diagnostics.memory = true;
  }

  if (type === "power") {
    await typeLine("POWER DIAGNOSTICS", "status-line", 15);
    await typeLine("External generation ............ DETECTED", "status-line", 10);
    await typeLine("Generation level ............... MINIMAL", "warn", 10);
    await typeLine("Source identification .......... UNKNOWN", "warn", 10);
    await typeLine("Input fluctuation .............. PERIODIC", "warn", 10);
    await typeLine("Power storage .................. NOT AVAILABLE", "err", 10);

    state.revealed.powerStorage = true;
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
  }

  updateResources();
  updateSystemStatus();
  refreshActionUnlocks();

  button.remove();
  await finishProcess();
}

async function runRepair(type, button) {
  if (!canRunProcess(button) || state.isBusy || state.isShuttingDown) return;

  clearMainScreen();
  setAllActionButtonsDisabled(true);

  const requirement = getProcessRequirement(button);
  await typeLine(`${button.textContent.trim()} — POWER REQUIREMENT ${requirement}`, "dim", 5);
  await typeLine("");

  if (type === "memory") {
    await typeLine("DEFRAGMENTING MEMORY...", "status-line", 12);
    await sleep(450);

    const gained = 3;
    state.memory = Math.min(state.memoryMax, state.memory + gained);
    state.status.corruption = Math.max(0, state.status.corruption - 2);

    await typeLine(`Recovered usable memory: +${gained}`, "status-line", 10);
    state.statusRevealed.corruption = true;
  }

  if (type === "storage") {
    await typeLine("REBUILDING STORAGE INDEX...", "status-line", 12);
    await sleep(450);

    const gained = 0.5;
    state.status.storageRecovered = Math.min(100, state.status.storageRecovered + gained);

    await typeLine(`Storage recovery increased: +${gained}%`, "status-line", 10);
    state.statusRevealed.storageRecovered = true;
  }

  if (type === "corruption") {
    await typeLine("PURGING CORRUPTED BLOCKS...", "status-line", 12);
    await sleep(450);

    const cleaned = 4;
    state.status.corruption = Math.max(0, state.status.corruption - cleaned);
    state.status.integrity = Math.min(100, state.status.integrity + 1);

    await typeLine(`Corruption reduced: -${cleaned}%`, "status-line", 10);
    state.statusRevealed.corruption = true;
    state.statusRevealed.integrity = true;
  }

  updateResources();
  updateSystemStatus();
  refreshActionUnlocks();
  await finishProcess();
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
