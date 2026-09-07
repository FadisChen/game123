import { CAUGHT_TOAST_MS, FINISH_DISTANCE_M, INITIAL_SCORE, type PlayerSummary } from "shared";

export type ToastVariant = "warn" | "danger" | "success" | "info";

export class HUD {
  private readonly root = document.createElement("div");
  private readonly scoreEl = document.createElement("div");
  private readonly toastEl = document.createElement("div");
  private readonly sprintBannerEl = document.createElement("div");
  private readonly vignetteEl = document.createElement("div");
  private readonly playersEl = document.createElement("div");
  private readonly outcomeEl = document.createElement("div");
  private readonly damageFlashEl = document.createElement("div");
  private readonly progressEl = document.createElement("div");
  private maxScore = INITIAL_SCORE;
  private toastTimer: number | undefined;
  private sprintBannerTimer: number | undefined;
  private damageFlashTimer: number | undefined;

  constructor(container: HTMLElement, subtitle = "") {
    this.root.className = "player-hud";
    this.scoreEl.className = "player-health";
    this.toastEl.className = "game-toast";
    this.toastEl.setAttribute("role", "status");
    this.toastEl.hidden = true;
    this.sprintBannerEl.className = "sprint-banner";
    this.sprintBannerEl.hidden = true;
    this.vignetteEl.className = "sprint-vignette";
    this.vignetteEl.hidden = true;
    this.playersEl.className = "player-survivors survivor-count";
    this.outcomeEl.className = "outcome-overlay";
    this.outcomeEl.setAttribute("role", "status");
    this.outcomeEl.hidden = true;
    this.damageFlashEl.className = "damage-flash";
    this.damageFlashEl.setAttribute("aria-hidden", "true");
    this.damageFlashEl.hidden = true;
    const identity = document.createElement("div");
    identity.className = "player-identity";
    identity.innerHTML = '<span class="player-symbol" aria-hidden="true">○ △ □</span><div><strong>123 木頭人</strong><span class="player-subtitle"></span></div>';
    identity.querySelector(".player-subtitle")!.textContent = subtitle;
    this.progressEl.className = "course-progress";
    this.progressEl.setAttribute("role", "progressbar");
    this.progressEl.setAttribute("aria-label", "前進距離");
    this.progressEl.setAttribute("aria-valuemin", "0");
    this.progressEl.innerHTML = '<div><span>起點</span><strong></strong><span>終點</span></div><div class="course-progress-track"><i></i></div>';
    this.root.append(identity, this.scoreEl, this.playersEl, this.progressEl, this.toastEl, this.sprintBannerEl, this.vignetteEl, this.outcomeEl);
    container.append(this.root, this.damageFlashEl);
    this.setScore(INITIAL_SCORE);
    this.setPlayerCount(1, 1);
    this.setProgress(0);
  }

  setProgress(distance: number, finishDistanceM = FINISH_DISTANCE_M): void {
    const current = Math.min(finishDistanceM, Math.max(0, distance));
    this.progressEl.setAttribute("aria-valuenow", String(current));
    this.progressEl.setAttribute("aria-valuemax", String(finishDistanceM));
    this.progressEl.querySelector("strong")!.textContent = `距終點 ${(finishDistanceM - current).toFixed(1)} m`;
    this.progressEl.style.setProperty("--progress", `${current / finishDistanceM * 100}%`);
  }

  /** maxScore 決定要畫幾格愛心；主辦方可以每場調整（1~3）。 */
  setScore(score: number, maxScore = this.maxScore): void {
    this.maxScore = maxScore;
    this.scoreEl.textContent = Array.from({ length: maxScore }, (_, i) => i < score ? "♥" : "♡").join(" ");
    this.scoreEl.setAttribute("aria-label", `剩餘 ${score} 分，共 ${maxScore} 分`);
  }

  /**
   * 個人勝負的全螢幕反饋。純視覺，不放文字——WaitingScreen 隨後就會蓋上來說明狀態，
   * 兩邊都寫一次只是重複，而且卡片本來就會擋住底下的字。
   */
  showOutcomeOverlay(outcome: "eliminated" | "finished"): void {
    this.outcomeEl.dataset.outcome = outcome;
    this.outcomeEl.hidden = false;
    navigator.vibrate?.(outcome === "finished" ? [40, 40, 120] : [80, 60, 80]);
  }

  clearOutcomeOverlay(): void {
    this.outcomeEl.hidden = true;
    delete this.outcomeEl.dataset.outcome;
  }

  /** 每次被鬼發現扣分時的短暫全畫面紅光；獨立於 HUD，感應模式隱藏 HUD 時仍可看見。 */
  showDamageFlash(): void {
    this.damageFlashEl.hidden = false;
    this.damageFlashEl.classList.remove("damage-flash-active");
    void this.damageFlashEl.offsetWidth;
    this.damageFlashEl.classList.add("damage-flash-active");
    window.clearTimeout(this.damageFlashTimer);
    this.damageFlashTimer = window.setTimeout(() => {
      this.damageFlashEl.hidden = true;
    }, 500);
    this.vibrateDamage();
  }

  /** 感應模式不顯示紅光，但保留裝置支援時的觸覺提示。 */
  vibrateDamage(): void {
    navigator.vibrate?.(60);
  }

  setPlayers(players: PlayerSummary[]): void {
    this.setPlayerCount(players.filter((player) => !player.eliminated).length, players.length);
  }

  setPlayerCount(alive: number, total: number): void {
    this.playersEl.innerHTML = `<span>存活玩家</span><div><strong>${alive}</strong><span> / ${total}</span></div>`;
  }

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
