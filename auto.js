// Modo automático: junta el micrófono (cuándo picó), la cámara (de qué lado) y el árbitro
// (cuándo terminó el punto). No suma nada: avisa con onPropose(ganador) y la app decide.
import { listen } from "./audio.js";
import { frameBuffer, sideFromBuffer } from "./camera.js";
import { createRally, addBounce, checkSilence, resetRally, winnerFor } from "./rally.js";

export async function startAuto({ video, calibration, sensitivity, getLeftPlayer, onPropose, onBounce = () => {} }) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment", frameRate: { ideal: 60 }, width: { ideal: 1280 } },
  });
  video.srcObject = stream;
  await video.play();
  const buffer = frameBuffer(video);

  let rally = createRally();
  let paused = false;

  const decide = (decision) => {
    rally = resetRally(rally);
    // Si el último pique no se vio, no adivina: el punto lo anotás vos.
    if (decision.loserSide === null) return;
    onPropose(winnerFor(decision.loserSide, getLeftPlayer()), decision.reason);
  };

  let mic;
  try {
    mic = await listen({
      sensitivity,
      onLevel: () => {},
      onBounce: (t, perfTime) => {
        if (paused) return;
        // Un cuadro más de margen para que el buffer tenga el cuadro de justo después del pique.
        setTimeout(() => {
          if (paused) return;
          const hit = sideFromBuffer(buffer, perfTime, calibration, video.videoWidth, video.videoHeight);
          onBounce(hit);
          const result = addBounce(rally, { t: perfTime, side: hit ? hit.side : null });
          rally = result.rally;
          if (result.decision) decide(result.decision);
        }, 60);
      },
    });
  } catch (err) {
    buffer.stop();
    stream.getTracks().forEach((track) => track.stop());
    throw err;
  }

  const timer = setInterval(() => {
    if (paused) return;
    const decision = checkSilence(rally, performance.now());
    if (decision) decide(decision);
  }, 100);

  return {
    // Mientras hay un punto propuesto no escucha: el próximo peloteo arranca de cero.
    pause() {
      paused = true;
      rally = resetRally(rally);
    },
    resume() {
      rally = resetRally(rally);
      paused = false;
    },
    stop() {
      clearInterval(timer);
      mic.stop();
      buffer.stop();
      stream.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    },
  };
}
