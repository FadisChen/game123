import { FOOT_BUTTON_LOCKOUT_MS } from "../config";
import type { Foot } from "../game/Player";

const BUTTON_BASE_STYLE = `
  pointer-events:auto; position:absolute; bottom:24px;
  width:96px; height:96px; border-radius:50%; border:none;
  background:#118a65cc; color:#fff; font-size:14px; font-weight:700;
  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px;
  touch-action:none; -webkit-user-select:none; user-select:none;
`;

function buildFootButton(side: "left" | "right"): HTMLButtonElement {
  const button = document.createElement("button");
  button.style.cssText = `${BUTTON_BASE_STYLE} ${side}:24px;`;
  button.innerHTML = `<span style="font-size:28px;">🦶</span><span>${side === "left" ? "左腳" : "右腳"}</span>`;
  return button;
}

/** 左右腳按鈕：Pointer Events 統一處理滑鼠/觸控，並鎖定短暫時間避免單次點擊被誤判成連點。 */
export class Controls {
  private readonly root: HTMLDivElement;
  private readonly leftButton: HTMLButtonElement;
  private readonly rightButton: HTMLButtonElement;
  private locked = false;

  constructor(container: HTMLElement, onStep: (foot: Foot) => void) {
    this.root = document.createElement("div");
    this.root.style.cssText = "position:absolute; inset:0; pointer-events:none;";

    this.leftButton = buildFootButton("left");
    this.rightButton = buildFootButton("right");
    this.root.appendChild(this.leftButton);
    this.root.appendChild(this.rightButton);
    container.appendChild(this.root);

    const handlePress = (foot: Foot) => (event: PointerEvent) => {
      event.preventDefault();
      if (this.locked) return;
      this.locked = true;
      window.setTimeout(() => {
        this.locked = false;
      }, FOOT_BUTTON_LOCKOUT_MS);
      onStep(foot);
    };

    this.leftButton.addEventListener("pointerdown", handlePress("left"));
    this.rightButton.addEventListener("pointerdown", handlePress("right"));
  }

  /** 拒絕輸入（未交替）時的輕微視覺回饋。 */
  flashRejected(foot: Foot): void {
    const button = foot === "left" ? this.leftButton : this.rightButton;
    button.style.background = "#666666cc";
    window.setTimeout(() => {
      button.style.background = "#118a65cc";
    }, 150);
  }

  setVisible(visible: boolean): void {
    this.root.style.display = visible ? "block" : "none";
  }
}
