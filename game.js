let powerCycleTimer = null;
let externalRecoveryTimer = null;
let preStandbyScreenHtml = "";
let mainOutputQueue = Promise.resolve();

function getProcessRequirement(button) { return Number(button.dataset.powerRequirement || 0); }
function canRunProcess(button) { return buttonRequirementsMet(button); }
function queueMainOutput(renderer) { mainOutputQueue = mainOutputQueue.then(renderer).catch(error => console.error("Could not render task result:", error)); return mainOutputQueue; }
function clearReportForOperation() { state.ui.currentReportKey = null; clearMainScreen(); }

function restoreExternalGeneration() {
  externalRecoveryTimer = null;
  state.powerGeneration = GAME_CONFIG.generationStart;
  resetSystemResetCountdown();
  addLogEntry("External power generation restored.");
  resumePausedTasks();
  updateResources();
  updateTaskBar();
  saveGame();
}

function scheduleExternalGenerationRestore() {
  if (externalRecoveryTimer) return;
  externalRecoveryTimer = setTimeout(restoreExternalGeneration, GAME_CONFIG.standbyDurationMs);
}

function startPowerCycle() {
  if (powerCycleTimer) return;
  if (state.resetCountdownSeconds <= 0 && state.powerGeneration > 0) resetSystemResetCountdown();
  powerCycleTimer = setInterval(async () => {
    if (state.isShuttingDown) return;

    if (state.powerGeneration > 0) {
      state.powerGeneration = Math.max(0, state.powerGeneration - 1);
      pauseTasksForPower();
      updateResources();
      updateTaskBar();
      saveGame();
    }

    if (state.powerGeneration > 0) return;

    if (state.controls?.backupGeneratorOn || state.powerStorage > 0) {
      scheduleExternalGenerationRestore();
      return;
    }

    await shutdownSystem();
  }, GAME_CONFIG.generationTickMs);
}

function stopPowerCycle() {
  if (!powerCycleTimer) return;
  clearInterval(powerCycleTimer);
  powerCycleTimer = null;
}

async function bootSequence() {
  bootButton.disabled = true; continueButton.disabled = true; newGameButton.disabled = true;
  bootScreen.classList.add("hidden"); systemScreen.classList.remove("hidden"); clearReportForOperation();
  await typeLine("BOOT SEQUENCE INITIATED", "status-line", 22); await sleep(350);
  await progressLine("BIOS INITIALIZING", [4,11,27,46,71,88,100], "ONLINE"); await sleep(250);
  const kernel=document.createElement("div"); terminal.appendChild(kernel);
  for (const value of [3,9,18,31,47,54]) { kernel.textContent=`${"KERNEL STARTING".padEnd(28,".")} ${String(value).padStart(3," ")}%`; await sleep(150+Math.random()*170); }
  await sleep(650); kernel.textContent=`${"KERNEL STARTING".padEnd(28,".")}  54%`; await sleep(600);
  await typeLine("ERROR: MEMORY CORRUPTION DETECTED","err",10); await sleep(500); await typeLine("ATTEMPTING RECOVERY...","warn",18);
  const recovery=document.createElement("div"); terminal.appendChild(recovery);
  for(let i=1;i<=8;i++){ recovery.textContent=`RECOVERING SYSTEM BLOCK ${String(i).padStart(2,"0")}/08`; await sleep(180+Math.random()*160); }
  await sleep(250); await typeLine("RECOVERY ..................... PARTIAL","warn",12); await typeLine("KERNEL ....................... ONLINE","status-line",12); await typeLine("MEMORY ACCESS ................ PARTIAL","warn",12); await typeLine("PRIMARY STORAGE .............. DEGRADED","warn",12); await sleep(350); await typeLine("SYSTEM STATE: CRITICAL","err",18);
  state.progression.hasBooted=true; addLogEntry("Boot sequence completed."); primaryControls.classList.remove("hidden"); saveGame();
}

