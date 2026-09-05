import {
  DEFAULT_ROOM_SETTINGS,
  DIFFICULTY_PROFILES,
  FAKE_TURN_PEAK,
  fakeTurnDurationMs,
  type DifficultyProfile,
} from "./config";

export type GhostState = "LOOK_AWAY" | "TURNING_TO_LOOK" | "LOOKING" | "TURNING_AWAY" | "FAKE_TURN";

function randomLookAwayDuration(rng: () => number, profile: DifficultyProfile): number {
  return profile.ghostLookAwayMinMs + rng() * (profile.ghostLookAwayMaxMs - profile.ghostLookAwayMinMs);
}

/**
 * 0 = 完全背對玩家，1 = 完全正面朝向玩家。TURNING_* 為線性內插；
 * FAKE_TURN 為先升後降的三角波，且不超過 FAKE_TURN_PEAK。
 * 抽成獨立函式，讓伺服器權威版 GhostAI 與客戶端純顯示版 GhostReplicaAI 共用同一份數學，
 * 不會有兩邊插值算法不同步的風險。
 */
export function computeFacingAmount(state: GhostState, elapsedMs: number, durationMs: number): number {
  const progress = durationMs > 0 ? Math.min(elapsedMs, durationMs) / durationMs : 1;
  switch (state) {
    case "LOOK_AWAY":
      return 0;
    case "TURNING_TO_LOOK":
      return progress;
    case "LOOKING":
      return 1;
    case "TURNING_AWAY":
      return 1 - progress;
    case "FAKE_TURN":
      return progress < 0.5 ? (progress / 0.5) * FAKE_TURN_PEAK : (1 - (progress - 0.5) / 0.5) * FAKE_TURN_PEAK;
  }
}

/**
 * 伺服器端權威狀態機：LOOK_AWAY -> TURNING_TO_LOOK -> LOOKING -> TURNING_AWAY -> LOOK_AWAY ...
 * 只有 LOOKING 狀態會判定玩家移動違規（對應 PRD 8.1-8.3）。
 * LOOK_AWAY 結束時有機率轉入 FAKE_TURN（PRD 22.1 鬼的假動作），全程不會進入 LOOKING。
 *
 * rng 可注入（測試用固定序列），預設 Math.random；profile 由呼叫端（GameRoom）依房間難度注入，
 * 省略時就是預設難度，讓單機離線版與單元測試不必知道房間設定的存在。
 */
export class GhostAI {
  private state: GhostState = "LOOK_AWAY";
  private stateStartedAt: number;
  private stateDuration: number;
  private readonly rng: () => number;
  private readonly profile: DifficultyProfile;

  constructor(
    now: number,
    rng: () => number = Math.random,
    profile: DifficultyProfile = DIFFICULTY_PROFILES[DEFAULT_ROOM_SETTINGS.difficulty],
  ) {
    this.rng = rng;
    this.profile = profile;
    this.stateStartedAt = now;
    this.stateDuration = randomLookAwayDuration(rng, profile);
  }

  update(now: number): void {
    const elapsed = now - this.stateStartedAt;
    if (elapsed < this.stateDuration) return;

    switch (this.state) {
      case "LOOK_AWAY":
        if (this.rng() < this.profile.fakeTurnChance) {
          this.transitionTo(now, "FAKE_TURN", fakeTurnDurationMs(this.profile));
        } else {
          this.transitionTo(now, "TURNING_TO_LOOK", this.profile.ghostTurnDurationMs);
        }
        break;
      case "TURNING_TO_LOOK":
        this.transitionTo(now, "LOOKING", this.profile.ghostLookingDurationMs);
        break;
      case "LOOKING":
        this.transitionTo(now, "TURNING_AWAY", this.profile.ghostTurnDurationMs);
        break;
      case "TURNING_AWAY":
      case "FAKE_TURN":
        this.transitionTo(now, "LOOK_AWAY", randomLookAwayDuration(this.rng, this.profile));
        break;
    }
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

  /** 暫停/恢復時校正計時基準點，讓恢復後的剩餘時間跟暫停前一致（見 GameRoom 的 pause/resume）。 */
  shiftClock(deltaMs: number): void {
    this.stateStartedAt += deltaMs;
  }

  getFacingPlayerAmount(now: number): number {
    return computeFacingAmount(this.state, now - this.stateStartedAt, this.stateDuration);
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

  constructor(now: number) {
    this.stateStartedAt = now;
  }

  applyServerState(state: GhostState, stateStartedAtMs: number, stateDurationMs: number): void {
    this.state = state;
    this.stateStartedAt = stateStartedAtMs;
    this.stateDuration = stateDurationMs;
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
    return computeFacingAmount(this.state, now - this.stateStartedAt, this.stateDuration);
  }
}
