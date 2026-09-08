const bootScreen = document.getElementById("bootScreen");
const standbyScreen = document.getElementById("standbyScreen");
const systemScreen = document.getElementById("systemScreen");
const bootButton = document.getElementById("bootButton");
const continueButton = document.getElementById("continueButton");
const newGameButton = document.getElementById("newGameButton");
const terminal = document.getElementById("terminalOutput");
const primaryControls = document.getElementById("primaryControls");
const diagnosticSection = document.getElementById("diagnosticSection");
const diagnosticControls = document.getElementById("diagnosticControls");
const maintenanceSection = document.getElementById("maintenanceSection");
const repairControls = document.getElementById("repairControls");
const plannedSection = document.getElementById("plannedSection");
const plannedControls = document.getElementById("plannedControls");
const resourcesEl = document.getElementById("resources");
const systemStatusEl = document.getElementById("systemStatus");
const statusContentEl = document.getElementById("statusContent");
const activityLogEl = document.getElementById("activityLog");
const logContentEl = document.getElementById("logContent");
const systemDiagnosticsButton = document.getElementById("systemDiagnosticsButton");
const actionTooltip = document.getElementById("actionTooltip");

let hoveredRequirements = { power: null, processing: null };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function typeLine(text, cls = "", speed = 14) {
  const line = document.createElement("div");
  if (cls) line.className = cls;
  terminal.appendChild(line);
  for (let i = 0; i < text.length; i++) { line.textContent += text[i]; await sleep(speed); }
  terminal.scrollTop = terminal.scrollHeight;
  return line;
}

async function progressLine(label, values, finalText = "ONLINE") {
  const line = document.createElement("div");
  terminal.appendChild(line);
  for (const value of values) {
    line.textContent = `${label.padEnd(28, ".")} ${String(value).padStart(3, " ")}%`;
    await sleep(120 + Math.random() * 180);
  }
  await sleep(250);
  line.textContent = `${label.padEnd(28, ".")} ${finalText}`;
}

function clearMainScreen() { terminal.innerHTML = ""; }

function resourceCard(icon, name, value, current, max, extraClass = "") {
  const percent = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  return `<div class="resource resource-bar ${extraClass}" style="--resource-fill:${percent}%"><span class="resource-icon">${icon}</span><span class="resource-name">${name}</span><span class="resource-value">${value}</span></div>`;
}

