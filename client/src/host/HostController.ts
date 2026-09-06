import {
  GhostReplicaAI,
  type GhostVisualState,
  type PlayerSummary,
  type RoomPlayerBoostChangedPayload,
  type RoomPlayerSteppedPayload,
  type RoomStateSnapshot,
} from "shared";
import { getPersistentHostId, SocketClient } from "../net/SocketClient";
import { ClockSync } from "../net/ClockSync";
import { HostScene } from "./HostScene";
import { HostConsolePanel } from "./HostConsolePanel";
import { MusicPlayer, sfx } from "../game/audio";

/** 主辦方主控台的頂層控制器：建立房間、串接 HostScene（鳥瞰 3D）與 HostConsolePanel（側邊欄）。 */
export class HostController {
  private readonly container: HTMLElement;
  private readonly socketClient = new SocketClient();
  private readonly clock = new ClockSync();
  private readonly ghostReplica = new GhostReplicaAI(0);
  private readonly music = new MusicPlayer(() => this.panel?.showMusicPlaybackError());
  private readonly hostId = getPersistentHostId();
  private readonly players = new Map<string, PlayerSummary>();
  /** 上一幀每位玩家的勝負狀態，用來偵測「剛出局／剛抵達」的那一瞬間好放特效。 */
  private readonly lastOutcome = new Map<string, "active" | "eliminated" | "finished">();

