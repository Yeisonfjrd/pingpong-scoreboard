// Control físico: un control Bluetooth de presentaciones (o cualquier teclado) le llega
// a la página como teclas. Este módulo traduce una tecla en una acción del marcador.

export const CONTROLS_KEY = "pingpong_controls_v1";
export const ACTIONS = ["p1", "p2", "undo"];

// Lo que mandan los controles de presentación más comunes, más flechas del teclado.
export const DEFAULT_BINDINGS = {
  p1: ["ArrowLeft", "PageUp", "ArrowUp"],
  p2: ["ArrowRight", "PageDown", "ArrowDown"],
  // "b" y "." son el botón de "pantalla negra" de muchos controles.
  undo: ["Backspace", "Delete", "b", "B", "."],
};

const TYPING_TAGS = ["INPUT", "TEXTAREA", "SELECT"];

/**
 * Devuelve "p1", "p2", "undo" o null.
 * Ignora teclas mientras escribís un nombre, combinaciones con Ctrl/Alt/Cmd
 * y la repetición de una tecla mantenida apretada.
 */
export function actionForKey(bindings, event) {
  if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return null;
  if (TYPING_TAGS.includes(event.target?.tagName) || event.target?.isContentEditable) return null;
  return ACTIONS.find((action) => bindings[action]?.includes(event.key)) ?? null;
}

export function loadBindings(storage) {
  try {
    const saved = JSON.parse(storage.getItem(CONTROLS_KEY));
    if (ACTIONS.every((a) => Array.isArray(saved?.[a]))) return saved;
  } catch {
    // Guardado roto: uso los de fábrica.
  }
  return DEFAULT_BINDINGS;
}

export function saveBindings(storage, bindings) {
  storage.setItem(CONTROLS_KEY, JSON.stringify(bindings));
}

/**
 * Modo aprender: pide una tecla por acción, en orden.
 * Cada llamada a `press` devuelve el estado nuevo; `done` dice si terminó.
 * Una tecla ya usada para otra acción se rechaza, así un botón no hace dos cosas.
 */
export function startLearning() {
  return { step: 0, learned: {}, done: false, rejected: null };
}

export function press(learning, key) {
  if (learning.done) return learning;
  const used = Object.values(learning.learned).flat();
  if (used.includes(key)) return { ...learning, rejected: key };

  const action = ACTIONS[learning.step];
  const learned = { ...learning.learned, [action]: [key] };
  const step = learning.step + 1;
  return { step, learned, done: step === ACTIONS.length, rejected: null };
}

// Saltear "deshacer" si el control tiene solo 2 botones.
export function skip(learning) {
  if (learning.done) return learning;
  const action = ACTIONS[learning.step];
  const learned = { ...learning.learned, [action]: [] };
  const step = learning.step + 1;
  return { step, learned, done: step === ACTIONS.length, rejected: null };
}

export function keyLabel(key) {
  const names = {
    ArrowLeft: "←",
    ArrowRight: "→",
    ArrowUp: "↑",
    ArrowDown: "↓",
    PageUp: "Re Pág",
    PageDown: "Av Pág",
    Backspace: "Borrar",
    " ": "Espacio",
  };
  return names[key] ?? key;
}
