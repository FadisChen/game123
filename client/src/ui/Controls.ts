import { FOOT_BUTTON_LOCKOUT_MS, type Foot, type PlayerMode } from "shared";
import { isLandscape } from "./LandscapeGuard";

function buildFootButton(side: Foot): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = `foot-button foot-button--${side}`;
  button.type = "button";
  button.innerHTML = `<span class="foot-arrow" aria-hidden="true">${side === "left" ? "←" : "→"}</span>
    <span>${side === "left" ? "左腳" : "右腳"}</span>`;
  return button;
}

/** 觸控、滑鼠與方向鍵共用輸入節流；長按鍵盤不會自動連踩。 */
export class Controls {
  private readonly root: HTMLDivElement;
  private readonly leftButton: HTMLButtonElement;
  private readonly rightButton: HTMLButtonElement;
  private lockedUntil = 0;
  private visible = true;
  private mode: PlayerMode = "main";
  private motionAvailable = false;
  private readonly hint: HTMLDivElement;

  constructor(container: HTMLElement, onStep: (foot: Foot) => void) {
    this.root = document.createElement("div");
    this.root.className = "player-controls";
    this.leftButton = buildFootButton("left");
    this.rightButton = buildFootButton("right");
    this.hint = document.createElement("div");
    this.hint.className = "step-hint";
    this.root.append(this.leftButton, this.hint, this.rightButton);
    container.appendChild(this.root);

    const press = (foot: Foot) => {
      if (this.mode === "motion" || !this.visible || !isLandscape() || performance.now() < this.lockedUntil) return;
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
    this.updateModeUi();
    window.addEventListener("keydown", (event) => {
      if (this.mode === "motion" || !this.visible || !isLandscape() || event.altKey || event.ctrlKey || event.metaKey) return;
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

  setMode(mode: PlayerMode): void {
    this.mode = mode;
    this.updateModeUi();
  }

  setMotionAvailable(available: boolean): void {
    this.motionAvailable = available;
    this.updateModeUi();
  }

  private updateModeUi(): void {
    const motionActive = this.mode === "motion" && this.motionAvailable;
    this.root.dataset.inputMode = this.mode;
    this.root.dataset.motionAvailable = String(this.motionAvailable);
    this.leftButton.hidden = this.mode === "motion";
    this.rightButton.hidden = this.mode === "motion";
    this.hint.textContent = this.mode === "motion"
      ? motionActive ? "上下晃動，一次前進一步" : "感應器無法使用，請檢查動作感應權限或洽主辦方"
      : "左右交替前進 · 音樂播放時移動";
  }
}
