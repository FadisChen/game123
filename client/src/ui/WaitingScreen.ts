/** 等待畫面（對應 PRD 13 章「已加入遊戲，請等待主持人開始」），教學畫面關閉後、PLAYING 開始前顯示。 */
const DEFAULT_MESSAGE = "已加入遊戲，請等待主持人開始";

export class WaitingScreen {
  private readonly root: HTMLDivElement;
  private readonly messageEl: HTMLParagraphElement;
  private readonly errorEl: HTMLParagraphElement;
  private readonly lobbyEl: HTMLParagraphElement;

  constructor(container: HTMLElement, playerName: string) {
    this.root = document.createElement("div");
    this.root.className = "screen-overlay";

    const card = document.createElement("div");
    card.className = "screen-card";

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

    this.lobbyEl = document.createElement("p");
    this.lobbyEl.className = "waiting-lobby";
    this.lobbyEl.hidden = true;
    card.appendChild(this.lobbyEl);

    this.errorEl = document.createElement("p");
    this.errorEl.style.cssText =
      "margin:16px 0 0; font-size:15px; color:#f94144; display:none;";
    card.appendChild(this.errorEl);

    this.root.appendChild(card);
    container.appendChild(this.root);
  }

  setMessage(message: string = DEFAULT_MESSAGE): void {
    this.messageEl.textContent = message;
  }

  /** 等待開局時顯示目前人數；null 則隱藏（例如個人已出局、正在重新連線）。 */
  setLobbyInfo(text: string | null): void {
    this.lobbyEl.hidden = text === null;
    if (text !== null) this.lobbyEl.textContent = text;
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
