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

const STORAGE_KEY = "pingpong_match_v2";
const OLD_STORAGE_KEY = "pingpong_cinema_data_v1";

function loadMatch() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.players) return saved;

    // Datos de la versión anterior: rescato nombres y games ganados.
    const old = JSON.parse(localStorage.getItem(OLD_STORAGE_KEY));
    if (old?.player1) {
      const match = createMatch(old.player1.name, old.player2.name);
      match.players[0].wins = old.player1.wins || 0;
      match.players[1].wins = old.player2.wins || 0;
      match.stats.totalGames = old.stats?.totalGames || 0;
      match.stats.totalPoints = old.stats?.totalPoints || 0;
      return match;
    }
  } catch {
    // Si el guardado está roto, empiezo de cero.
  }
  return createMatch();
}

let match = loadMatch();

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
};

// Aplica un cambio, guarda, redibuja y avisa si alguien ganó el game.
function commit(next) {
  if (next === match) return false;
  match = next;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(match));
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
  startTimer();
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
}

function updateUI() {
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
