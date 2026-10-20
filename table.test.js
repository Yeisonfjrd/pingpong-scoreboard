import { test } from "node:test";
import assert from "node:assert/strict";
import { orderCorners, tableHomography, toTable, toImage, sideOf } from "./table.js";

// Esquinas de la mesa en el video de prueba (1024x576), vista de costado y con perspectiva.
const corners = orderCorners([
  { x: 856, y: 468 },
  { x: 385, y: 428 },
  { x: 323, y: 480 },
  { x: 724, y: 427 },
]);
const H = tableHomography(corners);
const close = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

test("ordena las esquinas tocadas en cualquier orden", () => {
  assert.deepEqual(corners, [
    { x: 385, y: 428 },
    { x: 724, y: 427 },
    { x: 856, y: 468 },
    { x: 323, y: 480 },
  ]);
});

test("las esquinas van a las puntas de la mesa aplanada", () => {
  const expected = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];
  corners.forEach((c, i) => {
    const { u, v } = toTable(H, c);
    assert.ok(close(u, expected[i][0]) && close(v, expected[i][1]), `esquina ${i}: ${u}, ${v}`);
  });
});

test("ida y vuelta entre imagen y mesa", () => {
  const p = toImage(H, { u: 0.3, v: 0.7 });
  const back = toTable(H, p);
  assert.ok(close(back.u, 0.3) && close(back.v, 0.7));
});

test("la red con perspectiva no queda en el medio de la imagen", () => {
  // Lo de atrás se ve más chico: la red en la imagen está corrida hacia el lado de atrás-derecha.
  const netBack = toImage(H, { u: 0.5, v: 0 });
  const netFront = toImage(H, { u: 0.5, v: 1 });
  assert.ok(netBack.x > 385 && netBack.x < 724);
  assert.ok(netFront.x > 323 && netFront.x < 856);
});

test("dice de qué lado picó", () => {
  assert.equal(sideOf(H, toImage(H, { u: 0.2, v: 0.5 })), 0);
  assert.equal(sideOf(H, toImage(H, { u: 0.8, v: 0.5 })), 1);
});

test("un punto fuera de la mesa no es de ningún lado", () => {
  assert.equal(sideOf(H, { x: 100, y: 100 }), null);
  assert.equal(sideOf(H, toImage(H, { u: 1.02, v: 0.5 })), 1, "en el borde cuenta");
});

test("tres esquinas en línea dan un error claro", () => {
  assert.throws(
    () => tableHomography([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }]),
    /3 en línea/,
  );
});
