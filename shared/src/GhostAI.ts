import {
  FAKE_OUT_CHANCE,
  FAKE_OUT_MAX_RATIO,
  FAKE_OUT_MIN_RATIO,
  FAKE_OUT_TURN_MS,
  GHOST_TURN_DURATION_MS,
  MUSIC_LOOKING_MAX_MS,
  MUSIC_LOOKING_MIN_MS,
  RANDOM_CUT_MAX_RATIO,
  RANDOM_CUT_MIN_RATIO,
  musicPhaseDurationMs,
  musicPlaybackRate,
  type RhythmMode,
} from "./config";

export type GhostState =
  "LOOK_AWAY" | "TURNING_TO_LOOK" | "LOOKING" | "TURNING_AWAY";

function randomLookingDuration(rng: () => number): number {
  return (
    MUSIC_LOOKING_MIN_MS + rng() * (MUSIC_LOOKING_MAX_MS - MUSIC_LOOKING_MIN_MS)
  );
}

/**
 * 0 = 完全背對玩家，1 = 完全正面朝向玩家。TURNING_* 為線性內插。
 * 抽成獨立函式，讓伺服器權威版 GhostAI 與客戶端純顯示版 GhostReplicaAI 共用同一份數學，
 * 不會有兩邊插值算法不同步的風險。
 */
export function computeFacingAmount(
  state: GhostState,
  elapsedMs: number,
  durationMs: number,
): number {
  const progress =
    durationMs > 0
      ? Math.min(Math.max(elapsedMs, 0), durationMs) / durationMs
      : 1;
  switch (state) {
    case "LOOK_AWAY":
      return 0;
    case "TURNING_TO_LOOK":
      return progress;
    case "LOOKING":
      return 1;
    case "TURNING_AWAY":
      return 1 - progress;
  }
}

/**
 * 伺服器端權威狀態機：音樂播放（LOOK_AWAY）-> TURNING_TO_LOOK -> LOOKING -> TURNING_AWAY -> 音樂播放 ...
 * 只有 LOOKING 狀態會判定玩家移動違規（對應 PRD 8.1-8.3）。
 *
 * rng 可注入（測試用固定序列），預設 Math.random。音樂輪次由伺服器遞增，播放速度與音樂播放期
 * 都從共用設定計算，讓主辦方端和單機端只負責呈現，不能影響判定。
 *
 * rhythmMode（見 config.ts 的 RhythmMode）：
 * - random-cut：LOOK_AWAY 縮短成整首的隨機比例，音樂提早中斷。
 * - fake-out：LOOK_AWAY 拆成兩段，中間插入一次「轉過來又轉回去」（TURNING_TO_LOOK -> TURNING_AWAY，
 *   不經過 LOOKING，所以不判定），第二段 LOOK_AWAY 以 musicOffsetMs 從中斷處接著播。
 * classic 模式完全不消耗 rng，維持原本的亂數序列。
 */
export class GhostAI {
  private state: GhostState = "LOOK_AWAY";
  private stateStartedAt: number;
  private stateDuration = 0;
  private readonly rng: () => number;
  private readonly rhythmMode: RhythmMode;
  private musicCycle = 0;
  /** 目前這段 LOOK_AWAY 從音檔的哪個位置開始播（音檔原速的 ms）。 */
  private musicOffsetMs = 0;
  /** fake-out：假動作結束後要接回去的那一段音樂；null＝這一輪沒有排假動作。 */
  private pendingResume: { durationMs: number; offsetMs: number } | null = null;
  private fakeOutInProgress = false;

  constructor(
    now: number,
    rng: () => number = Math.random,
    rhythmMode: RhythmMode = "classic",
  ) {
    this.rng = rng;
    this.rhythmMode = rhythmMode;
    this.stateStartedAt = now;
    this.beginLookAway(now);
  }

  update(now: number): void {
    const elapsed = now - this.stateStartedAt;
    if (elapsed < this.stateDuration) return;

    switch (this.state) {
      case "LOOK_AWAY":
        if (this.pendingResume) {
          this.fakeOutInProgress = true;
          this.transitionTo(now, "TURNING_TO_LOOK", FAKE_OUT_TURN_MS);
        } else {
          this.transitionTo(now, "TURNING_TO_LOOK", GHOST_TURN_DURATION_MS);
        }
        break;
      case "TURNING_TO_LOOK":
        if (this.fakeOutInProgress) {
          this.transitionTo(now, "TURNING_AWAY", FAKE_OUT_TURN_MS);
        } else {
          this.transitionTo(now, "LOOKING", randomLookingDuration(this.rng));
        }
        break;
      case "LOOKING":
        this.transitionTo(now, "TURNING_AWAY", GHOST_TURN_DURATION_MS);
        break;
      case "TURNING_AWAY":
        if (this.fakeOutInProgress && this.pendingResume) {
          const resume = this.pendingResume;
          this.fakeOutInProgress = false;
          this.pendingResume = null;
          this.transitionTo(now, "LOOK_AWAY", resume.durationMs);
          this.musicOffsetMs = resume.offsetMs;
        } else {
          this.musicCycle += 1;
          this.stateStartedAt = now;
          this.beginLookAway(now);
        }
        break;
    }
  }

