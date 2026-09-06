export type GameOutcome = "finished" | "eliminated" | "surviving";

const OUTCOME_COPY: Record<GameOutcome, { title: string; subtitle: string; accent: string }> = {
  finished: { title: "🏆 勝利!", subtitle: "成功抵達終點線", accent: "#118a65" },
  eliminated: { title: "❌ 你被淘汰了!", subtitle: "我們懷念你", accent: "#f94144" },
  surviving: { title: "⏱ 遊戲結束!", subtitle: "尚未抵達終點，但撐到了最後", accent: "#f4a261" },
};

/** 結算畫面（對應 PRD 10 章 GAME_OVER 狀態）；重玩入口只由離線模式提供。 */
export class GameOverScreen {
  private readonly root: HTMLDivElement;
  private readonly titleEl: HTMLHeadingElement;
  private readonly subtitleEl: HTMLParagraphElement;

  constructor(container: HTMLElement, onRestart?: () => void, buttonLabel = "再玩一次") {
    this.root = document.createElement("div");
    this.root.className = "screen-overlay";

    const card = document.createElement("div");
    card.className = "screen-card";

    this.titleEl = document.createElement("h1");
    this.titleEl.style.cssText = "margin:0 0 8px; font-size:30px;";
    card.appendChild(this.titleEl);

    this.subtitleEl = document.createElement("p");
    this.subtitleEl.style.cssText = "margin:0 0 24px; font-size:18px; opacity:0.85;";
    card.appendChild(this.subtitleEl);

    if (onRestart) {
      const button = document.createElement("button");
      button.textContent = buttonLabel;
      button.className = "primary-button";
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        onRestart();
      });
      card.appendChild(button);
    } else {
      const waitingMessage = document.createElement("p");
      waitingMessage.textContent = buttonLabel;
      waitingMessage.style.cssText = "margin:0; font-size:16px; opacity:0.8;";
      card.appendChild(waitingMessage);
    }

    this.root.appendChild(card);
    container.appendChild(this.root);
  }

  showResult(outcome: GameOutcome): void {
    const copy = OUTCOME_COPY[outcome];
    this.titleEl.textContent = copy.title;
    this.titleEl.style.color = copy.accent;
    this.subtitleEl.textContent = copy.subtitle;
    this.root.style.display = "flex";
  }

  hide(): void {
    this.root.style.display = "none";
  }
}
