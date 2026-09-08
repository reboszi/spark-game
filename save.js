const SAVE_KEY = "spark-game-save-v1";

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

function migrateSavedScreenHtml(html) {
  return (html || "")
    .replace(/Required interface\s*\.*\s*REPAIR DRONE/g, "Required ..................... REPAIR DRONE")
    .replace(/Source identification\s*\.*\s*UNKNOWN/g, "Source ......................... UNKNOWN")
    .replace(/Source\s*\.*\s*UNKNOWN/g, "Source ......................... UNKNOWN");
}

function saveGame() {
  if (!state.progression.hasBooted) return;

  const savedState = JSON.parse(JSON.stringify(state));
  savedState.isBusy = false;
  savedState.isShuttingDown = false;

  const payload = {
    version: 4,
    savedAt: Date.now(),
    state: savedState,
    mainScreenHtml: terminal.innerHTML
  };

  localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
}

function loadSaveGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return false;

  try {
    const payload = JSON.parse(raw);
    mergeState(state, payload.state);
    state.isBusy = false;
    state.isShuttingDown = false;

    let migrated = false;

    if (state.status.backupPower === "RESTART REQUIRED") {
      state.status.backupPower = "STOPPED";
      migrated = true;
    }

    if (state.progression.systemDiagnosticsComplete && !state.revealed.systemTime) {
      state.revealed.systemTime = true;
      migrated = true;
    }

    if ((state.progression.systemDiagnosticsComplete || state.runningTasks.length) && !state.progression.taskbarUnlocked) {
      state.progression.taskbarUnlocked = true;
      migrated = true;
    }

    for (const task of state.runningTasks || []) {
      if (!task.durationSeconds) {
        task.durationSeconds = TASK_DEFINITIONS[task.key]?.duration || Math.max(1, Number(task.remainingSeconds || 1));
        migrated = true;
      }
    }

    if (state.progression.systemDiagnosticsComplete && !state.timelineEntries.length) {
      state.timelineEntries.push({ timeSeconds: 0, text: "SYSTEM BOOT" });
      migrated = true;
    }

    if (state.progression.firstResetSeen && !state.progression.navigationUnlocked) {
      state.progression.navigationUnlocked = true;
      migrated = true;
    }

    if (state.diagnostics.power && !state.progression.controlPanelUnlocked) {
      state.progression.controlPanelUnlocked = true;
      migrated = true;
    }

    if (state.actions.archive01Repaired && !state.progression.processorArrayKnown) {
      state.progression.processorArrayKnown = true;
      migrated = true;
    }

    if (state.actions.backupRestarted) {
      state.controls.backupGeneratorUnlocked = true;
      state.progression.secondaryResourcesUnlocked = true;
      if (state.status.backupPower !== "ONLINE" && state.controls.backupGeneratorOn) state.status.backupPower = "ONLINE";
      migrated = true;
    }

    const originalHtml = payload.mainScreenHtml || "";
    const migratedHtml = migrateSavedScreenHtml(originalHtml);
    terminal.innerHTML = migratedHtml;

    if (migratedHtml !== originalHtml) {
      payload.mainScreenHtml = migratedHtml;
      migrated = true;
    }

    if (migrated) {
      payload.version = 4;
      payload.state = JSON.parse(JSON.stringify(state));
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
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

function restoreSavedGame() {
  if (!loadSaveGame()) {
    configureStartMenu();
    return;
  }

  bootScreen.classList.add("hidden");
  standbyScreen.classList.add("hidden");
  systemScreen.classList.remove("hidden");

  if (getTotalGeneration() <= 0 && state.powerStorage <= 0) {
    state.powerGeneration = GAME_CONFIG.generationStart;
    resetSystemResetCountdown();
  }

  refreshInterfaceFromState();
  refreshShellPanels();

  if (state.progression.systemDiagnosticsComplete || state.runningTasks.length) {
    startRuntimeClock();
  }
  if (state.progression.systemDiagnosticsComplete) {
    startPowerCycle();
  }
}

function startNewGame() {
  deleteSaveGame();
  window.location.reload();
}