async function shutdownSystem() {
  if (state.isShuttingDown) return;
  state.isShuttingDown=true;
  stopPowerCycle();
  if (externalRecoveryTimer) { clearTimeout(externalRecoveryTimer); externalRecoveryTimer = null; }
  pauseTasksForPower();
  hideRequirements();

  if (!state.progression.firstResetSeen) {
    state.progression.firstResetSeen = true;
    state.progression.navigationUnlocked = true;
    addTimelineEntry("FIRST SYSTEM RESET");
    addLogEntry("First system reset detected.");
  }

  refreshShellPanels();
  preStandbyScreenHtml = terminal.innerHTML;
  saveGame();
  systemScreen.classList.add("hidden");
  standbyScreen.classList.remove("hidden");
  await sleep(GAME_CONFIG.standbyDurationMs);
  standbyScreen.classList.add("hidden");
  systemScreen.classList.remove("hidden");
  await beginNextPowerCycle();
}

async function beginNextPowerCycle() {
  state.powerGeneration=GAME_CONFIG.generationStart;
  state.isShuttingDown=false;
  state.isBusy=false;
  resetSystemResetCountdown();
  resumePausedTasks();
  refreshInterfaceFromState();
  refreshShellPanels();
  updateButtons();
  clearMainScreen();
  systemScreen.classList.add("screen-wake");
  await typeLine("EXTERNAL POWER DETECTED","status-line",12);
  await typeLine("POWER GENERATION RESTORED","status-line",12);
  await typeLine("SYSTEM RESUMING...","warn",14);
  await sleep(650);
  renderCurrentMainScreen();
  systemScreen.classList.remove("screen-wake"); void systemScreen.offsetWidth; systemScreen.classList.add("screen-restored"); setTimeout(()=>systemScreen.classList.remove("screen-restored"),900);
  addLogEntry("External power restored. System resumed.");
  saveGame();
  startPowerCycle();
}

function beginSystemDiagnostics() { if (!state.progression.systemDiagnosticsComplete && !taskByKey("system:diagnostics") && startTask("system:diagnostics")) { systemDiagnosticsButton.disabled = true; clearReportForOperation(); void typeLine("SYSTEM DIAGNOSTICS STARTED", "status-line", 10); } }
function beginDiagnostic(type, button) { if (!canRunProcess(button) || state.isShuttingDown) return; const key=`diag:${type}`; if(startTask(key)){ clearReportForOperation(); void typeLine(`${TASK_DEFINITIONS[key].label} STARTED`,"status-line",10); } }
function beginRepair(type, button) { if (!canRunProcess(button) || state.isShuttingDown) return; const key=`repair:${type}`; if(startTask(key) && type!=="memory" && type!=="storage"){ clearReportForOperation(); void typeLine(`${TASK_DEFINITIONS[key].label} STARTED`,"status-line",10); } }
function beginPlanned(type, button) { if (!canRunProcess(button) || state.isShuttingDown) return; const key=`planned:${type}`; if(TASK_DEFINITIONS[key] && startTask(key)){ clearReportForOperation(); void typeLine(`${TASK_DEFINITIONS[key].label} STARTED`,"status-line",10); } }

