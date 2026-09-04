import {
  FAKE_TURN_CHANCE,
  FAKE_TURN_DURATION_MS,
  FAKE_TURN_PEAK,
  GHOST_LOOK_AWAY_MAX_MS,
  GHOST_LOOK_AWAY_MIN_MS,
  GHOST_LOOKING_DURATION_MS,
  GHOST_TURN_DURATION_MS,
} from "../config";

export type GhostState = "LOOK_AWAY" | "TURNING_TO_LOOK" | "LOOKING" | "TURNING_AWAY" | "FAKE_TURN";

function randomLookAwayDuration(): number {
  return GHOST_LOOK_AWAY_MIN_MS + Math.random() * (GHOST_LOOK_AWAY_MAX_MS - GHOST_LOOK_AWAY_MIN_MS);
}

/**
 * 鬼（娃）的狀態機：LOOK_AWAY -> TURNING_TO_LOOK -> LOOKING -> TURNING_AWAY -> LOOK_AWAY ...
 * 只有 LOOKING 狀態會判定玩家移動違規（對應 PRD 8.1-8.3）。
 *
 * FAKE_TURN（對應 PRD 22.1 鬼的假動作）：LOOK_AWAY 結束時有機率轉入只轉一半就轉回去的假動作，
 * facingAmount 最高只到 FAKE_TURN_PEAK（低於 Scene 判斷「正面/背面」貼圖切換的 0.5 門檻），
 * 且全程不會進入 LOOKING，純粹製造心理壓力，不會真的判定違規。
 */
export class GhostAI {
  private state: GhostState = "LOOK_AWAY";
  private stateStartedAt: number;
  private stateDuration: number;

  constructor(now: number) {
    this.stateStartedAt = now;
    this.stateDuration = randomLookAwayDuration();
  }

  update(now: number): void {
    const elapsed = now - this.stateStartedAt;
    if (elapsed < this.stateDuration) return;

    switch (this.state) {
      case "LOOK_AWAY":
        if (Math.random() < FAKE_TURN_CHANCE) {
          this.transitionTo(now, "FAKE_TURN", FAKE_TURN_DURATION_MS);
        } else {
          this.transitionTo(now, "TURNING_TO_LOOK", GHOST_TURN_DURATION_MS);
        }
        break;
      case "TURNING_TO_LOOK":
        this.transitionTo(now, "LOOKING", GHOST_LOOKING_DURATION_MS);
        break;
      case "LOOKING":
        this.transitionTo(now, "TURNING_AWAY", GHOST_TURN_DURATION_MS);
        break;
      case "TURNING_AWAY":
      case "FAKE_TURN":
        this.transitionTo(now, "LOOK_AWAY", randomLookAwayDuration());
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

  /**
   * 0 = 完全背對玩家（LOOK_AWAY），1 = 完全正面朝向玩家（LOOKING）。
   * TURNING_* 期間依經過時間線性內插；FAKE_TURN 為先升後降的三角波，且不會超過 FAKE_TURN_PEAK。
   */
  getFacingPlayerAmount(now: number): number {
    const elapsed = Math.min(now - this.stateStartedAt, this.stateDuration);
    const progress = this.stateDuration > 0 ? elapsed / this.stateDuration : 1;
    switch (this.state) {
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
}
