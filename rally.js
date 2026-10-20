// Árbitro del peloteo: con los piques que escucha el micrófono y el lado que ve la cámara,
// decide cuándo terminó un punto y quién lo ganó. No suma nada: solo propone.
//
// En un peloteo válido los piques se alternan de lado. Termina cuando:
// - la pelota pica 2 veces seguidas del mismo lado: ese jugador no la devolvió;
// - después de picar en un lado no vuelve a picar: ese jugador la mandó afuera o a la red.
// En los dos casos pierde el jugador del lado del último pique.

export const DEFAULTS = {
  // Sin piques durante este tiempo, el peloteo terminó.
  silenceMs: 1600,
  // Dos sonidos más juntos que esto son un solo pique con eco: no cuentan como doble pique.
  minGapMs: 120,
};

export function createRally(options = {}) {
  return { options: { ...DEFAULTS, ...options }, bounces: [] };
}

/**
 * Un pique: `side` es 0 (izquierda), 1 (derecha) o null si la cámara no lo vio.
 * Devuelve { rally, decision }. decision es { loserSide, reason } cuando el punto terminó, si no null.
 */
export function addBounce(rally, { t, side }) {
  const last = rally.bounces.at(-1);
  if (last && t - last.t < rally.options.minGapMs) return { rally, decision: null };

  const bounces = [...rally.bounces, { t, side }];
  const next = { ...rally, bounces };

  // Doble pique: los dos últimos piques vistos, uno detrás del otro, del mismo lado.
  const prev = bounces.at(-2);
  if (prev && side !== null && prev.side === side) {
    return { rally: next, decision: { loserSide: side, reason: "double" } };
  }
  return { rally: next, decision: null };
}

/**
 * Se llama seguido (por ejemplo cada 100 ms). Si pasó el tiempo sin piques,
 * el que perdió es el del lado del último pique, siempre que la cámara lo haya visto.
 */
export function checkSilence(rally, now) {
  const last = rally.bounces.at(-1);
  if (!last || now - last.t < rally.options.silenceMs) return null;
  if (last.side === null) return { loserSide: null, reason: "unknown" };
  return { loserSide: last.side, reason: "silence" };
}

export function resetRally(rally) {
  return { ...rally, bounces: [] };
}

// Quién gana el punto según el lado que perdió y qué jugador está de cada lado.
// `leftPlayer` es el índice del jugador que está a la izquierda de la cámara (0 o 1).
export function winnerFor(loserSide, leftPlayer = 0) {
  if (loserSide === null) return null;
  const loser = loserSide === 0 ? leftPlayer : 1 - leftPlayer;
  return 1 - loser;
}
