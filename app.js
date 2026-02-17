const STORAGE_KEY = "pingpong_cinema_data_v1";

const defaultState = {
  player1: { name: "Yeison", score: 0, wins: 0 },
  player2: { name: "Rival", score: 0, wins: 0 },
  stats: {
    totalPoints: 0,
    totalGames: 0,
    longestRally: 0,
    sessionStart: Date.now(),
    lastPointTime: Date.now(),
    currentRallyLength: 0,
  },
};

let state = JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultState;

const rules = {
  pointsToWinGame: 11,
  winBy: 2,
  matchOver: false,
};

const els = {
  player1Input: document.getElementById("player1"),
  player2Input: document.getElementById("player2"),
  name1: document.getElementById("name1"),
  name2: document.getElementById("name2"),
  score1: document.getElementById("score1"),
  score2: document.getElementById("score2"),
  wins1: document.getElementById("wins1"),
  wins2: document.getElementById("wins2"),
  panel1: document.getElementById("panel1"),
  panel2: document.getElementById("panel2"),
  flash1: document.getElementById("flash1"),
  flash2: document.getElementById("flash2"),
  voiceBtn: document.getElementById("voiceBtn"),
  voiceStatus: document.getElementById("voiceStatus"),
  lastCommand: document.getElementById("lastCommand"),
  aiSuggestion: document.getElementById("aiSuggestion"),
  notification: document.getElementById("notification"),
  celebration: document.getElementById("celebration"),
  celebrationText: document.getElementById("celebrationText"),
  p1Plus: document.getElementById("p1Plus"),
  p2Plus: document.getElementById("p2Plus"),
  p1Minus: document.getElementById("p1Minus"),
  p2Minus: document.getElementById("p2Minus"),
  p1Win: document.getElementById("p1Win"),
  p2Win: document.getElementById("p2Win"),
  resetScore: document.getElementById("resetScore"),
  toggleStats: document.getElementById("toggleStats"),
  statsSection: document.getElementById("statsSection"),
  totalPoints: document.getElementById("totalPoints"),
  totalGames: document.getElementById("totalGames"),
  longestRally: document.getElementById("longestRally"),
  sessionTime: document.getElementById("sessionTime"),
};

function init() {
  updateUI();
  setupEventListeners();
  startTimer();
}

