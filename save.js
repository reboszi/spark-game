const SAVE_KEY = "spark-game-save-v1";
const SAVE_VERSION = 7;

function hasSaveGame() {
  return Boolean(localStorage.getItem(SAVE_KEY));
}

function mergeState(target, source) {
  for (const [key, value] of Object.entries(source || {})) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      target[key] &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      mergeState(target[key], value);
    } else {
      target[key] = value;
    }
  }
}

function canonicalStateSnapshot() {
  const snapshot = JSON.parse(JSON.stringify(state));

  delete snapshot.isBusy;
  delete snapshot.isShuttingDown;
  delete snapshot.powerGenerationMax;

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
  state.isBusy = false;
  state.isShuttingDown = false;
  state.powerGenerationMax = GAME_CONFIG.generationStart;
  state.accumulatedTimeSeconds = Math.max(0, Number(state.accumulatedTimeSeconds || 0));
  if (!state.ui) state.ui = { currentReportKey: null, currentView: "MAIN" };
  if (!state.ui.currentView) state.ui.currentView = "MAIN";

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
  state.controls.backupGeneratorUnlocked = Boolean(state.actions.backupRestarted);

  if (state.progression.systemDiagnosticsComplete) state.revealed.systemTime = true;

  for (const task of state.runningTasks || []) {
    const definition = TASK_DEFINITIONS[task.key];
    if (!definition) continue;
    task.durationSeconds = task.durationSeconds || definition.duration || Math.max(1, Number(task.remainingSeconds || 1));
    task.review = Boolean(definition.review);
    if (task.review && Number(task.remainingSeconds || 0) <= 0) {
      task.remainingSeconds = 0;
      task.status = "REVIEW";
    }
  }

  if (state.progression.systemDiagnosticsComplete && !state.timelineEntries.length) {
    state.timelineEntries.push({ timeSeconds: 0, text: "SYSTEM BOOT" });
  }
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
  mergeState(state, payload.state);

  if (!state.ui?.currentReportKey && payload.mainScreenHtml) {
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

    // Closed/background time never simulates gameplay. It only becomes accumulated time.
    if (state.progression.hasBooted && Number(payload.savedAt) > 0) {
      const offlineSeconds = Math.max(0, (Date.now() - Number(payload.savedAt)) / 1000);
      state.accumulatedTimeSeconds += offlineSeconds;
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
  refreshShellPanels();
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
