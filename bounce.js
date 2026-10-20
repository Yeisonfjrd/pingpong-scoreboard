// Detector de piques: recibe la energía del sonido (ya filtrada, solo agudos) en bloques
// cortos de unos milisegundos y decide cuándo hubo un "click" de pelota.
// No toca el micrófono: así se puede probar con datos inventados en node --test.

export const DEFAULTS = {
  // Cuántas veces más fuerte que el ruido de fondo tiene que ser el click (1 = muy sensible).
  sensitivity: 5,
  // Cuántas veces más fuerte que lo que sonaba justo antes: separa un click de un sonido largo.
  rise: 3,
  // Tiempo mínimo entre dos piques. Una pelota no pica dos veces en menos de esto.
  refractoryMs: 90,
  // Ventana corta de "lo que sonaba justo antes".
  recentMs: 15,
  // Qué tan rápido se adapta el ruido de fondo (0 a 1).
  floorAdapt: 0.01,
  // Energía mínima absoluta, para no contar ruido eléctrico en una sala en silencio.
  minEnergy: 0.002,
};

export function createDetector(options = {}) {
  return {
    options: { ...DEFAULTS, ...options },
    noiseFloor: null,
    recent: [],
    lastOnset: -Infinity,
    count: 0,
  };
}

/**
 * Procesa un bloque. `energy` es el RMS del bloque y `t` su tiempo en ms.
 * Devuelve true si este bloque es un pique.
 */
export function feed(detector, energy, t) {
  const o = detector.options;
  if (detector.noiseFloor === null) detector.noiseFloor = energy;

  // "Lo que sonaba justo antes": el promedio de los bloques de la ventana corta.
  detector.recent = detector.recent.filter((r) => t - r.t <= o.recentMs);
  const before = detector.recent.length
    ? detector.recent.reduce((sum, r) => sum + r.energy, 0) / detector.recent.length
    : detector.noiseFloor;
  detector.recent.push({ energy, t });

  const floor = Math.max(detector.noiseFloor, 1e-6);
  const isOnset =
    energy >= o.minEnergy &&
    energy >= floor * o.sensitivity &&
    energy >= Math.max(before, 1e-6) * o.rise &&
    t - detector.lastOnset >= o.refractoryMs;

  if (isOnset) {
    detector.lastOnset = t;
    detector.count += 1;
  } else if (energy < floor * o.sensitivity) {
    // El fondo solo aprende de lo que no es un click, si no un pique lo subiría.
    detector.noiseFloor = floor + (energy - floor) * o.floorAdapt;
  }
  return isOnset;
}

export function setSensitivity(detector, sensitivity) {
  detector.options = { ...detector.options, sensitivity };
}

export function reset(detector) {
  detector.count = 0;
  detector.lastOnset = -Infinity;
}

// Intervalos entre piques, en ms. Sirve para ver el ritmo de un peloteo.
export function intervals(times) {
  return times.slice(1).map((t, i) => Math.round(t - times[i]));
}
