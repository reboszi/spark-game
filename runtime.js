let runtimeClockTimer = null;

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

function startRuntimeClock() {
  if (runtimeClockTimer) return;

  runtimeClockTimer = setInterval(() => {
    if (state.revealed.systemTime) {
      state.systemTimeSeconds += 1;
    }

    if (!state.isShuttingDown && state.powerGeneration > 0) {
      if (state.revealed.systemTime) {
        state.resetCountdownSeconds = Math.max(0, state.resetCountdownSeconds - 1);
      }
      tickTasks();
    }

    updateResources();
    updateTaskBar();
  }, 1000);
}

function stopRuntimeClock() {
  if (!runtimeClockTimer) return;
  clearInterval(runtimeClockTimer);
  runtimeClockTimer = null;
}
