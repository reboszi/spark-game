function getMemoryRequirement(button) {
  return button.dataset.memoryRequirement !== undefined ? Number(button.dataset.memoryRequirement) : null;
}

function buttonRequirementsMet(button) {
  const memoryReq = getMemoryRequirement(button);
  return getAvailableGeneration() >= Number(button.dataset.powerRequirement || 0)
    && state.processingPower >= Number(button.dataset.processingRequirement || 0)
    && (memoryReq === null || state.memory >= memoryReq)
    && hasSpecialRequirement(button);
}

function updateButtons() {
  document.querySelectorAll(".controls button").forEach(button=>{
    const taskKey = getButtonTaskKey(button);
    const alreadyRunning = taskKey ? Boolean(taskByKey(taskKey)) : false;
    const powerReq = Number(button.dataset.powerRequirement || 0);
    const locked = !buttonRequirementsMet(button);
    button.classList.toggle("power-insufficient", getAvailableGeneration() < powerReq);
    button.classList.toggle("requirement-locked", locked);
    button.classList.toggle("task-active", alreadyRunning);
    button.setAttribute("aria-disabled", String(state.isShuttingDown || locked || alreadyRunning));
    button.disabled = state.isShuttingDown || alreadyRunning;
  });
  const systemTaskActive = Boolean(taskByKey("system:diagnostics"));
  systemDiagnosticsButton.disabled = state.isShuttingDown || state.progression.systemDiagnosticsComplete || systemTaskActive;
  systemDiagnosticsButton.classList.toggle("task-active", systemTaskActive);
}

function showRequirements(button) {
  const powerReq = Number(button.dataset.powerRequirement || 0);
  const processingReq = button.dataset.processingRequirement !== undefined ? Number(button.dataset.processingRequirement) : null;
  const memoryReq = getMemoryRequirement(button);
  hoveredRequirements.power = powerReq || null;
  hoveredRequirements.processing = processingReq;
  updateResources();

  let reqHtml = "";
  if (powerReq) reqHtml += requirementRow("Power Generation", powerReq, getAvailableGeneration() >= powerReq);
  if (processingReq !== null) reqHtml += requirementRow("Processing Power", processingReq, state.processingPower >= processingReq);
  if (memoryReq !== null) reqHtml += requirementRow("Memory", memoryReq, state.memory >= memoryReq);
  if (button.dataset.specialRequirement) reqHtml += `<div class="tooltip-requirement ${hasSpecialRequirement(button)?"met":"unmet"}"><span>${button.dataset.specialRequirement}</span><span>${hasSpecialRequirement(button)?"AVAILABLE":"REQUIRED"}</span></div>`;

  const key = getActionKey(button);
  actionTooltip.innerHTML = `<div class="tooltip-title">${button.textContent.trim()}</div><div class="tooltip-description">${actionDescriptions[key]||"System operation."}</div><div class="tooltip-section-title">REQUIREMENTS</div>${reqHtml||'<div class="tooltip-requirement met">None</div>'}<div class="tooltip-section-title tooltip-outcome-title">OUTCOME</div><div class="tooltip-outcome">${actionOutcomes[key]||"UNKNOWN"}</div>`;
  actionTooltip.classList.remove("hidden");
  const rect=button.getBoundingClientRect();
  const width=300;
  let left=rect.right+12;
  if(left+width>window.innerWidth-12) left=Math.max(12,rect.left-width-12);
  let top=Math.min(rect.top,window.innerHeight-260);
  top=Math.max(12,top);
  actionTooltip.style.left=`${left}px`;
  actionTooltip.style.top=`${top}px`;
}

function refreshActionUnlocks() {
  const memoryRepair=repairControls.querySelector('[data-repair="memory"]');
  const storageRepair=repairControls.querySelector('[data-repair="storage"]');
  const archiveRepair=repairControls.querySelector('[data-repair="archive01"]');
  memoryRepair.classList.toggle("hidden",!state.diagnostics.memory||state.memory>=state.memoryMax);
  storageRepair.classList.toggle("hidden",!state.diagnostics.memory||state.status.storageRecovered>=100);
  archiveRepair.classList.toggle("hidden",!state.diagnostics.memory||state.actions.archive01Repaired);
  maintenanceSection.classList.toggle("hidden",![...repairControls.querySelectorAll("button")].some(button=>!button.classList.contains("hidden")));

  const visibility={
    processor: state.progression.processorArrayKnown && !state.actions.processorCore02Online,
    backup: state.diagnostics.power && !state.actions.backupRestarted,
    primary: state.diagnostics.power && !state.actions.primaryPowerRepaired,
    sensors: state.diagnostics.io,
    manipulators: state.diagnostics.io,
    communications: state.diagnostics.io,
    unknown: state.diagnostics.io
  };
  plannedControls.querySelectorAll("button[data-planned]").forEach(button=>button.classList.toggle("hidden",!visibility[button.dataset.planned]));
  plannedSection.classList.toggle("hidden",![...plannedControls.querySelectorAll("button")].some(button=>!button.classList.contains("hidden")));
  if(Object.values(state.diagnostics).every(Boolean)) state.statusRevealed.systemIntegrity=true;
  updateButtons();
}

actionDescriptions["planned:processor"] = "Reinitialize a recoverable dormant processor core identified in Data Archive 01.";
actionOutcomes["planned:processor"] = "+1 Processing Power";
