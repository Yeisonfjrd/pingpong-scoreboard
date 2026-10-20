import { test } from "node:test";
import assert from "node:assert/strict";
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
  parseCommand,
  renamePlayer,
} from "./game.js";

const play = (match, points) => points.reduce((m, p) => addPoint(m, p), match);
const scores = (m) => m.players.map((p) => p.score);

test("gana con 11 y 2 de diferencia, y el siguiente game arranca solo", () => {
  let m = play(createMatch(), Array(11).fill(0));
  assert.deepEqual(scores(m), [0, 0]);
  assert.equal(m.players[0].wins, 1);
  assert.equal(m.lastWinner, 0);

  m = addPoint(m, 1);
  assert.deepEqual(scores(m), [0, 1], "el punto después de ganar ya cuenta");
});

test("a 10-10 hay que sacar 2 de diferencia", () => {
  let m = play(createMatch(), [...Array(10).fill(0), ...Array(10).fill(1)]);
  m = addPoint(m, 0);
  assert.deepEqual(scores(m), [11, 10]);
  m = play(m, [1, 0, 0]);
  assert.deepEqual(scores(m), [0, 0]);
  assert.equal(m.players[0].wins, 1);
});

test("el saque cambia cada 2 puntos", () => {
  let m = createMatch();
  const servers = [];
  for (let i = 0; i < 6; i++) {
    servers.push(currentServer(m));
    m = addPoint(m, i % 2);
  }
  assert.deepEqual(servers, [0, 0, 1, 1, 0, 0]);
});

test("desde 10-10 el saque cambia en cada punto", () => {
  let m = play(createMatch(), [...Array(10).fill(0), ...Array(10).fill(1)]);
  const first = currentServer(m);
  m = addPoint(m, 0);
  assert.equal(currentServer(m), 1 - first);
  m = addPoint(m, 1);
  assert.equal(currentServer(m), first);
});

test("cada game nuevo empieza sacando el otro jugador", () => {
  let m = createMatch();
  assert.equal(currentServer(m), 0);
  m = play(m, Array(11).fill(0));
  assert.equal(currentServer(m), 1);
});

test("deshacer vuelve atrás un punto, incluso el que ganó el game", () => {
  let m = play(createMatch(), Array(10).fill(0));
  m = addPoint(m, 0);
  assert.equal(m.players[0].wins, 1);
  m = undo(m);
  assert.deepEqual(scores(m), [10, 0]);
  assert.equal(m.players[0].wins, 0);
  assert.equal(currentServer(m), 1);
});

test("deshacer sin historial no rompe nada", () => {
  const m = createMatch();
  assert.equal(canUndo(m), false);
  assert.equal(undo(m), m);
});

test("restar no baja de 0 y se puede deshacer", () => {
  let m = play(createMatch(), [1, 1]);
  m = removePoints(m, 1, 5);
  assert.deepEqual(scores(m), [0, 0]);
  m = undo(m);
  assert.deepEqual(scores(m), [0, 2]);
});

test("reiniciar el game no borra los games ganados", () => {
  let m = awardGame(createMatch(), 1);
  m = play(m, [0, 0, 1]);
  m = resetGame(m);
  assert.deepEqual(scores(m), [0, 0]);
  assert.equal(m.players[1].wins, 1);
});

test("quitar una victoria", () => {
  let m = awardGame(createMatch(), 0);
  m = removeGame(m, 0);
  assert.equal(m.players[0].wins, 0);
  assert.equal(removeGame(m, 0), m, "no baja de 0");
});

test("racha más larga de puntos seguidos", () => {
  const m = play(createMatch(), [0, 0, 0, 1, 1, 0]);
  assert.equal(m.stats.longestStreak, 3);
});

// ---------- voz ----------

const names = ["Yeison", "Rival"];

test('"punto dos" suma 1 al jugador 2 (antes sumaba 2)', () => {
  assert.deepEqual(parseCommand("punto dos", names), { type: "point", player: 1, amount: 1 });
});

test('"dos puntos para uno" suma 2 al jugador 1', () => {
  assert.deepEqual(parseCommand("dos puntos para uno", names), { type: "point", player: 0, amount: 2 });
});

test('"borrar uno" resta en vez de reiniciar todo', () => {
  assert.deepEqual(parseCommand("borrar uno", names), { type: "subtract", player: 0, amount: 1 });
});

test("reconoce los nombres", () => {
  assert.deepEqual(parseCommand("punto para Yeison", names), { type: "point", player: 0, amount: 1 });
  assert.deepEqual(parseCommand("punto para el rival", names), { type: "point", player: 1, amount: 1 });
  assert.deepEqual(parseCommand("punto Juan Pablo", ["Juan Pablo", "Ana"]), { type: "point", player: 0, amount: 1 });
});

test("victoria, quitar victoria, reiniciar y deshacer", () => {
  assert.deepEqual(parseCommand("victoria dos", names), { type: "awardGame", player: 1 });
  assert.deepEqual(parseCommand("quita victoria uno", names), { type: "removeGame", player: 0 });
  assert.deepEqual(parseCommand("reiniciar", names), { type: "reset" });
  assert.deepEqual(parseCommand("nuevo partido", names), { type: "reset" });
  assert.deepEqual(parseCommand("deshacer", names), { type: "undo" });
});

test("ignora lo que no entiende", () => {
  assert.equal(parseCommand("que buen punto", names), null);
  assert.equal(parseCommand("", names), null);
});

test("deshacer o renombrar después de un game no lo vuelve a festejar", () => {
  let m = play(createMatch(), Array(11).fill(0));
  m = addPoint(m, 1);
  assert.equal(undo(m).lastWinner, null);
  assert.equal(renamePlayer(play(createMatch(), Array(11).fill(0)), 0, "Ana").lastWinner, null);
});
