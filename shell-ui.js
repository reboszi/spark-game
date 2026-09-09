const runningTasksBar = document.getElementById("runningTasksBar");
const navigationPanel = document.getElementById("navigationPanel");
const workspaceEl = document.getElementById("workspace");
const actionArea = workspaceEl.querySelector(".action-area");
const controlPanel = document.getElementById("controlPanel");
const controlContent = document.getElementById("controlContent");
const secondaryResourcesPanel = document.getElementById("secondaryResourcesPanel");
const secondaryResourcesContent = document.getElementById("secondaryResourcesContent");

let resourcesRenderCache = null;
let taskbarStructureCache = null;
let navigationRenderCache = null;
let controlRenderCache = null;
let secondaryResourcesRenderCache = null;

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
    html += resourceCard(
      "⚡",
      "POWER GENERATION",
      `${available}`,
      available,
      Math.max(1, displayScale),
      `resource-power-generation ${active ? "requirement-active" : ""} ${ok ? "" : "requirement-insufficient"}`
    );
  }

  if (state.revealed.powerStorage) {
    html += resourceCard("🔋", "POWER STORAGE", `${state.powerStorage} / ${state.powerStorageMax}`, state.powerStorage, state.powerStorageMax, "resource-power-storage");
  }
  if (state.revealed.memory) {
    html += resourceCard("◫", "MEMORY", `${state.memory} / ${state.memoryMax}`, state.memory, state.memoryMax, "resource-memory");
  }
  if (state.revealed.processingPower) {
    const req = hoveredRequirements.processing;
    const active = req !== null;
    const ok = !active || state.processingPower >= req;
    html += resourceCard(
      "◈",
      "PROCESSING POWER",
      `${state.processingPower} / ${state.processingPowerMax}`,
      state.processingPower,
      state.processingPowerMax,
      `resource-processing-power ${active ? "requirement-active" : ""} ${ok ? "" : "requirement-insufficient"}`
    );
  }

  if (html !== resourcesRenderCache) {
    resourcesEl.innerHTML = html;
    resourcesRenderCache = html;
  }
  resourcesEl.classList.toggle("hidden", !html);
  systemScreen.classList.toggle("resources-visible", Boolean(html));
}

function taskProgress(task) {
  const duration = Math.max(1, Number(task.durationSeconds || TASK_DEFINITIONS[task.key]?.duration || task.remainingSeconds || 1));
  const remaining = Math.max(0, Number(task.remainingSeconds || 0));
  return Math.max(0, Math.min(100, ((duration - remaining) / duration) * 100));
}

function taskItemHtml(task) {
  if (task.status === "REVIEW") {
    return `<button class="taskbar-item taskbar-review" type="button" data-task-id="${task.id}" data-review-task="${task.id}"><span class="taskbar-label">${task.label}</span><strong>REPORT</strong><span class="task-progress"><span style="width:100%"></span></span></button>`;
  }

  const statusClass = task.status === "PAUSED" ? " taskbar-paused" : "";
  return `<div class="taskbar-item taskbar-task${statusClass}" data-task-id="${task.id}"><span class="taskbar-label">${task.label}</span><strong></strong><span class="task-progress"><span></span></span></div>`;
}

function taskbarStructureSignature(unlocked) {
  const resetMode = !state.progression.firstResetSeen
    ? "NO_RESET"
    : state.controls.backupGeneratorOn
      ? "RESET_PREVENTED"
      : "RESET_COUNTDOWN";
  const tasks = state.runningTasks.map(task => `${task.id}:${task.status}`).join("|");
  return `${unlocked}:${resetMode}:${tasks}`;
}

function renderTaskbarStructure(unlocked) {
  const items = [];
  if (state.progression.firstResetSeen) {
    if (state.controls.backupGeneratorOn) {
      items.push(`<div class="taskbar-item taskbar-reset taskbar-stable" data-reset-indicator><span>SYSTEM RESET</span><strong>PREVENTED</strong></div>`);
    } else {
      items.push(`<div class="taskbar-item taskbar-reset" data-reset-indicator><span>SYSTEM RESET</span><strong></strong></div>`);
    }
  }

  for (const task of state.runningTasks) items.push(taskItemHtml(task));
  if (unlocked && items.length === 0) items.push(`<div class="taskbar-empty">NO RUNNING TASKS</div>`);
  runningTasksBar.innerHTML = items.join('<span class="taskbar-divider">|</span>');
}

