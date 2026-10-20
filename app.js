import {
  createMatch,
  addPoint,
  removePoints,
  awardGame,
  removeGame,
  resetGame,
  undo,
  canUndo,
  currentServer,
  renamePlayer,
  parseCommand,
} from "./game.js";
import {
  loadStore,
  saveStore,
  activeSession,
  updateActiveMatch,
  createSession,
  switchSession,
  deleteSession,
  exportStore,
  importStore,
  sessionName,
} from "./sessions.js";
import {
  DEFAULT_BINDINGS,
  actionForKey,
  loadBindings,
  saveBindings,
  startLearning,
  press,
  skip,
  keyLabel,
} from "./controls.js";

let store = loadStore(localStorage);
let match = activeSession(store).match;

// Pide al navegador que no borre los datos cuando le falta espacio o pasan días sin abrir la página.
navigator.storage?.persist?.().catch(() => {});

const els = {
  player1Input: document.getElementById("player1"),
  player2Input: document.getElementById("player2"),
  names: [document.getElementById("name1"), document.getElementById("name2")],
  scores: [document.getElementById("score1"), document.getElementById("score2")],
  wins: [document.getElementById("wins1"), document.getElementById("wins2")],
  serves: [document.getElementById("serve1"), document.getElementById("serve2")],
  flashes: [document.getElementById("flash1"), document.getElementById("flash2")],
  voiceBtn: document.getElementById("voiceBtn"),
  voiceStatus: document.getElementById("voiceStatus"),
  lastCommand: document.getElementById("lastCommand"),
  notification: document.getElementById("notification"),
  celebration: document.getElementById("celebration"),
  celebrationText: document.getElementById("celebrationText"),
  p1Plus: document.getElementById("p1Plus"),
  p2Plus: document.getElementById("p2Plus"),
  p1Minus: document.getElementById("p1Minus"),
  p2Minus: document.getElementById("p2Minus"),
  p1Win: document.getElementById("p1Win"),
  p2Win: document.getElementById("p2Win"),
  undoBtn: document.getElementById("undoBtn"),
  resetScore: document.getElementById("resetScore"),
  toggleStats: document.getElementById("toggleStats"),
  statsSection: document.getElementById("statsSection"),
  totalPoints: document.getElementById("totalPoints"),
  totalGames: document.getElementById("totalGames"),
  longestStreak: document.getElementById("longestStreak"),
  sessionTime: document.getElementById("sessionTime"),
  sessionSelect: document.getElementById("sessionSelect"),
  newSessionBtn: document.getElementById("newSessionBtn"),
  newSessionForm: document.getElementById("newSessionForm"),
  newRival: document.getElementById("newRival"),
  cancelNewSession: document.getElementById("cancelNewSession"),
  gameLog: document.getElementById("gameLog"),
  gameLogEmpty: document.getElementById("gameLogEmpty"),
  exportBtn: document.getElementById("exportBtn"),
  importBtn: document.getElementById("importBtn"),
  importFile: document.getElementById("importFile"),
  deleteSessionBtn: document.getElementById("deleteSessionBtn"),
  controlsInfo: document.getElementById("controlsInfo"),
  learnPrompt: document.getElementById("learnPrompt"),
  learnBtn: document.getElementById("learnBtn"),
  resetControlsBtn: document.getElementById("resetControlsBtn"),
  skipLearnBtn: document.getElementById("skipLearnBtn"),
  wakeStatus: document.getElementById("wakeStatus"),
};

function persist() {
  store = updateActiveMatch(store, match);
  try {
    saveStore(localStorage, store);
  } catch {
    showNotification("No se pudo guardar: exportá un respaldo");
  }
}

// Cambia el estado entero (otra sesión, respaldo importado) y redibuja.
function loadSession(nextStore) {
  store = nextStore;
  match = activeSession(store).match;
  persist();
  updateUI();
}

// Aplica un cambio, guarda, redibuja y avisa si alguien ganó el game.
function commit(next) {
  if (next === match) return false;
  match = next;
  persist();
  updateUI();
  if (match.lastWinner !== null) {
    const name = match.players[match.lastWinner].name;
    celebrate();
    showNotification(`Game para ${name}`);
    speak(`Game para ${name}`);
  }
  return true;
}

function point(player, amount = 1) {
  let next = match;
  for (let i = 0; i < amount; i++) next = addPoint(next, player);
  commit(next);
  highlightPlayer(player);
  if (match.lastWinner === null) {
    const [a, b] = match.players.map((p) => p.score);
    speak(`${a} a ${b}`);
  }
}

