export type GameOutcome = "finished" | "eliminated" | "surviving";

/** 伺服器結算排名裡自己的那一列，用來在結算卡上顯示名次。 */
export interface GameResultDetail {
  rank: number;
  total: number;
  distance: number;
}

const OUTCOME_COPY: Record<
  GameOutcome,
  { title: string; subtitle: string; accent: string }
> = {
  finished: {
    title: "🏆 勝利!",
    subtitle: "成功抵達終點線",
    accent: "#118a65",
  },
  eliminated: {
    title: "💀 你被淘汰了!",
    subtitle: "下一場再來報仇",
    accent: "#f94144",
  },
  surviving: {
    title: "⏱ 遊戲結束!",
    subtitle: "尚未抵達終點，但撐到了最後",
    accent: "#f4a261",
  },
};

/** 結算畫面（對應 PRD 10 章 GAME_OVER 狀態）；重玩入口只由離線模式提供。 */
export class GameOverScreen {
  private readonly root: HTMLDivElement;
  private readonly titleEl: HTMLHeadingElement;
  private readonly subtitleEl: HTMLParagraphElement;
  private readonly card: HTMLDivElement;
  private readonly rankEl: HTMLDivElement;

  constructor(
    container: HTMLElement,
    onRestart?: () => void,
    buttonLabel = "再玩一次",
  ) {
    this.root = document.createElement("div");
    this.root.className = "screen-overlay";

    const card = document.createElement("div");
    card.className = "screen-card result-card";
    this.card = card;

    this.rankEl = document.createElement("div");
    this.rankEl.className = "result-rank";
    this.rankEl.hidden = true;
    card.appendChild(this.rankEl);

    this.titleEl = document.createElement("h1");
    this.titleEl.style.cssText = "margin:0 0 8px; font-size:30px;";
    card.appendChild(this.titleEl);

    this.subtitleEl = document.createElement("p");
    this.subtitleEl.style.cssText =
      "margin:0 0 24px; font-size:18px; opacity:0.85;";
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

  showResult(outcome: GameOutcome, detail?: GameResultDetail): void {
    const copy = OUTCOME_COPY[outcome];
    this.card.dataset.outcome = outcome;
    this.rankEl.hidden = !detail;
    if (detail) {
      this.rankEl.innerHTML =
        "<span>第</span><strong></strong><span>名</span><small></small>";
      this.rankEl.querySelector("strong")!.textContent = String(detail.rank);
      this.rankEl.querySelector("small")!.textContent =
        `共 ${detail.total} 人 · 前進 ${detail.distance.toFixed(1)} m`;
    }
    this.titleEl.textContent = copy.title;
    this.titleEl.style.color = copy.accent;
    this.subtitleEl.textContent = copy.subtitle;
    this.root.style.display = "flex";
  }

  hide(): void {
    this.root.style.display = "none";
  }
}
