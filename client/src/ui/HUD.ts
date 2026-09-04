import { CAUGHT_TOAST_MS, INITIAL_SCORE } from "../config";
import { sfx } from "../game/audio";

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
  private readonly muteButton: HTMLButtonElement;
  private readonly sprintBannerEl: HTMLDivElement;
  private readonly vignetteEl: HTMLDivElement;
  private toastTimer: number | undefined;
  private sprintBannerTimer: number | undefined;

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

    this.muteButton = document.createElement("button");
    this.muteButton.style.cssText = `
      pointer-events:auto; position:absolute; top:16px; right:16px;
      width:44px; height:44px; border-radius:50%; border:none;
      background:#333333dd; color:#f2f2f2; font-size:20px; cursor:pointer;
    `;
    this.muteButton.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      const muted = sfx.toggleMuted();
      this.refreshMuteIcon(muted);
    });
    this.refreshMuteIcon(sfx.isMuted());
    this.root.appendChild(this.muteButton);

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

    this.sprintBannerEl = document.createElement("div");
    this.sprintBannerEl.style.cssText = `
      position:absolute; top:40%; left:50%; transform:translate(-50%, -50%);
      color:#f94144; font-size:40px; font-weight:900; letter-spacing:2px;
      text-shadow:0 2px 8px rgba(0,0,0,0.5); display:none;
    `;
    this.root.appendChild(this.sprintBannerEl);

    this.vignetteEl = document.createElement("div");
    this.vignetteEl.style.cssText = `
      position:absolute; inset:0; pointer-events:none;
      box-shadow: inset 0 0 0 rgba(249,65,68,0); display:none;
    `;
    this.root.appendChild(this.vignetteEl);

    container.appendChild(this.root);
    this.setScore(INITIAL_SCORE);
  }

  private refreshMuteIcon(muted: boolean): void {
    this.muteButton.textContent = muted ? "🔇" : "🔊";
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

  /** 最後衝刺提示（對應 PRD 22.3），短暫顯示後淡出，並開啟持續到本局結束的紅色警示暈影。 */
  showFinalSprintBanner(text: string): void {
    this.sprintBannerEl.textContent = text;
    this.sprintBannerEl.style.display = "block";
    this.sprintBannerEl.style.opacity = "1";
    window.clearTimeout(this.sprintBannerTimer);
    this.sprintBannerTimer = window.setTimeout(() => {
      this.sprintBannerEl.style.transition = "opacity 600ms";
      this.sprintBannerEl.style.opacity = "0";
    }, 1400);
    this.vignetteEl.style.display = "block";
    this.vignetteEl.classList.add("final-sprint-vignette");
  }

  resetFinalSprint(): void {
    window.clearTimeout(this.sprintBannerTimer);
    this.sprintBannerEl.style.display = "none";
    this.sprintBannerEl.style.transition = "";
    this.vignetteEl.style.display = "none";
    this.vignetteEl.classList.remove("final-sprint-vignette");
  }

  setVisible(visible: boolean): void {
    this.root.style.display = visible ? "block" : "none";
  }
}