function subtract(player, amount = 1) {
  if (commit(removePoints(match, player, amount))) speak(`Menos ${player + 1}`);
}

function undoLast() {
  if (commit(undo(match))) speak("Deshecho");
}

function init() {
  updateUI();
  setupEventListeners();
  setupControls();
  keepScreenOn();
  startTimer();
  registerServiceWorker();
}

// ---------- Control Bluetooth / teclado ----------

let bindings = loadBindings(localStorage);
let learning = null;

const ACTION_LABELS = {
  p1: () => `Punto ${match.players[0].name}`,
  p2: () => `Punto ${match.players[1].name}`,
  undo: () => "Deshacer",
};

function setupControls() {
  document.addEventListener("keydown", (e) => {
    if (learning) {
      e.preventDefault();
      learning = press(learning, e.key);
      if (learning.done) finishLearning();
      renderControls();
      return;
    }
    const action = actionForKey(bindings, e);
    if (!action) return;
    e.preventDefault();
    if (action === "p1") point(0);
    else if (action === "p2") point(1);
    else undoLast();
  });

  els.learnBtn.addEventListener("click", () => {
    learning = learning ? null : startLearning();
    els.learnBtn.blur();
    renderControls();
  });
  els.skipLearnBtn.addEventListener("click", () => {
    learning = skip(learning);
    if (learning.done) finishLearning();
    renderControls();
  });
  els.resetControlsBtn.addEventListener("click", () => {
    learning = null;
    bindings = DEFAULT_BINDINGS;
    localStorage.removeItem("pingpong_controls_v1");
    renderControls();
    showNotification("Botones de fábrica");
  });
  renderControls();
}

function finishLearning() {
  bindings = learning.learned;
  saveBindings(localStorage, bindings);
  learning = null;
  showNotification("Control configurado");
}

function renderControls() {
  els.controlsInfo.replaceChildren(
    ...Object.keys(ACTION_LABELS).map((action) => {
      const li = document.createElement("li");
      li.className = "flex justify-between border-b border-white/10 py-1";
      const what = document.createElement("span");
      what.textContent = ACTION_LABELS[action]();
      const keys = document.createElement("span");
      keys.className = "text-white/60";
      keys.textContent = bindings[action].length ? bindings[action].map(keyLabel).join(" / ") : "—";
      li.append(what, keys);
      return li;
    }),
  );

  const steps = ["p1", "p2", "undo"];
  els.learnPrompt.classList.toggle("hidden", !learning);
  els.skipLearnBtn.classList.toggle("hidden", !learning || steps[learning.step] !== "undo");
  els.learnBtn.textContent = learning ? "Cancelar" : "Configurar botones";
  if (learning) {
    const what = ACTION_LABELS[steps[learning.step]]().toLowerCase();
    els.learnPrompt.textContent = learning.rejected
      ? `Ese botón ya está usado. Apretá otro para: ${what}`
      : `Apretá el botón para: ${what}`;
  }
}

// ---------- Pantalla encendida ----------

let wakeLock = null;

async function keepScreenOn() {
  if (!("wakeLock" in navigator)) {
    els.wakeStatus.textContent = "Este navegador no puede dejar la pantalla encendida";
    return;
  }
  const request = async () => {
    if (document.visibilityState !== "visible" || wakeLock) return;
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      els.wakeStatus.textContent = "● Pantalla siempre encendida";
      wakeLock.addEventListener("release", () => {
        wakeLock = null;
      });
    } catch {
      els.wakeStatus.textContent = "Tocá la pantalla para dejarla encendida";
    }
  };
  // El navegador suelta el bloqueo al cambiar de pestaña: lo pido de nuevo al volver.
  document.addEventListener("visibilitychange", request);
  document.addEventListener("click", request);
  await request();
}

// ---------- Sin internet ----------

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

