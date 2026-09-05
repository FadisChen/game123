import { CAUGHT_TOAST_MS, INITIAL_SCORE, type GhostState, type PlayerSummary, type RoomPhase } from "shared";
import { sfx } from "../game/audio";
import { SignalStatus } from "./SignalStatus";

export type ToastVariant = "warn" | "danger" | "success" | "info";

export class HUD {
  private readonly root = document.createElement("div");
  private readonly scoreEl = document.createElement("div");
  private readonly countdownEl = document.createElement("div");
  private readonly toastEl = document.createElement("div");
  private readonly muteButton = document.createElement("button");
  private readonly sprintBannerEl = document.createElement("div");
  private readonly vignetteEl = document.createElement("div");
  private readonly playersEl = document.createElement("div");
  private readonly signal = new SignalStatus();
  private toastTimer: number | undefined;
  private sprintBannerTimer: number | undefined;

  constructor(container: HTMLElement) {
    this.root.className = "player-hud";
    this.scoreEl.className = "player-health";
    this.muteButton.className = "mute-button";
    this.muteButton.type = "button";
    this.muteButton.addEventListener("click", () => this.refreshMuteIcon(sfx.toggleMuted()));
    this.refreshMuteIcon(sfx.isMuted());
    this.countdownEl.className = "start-countdown";
    this.countdownEl.hidden = true;
    this.toastEl.className = "game-toast";
    this.toastEl.setAttribute("role", "status");
    this.toastEl.hidden = true;
    this.sprintBannerEl.className = "sprint-banner";
    this.sprintBannerEl.hidden = true;
    this.vignetteEl.className = "sprint-vignette";
    this.vignetteEl.hidden = true;
    this.playersEl.className = "player-survivors survivor-count";
    const crosshair = document.createElement("div");
    crosshair.className = "crosshair";
    crosshair.setAttribute("aria-hidden", "true");
    this.root.append(this.signal.root, this.scoreEl, this.playersEl, this.muteButton, crosshair, this.countdownEl, this.toastEl, this.sprintBannerEl, this.vignetteEl);
    container.appendChild(this.root);
    this.setScore(INITIAL_SCORE);
    this.setPlayerCount(1, 1);
  }

  private refreshMuteIcon(muted: boolean): void {
    this.muteButton.textContent = muted ? "♪ ×" : "♪";
    this.muteButton.setAttribute("aria-label", muted ? "開啟音效" : "關閉音效");
    this.muteButton.setAttribute("aria-pressed", String(muted));
  }

  setScore(score: number): void {
    this.scoreEl.textContent = Array.from({ length: INITIAL_SCORE }, (_, i) => i < score ? "♥" : "♡").join(" ");
    this.scoreEl.setAttribute("aria-label", `剩餘 ${score} 分`);
  }

  setPlayers(players: PlayerSummary[]): void {
    this.setPlayerCount(players.filter((player) => !player.eliminated).length, players.length);
  }

  setPlayerCount(alive: number, total: number): void {
    this.playersEl.innerHTML = `<span>存活玩家</span><div><strong>${alive}</strong><span> / ${total}</span></div>`;
  }

  setSignal(state: GhostState, remainingMs: number, phase: RoomPhase): void {
    this.signal.update(state, remainingMs, phase);
  }

  showCountdown(text: string): void {
    this.countdownEl.textContent = text;
    this.countdownEl.hidden = false;
  }

  hideCountdown(): void { this.countdownEl.hidden = true; }

  showToast(message: string, variant: ToastVariant): void {
    this.toastEl.dataset.variant = variant;
    this.toastEl.textContent = message;
    this.toastEl.hidden = false;
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => { this.toastEl.hidden = true; }, CAUGHT_TOAST_MS);
  }

  showFinalSprintBanner(text: string): void {
    this.sprintBannerEl.textContent = text;
    this.sprintBannerEl.hidden = false;
    window.clearTimeout(this.sprintBannerTimer);
    this.sprintBannerTimer = window.setTimeout(() => { this.sprintBannerEl.hidden = true; }, 2000);
    this.vignetteEl.hidden = false;
    this.vignetteEl.classList.add("final-sprint-vignette");
  }

  resetFinalSprint(): void {
    window.clearTimeout(this.sprintBannerTimer);
    this.sprintBannerEl.hidden = true;
    this.vignetteEl.hidden = true;
    this.vignetteEl.classList.remove("final-sprint-vignette");
  }

  setVisible(visible: boolean): void { this.root.hidden = !visible; }
}
