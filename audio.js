// Micrófono y archivos de audio: filtra los graves y le pasa la energía al detector de piques.
import { createDetector, feed } from "./bounce.js";

// Los piques son clicks agudos. Cortando debajo de esto se va casi toda la voz y el ruido.
export const HIGHPASS_HZ = 5000;
const BLOCK = 128;

function highpass(ctx, input) {
  // Dos filtros seguidos cortan más fuerte que uno.
  let node = input;
  for (let i = 0; i < 2; i++) {
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = HIGHPASS_HZ;
    f.Q.value = 0.707;
    node.connect(f);
    node = f;
  }
  return node;
}

/**
 * Escucha el micrófono en vivo.
 * onBounce(tMs, perfMs) en cada pique: el tiempo del audio y el mismo momento en el reloj de
 * performance.now(), que es el que usan los cuadros de la cámara. onLevel(0..1) con el volumen de los agudos.
 * Devuelve { detector, stop, startRecording, stopRecording }.
 */
export async function listen({ sensitivity, onBounce, onLevel }) {
  const stream = await navigator.mediaDevices.getUserMedia({
    // Sin esto el celular "limpia" el audio y se come justo los clicks.
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const ctx = new AudioContext();
  await ctx.audioWorklet.addModule("./bounce-worklet.js");
  const source = ctx.createMediaStreamSource(stream);
  const worklet = new AudioWorkletNode(ctx, "energy");
  highpass(ctx, source).connect(worklet);

  const detector = createDetector({ sensitivity });
  let recording = null;
  let peak = 0;

  worklet.port.onmessage = ({ data }) => {
    const blockMs = (data.blockSize / ctx.sampleRate) * 1000;
    const end = data.endTime * 1000;
    // Cuánto atrasa el reloj del audio respecto de performance.now() en este momento.
    const offset = performance.now() - ctx.currentTime * 1000;
    data.energies.forEach((energy, i) => {
      const t = end - (data.energies.length - 1 - i) * blockMs;
      const hit = feed(detector, energy, t);
      if (recording) {
        recording.energies.push(+energy.toFixed(6));
        if (hit) recording.bounces.push(Math.round(t - recording.start));
      }
      if (hit) onBounce(t, t + offset);
    });
    // Nivel para la barrita: relativo al ruido de fondo, con caída suave.
    const loudest = Math.max(...data.energies);
    peak = Math.max(loudest, peak * 0.9);
    onLevel(Math.min(1, peak / Math.max(detector.noiseFloor * detector.options.sensitivity * 2, 1e-4)));
  };

  return {
    detector,
    startRecording() {
      recording = {
        start: ctx.currentTime * 1000,
        sampleRate: ctx.sampleRate,
        blockMs: (BLOCK / ctx.sampleRate) * 1000,
        highpassHz: HIGHPASS_HZ,
        options: { ...detector.options },
        energies: [],
        bounces: [],
      };
    },
    stopRecording() {
      const done = recording;
      recording = null;
      return done;
    },
    stop() {
      worklet.port.onmessage = null;
      stream.getTracks().forEach((track) => track.stop());
      ctx.close();
    },
  };
}

/**
 * Analiza un video o audio grabado con el mismo filtro y el mismo detector que en vivo.
 * Devuelve { duration, energies, blockMs, bounces: [ms] }.
 */
export async function analyzeFile(file, sensitivity) {
  const decoder = new AudioContext();
  const audio = await decoder.decodeAudioData(await file.arrayBuffer());
  decoder.close();

  const offline = new OfflineAudioContext(1, audio.length, audio.sampleRate);
  const source = offline.createBufferSource();
  source.buffer = audio;
  highpass(offline, source).connect(offline.destination);
  source.start();
  const samples = (await offline.startRendering()).getChannelData(0);

  const blockMs = (BLOCK / audio.sampleRate) * 1000;
  const detector = createDetector({ sensitivity });
  const energies = [];
  const bounces = [];
  for (let i = 0; i + BLOCK <= samples.length; i += BLOCK) {
    let sum = 0;
    for (let j = i; j < i + BLOCK; j++) sum += samples[j] * samples[j];
    const energy = Math.sqrt(sum / BLOCK);
    const t = (i / BLOCK) * blockMs;
    energies.push(energy);
    if (feed(detector, energy, t)) bounces.push(t);
  }
  return { duration: audio.duration, energies, blockMs, bounces };
}
