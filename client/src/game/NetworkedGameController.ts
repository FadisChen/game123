import {
  FINAL_SPRINT_REMAINING_M,
  FINISH_DISTANCE_M,
  GhostReplicaAI,
  type Foot,
  type PlayerSummary,
  type RoomGameOverPayload,
  type RoomPhase,
  type RoomStateSnapshot,
  type StepResultMsg,
} from "shared";
import { HUD } from "../ui/HUD";
import { TeachingScreen } from "../ui/TeachingScreen";
import { WaitingScreen } from "../ui/WaitingScreen";
import { GameOverScreen, type GameOutcome } from "../ui/GameOverScreen";
import { Controls } from "../ui/Controls";
import { GameScene } from "./Scene";
import { sfx } from "./audio";
import { ClockSync } from "../net/ClockSync";
import type { SocketClient } from "../net/SocketClient";

/**
 * 玩家端的網路版控制器：不再自己跑 GhostAI/Player 判定，全部改成送出意圖給伺服器，
 * 再依伺服器廣播的結果驅動跟 Phase 1 完全相同的 Scene/HUD/音效程式碼。
 */
export class NetworkedGameController {
  private readonly scene: GameScene;
  private readonly hud: HUD;
  private readonly teaching: TeachingScreen;
  private readonly waiting: WaitingScreen;
  private readonly gameOver: GameOverScreen;
  private readonly controls: Controls;
  private readonly socketClient: SocketClient;
  private readonly clock = new ClockSync();
  private readonly ghostReplica = new GhostReplicaAI(0);
  private readonly playerId: string;
  private readonly roomCode: string;
  private readonly players = new Map<string, PlayerSummary>();
  private playersDirty = false;

  private serverPhase: RoomPhase = "WAITING";
  private teachingDismissed = false;
  private finalSprintTriggered = false;
  private nextClientSeq = 0;
  /** 個人結果可能早於整個房間的回合結束（其他玩家還在玩），跟房間階段分開追蹤。 */
  private myOutcome: "active" | "eliminated" | "finished" = "active";

  /**
   * 加入房間的握手（含失敗重試的畫面）由呼叫端（main-player.ts）透過 JoinScreen 完成；
   * 這裡只接手一個已經加入成功的連線階段，負責把伺服器廣播轉譯成畫面/音效。
   */
  constructor(
    container: HTMLElement,
    socketClient: SocketClient,
    roomCode: string,
    playerId: string,
    playerName: string,
    initialSnapshot: RoomStateSnapshot,
  ) {
    this.socketClient = socketClient;
    this.roomCode = roomCode;
    this.playerId = playerId;

    this.scene = new GameScene(container);
    this.hud = new HUD(container);
    this.controls = new Controls(container, (foot) => this.handleStepPress(foot));
    this.teaching = new TeachingScreen(container, () => this.handleTeachingDismissed());
    this.waiting = new WaitingScreen(container, playerName);
    this.gameOver = new GameOverScreen(container, () => this.handleRestartButton(), "等待主辦方重新開始");

    this.hud.setVisible(false);
    this.controls.setVisible(false);
    this.teaching.setVisible(false);
    this.waiting.setVisible(false);
    this.gameOver.hide();

    this.wireSocketEvents();
    this.applySnapshot(initialSnapshot);

    requestAnimationFrame(() => this.loop());
  }

