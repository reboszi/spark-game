let debugSessionActive = false;

const DEBUG_PRESETS = {
  BOOT: () => {
    applyBaseBoot();
    state.ui.currentReportKey = null;
    state.ui.currentView = "MAIN";
  },
  POST_SYSTEM_DIAGNOSTICS: () => {
    applyBaseSystemDiagnostics();
    state.ui.currentReportKey = "system:diagnostics";
  },
  FIRST_RESET: () => {
    applyBaseSystemDiagnostics();
    applyFirstReset();
    state.ui.currentReportKey = "system:diagnostics";
  },
  BASIC_DIAGNOSTICS: () => {
    applyBaseSystemDiagnostics();
    applyFirstReset();
    applyBasicDiagnostics();
    state.ui.currentReportKey = "diag:io";
  },
  ARCHIVE_01_AVAILABLE: () => {
    applyBaseSystemDiagnostics();
    applyFirstReset();
    applyBasicDiagnostics();
    state.ui.currentReportKey = "diag:memory";
  },
  ARCHIVE_01_RECOVERED: () => {
    applyBaseSystemDiagnostics();
    applyFirstReset();
    applyBasicDiagnostics();
    state.actions.archive01Repaired = true;
    state.memory = Math.max(state.memory, 9);
    addTimelineEntry("DATA ARCHIVE 01 RECOVERED", 240);
    state.ui.currentReportKey = "repair:archive01";
  },
  PROCESSOR_CORE_02_ONLINE: () => {
    DEBUG_PRESETS.ARCHIVE_01_RECOVERED();
    state.actions.processorCore02Online = true;
    state.processingPower = 2;
    addTimelineEntry("PROCESSOR CORE 02 ONLINE", 300);
    state.ui.currentReportKey = "planned:processor";
  },
  BACKUP_POWER_READY: () => {
    DEBUG_PRESETS.PROCESSOR_CORE_02_ONLINE();
    state.controls.backupGeneratorOn = false;
    state.actions.backupRestarted = false;
    state.powerGeneration = 6;
    state.ui.currentReportKey = "planned:processor";
  },
  BACKUP_POWER_ONLINE: () => {
    DEBUG_PRESETS.PROCESSOR_CORE_02_ONLINE();
    state.actions.backupRestarted = true;
    state.controls.backupGeneratorOn = true;
    addTimelineEntry("BACKUP POWER RESTORED", 360);
    state.ui.currentReportKey = "planned:backup";
  }
};

function applyBaseBoot() {
  state.progression.hasBooted = true;
  state.logEntries = ["Debug state loaded."];
  state.ui.currentView = "MAIN";
}

function applyBaseSystemDiagnostics() {
  applyBaseBoot();
  state.progression.systemDiagnosticsComplete = true;
  state.revealed.systemTime = true;
  state.revealed.powerGeneration = true;
  state.revealed.processingPower = true;
  state.statusRevealed.operatingSystem = true;
  state.statusRevealed.emergencyPower = true;
  state.timelineEntries = [{ timeSeconds: 0, text: "SYSTEM BOOT" }];
  state.systemTimeSeconds = 120;
}

function applyFirstReset() {
  state.progression.firstResetSeen = true;
  addTimelineEntry("FIRST SYSTEM RESET", 180);
  state.systemTimeSeconds = 200;
}

function applyBasicDiagnostics() {
  state.diagnostics.memory = true;
  state.diagnostics.power = true;
  state.diagnostics.io = true;
  state.revealed.memory = true;
  state.revealed.powerStorage = true;
  state.statusRevealed.storageRecovered = true;
  state.statusRevealed.archive01 = true;
  state.statusRevealed.primaryPower = true;
  state.statusRevealed.backupPower = true;
  state.statusRevealed.sensors = true;
  state.statusRevealed.manipulators = true;
  state.statusRevealed.communications = true;
  state.statusRevealed.unknownInterfaces = true;
  state.statusRevealed.systemIntegrity = true;
}

function stopGameTimersForDebug() {
  stopRuntimeClock();
  stopPowerCycle();
  if (externalRecoveryTimer) {
    clearTimeout(externalRecoveryTimer);
    externalRecoveryTimer = null;
  }
  state.isShuttingDown = false;
}

function refreshDebugStateScreen() {
  normalizeLoadedState();
  bootScreen.classList.add("hidden");
  standbyScreen.classList.add("hidden");
  systemScreen.classList.remove("hidden");
  refreshInterfaceFromState();
  refreshShellPanels();
  applyCurrentView();
  updateDebugPanel();
}

function jumpToDebugPreset(name) {
  const preset = DEBUG_PRESETS[name];
  if (!preset) return;
  debugSessionActive = true;
  stopGameTimersForDebug();
  resetStateToDefaults();
  preset();
  refreshDebugStateScreen();
}