  /** 開始新一輪音樂：依 rhythmMode 決定這段 LOOK_AWAY 的長度，必要時排一次假動作。 */
  private beginLookAway(now: number): void {
    const fullMs = musicPhaseDurationMs(this.musicCycle);
    let durationMs = fullMs;
    this.pendingResume = null;
    this.fakeOutInProgress = false;
    if (this.rhythmMode === "random-cut") {
      const ratio =
        RANDOM_CUT_MIN_RATIO +
        this.rng() * (RANDOM_CUT_MAX_RATIO - RANDOM_CUT_MIN_RATIO);
      durationMs = Math.round(fullMs * ratio);
    } else if (
      this.rhythmMode === "fake-out" &&
      this.musicCycle > 0 &&
      this.rng() < FAKE_OUT_CHANCE
    ) {
      const ratio =
        FAKE_OUT_MIN_RATIO +
        this.rng() * (FAKE_OUT_MAX_RATIO - FAKE_OUT_MIN_RATIO);
      durationMs = Math.round(fullMs * ratio);
      this.pendingResume = {
        durationMs: fullMs - durationMs,
        offsetMs: Math.round(durationMs * musicPlaybackRate(this.musicCycle)),
      };
    }
    this.transitionTo(now, "LOOK_AWAY", durationMs);
    this.musicOffsetMs = 0;
  }

  private transitionTo(now: number, state: GhostState, duration: number): void {
    this.state = state;
    this.stateStartedAt = now;
    this.stateDuration = duration;
  }

  isLooking(): boolean {
    return this.state === "LOOKING";
  }

  getState(): GhostState {
    return this.state;
  }

  getStateStartedAt(): number {
    return this.stateStartedAt;
  }

  getStateDuration(): number {
    return this.stateDuration;
  }

  getMusicCycle(): number {
    return this.musicCycle;
  }

  getMusicPlaybackRate(): number {
    return musicPlaybackRate(this.musicCycle);
  }

  getMusicOffsetMs(): number {
    return this.musicOffsetMs;
  }

  /** 目前是否是 fake-out 的假回頭（不判定）；純顯示用。 */
  isFakeOut(): boolean {
    return this.fakeOutInProgress;
  }

  /** 暫停/恢復時校正計時基準點，讓恢復後的剩餘時間跟暫停前一致（見 GameRoom 的 pause/resume）。 */
  shiftClock(deltaMs: number): void {
    this.stateStartedAt += deltaMs;
  }

  getFacingPlayerAmount(now: number): number {
    return computeFacingAmount(
      this.state,
      now - this.stateStartedAt,
      this.stateDuration,
    );
  }
}

/**
 * 客戶端純顯示用：沒有 update()、沒有亂數，狀態完全由伺服器廣播的 `ghost:stateChanged` 驅動。
 * isLooking() 純粹視覺用（例如切換感測燈），絕不用來做任何判定——判定只在伺服器的 GhostAI 發生。
 *
 * 注意：applyServerState 收到的 stateStartedAtMs 是「伺服器時間」，之後呼叫 getFacingPlayerAmount(now)
 * 的 now 也必須是同一個時間基準（見 client/src/net/ClockSync.ts 的 nowServerMs()）。
 */
export class GhostReplicaAI {
  private state: GhostState = "LOOK_AWAY";
  private stateStartedAt: number;
  private stateDuration = 0;
  private musicCycle = 0;
  private musicPlaybackRate = 1;
  private musicOffsetMs = 0;

  constructor(now: number) {
    this.stateStartedAt = now;
  }

  applyServerState(
    state: GhostState,
    stateStartedAtMs: number,
    stateDurationMs: number,
    musicCycle = 0,
    musicPlaybackRate = 1,
    musicOffsetMs = 0,
  ): void {
    this.state = state;
    this.stateStartedAt = stateStartedAtMs;
    this.stateDuration = stateDurationMs;
    this.musicCycle = musicCycle;
    this.musicPlaybackRate = musicPlaybackRate;
    this.musicOffsetMs = musicOffsetMs;
  }

  getMusicOffsetMs(): number {
    return this.musicOffsetMs;
  }

  isLooking(): boolean {
    return this.state === "LOOKING";
  }

  getState(): GhostState {
    return this.state;
  }

  getRemainingMs(now: number): number {
    return Math.max(0, this.stateDuration - (now - this.stateStartedAt));
  }

  getFacingPlayerAmount(now: number): number {
    return computeFacingAmount(
      this.state,
      now - this.stateStartedAt,
      this.stateDuration,
    );
  }

  getMusicCycle(): number {
    return this.musicCycle;
  }

  getMusicPlaybackRate(): number {
    return this.musicPlaybackRate;
  }
}
