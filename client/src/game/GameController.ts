import {
  FINAL_SPRINT_REMAINING_M,
  FINISH_DISTANCE_M,
  STEP_TWEEN_MS,
  GhostAI,
  Player,
  type Foot,
  type GhostState,
  type GhostVisualState,
} from "shared";
import { HUD } from "../ui/HUD";
import { TeachingScreen } from "../ui/TeachingScreen";
import { GameOverScreen, type GameOutcome } from "../ui/GameOverScreen";
import { Controls } from "../ui/Controls";
import { GameScene } from "./Scene";
import { MusicPlayer, sfx } from "./audio";

type GameState = "TEACHING" | "PLAYING" | "GAME_OVER";

/**
 * Phase 1 的單機本機版控制器，Phase 2 加入連線後保留給 `?offline=1` 開發旗標使用
 * （純調美術/音效時不需要開伺服器）。正式的多人流程見 NetworkedGameController。
 * 遊戲狀態機：TEACHING -> PLAYING -> GAME_OVER；音樂輪次由本機 GhostAI 驅動，
 * 方便不連線時直接調整遊戲節奏。
 */
export class GameController {
  private readonly scene: GameScene;
  private readonly hud: HUD;
  private readonly teaching: TeachingScreen;
  private readonly gameOver: GameOverScreen;
  private readonly controls: Controls;
  private readonly musicRetryButton = document.createElement("button");
  private readonly music = new MusicPlayer(() => { this.musicRetryButton.hidden = false; });

  private state: GameState = "TEACHING";
  private ghost: GhostAI;
  private player: Player;
  private previousGhostState: GhostState | null = null;
  private finalSprintTriggered = false;

  constructor(container: HTMLElement) {
    this.scene = new GameScene(container);
    this.hud = new HUD(container);
    this.controls = new Controls(container, (foot) => this.handleStep(foot));
    this.teaching = new TeachingScreen(container, () => this.startPlaying());
    this.gameOver = new GameOverScreen(container, () => this.restart());
    this.musicRetryButton.type = "button";
    this.musicRetryButton.className = "music-retry-button player-music-retry";
    this.musicRetryButton.textContent = "音樂播放失敗 · 點此重試";
    this.musicRetryButton.hidden = true;
    this.musicRetryButton.addEventListener("click", () => {
      this.music.retry();
      this.musicRetryButton.hidden = true;
    });
    container.appendChild(this.musicRetryButton);

    this.ghost = new GhostAI(performance.now());
    this.player = new Player(this.ghost);

    this.enterTeaching();
    requestAnimationFrame((now) => this.loop(now));
  }

  private enterTeaching(): void {
    this.state = "TEACHING";
    this.music.stop();
    this.musicRetryButton.hidden = true;
    this.hud.setVisible(false);
    this.hud.resetFinalSprint();
    this.controls.setVisible(false);
    this.gameOver.hide();
    this.teaching.setVisible(true);
    this.scene.setCameraDistanceImmediate(0);
  }

  private startPlaying(): void {
    this.music.primeFromGesture();
    this.teaching.setVisible(false);
    this.state = "PLAYING";
    this.hud.setVisible(true);
    this.hud.resetFinalSprint();
    this.controls.setVisible(true);

    this.ghost = new GhostAI(performance.now());
    this.player = new Player(this.ghost);
    this.previousGhostState = this.ghost.getState();
    this.finalSprintTriggered = false;
    this.hud.setScore(this.player.score);
    this.scene.setCameraDistanceImmediate(0);
  }

  private handleStep(foot: Foot): void {
    if (this.state !== "PLAYING") return;
    const now = performance.now();
    const result = this.player.step(foot);

    switch (result.kind) {
      case "rejected-no-alternate":
        this.controls.flashRejected(foot);
        break;
      case "caught":
        this.hud.setScore(result.scoreAfter);
        this.hud.showToast("被發現! -1分", "warn");
        this.scene.startCaughtShake(now);
        if (result.eliminated) {
          sfx.play("eliminated");
          window.setTimeout(() => this.endGame("eliminated"), 400);
        } else {
          sfx.play("caught");
        }
        break;
      case "advanced":
        sfx.play("footstep");
        this.scene.startStepTween(result.distanceAfter, foot, now);
        this.maybeTriggerFinalSprint(result.distanceAfter);
        if (result.finished) {
          sfx.play("victory");
          window.setTimeout(() => this.endGame("finished"), STEP_TWEEN_MS + 200);
        }
        break;
    }
  }

  /** 距終點剩 FINAL_SPRINT_REMAINING_M 內時觸發一次緊張提示（對應 PRD 22.3）。 */
  private maybeTriggerFinalSprint(distance: number): void {
    if (this.finalSprintTriggered) return;
    const remaining = FINISH_DISTANCE_M - distance;
    if (remaining <= 0 || remaining > FINAL_SPRINT_REMAINING_M) return;
    this.finalSprintTriggered = true;
    this.hud.showFinalSprintBanner(`最後 ${Math.ceil(remaining)} 公尺！`);
  }

  private endGame(outcome: GameOutcome): void {
    this.state = "GAME_OVER";
    this.music.stop();
    this.controls.setVisible(false);
    this.gameOver.showResult(outcome);
  }

  private restart(): void {
    this.enterTeaching();
  }

  private loop(now: number): void {
    this.hud.setPlayerCount(this.player.score > 0 ? 1 : 0, 1);
    if (this.state === "PLAYING") {
      this.ghost.update(now);
      const currentGhostState = this.ghost.getState();
      if (
        this.previousGhostState !== currentGhostState &&
        (currentGhostState === "TURNING_TO_LOOK" || currentGhostState === "TURNING_AWAY")
      ) {
        sfx.play("ghostTurn");
      }
      this.previousGhostState = currentGhostState;
      this.music.sync(this.toGhostVisualState(), "PLAYING", now);
      this.scene.updateGhostVisual(this.ghost.getFacingPlayerAmount(now), this.ghost.isLooking());
    }
    this.scene.updateAnimations(now);
    this.scene.render();
    requestAnimationFrame((next) => this.loop(next));
  }

  private toGhostVisualState(): GhostVisualState {
    return {
      state: this.ghost.getState(),
      stateStartedAtMs: this.ghost.getStateStartedAt(),
      stateDurationMs: this.ghost.getStateDuration(),
      musicCycle: this.ghost.getMusicCycle(),
      musicPlaybackRate: this.ghost.getMusicPlaybackRate(),
    };
  }
}
