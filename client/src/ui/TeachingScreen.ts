import { requestLandscape } from "./LandscapeGuard";
import type { PlayerMode } from "shared";

const MAIN_RULES = ["交替點擊左、右腳，或按鍵盤 ← → 前進", "音樂播放時前進，鬼正面審視時停下", "被發現扣 1 分，扣到 0 分即淘汰", "抵達粉紅色終點線即獲勝"];
const MOTION_RULES = ["上下晃動手機，一次晃動前進一步", "請看主辦方畫面，音樂播放時移動、停止時保持靜止", "請允許動作感應權限；若裝置不支援感應，將自動改用左右腳按鈕", "被發現扣 1 分，抵達終點即獲勝"];

/** 教學畫面（對應 PRD 10 章 TEACHING 狀態與美術參考圖的四格教學卡）。 */
export class TeachingScreen {
  private readonly root: HTMLDivElement;
  private readonly list: HTMLOListElement;
  private mode: PlayerMode = "main";

  constructor(container: HTMLElement, onConfirm: () => void) {
    this.root = document.createElement("div");
    this.root.className = "screen-overlay";

    const card = document.createElement("div");
    card.className = "screen-card";

    const title = document.createElement("h1");
    title.textContent = "遊戲教學";
    title.style.cssText = "margin:0 0 16px; font-size:24px;";
    card.appendChild(title);

    this.list = document.createElement("ol");
    this.list.style.cssText = "text-align:left; margin:0 0 24px; padding-left:1.4em; font-size:18px; line-height:1.8;";
    for (const rule of MAIN_RULES) {
      const li = document.createElement("li");
      li.textContent = rule;
      this.list.appendChild(li);
    }
    card.appendChild(this.list);

    const button = document.createElement("button");
    button.textContent = "我知道了";
    button.className = "primary-button";
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      if (this.mode === "main") void requestLandscape();
      onConfirm();
    });
    card.appendChild(button);

    this.root.appendChild(card);
    container.appendChild(this.root);
  }

  setVisible(visible: boolean): void {
    this.root.style.display = visible ? "flex" : "none";
  }

  setPlayerMode(mode: PlayerMode): void {
    this.mode = mode;
    const rules = mode === "motion" ? MOTION_RULES : MAIN_RULES;
    this.list.replaceChildren(...rules.map((rule) => {
      const li = document.createElement("li");
      li.textContent = rule;
      return li;
    }));
  }
}
