export type GameOutcome = "finished" | "eliminated";

const OUTCOME_COPY: Record<GameOutcome, { title: string; subtitle: string; accent: string }> = {
  finished: { title: "🏆 勝利!", subtitle: "你成功抵達終點線", accent: "#118a65" },
  eliminated: { title: "❌ 你被淘汰了!", subtitle: "分數已歸零", accent: "#f94144" },
};

/** 結算畫面（對應 PRD 10 章 GAME_OVER 狀態），提供再玩一次入口。 */
export class GameOverScreen {
  private readonly root: HTMLDivElement;
  private readonly titleEl: HTMLHeadingElement;
  private readonly subtitleEl: HTMLParagraphElement;

  constructor(container: HTMLElement, onRestart: () => void) {
    this.root = document.createElement("div");
    this.root.style.cssText = `
      position:absolute; inset:0; background:#000000cc;
      display:none; align-items:center; justify-content:center; z-index:10;
    `;

    const card = document.createElement("div");
    card.style.cssText = `
      background:#333333; color:#f2f2f2; border-radius:20px;
      padding:32px 40px; text-align:center; max-width:min(420px, 86vw);
    `;

    this.titleEl = document.createElement("h1");
    this.titleEl.style.cssText = "margin:0 0 8px; font-size:30px;";
    card.appendChild(this.titleEl);

    this.subtitleEl = document.createElement("p");
    this.subtitleEl.style.cssText = "margin:0 0 24px; font-size:18px; opacity:0.85;";
    card.appendChild(this.subtitleEl);

    const button = document.createElement("button");
    button.textContent = "再玩一次";
    button.style.cssText = `
      pointer-events:auto; border:none; border-radius:14px; background:#118a65; color:#fff;
      font-size:20px; font-weight:700; padding:12px 32px; cursor:pointer;
    `;
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      onRestart();
    });
    card.appendChild(button);

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
