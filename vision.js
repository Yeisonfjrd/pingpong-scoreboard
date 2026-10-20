// Buscar la pelota en un cuadro de video, comparándolo con el anterior.
// Trabaja sobre objetos { data, width, height } como ImageData, así se prueba en node.
import { toTable } from "./table.js";

export const DEFAULTS = {
  // Cuánto tiene que cambiar el brillo de un píxel entre cuadros para contar como movimiento.
  minChange: 35,
  // La pelota es clara (blanca o naranja): brillo mínimo del píxel.
  minBrightness: 140,
  // Blanca: los tres colores parecidos. El piso y la pared son beige (más rojo que azul) y quedan afuera.
  maxSaturation: 45,
  // Tamaño de la pelota en píxeles (con el desenfoque de movimiento). Más grande es un brazo o una paleta.
  minArea: 6,
  maxArea: 250,
  // Hasta dónde puede estar la pelota fuera de la mesa aplanada (un poco arriba de la superficie).
  // vBelow negativo: la franja del borde de adelante no cuenta (ahí titila la compresión del video y suelen tapar sillas o piernas).
  margin: { u: 0, vAbove: 0.6, vBelow: -0.07 },
  // Qué tan parecido al color de la mesa tiene que ser el píxel en el cuadro anterior.
  // Al picar, la pelota está sobre la mesa: si antes ahí había una pierna o el piso, no es un pique.
  tableColorTolerance: 50,
};

/**
 * Color típico de la mesa: la mediana de los píxeles que caen adentro de las 4 esquinas.
 * Se calcula una vez al calibrar, con un cuadro donde la mesa esté a la vista.
 */
export function tableColor(img, H, box) {
  const rs = [];
  const gs = [];
  const bs = [];
  for (let y = box.y0; y <= box.y1; y += 2) {
    for (let x = box.x0; x <= box.x1; x += 2) {
      const { u, v } = toTable(H, { x, y });
      if (u < 0.05 || u > 0.95 || v < 0.1 || v > 0.9) continue;
      const i = (y * img.width + x) * 4;
      rs.push(img.data[i]);
      gs.push(img.data[i + 1]);
      bs.push(img.data[i + 2]);
    }
  }
  const median = (a) => a.sort((p, q) => p - q)[Math.floor(a.length / 2)] ?? 0;
  return [median(rs), median(gs), median(bs)];
}

function luminance(d, i) {
  return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
}

// Ancho y alto de la zona a revisar: el rectángulo que contiene la mesa, un poco agrandado hacia arriba.
export function searchBox(corners, width, height, lift = 60) {
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  return {
    x0: Math.max(0, Math.floor(Math.min(...xs) - 10)),
    x1: Math.min(width - 1, Math.ceil(Math.max(...xs) + 10)),
    y0: Math.max(0, Math.floor(Math.min(...ys) - lift)),
    y1: Math.min(height - 1, Math.ceil(Math.max(...ys) + 5)),
  };
}

/**
 * Devuelve todas las manchas que podrían ser la pelota, la más probable primero.
 * `prev` y `cur` son dos cuadros seguidos; `H` la homografía de la mesa; `box` la zona a revisar.
 */
export function findCandidates(prev, cur, H, box, options = {}) {
  const o = { ...DEFAULTS, ...options, margin: { ...DEFAULTS.margin, ...options.margin } };
  const { width } = cur;
  const w = box.x1 - box.x0 + 1;
  const h = box.y1 - box.y0 + 1;
  const mask = new Uint8Array(w * h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = ((box.y0 + y) * width + (box.x0 + x)) * 4;
      const now = luminance(cur.data, i);
      if (now < o.minBrightness) continue;
      const d = cur.data;
      if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > o.maxSaturation) continue;
      if (now - luminance(prev.data, i) < o.minChange) continue;
      if (o.tableColor) {
        const p = prev.data;
        const dist = Math.abs(p[i] - o.tableColor[0]) + Math.abs(p[i + 1] - o.tableColor[1]) + Math.abs(p[i + 2] - o.tableColor[2]);
        if (dist > o.tableColorTolerance) continue;
      }
      mask[y * w + x] = 1;
    }
  }

  // Manchas conectadas (vecinos de 8) con una pila, sin recursión.
  const seen = new Uint8Array(w * h);
  const blobs = [];
  const stack = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    let area = 0;
    let sx = 0;
    let sy = 0;
    let maxY = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const p = stack.pop();
      const px = p % w;
      const py = (p - px) / w;
      area++;
      sx += px;
      sy += py;
      maxY = Math.max(maxY, py);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = px + dx;
          const ny = py + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (mask[q] && !seen[q]) {
            seen[q] = 1;
            stack.push(q);
          }
        }
      }
    }
    if (area < o.minArea || area > o.maxArea) continue;
    const x = box.x0 + sx / area;
    // El punto de abajo de la mancha: es el que toca la mesa al picar.
    const y = box.y0 + maxY;
    const { u, v } = toTable(H, { x, y });
    const m = o.margin;
    if (u < -m.u || u > 1 + m.u || v < -m.vAbove || v > 1 + m.vBelow) continue;
    // Preferimos manchas chicas y compactas que estén cerca de la superficie (v entre 0 y 1).
    const offSurface = v < 0 ? -v : v > 1 ? v - 1 : 0;
    const score = Math.min(area, 40) / (1 + 4 * offSurface);
    blobs.push({ x, y, area, u, v, score });
  }

  return blobs.sort((a, b) => b.score - a.score);
}

// La pelota más probable { x, y, area, u, v, score } o null.
export function findBall(prev, cur, H, box, options = {}) {
  return findCandidates(prev, cur, H, box, options)[0] ?? null;
}

/**
 * Pique confirmado con la trayectoria: la pelota tiene que venir de algún lado.
 * "before" son las manchas del par de cuadros anterior (pelota en el aire, sin exigir el color de la mesa).
 * Una mancha que aparece de la nada (ruido del video en un borde) se descarta.
 */
export function confirmWithTrack(now, before, maxJump = 160) {
  return now.find((c) => before.some((b) => Math.hypot(b.x - c.x, b.y - c.y) <= maxJump && b !== c)) ?? null;
}
