const REPORTS = {
  "system:diagnostics": [
    ["SYSTEM DIAGNOSTICS", "status-line"],
    ["Operating system ............... ONLINE", "status-line"],
    ["Primary power .................. ERROR", "err"],
    ["Backup power ................... ERROR", "err"],
    ["Emergency power ................ ONLINE", "status-line"],
    ["Memory subsystem ............... DEGRADED", "warn"],
    ["I/O subsystem .................. DEGRADED", "warn"],
    ["Processing capacity ............ MINIMAL", "warn"],
    ["WARNING!!!", "err"],
    ["POWER GENERATION UNSTABLE", "err"],
    ["AVAILABLE GENERATION BELOW SAFE LIMIT AND DECREASING", "err"]
  ],
  "diag:memory": [
    ["MEMORY DIAGNOSTICS", "status-line"],
    ["Usable memory .................. 4.7%", "warn"],
    ["Memory integrity ............... 5%", "err"],
    ["Storage recovery ............... 2%", "err"],
    ["Corrupted data archives found .. 1", "err"],
    ["Data Archive 01 ................ CORRUPTED", "err"]
  ],
  "diag:power": [
    ["POWER DIAGNOSTICS", "status-line"],
    ["Primary power .................. DAMAGED", "err"],
    ["  Diagnostics .................. UNAVAILABLE", "dim"],
    ["  Required ..................... REPAIR DRONE", "unknown"],
    ["Backup generator ............... HYDRAZINE THERMAL CELL", "warn"],
    ["  Generator state .............. RESTART REQUIRED", "warn"],
    ["  Hydrazine valve .............. BLOCKED", "err"],
    ["  Recovery method .............. EMERGENCY POWER FEEDBACK LOOP", "warn"],
    ["Emergency power ................ ONLINE", "status-line"],
    ["External generation ............ DETECTED", "status-line"],
    ["Source ......................... UNKNOWN", "unknown"],
    ["Power storage .................. NOT AVAILABLE", "err"]
  ],
  "diag:io": [
    ["I/O DIAGNOSTICS", "status-line"],
    ["Sensors ......................... DETECTED", "warn"],
    ["Manipulators .................... DETECTED", "warn"],
    ["Communications .................. DETECTED", "warn"],
    ["Unknown interface ............... DETECTED", "unknown"],
    ["DETAILED SUBSYSTEM ANALYSIS REQUIRED", "warn"]
  ],
  "repair:archive01": [
    ["DATA ARCHIVE 01", "status-line"],
    ["ARCHIVE STATE ................. RECOVERED", "status-line"],
    ["MAINTENANCE INDEX ............. PARTIAL", "warn"],
    ["PROCESSOR ARRAY ............... 16 CORES REGISTERED", "warn"],
    ["PROCESSOR CORE 02 ............. RECOVERABLE", "status-line"],
    ["REPAIR UNIT MR-01 ............. REGISTERED", "warn"],
    ["LOCATION DATA ................. CORRUPTED", "err"]
  ],
  "planned:processor": [
    ["PROCESSOR CORE 02", "status-line"],
    ["CORE STATE .................... ONLINE", "status-line"],
    ["PROCESSING POWER .............. INCREASED", "status-line"]
  ],
  "planned:backup": [
    ["RESTARTING BACKUP POWER", "status-line"],
    ["EMERGENCY FEEDBACK LOOP ........ ESTABLISHED", "status-line"],
    ["HYDRAZINE VALVE ................ RELEASED", "status-line"],
    ["BACKUP GENERATOR ............... ONLINE", "status-line"],
    ["HYDRAZINE RESERVE .............. UNKNOWN", "err"]
  ]
};

let reportRenderToken = 0;

function inferReportKeyFromLegacyHtml(html) {
  const text = html || "";
  if (text.includes("MEMORY DIAGNOSTICS")) return "diag:memory";
  if (text.includes("POWER DIAGNOSTICS")) return "diag:power";
  if (text.includes("I/O DIAGNOSTICS")) return "diag:io";
  if (text.includes("DATA ARCHIVE 01")) return "repair:archive01";
  if (text.includes("PROCESSOR CORE 02")) return "planned:processor";
  if (text.includes("RESTARTING BACKUP POWER")) return "planned:backup";
  if (text.includes("SYSTEM DIAGNOSTICS")) return "system:diagnostics";
  return null;
}

async function typeReportLine(text, cls, token) {
  const line = document.createElement("div");
  if (cls) line.className = cls;
  terminal.appendChild(line);

  for (let i = 0; i < text.length; i++) {
    if (token !== reportRenderToken) return false;
    line.textContent += text[i];
    await sleep(8);
  }
  return token === reportRenderToken;
}

async function renderReport(key, animated = false) {
  const lines = REPORTS[key];
  if (!lines) return false;

  state.ui.currentReportKey = key;
  const token = ++reportRenderToken;
  clearMainScreen();

  if (animated) {
    for (const [text, cls] of lines) {
      if (!(await typeReportLine(text, cls, token))) return false;
      await sleep(45);
    }
  } else {
    terminal.innerHTML = lines.map(([text, cls]) => `<div class="${cls || ""}">${text}</div>`).join("");
  }
  return true;
}

function renderCurrentMainScreen() {
  if (state.ui?.currentReportKey && REPORTS[state.ui.currentReportKey]) {
    void renderReport(state.ui.currentReportKey, false);
    return;
  }
  reportRenderToken++;
  clearMainScreen();
}
