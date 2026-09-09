import {
  type ConnectionState,
  FINAL_SPRINT_REMAINING_M,
  FINISH_DISTANCE_M,
  GhostReplicaAI,
  HIT_LOCKOUT_MS,
  type Foot,
  type PlayerMode,
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
import { clearPlayerSession, type SocketClient } from "../net/SocketClient";
import { MotionInput } from "../input/MotionInput";
import { StartCountdownScreen } from "../ui/StartCountdownScreen";

/**
 * 玩家端的網路版控制器：不再自己跑 GhostAI/Player 判定，全部改成送出意圖給伺服器，
 * 再依伺服器廣播的結果驅動跟 Phase 1 完全相同的 Scene/HUD/音效程式碼。
 */
export class NetworkedGameController {
  private scene: GameScene | null = null;
  private readonly container: HTMLElement;
  private readonly motionPrompt = document.createElement("p");
  private readonly hud: HUD;
  private readonly teaching: TeachingScreen;
  private readonly waiting: WaitingScreen;
  private readonly gameOver: GameOverScreen;
  private readonly startCountdown: StartCountdownScreen;
  private readonly controls: Controls;
  private readonly motionInput: MotionInput;
  private readonly socketClient: SocketClient;
  private readonly clock = new ClockSync();
  private readonly ghostReplica = new GhostReplicaAI(0);
  private readonly playerId: string;
  private readonly players = new Map<string, PlayerSummary>();
  private playersDirty = false;

  private serverPhase: RoomPhase = "WAITING";
  private teachingDismissed = false;
  private playerMode: PlayerMode = "main";
  private finishDistanceM = FINISH_DISTANCE_M;
  private finalSprintTriggered = false;
  private connectionState: ConnectionState = "connected";
  private resumeInFlight = false;
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
    this.playerId = playerId;

    this.container = container;
    container.classList.add("player-game");
    this.motionPrompt.className = "motion-prompt";
    this.motionPrompt.setAttribute("role", "status");
    this.motionPrompt.hidden = true;
    container.appendChild(this.motionPrompt);
    this.hud = new HUD(container, `${playerName} · 房間 ${roomCode}`);
    this.controls = new Controls(container, (foot) =>
      this.handleStepPress(foot),
    );
    this.motionInput = new MotionInput(
      (foot) => this.handleMotionStep(foot),
      (available) => this.applyMotionAvailability(available),
    );
    this.teaching = new TeachingScreen(
      container,
      () => void this.handleTeachingDismissed(),
    );
    this.waiting = new WaitingScreen(container, playerName);
    this.gameOver = new GameOverScreen(
      container,
      undefined,
      "等待主辦方重新開始",
    );
    this.startCountdown = new StartCountdownScreen(container);

    this.hud.setVisible(false);
    this.controls.setVisible(false);
    this.teaching.setVisible(false);
    this.waiting.setVisible(false);
    this.gameOver.hide();

    this.wireSocketEvents();
    this.socketClient.onConnectionState((state) =>
      this.setConnectionState(state),
    );
    this.socketClient.onReconnect(() => void this.resumeSession());
    this.applySnapshot(initialSnapshot);
    container.classList.remove("portrait-setup");

    requestAnimationFrame(() => this.loop());
  }

  private wireSocketEvents(): void {
    this.socketClient.onRoomState((snapshot) => this.applySnapshot(snapshot));

    this.socketClient.onPhaseChanged((payload) => {
      this.clock.updateFromServerNow(payload.serverNowMs);
      this.serverPhase = payload.phase;
      this.applyRoomSettings(payload.settings);
      this.syncScreensToPhase();
    });

    this.socketClient.onStartCountdown((payload) => {
      if (this.serverPhase !== "WAITING") return;
      this.clock.updateFromServerNow(payload.serverNowMs);
      this.startCountdown.play(payload.serverNowMs, payload.durationMs, () =>
        this.clock.nowServerMs(),
      );
    });

    this.socketClient.onGhostStateChanged((payload) => {
      this.ghostReplica.applyServerState(
        payload.state,
        payload.stateStartedAtMs,
        payload.stateDurationMs,
        payload.musicCycle,
        payload.musicPlaybackRate,
      );
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

  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state;
    this.syncScreensToPhase();
  }

  private async resumeSession(): Promise<void> {
    if (this.resumeInFlight) return;
    this.resumeInFlight = true;
    try {
      const ack = await this.socketClient.resumePlayerRoom();
      if (!ack.ok) {
        clearPlayerSession();
        this.controls.setVisible(false);
        this.teaching.setVisible(false);
        this.waiting.setMessage("遊戲服務已重新啟動");
        this.waiting.showError("請重新掃描 QR Code 加入遊戲");
        this.waiting.setVisible(true);
        return;
      }
      this.setConnectionState("connected");
      this.applySnapshot(ack.snapshot);
    } catch {
      this.waiting.setMessage("重新連線中…");
      this.waiting.setVisible(true);
    } finally {
      this.resumeInFlight = false;
    }
  }

  private applySnapshot(snapshot: RoomStateSnapshot): void {
    this.clock.updateFromServerNow(snapshot.serverNowMs);
    this.serverPhase = snapshot.phase;
    this.applyRoomSettings(snapshot.settings);
    this.players.clear();
    for (const player of snapshot.players)
      this.players.set(player.playerId, player);
    this.refreshPlayers();
    if (snapshot.ghost) {
      this.ghostReplica.applyServerState(
        snapshot.ghost.state,
        snapshot.ghost.stateStartedAtMs,
        snapshot.ghost.stateDurationMs,
        snapshot.ghost.musicCycle,
        snapshot.ghost.musicPlaybackRate,
      );
    }
    const mine = snapshot.players.find((p) => p.playerId === this.playerId);
    if (mine) {
      this.hud.setScore(mine.score, snapshot.settings.maxScore);
      this.scene?.setCameraDistanceImmediate(mine.distance);
      this.hud.setProgress(mine.distance, this.finishDistanceM);
      // 重連時可能已經在上一次連線期間被淘汰/抵達終點，用快照補回這個狀態。
      this.myOutcome = mine.finished
        ? "finished"
        : mine.eliminated
          ? "eliminated"
          : "active";
    }
    this.syncScreensToPhase();
  }

  private applyRoomSettings(settings: RoomStateSnapshot["settings"]): void {
    this.finishDistanceM = settings.finishDistanceM;
    const modeChanged = this.playerMode !== settings.playerMode;
    if (modeChanged && this.serverPhase === "WAITING") {
      this.teachingDismissed = false;
    }
    this.playerMode = settings.playerMode;
    if (this.playerMode === "main") {
      this.scene ??= new GameScene(this.container);
      this.scene.setFinishDistance(settings.finishDistanceM);
    }
    if (this.scene)
      this.scene.renderer.domElement.hidden = this.playerMode === "motion";
    this.controls.setMode(settings.playerMode);
    this.teaching.setPlayerMode(settings.playerMode);
    if (settings.playerMode === "main") {
      this.motionInput.stop();
    }
    if (modeChanged) {
      this.applyMotionAvailability(false);
      // 先讓直向玩家按下教學確認，才能請求裝置感應權限。
      this.container.classList.toggle(
        "motion-permission-pending",
        this.playerMode === "motion",
      );
    }
  }

  /** 感應器實際可不可用是「每個玩家自己的裝置」決定的，跟房間層級的 playerMode 分開追蹤；
   * 兩者同時成立才套用直式感應版面，否則（含判定失敗、房間切回主視角）一律回退橫式按鈕操作。
   * 移除 motion-mode class 後，LandscapeGuard 既有的 MutationObserver 會自動跳出橫向引導遮罩，
   * 不需要在這裡搶著呼叫 requestFullscreen——那個 API 只能在使用者手勢當下呼叫，這裡的觸發時機
   * （socket 事件、感應逾時 timeout）都不是使用者手勢，硬呼叫在部分瀏覽器反而會產生非預期的全螢幕狀態。 */
  private applyMotionAvailability(available: boolean): void {
    this.container.classList.remove("motion-permission-pending");
    this.controls.setMotionAvailable(available);
    this.container.classList.toggle(
      "motion-mode",
      this.playerMode === "motion" && available,
    );
  }

  /** 重連後光靠事件流可能錯過中間狀態，所以每次拿到完整快照都重新對齊一次畫面。 */
  private syncScreensToPhase(): void {
    if (this.connectionState !== "connected") {
      this.startCountdown.hide();
      this.motionPrompt.hidden = true;
      this.motionInput.setGameplayActive(false);
      this.controls.setVisible(false);
      this.teaching.setVisible(false);
      this.gameOver.hide();
      this.waiting.setMessage(
        this.connectionState === "reconnecting"
          ? "重新連線中…"
          : "連線已中斷，正在嘗試重新連線…",
      );
      this.waiting.setVisible(true);
      return;
    }
    this.waiting.clearError();
    if (this.serverPhase !== "WAITING") this.startCountdown.hide();
    this.motionPrompt.hidden =
      this.playerMode !== "motion" ||
      this.myOutcome !== "active" ||
      !["PLAYING", "PAUSED"].includes(this.serverPhase);
    this.motionPrompt.textContent =
      this.serverPhase === "PAUSED"
        ? "遊戲暫停\n請保持靜止，等待主辦方繼續"
        : "感應模式\n請看主辦方畫面，依現場音樂移動";
    if (this.playerMode === "motion") {
      this.motionInput.setGameplayActive(this.serverPhase === "PLAYING");
    }
    switch (this.serverPhase) {
      case "WAITING":
        this.myOutcome = "active";
        this.finalSprintTriggered = false;
        this.hud.resetFinalSprint();
        this.hud.clearOutcomeOverlay();
        this.scene?.resetCollapse();
        this.motionInput.resetSequence();
        this.hud.setVisible(false);
        this.controls.setVisible(false);
        this.gameOver.hide();
        if (this.teachingDismissed) {
          this.teaching.setVisible(false);
          this.waiting.setMessage();
          this.waiting.setVisible(true);
        } else {
          this.waiting.setVisible(false);
          this.teaching.setVisible(true);
        }
        break;
      case "PLAYING":
        this.teaching.setVisible(false);
        this.waiting.setVisible(false);
        this.gameOver.hide();
        this.hud.setVisible(this.playerMode === "main");
        if (this.myOutcome === "active") {
          this.waiting.setVisible(false);
          this.controls.setVisible(true);
        } else {
          this.controls.setVisible(false);
          this.waiting.setMessage(this.personalConclusionMessage());
          this.waiting.setVisible(true);
        }
        break;
      case "PAUSED":
        this.teaching.setVisible(false);
        this.waiting.setVisible(false);
        this.gameOver.hide();
        this.hud.setVisible(this.playerMode === "main");
        if (this.myOutcome === "active") {
          this.waiting.setVisible(false);
          this.controls.setVisible(false);
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

  private async handleTeachingDismissed(): Promise<void> {
    sfx.unlock();
    this.teachingDismissed = true;
    if (this.playerMode === "motion") {
      const available = await this.motionInput.requestPermission();
      this.applyMotionAvailability(available);
      this.syncScreensToPhase();
    }
    if (this.serverPhase === "WAITING") {
      this.teaching.setVisible(false);
      this.waiting.setVisible(true);
    }
  }

  private handleStepPress(foot: Foot): void {
    if (
      this.connectionState !== "connected" ||
      this.serverPhase !== "PLAYING" ||
      this.myOutcome !== "active"
    )
      return;
    sfx.unlock();
    void this.socketClient
      .step({ foot, clientSeq: this.socketClient.getNextPlayerClientSeq() })
      .catch(() => undefined);
  }

  private handleMotionStep(foot: Foot): void {
    this.handleStepPress(foot);
  }

  private handleOwnStepResult(foot: Foot, result: StepResultMsg): void {
    if (this.playerMode === "motion") this.motionInput.reconcileStep(foot);
    const now = this.clock.nowServerMs();
    switch (result.kind) {
      case "rejected-no-alternate":
        this.controls.flashRejected(foot);
        break;
      case "caught":
        this.hud.setScore(result.scoreAfter);
        this.hud.showToast("被發現! -1分", "warn");
        if (this.playerMode === "main") this.hud.showDamageFlash();
        else this.hud.vibrateDamage();
        this.scene?.startCaughtShake(now);
        sfx.play("caught");
        if (result.eliminated) {
          this.myOutcome = "eliminated";
          this.hud.showOutcomeOverlay("eliminated");
          this.scene?.playCollapse(now);
          this.syncScreensToPhase();
        } else {
          this.hud.showHitLock(HIT_LOCKOUT_MS);
        }
        break;
      case "advanced":
        sfx.play("footstep");
        this.scene?.startStepTween(result.distanceAfter, foot, now);
        this.hud.setProgress(result.distanceAfter, this.finishDistanceM);
        this.maybeTriggerFinalSprint(result.distanceAfter);
        if (result.finished) {
          sfx.play("victory");
          this.myOutcome = "finished";
          this.hud.showOutcomeOverlay("finished");
          this.syncScreensToPhase();
        }
        break;
      case "locked":
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
      : "❌ 你已被淘汰，我們懷念你";
  }

  /** 距終點剩 FINAL_SPRINT_REMAINING_M 內時觸發一次緊張提示（對應 PRD 22.3），跟 Phase 1 版本邏輯相同。 */
  private maybeTriggerFinalSprint(distance: number): void {
    if (this.finalSprintTriggered) return;
    const remaining = this.finishDistanceM - distance;
    if (remaining <= 0 || remaining > FINAL_SPRINT_REMAINING_M) return;
    this.finalSprintTriggered = true;
    this.hud.showFinalSprintBanner(`最後 ${Math.ceil(remaining)} 公尺！`);
  }

  private handleGameOver(payload: RoomGameOverPayload): void {
    this.serverPhase = "GAME_OVER";
    this.startCountdown.hide();
    this.motionPrompt.hidden = true;
    this.motionInput.setGameplayActive(false);
    this.controls.setVisible(false);
    this.waiting.setVisible(false);
    const mine = payload.ranking.find((r) => r.playerId === this.playerId);
    const outcome: GameOutcome = mine?.outcome ?? "surviving";
    this.gameOver.showResult(outcome);
  }

  private loop(): void {
    if (this.playersDirty) {
      this.playersDirty = false;
      const players = [...this.players.values()];
      this.scene?.updatePlayers(players, this.playerId);
      this.hud.setPlayers(players);
    }
    if (this.playerMode === "main") {
      const serverNow = this.clock.nowServerMs();
      this.scene?.updateGhostVisual(
        this.ghostReplica.getFacingPlayerAmount(serverNow),
        this.ghostReplica.isLooking(),
      );
      this.scene?.updateAnimations(serverNow);
      this.scene?.render();
    }
    requestAnimationFrame(() => this.loop());
  }

  private refreshPlayers(): void {
    this.playersDirty = true;
  }
}
