let powerCycleTimer = null;
let preStandbyScreenHtml = "";

function getProcessRequirement(button) { return Number(button.dataset.powerRequirement || 0); }
function canRunProcess(button) { return buttonRequirementsMet(button); }

function startPowerCycle() {
  if (powerCycleTimer) return;
  if (state.resetCountdownSeconds <= 0) resetSystemResetCountdown();
  powerCycleTimer = setInterval(async () => {
    if (state.isShuttingDown) return;
    if (state.powerGeneration > 0) {
      state.powerGeneration -= 1;
      updateResources();
      saveGame();
    }
    if (state.powerGeneration <= 0 && state.powerStorage <= 0 && !state.isBusy) await shutdownSystem();
  }, GAME_CONFIG.generationTickMs);
}
function stopPowerCycle() { if (!powerCycleTimer) return; clearInterval(powerCycleTimer); powerCycleTimer = null; }
async function finishProcess() { setAllActionButtonsDisabled(false); refreshActionUnlocks(); updateSystemStatus(); updateButtons(); saveGame(); if (state.powerGeneration <= 0 && state.powerStorage <= 0) await shutdownSystem(); }

async function bootSequence() {
  bootButton.disabled = true; continueButton.disabled = true; newGameButton.disabled = true;
  bootScreen.classList.add("hidden"); systemScreen.classList.remove("hidden"); clearMainScreen();
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
  state.isShuttingDown=true; stopPowerCycle(); setAllActionButtonsDisabled(true); hideRequirements();
  if (!state.progression.firstResetSeen) {
    state.progression.firstResetSeen = true;
    addLogEntry("First system reset detected.");
  }
  updateTaskBar();
  preStandbyScreenHtml = terminal.innerHTML;
  saveGame(); systemScreen.classList.add("hidden"); standbyScreen.classList.remove("hidden");
  await sleep(GAME_CONFIG.standbyDurationMs);
  standbyScreen.classList.add("hidden"); systemScreen.classList.remove("hidden");
  await beginNextPowerCycle();
}

async function beginNextPowerCycle() {
  state.powerGeneration=GAME_CONFIG.generationStart; state.isShuttingDown=false; state.isBusy=false;
  resetSystemResetCountdown();
  refreshInterfaceFromState(); updateTaskBar(); updateButtons();
  clearMainScreen();
  systemScreen.classList.add("screen-wake");
  await typeLine("EXTERNAL POWER DETECTED","status-line",12);
  await typeLine("POWER GENERATION RESTORED","status-line",12);
  await typeLine("SYSTEM RESUMING...","warn",14);
  await sleep(650);
  terminal.innerHTML = preStandbyScreenHtml;
  systemScreen.classList.remove("screen-wake");
  void systemScreen.offsetWidth;
  systemScreen.classList.add("screen-restored");
  setTimeout(()=>systemScreen.classList.remove("screen-restored"),900);
  addLogEntry("External power restored. System resumed.");
  saveGame(); startPowerCycle();
}

async function runSystemDiagnostics() {
  clearMainScreen(); systemDiagnosticsButton.disabled=true; setAllActionButtonsDisabled(true);
  await typeLine("SYSTEM DIAGNOSTICS","status-line",18); await sleep(300);
  await typeLine("Operating system ............... ONLINE","status-line",10); state.statusRevealed.operatingSystem=true; updateSystemStatus();
  await typeLine("Primary power .................. ERROR","err",10); await typeLine("Backup power ................... ERROR","err",10); await typeLine("Emergency power ................ ONLINE","status-line",10); state.statusRevealed.emergencyPower=true; updateSystemStatus();
  await typeLine("Memory subsystem ............... DEGRADED","warn",10); await typeLine("I/O subsystem .................. DEGRADED","warn",10); await typeLine("Processing capacity ............ MINIMAL","warn",10); await sleep(300);
  await typeLine("WARNING!!!","err",10); await typeLine("POWER GENERATION UNSTABLE","err",10); await typeLine("AVAILABLE GENERATION BELOW SAFE LIMIT AND DECREASING","err",10);
  state.revealed.systemTime=true; state.revealed.powerGeneration=true; state.revealed.processingPower=true; state.progression.systemDiagnosticsComplete=true;
  addLogEntry("Ran system diagnostics."); addLogEntry("System clock initialized."); addLogEntry("Discovered emergency power generation."); addLogEntry("Detected primary and backup power faults.");
  updateResources(); primaryControls.classList.add("hidden"); refreshDiagnosticButtons(); setAllActionButtonsDisabled(false); saveGame(); startRuntimeClock(); startPowerCycle();
}

