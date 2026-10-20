// Sección "Piques (prueba)": escuchar en vivo, grabar datos y analizar un video.
import { listen, analyzeFile } from "./audio.js";
import { reset, setSensitivity, intervals } from "./bounce.js";

const $ = (id) => document.getElementById(id);
const RECORD_MS = 10000;

// El control va de 1 (poco sensible) a 10 (muy sensible).
// El detector usa lo contrario: cuántas veces más fuerte que el fondo.
const toDetector = (slider) => 13 - slider;

export function setupBounceTest(notify) {
  const els = {
    count: $("bounceCount"),
    intervals: $("bounceIntervals"),
    level: $("bounceLevel"),
    sens: $("bounceSens"),
    sensValue: $("bounceSensValue"),
    listenBtn: $("bounceListenBtn"),
    resetBtn: $("bounceResetBtn"),
    recordBtn: $("bounceRecordBtn"),
    fileBtn: $("bounceFileBtn"),
    file: $("bounceFile"),
    status: $("bounceStatus"),
    chart: $("bounceChart"),
  };

  let session = null;
  let times = [];

  const showCount = () => {
    els.count.textContent = times.length;
    const last = intervals(times.slice(-4));
    els.intervals.textContent = last.length ? `${last.map((ms) => (ms / 1000).toFixed(2)).join(" · ")} s` : "";
  };

  els.sens.addEventListener("input", () => {
    els.sensValue.textContent = els.sens.value;
    if (session) setSensitivity(session.detector, toDetector(Number(els.sens.value)));
  });

  els.resetBtn.addEventListener("click", () => {
    times = [];
    if (session) reset(session.detector);
    showCount();
  });

  els.listenBtn.addEventListener("click", async () => {
    if (session) {
      session.stop();
      session = null;
      els.listenBtn.textContent = "Escuchar piques";
      els.recordBtn.disabled = true;
      els.level.style.width = "0%";
      els.status.textContent = "";
      return;
    }
    try {
      els.status.textContent = "Midiendo el ruido de fondo...";
      session = await listen({
        sensitivity: toDetector(Number(els.sens.value)),
        onBounce: (t) => {
          times.push(t);
          showCount();
        },
        onLevel: (level) => {
          els.level.style.width = `${Math.round(level * 100)}%`;
        },
      });
      els.listenBtn.textContent = "Dejar de escuchar";
      els.recordBtn.disabled = false;
      setTimeout(() => {
        if (session) els.status.textContent = "Escuchando. Hacé picar la pelota.";
      }, 1500);
    } catch (err) {
      session = null;
      els.status.textContent = err.name === "NotAllowedError" ? "Sin permiso para usar el micrófono" : "No se pudo abrir el micrófono";
    }
  });

  els.recordBtn.addEventListener("click", () => {
    if (!session) return;
    session.startRecording();
    els.recordBtn.disabled = true;
    els.status.textContent = "Grabando 10 s: hacé picar la pelota y contá en voz baja";
    setTimeout(() => {
      const data = session?.stopRecording();
      els.recordBtn.disabled = !session;
      if (!data) return;
      download(`piques-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`, {
        ...data,
        note: "Escribí acá cuántos piques contaste vos",
        counted: null,
      });
      els.status.textContent = `Listo: la app contó ${data.bounces.length} piques en 10 s. Se bajó el archivo.`;
    }, RECORD_MS);
  });

  els.fileBtn.addEventListener("click", () => els.file.click());
  els.file.addEventListener("change", async () => {
    const file = els.file.files[0];
    els.file.value = "";
    if (!file) return;
    els.status.textContent = `Analizando ${file.name}...`;
    els.fileBtn.disabled = true;
    try {
      const result = await analyzeFile(file, toDetector(Number(els.sens.value)));
      times = result.bounces;
      showCount();
      drawChart(els.chart, result);
      const perMinute = Math.round((result.bounces.length / result.duration) * 60);
      els.status.textContent = `${result.bounces.length} piques en ${Math.round(result.duration)} s (${perMinute} por minuto)`;
    } catch {
      notify("No pude leer el audio de ese archivo");
      els.status.textContent = "";
    } finally {
      els.fileBtn.disabled = false;
    }
  });
}

function download(name, data) {
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

// Línea verde: energía de los agudos. Rayas: piques detectados.
function drawChart(canvas, { energies, bounces, duration }) {
  canvas.classList.remove("hidden");
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth * ratio;
  const height = canvas.clientHeight * ratio;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, width, height);

  // Un punto por columna de píxeles: el máximo de los bloques que caen ahí.
  const perPixel = Math.max(1, Math.floor(energies.length / width));
  const columns = [];
  for (let i = 0; i < energies.length; i += perPixel) {
    let max = 0;
    for (let j = i; j < i + perPixel && j < energies.length; j++) max = Math.max(max, energies[j]);
    columns.push(max);
  }
  const top = Math.max(...columns) || 1;

  ctx.strokeStyle = "rgba(250,250,250,0.25)";
  ctx.lineWidth = ratio;
  for (const t of bounces) {
    const x = (t / (duration * 1000)) * width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  ctx.strokeStyle = "#FAFAFA";
  ctx.beginPath();
  columns.forEach((e, i) => {
    const x = (i / columns.length) * width;
    const y = height - (e / top) * height * 0.95;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  
}
