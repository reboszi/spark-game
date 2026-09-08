const runningTasksBar = document.getElementById("runningTasksBar");
const navigationPanel = document.getElementById("navigationPanel");
const controlPanel = document.getElementById("controlPanel");
const secondaryResourcesPanel = document.getElementById("secondaryResourcesPanel");

function systemTimeCard() {
  return `<div class="resource system-time-resource"><span class="resource-icon">◷</span><span class="resource-name">SYSTEM TIME</span><span class="resource-value">${formatSystemTime(state.systemTimeSeconds)}</span></div>`;
}

function updateResources() {
  let html = "";

  if (state.revealed.systemTime) {
    html += systemTimeCard();
  }

  if (state.revealed.powerGeneration) {
    const req = hoveredRequirements.power;
    const available = getAvailableGeneration();
    const active = req !== null;
    const ok = !active || available >= req;
    html += resourceCard("⚡", "POWER GENERATION", `${available} / ${state.powerGeneration}`, available, Math.max(1, state.powerGeneration), `resource-power-generation ${active ? "requirement-active" : ""} ${ok ? "" : "requirement-insufficient"}`);
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
    html += resourceCard("◈", "PROCESSING POWER", `${state.processingPower} / ${state.processingPowerMax}`, state.processingPower, state.processingPowerMax, `resource-processing-power ${active ? "requirement-active" : ""} ${ok ? "" : "requirement-insufficient"}`);
  }

  resourcesEl.innerHTML = html;
  resourcesEl.classList.toggle("hidden", !html);
  updateButtons();
}

function updateTaskBar() {
  const items = [];

  if (state.progression.firstResetSeen) {
    items.push(`<div class="taskbar-item taskbar-reset"><span>SYSTEM RESET</span><strong>${formatCountdown(state.resetCountdownSeconds)}</strong></div>`);

    for (const task of state.runningTasks || []) {
      if (task.status === "REVIEW") {
        items.push(`<button class="taskbar-item taskbar-review" type="button" data-review-task="${task.id}"><span>${task.label}</span><strong>REVIEW</strong></button>`);
        continue;
      }
      const statusClass = task.status === "PAUSED" ? " taskbar-paused" : "";
      const timeText = task.status === "PAUSED" ? "PAUSED" : formatCountdown(task.remainingSeconds);
      items.push(`<div class="taskbar-item${statusClass}"><span>${task.label}</span><strong>${timeText}</strong></div>`);
    }
  }

  runningTasksBar.innerHTML = items.join('<span class="taskbar-divider">|</span>');
  const visible = items.length > 0;
  runningTasksBar.classList.toggle("hidden", !visible);
  systemScreen.classList.toggle("tasks-visible", visible);
}

runningTasksBar.addEventListener("click", event => {
  const reviewButton = event.target.closest("[data-review-task]");
  if (reviewButton) reviewTask(reviewButton.dataset.reviewTask);
});

function refreshShellPanels() {
  updateTaskBar();

  const hasNavigation = !navigationPanel.classList.contains("hidden");
  const hasControl = !controlPanel.classList.contains("hidden");
  const hasResources = !secondaryResourcesPanel.classList.contains("hidden");

  document.getElementById("workspace").classList.toggle("has-navigation", hasNavigation);
  document.getElementById("workspace").classList.toggle("has-control", hasControl);
  document.getElementById("workspace").classList.toggle("has-secondary-resources", hasResources);
}
