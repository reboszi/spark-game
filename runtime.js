let runtimeClockTimer = null;
let runtimeLastTickAt = null;

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

function resetSystemResetCountdown() {
  state.resetCountdownSeconds = Math.round((GAME_CONFIG.generationStart * GAME_CONFIG.generationTickMs) / 1000);
  updateTaskBar();
}

function tickBackupFuel(deltaSeconds) {
  if (!state.controls?.backupGeneratorOn) return;
  state.secondaryResources.hydrazineBurnSeconds += deltaSeconds;

  while (state.secondaryResources.hydrazineBurnSeconds >= GAME_CONFIG.hydrazineBurnIntervalSeconds && state.secondaryResources.hydrazineReserveHidden > 0) {
    state.secondaryResources.hydrazineBurnSeconds -= GAME_CONFIG.hydrazineBurnIntervalSeconds;
    state.secondaryResources.hydrazineReserveHidden = Math.max(0, state.secondaryResources.hydrazineReserveHidden - 1);
  }

  if (state.secondaryResources.hydrazineReserveHidden <= 0) {
    state.controls.backupGeneratorOn = false;
    state.status.backupPower = "STOPPED";
    addLogEntry("Backup generator stopped: hydrazine depleted.");
    refreshShellPanels();
    updateSystemStatus();
    pauseTasksForPower();
    if (state.powerGeneration <= 0 && state.powerStorage <= 0) void shutdownSystem();
  }
}

function processRuntimeElapsed(deltaSeconds) {
  const delta = Math.max(0, Number(deltaSeconds || 0));
  if (!delta) return;

  if (state.revealed.systemTime) state.systemTimeSeconds += delta;

  if (!state.isShuttingDown && state.powerGeneration > 0 && state.revealed.systemTime) {
    state.resetCountdownSeconds = Math.max(0, state.resetCountdownSeconds - delta);
  }

  if (!state.isShuttingDown) {
    tickBackupFuel(delta);
    tickTasks(delta);
  }
}

function runtimeTick() {
  const now = Date.now();
  if (runtimeLastTickAt === null) runtimeLastTickAt = now;
  const deltaSeconds = Math.max(0, (now - runtimeLastTickAt) / 1000);
  runtimeLastTickAt = now;

  processRuntimeElapsed(deltaSeconds);
  updateResources();
  updateTaskBar();
}

function startRuntimeClock() {
  if (runtimeClockTimer) return;
  runtimeLastTickAt = Date.now();
  runtimeClockTimer = setInterval(runtimeTick, 100);
}

function stopRuntimeClock() {
  if (!runtimeClockTimer) return;
  clearInterval(runtimeClockTimer);
  runtimeClockTimer = null;
  runtimeLastTickAt = null;
}

document.addEventListener("visibilitychange", () => {
  if (!runtimeClockTimer || document.hidden) return;
  runtimeTick();
});