  private wireSocketEvents(): void {
    this.socketClient.onRoomState((snapshot) => this.applySnapshot(snapshot));

    this.socketClient.onPhaseChanged((payload) => {
      this.clock.updateFromServerNow(payload.serverNowMs);
      this.serverPhase = payload.phase;
      this.syncScreensToPhase();
    });

    this.socketClient.onCountdownTick((payload) => this.handleCountdownTick(payload.value));

    this.socketClient.onGhostStateChanged((payload) => {
      this.ghostReplica.applyServerState(payload.state, payload.stateStartedAtMs, payload.stateDurationMs);
    });

    this.socketClient.onPlayerStepped((payload) => {
      const player = this.players.get(payload.playerId);
      if (player && payload.result.kind === "advanced") {
        player.distance = payload.result.distanceAfter;
        player.finished = payload.result.finished;
      } else if (player && payload.result.kind === "caught") {
        player.score = payload.result.scoreAfter;
        player.eliminated = payload.result.eliminated;
      }
      this.refreshPlayers();
      if (payload.playerId !== this.playerId) return;
      this.handleOwnStepResult(payload.foot, payload.result);
    });

    this.socketClient.onPlayerBoostChanged((payload) => {
      if (payload.playerId !== this.playerId) return;
      this.handleOwnBoostChanged(payload.boosted);
    });

    this.socketClient.onGameOver((payload) => this.handleGameOver(payload));
  }

  private applySnapshot(snapshot: RoomStateSnapshot): void {
    this.clock.updateFromServerNow(snapshot.serverNowMs);
    this.serverPhase = snapshot.phase;
    this.players.clear();
    for (const player of snapshot.players) this.players.set(player.playerId, player);
    this.refreshPlayers();
    if (snapshot.ghost) {
      this.ghostReplica.applyServerState(snapshot.ghost.state, snapshot.ghost.stateStartedAtMs, snapshot.ghost.stateDurationMs);
    }
    const mine = snapshot.players.find((p) => p.playerId === this.playerId);
    if (mine) {
      this.hud.setScore(mine.score);
      this.scene.setCameraDistanceImmediate(mine.distance);
      // 重連時可能已經在上一次連線期間被淘汰/抵達終點，用快照補回這個狀態。
      this.myOutcome = mine.finished ? "finished" : mine.eliminated ? "eliminated" : "active";
    }
    this.syncScreensToPhase();
  }

  /** 重連後光靠事件流可能錯過中間狀態，所以每次拿到完整快照都重新對齊一次畫面。 */
  private syncScreensToPhase(): void {
    switch (this.serverPhase) {
      case "WAITING":
        this.hud.setVisible(false);
        this.controls.setVisible(false);
        this.gameOver.hide();
        if (this.teachingDismissed) {
          this.teaching.setVisible(false);
          this.waiting.setVisible(true);
        } else {
          this.waiting.setVisible(false);
          this.teaching.setVisible(true);
        }
        break;
      case "COUNTDOWN":
        this.myOutcome = "active"; // 新回合開始，個人結果重置
        this.finalSprintTriggered = false;
        this.hud.resetFinalSprint();
        this.teaching.setVisible(false);
        this.waiting.setVisible(false);
        this.gameOver.hide();
        this.hud.setVisible(true);
        this.controls.setVisible(false);
        break;
      case "PLAYING":
      case "PAUSED":
        this.teaching.setVisible(false);
        this.gameOver.hide();
        this.hud.setVisible(true);
        this.hud.hideCountdown();
        if (this.myOutcome === "active") {
          this.waiting.setVisible(false);
          this.controls.setVisible(this.serverPhase === "PLAYING");
        } else {
          // 自己已經淘汰或抵達終點，但房間裡還有其他玩家在玩——關掉操作按鈕，顯示個人結果，
          // 等到 room:gameOver（全員結束）才顯示完整排名畫面。
          this.controls.setVisible(false);
          this.waiting.setMessage(this.personalConclusionMessage());
          this.waiting.setVisible(true);
        }
        break;
      case "GAME_OVER":
        this.controls.setVisible(false);
        break;
    }
  }

  private handleTeachingDismissed(): void {
    this.teachingDismissed = true;
    if (this.serverPhase === "WAITING") {
      this.teaching.setVisible(false);
      this.waiting.setVisible(true);
    }
  }

  private handleCountdownTick(value: number | "GO"): void {
    if (value === "GO") {
      this.hud.showCountdown("GO!");
      sfx.play("go");
    } else {
      this.hud.showCountdown(String(value));
      sfx.play("countdown");
    }
  }

