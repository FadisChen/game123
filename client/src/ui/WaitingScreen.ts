/** 等待畫面（對應 PRD 13 章「已加入遊戲，請等待主持人開始」），教學畫面關閉後、COUNTDOWN 開始前顯示。 */
const DEFAULT_MESSAGE = "已加入遊戲，請等待主持人開始";

export class WaitingScreen {
  private readonly root: HTMLDivElement;
  private readonly messageEl: HTMLParagraphElement;
  private readonly errorEl: HTMLParagraphElement;

  constructor(container: HTMLElement, playerName: string) {
    this.root = document.createElement("div");
    this.root.style.cssText = `
      position:absolute; inset:0; background:#000000cc;
      display:none; align-items:center; justify-content:center; z-index:10;
    `;

    const card = document.createElement("div");
    card.style.cssText = `
      background:#333333; color:#f2f2f2; border-radius:20px;
      padding:32px 40px; text-align:center; max-width:min(360px, 86vw);
    `;

    const title = document.createElement("h1");
    title.textContent = "123 木頭人";
    title.style.cssText = "margin:0 0 12px; font-size:24px;";
    card.appendChild(title);

    const name = document.createElement("p");
    name.textContent = `玩家：${playerName}`;
    name.style.cssText = "margin:0 0 16px; font-size:16px; opacity:0.8;";
    card.appendChild(name);

    this.messageEl = document.createElement("p");
    this.messageEl.textContent = DEFAULT_MESSAGE;
    this.messageEl.style.cssText = "margin:0; font-size:18px;";
    card.appendChild(this.messageEl);

    this.errorEl = document.createElement("p");
    this.errorEl.style.cssText = "margin:16px 0 0; font-size:15px; color:#f94144; display:none;";
    card.appendChild(this.errorEl);

    this.root.appendChild(card);
    container.appendChild(this.root);
  }

  setMessage(message: string = DEFAULT_MESSAGE): void {
    this.messageEl.textContent = message;
  }

  showError(message: string): void {
    this.errorEl.textContent = message;
    this.errorEl.style.display = "block";
  }

  clearError(): void {
    this.errorEl.style.display = "none";
  }

  setVisible(visible: boolean): void {
    this.root.style.display = visible ? "flex" : "none";
  }
}