function updateResources() {
  let html = "";
  if (state.revealed.powerGeneration) {
    const req = hoveredRequirements.power;
    const active = req !== null;
    const ok = !active || state.powerGeneration >= req;
    html += resourceCard("⚡", "POWER GENERATION", `${state.powerGeneration} / ${state.powerGenerationMax}`, state.powerGeneration, state.powerGenerationMax, `resource-power-generation ${active ? "requirement-active" : ""} ${ok ? "" : "requirement-insufficient"}`);
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
  updateButtons();
}

function getStatusClass(value) {
  if (["ERROR","CRITICAL","SEVERE","CORRUPTED","DAMAGED","BLOCKED"].includes(value)) return "err";
  if (["PARTIAL","DEGRADED","DETECTED","RESTART REQUIRED","STOPPED"].includes(value)) return "warn";
  if (["OFFLINE","UNAVAILABLE"].includes(value)) return "dim";
  if (value === "NO RESPONSE") return "neutral";
  if (value === "UNKNOWN") return "unknown";
  if (["ONLINE","ACTIVE","PRESENT","RECOVERED","AVAILABLE"].includes(value)) return "status-line";
  return "";
}
function getStorageRecoveryClass(value) { if (value >= 75) return "storage-good"; if (value >= 50) return "storage-mid"; if (value >= 25) return "storage-low"; return "storage-critical"; }
function calculateSystemIntegrity() {
  if (!Object.values(state.diagnostics).every(Boolean)) return null;
  let integrity = 100;
  if (!state.actions.primaryPowerRepaired) integrity -= 20;
  if (!state.actions.backupRestarted) integrity -= 10;
  integrity -= Math.round((1 - Math.min(1, state.status.memoryIntegrity / 100)) * 15);
  integrity -= Math.round((1 - Math.min(1, state.status.storageRecovered / 100)) * 25);
  if (!state.actions.archive01Repaired) integrity -= 5;
  integrity -= 20;
  return Math.max(0, integrity);
}

function updateSystemStatus() {
  const groups = [];
  const row = (label,value,cls="") => `<div class="status-row"><span class="status-label">${label}</span><span class="status-dots"></span><span class="${cls}">${value}</span></div>`;
  const subheading = label => `<div class="status-subheading">${label}:</div>`;
  const addGroup = (title, rows) => { const visible = rows.filter(Boolean); if (visible.length) groups.push(`<section class="status-group"><div class="status-group-title">${title}</div>${visible.join("")}</section>`); };
  const integrity = calculateSystemIntegrity(); if (integrity !== null) state.status.systemIntegrity = integrity;
  addGroup("CORE SYSTEMS", [state.statusRevealed.operatingSystem ? row("Operating System",state.status.operatingSystem,getStatusClass(state.status.operatingSystem)) : "", state.statusRevealed.systemIntegrity ? row("System Integrity",`${state.status.systemIntegrity}%`,state.status.systemIntegrity < 50 ? "err" : "warn") : ""]);
  addGroup("POWER", [state.statusRevealed.primaryPower ? row("Primary Power",state.status.primaryPowerCondition,getStatusClass(state.status.primaryPowerCondition)) : "", state.statusRevealed.backupPower ? row("Backup Power",state.status.backupPower,getStatusClass(state.status.backupPower)) : "", state.statusRevealed.emergencyPower ? row("Emergency Power",state.status.emergencyPower,getStatusClass(state.status.emergencyPower)) : ""]);
  addGroup("MEMORY & STORAGE", [state.statusRevealed.storageRecovered ? row("Storage Recovery",`${state.status.storageRecovered}%`,getStorageRecoveryClass(state.status.storageRecovered)) : "", state.statusRevealed.archive01 ? subheading("Corrupted Archives") : "", state.statusRevealed.archive01 ? row("Data Archive 01",state.status.archive01,getStatusClass(state.status.archive01)) : ""]);
  addGroup("INTERFACES", [state.statusRevealed.sensors ? row("Sensors",state.status.sensors,getStatusClass(state.status.sensors)) : "", state.statusRevealed.manipulators ? row("Manipulators",state.status.manipulators,getStatusClass(state.status.manipulators)) : "", state.statusRevealed.unknownInterfaces ? row("Unknown Interface",state.status.unknownInterfaces,getStatusClass(state.status.unknownInterfaces)) : ""]);
  addGroup("COMMUNICATIONS", [state.statusRevealed.communications ? row("Communications",state.status.communications,getStatusClass(state.status.communications)) : ""]);
  statusContentEl.innerHTML = groups.join("");
  systemStatusEl.classList.toggle("hidden", groups.length === 0);
}

function addLogEntry(text) { state.logEntries.push(text); if (state.logEntries.length > 80) state.logEntries.shift(); renderActivityLog(); }
function renderActivityLog() { logContentEl.innerHTML = state.logEntries.map((entry,index)=>`<div class="log-entry"><span class="log-index">${String(index+1).padStart(2,"0")}</span>${entry}</div>`).join(""); activityLogEl.classList.toggle("hidden",state.logEntries.length===0); activityLogEl.scrollTop = activityLogEl.scrollHeight; }
function getAvailablePower() { return state.powerGeneration; }
function hasSpecialRequirement(button) { const r=button.dataset.specialRequirement; if (!r) return true; if (r === "REPAIR DRONE") return Boolean(state.capabilities.repairDrone); return false; }
function buttonRequirementsMet(button) { return state.powerGeneration >= Number(button.dataset.powerRequirement||0) && state.processingPower >= Number(button.dataset.processingRequirement||0) && hasSpecialRequirement(button); }
function updateButtons() { document.querySelectorAll("[data-power-requirement]").forEach(button=>{ const locked=!buttonRequirementsMet(button); button.classList.toggle("power-insufficient",state.powerGeneration < Number(button.dataset.powerRequirement||0)); button.classList.toggle("requirement-locked",locked); button.setAttribute("aria-disabled",String(state.isBusy||state.isShuttingDown||locked)); button.disabled=state.isBusy||state.isShuttingDown; }); }
function setAllActionButtonsDisabled(disabled) { state.isBusy=disabled; document.querySelectorAll(".controls button").forEach(button=>button.disabled=disabled); if(!disabled) updateButtons(); }
function refreshDiagnosticButtons() { diagnosticControls.querySelectorAll("button[data-diag]").forEach(button=>button.classList.toggle("hidden",Boolean(state.diagnostics[button.dataset.diag]))); const any=[...diagnosticControls.querySelectorAll("button[data-diag]")].some(button=>!button.classList.contains("hidden")); diagnosticSection.classList.toggle("hidden",!state.progression.systemDiagnosticsComplete||!any); }
function refreshActionUnlocks() { const memoryRepair=repairControls.querySelector('[data-repair="memory"]'); const storageRepair=repairControls.querySelector('[data-repair="storage"]'); const archiveRepair=repairControls.querySelector('[data-repair="archive01"]'); memoryRepair.classList.toggle("hidden",!state.diagnostics.memory||state.memory>=state.memoryMax); storageRepair.classList.toggle("hidden",!state.diagnostics.memory||state.status.storageRecovered>=100); archiveRepair.classList.toggle("hidden",!state.diagnostics.memory||state.actions.archive01Repaired); maintenanceSection.classList.toggle("hidden",![...repairControls.querySelectorAll("button")].some(button=>!button.classList.contains("hidden"))); const visibility={backup:state.diagnostics.power&&!state.actions.backupRestarted,primary:state.diagnostics.power&&!state.actions.primaryPowerRepaired,sensors:state.diagnostics.io,manipulators:state.diagnostics.io,communications:state.diagnostics.io,unknown:state.diagnostics.io}; plannedControls.querySelectorAll("button[data-planned]").forEach(button=>button.classList.toggle("hidden",!visibility[button.dataset.planned])); plannedSection.classList.toggle("hidden",![...plannedControls.querySelectorAll("button")].some(button=>!button.classList.contains("hidden"))); if(Object.values(state.diagnostics).every(Boolean)) state.statusRevealed.systemIntegrity=true; }
function refreshInterfaceFromState() { updateResources(); updateSystemStatus(); renderActivityLog(); refreshDiagnosticButtons(); refreshActionUnlocks(); updateSystemStatus(); primaryControls.classList.toggle("hidden",state.progression.systemDiagnosticsComplete); systemDiagnosticsButton.disabled=state.progression.systemDiagnosticsComplete; }

const actionDescriptions = {
  "diag:memory":"Inspect memory availability and recoverable storage structures.",
  "diag:power":"Analyze available generation, backup systems and power distribution.",
  "diag:io":"Identify accessible input/output subsystem families.",
  "repair:memory":"Reorganize accessible memory to recover usable capacity.",
  "repair:storage":"Recover additional readable storage blocks.",
  "repair:archive01":"Reconstruct the first corrupted data archive.",
  "planned:backup":"Use emergency power to force a feedback cycle through the blocked backup generator valve.",
  "planned:primary":"Run deeper diagnostics on the damaged primary power hardware.",
  "planned:sensors":"Identify individual sensor systems and their condition.",
  "planned:manipulators":"Inspect physical manipulation and maintenance interfaces.",
  "planned:communications":"Map local and external communication systems.",
  "planned:unknown":"Analyze an unidentified interface detected by I/O diagnostics."
};

const actionOutcomes = {
  "diag:memory":"DISCOVER memory condition, storage recovery and corrupted archives",
  "diag:power":"DISCOVER primary power, backup generator and power storage state",
  "diag:io":"DISCOVER interface subsystem families",
  "repair:memory":"+3 usable memory",
  "repair:storage":"+2% storage recovery",
  "repair:archive01":"RECOVER Data Archive 01",
  "planned:backup":"RESTORE backup generator operation",
  "planned:primary":"UNKNOWN",
  "planned:sensors":"DISCOVER sensor subsystems",
  "planned:manipulators":"DISCOVER manipulator subsystems",
  "planned:communications":"DISCOVER communication systems",
  "planned:unknown":"UNKNOWN"
};

function getActionKey(button) { if(button.dataset.diag) return `diag:${button.dataset.diag}`; if(button.dataset.repair) return `repair:${button.dataset.repair}`; return `planned:${button.dataset.planned}`; }
function requirementRow(label,required,met) {
  const resourceClass = label === "Power Generation" ? "requirement-power" : label === "Processing Power" ? "requirement-processing" : label === "Memory" ? "requirement-memory" : "";
  return `<div class="tooltip-requirement ${resourceClass} ${met?"met":"unmet"}"><span>${label}</span><span>${required}</span></div>`;
}
function showRequirements(button) {
  const powerReq=Number(button.dataset.powerRequirement||0);
  const processingReq=button.dataset.processingRequirement!==undefined ? Number(button.dataset.processingRequirement) : null;
  hoveredRequirements.power=powerReq||null; hoveredRequirements.processing=processingReq; updateResources();
  let reqHtml="";
  if(powerReq) reqHtml += requirementRow("Power Generation",powerReq,state.powerGeneration>=powerReq);
  if(processingReq!==null) reqHtml += requirementRow("Processing Power",processingReq,state.processingPower>=processingReq);
  if(button.dataset.specialRequirement) reqHtml += `<div class="tooltip-requirement ${hasSpecialRequirement(button)?"met":"unmet"}"><span>${button.dataset.specialRequirement}</span><span>${hasSpecialRequirement(button)?"AVAILABLE":"REQUIRED"}</span></div>`;
  const key=getActionKey(button);
  actionTooltip.innerHTML=`<div class="tooltip-title">${button.textContent.trim()}</div><div class="tooltip-description">${actionDescriptions[key]||"System operation."}</div><div class="tooltip-section-title">REQUIREMENTS</div>${reqHtml||'<div class="tooltip-requirement met">None</div>'}<div class="tooltip-section-title tooltip-outcome-title">OUTCOME</div><div class="tooltip-outcome">${actionOutcomes[key]||"UNKNOWN"}</div>`;
  actionTooltip.classList.remove("hidden");
  const rect=button.getBoundingClientRect();
  const width=300; let left=rect.right+12; if(left+width>window.innerWidth-12) left=Math.max(12,rect.left-width-12); let top=Math.min(rect.top,window.innerHeight-260); top=Math.max(12,top); actionTooltip.style.left=`${left}px`; actionTooltip.style.top=`${top}px`;
}
function hideRequirements() { hoveredRequirements.power=null; hoveredRequirements.processing=null; updateResources(); actionTooltip.classList.add("hidden"); }
document.querySelectorAll("[data-power-requirement]").forEach(button=>{ button.addEventListener("mouseenter",()=>showRequirements(button)); button.addEventListener("mouseleave",hideRequirements); button.addEventListener("focus",()=>showRequirements(button)); button.addEventListener("blur",hideRequirements); });
