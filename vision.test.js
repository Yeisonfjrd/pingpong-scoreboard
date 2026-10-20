import { test } from "node:test";
import assert from "node:assert/strict";
import { findBall, findCandidates, confirmWithTrack, searchBox, tableColor } from "./vision.js";
import { orderCorners, tableHomography, sideOf, toImage } from "./table.js";

const W = 400;
const HH = 200;
// Mesa vista con un poco de perspectiva.
const corners = orderCorners([
  { x: 120, y: 100 },
  { x: 280, y: 100 },
  { x: 340, y: 160 },
  { x: 60, y: 160 },
]);
const H = tableHomography(corners);
const box = searchBox(corners, W, HH);

// Cuadro azul oscuro (la mesa) sobre fondo gris.
function frame(paint = () => {}) {
  const data = new Uint8ClampedArray(W * HH * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 60;
    data[i + 1] = 70;
    data[i + 2] = 120;
    data[i + 3] = 255;
  }
  const img = { data, width: W, height: HH };
  paint((x, y, rgb) => {
    const i = (y * W + x) * 4;
    [data[i], data[i + 1], data[i + 2]] = rgb;
  });
  return img;
}

const ball = (cx, cy, r = 2) => (set) => {
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) set(x, y, [245, 245, 240]);
};

test("encuentra la pelota que apareció y dice de qué lado está", () => {
  const p = toImage(H, { u: 0.25, v: 0.5 });
  const found = findBall(frame(), frame(ball(Math.round(p.x), Math.round(p.y))), H, box);
  assert.ok(found, "la encontró");
  assert.ok(Math.abs(found.x - p.x) < 3);
  assert.equal(sideOf(H, found), 0);
});

test("del otro lado de la red", () => {
  const p = toImage(H, { u: 0.8, v: 0.4 });
  const found = findBall(frame(), frame(ball(Math.round(p.x), Math.round(p.y))), H, box);
  assert.equal(sideOf(H, found), 1);
});

test("sin cambios entre cuadros no hay pelota", () => {
  assert.equal(findBall(frame(), frame(), H, box), null);
});

test("algo blanco que ya estaba quieto no es la pelota", () => {
  const still = ball(150, 130);
  assert.equal(findBall(frame(still), frame(still), H, box), null);
});

test("una mancha grande (un brazo) no es la pelota", () => {
  const arm = (set) => {
    for (let y = 90; y < 130; y++) for (let x = 100; x < 140; x++) set(x, y, [230, 200, 180]);
  };
  assert.equal(findBall(frame(), frame(arm), H, box), null);
});

test("entre un brazo y la pelota elige la pelota", () => {
  const p = toImage(H, { u: 0.7, v: 0.6 });
  const both = (set) => {
    for (let y = 90; y < 130; y++) for (let x = 60; x < 100; x++) set(x, y, [230, 200, 180]);
    ball(Math.round(p.x), Math.round(p.y))(set);
  };
  const found = findBall(frame(), frame(both), H, box);
  assert.equal(sideOf(H, found), 1);
});

test("el piso beige que aparece detrás de una pierna no es la pelota", () => {
  const p = toImage(H, { u: 0.6, v: 0.5 });
  const floor = (set) => {
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) set(Math.round(p.x) + x, Math.round(p.y) + y, [235, 200, 150]);
  };
  assert.equal(findBall(frame(), frame(floor), H, box), null);
});

test("debajo del borde de adelante (los pies) no cuenta", () => {
  const p = toImage(H, { u: 0.9, v: 1.2 });
  assert.equal(findBall(frame(), frame(ball(Math.round(p.x), Math.round(p.y))), H, box), null);
});

test("una pelota lejos de la mesa no cuenta", () => {
  assert.equal(findBall(frame(), frame(ball(380, 20)), H, box), null);
});

test("aprende el color de la mesa", () => {
  assert.deepEqual(tableColor(frame(), H, box), [60, 70, 120]);
});

test("con el color de la mesa: si antes ahí había una pierna, no es un pique", () => {
  const p = toImage(H, { u: 0.85, v: 0.8 });
  const px = Math.round(p.x);
  const py = Math.round(p.y);
  const leg = (set) => {
    for (let y = py - 3; y <= py + 3; y++) for (let x = px - 3; x <= px + 3; x++) set(x, y, [20, 20, 25]);
  };
  const options = { tableColor: tableColor(frame(), H, box) };
  assert.equal(findBall(frame(leg), frame(ball(px, py)), H, box, options), null, "antes había una pierna");
  assert.ok(findBall(frame(), frame(ball(px, py)), H, box, options), "antes había mesa");
});

test("la trayectoria confirma un pique y descarta un punto que aparece de la nada", () => {
  const now = [{ x: 200, y: 140 }];
  assert.deepEqual(confirmWithTrack(now, [{ x: 150, y: 90 }]), now[0], "venía bajando cerca");
  assert.equal(confirmWithTrack(now, [{ x: 390, y: 20 }]), null, "lo de antes estaba lejos");
  assert.equal(confirmWithTrack(now, []), null, "antes no había nada");
});

test("findCandidates ordena de más a menos probable", () => {
  const p = toImage(H, { u: 0.3, v: 0.5 });
  const list = findCandidates(frame(), frame(ball(Math.round(p.x), Math.round(p.y))), H, box);
  assert.equal(list.length, 1);
});
