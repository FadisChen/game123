import {
  GHOST_LOOK_AWAY_MAX_MS,
  GHOST_LOOK_AWAY_MIN_MS,
  GHOST_LOOKING_DURATION_MS,
  GHOST_TURN_DURATION_MS,
} from "../config";

export type GhostState = "LOOK_AWAY" | "TURNING_TO_LOOK" | "LOOKING" | "TURNING_AWAY";

function randomLookAwayDuration(): number {
  return GHOST_LOOK_AWAY_MIN_MS + Math.random() * (GHOST_LOOK_AWAY_MAX_MS - GHOST_LOOK_AWAY_MIN_MS);
}

/**
 * 鬼（娃）的狀態機：LOOK_AWAY -> TURNING_TO_LOOK -> LOOKING -> TURNING_AWAY -> LOOK_AWAY ...
 * 只有 LOOKING 狀態會判定玩家移動違規（對應 PRD 8.1-8.3）。
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
        this.transitionTo(now, "TURNING_TO_LOOK", GHOST_TURN_DURATION_MS);
        break;
      case "TURNING_TO_LOOK":
        this.transitionTo(now, "LOOKING", GHOST_LOOKING_DURATION_MS);
        break;
      case "LOOKING":
        this.transitionTo(now, "TURNING_AWAY", GHOST_TURN_DURATION_MS);
        break;
      case "TURNING_AWAY":
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
   * TURNING_* 期間依經過時間線性內插，供 Scene 做轉身動畫。
   */
  getFacingPlayerAmount(now: number): number {
    const elapsed = Math.min(now - this.stateStartedAt, this.stateDuration);
    const turnProgress = this.stateDuration > 0 ? elapsed / this.stateDuration : 1;
    switch (this.state) {
      case "LOOK_AWAY":
        return 0;
      case "TURNING_TO_LOOK":
        return turnProgress;
      case "LOOKING":
        return 1;
      case "TURNING_AWAY":
        return 1 - turnProgress;
    }
  }
}