function setupEventListeners() {
  els.player1Input.addEventListener("input", (e) => {
    commit(renamePlayer(match, 0, e.target.value || "Jugador 1"));
  });
  els.player2Input.addEventListener("input", (e) => {
    commit(renamePlayer(match, 1, e.target.value || "Jugador 2"));
  });

  els.p1Plus.addEventListener("click", () => point(0));
  els.p2Plus.addEventListener("click", () => point(1));
  els.p1Minus.addEventListener("click", () => subtract(0));
  els.p2Minus.addEventListener("click", () => subtract(1));
  els.p1Win.addEventListener("click", () => commit(awardGame(match, 0)));
  els.p2Win.addEventListener("click", () => commit(awardGame(match, 1)));
  els.undoBtn.addEventListener("click", undoLast);

  els.resetScore.addEventListener("click", () => {
    commit(resetGame(match));
    speak("Reiniciado");
  });

  els.toggleStats.addEventListener("click", () => {
    els.statsSection.classList.toggle("hidden");
    const isHidden = els.statsSection.classList.contains("hidden");
    els.toggleStats.textContent = isHidden ? "Mostrar Stats" : "Ocultar Stats";
  });

  els.voiceBtn.addEventListener("click", toggleVoice);
  setupSessionListeners();
}

function setupSessionListeners() {
  els.sessionSelect.addEventListener("change", (e) => {
    loadSession(switchSession(store, e.target.value));
    showNotification(sessionName(match));
  });

  const closeForm = () => {
    els.newSessionForm.classList.add("hidden");
    els.newRival.value = "";
  };
  els.newSessionBtn.addEventListener("click", () => {
    els.newSessionForm.classList.toggle("hidden");
    if (!els.newSessionForm.classList.contains("hidden")) els.newRival.focus();
  });
  els.cancelNewSession.addEventListener("click", closeForm);
  els.newSessionForm.addEventListener("submit", (e) => {
    e.preventDefault();
    loadSession(createSession(store, els.newRival.value));
    closeForm();
    showNotification(`Sesión nueva: ${sessionName(match)}`);
  });

  els.deleteSessionBtn.addEventListener("click", () => {
    const name = sessionName(match);
    if (!confirm(`¿Borrar la sesión ${name}? Se pierden sus games.`)) return;
    loadSession(deleteSession(store, store.activeId));
    showNotification(`Sesión borrada: ${name}`);
  });

  els.exportBtn.addEventListener("click", () => {
    const blob = new Blob([exportStore(store)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `pingpong-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  });

  els.importBtn.addEventListener("click", () => els.importFile.click());
  els.importFile.addEventListener("change", async () => {
    const file = els.importFile.files[0];
    els.importFile.value = "";
    if (!file) return;
    try {
      const before = store.sessions.length;
      loadSession(importStore(store, await file.text()));
      showNotification(`Respaldo importado: ${store.sessions.length - before} sesiones nuevas`);
    } catch (err) {
      showNotification(err.message);
    }
  });
}

function renderSessions() {
  els.sessionSelect.replaceChildren(
    ...store.sessions.map((s) => {
      const option = document.createElement("option");
      option.value = s.id;
      option.textContent = sessionName(s.match);
      option.selected = s.id === store.activeId;
      return option;
    }),
  );
}

const dateFormat = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function renderGameLog() {
  const games = (match.games ?? []).slice(-10).reverse();
  els.gameLogEmpty.classList.toggle("hidden", games.length > 0);
  els.gameLog.replaceChildren(
    ...games.map((g) => {
      const li = document.createElement("li");
      li.className = "flex justify-between border-b border-white/10 py-1";
      const when = document.createElement("span");
      when.className = "text-white/50";
      when.textContent = dateFormat.format(g.at);
      const result = document.createElement("span");
      result.textContent = `${match.players[g.winner].name} ${Math.max(...g.score)}-${Math.min(...g.score)}`;
      li.append(when, result);
      return li;
    }),
  );
}

function updateUI() {
  renderSessions();
  if (els.controlsInfo.children.length) renderControls();
  renderGameLog();
  const server = currentServer(match);
  match.players.forEach((p, i) => {
    els.names[i].textContent = p.name;
    els.scores[i].textContent = p.score;
    els.wins[i].textContent = p.wins;
    els.serves[i].classList.toggle("invisible", i !== server);
  });
  if (document.activeElement !== els.player1Input) els.player1Input.value = match.players[0].name;
  if (document.activeElement !== els.player2Input) els.player2Input.value = match.players[1].name;

  els.undoBtn.disabled = !canUndo(match);
  els.totalPoints.textContent = match.stats.totalPoints;
  els.totalGames.textContent = match.stats.totalGames;
  els.longestStreak.textContent = match.stats.longestStreak;
}

function highlightPlayer(player) {
  const flashEl = els.flashes[player];
  flashEl.classList.remove("hidden");
  flashEl.classList.add("animate-borderPulse");

  setTimeout(() => {
    flashEl.classList.remove("animate-borderPulse");
    flashEl.classList.add("hidden");
  }, 600);
}

function showNotification(msg) {
  els.notification.textContent = msg;
  els.notification.classList.remove("translate-x-[150%]");
  els.notification.classList.add("translate-x-0");

  setTimeout(() => {
    els.notification.classList.remove("translate-x-0");
    els.notification.classList.add("translate-x-[150%]");
  }, 3000);
}

function celebrate() {
  els.celebration.classList.remove("hidden");
  els.celebration.classList.add("flex");
  els.celebration.classList.add("animate-fadeOut");

  els.celebrationText.textContent = "VICTORIA";
  els.celebrationText.classList.add("animate-celebrateZoom");

  setTimeout(() => {
    els.celebration.classList.add("hidden");
    els.celebration.classList.remove("flex", "animate-fadeOut");
    els.celebrationText.classList.remove("animate-celebrateZoom");
  }, 1500);
}

function startTimer() {
  const tick = () => {
    const diff = Math.floor((Date.now() - match.stats.sessionStart) / 1000);
    els.sessionTime.textContent = `${Math.floor(diff / 60)}m`;
  };
  tick();
  setInterval(tick, 60000);
}

// ---------- Voz ----------

let recognition = null;
let isListening = false;

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  // Cancelo lo anterior: siempre importa más el marcador nuevo.
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "es-ES";
  utterance.rate = 1.2;
  window.speechSynthesis.speak(utterance);
}

function toggleVoice() {
  if (isListening) stopVoice();
  else startVoice();
}

function startVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showNotification("Tu navegador no soporta reconocimiento de voz");
    return;
  }

  if (!recognition) {
    recognition = new SpeechRecognition();
    recognition.lang = "es-ES";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      isListening = true;
      els.voiceBtn.classList.add("active", "bg-white/10", "border-white");
      els.voiceStatus.textContent = "Escuchando...";
      els.voiceStatus.classList.add("animate-blink");
    };

    recognition.onend = () => {
      if (isListening) {
        setTimeout(() => {
          try {
            recognition.start();
          } catch {
            // Ya estaba arrancando.
          }
        }, 100);
      } else {
        els.voiceBtn.classList.remove("active", "bg-white/10", "border-white");
        els.voiceStatus.textContent = "Presiona para activar";
        els.voiceStatus.classList.remove("animate-blink");
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "network") {
        showNotification("Error de red");
        stopVoice();
      } else if (event.error === "not-allowed") {
        showNotification("Permiso denegado");
        stopVoice();
      }
    };

    recognition.onresult = (event) => {
      let bestTranscript = "";
      let bestConfidence = 0;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result.isFinal) continue;
        for (let j = 0; j < result.length; j++) {
          if (result[j].confidence > bestConfidence) {
            bestConfidence = result[j].confidence;
            bestTranscript = result[j].transcript.trim();
          }
        }
      }

      if (bestTranscript && bestConfidence > 0.3) {
        els.lastCommand.textContent = `"${bestTranscript}"`;
        processVoiceCommand(bestTranscript);
      }
    };
  }

  try {
    recognition.start();
  } catch (e) {
    console.error("No se pudo iniciar:", e);
  }
}

function stopVoice() {
  isListening = false;
  if (recognition) recognition.stop();
  els.voiceBtn.classList.remove("active", "bg-white/10", "border-white");
  els.voiceStatus.textContent = "Presiona para activar";
  els.voiceStatus.classList.remove("animate-blink");
}

let lastCommandTime = 0;
const COMMAND_DEBOUNCE = 500;

function processVoiceCommand(text) {
  const now = Date.now();
  if (now - lastCommandTime < COMMAND_DEBOUNCE) return;
  lastCommandTime = now;

  const command = parseCommand(text, match.players.map((p) => p.name));
  if (!command) return;

  switch (command.type) {
    case "undo":
      undoLast();
      break;
    case "reset":
      commit(resetGame(match));
      speak("Reiniciado");
      break;
    case "awardGame":
      commit(awardGame(match, command.player));
      break;
    case "removeGame":
      if (commit(removeGame(match, command.player))) {
        showNotification(`Victoria quitada a ${match.players[command.player].name}`);
      }
      break;
    case "subtract":
      subtract(command.player, command.amount);
      break;
    case "point":
      point(command.player, command.amount);
      break;
  }
}

init();
