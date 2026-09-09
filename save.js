const SAVE_KEY = "spark-game-save-v1";
const SAVE_VERSION = 6;

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

  // Runtime/transient state is never persisted.
  delete snapshot.isBusy;
  delete snapshot.isShuttingDown;

  // Derived values are reconstructed from canonical state/config.
  delete snapshot.powerGenerationMax;
  if (snapshot.status) {
    delete snapshot.status.systemIntegrity;
    delete snapshot.status.memoryIntegrity;
  }

  return snapshot;
}

function normalizeLoadedState() {
  state.isBusy = false;
  state.isShuttingDown = false;
  state.powerGenerationMax = GAME_CONFIG.generationStart;
  state.status.memoryIntegrity = Math.round((state.memory / state.memoryMax) * 100);
  const integrity = calculateSystemIntegrity();
  state.status.systemIntegrity = integrity === null ? 0 : integrity;

  if (state.status.backupPower === "RESTART REQUIRED") state.status.backupPower = "STOPPED";
  if (state.progression.systemDiagnosticsComplete) state.revealed.systemTime = true;
  if (state.progression.systemDiagnosticsComplete || state.runningTasks.length) state.progression.taskbarUnlocked = true;
  if (state.progression.firstResetSeen) state.progression.navigationUnlocked = true;
  if (state.diagnostics.power) state.progression.controlPanelUnlocked = true;
  if (state.actions.archive01Repaired) state.progression.processorArrayKnown = true;

  if (state.actions.backupRestarted) {
    state.controls.backupGeneratorUnlocked = true;
    state.progression.secondaryResourcesUnlocked = true;
    if (state.controls.backupGeneratorOn) state.status.backupPower = "ONLINE";
  }

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
  localStorage.setItem(SAVE_KEY, JSON.stringify(buildSavePayload()));
}

function importStatePayload(payload) {
  if (!payload || typeof payload !== "object" || !payload.state) return false;

  resetStateToDefaults();
  mergeState(state, payload.state);

  // Legacy saves stored the Main Screen as HTML. Convert it once to a report id.
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

    // Any legacy/older payload is immediately rewritten in canonical v6 form.
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
  renderCurrentMainScreen();

  if (state.progression.systemDiagnosticsComplete || state.runningTasks.length) startRuntimeClock();
  if (state.progression.systemDiagnosticsComplete) startPowerCycle();
}

function restoreSavedGame() {
  if (!loadSaveGame()) {
    configureStartMenu();
    return;
  }
  restoreLoadedStateToScreen();
}

function startNewGame() {
  deleteSaveGame();
  window.location.reload();
}