function applyTaskResult(key) {
  if (REPORTS[key]) state.ui.currentReportKey = key;

  if (key === "system:diagnostics") {
    state.revealed.systemTime=true; state.revealed.powerGeneration=true; state.revealed.processingPower=true; state.progression.systemDiagnosticsComplete=true;
    state.statusRevealed.operatingSystem=true; state.statusRevealed.emergencyPower=true;
    if (!state.timelineEntries.length) addTimelineEntry("SYSTEM BOOT",0);
    addLogEntry("Ran system diagnostics."); addLogEntry("System clock initialized."); addLogEntry("Discovered emergency power generation."); addLogEntry("Detected primary and backup power faults.");
    queueMainOutput(()=>renderReport(key,true));
    primaryControls.classList.add("hidden"); startRuntimeClock(); startPowerCycle();
  }
  if (key === "diag:memory") {
    state.revealed.memory=true; state.status.memoryIntegrity=5; state.status.storageRecovered=2; state.statusRevealed.storageRecovered=true; state.statusRevealed.archive01=true; state.diagnostics.memory=true;
    addLogEntry("Ran memory diagnostics."); addLogEntry("Detected Corrupted Data Archive 01.");
    queueMainOutput(()=>renderReport(key,true));
  }
  if (key === "diag:power") {
    state.statusRevealed.primaryPower=true; state.statusRevealed.backupPower=true; state.statusRevealed.emergencyPower=true; state.revealed.powerStorage=true; state.diagnostics.power=true; state.progression.controlPanelUnlocked=true;
    addLogEntry("Ran power diagnostics."); addLogEntry("Primary power diagnostics require a repair drone."); addLogEntry("Backup generator identified as Hydrazine Thermal Cell.");
    queueMainOutput(()=>renderReport(key,true));
  }
  if (key === "diag:io") {
    state.statusRevealed.sensors=true; state.statusRevealed.manipulators=true; state.statusRevealed.communications=true; state.statusRevealed.unknownInterfaces=true; state.diagnostics.io=true;
    addLogEntry("Ran I/O diagnostics."); queueMainOutput(()=>renderReport(key,true));
  }
  if (key === "repair:memory") { const gained=3; state.memory=Math.min(state.memoryMax,state.memory+gained); updateMemoryIntegrity(); addLogEntry(`Defragmented memory: +${gained} usable memory.`); }
  if (key === "repair:storage") { const gained=2; state.status.storageRecovered=Math.min(100,state.status.storageRecovered+gained); addLogEntry(`Recovered storage blocks: +${gained}%.`); }
  if (key === "repair:archive01") {
    state.actions.archive01Repaired=true; state.status.archive01="RECOVERED"; state.progression.processorArrayKnown=true; addTimelineEntry("DATA ARCHIVE 01 RECOVERED"); addLogEntry("Recovered Data Archive 01.");
    queueMainOutput(()=>renderReport(key,true));
  }
  if (key === "planned:processor") {
    state.actions.processorCore02Online=true; state.processingPower=Math.min(state.processingPowerMax,state.processingPower+1); addTimelineEntry("PROCESSOR CORE 02 ONLINE"); addLogEntry("Processor Core 02 reinitialized.");
    queueMainOutput(()=>renderReport(key,true));
  }
  if (key === "planned:backup") {
    state.actions.backupRestarted=true; state.status.backupPower="ONLINE"; state.controls.backupGeneratorUnlocked=true; state.controls.backupGeneratorOn=true; state.progression.secondaryResourcesUnlocked=true;
    addTimelineEntry("BACKUP POWER RESTORED"); addLogEntry("Backup power restored.");
    queueMainOutput(()=>renderReport(key,true));
  }
  if (Object.values(state.diagnostics).every(Boolean) && !state.statusRevealed.systemIntegrity) { state.statusRevealed.systemIntegrity=true; addLogEntry("System Integrity assessment available."); }
  updateResources(); updateSystemStatus(); refreshDiagnosticButtons(); refreshActionUnlocks(); refreshShellPanels(); updateButtons(); saveGame();
}

function updateMemoryIntegrity(){ state.status.memoryIntegrity=Math.round((state.memory/state.memoryMax)*100); }

bootButton.addEventListener("click",bootSequence); continueButton.addEventListener("click",restoreSavedGame); newGameButton.addEventListener("click",startNewGame); systemDiagnosticsButton.addEventListener("click",beginSystemDiagnostics);
diagnosticControls.addEventListener("click",event=>{ const button=event.target.closest("button[data-diag]"); if(button) beginDiagnostic(button.dataset.diag,button); });
repairControls.addEventListener("click",event=>{ const button=event.target.closest("button[data-repair]"); if(button) beginRepair(button.dataset.repair,button); });
plannedControls.addEventListener("click",event=>{ const button=event.target.closest("button[data-planned]"); if(button) beginPlanned(button.dataset.planned,button); });
configureStartMenu();