  private handleStepPress(foot: Foot): void {
    if (this.serverPhase !== "PLAYING" || this.myOutcome !== "active") return;
    void this.socketClient.step({
      roomCode: this.roomCode,
      playerId: this.playerId,
      foot,
      clientSeq: this.nextClientSeq++,
    });
  }

  private handleOwnStepResult(foot: Foot, result: StepResultMsg): void {
    const now = this.clock.nowServerMs();
    switch (result.kind) {
      case "rejected-no-alternate":
        this.controls.flashRejected(foot);
        break;
      case "caught":
        this.hud.setScore(result.scoreAfter);
        this.hud.showToast("被發現! -1分", "warn");
        this.scene.startCaughtShake(now);
        sfx.play(result.eliminated ? "eliminated" : "caught");
        if (result.eliminated) {
          this.myOutcome = "eliminated";
          this.syncScreensToPhase();
        }
        break;
      case "advanced":
        sfx.play("footstep");
        this.scene.startStepTween(result.distanceAfter, foot, now);
        this.maybeTriggerFinalSprint(result.distanceAfter);
        if (result.finished) {
          sfx.play("victory");
          this.myOutcome = "finished";
          this.syncScreensToPhase();
        }
        break;
    }
  }

  /** PRD 22.2：自己進入加速窗口時的提示，結束時不特別提示（玩家從動作變回正常速度即可感覺到）。 */
  private handleOwnBoostChanged(boosted: boolean): void {
    if (!boosted) return;
    sfx.play("boost");
    this.hud.showToast("⚡ 加速中！", "success");
  }

  private personalConclusionMessage(): string {
    return this.myOutcome === "finished"
      ? "🏆 你已抵達終點！請等待本回合結束"
      : "❌ 你已被淘汰，請等待本回合結束";
  }

  /** 距終點剩 FINAL_SPRINT_REMAINING_M 內時觸發一次緊張提示（對應 PRD 22.3），跟 Phase 1 版本邏輯相同。 */
  private maybeTriggerFinalSprint(distance: number): void {
    if (this.finalSprintTriggered) return;
    const remaining = FINISH_DISTANCE_M - distance;
    if (remaining <= 0 || remaining > FINAL_SPRINT_REMAINING_M) return;
    this.finalSprintTriggered = true;
    this.hud.showFinalSprintBanner(`最後 ${Math.ceil(remaining)} 公尺！`);
  }

  private handleGameOver(payload: RoomGameOverPayload): void {
    this.controls.setVisible(false);
    this.waiting.setVisible(false);
    const mine = payload.ranking.find((r) => r.playerId === this.playerId);
    const outcome: GameOutcome = mine?.outcome ?? "surviving";
    this.gameOver.showResult(outcome);
  }

  /** 玩家端沒有主控權——重玩由主辦方觸發，這裡的按鈕純粹是提示用，實際畫面切換交給 room:phaseChanged。 */
  private handleRestartButton(): void {
    this.hud.resetFinalSprint();
    this.finalSprintTriggered = false;
  }

  private loop(): void {
    if (this.playersDirty) {
      this.playersDirty = false;
      const players = [...this.players.values()];
      this.scene.updatePlayers(players, this.playerId);
      this.hud.setPlayers(players);
    }
    const serverNow = this.clock.nowServerMs();
    this.hud.setSignal(this.ghostReplica.getState(), this.ghostReplica.getRemainingMs(serverNow), this.serverPhase);
    this.scene.updateGhostVisual(this.ghostReplica.getFacingPlayerAmount(serverNow), this.ghostReplica.isLooking());
    this.scene.updateAnimations(serverNow);
    this.scene.render();
    requestAnimationFrame(() => this.loop());
  }

  private refreshPlayers(): void {
    this.playersDirty = true;
  }
}
