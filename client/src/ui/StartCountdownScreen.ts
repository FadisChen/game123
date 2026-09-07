/** 主辦方開始倒數時，玩家端同步顯示的全螢幕倒數。 */
export class StartCountdownScreen {
  private readonly root: HTMLDivElement;
  private readonly digit: HTMLDivElement;
  private timer: number | null = null;

  constructor(container: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "countdown-overlay start-countdown";
    this.root.setAttribute("role", "status");
    this.root.setAttribute("aria-live", "assertive");
    this.root.hidden = true;
    this.digit = document.createElement("div");
    this.digit.className = "countdown-digit";
    this.root.appendChild(this.digit);
    container.appendChild(this.root);
  }

  play(
    startedAtServerMs: number,
    durationMs: number,
    nowServerMs: () => number,
  ): void {
    this.hide();
    this.root.hidden = false;
    let previousDigit = 0;
    const maxDigit = Math.ceil(durationMs / 1000);
    const tick = () => {
      const remainingMs = startedAtServerMs + durationMs - nowServerMs();
      const remaining = Math.ceil(Math.max(remainingMs, 0) / 1000);
      if (remaining <= 0) {
        this.hide();
        return;
      }
      const digit = Math.min(maxDigit, remaining);
      if (digit !== previousDigit) {
        previousDigit = digit;
        this.digit.textContent = String(digit);
        this.digit.classList.remove("countdown-digit-pulse");
        void this.digit.offsetWidth;
        this.digit.classList.add("countdown-digit-pulse");
      }
      this.timer = window.setTimeout(tick, 50);
    };
    tick();
  }

  hide(): void {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    this.root.hidden = true;
  }
}
