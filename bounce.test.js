import { test } from "node:test";
import assert from "node:assert/strict";
import { createDetector, feed, reset, setSensitivity, intervals } from "./bounce.js";

// Bloques de ~2.7 ms, como los da el navegador a 48 kHz (128 muestras).
const BLOCK = 128 / 48;

// Ruido de fondo pseudoaleatorio pero repetible.
function noise(i, level = 0.01) {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return level * (0.6 + 0.8 * (x - Math.floor(x)));
}

// Arma una señal: ruido + clicks cortos (3 bloques) en los tiempos pedidos.
function signal(ms, { clicks = [], sustained = [], level = 0.01 } = {}) {
  const blocks = Math.round(ms / BLOCK);
  return Array.from({ length: blocks }, (_, i) => {
    const t = i * BLOCK;
    let e = noise(i, level);
    for (const [from, to, amp] of sustained) if (t >= from && t < to) e = amp;
    for (const c of clicks) if (t >= c && t < c + 3 * BLOCK) e = 0.3;
    return { e, t };
  });
}

function run(samples, options) {
  const d = createDetector(options);
  const hits = [];
  for (const { e, t } of samples) if (feed(d, e, t)) hits.push(t);
  return { d, hits };
}

test("cuenta cada pique una sola vez", () => {
  const clicks = [500, 900, 1300, 1700, 2100];
  const { d, hits } = run(signal(2500, { clicks }));
  assert.equal(d.count, 5);
  hits.forEach((t, i) => assert.ok(Math.abs(t - clicks[i]) < 5, `pique ${i} a tiempo`));
});

test("con solo ruido de fondo no cuenta nada", () => {
  assert.equal(run(signal(3000)).d.count, 0);
});

test("un sonido largo (alguien hablando) no cuenta como muchos piques", () => {
  const { d } = run(signal(3000, { sustained: [[1000, 2000, 0.15]] }));
  assert.ok(d.count <= 1, `contó ${d.count}`);
});

test("detecta un pique aunque haya un sonido largo de fondo", () => {
  const { d } = run(signal(3000, { sustained: [[500, 2500, 0.03]], clicks: [1500] }));
  assert.equal(d.count, 1);
});

test("dos clicks pegados (eco o rebote del sonido) cuentan como uno", () => {
  const { d } = run(signal(1500, { clicks: [700, 740] }));
  assert.equal(d.count, 1);
});

test("se adapta a una sala más ruidosa", () => {
  const { d } = run(signal(3000, { level: 0.04, clicks: [1500] }));
  assert.equal(d.count, 1);
});

test("menos sensibilidad ignora piques suaves", () => {
  const soft = signal(2000, { clicks: [1000] }).map(({ e, t }) => ({ e: e === 0.3 ? 0.06 : e, t }));
  assert.equal(run(soft).d.count, 1, "con la sensibilidad normal lo cuenta");
  const d = createDetector();
  setSensitivity(d, 12);
  let count = 0;
  for (const { e, t } of soft) if (feed(d, e, t)) count++;
  assert.equal(count, 0, "con poca sensibilidad no");
});

test("reiniciar vuelve el contador a 0", () => {
  const { d } = run(signal(1000, { clicks: [500] }));
  reset(d);
  assert.equal(d.count, 0);
});

test("intervalos entre piques", () => {
  assert.deepEqual(intervals([100, 500, 950]), [400, 450]);
  assert.deepEqual(intervals([100]), []);
});
