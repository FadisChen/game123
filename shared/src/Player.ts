import { FINISH_DISTANCE_M, INITIAL_SCORE, STEP_DISTANCE_M } from "./config";

export type Foot = "left" | "right";

export type StepResult =
  | { kind: "rejected-no-alternate" }
  | { kind: "caught"; scoreAfter: number; eliminated: boolean }
  | { kind: "advanced"; distanceAfter: number; finished: boolean };

export interface LookingCheck {
  isLooking(): boolean;
}

/**
 * 玩家狀態與左右腳交替規則（對應 PRD 7.3、23.1）。
 * 違規時原地不動只扣分，不給予距離（見規劃文件的設計決策）。
 *
 * Phase 2：這個類別搬到 shared，實際上只由伺服器端 instantiate 並呼叫 step()
 * （每個房間、每位玩家各一個實例），是真正的權威判定。玩家端只做型別匯入。
 *
 * maxScore／stepDistanceM 由呼叫端（GameRoom）依該房間的設定注入；兩個參數都選填，
 * 省略時就是共用預設值，讓單機離線版與單元測試不必知道房間設定的存在。
 */
export class Player {
  distance = 0;
  score: number;
  lastFoot: Foot | null = null;
  eliminated = false;
  finished = false;

  private readonly ghost: LookingCheck;
  private maxScore: number;
  private stepDistanceM: number;

  constructor(ghost: LookingCheck, maxScore = INITIAL_SCORE, stepDistanceM = STEP_DISTANCE_M) {
    this.ghost = ghost;
    this.maxScore = maxScore;
    this.stepDistanceM = stepDistanceM;
    this.score = maxScore;
  }

  /**
   * distanceMultiplier：PRD 22.2 隨機加速用，伺服器依當下該玩家是否處於加速窗口決定要傳多少
   * （預設 1＝不加速）。乘數本身完全由呼叫端（GameRoom）決定，Player 只負責套用，不知道加速規則。
   */
  step(foot: Foot, distanceMultiplier = 1): StepResult {
    if (this.eliminated || this.finished) {
      return { kind: "rejected-no-alternate" };
    }
    if (foot === this.lastFoot) {
      return { kind: "rejected-no-alternate" };
    }
    this.lastFoot = foot;

    if (this.ghost.isLooking()) {
      this.score -= 1;
      if (this.score <= 0) {
        this.score = 0;
        this.eliminated = true;
      }
      return { kind: "caught", scoreAfter: this.score, eliminated: this.eliminated };
    }

    this.distance = Math.min(this.distance + this.stepDistanceM * distanceMultiplier, FINISH_DISTANCE_M);
    if (this.distance >= FINISH_DISTANCE_M) {
      this.finished = true;
    }
    return { kind: "advanced", distanceAfter: this.distance, finished: this.finished };
  }

  /**
   * 主辦方在 WAITING 階段改了房間設定：套用新數值並把整個人重置，
   * 讓已經在房裡等待的玩家跟之後才加入的玩家拿到一樣的起始血量。
   */
  configure(maxScore: number, stepDistanceM: number): void {
    this.maxScore = maxScore;
    this.stepDistanceM = stepDistanceM;
    this.reset();
  }

  reset(): void {
    this.distance = 0;
    this.score = this.maxScore;
    this.lastFoot = null;
    this.eliminated = false;
    this.finished = false;
  }
}
