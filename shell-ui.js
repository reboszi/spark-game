const runningTasksBar = document.getElementById("runningTasksBar");
const navigationPanel = document.getElementById("navigationPanel");
const controlPanel = document.getElementById("controlPanel");
const controlContent = document.getElementById("controlContent");
const secondaryResourcesPanel = document.getElementById("secondaryResourcesPanel");
const secondaryResourcesContent = document.getElementById("secondaryResourcesContent");

let currentMainView = "MAIN";
let cachedMainHtml = "";

function systemTimeCard() {
  return `<div class="resource system-time-resource"><span class="resource-icon">◷</span><span class="resource-name">SYSTEM TIME</span><span class="resource-value">${formatSystemTime(state.systemTimeSeconds)}</span></div>`;
}

function addTimelineEntry(text, timeSeconds = state.systemTimeSeconds) {
  if (!state.timelineEntries.some(entry => entry.text === text)) {
    state.timelineEntries.push({ timeSeconds, text });
  }
}

function updateResources() {
  let html = "";
  if (state.revealed.systemTime) html += systemTimeCard();

  if (state.revealed.powerGeneration) {
    const req = hoveredRequirements.power;
    const available = getAvailableGeneration();
    const active = req !== null;
    const ok = !active || available >= req;
    const displayScale = state.actions.backupRestarted
      ? GAME_CONFIG.generationStart + GAME_CONFIG.backupGeneration
      : GAME_CONFIG.generationStart;
    html += resourceCard("⚡", "POWER GENERATION", `${available}`, available, Math.max(1, displayScale), `resource-power-generation ${active ? "requirement-active" : ""} ${ok ? "" : "requirement-insufficient"}`);
  }

  if (state.revealed.powerStorage) html += resourceCard("🔋", "POWER STORAGE", `${state.powerStorage} / ${state.powerStorageMax}`, state.powerStorage, state.powerStorageMax, "resource-power-storage");
  if (state.revealed.memory) html += resourceCard("◫", "MEMORY", `${state.memory} / ${state.memoryMax}`, state.memory, state.memoryMax, "resource-memory");

  if (state.revealed.processingPower) {
    const req = hoveredRequirements.processing;
    const active = req !== null;
    const ok = !active || state.processingPower >= req;
    html += resourceCard("◈", "PROCESSING POWER", `${state.processingPower} / ${state.processingPowerMax}`, state.processingPower, state.processingPowerMax, `resource-processing-power ${active ? "requirement-active" : ""} ${ok ? "" : "requirement-insufficient"}`);
  }

  resourcesEl.innerHTML = html;
  resourcesEl.classList.toggle("hidden", !html);
  systemScreen.classList.toggle("resources-visible", Boolean(html));
  updateButtons();
}

function taskProgress(task) {
  const duration = Math.max(1, Number(task.durationSeconds || TASK_DEFINITIONS[task.key]?.duration || task.remainingSeconds || 1));
  const remaining = Math.max(0, Number(task.remainingSeconds || 0));
  return Math.max(0, Math.min(100, ((duration - remaining) / duration) * 100));
}

function taskItemHtml(task) {
  if (task.status === "REVIEW") {
    return `<button class="taskbar-item taskbar-review" type="button" data-review-task="${task.id}"><span class="taskbar-label">${task.label}</span><strong>REVIEW</strong><span class="task-progress"><span style="width:100%"></span></span></button>`;
  }

  const statusClass = task.status === "PAUSED" ? " taskbar-paused" : "";
  const timeText = task.status === "PAUSED" ? "PAUSED" : formatCountdown(task.remainingSeconds);
  return `<div class="taskbar-item taskbar-task${statusClass}"><span class="taskbar-label">${task.label}</span><strong>${timeText}</strong><span class="task-progress"><span style="width:${taskProgress(task)}%"></span></span></div>`;
}

function updateTaskBar() {
  const unlocked = Boolean(state.progression.taskbarUnlocked);
  const items = [];

  if (state.progression.firstResetSeen) {
    if (state.controls.backupGeneratorOn) {
      items.push(`<div class="taskbar-item taskbar-reset taskbar-stable"><span>SYSTEM RESET</span><strong>PREVENTED</strong></div>`);
    } else {
      items.push(`<div class="taskbar-item taskbar-reset"><span>SYSTEM RESET</span><strong>${formatCountdown(state.resetCountdownSeconds)}</strong></div>`);
    }
  }

  for (const task of state.runningTasks || []) items.push(taskItemHtml(task));

  if (unlocked && items.length === 0) {
    items.push(`<div class="taskbar-empty">NO RUNNING TASKS</div>`);
  }

  runningTasksBar.innerHTML = items.join('<span class="taskbar-divider">|</span>');
  runningTasksBar.classList.toggle("hidden", !unlocked);
  systemScreen.classList.toggle("tasks-visible", unlocked);
}

