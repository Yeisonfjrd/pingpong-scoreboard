// Sección "Cámara (prueba)": calibrar la mesa tocando sus 4 esquinas y ver de qué lado pica la pelota.
import {
  loadCalibration,
  saveCalibration,
  toPixels,
  learnTableColor,
  frameBuffer,
  sideFromBuffer,
  sidesInVideo,
} from "./camera.js";
import { tableHomography, toImage } from "./table.js";
import { analyzeFile } from "./audio.js";

const $ = (id) => document.getElementById(id);
const SIDE_NAMES = ["Izquierda", "Derecha"];

export function setupCameraTest(notify) {
  const els = {
    wrap: $("camWrap"),
    video: $("camVideo"),
    overlay: $("camOverlay"),
    status: $("camStatus"),
    counts: $("camCounts"),
    openBtn: $("camOpenBtn"),
    calibrateBtn: $("camCalibrateBtn"),
    fileBtn: $("camFileBtn"),
    file: $("camFile"),
    results: $("camResults"),
  };

  let stream = null;
  let buffer = null;
  let calibration = loadCalibration(localStorage);
  // Un video analizado se calibra aparte: no pisa la calibración de la cámara en vivo.
  let fileCalibration = null;
  let marking = null;
  let onMarked = null;
  let lastHit = null;
  let counts = [0, 0];

  const activeCalibration = () => (stream ? calibration : fileCalibration);

  const showCounts = () => {
    els.counts.textContent = `${SIDE_NAMES[0]}: ${counts[0]} · ${SIDE_NAMES[1]}: ${counts[1]}`;
  };

  function draw() {
    const { overlay, video } = els;
    const width = overlay.clientWidth;
    const height = overlay.clientHeight;
    const ratio = window.devicePixelRatio || 1;
    if (overlay.width !== width * ratio) overlay.width = width * ratio;
    if (overlay.height !== height * ratio) overlay.height = height * ratio;
    const ctx = overlay.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const calib = activeCalibration();
    if (calib && !marking) {
      const corners = toPixels(calib, width, height);
      ctx.strokeStyle = "rgba(250,250,250,0.8)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      corners.forEach((c, i) => (i ? ctx.lineTo(c.x, c.y) : ctx.moveTo(c.x, c.y)));
      ctx.closePath();
      ctx.stroke();
      // La red, calculada con la perspectiva.
      const H = tableHomography(corners);
      const a = toImage(H, { u: 0.5, v: 0 });
      const b = toImage(H, { u: 0.5, v: 1 });
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (marking) {
      ctx.fillStyle = "#FAFAFA";
      for (const p of marking) {
        ctx.beginPath();
        ctx.arc(p.x * width, p.y * height, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (lastHit && performance.now() - lastHit.at < 1500 && video.videoWidth) {
      ctx.strokeStyle = "#FF3B30";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc((lastHit.x / video.videoWidth) * width, (lastHit.y / video.videoHeight) * height, 12, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (stream || marking || fileCalibration) requestAnimationFrame(draw);
  }

  function startMarking(done) {
    marking = [];
    onMarked = done;
    els.status.textContent = "Tocá las 4 esquinas de la mesa (arriba de la tabla, no las patas)";
    requestAnimationFrame(draw);
  }

  els.overlay.addEventListener("click", (e) => {
    if (!marking) return;
    const rect = els.overlay.getBoundingClientRect();
    marking.push({ x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height });
    els.status.textContent = `Esquina ${marking.length} de 4`;
    if (marking.length < 4) return;
    const corners = marking;
    marking = null;
    try {
      const { videoWidth: w, videoHeight: h } = els.video;
      const calib = { corners };
      tableHomography(toPixels(calib, w, h));
      calib.tableColor = learnTableColor(els.video, calib, w, h);
      onMarked(calib);
    } catch {
      els.status.textContent = "Esas esquinas no forman una mesa. Probá de nuevo.";
    }
  });

  els.calibrateBtn.addEventListener("click", () => {
    if (!stream) {
      notify("Primero abrí la cámara");
      return;
    }
    startMarking((calib) => {
      calibration = calib;
      saveCalibration(localStorage, calib);
      els.status.textContent = "Mesa calibrada. Activá el modo automático (arriba) y a jugar.";
    });
  });

  els.openBtn.addEventListener("click", async () => {
    if (stream) {
      closeCamera();
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", frameRate: { ideal: 60 }, width: { ideal: 1280 } },
      });
    } catch {
      els.status.textContent = "No se pudo abrir la cámara";
      return;
    }
    fileCalibration = null;
    els.results.replaceChildren();
    els.video.srcObject = stream;
    els.video.removeAttribute("src");
    els.wrap.classList.remove("hidden");
    await els.video.play();
    buffer = frameBuffer(els.video);
    els.openBtn.textContent = "Cerrar cámara";
    counts = [0, 0];
    showCounts();
    els.status.textContent = calibration
      ? "Cámara lista. Si moviste el celular, volvé a marcar las esquinas."
      : "Apoyá el celular fijo, con toda la mesa a la vista, y marcá las esquinas.";
    requestAnimationFrame(draw);
  });

  function closeCamera() {
    buffer?.stop();
    buffer = null;
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    els.video.srcObject = null;
    els.wrap.classList.add("hidden");
    els.openBtn.textContent = "Abrir cámara";
    els.status.textContent = "";
  }

  // Cada pique que escucha el micrófono: buscar la pelota en los cuadros de ese momento.
  window.addEventListener("pingpong:bounce", ({ detail }) => {
    if (!stream || !buffer || !calibration) return;
    // Esperar un cuadro más, así el buffer ya tiene el cuadro de justo después del pique.
    setTimeout(() => {
      const { videoWidth: w, videoHeight: h } = els.video;
      const hit = sideFromBuffer(buffer, detail.perfTime, calibration, w, h);
      if (!hit) return;
      counts[hit.side] += 1;
      showCounts();
      lastHit = { ...hit, at: performance.now() };
      els.status.textContent = `Último pique: ${SIDE_NAMES[hit.side].toLowerCase()}`;
    }, 60);
  });

  els.fileBtn.addEventListener("click", () => els.file.click());
  els.file.addEventListener("change", () => {
    const file = els.file.files[0];
    els.file.value = "";
    if (!file) return;
    if (stream) closeCamera();
    els.results.replaceChildren();
    els.video.srcObject = null;
    els.video.src = URL.createObjectURL(file);
    els.video.muted = true;
    els.wrap.classList.remove("hidden");
    els.video.addEventListener(
      "loadeddata",
      () => {
        // Un cuadro del medio del video, donde seguro se ve la mesa.
        els.video.currentTime = Math.min(2, els.video.duration / 2);
        els.video.addEventListener("seeked", () => startMarking((calib) => analyze(file, calib)), { once: true });
      },
      { once: true },
    );
  });

  async function analyze(file, calib) {
    fileCalibration = calib;
    els.fileBtn.disabled = true;
    try {
      els.status.textContent = "Escuchando los piques del video...";
      const sensitivity = 13 - Number($("bounceSens")?.value ?? 8);
      const audio = await analyzeFile(file, sensitivity);
      els.status.textContent = `${audio.bounces.length} piques. Mirando el video (tarda lo que dura)...`;
      const results = await sidesInVideo(els.video, audio.bounces, calib, (p) => {
        els.status.textContent = `Buscando la pelota... ${Math.round(p * 100)}%`;
      });
      const seen = results.filter((r) => r.hit);
      counts = [0, 0];
      seen.forEach((r) => (counts[r.hit.side] += 1));
      showCounts();
      els.status.textContent = `Vio la pelota en ${seen.length} de ${results.length} piques`;
      thumbnails(seen.slice(0, 12), calib);
    } catch {
      notify("No pude analizar ese video");
      els.status.textContent = "";
    } finally {
      els.fileBtn.disabled = false;
    }
  }

  // Miniaturas de cada pique con un círculo donde vio la pelota, para revisar a ojo si acertó.
  function thumbnails(list, calib) {
    const { videoWidth, videoHeight } = els.video;
    const H = tableHomography(toPixels(calib, videoWidth, videoHeight));
    const netA = toImage(H, { u: 0.5, v: -0.5 });
    const netB = toImage(H, { u: 0.5, v: 1.5 });
    const items = list.map((r) => {
      const { image, x, y, w, h } = r.thumb;
      const canvas = document.createElement("canvas");
      canvas.width = 240;
      canvas.height = 120;
      canvas.className = "w-full";
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      // La red, para ver a ojo de qué lado quedó la pelota.
      const sx = canvas.width / w;
      const sy = canvas.height / h;
      ctx.strokeStyle = "rgba(250,250,250,0.9)";
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo((netA.x - x) * sx, (netA.y - y) * sy);
      ctx.lineTo((netB.x - x) * sx, (netB.y - y) * sy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = "#FF3B30";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(((r.hit.x - x) / w) * canvas.width, ((r.hit.y - y) / h) * canvas.height, 10, 0, Math.PI * 2);
      ctx.stroke();

      const figure = document.createElement("figure");
      const caption = document.createElement("figcaption");
      caption.className = "mt-1 text-[0.7rem] uppercase tracking-[0.1em] text-white/60";
      caption.textContent = `${(r.t / 1000).toFixed(1)} s · ${SIDE_NAMES[r.hit.side]}`;
      figure.append(canvas, caption);
      return figure;
    });
    els.results.replaceChildren(...items);
  }

  showCounts();
}
