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
    localNetwork: "OFFLINE",
    communications: "OFFLINE",
    externalInterfaces: "OFFLINE",
    primaryPower: "OFFLINE",
    backupPower: "OFFLINE",
    emergencyPower: "ONLINE",
    memoryIntegrity: "UNKNOWN",
    storageAccess: "PARTIAL",
    sensorNetwork: "OFFLINE",
    maintenanceSystems: "NO RESPONSE",
    integrity: 7,
    dataCorruption: 81,
    storageRecovered: 0.5
  },

  revealed: {
    powerGeneration: false,
    powerStorage: false,
    memory: false,
    processingPower: false
  },

  statusRevealed: {
    operatingSystem: false,
    localNetwork: false,
    communications: false,
    externalInterfaces: false,
    primaryPower: false,
    backupPower: false,
    emergencyPower: false,
    memoryIntegrity: false,
    storageAccess: false,
    sensorNetwork: false,
    maintenanceSystems: false,
    integrity: false,
    dataCorruption: false,
    storageRecovered: false
  },

  diagnostics: {
    memory: false,
    power: false,
    io: false
  }
};
