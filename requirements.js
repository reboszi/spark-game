const actionDescriptions = {
  "diag:memory": "Inspect memory availability and recoverable storage structures.",
  "diag:power": "Analyze available generation, backup systems and power distribution.",
  "diag:io": "Identify accessible input/output subsystem families.",
  "repair:memory": "Reorganize accessible memory to recover usable capacity.",
  "repair:storage": "Recover additional readable storage blocks.",
  "repair:archive01": "Reconstruct the first corrupted data archive.",
  "planned:processor": "Reinitialize a recoverable dormant processor core identified in Data Archive 01.",
  "planned:backup": "Use emergency power to force a feedback cycle through the blocked backup generator valve.",
  "planned:primary": "Run deeper diagnostics on the damaged primary power hardware.",
  "planned:sensors": "Identify individual sensor systems and their condition.",
  "planned:manipulators": "Inspect physical manipulation and maintenance interfaces.",
  "planned:communications": "Map local and external communication systems.",
  "planned:unknown": "Analyze an unidentified interface detected by I/O diagnostics."
};

const actionOutcomes = {
  "diag:memory": "DISCOVER memory condition, storage recovery and corrupted archives",
  "diag:power": "DISCOVER primary power, backup generator and power storage state",
  "diag:io": "DISCOVER interface subsystem families",
  "repair:memory": "+3 usable memory",
  "repair:storage": "+2% storage recovery",
  "repair:archive01": "RECOVER Data Archive 01",
  "planned:processor": "+1 Processing Power",
  "planned:backup": "RESTORE backup generator operation",
  "planned:primary": "UNKNOWN",
  "planned:sensors": "DISCOVER sensor subsystems",
  "planned:manipulators": "DISCOVER manipulator subsystems",
  "planned:communications": "DISCOVER communication systems",
  "planned:unknown": "UNKNOWN"
};

function getButtonTaskKey(button) {
  if (button === systemDiagnosticsButton) return "system:diagnostics";
  if (button.dataset.diag) return `diag:${button.dataset.diag}`;
  if (button.dataset.repair) return `repair:${button.dataset.repair}`;
  if (button.dataset.planned) return `planned:${button.dataset.planned}`;
  return null;
}

function getMemoryRequirement(button) {
  return button.dataset.memoryRequirement !== undefined
    ? Number(button.dataset.memoryRequirement)
    : null;
}

function hasSpecialRequirement(button) {
  const requirement = button.dataset.specialRequirement;
  if (!requirement) return true;
  if (requirement === "REPAIR DRONE") return Boolean(state.capabilities.repairDrone);
  return false;
}

function hasTaskImplementation(button) {
  const key = getButtonTaskKey(button);
  return !key || Boolean(TASK_DEFINITIONS[key]);
}

function buttonRequirementsMet(button, availablePower = getAvailableGeneration()) {
  const memoryReq = getMemoryRequirement(button);
  return hasTaskImplementation(button)
    && availablePower >= Number(button.dataset.powerRequirement || 0)
    && state.processingPower >= Number(button.dataset.processingRequirement || 0)
    && (memoryReq === null || state.memory >= memoryReq)
    && hasSpecialRequirement(button);
}

function updateButtons() {
  const availablePower = getAvailableGeneration();

  document.querySelectorAll(".controls button").forEach(button => {
    const taskKey = getButtonTaskKey(button);
    const alreadyRunning = taskKey ? Boolean(taskByKey(taskKey)) : false;
    const powerReq = Number(button.dataset.powerRequirement || 0);
    const locked = !buttonRequirementsMet(button, availablePower);

    button.classList.toggle("power-insufficient", availablePower < powerReq);
    button.classList.toggle("requirement-locked", locked);
    button.classList.toggle("task-active", alreadyRunning);
    button.setAttribute("aria-disabled", String(state.isShuttingDown || locked || alreadyRunning));

    // Locked actions stay focusable/hoverable so their requirements remain inspectable.
    button.disabled = state.isShuttingDown || alreadyRunning;
  });

  const systemTaskActive = Boolean(taskByKey("system:diagnostics"));
  systemDiagnosticsButton.disabled = state.isShuttingDown
    || state.progression.systemDiagnosticsComplete
    || systemTaskActive;
  systemDiagnosticsButton.classList.toggle("task-active", systemTaskActive);
}

