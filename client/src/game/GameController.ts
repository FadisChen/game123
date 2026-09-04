import { COUNTDOWN_SECONDS, STEP_TWEEN_MS } from "../config";
import { HUD } from "../ui/HUD";
import { TeachingScreen } from "../ui/TeachingScreen";
import { GameOverScreen, type GameOutcome } from "../ui/GameOverScreen";
import { Controls } from "../ui/Controls";
import { GameScene } from "./Scene";
import { GhostAI } from "./GhostAI";
import { Player, type Foot } from "./Player";

type GameState = "TEACHING" | "COUNTDOWN" | "PLAYING" | "GAME_OVER";

/** 遊戲狀態機：TEACHING -> COUNTDOWN -> PLAYING -> GAME_OVER（對應 PRD 第 10 章，精簡房間相關狀態）。 */
export class GameController {
  private readonly scene: GameScene;
  private readonly hud: HUD;
  private readonly teaching: TeachingScreen;
  private readonly gameOver: GameOverScreen;
  private readonly controls: Controls;

  private state: GameState = "TEACHING";
  private ghost: GhostAI;
  private player: Player;
  private countdownValue = COUNTDOWN_SECONDS;
  private countdownIntervalId: number | undefined;

  constructor(container: HTMLElement) {
    this.scene = new GameScene(container);
    this.hud = new HUD(container);
    this.controls = new Controls(container, (foot) => this.handleStep(foot));
    this.teaching = new TeachingScreen(container, () => this.startCountdown());
    this.gameOver = new GameOverScreen(container, () => this.restart());

    this.ghost = new GhostAI(performance.now());
    this.player = new Player(this.ghost);

    this.enterTeaching();
    requestAnimationFrame((now) => this.loop(now));
  }

  private enterTeaching(): void {
    this.state = "TEACHING";
    this.hud.setVisible(false);
    this.controls.setVisible(false);
    this.gameOver.hide();
    this.teaching.setVisible(true);
    this.scene.setCameraDistanceImmediate(0);
  }

  private startCountdown(): void {
    this.teaching.setVisible(false);
    this.state = "COUNTDOWN";
    this.hud.setVisible(true);
    this.countdownValue = COUNTDOWN_SECONDS;
    this.hud.showCountdown(String(this.countdownValue));

    this.countdownIntervalId = window.setInterval(() => {
      this.countdownValue -= 1;
      if (this.countdownValue > 0) {
        this.hud.showCountdown(String(this.countdownValue));
        return;
      }
      this.hud.showCountdown("GO!");
      window.clearInterval(this.countdownIntervalId);
      window.setTimeout(() => this.startPlaying(), 500);
    }, 1000);
  }

  private startPlaying(): void {
    this.hud.hideCountdown();
    this.state = "PLAYING";
    this.controls.setVisible(true);

    this.ghost = new GhostAI(performance.now());
    this.player = new Player(this.ghost);
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
          window.setTimeout(() => this.endGame("eliminated"), 400);
        }
        break;
      case "advanced":
        this.scene.startStepTween(result.distanceAfter, foot, now);
        if (result.finished) {
          window.setTimeout(() => this.endGame("finished"), STEP_TWEEN_MS + 200);
        }
        break;
    }
  }

  private endGame(outcome: GameOutcome): void {
    this.state = "GAME_OVER";
    this.controls.setVisible(false);
    this.gameOver.showResult(outcome);
  }

  private restart(): void {
    this.enterTeaching();
  }

  private loop(now: number): void {
    if (this.state === "PLAYING") {
      this.ghost.update(now);
      this.scene.updateGhostVisual(this.ghost.getFacingPlayerAmount(now), this.ghost.isLooking());
    }
    this.scene.updateAnimations(now);
    this.scene.render();
    requestAnimationFrame((next) => this.loop(next));
  }
}
