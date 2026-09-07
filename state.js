const GAME_CONFIG = {
  generationStart: 8,
  generationTickMs: 12000,
  standbyDurationMs: 3200
};

const state = {
  powerGeneration: GAME_CONFIG.generationStart,
  powerGenerationMax: GAME_CONFIG.generationStart,
  powerStorage: 0,
  powerStorageMax: 0,

  memory: 6,
  memoryMax: 128,

  processingPower: 1,
  processingPowerMax: 16,

  isBusy: false,
  isShuttingDown: false,

  progression: {
    hasBooted: false,
    systemDiagnosticsComplete: false
  },

  logEntries: [],

  status: {
    operatingSystem: "ONLINE",
    systemIntegrity: 0,

    primaryPower: "ERROR",
    backupPower: "RESTART REQUIRED",
    emergencyPower: "ONLINE",

    memoryIntegrity: "SEVERE",
    storageAccess: "PARTIAL",
    storageRecovered: 0.5,
    corruptedArchivesFound: 0,
    archive01: "CORRUPTED",

    sensors: "DETECTED",
    manipulators: "DETECTED",
    communications: "DETECTED",
    unknownInterfaces: "DETECTED"
  },

  revealed: {
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

    memoryIntegrity: false,
    storageAccess: false,
    storageRecovered: false,
    corruptedArchivesFound: false,
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
    backupRestarted: false,
    primaryPowerRepaired: false
  }
};