  private scene: HostScene | null = null;
  private panel: HostConsolePanel | null = null;
  private roomCode = "";
  private playersDirty = false;
  private currentPhase: RoomStateSnapshot["phase"] = "WAITING";
  private currentGhost: GhostVisualState | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.wireSocketEvents();
    void this.createRoom();
    requestAnimationFrame(() => this.loop());
  }

  private async createRoom(): Promise<void> {
    const ack = await this.socketClient.createRoom({ hostId: this.hostId });
    if (!ack.ok) {
      this.container.innerHTML = `<div style="color:#fff;padding:24px;font-size:18px;">建立房間失敗，請重新整理頁面再試一次。</div>`;
      return;
    }
    this.roomCode = ack.roomCode;
    const viewport = document.createElement("div");
    viewport.className = "host-viewport";
    this.container.appendChild(viewport);
    this.scene = new HostScene(viewport);

    const joinUrl = `${location.origin}/join/${ack.roomCode}`;
    this.panel = new HostConsolePanel(this.container, ack.roomCode, joinUrl, {
      onStart: () => {
        sfx.unlock();
        this.music.primeFromGesture();
        void this.socketClient.startGame(this.actionPayload());
      },
      onPause: () => void this.socketClient.pauseGame(this.actionPayload()),
      onResume: () => {
        sfx.unlock();
        void this.socketClient.resumeGame(this.actionPayload());
      },
      onEnd: () => void this.socketClient.endGame(this.actionPayload()),
      onRestart: () => void this.socketClient.restartGame(this.actionPayload()),
      onMusicRetry: () => {
        sfx.unlock();
        this.panel?.clearMusicPlaybackError();
        this.music.retry();
      },
      onCameraModeChange: (mode) => this.scene?.setCameraMode(mode),
      onCameraDirection: (direction, pressed) => this.scene?.setDirectionPressed(direction, pressed),
      onSettingsChange: (settings) => void this.socketClient.updateSettings({ ...this.actionPayload(), settings }),
    });
    this.scene.onCameraModeChange = (mode) => this.panel?.setActiveCameraMode(mode);

    this.applySnapshot(ack.snapshot);
  }

  private actionPayload(): { roomCode: string; hostId: string } {
    return { roomCode: this.roomCode, hostId: this.hostId };
  }

  private wireSocketEvents(): void {
    this.socketClient.onRoomState((snapshot) => this.applySnapshot(snapshot));

    this.socketClient.onPhaseChanged((payload) => {
      this.clock.updateFromServerNow(payload.serverNowMs);
      this.currentPhase = payload.phase;
      this.panel?.setSettings(payload.settings);
      this.scene?.setFinishDistance(payload.settings.finishDistanceM);
      this.panel?.setPhase(payload.phase);
      this.syncMusic(payload.serverNowMs);
    });

    this.socketClient.onGhostStateChanged((payload) => {
      this.currentGhost = payload;
      this.ghostReplica.applyServerState(payload.state, payload.stateStartedAtMs, payload.stateDurationMs, payload.musicCycle, payload.musicPlaybackRate);
      this.syncMusic(this.clock.nowServerMs());
    });

    this.socketClient.onPlayerStepped((payload) => this.handlePlayerStepped(payload));

    this.socketClient.onPlayerBoostChanged((payload) => this.handlePlayerBoostChanged(payload));

    this.socketClient.onGameOver((payload) => {
      this.currentPhase = "GAME_OVER";
      this.music.stop();
      this.panel?.setPhase("GAME_OVER");
      this.panel?.showRanking(payload.ranking);
    });
  }

  private applySnapshot(snapshot: RoomStateSnapshot): void {
    this.clock.updateFromServerNow(snapshot.serverNowMs);
    this.currentPhase = snapshot.phase;
    this.currentGhost = snapshot.ghost;
    if (snapshot.ghost) {
      this.ghostReplica.applyServerState(snapshot.ghost.state, snapshot.ghost.stateStartedAtMs, snapshot.ghost.stateDurationMs, snapshot.ghost.musicCycle, snapshot.ghost.musicPlaybackRate);
    }

    this.players.clear();
    for (const player of snapshot.players) this.players.set(player.playerId, player);

    this.panel?.setSettings(snapshot.settings);
    this.scene?.setFinishDistance(snapshot.settings.finishDistanceM);
    this.panel?.setPhase(snapshot.phase);
    this.syncMusic(snapshot.serverNowMs);
    this.refreshPlayerViews();
  }

  private syncMusic(serverNowMs: number): void {
    this.music.sync(this.currentGhost, this.currentPhase, serverNowMs);
  }

  /** room:playerStepped 沒有附帶完整快照，直接局部更新那一位玩家，讓鳥瞰畫面上的位置能逐步移動而不是等下一次快照才跳動。 */
  private handlePlayerStepped(payload: RoomPlayerSteppedPayload): void {
    if (payload.result.kind === "caught") sfx.play("caught");
    const existing = this.players.get(payload.playerId);
    if (!existing) return;

    if (payload.result.kind === "advanced") {
      existing.distance = payload.result.distanceAfter;
      existing.finished = payload.result.finished;
      if (payload.result.finished) existing.finishedAtMs = payload.result.finishedAtMs;
    } else if (payload.result.kind === "caught") {
      existing.score = payload.result.scoreAfter;
      existing.eliminated = payload.result.eliminated;
    }

    this.refreshPlayerViews();
  }

  /** room:playerBoostChanged 也沒有附帶完整快照，直接局部更新那一位玩家的加速旗標（PRD 22.2）。 */
  private handlePlayerBoostChanged(payload: RoomPlayerBoostChangedPayload): void {
    const existing = this.players.get(payload.playerId);
    if (!existing) return;
    existing.boosted = payload.boosted || undefined;
    this.refreshPlayerViews();
  }

  /**
   * 統一在這裡 diff 而不是在 handlePlayerStepped()：出局有三條路徑（自己踏步被抓、
   * 斷線寬限期到期、以及重連後才收到的完整快照），全部都會流經玩家清單的更新。
   */
  private syncOutcomeEffects(players: PlayerSummary[]): void {
    const seen = new Set<string>();
    for (const player of players) {
      seen.add(player.playerId);
      const outcome = player.finished ? "finished" : player.eliminated ? "eliminated" : "active";
      const previous = this.lastOutcome.get(player.playerId);
      this.lastOutcome.set(player.playerId, outcome);
      // 第一次見到這位玩家時只記錄狀態不放特效，否則主辦方重新整理頁面會被補放一整批。
      if (previous === undefined || previous === outcome || outcome === "active") continue;
      this.scene?.playOutcomeEffect(player.playerId, outcome);
      this.panel?.flashPlayer(player.playerId, outcome);
    }
    for (const id of [...this.lastOutcome.keys()]) {
      if (!seen.has(id)) this.lastOutcome.delete(id);
    }
  }

  private refreshPlayerViews(): void {
    this.playersDirty = true;
  }

  private loop(): void {
    if (this.scene) {
      // 多人同時踏步時，每幀合併更新一次，避免每個封包都重建整份角色與名單。
      if (this.playersDirty) {
        this.playersDirty = false;
        const players = [...this.players.values()];
        this.panel?.setPlayers(players);
        this.scene.updateAvatars(players);
        // 特效要拿角色在場上的座標，所以一定得排在 updateAvatars() 之後。
        this.syncOutcomeEffects(players);
      }
      const serverNow = this.clock.nowServerMs();
      this.syncMusic(serverNow);
      const isLooking = this.ghostReplica.isLooking();
      this.scene.updateGhostVisual(this.ghostReplica.getFacingPlayerAmount(serverNow), isLooking);
      this.panel?.setGhostState(this.ghostReplica.getState());
      this.scene.render();
      this.panel?.setCameraView(this.scene.camera.position, this.scene.getCameraTarget());
    }
    requestAnimationFrame(() => this.loop());
  }
}