function refreshActionUnlocks() {
  const memoryRepair = repairControls.querySelector('[data-repair="memory"]');
  const storageRepair = repairControls.querySelector('[data-repair="storage"]');
  const archiveRepair = repairControls.querySelector('[data-repair="archive01"]');

  memoryRepair.classList.toggle("hidden", !state.diagnostics.memory || state.memory >= state.memoryMax);
  storageRepair.classList.toggle("hidden", !state.diagnostics.memory || state.status.storageRecovered >= 100);
  archiveRepair.classList.toggle("hidden", !state.diagnostics.memory || state.actions.archive01Repaired);
  maintenanceSection.classList.toggle(
    "hidden",
    ![...repairControls.querySelectorAll("button")].some(button => !button.classList.contains("hidden"))
  );

  const visibility = {
    processor: state.progression.processorArrayKnown && !state.actions.processorCore02Online,
    backup: state.diagnostics.power && !state.actions.backupRestarted,
    primary: state.diagnostics.power && !state.actions.primaryPowerRepaired,
    sensors: state.diagnostics.io,
    manipulators: state.diagnostics.io,
    communications: state.diagnostics.io,
    unknown: state.diagnostics.io
  };

  plannedControls.querySelectorAll("button[data-planned]").forEach(button => {
    button.classList.toggle("hidden", !visibility[button.dataset.planned]);
  });
  plannedSection.classList.toggle(
    "hidden",
    ![...plannedControls.querySelectorAll("button")].some(button => !button.classList.contains("hidden"))
  );
}

function showRequirements(button) {
  const availablePower = getAvailableGeneration();
  const powerReq = Number(button.dataset.powerRequirement || 0);
  const processingReq = button.dataset.processingRequirement !== undefined
    ? Number(button.dataset.processingRequirement)
    : null;
  const memoryReq = getMemoryRequirement(button);
  const key = getButtonTaskKey(button);
  const duration = key ? getTaskDuration(key) : null;

  hoveredRequirements.power = powerReq || null;
  hoveredRequirements.processing = processingReq;
  updateResources();

  let reqHtml = "";
  if (powerReq) reqHtml += requirementRow("Power Generation", powerReq, availablePower >= powerReq);
  if (processingReq !== null) reqHtml += requirementRow("Processing Power", processingReq, state.processingPower >= processingReq);
  if (memoryReq !== null) reqHtml += requirementRow("Memory", memoryReq, state.memory >= memoryReq);
  if (button.dataset.specialRequirement) {
    reqHtml += requirementRow(
      button.dataset.specialRequirement,
      hasSpecialRequirement(button) ? "AVAILABLE" : "REQUIRED",
      hasSpecialRequirement(button)
    );
  }
  if (!hasTaskImplementation(button)) reqHtml += requirementRow("Operation", "NOT IMPLEMENTED", false);

  actionTooltip.innerHTML = `
    <div class="tooltip-title">${button.textContent.trim()}</div>
    <div class="tooltip-description">${actionDescriptions[key] || "System operation."}</div>
    <div class="tooltip-section-title">REQUIREMENTS</div>
    ${reqHtml || '<div class="tooltip-requirement met">None</div>'}
    <div class="tooltip-section-title tooltip-outcome-title">DURATION</div>
    <div class="tooltip-outcome">${duration === null ? "UNKNOWN" : formatCountdown(duration)}</div>
    <div class="tooltip-section-title tooltip-outcome-title">OUTCOME</div>
    <div class="tooltip-outcome">${actionOutcomes[key] || "UNKNOWN"}</div>`;
  actionTooltip.classList.remove("hidden");

  const rect = button.getBoundingClientRect();
  const width = 300;
  let left = rect.right + 12;
  if (left + width > window.innerWidth - 12) left = Math.max(12, rect.left - width - 12);
  let top = Math.min(rect.top, window.innerHeight - 300);
  top = Math.max(12, top);
  actionTooltip.style.left = `${left}px`;
  actionTooltip.style.top = `${top}px`;
}

function hideRequirements() {
  hoveredRequirements.power = null;
  hoveredRequirements.processing = null;
  updateResources();
  actionTooltip.classList.add("hidden");
}

document.querySelectorAll("[data-power-requirement]").forEach(button => {
  button.addEventListener("mouseenter", () => showRequirements(button));
  button.addEventListener("mouseleave", hideRequirements);
  button.addEventListener("focus", () => showRequirements(button));
  button.addEventListener("blur", hideRequirements);
});
