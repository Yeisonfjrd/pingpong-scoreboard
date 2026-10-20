import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_BINDINGS,
  actionForKey,
  loadBindings,
  saveBindings,
  startLearning,
  press,
  skip,
  keyLabel,
} from "./controls.js";

const key = (k, extra = {}) => ({ key: k, target: { tagName: "BODY" }, ...extra });

function fakeStorage() {
  const data = {};
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => (data[k] = String(v)) };
}

test("un control de presentaciones suma puntos y deshace", () => {
  assert.equal(actionForKey(DEFAULT_BINDINGS, key("PageUp")), "p1");
  assert.equal(actionForKey(DEFAULT_BINDINGS, key("PageDown")), "p2");
  assert.equal(actionForKey(DEFAULT_BINDINGS, key("ArrowLeft")), "p1");
  assert.equal(actionForKey(DEFAULT_BINDINGS, key("ArrowRight")), "p2");
  assert.equal(actionForKey(DEFAULT_BINDINGS, key("b")), "undo");
  assert.equal(actionForKey(DEFAULT_BINDINGS, key("x")), null);
});

test("no suma puntos mientras escribís un nombre", () => {
  assert.equal(actionForKey(DEFAULT_BINDINGS, key("ArrowLeft", { target: { tagName: "INPUT" } })), null);
  assert.equal(actionForKey(DEFAULT_BINDINGS, key("b", { target: { tagName: "SELECT" } })), null);
});

test("ignora la tecla mantenida y las combinaciones", () => {
  assert.equal(actionForKey(DEFAULT_BINDINGS, key("ArrowLeft", { repeat: true })), null);
  assert.equal(actionForKey(DEFAULT_BINDINGS, key("ArrowLeft", { altKey: true })), null);
  assert.equal(actionForKey(DEFAULT_BINDINGS, key("b", { ctrlKey: true })), null);
});

test("aprender asigna una tecla por acción, en orden", () => {
  let l = startLearning();
  l = press(l, "VolumeUp");
  l = press(l, "Enter");
  assert.equal(l.done, false);
  l = press(l, "Escape");
  assert.equal(l.done, true);
  assert.deepEqual(l.learned, { p1: ["VolumeUp"], p2: ["Enter"], undo: ["Escape"] });
  assert.equal(actionForKey(l.learned, key("Enter")), "p2");
  assert.equal(actionForKey(l.learned, key("ArrowLeft")), null, "las de fábrica dejan de valer");
});

test("aprender rechaza un botón que ya hace otra cosa", () => {
  let l = press(startLearning(), "a");
  l = press(l, "a");
  assert.equal(l.rejected, "a");
  assert.equal(l.step, 1);
});

test("con un control de 2 botones se puede saltear deshacer", () => {
  let l = press(press(startLearning(), "a"), "b");
  l = skip(l);
  assert.equal(l.done, true);
  assert.deepEqual(l.learned.undo, []);
});

test("guarda y carga los botones aprendidos", () => {
  const storage = fakeStorage();
  assert.equal(loadBindings(storage), DEFAULT_BINDINGS);
  const mine = { p1: ["a"], p2: ["l"], undo: [] };
  saveBindings(storage, mine);
  assert.deepEqual(loadBindings(storage), mine);
});

test("nombres de teclas legibles", () => {
  assert.equal(keyLabel("ArrowLeft"), "←");
  assert.equal(keyLabel("PageDown"), "Av Pág");
  assert.equal(keyLabel("q"), "q");
});