function updateTaskBar() {
  const unlocked = Boolean(state.progression.taskbarUnlocked);
  const signature = taskbarStructureSignature(unlocked);
  if (signature !== taskbarStructureCache) {
    renderTaskbarStructure(unlocked);
    taskbarStructureCache = signature;
  }

  const resetIndicator = runningTasksBar.querySelector("[data-reset-indicator]");
  if (resetIndicator && !state.controls.backupGeneratorOn) {
    const value = resetIndicator.querySelector("strong");
    if (value) value.textContent = formatCountdown(getExternalPowerCountdownSeconds());
  }

  const taskElements = new Map(
    [...runningTasksBar.querySelectorAll("[data-task-id]")]
      .map(element => [element.dataset.taskId, element])
  );
  for (const task of state.runningTasks) {
    if (task.status === "REVIEW") continue;
    const element = taskElements.get(task.id);
    if (!element) continue;
    const time = element.querySelector("strong");
    if (time) time.textContent = task.status === "PAUSED" ? "PAUSED" : formatCountdown(task.remainingSeconds);
    const progress = element.querySelector(".task-progress > span");
    if (progress) progress.style.width = `${taskProgress(task)}%`;
  }

  runningTasksBar.classList.toggle("hidden", !unlocked);
  systemScreen.classList.toggle("tasks-visible", unlocked);
  if (typeof updateDebugPanel === "function") updateDebugPanel();
}

function renderNavigation() {
  const unlocked = Boolean(state.progression.navigationUnlocked);
  navigationPanel.classList.toggle("hidden", !unlocked);
  const currentView = state.ui.currentView || "MAIN";
  const signature = `${unlocked}:${currentView}`;
  if (signature === navigationRenderCache) return;

  navigationPanel.innerHTML = unlocked
    ? `<button type="button" data-view="MAIN" class="nav-button ${currentView === "MAIN" ? "active" : ""}">MAIN</button><button type="button" data-view="TIMELINE" class="nav-button ${currentView === "TIMELINE" ? "active" : ""}">TIMELINE</button>`
    : "";
  navigationRenderCache = signature;
}

function renderTimeline() {
  const entries = [...state.timelineEntries].sort((a, b) => a.timeSeconds - b.timeSeconds);
  terminal.innerHTML = `<div class="timeline-title">SYSTEM TIMELINE</div>${entries
    .map(entry => `<div class="timeline-row"><span>${formatSystemTime(entry.timeSeconds)}</span><span>${entry.text}</span></div>`)
    .join("")}`;
}

function updateWorkspaceLayout() {
  const controlVisible = !controlPanel.classList.contains("hidden");
  const secondaryVisible = !secondaryResourcesPanel.classList.contains("hidden");
  const mainView = (state.ui.currentView || "MAIN") === "MAIN";
  const actionVisible = mainView && [...actionArea.querySelectorAll(".action-panel")]
    .some(panel => !panel.classList.contains("hidden"));

  workspaceEl.classList.toggle("control-collapsed", !controlVisible);
  workspaceEl.classList.toggle("resources-collapsed", !secondaryVisible);
  workspaceEl.classList.toggle("actions-collapsed", !actionVisible);
}

function applyCurrentView() {
  const view = state.ui.currentView || "MAIN";
  if (view === "TIMELINE" && state.progression.navigationUnlocked) renderTimeline();
  else renderCurrentMainScreen();

  document.querySelectorAll(".action-panel, #primaryControls")
    .forEach(el => el.classList.toggle("view-hidden", view !== "MAIN"));
  renderNavigation();
  updateWorkspaceLayout();
}

function switchMainView(view) {
  if (!state.progression.navigationUnlocked || view === state.ui.currentView) return;
  state.ui.currentView = view;
  applyCurrentView();
  saveGame();
}

