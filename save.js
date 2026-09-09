const SAVE_KEY = "spark-game-save-v1";
const SAVE_VERSION = 9;

function hasSaveGame() {
  return Boolean(localStorage.getItem(SAVE_KEY));
}

function mergeKnownState(target, source) {
  for (const [key, value] of Object.entries(source || {})) {
    if (!(key in target)) continue;

    if (
      value
      && typeof value === "object"
      && !Array.isArray(value)
      && target[key]
      && typeof target[key] === "object"
      && !Array.isArray(target[key])
    ) {
      mergeKnownState(target[key], value);
    } else {
      target[key] = value;
    }
  }
}

function canonicalStateSnapshot() {
  const snapshot = JSON.parse(JSON.stringify(state));

  delete snapshot.isShuttingDown;
  delete snapshot.revealed;
  delete snapshot.statusRevealed;

  if (snapshot.secondaryResources) delete snapshot.secondaryResources.hydrazineTrend;

  if (snapshot.status) {
    delete snapshot.status.systemIntegrity;
    delete snapshot.status.memoryIntegrity;
    delete snapshot.status.archive01;
    delete snapshot.status.backupPower;
  }

  if (snapshot.progression) {
    delete snapshot.progression.taskbarUnlocked;
    delete snapshot.progression.navigationUnlocked;
    delete snapshot.progression.controlPanelUnlocked;
    delete snapshot.progression.secondaryResourcesUnlocked;
    delete snapshot.progression.processorArrayKnown;
  }

  if (snapshot.controls) delete snapshot.controls.backupGeneratorUnlocked;
  return snapshot;
}

