const TASK_DEFINITIONS = {
  "system:diagnostics": { label: "SYSTEM DIAGNOSTICS", duration: 6, power: 0, review: true },
  "diag:memory": { label: "MEMORY DIAGNOSTICS", duration: 7, power: 2, review: true },
  "diag:power": { label: "POWER DIAGNOSTICS", duration: 7, power: 1, review: true },
  "diag:io": { label: "I/O DIAGNOSTICS", duration: 8, power: 2, review: true },
  "repair:memory": { label: "DEFRAGMENT MEMORY", duration: 5, power: 3, review: false },
  "repair:storage": { label: "RECOVER STORAGE", duration: 6, power: 2, review: false },
  "repair:archive01": { label: "RECOVER ARCHIVE 01", duration: 8, power: 2, review: true },
  "planned:backup": { label: "RESTART BACKUP POWER", duration: 10, power: 3, review: true }
};

function taskByKey(key) {
  return (state.runningTasks || []).find(task => task.key === key);
}

function getReservedPower() {
  return (state.runningTasks || [])
    .filter(task => task.status === "RUNNING")
    .reduce((sum, task) => sum + Number(task.power || 0), 0);
}

function getAvailableGeneration() {
  return Math.max(0, state.powerGeneration - getReservedPower());
}

function canReservePower(amount, excludeTaskId = null) {
  const reserved = (state.runningTasks || [])
    .filter(task => task.status === "RUNNING" && task.id !== excludeTaskId)
    .reduce((sum, task) => sum + Number(task.power || 0), 0);
  return state.powerGeneration - reserved >= Number(amount || 0);
}

function startTask(key) {
  const definition = TASK_DEFINITIONS[key];
  if (!definition || taskByKey(key) || state.isShuttingDown) return false;
  if (!canReservePower(definition.power)) return false;

  const task = {
    id: `${key}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
    key,
    label: definition.label,
    remainingSeconds: definition.duration,
    power: definition.power,
    status: "RUNNING",
    review: Boolean(definition.review)
  };

  state.runningTasks.push(task);
  startRuntimeClock();
  addLogEntry(`Started ${definition.label.toLowerCase()}.`);
  updateResources();
  updateTaskBar();
  updateButtons();
  saveGame();
  return true;
}

function pauseTasksForPower() {
  const running = (state.runningTasks || []).filter(task => task.status === "RUNNING");
  let reserved = running.reduce((sum, task) => sum + Number(task.power || 0), 0);

  for (let i = running.length - 1; i >= 0 && reserved > state.powerGeneration; i--) {
    const task = running[i];
    task.status = "PAUSED";
    reserved -= Number(task.power || 0);
    addLogEntry(`${task.label} paused: insufficient power.`);
  }
}

function resumePausedTasks() {
  for (const task of state.runningTasks || []) {
    if (task.status !== "PAUSED") continue;
    if (!canReservePower(task.power, task.id)) continue;
    task.status = "RUNNING";
    addLogEntry(`${task.label} resumed.`);
  }
  updateResources();
  updateTaskBar();
  updateButtons();
}

function finishTask(task) {
  if (!task) return;
  task.remainingSeconds = 0;

  if (task.review && state.progression.firstResetSeen) {
    task.status = "REVIEW";
    addLogEntry(`${task.label} complete. Review available.`);
  } else {
    applyTaskResult(task.key);
    removeTask(task.id);
  }

  updateResources();
  updateTaskBar();
  updateButtons();
  saveGame();
}

function removeTask(taskId) {
  state.runningTasks = (state.runningTasks || []).filter(task => task.id !== taskId);
}

function reviewTask(taskId) {
  const task = (state.runningTasks || []).find(item => item.id === taskId && item.status === "REVIEW");
  if (!task) return;
  applyTaskResult(task.key);
  removeTask(task.id);
  updateResources();
  updateTaskBar();
  updateButtons();
  saveGame();
}

function tickTasks() {
  pauseTasksForPower();

  const completed = [];
  for (const task of state.runningTasks || []) {
    if (task.status !== "RUNNING") continue;
    task.remainingSeconds = Math.max(0, Number(task.remainingSeconds || 0) - 1);
    if (task.remainingSeconds <= 0) completed.push(task);
  }

  for (const task of completed) finishTask(task);
  if (!completed.length) updateTaskBar();
}
