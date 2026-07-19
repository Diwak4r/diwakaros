/**
 * Lightweight Web Audio SFX (no external files).
 */

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.master = 0.25;
  }

  ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  play(type) {
    if (!this.enabled) return;
    try {
      const ctx = this.ensure();
      const t = ctx.currentTime;
      switch (type) {
        case "break":
          this.noiseBurst(t, 0.08, 400, 0.3);
          break;
        case "place":
          this.tone(t, 180, 0.05, "square", 0.15);
          this.tone(t + 0.04, 120, 0.06, "square", 0.1);
          break;
        case "step":
          this.noiseBurst(t, 0.04, 200, 0.12);
          break;
        case "jump":
          this.tone(t, 220, 0.06, "sine", 0.12);
          this.tone(t + 0.05, 320, 0.08, "sine", 0.08);
          break;
        case "hurt":
          this.tone(t, 140, 0.15, "sawtooth", 0.2);
          this.tone(t + 0.05, 90, 0.2, "sawtooth", 0.15);
          break;
        case "click":
          this.tone(t, 600, 0.03, "square", 0.08);
          break;
        case "ui":
          this.tone(t, 400, 0.04, "sine", 0.1);
          break;
        default:
          break;
      }
    } catch {
      /* ignore audio errors */
    }
  }

  tone(start, freq, dur, type, vol) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(this.master * vol, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  noiseBurst(start, dur, freq, vol) {
    const ctx = this.ctx;
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.5);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    filter.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.value = this.master * vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(start);
  }
}