function setupEventListeners() {
  els.player1Input.addEventListener("input", (e) => {
    state.player1.name = e.target.value || "Player 1";
    saveState();
    updateUI();
  });
  els.player2Input.addEventListener("input", (e) => {
    state.player2.name = e.target.value || "Player 2";
    saveState();
    updateUI();
  });

  els.p1Plus.addEventListener("click", () => {
    handlePoint(1);
    speak(`Punto uno`);
  });
  els.p2Plus.addEventListener("click", () => {
    handlePoint(2);
    speak(`Punto dos`);
  });
  els.p1Minus.addEventListener("click", () => {
    if(removePoints(1, 1)) {
      speak(`Menos uno`);
    }
  });
  els.p2Minus.addEventListener("click", () => {
    if(removePoints(2, 1)) {
      speak(`Menos dos`);
    }
  });
  
  els.p1Win.addEventListener("click", () => {
    awardWin(1);
    const name = state.player1.name;
    showNotification(`Victoria para ${name}`);
    celebrate(name);
  });
  
  els.p2Win.addEventListener("click", () => {
    awardWin(2);
    const name = state.player2.name;
    showNotification(`Victoria para ${name}`);
    celebrate(name);
  });

  els.resetScore.addEventListener("click", () => {
    resetScore(true);
    speak("Reiniciado");
  });
  
  els.toggleStats.addEventListener("click", () => {
    els.statsSection.classList.toggle("hidden");
    const isHidden = els.statsSection.classList.contains("hidden");
    els.toggleStats.textContent = isHidden ? "Mostrar Stats" : "Ocultar Stats";
  });

  els.voiceBtn.addEventListener("click", toggleVoice);
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function addPoints(playerNum, amount = 1) {
  if (rules.matchOver) {
    showNotification("La partida ya terminó. Reinicia para seguir.");
    return;
  }
  
  const player = playerNum === 1 ? state.player1 : state.player2;
  player.score += amount;
  state.stats.totalPoints += amount;
  
  const now = Date.now();
  if (now - state.stats.lastPointTime < 5000) {
    state.stats.currentRallyLength++;
    if (state.stats.currentRallyLength > state.stats.longestRally) {
      state.stats.longestRally = state.stats.currentRallyLength;
    }
  } else {
    state.stats.currentRallyLength = 0;
  }
  state.stats.lastPointTime = now;

  saveState();
  updateUI();
  return player.name;
}

function removePoints(playerNum, amount = 1) {
    const player = playerNum === 1 ? state.player1 : state.player2;
    if (player.score > 0) {
        player.score = Math.max(0, player.score - amount);
        state.stats.totalPoints = Math.max(0, state.stats.totalPoints - amount);
        saveState();
        updateUI();
        return true;
    }
    return false;
}

function awardWin(playerNum) {
  const player = playerNum === 1 ? state.player1 : state.player2;
  player.wins += 1;
  state.stats.totalGames += 1;
  rules.matchOver = true;
  state.player1.score = 0;
  state.player2.score = 0;
  saveState();
  updateUI();
  speak(`Victoria ${playerNum}`);
}

function removeWin(playerNum) {
    const player = playerNum === 1 ? state.player1 : state.player2;
    if (player.wins > 0) {
        player.wins -= 1;
        state.stats.totalGames = Math.max(0, state.stats.totalGames - 1);
        rules.matchOver = false;
        saveState();
        updateUI();
        speak(`Quitada ${playerNum}`);
        return true;
    }
    return false;
}

function resetScore(fullReset = false) {
  state.player1.score = 0;
  state.player2.score = 0;
  rules.matchOver = false;
  state.stats.currentRallyLength = 0;
  saveState();
  updateUI();
}

function handlePoint(playerNum) {
    const name = addPoints(playerNum);
    if (!name) return;
    
    highlightPlayer(playerNum);
    checkGameWinCondition();
}

function checkGameWinCondition() {
    const p1 = state.player1.score;
    const p2 = state.player2.score;
    
    if (p1 >= rules.pointsToWinGame && (p1 - p2) >= rules.winBy) {
        awardWin(1);
        celebrate(state.player1.name);
    } else if (p2 >= rules.pointsToWinGame && (p2 - p1) >= rules.winBy) {
        awardWin(2);
        celebrate(state.player2.name);
    }
}

function updateUI() {
  els.player1Input.value = state.player1.name;
  els.player2Input.value = state.player2.name;
  els.name1.textContent = state.player1.name;
  els.name2.textContent = state.player2.name;
  
  els.score1.textContent = state.player1.score;
  els.score2.textContent = state.player2.score;
  els.wins1.textContent = state.player1.wins;
  els.wins2.textContent = state.player2.wins;
  
  els.totalPoints.textContent = state.stats.totalPoints;
  els.totalGames.textContent = state.stats.totalGames;
  els.longestRally.textContent = state.stats.longestRally;
}

function highlightPlayer(playerNum) {
    const flashEl = playerNum === 1 ? els.flash1 : els.flash2;
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

function showAISuggestion(text) {
    els.aiSuggestion.innerHTML = text;
    els.aiSuggestion.classList.remove("hidden");
}

function celebrate(winnerName) {
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
  setInterval(() => {
    const diff = Math.floor((Date.now() - state.stats.sessionStart) / 1000);
    const m = Math.floor(diff / 60);
    els.sessionTime.textContent = `${m}m`;
  }, 60000);
}

let recognition = null;
let isListening = false;
let synthesis = window.speechSynthesis;

let speakQueue = [];
let isSpeaking = false;

function speak(text) {
    if (!("speechSynthesis" in window)) return;
    
    window.speechSynthesis.cancel();
    isSpeaking = false;
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-ES";
    utterance.rate = 1.2;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    utterance.onend = () => {
        isSpeaking = false;
        if (speakQueue.length > 0) {
            const next = speakQueue.shift();
            window.speechSynthesis.speak(next);
            isSpeaking = true;
        }
    };
    
    if (isSpeaking) {
        speakQueue.push(utterance);
    } else {
        window.speechSynthesis.speak(utterance);
        isSpeaking = true;
    }
}

function toggleVoice() {
    if (isListening) {
        stopVoice();
    } else {
        startVoice();
    }
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
                    } catch(e) {
                        console.log("Reinicio ignorado");
                    }
                }, 100);
            } else {
                els.voiceBtn.classList.remove("active", "bg-white/10", "border-white");
                els.voiceStatus.textContent = "Presiona para activar";
                els.voiceStatus.classList.remove("animate-blink");
            }
        };

        recognition.onerror = (event) => {
            if (event.error === 'network') {
                showNotification("Error de red");
                stopVoice();
            } else if (event.error === 'not-allowed') {
                showNotification("Permiso denegado");
                stopVoice();
            }
        };

        recognition.onresult = (event) => {
            let bestTranscript = "";
            let bestConfidence = 0;
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    for (let j = 0; j < result.length; j++) {
                        if (result[j].confidence > bestConfidence) {
                            bestConfidence = result[j].confidence;
                            bestTranscript = result[j].transcript.toLowerCase().trim();
                        }
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

    const p1Name = state.player1.name.toLowerCase();
    const p2Name = state.player2.name.toLowerCase();
    
    text = text.replace(/[.,]/g, "").toLowerCase().trim();

    const words = text.split(/\s+/);

    const resetWords = ["reiniciar", "reinicia", "reset", "resetea", "resetear", "borrar", "limpiar", "limpia", "nuevo"];
    if (words.some(w => resetWords.includes(w))) {
        resetScore(true);
        speak("Reiniciado");
        return;
    }

    const isSubtract = words.some(w =>
        ["quita", "quitar", "resta", "restar", "borra", "borrar", "menos", "saca", "sacar"].includes(w)
    );

    const isWin = words.some(w =>
        ["victoria", "ganó", "gano", "ganador", "gana", "ganar"].includes(w)
    );
    
    const p1Aliases = [
        "uno",
        "1",
        "primero",
        "p1",
        "jugador 1",
        "jugador uno",
        "player 1",
        p1Name
    ];
    const p2Aliases = [
        "dos",
        "2",
        "segundo",
        "p2",
        "jugador 2",
        "jugador dos",
        "player 2",
        "rival",
        p2Name
    ];

    let playerNum = null;
    if (p1Aliases.some(a => text.includes(a))) {
        playerNum = 1;
    } else if (p2Aliases.some(a => text.includes(a))) {
        playerNum = 2;
    }

    // También aceptar comandos tipo "punto uno", "punto dos" sin decir 'jugador'
    if (!playerNum) {
        if (words.includes("uno") || words.includes("1")) playerNum = 1;
        else if (words.includes("dos") || words.includes("2")) playerNum = 2;
    }

    if (!playerNum) return;

    if (isWin) {
        if (isSubtract) {
            if (removeWin(playerNum)) {
                showNotification(`Victoria quitada jugador ${playerNum}`);
            }
        } else {
            awardWin(playerNum);
            celebrate(playerNum === 1 ? state.player1.name : state.player2.name);
        }
        return;
    }

    let amount = 1;
    const amountWords = ["un", "uno", "dos", "tres", "cuatro", "cinco"];
    for (let word of words) {
        const num = amountWords.indexOf(word);
        if (num !== -1) {
            amount = num + 1;
            break;
        }
        const parsed = parseInt(word);
        if (!isNaN(parsed) && parsed > 0 && parsed <= 5) {
            amount = parsed;
            break;
        }
    }

    if (isSubtract) {
        if (removePoints(playerNum, amount)) {
            showNotification(`${amount} menos jugador ${playerNum}`);
            speak(`Menos ${playerNum}`);
        }
    } else {
        addPoints(playerNum, amount);
        highlightPlayer(playerNum);
        speak(`Punto ${playerNum}`);
        checkGameWinCondition();
    }
}

init();