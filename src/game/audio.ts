/** Tiny synthesized SFX. Resumed synchronously from the start gesture. */

export class GameAudio {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  sfx: GainNode | null = null;
  music: GainNode | null = null;
  noise: AudioBuffer | null = null;
  muted = false;
  private pad: OscillatorNode[] = [];

  unlock(): void {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!this.ctx) {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.sfx = this.ctx.createGain();
      this.music = this.ctx.createGain();
      this.sfx.connect(this.master);
      this.music.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.master.gain.value = 0.8;
      this.sfx.gain.value = 0.9;
      this.music.gain.value = 0.12;
      const len = Math.floor(this.ctx.sampleRate * 0.25);
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      this.startPad();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  private startPad(): void {
    if (!this.ctx || !this.music) return;
    const notes = [196, 246.94, 293.66];
    for (const f of notes) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.value = 0.15;
      o.connect(g);
      g.connect(this.music);
      o.start();
      this.pad.push(o);
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.03);
    }
  }

  private envNoise(duration: number, freq: number, gain: number): void {
    if (!this.ctx || !this.sfx || !this.noise || this.muted) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    filter.Q.value = 0.7;
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfx);
    src.playbackRate.value = 0.85 + Math.random() * 0.3;
    src.start(t);
    src.stop(t + duration + 0.02);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      g.disconnect();
    };
  }

  private blip(freq: number, duration: number, type: OscillatorType, gain: number): void {
    if (!this.ctx || !this.sfx || this.muted) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq * (0.96 + Math.random() * 0.08);
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g);
    g.connect(this.sfx);
    o.start(t);
    o.stop(t + duration + 0.02);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }

  break(): void {
    this.envNoise(0.12, 900, 0.5);
  }
  place(): void {
    this.blip(520, 0.07, "square", 0.12);
  }
  foot(): void {
    this.envNoise(0.05, 220, 0.18);
  }
  jump(): void {
    this.blip(340, 0.08, "sine", 0.08);
  }

  dispose(): void {
    for (const o of this.pad) {
      try {
        o.stop();
      } catch {
        /* already stopped */
      }
    }
    this.pad = [];
    void this.ctx?.close();
    this.ctx = null;
  }
}
