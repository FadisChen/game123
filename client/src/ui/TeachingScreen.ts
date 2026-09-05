import { requestLandscape } from "./LandscapeGuard";

const RULES = ["交替點擊左、右腳，或按鍵盤 ← → 前進", "綠燈前進，鬼回頭時立刻停下", "被發現扣 1 分，扣到 0 分即淘汰", "抵達粉紅色終點線即獲勝"];

/** 教學畫面（對應 PRD 10 章 TEACHING 狀態與美術參考圖的四格教學卡）。 */
export class TeachingScreen {
  private readonly root: HTMLDivElement;

  constructor(container: HTMLElement, onConfirm: () => void) {
    this.root = document.createElement("div");
    this.root.className = "screen-overlay";

    const card = document.createElement("div");
    card.className = "screen-card";

    const title = document.createElement("h1");
    title.textContent = "遊戲教學";
    title.style.cssText = "margin:0 0 16px; font-size:24px;";
    card.appendChild(title);

    const list = document.createElement("ol");
    list.style.cssText = "text-align:left; margin:0 0 24px; padding-left:1.4em; font-size:18px; line-height:1.8;";
    for (const rule of RULES) {
      const li = document.createElement("li");
      li.textContent = rule;
      list.appendChild(li);
    }
    card.appendChild(list);

    const button = document.createElement("button");
    button.textContent = "我知道了";
    button.className = "primary-button";
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      void requestLandscape();
      onConfirm();
    });
    card.appendChild(button);

    this.root.appendChild(card);
    container.appendChild(this.root);
  }

  setVisible(visible: boolean): void {
    this.root.style.display = visible ? "flex" : "none";
  }
}