function debugAdvanceTime(seconds) {
  const amount = Math.max(0, Math.floor(Number(seconds || 0)));
  if (!amount) return;
  debugSessionActive = true;
  stopGameTimersForDebug();

  for (let second = 1; second <= amount; second++) {
    state.systemTimeSeconds += 1;
    state.resetCountdownSeconds = Math.max(0, state.resetCountdownSeconds - 1);
    tickTasks(1);
    tickBackupFuel(1);

    if (second % Math.round(GAME_CONFIG.generationTickMs / 1000) === 0 && state.powerGeneration > 0) {
      state.powerGeneration = Math.max(0, state.powerGeneration - 1);
      pauseTasksForPower();
    }
  }

  refreshDebugStateScreen();
}

function debugForceExternalPowerLoss() {
  debugSessionActive = true;
  stopGameTimersForDebug();
  state.powerGeneration = 0;
  state.resetCountdownSeconds = 0;
  pauseTasksForPower();
  refreshDebugStateScreen();
}

function debugStartNewPowerCycle() {
  debugSessionActive = true;
  stopGameTimersForDebug();
  state.powerGeneration = GAME_CONFIG.generationStart;
  resetSystemResetCountdown();
  resumePausedTasks();
  refreshDebugStateScreen();
}

function debugCompleteTask(taskId) {
  const task = (state.runningTasks || []).find(item => item.id === taskId);
  if (!task) return;
  task.remainingSeconds = 0;
  finishTask(task);
  refreshDebugStateScreen();
}

function debugToggleTask(taskId) {
  const task = (state.runningTasks || []).find(item => item.id === taskId);
  if (!task || task.status === "REVIEW") return;
  task.status = task.status === "PAUSED" ? "RUNNING" : "PAUSED";
  refreshDebugStateScreen();
}

function debugCompleteAllTasks() {
  for (const task of [...(state.runningTasks || [])]) {
    task.remainingSeconds = 0;
    finishTask(task);
  }
  refreshDebugStateScreen();
}

function exportDebugSnapshot() {
  const text = JSON.stringify(buildSavePayload(), null, 2);
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).catch(()=>{});
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `spark-debug-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importDebugSnapshot() {
  const raw = window.prompt("Paste SPARK save/debug JSON:");
  if (!raw) return;
  try {
    const payload = JSON.parse(raw);
    debugSessionActive = true;
    stopGameTimersForDebug();
    if (!importStatePayload(payload)) throw new Error("Invalid payload");
    refreshDebugStateScreen();
  } catch (error) {
    window.alert("Could not import snapshot.");
    console.error(error);
  }
}

function updateDebugPanel() {
  const panel = document.getElementById("debugPanel");
  if (!panel || panel.classList.contains("hidden")) return;

  const headerInfo = panel.querySelector(".debug-header span");
  if (headerInfo) headerInfo.textContent = `ACC ${formatAccumulatedTime(state.accumulatedTimeSeconds)} · Ctrl+Shift+D`;

  const tasks = state.runningTasks || [];
  const taskList = document.getElementById("debugTaskList");
  taskList.innerHTML = tasks.length
    ? tasks.map(task => `<div class="debug-task-row"><span>${task.label}</span><span>${task.status} ${formatCountdown(task.remainingSeconds)}</span><button data-debug-complete-task="${task.id}">COMPLETE</button><button data-debug-toggle-task="${task.id}">${task.status === "PAUSED" ? "RESUME" : "PAUSE"}</button></div>`).join("")
    : `<div class="debug-empty">NO TASKS</div>`;
}

function setDebugPanelVisible(visible) {
  const panel = document.getElementById("debugPanel");
  if (!panel) return;
  panel.classList.toggle("hidden", !visible);
  if (visible) updateDebugPanel();
}

function initDebugTools() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("debug") === "1") setDebugPanelVisible(true);

  document.addEventListener("keydown", event => {
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "d") {
      const panel = document.getElementById("debugPanel");
      setDebugPanelVisible(panel.classList.contains("hidden"));
    }
  });

  document.getElementById("debugPanel")?.addEventListener("click", event => {
    const jump = event.target.closest("[data-debug-jump]");
    if (jump) jumpToDebugPreset(jump.dataset.debugJump);

    const advance = event.target.closest("[data-debug-advance]");
    if (advance) debugAdvanceTime(Number(advance.dataset.debugAdvance));

    if (event.target.closest("[data-debug-force-loss]")) debugForceExternalPowerLoss();
    if (event.target.closest("[data-debug-new-cycle]")) debugStartNewPowerCycle();
    if (event.target.closest("[data-debug-complete-all]")) debugCompleteAllTasks();
    if (event.target.closest("[data-debug-export]")) exportDebugSnapshot();
    if (event.target.closest("[data-debug-import]")) importDebugSnapshot();
    if (event.target.closest("[data-debug-delete-save]")) { deleteSaveGame(); configureStartMenu(); }

    const complete = event.target.closest("[data-debug-complete-task]");
    if (complete) debugCompleteTask(complete.dataset.debugCompleteTask);

    const toggle = event.target.closest("[data-debug-toggle-task]");
    if (toggle) debugToggleTask(toggle.dataset.debugToggleTask);
  });
}

initDebugTools();