function renderControlPanel() {
  const visible = Boolean(state.progression.controlPanelUnlocked);
  controlPanel.classList.toggle("hidden", !visible);
  const locked = !state.controls.backupGeneratorUnlocked;
  const on = Boolean(state.controls.backupGeneratorOn);
  const signature = `${visible}:${locked}:${on}`;
  if (signature === controlRenderCache) return;

  const switchState = locked ? "LOCKED" : on ? "ON" : "OFF";
  controlContent.innerHTML = visible
    ? `<div class="control-unit">
        <div class="control-label">BACKUP GENERATOR</div>
        <button type="button" class="power-switch ${on ? "on" : "off"} ${locked ? "locked" : ""}" data-control="backup" aria-pressed="${on}" aria-label="Backup generator: ${switchState}" ${locked ? "disabled" : ""}>
          <span class="switch-plate" aria-hidden="true">
            <span class="switch-label switch-label-on">ON</span>
            <span class="switch-slot"></span>
            <span class="switch-handle"><span class="switch-grip"></span></span>
            <span class="switch-label switch-label-off">OFF</span>
          </span>
          <span class="switch-state">${switchState}</span>
        </button>
      </div>`
    : "";
  controlRenderCache = signature;
}

function renderSecondaryResources() {
  const visible = Boolean(state.progression.secondaryResourcesUnlocked);
  secondaryResourcesPanel.classList.toggle("hidden", !visible);
  if (!visible) {
    if (secondaryResourcesRenderCache !== "") secondaryResourcesContent.innerHTML = "";
    secondaryResourcesRenderCache = "";
    return;
  }

  const trend = state.secondaryResources.hydrazineTrend || "STABLE";
  const trendClass = trend === "INCREASING" ? "resource-trend-up" : trend === "DECREASING" ? "resource-trend-down" : "resource-trend-stable";
  const trendIcon = trend === "INCREASING" ? "↑" : trend === "DECREASING" ? "↓" : "·";
  const value = state.secondaryResources.hydrazineKnown ? state.secondaryResources.hydrazineReserveHidden : "UNKNOWN";
  const valueClass = state.secondaryResources.hydrazineKnown ? "" : "err";
  const html = `<div class="secondary-resource-row ${trendClass}"><span class="secondary-resource-name"><span class="resource-trend-icon">${trendIcon}</span> HYDRAZINE</span><strong class="${valueClass}">${value}</strong></div>`;

  if (html !== secondaryResourcesRenderCache) {
    secondaryResourcesContent.innerHTML = html;
    secondaryResourcesRenderCache = html;
  }
}

function refreshShellPanels() {
  updateTaskBar();
  renderNavigation();
  renderControlPanel();
  renderSecondaryResources();
  updateWorkspaceLayout();
}

function refreshDynamicUi() {
  updateResources();
  updateTaskBar();
  renderSecondaryResources();
  updateButtons();
}

function refreshGameUi() {
  refreshDiagnosticButtons();
  refreshActionUnlocks();
  updateSystemStatus();
  renderActivityLog();
  refreshShellPanels();
  updateResources();
  updateButtons();
}

runningTasksBar.addEventListener("pointerdown", event => {
  const reviewButton = event.target.closest("[data-review-task]");
  if (!reviewButton) return;
  event.preventDefault();
  reviewTask(reviewButton.dataset.reviewTask);
});

navigationPanel.addEventListener("click", event => {
  const button = event.target.closest("[data-view]");
  if (button) switchMainView(button.dataset.view);
});

controlContent.addEventListener("click", event => {
  const button = event.target.closest('[data-control="backup"]');
  if (!button || !state.controls.backupGeneratorUnlocked) return;

  state.controls.backupGeneratorOn = !state.controls.backupGeneratorOn;
  syncDerivedState();
  addLogEntry(`Backup generator switched ${state.controls.backupGeneratorOn ? "on" : "off"}.`);

  if (!state.controls.backupGeneratorOn && state.powerGeneration <= 0 && state.powerStorage <= 0) {
    void shutdownSystem();
    return;
  }

  resumePausedTasks();
  refreshGameUi();
  saveGame();
});

updateWorkspaceLayout();
