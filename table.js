// Geometría de la mesa: con las 4 esquinas tocadas en la imagen, una homografía
// pasa cualquier punto de la imagen a la mesa "aplanada", donde u va de 0 (punta izquierda)
// a 1 (punta derecha) y v de 0 (lado de atrás) a 1 (lado de adelante). La red está en u = 0.5.

/**
 * Ordena 4 puntos tocados en cualquier orden como
 * [atrás-izquierda, atrás-derecha, adelante-derecha, adelante-izquierda].
 * Los 2 de más a la izquierda son la punta izquierda; de cada punta, el de más arriba es "atrás".
 */
export function orderCorners(points) {
  if (points.length !== 4) throw new Error("Hacen falta 4 esquinas");
  const byX = [...points].sort((a, b) => a.x - b.x);
  const [leftBack, leftFront] = byX.slice(0, 2).sort((a, b) => a.y - b.y);
  const [rightBack, rightFront] = byX.slice(2).sort((a, b) => a.y - b.y);
  return [leftBack, rightBack, rightFront, leftFront];
}

// Resuelve un sistema lineal 8x8 por eliminación de Gauss.
function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    if (Math.abs(M[pivot][col]) < 1e-12) throw new Error("Esquinas inválidas: hay 3 en línea");
    [M[col], M[pivot]] = [M[pivot], M[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/**
 * Homografía que lleva la imagen a la mesa aplanada.
 * `corners` ya ordenadas con orderCorners.
 */
export function tableHomography(corners) {
  const target = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];
  const A = [];
  const b = [];
  corners.forEach(({ x, y }, i) => {
    const [u, v] = target[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  });
  const h = solve(A, b);
  return [...h, 1];
}

export function toTable(H, { x, y }) {
  const w = H[6] * x + H[7] * y + H[8];
  return { u: (H[0] * x + H[1] * y + H[2]) / w, v: (H[3] * x + H[4] * y + H[5]) / w };
}

// La inversa sirve para dibujar la red sobre la imagen.
export function toImage(H, { u, v }) {
  const [a, b, c, d, e, f, g, h, i] = H;
  // Inversa de una matriz 3x3 por cofactores.
  const inv = [
    e * i - f * h, c * h - b * i, b * f - c * e,
    f * g - d * i, a * i - c * g, c * d - a * f,
    d * h - e * g, b * g - a * h, a * e - b * d,
  ];
  const w = inv[6] * u + inv[7] * v + inv[8];
  return { x: (inv[0] * u + inv[1] * v + inv[2]) / w, y: (inv[3] * u + inv[4] * v + inv[5]) / w };
}

/**
 * De qué lado de la red cae un punto de la imagen: 0 (izquierda), 1 (derecha)
 * o null si está fuera de la mesa (con un margen chico por si la pelota pica en el borde).
 */
export function sideOf(H, point, margin = 0.06) {
  const { u, v } = toTable(H, point);
  if (u < -margin || u > 1 + margin || v < -margin || v > 1 + margin) return null;
  return u < 0.5 ? 0 : 1;
}
