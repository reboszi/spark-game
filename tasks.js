const TASK_DEFINITIONS = {
  "system:diagnostics": { label: "SYSTEM DIAGNOSTICS", duration: 6, power: 0, review: false },
  "diag:memory": { label: "MEMORY DIAGNOSTICS", duration: 7, power: 2, review: true },
  "diag:power": { label: "POWER DIAGNOSTICS", duration: 7, power: 1, review: true },
  "diag:io": { label: "I/O DIAGNOSTICS", duration: 8, power: 2, review: true },
  "repair:memory": { label: "DEFRAGMENT MEMORY", duration: 5, power: 3, review: false },
  "repair:storage": { label: "RECOVER STORAGE", duration: 6, power: 2, review: false },
  "repair:archive01": { label: "RECOVER ARCHIVE 01", duration: 8, power: 2, review: true },
  "planned:processor": { label: "REINITIALIZE PROCESSOR CORE", duration: 8, power: 2, review: true },
  "planned:backup": { label: "RESTART BACKUP POWER", duration: 10, power: 3, review: true }
};

function taskByKey(key) {
  return state.runningTasks.find(task => task.key === key);
}

function getTotalGeneration() {
  const external = Math.max(0, Number(state.powerGeneration || 0));
  const backup = state.controls.backupGeneratorOn ? GAME_CONFIG.backupGeneration : 0;
  return external + backup;
}

function getReservedPower() {
  return state.runningTasks
    .filter(task => task.status === "RUNNING")
    .reduce((sum, task) => sum + Number(task.power || 0), 0);
}

function getAvailableGeneration() {
  return Math.max(0, getTotalGeneration() - getReservedPower());
}

function canReservePower(amount, excludeTaskId = null) {
  const reserved = state.runningTasks
    .filter(task => task.status === "RUNNING" && task.id !== excludeTaskId)
    .reduce((sum, task) => sum + Number(task.power || 0), 0);
  return getTotalGeneration() - reserved >= Number(amount || 0);
}

function startTask(key) {
  const definition = TASK_DEFINITIONS[key];
  if (!definition || taskByKey(key) || state.isShuttingDown) return false;
  if (!canReservePower(definition.power)) return false;

  state.runningTasks.push({
    id: `${key}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
    key,
    label: definition.label,
    durationSeconds: definition.duration,
    remainingSeconds: definition.duration,
    power: definition.power,
    status: "RUNNING",
    review: Boolean(definition.review)
  });

  state.progression.taskbarUnlocked = true;
  startRuntimeClock();
  addLogEntry(`Started ${definition.label.toLowerCase()}.`);
  refreshDynamicUi();
  saveGame();
  return true;
}

function pauseTasksForPower() {
  const running = state.runningTasks.filter(task => task.status === "RUNNING");
  let reserved = running.reduce((sum, task) => sum + Number(task.power || 0), 0);
  const totalGeneration = getTotalGeneration();
  let changed = false;

  // Pause newest work first when generation can no longer support everything.
  for (let i = running.length - 1; i >= 0 && reserved > totalGeneration; i--) {
    const task = running[i];
    task.status = "PAUSED";
    reserved -= Number(task.power || 0);
    changed = true;
    addLogEntry(`${task.label} paused: insufficient power.`);
  }
  return changed;
}

function resumePausedTasks() {
  let changed = false;
  for (const task of state.runningTasks) {
    if (task.status !== "PAUSED") continue;
    if (!canReservePower(task.power, task.id)) continue;
    task.status = "RUNNING";
    changed = true;
    addLogEntry(`${task.label} resumed.`);
  }
  return changed;
}

function removeTask(taskId) {
  state.runningTasks = state.runningTasks.filter(task => task.id !== taskId);
}

function finishTask(task, { refresh = true, persist = true } = {}) {
  if (!task) return false;
  task.remainingSeconds = 0;

  if (task.review) {
    task.status = "REVIEW";
    addLogEntry(`${task.label} complete. Report available.`);
  } else {
    applyTaskResult(task.key, true);
    removeTask(task.id);
  }

  resumePausedTasks();
  if (refresh) refreshGameUi();
  if (persist) saveGame();
  return true;
}

function reviewTask(taskId) {
  const task = state.runningTasks.find(item => item.id === taskId && item.status === "REVIEW");
  if (!task) return;

  const reportKey = task.key;
  state.ui.currentView = "MAIN";
  applyTaskResult(reportKey, false);
  removeTask(task.id);
  resumePausedTasks();
  refreshGameUi();
  saveGame();

  if (REPORTS[reportKey]) void renderReport(reportKey, true);
}

function tickTasks(deltaSeconds = 1) {
  pauseTasksForPower();

  const completed = [];
  for (const task of state.runningTasks) {
    if (task.status !== "RUNNING") continue;
    task.remainingSeconds = Math.max(0, Number(task.remainingSeconds || 0) - deltaSeconds);
    if (task.remainingSeconds <= 0) completed.push(task);
  }

  if (!completed.length) return;

  for (const task of completed) {
    finishTask(task, { refresh: false, persist: false });
  }
  refreshGameUi();
  saveGame();
}
