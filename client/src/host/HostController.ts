import { GhostReplicaAI, type PlayerSummary, type RoomPlayerSteppedPayload, type RoomStateSnapshot } from "shared";
import { getPersistentHostId, SocketClient } from "../net/SocketClient";
import { ClockSync } from "../net/ClockSync";
import { HostScene } from "./HostScene";
import { HostConsolePanel } from "./HostConsolePanel";

/** 主辦方主控台的頂層控制器：建立房間、串接 HostScene（鳥瞰 3D）與 HostConsolePanel（側邊欄）。 */
export class HostController {
  private readonly container: HTMLElement;
  private readonly socketClient = new SocketClient();
  private readonly clock = new ClockSync();
  private readonly ghostReplica = new GhostReplicaAI(0);
  private readonly hostId = getPersistentHostId();
  private readonly players = new Map<string, PlayerSummary>();

  private scene: HostScene | null = null;
  private panel: HostConsolePanel | null = null;
  private roomCode = "";

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
    this.scene = new HostScene(this.container);

    const joinUrl = `${location.origin}/join/${ack.roomCode}`;
    this.panel = new HostConsolePanel(this.container, ack.roomCode, joinUrl, {
      onStart: () => void this.socketClient.startGame(this.actionPayload()),
      onPause: () => void this.socketClient.pauseGame(this.actionPayload()),
      onResume: () => void this.socketClient.resumeGame(this.actionPayload()),
      onEnd: () => void this.socketClient.endGame(this.actionPayload()),
      onRestart: () => void this.socketClient.restartGame(this.actionPayload()),
    });

    this.applySnapshot(ack.snapshot);
  }

  private actionPayload(): { roomCode: string; hostId: string } {
    return { roomCode: this.roomCode, hostId: this.hostId };
  }

  private wireSocketEvents(): void {
    this.socketClient.onRoomState((snapshot) => this.applySnapshot(snapshot));

    this.socketClient.onPhaseChanged((payload) => {
      this.clock.updateFromServerNow(payload.serverNowMs);
      this.panel?.setPhase(payload.phase);
    });

    this.socketClient.onCountdownTick((payload) => this.panel?.setCountdown(payload.value));

    this.socketClient.onGhostStateChanged((payload) => {
      this.ghostReplica.applyServerState(payload.state, payload.stateStartedAtMs, payload.stateDurationMs);
    });

    this.socketClient.onPlayerStepped((payload) => this.handlePlayerStepped(payload));

    this.socketClient.onGameOver((payload) => this.panel?.showRanking(payload.ranking));
  }

  private applySnapshot(snapshot: RoomStateSnapshot): void {
    this.clock.updateFromServerNow(snapshot.serverNowMs);
    if (snapshot.ghost) {
      this.ghostReplica.applyServerState(snapshot.ghost.state, snapshot.ghost.stateStartedAtMs, snapshot.ghost.stateDurationMs);
    }

    this.players.clear();
    for (const player of snapshot.players) this.players.set(player.playerId, player);

    this.panel?.setPhase(snapshot.phase);
    this.refreshPlayerViews();
  }

  /** room:playerStepped 沒有附帶完整快照，直接局部更新那一位玩家，讓鳥瞰畫面上的位置能逐步移動而不是等下一次快照才跳動。 */
  private handlePlayerStepped(payload: RoomPlayerSteppedPayload): void {
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

  private refreshPlayerViews(): void {
    const list = [...this.players.values()];
    this.panel?.setPlayers(list);
    this.scene?.updateAvatars(list);
  }

  private loop(): void {
    if (this.scene) {
      const serverNow = this.clock.nowServerMs();
      const isLooking = this.ghostReplica.isLooking();
      this.scene.updateGhostVisual(this.ghostReplica.getFacingPlayerAmount(serverNow), isLooking);
      this.panel?.setGhostState(this.ghostReplica.getState(), isLooking);
      this.scene.render();
    }
    requestAnimationFrame(() => this.loop());
  }
}