function normalizeLoadedState() {
  state.isShuttingDown = false;
  state.accumulatedTimeSeconds = Math.max(0, Number(state.accumulatedTimeSeconds || 0));

  const tickSeconds = GAME_CONFIG.generationTickMs / 1000;
  state.powerGeneration = Math.max(0, Math.min(GAME_CONFIG.generationStart, Number(state.powerGeneration || 0)));
  state.powerGenerationTickProgressSeconds = Math.max(0, Number(state.powerGenerationTickProgressSeconds || 0)) % tickSeconds;
  state.externalRecoverySecondsRemaining = Math.max(0, Number(state.externalRecoverySecondsRemaining || 0));
  if (state.powerGeneration > 0) state.externalRecoverySecondsRemaining = 0;

  state.memory = Math.max(0, Math.min(state.memoryMax, Number(state.memory || 0)));
  state.processingPower = Math.max(0, Math.min(state.processingPowerMax, Number(state.processingPower || 0)));
  state.powerStorage = Math.max(0, Math.min(state.powerStorageMax, Number(state.powerStorage || 0)));

  state.secondaryResources.hydrazineReserveHidden = Math.max(0, Number(state.secondaryResources.hydrazineReserveHidden || 0));
  state.secondaryResources.hydrazineBurnSeconds = Math.max(0, Number(state.secondaryResources.hydrazineBurnSeconds || 0));
  state.secondaryResources.hydrazineTrend = state.controls.backupGeneratorOn ? "DECREASING" : "STABLE";

  if (!state.actions.backupRestarted) state.controls.backupGeneratorOn = false;
  state.controls.backupGeneratorUnlocked = Boolean(state.actions.backupRestarted);

  state.status.memoryIntegrity = Math.round((state.memory / state.memoryMax) * 100);
  state.status.archive01 = state.actions.archive01Repaired ? "RECOVERED" : "CORRUPTED";
  state.status.backupPower = state.actions.backupRestarted && state.controls.backupGeneratorOn ? "ONLINE" : "STOPPED";

  const integrity = calculateSystemIntegrity();
  state.status.systemIntegrity = integrity === null ? 0 : integrity;

  state.progression.taskbarUnlocked = Boolean(state.progression.systemDiagnosticsComplete || state.runningTasks.length);
  state.progression.navigationUnlocked = Boolean(state.progression.firstResetSeen);
  state.progression.controlPanelUnlocked = Boolean(state.diagnostics.power);
  state.progression.secondaryResourcesUnlocked = Boolean(state.actions.backupRestarted);
  state.progression.processorArrayKnown = Boolean(state.actions.archive01Repaired);

  state.revealed.systemTime = Boolean(state.progression.systemDiagnosticsComplete);
  state.revealed.powerGeneration = Boolean(state.progression.systemDiagnosticsComplete);
  state.revealed.processingPower = Boolean(state.progression.systemDiagnosticsComplete);
  state.revealed.memory = Boolean(state.diagnostics.memory);
  state.revealed.powerStorage = Boolean(state.diagnostics.power);

  state.statusRevealed.operatingSystem = Boolean(state.progression.systemDiagnosticsComplete);
  state.statusRevealed.emergencyPower = Boolean(state.progression.systemDiagnosticsComplete);
  state.statusRevealed.primaryPower = Boolean(state.diagnostics.power);
  state.statusRevealed.backupPower = Boolean(state.diagnostics.power);
  state.statusRevealed.storageRecovered = Boolean(state.diagnostics.memory);
  state.statusRevealed.archive01 = Boolean(state.diagnostics.memory);
  state.statusRevealed.sensors = Boolean(state.diagnostics.io);
  state.statusRevealed.manipulators = Boolean(state.diagnostics.io);
  state.statusRevealed.communications = Boolean(state.diagnostics.io);
  state.statusRevealed.unknownInterfaces = Boolean(state.diagnostics.io);
  state.statusRevealed.systemIntegrity = Object.values(state.diagnostics).every(Boolean);

  state.runningTasks = (Array.isArray(state.runningTasks) ? state.runningTasks : [])
    .filter(task => task && TASK_DEFINITIONS[task.key])
    .map(task => {
      const definition = TASK_DEFINITIONS[task.key];
      const duration = Math.max(1, Number(task.durationSeconds || definition.duration));
      const remaining = Math.max(0, Math.min(duration, Number(task.remainingSeconds ?? duration)));
      const review = Boolean(definition.review);
      let status = ["RUNNING", "PAUSED", "REVIEW"].includes(task.status) ? task.status : "RUNNING";
      if (review && remaining <= 0) status = "REVIEW";
      if (!review && status === "REVIEW") status = "RUNNING";
      return {
        id: task.id || `${task.key}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
        key: task.key,
        label: definition.label,
        durationSeconds: duration,
        remainingSeconds: remaining,
        power: definition.power,
        status,
        review
      };
    });

  if (state.progression.systemDiagnosticsComplete && !state.timelineEntries.length) {
    state.timelineEntries.push({ timeSeconds: 0, text: "SYSTEM BOOT" });
  }

  if (!state.ui || !["MAIN", "TIMELINE"].includes(state.ui.currentView)) {
    state.ui = { currentReportKey: null, currentView: "MAIN" };
  }
  if (state.ui.currentReportKey && !REPORTS[state.ui.currentReportKey]) state.ui.currentReportKey = null;
}

function buildSavePayload() {
  return {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    state: canonicalStateSnapshot()
  };
}

function saveGame() {
  if (!state.progression.hasBooted) return;
  if (typeof debugSessionActive !== "undefined" && debugSessionActive) return;
  localStorage.setItem(SAVE_KEY, JSON.stringify(buildSavePayload()));
}

function importStatePayload(payload) {
  if (!payload || typeof payload !== "object" || !payload.state) return false;

  resetStateToDefaults();
  mergeKnownState(state, payload.state);

  if (!state.ui.currentReportKey && payload.mainScreenHtml) {
    state.ui.currentReportKey = inferReportKeyFromLegacyHtml(payload.mainScreenHtml);
  }

  normalizeLoadedState();
  return true;
}

function loadSaveGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return false;

  try {
    const payload = JSON.parse(raw);
    if (!importStatePayload(payload)) return false;

    if (state.progression.hasBooted && Number(payload.savedAt) > 0) {
      state.accumulatedTimeSeconds += Math.max(0, (Date.now() - Number(payload.savedAt)) / 1000);
    }

    if (payload.version !== SAVE_VERSION || payload.mainScreenHtml !== undefined) {
      localStorage.setItem(SAVE_KEY, JSON.stringify(buildSavePayload()));
    }
    return true;
  } catch (error) {
    console.error("Could not load save game:", error);
    return false;
  }
}

function deleteSaveGame() {
  localStorage.removeItem(SAVE_KEY);
}

function configureStartMenu() {
  const saveExists = hasSaveGame();
  bootButton.classList.toggle("hidden", saveExists);
  continueButton.classList.toggle("hidden", !saveExists);
  newGameButton.classList.toggle("hidden", !saveExists);
}

function restoreLoadedStateToScreen() {
  bootScreen.classList.add("hidden");
  standbyScreen.classList.add("hidden");
  systemScreen.classList.remove("hidden");

  if (getTotalGeneration() <= 0 && state.powerStorage <= 0) {
    state.powerGeneration = GAME_CONFIG.generationStart;
    resetSystemResetCountdown();
  }

  refreshInterfaceFromState();
  applyCurrentView();

  if (!document.hidden) {
    if (state.progression.systemDiagnosticsComplete || state.runningTasks.length) startRuntimeClock();
    if (state.progression.systemDiagnosticsComplete) startPowerCycle();
  }
}

function restoreSavedGame() {
  if (!loadSaveGame()) {
    configureStartMenu();
    return;
  }
  restoreLoadedStateToScreen();
  saveGame();
}

function startNewGame() {
  deleteSaveGame();
  window.location.reload();
}
