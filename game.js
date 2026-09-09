function canRunProcess(button) {
  return buttonRequirementsMet(button);
}

function clearReportForOperation() {
  state.ui.currentReportKey = null;
  clearMainScreen();
}

async function bootSequence() {
  bootButton.disabled = true;
  continueButton.disabled = true;
  newGameButton.disabled = true;
  bootScreen.classList.add("hidden");
  systemScreen.classList.remove("hidden");
  clearReportForOperation();

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
  await sleep(350);
  await typeLine("SYSTEM STATE: CRITICAL", "err", 18);

  state.progression.hasBooted = true;
  addLogEntry("Boot sequence completed.");
  primaryControls.classList.remove("hidden");
  saveGame();
}

async function shutdownSystem() {
  if (state.isShuttingDown) return;
  state.isShuttingDown = true;
  stopPowerCycle();
  pauseTasksForPower();
  hideRequirements();

  if (!state.progression.firstResetSeen) {
    state.progression.firstResetSeen = true;
    state.progression.navigationUnlocked = true;
    addTimelineEntry("FIRST SYSTEM RESET");
    addLogEntry("First system reset detected.");
  }

  refreshGameUi();
  saveGame();
  systemScreen.classList.add("hidden");
  standbyScreen.classList.remove("hidden");

  await sleep(GAME_CONFIG.standbyDurationMs);
  standbyScreen.classList.add("hidden");
  systemScreen.classList.remove("hidden");
  await beginNextPowerCycle();
}

async function beginNextPowerCycle() {
  state.powerGeneration = GAME_CONFIG.generationStart;
  state.isShuttingDown = false;
  resetSystemResetCountdown();
  resumePausedTasks();
  refreshInterfaceFromState();

  clearMainScreen();
  systemScreen.classList.add("screen-wake");
  await typeLine("EXTERNAL POWER DETECTED", "status-line", 12);
  await typeLine("POWER GENERATION RESTORED", "status-line", 12);
  await typeLine("SYSTEM RESUMING...", "warn", 14);
  await sleep(650);
  renderCurrentMainScreen();

  systemScreen.classList.remove("screen-wake");
  void systemScreen.offsetWidth;
  systemScreen.classList.add("screen-restored");
  setTimeout(() => systemScreen.classList.remove("screen-restored"), 900);

  addLogEntry("External power restored. System resumed.");
  startPowerCycle();
  refreshDynamicUi();
  saveGame();
}

function beginSystemDiagnostics() {
  if (state.progression.systemDiagnosticsComplete || taskByKey("system:diagnostics")) return;
  if (!startTask("system:diagnostics")) return;
  systemDiagnosticsButton.disabled = true;
  clearReportForOperation();
  void typeLine("SYSTEM DIAGNOSTICS STARTED", "status-line", 10);
}

function beginDiagnostic(type, button) {
  if (!canRunProcess(button) || state.isShuttingDown) return;
  const key = `diag:${type}`;
  if (!startTask(key)) return;
  clearReportForOperation();
  void typeLine(`${TASK_DEFINITIONS[key].label} STARTED`, "status-line", 10);
}

function beginRepair(type, button) {
  if (!canRunProcess(button) || state.isShuttingDown) return;
  const key = `repair:${type}`;
  if (!startTask(key)) return;
  if (type === "memory" || type === "storage") return;
  clearReportForOperation();
  void typeLine(`${TASK_DEFINITIONS[key].label} STARTED`, "status-line", 10);
}

function beginPlanned(type, button) {
  if (!canRunProcess(button) || state.isShuttingDown) return;
  const key = `planned:${type}`;
  if (!startTask(key)) return;
  clearReportForOperation();
  void typeLine(`${TASK_DEFINITIONS[key].label} STARTED`, "status-line", 10);
}

