import { FOOT_BUTTON_LOCKOUT_MS, type Foot } from "shared";
import { isLandscape } from "./LandscapeGuard";

function buildFootButton(side: Foot): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = `foot-button foot-button--${side}`;
  button.type = "button";
  button.innerHTML = `<span class="foot-arrow" aria-hidden="true">${side === "left" ? "←" : "→"}</span>
    <span>${side === "left" ? "左腳" : "右腳"}</span><kbd>${side === "left" ? "←" : "→"}</kbd>`;
  return button;
}

/** 觸控、滑鼠與方向鍵共用輸入節流；長按鍵盤不會自動連踩。 */
export class Controls {
  private readonly root: HTMLDivElement;
  private readonly leftButton: HTMLButtonElement;
  private readonly rightButton: HTMLButtonElement;
  private lockedUntil = 0;
  private visible = true;

  constructor(container: HTMLElement, onStep: (foot: Foot) => void) {
    this.root = document.createElement("div");
    this.root.className = "player-controls";
    this.leftButton = buildFootButton("left");
    this.rightButton = buildFootButton("right");
    const hint = document.createElement("div");
    hint.className = "step-hint";
    hint.textContent = "左右交替前進 · 紅燈停下";
    this.root.append(this.leftButton, hint, this.rightButton);
    container.appendChild(this.root);

    const press = (foot: Foot) => {
      if (!this.visible || !isLandscape() || performance.now() < this.lockedUntil) return;
      this.lockedUntil = performance.now() + FOOT_BUTTON_LOCKOUT_MS;
      const button = foot === "left" ? this.leftButton : this.rightButton;
      button.classList.add("is-pressed");
      window.setTimeout(() => button.classList.remove("is-pressed"), FOOT_BUTTON_LOCKOUT_MS);
      onStep(foot);
    };
    for (const [foot, button] of [["left", this.leftButton], ["right", this.rightButton]] as const) {
      button.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        press(foot);
      });
      button.addEventListener("click", (event) => {
        if (event.detail === 0) press(foot);
      });
    }
    window.addEventListener("keydown", (event) => {
      if (!this.visible || !isLandscape() || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable]")) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      if (!event.repeat) press(event.key === "ArrowLeft" ? "left" : "right");
    });
  }

  flashRejected(foot: Foot): void {
    const button = foot === "left" ? this.leftButton : this.rightButton;
    button.classList.add("is-rejected");
    window.setTimeout(() => button.classList.remove("is-rejected"), 150);
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.root.hidden = !visible;
  }
}
