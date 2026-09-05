import type { GhostState, RoomPhase } from "shared";

/** 兩端共用燈號與時間格式，轉頭期間顯示警示。 */
export class SignalStatus {
  readonly root = document.createElement("div");
  private readonly label = document.createElement("strong");
  private readonly timer = document.createElement("span");

  constructor() {
    this.root.className = "signal-status";
    const lamp = document.createElement("span");
    lamp.className = "signal-lamp";
    lamp.setAttribute("aria-hidden", "true");
    const text = document.createElement("div");
    this.label.className = "signal-label";
    this.timer.className = "signal-timer";
    text.append(this.label, this.timer);
    this.root.append(lamp, text);
  }

  update(state: GhostState, remainingMs: number, phase: RoomPhase): void {
    const mode = phase !== "PLAYING" ? "idle" : state === "LOOKING" ? "red" : state === "LOOK_AWAY" ? "green" : "amber";
    this.root.dataset.signal = mode;
    this.label.textContent = phase === "PAUSED" ? "已暫停" : phase === "WAITING" ? "等待開始" : phase === "COUNTDOWN" ? "準備出發" : phase === "GAME_OVER" ? "本局結束" : mode === "red" ? "紅燈・停下" : mode === "green" ? "綠燈" : "注意轉頭";
    const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
    this.timer.textContent = phase === "PLAYING" ? `00:${String(seconds).padStart(2, "0")}` : "— —";
  }
}
