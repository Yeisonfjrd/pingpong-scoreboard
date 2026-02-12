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
    speak(`1 punto jugador 1`);
  });
  els.p2Plus.addEventListener("click", () => {
    handlePoint(2);
    speak(`1 punto jugador 2`);
  });
  els.p1Minus.addEventListener("click", () => {
    if(removePoints(1, 1)) {
      speak(`1 punto menos jugador 1`);
    }
  });
  els.p2Minus.addEventListener("click", () => {
    if(removePoints(2, 1)) {
      speak(`1 punto menos jugador 2`);
    }
  });
  
  els.p1Win.addEventListener("click", () => {
    awardWin(1);
    const name = state.player1.name;
    showNotification(`Victoria Manual: ${name}`);
    celebrate(name);
    speak(`Victoria jugador 1`);
  });
  
  els.p2Win.addEventListener("click", () => {
    awardWin(2);
    const name = state.player2.name;
    showNotification(`Victoria Manual: ${name}`);
    celebrate(name);
    speak(`Victoria jugador 2`);
  });

  els.resetScore.addEventListener("click", () => {
    resetScore(true);
    speak("Marcador reiniciado");
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
  saveState();
  updateUI();
  speak(`Victoria jugador ${playerNum}`);
}

function removeWin(playerNum) {
    const player = playerNum === 1 ? state.player1 : state.player2;
    if (player.wins > 0) {
        player.wins -= 1;
        state.stats.totalGames = Math.max(0, state.stats.totalGames - 1);
        rules.matchOver = false;
        saveState();
        updateUI();
        speak(`Victoria quitada jugador ${playerNum}`);
        return true;
    }
    return false;
}

function resetScore(fullReset = false) {
  state.player1.score = 0;
  state.player2.score = 0;
  rules.matchOver = false;
  state.stats.currentRallyLength = 0;
  
  if (fullReset) {
  }
  
  saveState();
  updateUI();
  speak("Marcador reiniciado");
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
    
    els.aiSuggestion.classList.add("hidden");
    
    if (p1 >= 10 || p2 >= 10) {
        const diff = Math.abs(p1 - p2);
        
        if (p1 >= rules.pointsToWinGame && (p1 - p2) >= rules.winBy) {
            const msg = `¡Juego para ${state.player1.name}! Di "${state.player1.name} ganó" para registrar.`;
            showAISuggestion(msg);
            speak(`Confirmar victoria jugador 1`);
        } else if (p2 >= rules.pointsToWinGame && (p2 - p1) >= rules.winBy) {
            const msg = `¡Juego para ${state.player2.name}! Di "${state.player2.name} ganó" para registrar.`;
            showAISuggestion(msg);
            speak(`Confirmar victoria jugador 2`);
        } else if (p1 >= 10 && p1 > p2) {
            showAISuggestion(`Game Point para ${state.player1.name}`);
            els.aiSuggestion.classList.remove("hidden");
            speak(`Game point jugador 1`);
        } else if (p2 >= 10 && p2 > p1) {
            showAISuggestion(`Game Point para ${state.player2.name}`);
            els.aiSuggestion.classList.remove("hidden");
            speak(`Game point jugador 2`);
        } else if (p1 === p2 && p1 >= 10) {
            showAISuggestion("Deuce (Empate)");
            els.aiSuggestion.classList.remove("hidden");
            speak("Deuce, empate");
        }
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

function speak(text) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-ES";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    window.speechSynthesis.speak(utterance);
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
        showNotification("Tu navegador no soporta comandos de voz");
        return;
    }

    if (!recognition) {
        recognition = new SpeechRecognition();
        recognition.lang = "es-ES";
        recognition.continuous = true;
        recognition.interimResults = false;

        recognition.onstart = () => {
            isListening = true;
            els.voiceBtn.classList.add("active", "bg-white/10", "border-white");
            els.voiceStatus.textContent = "Escuchando...";
            els.voiceStatus.classList.add("animate-blink");
        };

        recognition.onend = () => {
            if (isListening) {
                try {
                    recognition.start();
                } catch(e) {
                    console.log("Reinicio voz ignorado");
                }
            } else {
                els.voiceBtn.classList.remove("active", "bg-white/10", "border-white");
                els.voiceStatus.textContent = "Presiona para activar";
                els.voiceStatus.classList.remove("animate-blink");
            }
        };

        recognition.onerror = (event) => {
            console.error("Error Voz:", event.error);
            if (event.error === 'network') {
                showNotification("Error de red. Revisa conexión.");
                stopVoice();
            } else if (event.error === 'not-allowed') {
                showNotification("Permiso de micro denegado.");
                stopVoice();
            }
        };

        recognition.onresult = (event) => {
            const last = event.results.length - 1;
            const transcript = event.results[last][0].transcript.toLowerCase().trim();
            const confidence = event.results[last][0].confidence;
            
            console.log("Voz:", transcript, confidence);
            els.lastCommand.textContent = `"${transcript}"`;
            
            processVoiceCommand(transcript);
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

function processVoiceCommand(text) {
    const p1Name = state.player1.name.toLowerCase();
    const p2Name = state.player2.name.toLowerCase();
    
    text = text.replace(/[.,]/g, "");

    if (text.includes("reiniciar") || text.includes("reset") || text.includes("borrar todo")) {
        resetScore(true);
        showNotification("Marcador Reiniciado");
        speak("Marcador reiniciado");
        return;
    }

    const isSubtract = text.includes("quita") || text.includes("resta") || text.includes("borra") || text.includes("menos") || text.includes("saca");
    
    const isWin = text.includes("victoria") || text.includes("ganó") || text.includes("gano") || text.includes("ganador");

    const numberWords = {
      un: 1,
      uno: 1,
      una: 1,
      dos: 2,
      tres: 3,
      cuatro: 4,
      cinco: 5,
    };
    let amount = 1;
    const explicitAmountMatch = text.match(
      /\b(un|uno|una|dos|tres|cuatro|cinco|1|2|3|4|5)\s+(punto|puntos?)\b/i
    );
    if (explicitAmountMatch) {
      const raw = explicitAmountMatch[1];
      amount = numberWords[raw] || parseInt(raw, 10) || 1;
    }
    const amountLabel = `${amount} punto${amount !== 1 ? "s" : ""}`;

    const isPlayer1 = text.includes(p1Name) || text.includes("jugador 1") || (text.includes("uno") && !text.includes("jugador 2") && !text.includes("jugador dos"));
    const isPlayer2 = text.includes(p2Name) || text.includes("jugador 2") || text.includes("jugador dos") || (text.includes("dos") && !explicitAmountMatch);

    if (isPlayer1) {
        if (isWin) {
            if (isSubtract) {
                if(removeWin(1)) {
                    showNotification(`Victoria quitada a ${state.player1.name}`);
                    speak("Confirmo: quitar victoria jugador 1");
                }
            } else {
                awardWin(1);
                showNotification(`Victoria para ${state.player1.name}`);
                celebrate(state.player1.name);
                speak("Confirmo: victoria jugador 1");
            }
        } else {
            if (isSubtract) {
                if(removePoints(1, amount)) {
                    const msg = `${amountLabel} menos jugador 1`;
                    showNotification(msg);
                    speak(`Confirmo: ${msg}`);
                }
            } else {
                addPoints(1, amount);
                highlightPlayer(1);
                const msg = `${amountLabel} jugador 1`;
                showNotification(msg);
                speak(`Confirmo: ${msg}`);
                checkGameWinCondition();
            }
        }
        return;
    }

    if (isPlayer2 || text.includes("rival")) {
        if (isWin) {
            if (isSubtract) {
                if(removeWin(2)) {
                    showNotification(`Victoria quitada a ${state.player2.name}`);
                    speak("Confirmo: quitar victoria jugador 2");
                }
            } else {
                awardWin(2);
                showNotification(`Victoria para ${state.player2.name}`);
                celebrate(state.player2.name);
                speak("Confirmo: victoria jugador 2");
            }
        } else {
            if (isSubtract) {
                if(removePoints(2, amount)) {
                    const msg = `${amountLabel} menos jugador 2`;
                    showNotification(msg);
                    speak(`Confirmo: ${msg}`);
                }
            } else {
                addPoints(2, amount);
                highlightPlayer(2);
                const msg = `${amountLabel} jugador 2`;
                showNotification(msg);
                speak(`Confirmo: ${msg}`);
                checkGameWinCondition();
            }
        }
        return;
    }
    
}

init();