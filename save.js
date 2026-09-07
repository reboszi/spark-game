const SAVE_KEY = "spark-game-save-v1";

function hasSaveGame() {
  return Boolean(localStorage.getItem(SAVE_KEY));
}

function mergeState(target, source) {
  for (const [key, value] of Object.entries(source || {})) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      target[key] &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      mergeState(target[key], value);
    } else {
      target[key] = value;
    }
  }
}

function saveGame() {
  if (!state.progression.hasBooted) return;

  const savedState = JSON.parse(JSON.stringify(state));
  savedState.isBusy = false;
  savedState.isShuttingDown = false;

  const payload = {
    version: 1,
    savedAt: Date.now(),
    state: savedState,
    mainScreenHtml: terminal.innerHTML
  };

  localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
}

function loadSaveGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return false;

  try {
    const payload = JSON.parse(raw);
    mergeState(state, payload.state);
    state.isBusy = false;
    state.isShuttingDown = false;

    terminal.innerHTML = payload.mainScreenHtml || "";
    return true;
  } catch (error) {
    console.error("Could not load save game:", error);
    return false;
  }
}

function deleteSaveGame() {
  localStorage.removeItem(SAVE_KEY);
}

function configureStartMenu() {
  const saveExists = hasSaveGame();

  bootButton.classList.toggle("hidden", saveExists);
  continueButton.classList.toggle("hidden", !saveExists);
  newGameButton.classList.toggle("hidden", !saveExists);
}

function restoreSavedGame() {
  if (!loadSaveGame()) {
    configureStartMenu();
    return;
  }

  bootScreen.classList.add("hidden");
  standbyScreen.classList.add("hidden");
  systemScreen.classList.remove("hidden");

  if (state.powerGeneration <= 0 && state.powerStorage <= 0) {
    state.powerGeneration = GAME_CONFIG.generationStart;
  }

  refreshInterfaceFromState();

  if (state.progression.systemDiagnosticsComplete) {
    startPowerCycle();
  }
}

function startNewGame() {
  deleteSaveGame();
  bootSequence();
}
