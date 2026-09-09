// Compatibility layer: game.js historically owned separate power timers.
// Keep its public entry points, but route them into the unified active-time runtime.
startPowerCycle = function () {
  powerCycleActive = true;
};

stopPowerCycle = function () {
  powerCycleActive = false;
};

scheduleExternalGenerationRestore = function () {
  if (state.externalRecoverySecondsRemaining <= 0) {
    state.externalRecoverySecondsRemaining = GAME_CONFIG.standbyDurationMs / 1000;
  }
};

restoreExternalGeneration = function () {
  restoreExternalGenerationFromRuntime();
};
