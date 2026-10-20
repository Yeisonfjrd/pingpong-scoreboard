// Cámara: guarda los últimos cuadros y, cuando el micrófono escucha un pique,
// busca la pelota en esos cuadros para decir de qué lado de la mesa picó.
import { tableHomography, orderCorners, sideOf } from "./table.js";
import { findCandidates, confirmWithTrack, searchBox, tableColor } from "./vision.js";

export const CALIBRATION_KEY = "pingpong_camera_v1";
// Los umbrales de tamaño de vision.js están pensados para un video de 1024 px de ancho.
const REFERENCE_WIDTH = 1024;
const FRAMES_KEPT = 6;

export function loadCalibration(storage) {
  try {
    const saved = JSON.parse(storage.getItem(CALIBRATION_KEY));
    if (saved?.corners?.length === 4) return saved;
  } catch {
    // Sin calibración guardada.
  }
  return null;
}

export function saveCalibration(storage, calibration) {
  storage.setItem(CALIBRATION_KEY, JSON.stringify(calibration));
}

// Las esquinas se guardan de 0 a 1 para que sirvan con cualquier resolución.
export function toPixels(calibration, width, height) {
  return orderCorners(calibration.corners.map((c) => ({ x: c.x * width, y: c.y * height })));
}

function geometry(calibration, width, height) {
  const corners = toPixels(calibration, width, height);
  const H = tableHomography(corners);
  const box = searchBox(corners, width, height, Math.round(height * 0.1));
  const scale = (width / REFERENCE_WIDTH) ** 2;
  return { corners, H, box, scale };
}

// Lee solo la zona de la mesa de un cuadro (más rápido que el cuadro entero).
function pixels(source, width, height, canvas) {
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

/**
 * De qué lado picó, mirando 3 cuadros: dos antes del pique y el del pique.
 * Devuelve { side, x, y } o null si no vio la pelota con seguridad.
 */
export function sideFromFrames([f0, f1, f2], calibration, width, height) {
  const { H, box, scale } = geometry(calibration, width, height);
  const size = { minArea: Math.max(2, Math.round(6 * scale)), maxArea: Math.round(250 * scale) };
  const now = findCandidates(f1, f2, H, box, { ...size, tableColor: calibration.tableColor });
  if (now.length === 0) return null;
  const before = findCandidates(f0, f1, H, box, {
    minArea: Math.max(2, Math.round(4 * scale)),
    maxArea: size.maxArea,
    margin: { u: 0.1, vAbove: 1.5, vBelow: 0.1 },
  });
  const ball = confirmWithTrack(now, before, 160 * Math.sqrt(scale));
  if (!ball) return null;
  const side = sideOf(H, ball);
  return side === null ? null : { side, x: ball.x, y: ball.y };
}

// El color de la mesa se aprende al calibrar, con la mesa a la vista.
export function learnTableColor(source, calibration, width, height) {
  const { H, box } = geometry(calibration, width, height);
  return tableColor(pixels(source, width, height, document.createElement("canvas")), H, box);
}

/**
 * Guarda los últimos cuadros de la cámara (como ImageBitmap, que es barato)
 * con la hora en que se capturaron, en la misma escala que performance.now().
 */
export function frameBuffer(video) {
  const frames = [];
  let running = true;
  const onFrame = async (now, meta) => {
    if (!running) return;
    try {
      const bitmap = await createImageBitmap(video);
      frames.push({ t: meta.captureTime ?? meta.expectedDisplayTime ?? now, bitmap });
      while (frames.length > FRAMES_KEPT) frames.shift().bitmap.close();
    } catch {
      // El video todavía no tiene imagen.
    }
    video.requestVideoFrameCallback(onFrame);
  };
  video.requestVideoFrameCallback(onFrame);

  return {
    // Los 3 cuadros alrededor de un momento: dos antes y el primero después.
    around(t) {
      const after = frames.findIndex((f) => f.t >= t);
      const i = after === -1 ? frames.length - 1 : after;
      if (i < 2) return null;
      return frames.slice(i - 2, i + 1);
    },
    stop() {
      running = false;
      frames.splice(0).forEach((f) => f.bitmap.close());
    },
  };
}

export function sideFromBuffer(buffer, t, calibration, width, height) {
  const picked = buffer.around(t);
  if (!picked) return null;
  const canvas = document.createElement("canvas");
  const images = picked.map((f) => pixels(f.bitmap, width, height, canvas));
  return sideFromFrames(images, calibration, width, height);
}

// Un recorte de 2:1 alrededor de la pelota, para revisar a ojo si acertó.
export function crop(bitmap, hit, width, height) {
  const w = Math.round(width * 0.4);
  const h = Math.round(w / 2);
  const x = Math.round(Math.min(Math.max(0, hit.x - w / 2), width - w));
  const y = Math.round(Math.min(Math.max(0, hit.y - h * 0.7), height - h));
  return createImageBitmap(bitmap, x, y, w, h).then((image) => ({ image, x, y, w, h }));
}

/**
 * Analiza un video grabado: lo reproduce (sin sonido) y guarda los cuadros a medida que aparecen,
 * igual que con la cámara en vivo. Cuando pasa por un pique, mira los cuadros de ese momento.
 * "bounces" son los tiempos en ms que devolvió analyzeFile. Tarda lo que dura el video.
 */
export function sidesInVideo(video, bounces, calibration, onProgress = () => {}) {
  const width = video.videoWidth;
  const height = video.videoHeight;
  const canvas = document.createElement("canvas");
  const recent = [];
  const pending = bounces.map((ms) => ms / 1000);
  const results = [];

  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      video.pause();
      video.onended = null;
      recent.splice(0).forEach((f) => f.bitmap.close());
      // Los piques que quedaron sin cuadros (al final del video) van sin resultado.
      pending.splice(0).forEach((t) => results.push({ t: t * 1000, hit: null }));
      resolve(results);
    };

    const onFrame = async (now, meta) => {
      if (done) return;
      try {
        recent.push({ t: meta.mediaTime, bitmap: await createImageBitmap(video) });
      } catch {
        // Cuadro sin imagen todavía.
      }
      while (recent.length > FRAMES_KEPT) recent.shift().bitmap.close();

      // Todos los piques que ya quedaron atrás del cuadro más nuevo.
      while (pending.length && recent.length >= 3 && recent.at(-1).t >= pending[0]) {
        const t = pending.shift();
        const after = recent.findIndex((f) => f.t >= t);
        const picked = after >= 2 ? recent.slice(after - 2, after + 1) : null;
        const hit = picked
          ? sideFromFrames(picked.map((f) => pixels(f.bitmap, width, height, canvas)), calibration, width, height)
          : null;
        // Recorte del cuadro del pique, sacado ahora: después el video ya pasó de largo.
        const thumb = hit ? await crop(picked[2].bitmap, hit, width, height) : null;
        results.push({ t: t * 1000, hit, thumb });
        onProgress(results.length / bounces.length);
      }

      if (pending.length && !video.ended) video.requestVideoFrameCallback(onFrame);
      else finish();
    };

    video.onended = finish;
    video.currentTime = 0;
    video.playbackRate = 1;
    video.requestVideoFrameCallback(onFrame);
    video.play().catch(finish);
  });
}
