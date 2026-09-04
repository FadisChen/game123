/**
 * 沒有真實音效素材，改用 Web Audio API 即時合成短音效（對應 PRD 第 14 章的音效清單）。
 * 「遊戲結束音」併入勝利／淘汰音效本身，避免結算當下連續播放兩段聲音。
 */
export type SfxName = "countdown" | "go" | "footstep" | "ghostTurn" | "caught" | "eliminated" | "victory";

const MUTE_STORAGE_KEY = "123-doll-sfx-muted";

function readStoredMute(): boolean {
  try {
    return localStorage.getItem(MUTE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeStoredMute(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_STORAGE_KEY, muted ? "1" : "0");
  } catch {
    // 私密瀏覽模式等情境下 localStorage 可能不可用，靜默忽略即可。
  }
}

class SfxEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = readStoredMute();

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    writeStoredMute(muted);
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.5;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.noiseBuffer) {
      const length = Math.floor(ctx.sampleRate * 0.15);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buffer;
    }
    return this.noiseBuffer;
  }

  private tone(
    ctx: AudioContext,
    startTime: number,
    duration: number,
    freqStart: number,
    freqEnd: number,
    type: OscillatorType,
    peakGain: number,
  ): void {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, startTime);
    if (freqEnd !== freqStart) osc.frequency.linearRampToValueAtTime(freqEnd, startTime + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain).connect(this.masterGain!);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  private noiseBurst(ctx: AudioContext, startTime: number, duration: number, peakGain: number, lowpassHz: number): void {
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = lowpassHz;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peakGain, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    src.connect(filter).connect(gain).connect(this.masterGain!);
    src.start(startTime);
    src.stop(startTime + duration + 0.02);
  }

  play(name: SfxName): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    const t0 = ctx.currentTime;

    switch (name) {
      case "countdown":
        this.tone(ctx, t0, 0.1, 880, 880, "sine", 0.25);
        break;
      case "go":
        this.tone(ctx, t0, 0.28, 440, 900, "sawtooth", 0.22);
        break;
      case "footstep":
        this.noiseBurst(ctx, t0, 0.07, 0.18, 900);
        break;
      case "ghostTurn":
        this.tone(ctx, t0, 0.3, 620, 200, "triangle", 0.2);
        break;
      case "caught":
        this.tone(ctx, t0, 0.28, 220, 210, "square", 0.22);
        this.tone(ctx, t0, 0.28, 233, 220, "square", 0.16);
        break;
      case "eliminated":
        this.tone(ctx, t0, 0.22, 440, 440, "sine", 0.2);
        this.tone(ctx, t0 + 0.2, 0.22, 370, 370, "sine", 0.2);
        this.tone(ctx, t0 + 0.4, 0.4, 293, 220, "sine", 0.2);
        break;
      case "victory":
        this.tone(ctx, t0, 0.16, 523, 523, "sine", 0.2);
        this.tone(ctx, t0 + 0.15, 0.16, 659, 659, "sine", 0.2);
        this.tone(ctx, t0 + 0.3, 0.16, 784, 784, "sine", 0.2);
        this.tone(ctx, t0 + 0.45, 0.4, 1047, 1047, "sine", 0.22);
        break;
    }
  }
}

export const sfx = new SfxEngine();