function renderNavigation() {
  navigationPanel.classList.toggle("hidden", !state.progression.navigationUnlocked);
  if (!state.progression.navigationUnlocked) return;
  navigationPanel.innerHTML = `<button type="button" data-view="MAIN" class="nav-button ${currentMainView === "MAIN" ? "active" : ""}">MAIN</button><button type="button" data-view="TIMELINE" class="nav-button ${currentMainView === "TIMELINE" ? "active" : ""}">TIMELINE</button>`;
}

function renderTimeline() {
  const entries = [...state.timelineEntries].sort((a,b)=>a.timeSeconds-b.timeSeconds);
  terminal.innerHTML = `<div class="timeline-title">SYSTEM TIMELINE</div>${entries.map(entry=>`<div class="timeline-row"><span>${formatSystemTime(entry.timeSeconds)}</span><span>${entry.text}</span></div>`).join("")}`;
}

function switchMainView(view) {
  if (!state.progression.navigationUnlocked || view === currentMainView) return;
  if (currentMainView === "MAIN") cachedMainHtml = terminal.innerHTML;
  currentMainView = view;
  if (view === "TIMELINE") renderTimeline();
  if (view === "MAIN") terminal.innerHTML = cachedMainHtml || terminal.innerHTML;
  document.querySelectorAll(".action-panel, #primaryControls").forEach(el => el.classList.toggle("view-hidden", view !== "MAIN"));
  renderNavigation();
}

function renderControlPanel() {
  controlPanel.classList.toggle("hidden", !state.progression.controlPanelUnlocked);
  if (!state.progression.controlPanelUnlocked) return;
  const locked = !state.controls.backupGeneratorUnlocked;
  controlContent.innerHTML = `<div class="control-unit"><div class="control-label">BACKUP GENERATOR</div><button type="button" class="power-switch ${state.controls.backupGeneratorOn ? "on" : "off"} ${locked ? "locked" : ""}" data-control="backup" ${locked ? "disabled" : ""}><span class="switch-lever"></span><span class="switch-state">${locked ? "LOCKED" : state.controls.backupGeneratorOn ? "ON" : "OFF"}</span></button></div>`;
}

function renderSecondaryResources() {
  secondaryResourcesPanel.classList.toggle("hidden", !state.progression.secondaryResourcesUnlocked);
  if (!state.progression.secondaryResourcesUnlocked) return;
  secondaryResourcesContent.innerHTML = `<div class="secondary-resource-row"><span>HYDRAZINE</span><strong class="err">${state.secondaryResources.hydrazineKnown ? state.secondaryResources.hydrazineReserveHidden : "UNKNOWN"}</strong></div>`;
}

function refreshShellPanels() {
  updateTaskBar();
  renderNavigation();
  renderControlPanel();
  renderSecondaryResources();
}

runningTasksBar.addEventListener("click", event => {
  const reviewButton = event.target.closest("[data-review-task]");
  if (reviewButton) reviewTask(reviewButton.dataset.reviewTask);
});

navigationPanel.addEventListener("click", event => {
  const button = event.target.closest("[data-view]");
  if (button) switchMainView(button.dataset.view);
});

controlContent.addEventListener("click", event => {
  const button = event.target.closest('[data-control="backup"]');
  if (!button || !state.controls.backupGeneratorUnlocked) return;
  state.controls.backupGeneratorOn = !state.controls.backupGeneratorOn;
  state.status.backupPower = state.controls.backupGeneratorOn ? "ONLINE" : "STOPPED";
  addLogEntry(`Backup generator switched ${state.controls.backupGeneratorOn ? "on" : "off"}.`);
  if (!state.controls.backupGeneratorOn && state.powerGeneration <= 0 && state.powerStorage <= 0) void shutdownSystem();
  resumePausedTasks();
  updateResources();
  updateSystemStatus();
  updateTaskBar();
  renderControlPanel();
  saveGame();
});
