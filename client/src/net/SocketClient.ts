import { io, type Socket } from "socket.io-client";
import {
  SOCKET_EVENTS,
  type GhostVisualState,
  type HostCreateRoomAck,
  type HostCreateRoomPayload,
  type HostRoomActionAck,
  type HostRoomActionPayload,
  type PlayerJoinRoomAck,
  type PlayerJoinRoomPayload,
  type PlayerStepAck,
  type PlayerStepPayload,
  type PlayerSummary,
  type RoomClosedPayload,
  type RoomCountdownTickPayload,
  type RoomGameOverPayload,
  type RoomPhaseChangedPayload,
  type RoomPlayerBoostChangedPayload,
  type RoomPlayerConnectionChangedPayload,
  type RoomPlayerSteppedPayload,
  type RoomStateSnapshot,
} from "shared";

const PLAYER_ID_KEY = "123-doll-player-id";
const HOST_ID_KEY = "123-doll-host-id";

function readOrCreatePersistentId(key: string): string {
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem(key, created);
    return created;
  } catch {
    // localStorage 不可用（例如私密瀏覽模式）時退回臨時 id，至少同一次 session 內可用。
    return crypto.randomUUID();
  }
}

export function getPersistentPlayerId(): string {
  return readOrCreatePersistentId(PLAYER_ID_KEY);
}

export function getPersistentHostId(): string {
  return readOrCreatePersistentId(HOST_ID_KEY);
}

/** 對 socket.io-client 的薄封裝，把所有事件名稱／payload 型別收斂到這一份，其餘程式碼不用直接碰字串事件名。 */
export class SocketClient {
  readonly socket: Socket;

  constructor() {
    this.socket = io({ transports: ["websocket"] });
  }

  private emitAck<TPayload, TAck>(event: string, payload: TPayload): Promise<TAck> {
    return new Promise((resolve) => {
      this.socket.emit(event, payload, (ack: TAck) => resolve(ack));
    });
  }

  createRoom(payload: HostCreateRoomPayload): Promise<HostCreateRoomAck> {
    return this.emitAck(SOCKET_EVENTS.hostCreateRoom, payload);
  }
  startGame(payload: HostRoomActionPayload): Promise<HostRoomActionAck> {
    return this.emitAck(SOCKET_EVENTS.hostStartGame, payload);
  }
  pauseGame(payload: HostRoomActionPayload): Promise<HostRoomActionAck> {
    return this.emitAck(SOCKET_EVENTS.hostPauseGame, payload);
  }
  resumeGame(payload: HostRoomActionPayload): Promise<HostRoomActionAck> {
    return this.emitAck(SOCKET_EVENTS.hostResumeGame, payload);
  }
  endGame(payload: HostRoomActionPayload): Promise<HostRoomActionAck> {
    return this.emitAck(SOCKET_EVENTS.hostEndGame, payload);
  }
  restartGame(payload: HostRoomActionPayload): Promise<HostRoomActionAck> {
    return this.emitAck(SOCKET_EVENTS.hostRestartGame, payload);
  }
  joinRoom(payload: PlayerJoinRoomPayload): Promise<PlayerJoinRoomAck> {
    return this.emitAck(SOCKET_EVENTS.playerJoinRoom, payload);
  }
  step(payload: PlayerStepPayload): Promise<PlayerStepAck> {
    return this.emitAck(SOCKET_EVENTS.playerStep, payload);
  }

  onRoomState(cb: (snapshot: RoomStateSnapshot) => void): void {
    this.socket.on(SOCKET_EVENTS.roomState, cb);
  }
  onPlayerJoined(cb: (payload: { player: PlayerSummary }) => void): void {
    this.socket.on(SOCKET_EVENTS.roomPlayerJoined, cb);
  }
  onPlayerLeft(cb: (payload: { playerId: string }) => void): void {
    this.socket.on(SOCKET_EVENTS.roomPlayerLeft, cb);
  }
  onPhaseChanged(cb: (payload: RoomPhaseChangedPayload) => void): void {
    this.socket.on(SOCKET_EVENTS.roomPhaseChanged, cb);
  }
  onCountdownTick(cb: (payload: RoomCountdownTickPayload) => void): void {
    this.socket.on(SOCKET_EVENTS.roomCountdownTick, cb);
  }
  onGhostStateChanged(cb: (payload: GhostVisualState) => void): void {
    this.socket.on(SOCKET_EVENTS.ghostStateChanged, cb);
  }
  onPlayerStepped(cb: (payload: RoomPlayerSteppedPayload) => void): void {
    this.socket.on(SOCKET_EVENTS.roomPlayerStepped, cb);
  }
  onPlayerConnectionChanged(cb: (payload: RoomPlayerConnectionChangedPayload) => void): void {
    this.socket.on(SOCKET_EVENTS.roomPlayerConnectionChanged, cb);
  }
  onPlayerBoostChanged(cb: (payload: RoomPlayerBoostChangedPayload) => void): void {
    this.socket.on(SOCKET_EVENTS.roomPlayerBoostChanged, cb);
  }
  onGameOver(cb: (payload: RoomGameOverPayload) => void): void {
    this.socket.on(SOCKET_EVENTS.roomGameOver, cb);
  }
  onClosed(cb: (payload: RoomClosedPayload) => void): void {
    this.socket.on(SOCKET_EVENTS.roomClosed, cb);
  }

  disconnect(): void {
    this.socket.disconnect();
  }
}
