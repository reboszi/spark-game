const GAME_CONFIG = {
  generationStart: 8,
  generationTickMs: 12000,
  standbyDurationMs: 3200,
  backupGeneration: 4,
  hydrazineBurnIntervalSeconds: 60,
  runtimeTickMs: 100,
  autosaveIntervalSeconds: 5,
  maxActiveTickGapSeconds: 2
};

const state = {
  powerGeneration: GAME_CONFIG.generationStart,
  powerGenerationTickProgressSeconds: 0,
  externalRecoverySecondsRemaining: 0,
  powerStorage: 0,
  powerStorageMax: 0,

  memory: 6,
  memoryMax: 128,

  processingPower: 1,
  processingPowerMax: 16,

  systemTimeSeconds: 0,
  accumulatedTimeSeconds: 0,

  isShuttingDown: false,

  ui: {
    currentReportKey: null,
    currentView: "MAIN"
  },

  progression: {
    hasBooted: false,
    systemDiagnosticsComplete: false,
    firstResetSeen: false,
    taskbarUnlocked: false,
    navigationUnlocked: false,
    controlPanelUnlocked: false,
    secondaryResourcesUnlocked: false,
    processorArrayKnown: false
  },

  logEntries: [],
  timelineEntries: [],
  runningTasks: [],

  capabilities: {
    repairDrone: false
  },

  controls: {
    backupGeneratorOn: false,
    backupGeneratorUnlocked: false
  },

  secondaryResources: {
    hydrazineKnown: false,
    hydrazineReserveHidden: 100,
    hydrazineBurnSeconds: 0,
    hydrazineTrend: "STABLE"
  },

  status: {
    operatingSystem: "ONLINE",
    systemIntegrity: 0,
    primaryPowerCondition: "DAMAGED",
    primaryPowerDiagnostics: "UNAVAILABLE",
    backupPower: "STOPPED",
    emergencyPower: "ONLINE",
    memoryIntegrity: 5,
    storageRecovered: 2,
    archive01: "CORRUPTED",
    sensors: "DETECTED",
    manipulators: "DETECTED",
    communications: "DETECTED",
    unknownInterfaces: "DETECTED"
  },

  revealed: {
    systemTime: false,
    powerGeneration: false,
    powerStorage: false,
    memory: false,
    processingPower: false
  },

  statusRevealed: {
    operatingSystem: false,
    systemIntegrity: false,
    primaryPower: false,
    backupPower: false,
    emergencyPower: false,
    storageRecovered: false,
    archive01: false,
    sensors: false,
    manipulators: false,
    communications: false,
    unknownInterfaces: false
  },

  diagnostics: {
    memory: false,
    power: false,
    io: false
  },

  actions: {
    archive01Repaired: false,
    processorCore02Online: false,
    backupRestarted: false,
    primaryPowerRepaired: false
  }
};

const INITIAL_STATE = JSON.parse(JSON.stringify(state));

function syncDerivedState() {
  const systemKnown = Boolean(state.progression.systemDiagnosticsComplete);
  const memoryKnown = Boolean(state.diagnostics.memory);
  const powerKnown = Boolean(state.diagnostics.power);
  const ioKnown = Boolean(state.diagnostics.io);
  const allDiagnosticsKnown = memoryKnown && powerKnown && ioKnown;

  if (!state.actions.backupRestarted) state.controls.backupGeneratorOn = false;

  state.progression.taskbarUnlocked = Boolean(systemKnown || state.runningTasks.length);
  state.progression.navigationUnlocked = Boolean(state.progression.firstResetSeen);
  state.progression.controlPanelUnlocked = powerKnown;
  state.progression.secondaryResourcesUnlocked = Boolean(state.actions.backupRestarted);
  state.progression.processorArrayKnown = Boolean(state.actions.archive01Repaired);
  state.controls.backupGeneratorUnlocked = Boolean(state.actions.backupRestarted);

  state.revealed.systemTime = systemKnown;
  state.revealed.powerGeneration = systemKnown;
  state.revealed.processingPower = systemKnown;
  state.revealed.memory = memoryKnown;
  state.revealed.powerStorage = powerKnown;

  state.statusRevealed.operatingSystem = systemKnown;
  state.statusRevealed.emergencyPower = systemKnown;
  state.statusRevealed.primaryPower = powerKnown;
  state.statusRevealed.backupPower = powerKnown;
  state.statusRevealed.storageRecovered = memoryKnown;
  state.statusRevealed.archive01 = memoryKnown;
  state.statusRevealed.sensors = ioKnown;
  state.statusRevealed.manipulators = ioKnown;
  state.statusRevealed.communications = ioKnown;
  state.statusRevealed.unknownInterfaces = ioKnown;
  state.statusRevealed.systemIntegrity = allDiagnosticsKnown;

  state.secondaryResources.hydrazineTrend = state.controls.backupGeneratorOn ? "DECREASING" : "STABLE";
  state.status.memoryIntegrity = state.memoryMax > 0 ? Math.round((state.memory / state.memoryMax) * 100) : 0;
  state.status.archive01 = state.actions.archive01Repaired ? "RECOVERED" : "CORRUPTED";
  state.status.backupPower = state.actions.backupRestarted && state.controls.backupGeneratorOn ? "ONLINE" : "STOPPED";
}

function resetStateToDefaults() {
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, JSON.parse(JSON.stringify(INITIAL_STATE)));
  syncDerivedState();
}
