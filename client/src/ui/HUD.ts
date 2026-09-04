import { CAUGHT_TOAST_MS, INITIAL_SCORE } from "../config";

export type ToastVariant = "warn" | "danger" | "success" | "info";

const TOAST_STYLES: Record<ToastVariant, { bg: string; icon: string }> = {
  warn: { bg: "#f4a261", icon: "⚠️" },
  danger: { bg: "#f94144", icon: "❌" },
  success: { bg: "#118a65", icon: "✅" },
  info: { bg: "#2f80ed", icon: "ℹ️" },
};

/** 左上角分數卡片、置頂倒數計時卡片、違規/淘汰/完成的短暫提示框（對齊 PRD 12/13 與美術參考圖）。 */
export class HUD {
  private readonly root: HTMLDivElement;
  private readonly scoreEl: HTMLDivElement;
  private readonly countdownEl: HTMLDivElement;
  private readonly toastEl: HTMLDivElement;
  private toastTimer: number | undefined;

  constructor(container: HTMLElement) {
    this.root = document.createElement("div");
    this.root.style.cssText = "position:absolute;inset:0;pointer-events:none;font-family:inherit;";

    this.scoreEl = document.createElement("div");
    this.scoreEl.style.cssText = `
      position:absolute; top:16px; left:16px;
      background:#333333dd; color:#f2f2f2; border-radius:16px;
      padding:8px 16px; font-size:22px; font-weight:700;
      display:flex; align-items:center; gap:6px;
    `;
    this.root.appendChild(this.scoreEl);

    this.countdownEl = document.createElement("div");
    this.countdownEl.style.cssText = `
      position:absolute; top:16px; left:50%; transform:translateX(-50%);
      background:#333333dd; color:#f94144; border-radius:16px;
      padding:8px 20px; font-size:32px; font-weight:800; font-variant-numeric:tabular-nums;
      display:none;
    `;
    this.root.appendChild(this.countdownEl);

    this.toastEl = document.createElement("div");
    this.toastEl.style.cssText = `
      position:absolute; top:80px; left:50%; transform:translateX(-50%);
      color:#fff; border-radius:12px; padding:10px 20px; font-size:20px; font-weight:700;
      display:none; box-shadow:0 4px 12px rgba(0,0,0,0.3);
    `;
    this.root.appendChild(this.toastEl);

    container.appendChild(this.root);
    this.setScore(INITIAL_SCORE);
  }

  setScore(score: number): void {
    const hearts = Array.from({ length: INITIAL_SCORE }, (_, i) => (i < score ? "❤️" : "🖤")).join("");
    this.scoreEl.textContent = hearts;
  }

  showCountdown(text: string): void {
    this.countdownEl.textContent = text;
    this.countdownEl.style.display = "block";
  }

  hideCountdown(): void {
    this.countdownEl.style.display = "none";
  }

  showToast(message: string, variant: ToastVariant): void {
    const { bg, icon } = TOAST_STYLES[variant];
    this.toastEl.style.background = bg;
    this.toastEl.textContent = `${icon} ${message}`;
    this.toastEl.style.display = "block";
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toastEl.style.display = "none";
    }, CAUGHT_TOAST_MS);
  }

  setVisible(visible: boolean): void {
    this.root.style.display = visible ? "block" : "none";
  }
}
