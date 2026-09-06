import type { GhostVisualState, RoomPhase } from "shared";

/** 沒有音檔的短音效仍用 Web Audio API 即時合成；主要遊戲節奏由主辦方播放真實音檔。 */
export type SfxName = "footstep" | "ghostTurn" | "caught" | "victory" | "boost";

const SHOT_URL = new URL("../../../asserts/shoot.mp3", import.meta.url).href;
const SHOT_SPACING_SECONDS = 0.12;

class SfxEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private shotBuffer: Promise<AudioBuffer> | null = null;
  private nextShotAt = 0;

  /** 在按下加入／開始／踏步等使用者手勢中解鎖，廣播到達時即可播放扣分音效。 */
  unlock(): void {
    const ctx = this.ensureContext();
    void this.loadShot(ctx).catch((error: unknown) => console.warn("扣分音效載入失敗", error));
  }

  private loadShot(ctx: AudioContext): Promise<AudioBuffer> {
    this.shotBuffer ??= fetch(SHOT_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`shoot.mp3: HTTP ${response.status}`);
        return response.arrayBuffer();
      })
      .then((data) => ctx.decodeAudioData(data))
      .catch((error: unknown) => { this.shotBuffer = null; throw error; });
    return this.shotBuffer;
  }

  private async playShot(ctx: AudioContext): Promise<void> {
    try {
      const buffer = await this.loadShot(ctx);
      // 每筆扣分事件建立獨立音源，密集扣分依序錯開，前一聲也能完整播放。
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.masterGain!);
      const startAt = Math.max(ctx.currentTime, this.nextShotAt);
      this.nextShotAt = startAt + SHOT_SPACING_SECONDS;
      source.start(startAt);
      source.onended = () => source.disconnect();
    } catch (error) {
      console.warn("扣分音效播放失敗", error);
    }
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
    const ctx = this.ensureContext();
    const t0 = ctx.currentTime;

    switch (name) {
      case "footstep":
        this.noiseBurst(ctx, t0, 0.07, 0.18, 900);
        break;
      case "ghostTurn":
        this.tone(ctx, t0, 0.3, 620, 200, "triangle", 0.2);
        break;
      case "caught":
        void this.playShot(ctx);
        break;
      case "victory":
        this.tone(ctx, t0, 0.16, 523, 523, "sine", 0.2);
        this.tone(ctx, t0 + 0.15, 0.16, 659, 659, "sine", 0.2);
        this.tone(ctx, t0 + 0.3, 0.16, 784, 784, "sine", 0.2);
        this.tone(ctx, t0 + 0.45, 0.4, 1047, 1047, "sine", 0.22);
        break;
      case "boost":
        this.tone(ctx, t0, 0.12, 500, 1200, "sawtooth", 0.18);
        this.tone(ctx, t0 + 0.08, 0.16, 700, 1600, "sawtooth", 0.16);
        break;
    }
  }
}

export const sfx = new SfxEngine();

const MUSIC_URL = new URL("../../../asserts/123木頭人.mp3", import.meta.url).href;

/**
 * 依伺服器廣播的鬼狀態同步主辦方端的音樂。音檔播放只負責呈現，真正的狀態切換與判定仍由伺服器控制。
 */
export class MusicPlayer {
  readonly audio = new Audio(MUSIC_URL);
  private readonly onBlocked?: () => void;
  private lastCycle = -1;
  private lastState: GhostVisualState["state"] | null = null;
  private blocked = false;
  private shouldBePlaying = false;

  constructor(onBlocked?: () => void) {
    this.onBlocked = onBlocked;
    this.audio.preload = "auto";
    this.audio.addEventListener("error", () => this.notifyBlocked());
  }

  /** 在主辦方按下「開始遊戲」的使用者手勢中預熱音檔，降低瀏覽器自動播放被擋的機率。 */
  primeFromGesture(): void {
    this.audio.currentTime = 0;
    this.audio.playbackRate = 1;
    void this.audio.play().then(() => {
      if (this.shouldBePlaying) return;
      this.audio.pause();
      this.audio.currentTime = 0;
    }).catch((error: unknown) => this.handlePlayError(error));
  }

  retry(): void {
    this.blocked = false;
    this.primeFromGesture();
  }

  sync(ghost: GhostVisualState | null, phase: RoomPhase, nowMs: number): void {
    if (phase !== "PLAYING" || !ghost || ghost.state !== "LOOK_AWAY") {
      this.shouldBePlaying = false;
      this.audio.pause();
      return;
    }
    this.shouldBePlaying = true;

    const isNewCycle = ghost.musicCycle !== this.lastCycle || ghost.state !== this.lastState;
    if (isNewCycle) {
      this.lastCycle = ghost.musicCycle;
      this.lastState = ghost.state;
      this.audio.playbackRate = ghost.musicPlaybackRate;
      this.audio.currentTime = this.expectedTime(ghost, nowMs);
    } else {
      const expected = this.expectedTime(ghost, nowMs);
      if (Math.abs(this.audio.currentTime - expected) > 0.35) this.audio.currentTime = expected;
    }

    if (this.audio.paused) {
      void this.audio.play().catch((error: unknown) => this.handlePlayError(error));
    }
  }

  stop(): void {
    this.shouldBePlaying = false;
    this.audio.pause();
    this.audio.currentTime = 0;
    this.lastCycle = -1;
    this.lastState = null;
  }

  private expectedTime(ghost: GhostVisualState, nowMs: number): number {
    const seconds = Math.max(0, nowMs - ghost.stateStartedAtMs) / 1000 * ghost.musicPlaybackRate;
    return Number.isFinite(this.audio.duration) ? Math.min(seconds, Math.max(0, this.audio.duration - 0.02)) : seconds;
  }

  private notifyBlocked(): void {
    if (this.blocked) return;
    this.blocked = true;
    this.onBlocked?.();
  }

  private handlePlayError(error: unknown): void {
    // 狀態切換主動 pause() 可能中止尚未完成的 play()，這不代表瀏覽器拒絕播放。
    if (error instanceof DOMException && error.name === "AbortError") return;
    this.notifyBlocked();
  }
}
