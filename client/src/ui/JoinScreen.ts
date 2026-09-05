/** 加入畫面（對應 PRD 5.2）：房號＋玩家名字輸入。若網址已帶房號則預先帶入。 */
export class JoinScreen {
  private readonly root: HTMLDivElement;
  private readonly roomInput: HTMLInputElement;
  private readonly nameInput: HTMLInputElement;
  private readonly errorEl: HTMLParagraphElement;
  private readonly button: HTMLButtonElement;

  constructor(container: HTMLElement, initialRoomCode: string, onSubmit: (roomCode: string, name: string) => void) {
    this.root = document.createElement("div");
    this.root.style.cssText = `
      position:absolute; inset:0; background:#000000cc;
      display:flex; align-items:center; justify-content:center; z-index:20;
      font-family:inherit;
    `;

    const card = document.createElement("div");
    card.style.cssText = `
      background:#333333; color:#f2f2f2; border-radius:20px;
      padding:28px 32px; width:min(320px, 86vw); text-align:center;
    `;

    const title = document.createElement("h1");
    title.textContent = "123 木頭人";
    title.style.cssText = "margin:0 0 20px; font-size:26px;";
    card.appendChild(title);

    this.roomInput = this.buildInput(card, "房間代碼", initialRoomCode.toUpperCase());
    this.roomInput.style.textTransform = "uppercase";
    this.nameInput = this.buildInput(card, "你的名字", "");
    this.nameInput.maxLength = 10;

    this.errorEl = document.createElement("p");
    this.errorEl.style.cssText = "margin:4px 0 12px; font-size:14px; color:#f94144; min-height:1.2em;";
    card.appendChild(this.errorEl);

    this.button = document.createElement("button");
    this.button.textContent = "加入遊戲";
    this.button.style.cssText = `
      pointer-events:auto; border:none; border-radius:14px; background:#e8447a; color:#fff;
      font-size:20px; font-weight:700; padding:12px 32px; cursor:pointer; width:100%;
    `;
    this.button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      const roomCode = this.roomInput.value.trim().toUpperCase();
      const name = this.nameInput.value.trim();
      if (!roomCode) {
        this.showError("請輸入房間代碼");
        return;
      }
      if (!name) {
        this.showError("請輸入你的名字");
        return;
      }
      this.clearError();
      onSubmit(roomCode, name);
    });
    card.appendChild(this.button);

    this.root.appendChild(card);
    container.appendChild(this.root);
  }

  private buildInput(card: HTMLElement, placeholder: string, initialValue: string): HTMLInputElement {
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = placeholder;
    input.value = initialValue;
    input.style.cssText = `
      pointer-events:auto; width:100%; box-sizing:border-box; margin-bottom:12px;
      padding:12px 14px; border-radius:12px; border:none; font-size:18px;
      background:#f2f2f2; color:#333333; text-align:center;
    `;
    card.appendChild(input);
    return input;
  }

  showError(message: string): void {
    this.errorEl.textContent = message;
  }

  clearError(): void {
    this.errorEl.textContent = "";
  }

  setBusy(busy: boolean): void {
    this.button.disabled = busy;
    this.button.textContent = busy ? "加入中…" : "加入遊戲";
  }

  remove(): void {
    this.root.remove();
  }
}
