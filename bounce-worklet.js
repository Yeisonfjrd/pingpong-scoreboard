// Corre en el hilo de audio: calcula la energía (RMS) de cada bloque de 128 muestras
// y la manda en tandas al hilo principal, donde el detector decide si hubo un pique.

class EnergyProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.batch = [];
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel) {
      let sum = 0;
      for (let i = 0; i < channel.length; i++) sum += channel[i] * channel[i];
      this.batch.push(Math.sqrt(sum / channel.length));
      // Unos 20 ms por tanda: suficiente para que la cuenta se vea al instante.
      if (this.batch.length >= 8) {
        this.port.postMessage({ energies: this.batch, endTime: currentTime, blockSize: channel.length });
        this.batch = [];
      }
    }
    return true;
  }
}

registerProcessor("energy", EnergyProcessor);
