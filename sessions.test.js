import { test } from "node:test";
import assert from "node:assert/strict";
import { createMatch, addPoint, awardGame, removeGame, undo } from "./game.js";
import {
  STORAGE_KEY,
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

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
    data,
  };
}

const play = (match, points) => points.reduce((m, p) => addPoint(m, p), match);

test("sin nada guardado arranca con una sesión vacía", () => {
  const store = loadStore(fakeStorage());
  assert.equal(store.sessions.length, 1);
  assert.equal(sessionName(activeSession(store).match), "Yeison vs Rival");
});

test("cada sesión guarda sus propias wins", () => {
  let store = loadStore(fakeStorage());
  store = updateActiveMatch(store, awardGame(activeSession(store).match, 0));
  const papa = store.activeId;

  store = createSession(store, "Hermano");
  assert.equal(sessionName(activeSession(store).match), "Yeison vs Hermano");
  assert.equal(activeSession(store).match.players[0].wins, 0, "la sesión nueva empieza en 0");

  store = switchSession(store, papa);
  assert.equal(activeSession(store).match.players[0].wins, 1, "la otra sesión no se tocó");
});

test("guardar y volver a cargar no pierde nada", () => {
  const storage = fakeStorage();
  let store = loadStore(storage);
  store = createSession(store, "Papá");
  store = updateActiveMatch(store, play(activeSession(store).match, [0, 1, 1]));
  saveStore(storage, store);

  const again = loadStore(storage);
  assert.equal(again.activeId, store.activeId);
  assert.deepEqual(activeSession(again).match.players.map((p) => p.score), [1, 2]);
});

test("al guardar recorta el historial de deshacer", () => {
  const storage = fakeStorage();
  let store = loadStore(storage);
  store = updateActiveMatch(store, play(activeSession(store).match, Array(30).fill(0).map((_, i) => i % 2)));
  saveStore(storage, store);
  assert.equal(JSON.parse(storage.data[STORAGE_KEY]).sessions[0].match.history.length, 10);
});

test("los datos de la versión 2 se convierten en la primera sesión", () => {
  const v2 = awardGame(createMatch("Yeison", "Papá"), 1);
  const store = loadStore(fakeStorage({ pingpong_match_v2: JSON.stringify(v2) }));
  assert.equal(sessionName(activeSession(store).match), "Yeison vs Papá");
  assert.equal(activeSession(store).match.players[1].wins, 1);
});

test("los datos de la versión 1 también se rescatan", () => {
  const v1 = { player1: { name: "Yeison", wins: 3 }, player2: { name: "Rival", wins: 2 }, stats: { totalGames: 5 } };
  const store = loadStore(fakeStorage({ pingpong_cinema_data_v1: JSON.stringify(v1) }));
  assert.deepEqual(activeSession(store).match.players.map((p) => p.wins), [3, 2]);
});

test("un guardado roto no rompe la app", () => {
  const store = loadStore(fakeStorage({ [STORAGE_KEY]: "{roto" }));
  assert.equal(store.sessions.length, 1);
});

test("borrar la sesión activa pasa a otra, y borrar la última deja una vacía", () => {
  let store = createSession(loadStore(fakeStorage()), "Papá");
  const papa = store.activeId;
  store = deleteSession(store, papa);
  assert.equal(store.sessions.length, 1);
  assert.notEqual(store.activeId, papa);
  store = deleteSession(store, store.activeId);
  assert.equal(store.sessions.length, 1);
});

test("cada game terminado queda en el historial con su resultado", () => {
  let m = play(createMatch(), [...Array(10).fill(0), 1, 0]);
  assert.equal(m.games.length, 1);
  assert.deepEqual(m.games[0].score, [11, 1]);
  assert.equal(m.games[0].winner, 0);
  assert.equal(undo(m).games.length, 0, "deshacer el punto ganador lo saca del historial");
  assert.equal(removeGame(m, 0).games.length, 0, "quitar la victoria también");
});

test("exportar e importar un respaldo suma las sesiones", () => {
  let mine = createSession(loadStore(fakeStorage()), "Papá");
  const backup = exportStore(mine);

  let otherDevice = loadStore(fakeStorage());
  otherDevice = importStore(otherDevice, backup);
  assert.equal(otherDevice.sessions.length, 2, "la sesión vacía del otro dispositivo no se duplica");

  // Importar dos veces no duplica.
  assert.equal(importStore(otherDevice, backup).sessions.length, 2);
});

test("importar se queda con la versión que tiene más games", () => {
  let store = loadStore(fakeStorage());
  const id = store.activeId;
  const old = exportStore(store);
  store = updateActiveMatch(store, awardGame(activeSession(store).match, 0));
  store = importStore(store, old);
  assert.equal(store.sessions.find((s) => s.id === id).match.players[0].wins, 1);
});

test("importar un archivo que no es respaldo da un error claro", () => {
  const store = loadStore(fakeStorage());
  assert.throws(() => importStore(store, "hola"), /respaldo válido/);
  assert.throws(() => importStore(store, '{"a":1}'), /respaldo válido/);
});
