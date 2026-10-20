import { test } from "node:test";
import assert from "node:assert/strict";
import { createRally, addBounce, checkSilence, resetRally, winnerFor } from "./rally.js";

function play(sequence, options) {
  let rally = createRally(options);
  let decision = null;
  for (const b of sequence) {
    ({ rally, decision } = addBounce(rally, b));
    if (decision) break;
  }
  return { rally, decision };
}

test("un peloteo normal que alterna no termina solo", () => {
  const { decision } = play([
    { t: 0, side: 0 },
    { t: 400, side: 1 },
    { t: 1100, side: 0 },
    { t: 1800, side: 1 },
  ]);
  assert.equal(decision, null);
});

test("doble pique del mismo lado: pierde ese lado", () => {
  const { decision } = play([
    { t: 0, side: 0 },
    { t: 400, side: 1 },
    { t: 900, side: 1 },
  ]);
  assert.deepEqual(decision, { loserSide: 1, reason: "double" });
});

test("un eco pegado al pique no es doble pique", () => {
  const { decision } = play([
    { t: 0, side: 0 },
    { t: 400, side: 1 },
    { t: 460, side: 1 },
  ]);
  assert.equal(decision, null);
});

test("si después de un pique no vuelve a picar, pierde el lado del último pique", () => {
  const { rally } = play([
    { t: 0, side: 0 },
    { t: 500, side: 1 },
  ]);
  assert.equal(checkSilence(rally, 1500), null, "todavía puede volver");
  assert.deepEqual(checkSilence(rally, 2200), { loserSide: 1, reason: "silence" });
});

test("si la cámara no vio el último pique no adivina", () => {
  const { rally } = play([
    { t: 0, side: 0 },
    { t: 500, side: null },
  ]);
  assert.deepEqual(checkSilence(rally, 3000), { loserSide: null, reason: "unknown" });
});

test("un pique no visto en el medio no inventa un doble pique", () => {
  const { decision } = play([
    { t: 0, side: 1 },
    { t: 500, side: null },
    { t: 1000, side: 1 },
  ]);
  assert.equal(decision, null);
});

test("sin piques no hay nada que decidir", () => {
  assert.equal(checkSilence(createRally(), 10000), null);
});

test("reiniciar el peloteo borra los piques", () => {
  const { rally } = play([{ t: 0, side: 0 }]);
  assert.equal(resetRally(rally).bounces.length, 0);
});

test("ganador según quién está de cada lado", () => {
  assert.equal(winnerFor(1, 0), 0, "jugador 1 a la izquierda, pierde la derecha: gana el jugador 1");
  assert.equal(winnerFor(0, 0), 1);
  assert.equal(winnerFor(1, 1), 1, "cambiaron de lado");
  assert.equal(winnerFor(null, 0), null);
});
