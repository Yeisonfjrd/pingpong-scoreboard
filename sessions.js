// Sesiones: un marcador separado por rival ("Yeison vs Papá", "Yeison vs Hermano").
// Todo vive en un solo objeto que se guarda en localStorage.
import { createMatch } from "./game.js";

export const STORAGE_KEY = "pingpong_sessions_v3";
const V2_KEY = "pingpong_match_v2";
const V1_KEY = "pingpong_cinema_data_v1";
// Al guardar, solo los últimos pasos de deshacer: el resto se pierde al recargar.
const SAVED_UNDO_STEPS = 10;

let counter = 0;
function newId() {
  counter += 1;
  return `s${Date.now().toString(36)}${counter}`;
}

export function sessionName(match) {
  return `${match.players[0].name} vs ${match.players[1].name}`;
}

export function emptyStore() {
  const match = createMatch();
  const id = newId();
  return { version: 3, activeId: id, sessions: [{ id, createdAt: Date.now(), match }] };
}

function fromV2(match) {
  const id = newId();
  return { version: 3, activeId: id, sessions: [{ id, createdAt: Date.now(), match: { games: [], ...match } }] };
}

function fromV1(old) {
  const match = createMatch(old.player1.name, old.player2.name);
  match.players[0].wins = old.player1.wins || 0;
  match.players[1].wins = old.player2.wins || 0;
  match.stats.totalGames = old.stats?.totalGames || 0;
  match.stats.totalPoints = old.stats?.totalPoints || 0;
  return fromV2(match);
}

function isStore(value) {
  return value?.version === 3 && Array.isArray(value.sessions) && value.sessions.length > 0;
}

function readJSON(storage, key) {
  try {
    return JSON.parse(storage.getItem(key));
  } catch {
    return null;
  }
}

// Lee lo guardado. Si hay datos de versiones viejas, los convierte en la primera sesión.
export function loadStore(storage) {
  const saved = readJSON(storage, STORAGE_KEY);
  if (isStore(saved)) {
    if (!saved.sessions.some((s) => s.id === saved.activeId)) saved.activeId = saved.sessions[0].id;
    return saved;
  }
  const v2 = readJSON(storage, V2_KEY);
  if (v2?.players) return fromV2(v2);
  const v1 = readJSON(storage, V1_KEY);
  if (v1?.player1) return fromV1(v1);
  return emptyStore();
}

export function saveStore(storage, store) {
  const trimmed = {
    ...store,
    sessions: store.sessions.map((s) => ({
      ...s,
      match: { ...s.match, history: (s.match.history ?? []).slice(-SAVED_UNDO_STEPS) },
    })),
  };
  storage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function activeSession(store) {
  return store.sessions.find((s) => s.id === store.activeId) ?? store.sessions[0];
}

export function updateActiveMatch(store, match) {
  return {
    ...store,
    sessions: store.sessions.map((s) => (s.id === store.activeId ? { ...s, match } : s)),
  };
}

// Nueva sesión contra un rival. El jugador 1 se mantiene (casi siempre sos vos).
export function createSession(store, rivalName, myName = activeSession(store).match.players[0].name) {
  const id = newId();
  const session = { id, createdAt: Date.now(), match: createMatch(myName, rivalName.trim() || "Rival") };
  return { ...store, activeId: id, sessions: [...store.sessions, session] };
}

export function switchSession(store, id) {
  if (!store.sessions.some((s) => s.id === id)) return store;
  return { ...store, activeId: id };
}

// Borra una sesión. Si era la última, deja una vacía para no quedar sin marcador.
export function deleteSession(store, id) {
  const sessions = store.sessions.filter((s) => s.id !== id);
  if (sessions.length === 0) return emptyStore();
  const activeId = store.activeId === id ? sessions.at(-1).id : store.activeId;
  return { ...store, activeId, sessions };
}

// ---------- Respaldo ----------

export function exportStore(store) {
  return JSON.stringify({ app: "pingpong-scoreboard", exportedAt: new Date().toISOString(), ...store }, null, 2);
}

/**
 * Suma las sesiones de un respaldo a las que ya hay.
 * Si una sesión del respaldo ya existe (mismo id), se queda la que tenga más games jugados.
 * Las sesiones de este dispositivo que nunca se usaron se descartan para no duplicar.
 */
export function importStore(store, text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("El archivo no es un respaldo válido");
  }
  if (!isStore(data)) throw new Error("El archivo no es un respaldo válido");

  const unused = (s) => s.match.stats?.totalPoints === 0 && s.match.players.every((p) => p.wins === 0);
  const byId = new Map(store.sessions.filter((s) => !unused(s)).map((s) => [s.id, s]));
  for (const incoming of data.sessions) {
    if (!incoming?.id || !incoming.match?.players) continue;
    const current = byId.get(incoming.id);
    const played = (s) => s.match.stats?.totalGames ?? 0;
    if (!current || played(incoming) > played(current)) byId.set(incoming.id, incoming);
  }
  const sessions = [...byId.values()];
  if (sessions.length === 0) return store;
  const activeId = sessions.some((s) => s.id === store.activeId) ? store.activeId : sessions[0].id;
  return { ...store, activeId, sessions };
}