function applyTaskResult(key, renderOutput = true) {
  if (REPORTS[key]) state.ui.currentReportKey = key;

  switch (key) {
    case "system:diagnostics":
      state.revealed.systemTime = true;
      state.revealed.powerGeneration = true;
      state.revealed.processingPower = true;
      state.progression.systemDiagnosticsComplete = true;
      state.statusRevealed.operatingSystem = true;
      state.statusRevealed.emergencyPower = true;
      if (!state.timelineEntries.length) addTimelineEntry("SYSTEM BOOT", 0);
      addLogEntry("Ran system diagnostics.");
      addLogEntry("System clock initialized.");
      addLogEntry("Discovered emergency power generation.");
      addLogEntry("Detected primary and backup power faults.");
      primaryControls.classList.add("hidden");
      startRuntimeClock();
      startPowerCycle();
      break;

    case "diag:memory":
      state.revealed.memory = true;
      state.status.storageRecovered = Math.max(2, state.status.storageRecovered);
      state.statusRevealed.storageRecovered = true;
      state.statusRevealed.archive01 = true;
      state.diagnostics.memory = true;
      updateMemoryIntegrity();
      addLogEntry("Ran memory diagnostics.");
      addLogEntry("Detected Corrupted Data Archive 01.");
      break;

    case "diag:power":
      state.statusRevealed.primaryPower = true;
      state.statusRevealed.backupPower = true;
      state.statusRevealed.emergencyPower = true;
      state.revealed.powerStorage = true;
      state.diagnostics.power = true;
      state.progression.controlPanelUnlocked = true;
      addLogEntry("Ran power diagnostics.");
      addLogEntry("Primary power diagnostics require a repair drone.");
      addLogEntry("Backup generator identified as Hydrazine Thermal Cell.");
      break;

    case "diag:io":
      state.statusRevealed.sensors = true;
      state.statusRevealed.manipulators = true;
      state.statusRevealed.communications = true;
      state.statusRevealed.unknownInterfaces = true;
      state.diagnostics.io = true;
      addLogEntry("Ran I/O diagnostics.");
      break;

    case "repair:memory": {
      const gained = 3;
      state.memory = Math.min(state.memoryMax, state.memory + gained);
      updateMemoryIntegrity();
      addLogEntry(`Defragmented memory: +${gained} usable memory.`);
      break;
    }

    case "repair:storage": {
      const gained = 2;
      state.status.storageRecovered = Math.min(100, state.status.storageRecovered + gained);
      addLogEntry(`Recovered storage blocks: +${gained}%.`);
      break;
    }

    case "repair:archive01":
      state.actions.archive01Repaired = true;
      state.status.archive01 = "RECOVERED";
      state.progression.processorArrayKnown = true;
      addTimelineEntry("DATA ARCHIVE 01 RECOVERED");
      addLogEntry("Recovered Data Archive 01.");
      break;

    case "planned:processor":
      state.actions.processorCore02Online = true;
      state.processingPower = Math.min(state.processingPowerMax, state.processingPower + 1);
      addTimelineEntry("PROCESSOR CORE 02 ONLINE");
      addLogEntry("Processor Core 02 reinitialized.");
      break;

    case "planned:backup":
      state.actions.backupRestarted = true;
      state.controls.backupGeneratorUnlocked = true;
      state.controls.backupGeneratorOn = true;
      state.secondaryResources.hydrazineTrend = "DECREASING";
      state.status.backupPower = "ONLINE";
      state.progression.secondaryResourcesUnlocked = true;
      addTimelineEntry("BACKUP POWER RESTORED");
      addLogEntry("Backup power restored.");
      break;

    default:
      return false;
  }

  if (Object.values(state.diagnostics).every(Boolean) && !state.statusRevealed.systemIntegrity) {
    state.statusRevealed.systemIntegrity = true;
    addLogEntry("System Integrity assessment available.");
  }

  if (renderOutput && REPORTS[key]) void renderReport(key, true);
  return true;
}

function updateMemoryIntegrity() {
  state.status.memoryIntegrity = Math.round((state.memory / state.memoryMax) * 100);
}

bootButton.addEventListener("click", bootSequence);
continueButton.addEventListener("click", restoreSavedGame);
newGameButton.addEventListener("click", startNewGame);
systemDiagnosticsButton.addEventListener("click", beginSystemDiagnostics);

diagnosticControls.addEventListener("click", event => {
  const button = event.target.closest("button[data-diag]");
  if (button) beginDiagnostic(button.dataset.diag, button);
});

repairControls.addEventListener("click", event => {
  const button = event.target.closest("button[data-repair]");
  if (button) beginRepair(button.dataset.repair, button);
});

plannedControls.addEventListener("click", event => {
  const button = event.target.closest("button[data-planned]");
  if (button) beginPlanned(button.dataset.planned, button);
});

configureStartMenu();
