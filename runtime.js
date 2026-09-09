let runtimeClockTimer = null;
let runtimeLastTickAt = null;
let backgroundPauseStartedAt = null;
let powerCycleActive = false;
let autosaveElapsedSeconds = 0;

function formatSystemTime(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds || 0));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(days).padStart(4, "0")}.${String(hours).padStart(2, "0")}.${String(minutes).padStart(2, "0")}.${String(secs).padStart(2, "0")}`;
}

function formatCountdown(totalSeconds) {
  const seconds = Math.max(0, Math.ceil(totalSeconds || 0));
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function formatAccumulatedTime(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function getExternalPowerCountdownSeconds() {
  if (state.powerGeneration <= 0) return 0;
  const tickSeconds = GAME_CONFIG.generationTickMs / 1000;
  return Math.max(0, state.powerGeneration * tickSeconds - state.powerGenerationTickProgressSeconds);
}

function resetSystemResetCountdown() {
  state.powerGenerationTickProgressSeconds = 0;
  state.externalRecoverySecondsRemaining = 0;
  updateTaskBar();
}

function tickBackupFuel(deltaSeconds, allowShutdown = true) {
  if (!state.controls.backupGeneratorOn) {
    state.secondaryResources.hydrazineTrend = "STABLE";
    return;
  }

  state.secondaryResources.hydrazineTrend = "DECREASING";
  state.secondaryResources.hydrazineBurnSeconds += deltaSeconds;

  while (
    state.secondaryResources.hydrazineBurnSeconds >= GAME_CONFIG.hydrazineBurnIntervalSeconds
    && state.secondaryResources.hydrazineReserveHidden > 0
  ) {
    state.secondaryResources.hydrazineBurnSeconds -= GAME_CONFIG.hydrazineBurnIntervalSeconds;
    state.secondaryResources.hydrazineReserveHidden = Math.max(0, state.secondaryResources.hydrazineReserveHidden - 1);
  }

  if (state.secondaryResources.hydrazineReserveHidden > 0) return;

  state.controls.backupGeneratorOn = false;
  state.secondaryResources.hydrazineTrend = "STABLE";
  state.status.backupPower = "STOPPED";
  addLogEntry("Backup generator stopped: hydrazine depleted.");
  pauseTasksForPower();

  if (allowShutdown && state.powerGeneration <= 0 && state.powerStorage <= 0) void shutdownSystem();
}

function startPowerCycle() {
  powerCycleActive = true;
}

function stopPowerCycle() {
  powerCycleActive = false;
}

function restoreExternalGenerationFromRuntime() {
  state.externalRecoverySecondsRemaining = 0;
  state.powerGeneration = GAME_CONFIG.generationStart;
  state.powerGenerationTickProgressSeconds = 0;
  addLogEntry("External power generation restored.");
  resumePausedTasks();
}

function tickExternalPower(deltaSeconds, allowShutdown = true) {
  if (!powerCycleActive || state.isShuttingDown || !state.progression.systemDiagnosticsComplete) return;

  if (state.powerGeneration <= 0) {
    if (state.controls.backupGeneratorOn || state.powerStorage > 0) {
      if (state.externalRecoverySecondsRemaining <= 0) {
        state.externalRecoverySecondsRemaining = GAME_CONFIG.standbyDurationMs / 1000;
      }
      state.externalRecoverySecondsRemaining = Math.max(0, state.externalRecoverySecondsRemaining - deltaSeconds);
      if (state.externalRecoverySecondsRemaining <= 0) restoreExternalGenerationFromRuntime();
      return;
    }

    if (allowShutdown) void shutdownSystem();
    return;
  }

  const tickSeconds = GAME_CONFIG.generationTickMs / 1000;
  state.powerGenerationTickProgressSeconds += deltaSeconds;

  while (state.powerGenerationTickProgressSeconds >= tickSeconds && state.powerGeneration > 0) {
    state.powerGenerationTickProgressSeconds -= tickSeconds;
    state.powerGeneration = Math.max(0, state.powerGeneration - 1);
    pauseTasksForPower();
  }

  if (state.powerGeneration > 0) return;

  state.powerGenerationTickProgressSeconds = 0;
  if (state.controls.backupGeneratorOn || state.powerStorage > 0) {
    state.externalRecoverySecondsRemaining = GAME_CONFIG.standbyDurationMs / 1000;
  } else if (allowShutdown) {
    void shutdownSystem();
  }
}

function advanceGameSimulation(deltaSeconds, { allowShutdown = true, autosave = true } = {}) {
  const delta = Math.max(0, Number(deltaSeconds || 0));
  if (!delta) return;

  if (state.revealed.systemTime) state.systemTimeSeconds += delta;
  if (state.isShuttingDown) return;

  tickExternalPower(delta, allowShutdown);
  if (state.isShuttingDown) return;

  tickBackupFuel(delta, allowShutdown);
  if (state.isShuttingDown) return;

  tickTasks(delta);

  if (!autosave) return;
  autosaveElapsedSeconds += delta;
  if (autosaveElapsedSeconds >= GAME_CONFIG.autosaveIntervalSeconds) {
    autosaveElapsedSeconds = 0;
    saveGame();
  }
}

function runtimeTick() {
  if (document.hidden) return;

  const now = Date.now();
  if (runtimeLastTickAt === null) runtimeLastTickAt = now;
  const deltaSeconds = Math.max(0, (now - runtimeLastTickAt) / 1000);
  runtimeLastTickAt = now;

  advanceGameSimulation(deltaSeconds);
  refreshDynamicUi();
}

function startRuntimeClock() {
  if (runtimeClockTimer || document.hidden) return;
  runtimeLastTickAt = Date.now();
  runtimeClockTimer = setInterval(runtimeTick, GAME_CONFIG.runtimeTickMs);
}

function stopRuntimeClock() {
  if (runtimeClockTimer) clearInterval(runtimeClockTimer);
  runtimeClockTimer = null;
  runtimeLastTickAt = null;
}

function beginBackgroundPause() {
  if (backgroundPauseStartedAt !== null) return;
  backgroundPauseStartedAt = Date.now();
  stopRuntimeClock();
  saveGame();
}

function endBackgroundPause() {
  if (backgroundPauseStartedAt !== null) {
    const elapsed = Math.max(0, (Date.now() - backgroundPauseStartedAt) / 1000);
    state.accumulatedTimeSeconds += elapsed;
    backgroundPauseStartedAt = null;
  }

  runtimeLastTickAt = Date.now();
  if (state.progression.systemDiagnosticsComplete || state.runningTasks.length) startRuntimeClock();
  refreshDynamicUi();
  if (typeof updateDebugPanel === "function") updateDebugPanel();
  saveGame();
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) beginBackgroundPause();
  else endBackgroundPause();
});

window.addEventListener("pagehide", () => {
  if (!document.hidden) saveGame();
});
