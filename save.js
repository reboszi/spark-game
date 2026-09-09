const SAVE_KEY = "spark-game-save-v1";
const SAVE_VERSION = 9;

function hasSaveGame() {
  return Boolean(localStorage.getItem(SAVE_KEY));
}

function mergeKnownState(target, source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return;

  for (const [key, value] of Object.entries(source)) {
    if (!(key in target)) continue;
    const current = target[key];

    if (Array.isArray(current)) {
      if (Array.isArray(value)) target[key] = value;
      continue;
    }

    if (current && typeof current === "object") {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        mergeKnownState(current, value);
      }
      continue;
    }

    if (typeof value === typeof current) target[key] = value;
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

  state.memoryMax = Math.max(1, Number(state.memoryMax || INITIAL_STATE.memoryMax));
  state.memory = Math.max(0, Math.min(state.memoryMax, Number(state.memory || 0)));
  state.processingPowerMax = Math.max(1, Number(state.processingPowerMax || INITIAL_STATE.processingPowerMax));
  state.processingPower = Math.max(0, Math.min(state.processingPowerMax, Number(state.processingPower || 0)));
  state.powerStorageMax = Math.max(0, Number(state.powerStorageMax || 0));
  state.powerStorage = Math.max(0, Math.min(state.powerStorageMax, Number(state.powerStorage || 0)));

  state.secondaryResources.hydrazineReserveHidden = Math.max(0, Number(state.secondaryResources.hydrazineReserveHidden || 0));
  state.secondaryResources.hydrazineBurnSeconds = Math.max(0, Number(state.secondaryResources.hydrazineBurnSeconds || 0));

  state.logEntries = Array.isArray(state.logEntries)
    ? state.logEntries.slice(-80).map(entry => String(entry))
    : [];

  state.timelineEntries = Array.isArray(state.timelineEntries)
    ? state.timelineEntries
      .filter(entry => entry && typeof entry === "object" && typeof entry.text === "string")
      .map(entry => ({ timeSeconds: Math.max(0, Number(entry.timeSeconds || 0)), text: entry.text }))
    : [];

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
        id: typeof task.id === "string" && task.id ? task.id : `${task.key}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
        key: task.key,
        label: definition.label,
        durationSeconds: duration,
        remainingSeconds: remaining,
        power: definition.power,
        status,
        review
      };
    });

  if (!state.ui || typeof state.ui !== "object") state.ui = { currentReportKey: null, currentView: "MAIN" };
  if (!["MAIN", "TIMELINE"].includes(state.ui.currentView)) state.ui.currentView = "MAIN";
  if (state.ui.currentReportKey && !REPORTS[state.ui.currentReportKey]) state.ui.currentReportKey = null;

  if (state.progression.systemDiagnosticsComplete && !state.timelineEntries.length) {
    state.timelineEntries.push({ timeSeconds: 0, text: "SYSTEM BOOT" });
  }

  syncDerivedState();
  const integrity = calculateSystemIntegrity();
  state.status.systemIntegrity = integrity === null ? 0 : integrity;
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
    if (state.progression.systemDiagnosticsComplete) startPowerCycle();
    if (state.progression.systemDiagnosticsComplete || state.runningTasks.length) startRuntimeClock();
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
