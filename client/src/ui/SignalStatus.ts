import type { GhostState, RoomPhase } from "shared";

/** 兩端共用的文字狀態；音樂節奏取代紅綠燈與數字倒數成為玩家提示。 */
export class GameStatus {
  readonly root = document.createElement("div");
  private readonly label = document.createElement("strong");

  constructor() {
    this.root.className = "game-status";
    const mark = document.createElement("span");
    mark.className = "status-wave";
    mark.setAttribute("aria-hidden", "true");
    mark.innerHTML = "<i></i><i></i><i></i>";
    const text = document.createElement("div");
    this.label.className = "signal-label";
    text.append(this.label);
    this.root.append(mark, text);
  }

  update(state: GhostState, phase: RoomPhase): void {
    const status = phase === "PAUSED" ? "paused" : phase === "WAITING" ? "waiting" : phase === "GAME_OVER" ? "over" : state === "LOOK_AWAY" ? "moving" : state === "LOOKING" ? "looking" : "turning";
    this.root.dataset.status = status;
    this.label.textContent = phase === "PAUSED" ? "已暫停" : phase === "WAITING" ? "等待開始" : phase === "GAME_OVER" ? "本局結束" : state === "LOOK_AWAY" ? "音樂播放中・可以前進" : state === "LOOKING" ? "鬼正在審視・停止移動" : "鬼轉身中";
  }
}
