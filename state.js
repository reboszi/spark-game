const GAME_CONFIG = {
  generationStart: 8,
  generationTickMs: 12000,
  standbyDurationMs: 3200,
  backupGeneration: 4,
  hydrazineBurnIntervalSeconds: 60
};

const state = {
  powerGeneration: GAME_CONFIG.generationStart,
  powerGenerationMax: GAME_CONFIG.generationStart,
  powerGenerationTickProgressSeconds: 0,
  externalRecoverySecondsRemaining: 0,
  powerStorage: 0,
  powerStorageMax: 0,

  memory: 6,
  memoryMax: 128,

  processingPower: 1,
  processingPowerMax: 16,

  systemTimeSeconds: 0,
  resetCountdownSeconds: Math.round((GAME_CONFIG.generationStart * GAME_CONFIG.generationTickMs) / 1000),
  accumulatedTimeSeconds: 0,
  lastSeenAt: Date.now(),

  isBusy: false,
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

    primaryPower: "ERROR",
    primaryPowerCondition: "DAMAGED",
    primaryPowerDiagnostics: "UNAVAILABLE",

    backupPower: "STOPPED",
    backupGenerator: "HYDRAZINE THERMAL CELL",
    backupFault: "HYDRAZINE VALVE BLOCKED",
    backupRestartMethod: "EMERGENCY POWER FEEDBACK LOOP",

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

function resetStateToDefaults() {
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, JSON.parse(JSON.stringify(INITIAL_STATE)));
}