async function runDiagnostic(type, button) {
  if (!canRunProcess(button)||state.isBusy||state.isShuttingDown) return;
  clearMainScreen(); setAllActionButtonsDisabled(true);
  if(type==="memory"){
    await typeLine("MEMORY DIAGNOSTICS","status-line",15); await typeLine("Usable memory .................. 4.7%","warn",10); await typeLine("Memory integrity ............... 5%","err",10); await typeLine("Storage recovery ............... 2%","err",10); await typeLine("Corrupted data archives found .. 1","err",10); await typeLine("Data Archive 01 ................ CORRUPTED","err",10);
    state.revealed.memory=true; state.status.memoryIntegrity=5; state.status.storageRecovered=2; state.statusRevealed.storageRecovered=true; state.statusRevealed.archive01=true; state.diagnostics.memory=true; addLogEntry("Ran memory diagnostics."); addLogEntry("Detected Corrupted Data Archive 01.");
  }
  if(type==="power"){
    await typeLine("POWER DIAGNOSTICS","status-line",15); await typeLine("Primary power .................. DAMAGED","err",10); await typeLine("  Diagnostics .................. UNAVAILABLE","dim",10); await typeLine("  Required ..................... REPAIR DRONE","unknown",10); await typeLine("Backup generator ............... HYDRAZINE THERMAL CELL","warn",10); await typeLine("  Generator state .............. RESTART REQUIRED","warn",10); await typeLine("  Hydrazine valve .............. BLOCKED","err",10); await typeLine("  Recovery method .............. EMERGENCY POWER FEEDBACK LOOP","warn",10); await typeLine("Emergency power ................ ONLINE","status-line",10); await typeLine("External generation ............ DETECTED","status-line",10); await typeLine("Source ......................... UNKNOWN","unknown",10); await typeLine("Power storage .................. NOT AVAILABLE","err",10);
    state.statusRevealed.primaryPower=true; state.statusRevealed.backupPower=true; state.statusRevealed.emergencyPower=true; state.revealed.powerStorage=true; state.diagnostics.power=true; addLogEntry("Ran power diagnostics."); addLogEntry("Primary power diagnostics require a repair drone."); addLogEntry("Backup generator identified as Hydrazine Thermal Cell."); addLogEntry("Backup hydrazine valve blocked; emergency feedback loop planned.");
  }
  if(type==="io"){
    await typeLine("I/O DIAGNOSTICS","status-line",15); await typeLine("Sensors ......................... DETECTED","warn",10); await typeLine("Manipulators .................... DETECTED","warn",10); await typeLine("Communications .................. DETECTED","warn",10); await typeLine("Unknown interface ............... DETECTED","unknown",10); await sleep(250); await typeLine("DETAILED SUBSYSTEM ANALYSIS REQUIRED","warn",10);
    state.statusRevealed.sensors=true; state.statusRevealed.manipulators=true; state.statusRevealed.communications=true; state.statusRevealed.unknownInterfaces=true; state.diagnostics.io=true; addLogEntry("Ran I/O diagnostics."); addLogEntry("Detected sensors, manipulators and communications interfaces."); addLogEntry("Detected unidentified interface.");
  }
  if(Object.values(state.diagnostics).every(Boolean)){ state.statusRevealed.systemIntegrity=true; addLogEntry("System Integrity assessment available."); }
  updateResources(); updateSystemStatus(); refreshDiagnosticButtons(); refreshActionUnlocks(); await finishProcess();
}

function updateMemoryIntegrity(){ state.status.memoryIntegrity=Math.round((state.memory/state.memoryMax)*100); }
async function runRepair(type,button){
  if(!canRunProcess(button)||state.isBusy||state.isShuttingDown) return;
  if(type==="memory"){ const gained=3; state.memory=Math.min(state.memoryMax,state.memory+gained); updateMemoryIntegrity(); addLogEntry(`Defragmented memory: +${gained} usable memory.`); }
  if(type==="storage"){ const gained=2; state.status.storageRecovered=Math.min(100,state.status.storageRecovered+gained); addLogEntry(`Recovered storage blocks: +${gained}%.`); }
  if(type==="archive01"){ clearMainScreen(); setAllActionButtonsDisabled(true); await typeLine("RECOVERING DATA ARCHIVE 01","status-line",16); await sleep(300); await typeLine("STRUCTURE ..................... REBUILT","status-line",10); await typeLine("CHECKSUM ...................... PARTIAL","warn",10); await typeLine("ARCHIVE STATE ................. RECOVERED","status-line",10); await sleep(250); await typeLine("CONTENT ANALYSIS .............. AVAILABLE","warn",10); state.actions.archive01Repaired=true; state.status.archive01="RECOVERED"; addLogEntry("Recovered Data Archive 01."); }
  updateResources(); updateSystemStatus(); refreshActionUnlocks(); saveGame(); if(state.isBusy) await finishProcess();
}

bootButton.addEventListener("click",bootSequence); continueButton.addEventListener("click",restoreSavedGame); newGameButton.addEventListener("click",startNewGame); systemDiagnosticsButton.addEventListener("click",runSystemDiagnostics);
diagnosticControls.addEventListener("click",event=>{ const button=event.target.closest("button[data-diag]"); if(button) runDiagnostic(button.dataset.diag,button); });
repairControls.addEventListener("click",event=>{ const button=event.target.closest("button[data-repair]"); if(button) runRepair(button.dataset.repair,button); });
plannedControls.addEventListener("click",event=>{ const button=event.target.closest("button[data-planned]"); if(!button||!canRunProcess(button)) return; });
configureStartMenu();
