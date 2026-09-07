import {
  GhostReplicaAI,
  type ConnectionState,
  type GhostVisualState,
  type PlayerSummary,
  type RoomPlayerBoostChangedPayload,
  type RoomPlayerSteppedPayload,
  type RoomStateSnapshot,
} from "shared";
import {
  clearHostSession,
  getStoredHostSession,
  SocketClient,
} from "../net/SocketClient";
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
  private readonly music = new MusicPlayer(() =>
    this.panel?.showMusicPlaybackError(),
  );
  private readonly players = new Map<string, PlayerSummary>();
  /** 上一幀每位玩家的勝負狀態，用來偵測「剛出局／剛抵達」的那一瞬間好放特效。 */
  private readonly lastOutcome = new Map<
    string,
    "active" | "eliminated" | "finished"
  >();

  private scene: HostScene | null = null;
  private panel: HostConsolePanel | null = null;
  private roomCode = "";
  private playersDirty = false;
  /** 避免開場運鏡＋倒數播放期間被連點「開始遊戲」重複觸發。 */
  private startSequenceActive = false;
  private currentPhase: RoomStateSnapshot["phase"] = "WAITING";
  private currentGhost: GhostVisualState | null = null;
  private connectionState: ConnectionState = "connecting";
  private sessionNotice = "";

  constructor(container: HTMLElement) {
    this.container = container;
    this.wireSocketEvents();
    this.socketClient.onConnectionState((state) => this.setConnectionState(state));
    this.socketClient.onReconnect(() => void this.resumeSession());
    void this.createRoom();
    requestAnimationFrame(() => this.loop());
  }

  private async createRoom(): Promise<void> {
    const storedSession = getStoredHostSession();
    if (storedSession) {
      this.socketClient.setHostSession(storedSession);
      try {
        const resumed = await this.socketClient.resumeHostRoom();
        if (resumed.ok) {
          this.roomCode = resumed.roomCode;
          this.setupRoom(resumed.snapshot);
          return;
        }
        clearHostSession();
        this.sessionNotice = "房間已失效，請重新建立房間";
      } catch {
        this.sessionNotice = "無法恢復房間，正在建立新房間…";
      }
    }

    const ack = await this.socketClient.createRoom({});
    if (!ack.ok) {
      this.container.innerHTML = `<div style="color:#fff;padding:24px;font-size:18px;">建立房間失敗，請重新整理頁面再試一次。</div>`;
      return;
    }
    this.roomCode = ack.roomCode;
    this.socketClient.setHostSession({ roomCode: ack.roomCode, sessionToken: ack.hostSessionToken });
    this.setupRoom(ack.snapshot);
  }

  private setupRoom(snapshot: RoomStateSnapshot): void {
    const viewport = document.createElement("div");
    viewport.className = "host-viewport";
    this.container.replaceChildren();
    if (this.sessionNotice) {
      const notice = document.createElement("p");
      notice.textContent = this.sessionNotice;
      notice.style.cssText = "color:#f4a261;padding:12px 24px;margin:0;";
      this.container.appendChild(notice);
      this.sessionNotice = "";
    }
    this.container.appendChild(viewport);
    this.scene = new HostScene(viewport);

    const joinUrl = `${location.origin}/join/${this.roomCode}`;
    this.panel = new HostConsolePanel(this.container, this.roomCode, joinUrl, {
      onStart: () => {
        if (this.startSequenceActive) return;
        this.startSequenceActive = true;
        sfx.unlock();
        this.music.primeFromGesture();
        this.panel?.setStarting(true);
        // 主辦方鏡頭先推進、環繞玩家一圈、回到鳥瞰機位，再全螢幕倒數 3 秒，最後才真正呼叫 startGame。
        this.scene?.playStartCinematic(() => {
          void this.socketClient
            .startCountdown(this.actionPayload())
            .then((ack) => {
              if (ack.ok) return;
              this.startSequenceActive = false;
              this.panel?.setStarting(false);
              this.panel?.showConnectionError(`控制操作失敗：${ack.error}`);
            })
            .catch(() => {
              this.startSequenceActive = false;
              this.panel?.setStarting(false);
              this.panel?.showConnectionError("連線逾時，請稍候再試");
            });
        });
      },
      onPause: () => this.runAction(this.socketClient.pauseGame(this.actionPayload())),
      onResume: () => {
        sfx.unlock();
        this.runAction(this.socketClient.resumeGame(this.actionPayload()));
      },
      onEnd: () => this.runAction(this.socketClient.endGame(this.actionPayload())),
      onRestart: () => this.runAction(this.socketClient.restartGame(this.actionPayload())),
      onMusicRetry: () => {
        sfx.unlock();
        this.panel?.clearMusicPlaybackError();
        this.music.retry();
      },
      onCameraModeChange: (mode) => this.scene?.setCameraMode(mode),
      onCameraDirection: (direction, pressed) =>
        this.scene?.setDirectionPressed(direction, pressed),
      onSettingsChange: (settings) =>
        this.runAction(this.socketClient.updateSettings({ settings })),
    });
    this.scene.onCameraModeChange = (mode) =>
      this.panel?.setActiveCameraMode(mode);

    this.applySnapshot(snapshot);
    this.panel.setConnectionState(this.connectionState);
  }

  private actionPayload(): Record<string, never> {
    return {};
  }

  private runAction(request: Promise<{ ok: true } | { ok: false; error: string }>): void {
    void request
      .then((ack) => {
        if (!ack.ok) this.panel?.showConnectionError(`控制操作失敗：${ack.error}`);
      })
      .catch(() => this.panel?.showConnectionError("連線逾時，請稍候再試"));
  }

  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state;
    this.panel?.setConnectionState(state);
  }

  private async resumeSession(): Promise<void> {
    try {
      const ack = await this.socketClient.resumeHostRoom();
      if (!ack.ok) {
        clearHostSession();
        this.panel?.showConnectionError("房間已失效，請重新建立房間");
        return;
      }
      this.setConnectionState("connected");
      this.applySnapshot(ack.snapshot);
    } catch {
      this.panel?.showConnectionError("連線逾時，正在等待重新連線…");
    }
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

    this.socketClient.onStartCountdown((payload) => {
      this.clock.updateFromServerNow(payload.serverNowMs);
      this.panel?.playCountdown(
        payload.serverNowMs,
        payload.durationMs,
        () => this.clock.nowServerMs(),
        () => {
          this.startSequenceActive = false;
          this.panel?.setStarting(false);
          this.runAction(this.socketClient.startGame(this.actionPayload()));
        },
      );
    });

    this.socketClient.onGhostStateChanged((payload) => {
      this.currentGhost = payload;
      this.ghostReplica.applyServerState(
        payload.state,
        payload.stateStartedAtMs,
        payload.stateDurationMs,
        payload.musicCycle,
        payload.musicPlaybackRate,
      );
      this.syncMusic(this.clock.nowServerMs());
    });

    this.socketClient.onPlayerStepped((payload) =>
      this.handlePlayerStepped(payload),
    );

    this.socketClient.onPlayerBoostChanged((payload) =>
      this.handlePlayerBoostChanged(payload),
    );

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
      this.ghostReplica.applyServerState(
        snapshot.ghost.state,
        snapshot.ghost.stateStartedAtMs,
        snapshot.ghost.stateDurationMs,
        snapshot.ghost.musicCycle,
        snapshot.ghost.musicPlaybackRate,
      );
    }

    this.players.clear();
    for (const player of snapshot.players)
      this.players.set(player.playerId, player);

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
    if (payload.result.kind === "caught") {
      sfx.play("caught");
      this.scene?.playDamageEffect(payload.playerId);
    }
    const existing = this.players.get(payload.playerId);
    if (!existing) return;

    if (payload.result.kind === "advanced") {
      existing.distance = payload.result.distanceAfter;
      existing.finished = payload.result.finished;
      if (payload.result.finished)
        existing.finishedAtMs = payload.result.finishedAtMs;
    } else if (payload.result.kind === "caught") {
      existing.score = payload.result.scoreAfter;
      existing.eliminated = payload.result.eliminated;
    }

    this.refreshPlayerViews();
  }

  /** room:playerBoostChanged 也沒有附帶完整快照，直接局部更新那一位玩家的加速旗標（PRD 22.2）。 */
  private handlePlayerBoostChanged(
    payload: RoomPlayerBoostChangedPayload,
  ): void {
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
      const outcome = player.finished
        ? "finished"
        : player.eliminated
          ? "eliminated"
          : "active";
      const previous = this.lastOutcome.get(player.playerId);
      this.lastOutcome.set(player.playerId, outcome);
      // 第一次見到這位玩家時只記錄狀態不放特效，否則主辦方重新整理頁面會被補放一整批。
      if (
        previous === undefined ||
        previous === outcome ||
        outcome === "active"
      )
        continue;
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
      this.scene.updateGhostVisual(
        this.ghostReplica.getFacingPlayerAmount(serverNow),
        isLooking,
      );
      this.panel?.setGhostState(this.ghostReplica.getState());
      this.scene.render();
      this.panel?.setCameraView(
        this.scene.camera.position,
        this.scene.getCameraTarget(),
      );
    }
    requestAnimationFrame(() => this.loop());
  }
}
