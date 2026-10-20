// Reglas del partido, sin DOM: app.js las usa y los tests las prueban con node --test.

export const POINTS_TO_WIN = 11;
export const WIN_BY = 2;
const HISTORY_LIMIT = 50;

export function createMatch(name1 = "Yeison", name2 = "Rival") {
  return {
    players: [
      { name: name1, score: 0, wins: 0 },
      { name: name2, score: 0, wins: 0 },
    ],
    // 0 o 1: quién saca primero en el game actual. Cambia en cada game nuevo.
    firstServer: 0,
    lastWinner: null,
    stats: {
      totalPoints: 0,
      totalGames: 0,
      streak: { player: null, length: 0 },
      longestStreak: 0,
      sessionStart: Date.now(),
    },
    history: [],
  };
}

// Copia sin el historial, para guardarla en el historial.
function snapshot(match) {
  const { history, ...rest } = match;
  return structuredClone(rest);
}

function withHistory(match) {
  const history = [...match.history, snapshot(match)].slice(-HISTORY_LIMIT);
  return { ...structuredClone(snapshot(match)), history };
}

// Saca cada 2 puntos. Desde 10-10 cambia en cada punto.
export function currentServer(match) {
  const [a, b] = match.players.map((p) => p.score);
  const total = a + b;
  const turns = a >= 10 && b >= 10 ? 10 + (total - 20) : Math.floor(total / 2);
  return (match.firstServer + turns) % 2;
}

export function gameWinner(match) {
  const [a, b] = match.players.map((p) => p.score);
  if (a >= POINTS_TO_WIN && a - b >= WIN_BY) return 0;
  if (b >= POINTS_TO_WIN && b - a >= WIN_BY) return 1;
  return null;
}

function finishGame(match, winner) {
  match.players[winner].wins += 1;
  match.players[0].score = 0;
  match.players[1].score = 0;
  match.stats.totalGames += 1;
  match.firstServer = 1 - match.firstServer;
  match.lastWinner = winner;
  return match;
}

// Suma un punto. Si alguien gana el game, lo cierra y empieza el siguiente.
export function addPoint(match, player) {
  const next = withHistory(match);
  next.lastWinner = null;
  next.players[player].score += 1;
  next.stats.totalPoints += 1;

  const { streak } = next.stats;
  streak.length = streak.player === player ? streak.length + 1 : 1;
  streak.player = player;
  next.stats.longestStreak = Math.max(next.stats.longestStreak, streak.length);

  const winner = gameWinner(next);
  return winner === null ? next : finishGame(next, winner);
}

// Corrección manual: resta puntos sin bajar de 0.
export function removePoints(match, player, amount = 1) {
  if (match.players[player].score === 0) return match;
  const next = withHistory(match);
  const removed = Math.min(amount, next.players[player].score);
  next.players[player].score -= removed;
  next.stats.totalPoints = Math.max(0, next.stats.totalPoints - removed);
  next.stats.streak = { player: null, length: 0 };
  next.lastWinner = null;
  return next;
}

// Victoria a mano (por ejemplo si el rival abandona).
export function awardGame(match, player) {
  const next = withHistory(match);
  next.stats.streak = { player: null, length: 0 };
  return finishGame(next, player);
}

export function removeGame(match, player) {
  if (match.players[player].wins === 0) return match;
  const next = withHistory(match);
  next.players[player].wins -= 1;
  next.stats.totalGames = Math.max(0, next.stats.totalGames - 1);
  next.lastWinner = null;
  return next;
}

// Pone el game actual en 0-0. No toca los games ganados ni las stats.
export function resetGame(match) {
  const next = withHistory(match);
  next.players[0].score = 0;
  next.players[1].score = 0;
  next.stats.streak = { player: null, length: 0 };
  next.lastWinner = null;
  return next;
}

export function undo(match) {
  if (match.history.length === 0) return match;
  const history = match.history.slice(0, -1);
  // lastWinner en null: deshacer no vuelve a festejar un game.
  return { ...structuredClone(match.history.at(-1)), lastWinner: null, history };
}

export function canUndo(match) {
  return match.history.length > 0;
}

export function renamePlayer(match, player, name) {
  const next = structuredClone(match);
  next.players[player].name = name;
  next.lastWinner = null;
  return next;
}

// ---------- Comandos de voz ----------

const NUMBER_WORDS = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5 };
const P1_WORDS = ["uno", "1", "primero", "p1"];
const P2_WORDS = ["dos", "2", "segundo", "p2"];
const RESET_WORDS = ["reiniciar", "reinicia", "reset", "resetea", "resetear", "limpiar", "limpia"];
const UNDO_WORDS = ["deshacer", "deshaz", "atrás", "atras", "corregir", "corrige"];
const SUBTRACT_WORDS = ["quita", "quitar", "resta", "restar", "borra", "borrar", "menos", "saca", "sacar"];
const WIN_WORDS = ["victoria", "ganó", "gano", "ganador", "gana", "ganar"];

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[.,!?¡¿]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Convierte lo que dijo el jugador en un comando.
 * Devuelve null si no entendió a quién va el punto.
 *
 * "punto dos"            -> 1 punto al jugador 2 (antes sumaba 2)
 * "dos puntos para uno"  -> 2 puntos al jugador 1
 * "borrar uno"           -> resta 1 al jugador 1 (antes reiniciaba todo)
 */
export function parseCommand(text, names = []) {
  const words = normalize(text);
  if (words.length === 0) return null;

  if (words.some((w) => UNDO_WORDS.includes(w))) return { type: "undo" };
  if (words.some((w) => RESET_WORDS.includes(w)) || text.toLowerCase().includes("nuevo partido")) {
    return { type: "reset" };
  }

  const isSubtract = words.some((w) => SUBTRACT_WORDS.includes(w));
  const isWin = words.some((w) => WIN_WORDS.includes(w));

  // Una cantidad solo cuenta si va justo antes de "puntos": "dos puntos".
  let amount = 1;
  const rest = [...words];
  const pointsAt = rest.findIndex((w) => w === "puntos");
  if (pointsAt > 0) {
    const n = NUMBER_WORDS[rest[pointsAt - 1]] ?? Number.parseInt(rest[pointsAt - 1], 10);
    if (n >= 1 && n <= 5) {
      amount = n;
      rest.splice(pointsAt - 1, 1);
    }
  }

  const nameTokens = names.map((n) => normalize(n || ""));
  const matchesName = (i, tokens) =>
    tokens.length > 0 && tokens.every((t, k) => rest[i + k] === t);

  let player = null;
  for (let i = 0; i < rest.length && player === null; i++) {
    if (matchesName(i, nameTokens[0] ?? []) || P1_WORDS.includes(rest[i])) player = 0;
    else if (matchesName(i, nameTokens[1] ?? []) || P2_WORDS.includes(rest[i]) || rest[i] === "rival") player = 1;
  }
  if (player === null) return null;

  if (isWin) return { type: isSubtract ? "removeGame" : "awardGame", player };
  if (isSubtract) return { type: "subtract", player, amount };
  return { type: "point", player, amount };
}
