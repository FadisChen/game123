import { io, type Socket } from "socket.io-client";
import {
  SOCKET_EVENTS,
  type ConnectionState,
  type GhostVisualState,
  type HostCreateRoomAck,
  type HostCreateRoomPayload,
  type HostResumeRoomAck,
  type HostResumeRoomPayload,
  type HostRoomActionAck,
  type HostRoomActionPayload,
  type HostUpdateSettingsPayload,
  type PlayerJoinRoomAck,
  type PlayerJoinRoomPayload,
  type PlayerResumeRoomAck,
  type PlayerResumeRoomPayload,
  type PlayerStepAck,
  type PlayerStepPayload,
  type PlayerSummary,
  type RoomClosedPayload,
  type RoomGameOverPayload,
  type RoomPhaseChangedPayload,
  type RoomPlayerBoostChangedPayload,
  type RoomPlayerConnectionChangedPayload,
  type RoomPlayerSteppedPayload,
  type RoomStartCountdownPayload,
  type RoomStateSnapshot,
} from "shared";

const PLAYER_SESSION_KEY = "123-doll-player-session";
const HOST_SESSION_KEY = "123-doll-host-session";
const REQUEST_TIMEOUT_MS = 5000;

export interface PlayerSession {
  roomCode: string;
  playerId: string;
  sessionToken: string;
  name: string;
  nextClientSeq: number;
}

export interface HostSession {
  roomCode: string;
  sessionToken: string;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage 不可用時仍可在目前頁面的 socket 生命週期內運作。
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export function getStoredPlayerSession(roomCode?: string): PlayerSession | null {
  const session = readJson<PlayerSession>(PLAYER_SESSION_KEY);
  if (
    !session ||
    !isNonEmptyString(session.roomCode) ||
    !isNonEmptyString(session.playerId) ||
    !isNonEmptyString(session.sessionToken) ||
    !isNonEmptyString(session.name) ||
    !Number.isSafeInteger(session.nextClientSeq) ||
    session.nextClientSeq < 0 ||
    (roomCode && session.roomCode.toUpperCase() !== roomCode.toUpperCase())
  ) {
    return null;
  }
  return session;
}

export function savePlayerSession(session: PlayerSession): void {
  writeJson(PLAYER_SESSION_KEY, session);
}

export function clearPlayerSession(): void {
  try {
    localStorage.removeItem(PLAYER_SESSION_KEY);
  } catch {
    // Ignore unavailable localStorage.
  }
}

export function getStoredHostSession(): HostSession | null {
  const session = readJson<HostSession>(HOST_SESSION_KEY);
  if (!session || !isNonEmptyString(session.roomCode) || !isNonEmptyString(session.sessionToken)) return null;
  return session;
}

export function saveHostSession(session: HostSession): void {
  writeJson(HOST_SESSION_KEY, session);
}

export function clearHostSession(): void {
  try {
    localStorage.removeItem(HOST_SESSION_KEY);
  } catch {
    // Ignore unavailable localStorage.
  }
}

/** 封裝 Socket.IO、session capability token、連線狀態與所有事件型別。 */
export class SocketClient {
  readonly socket: Socket;
  private playerSession: PlayerSession | null = null;
  private hostSession: HostSession | null = null;
  private connectionState: ConnectionState = "connecting";
  private readonly connectionStateListeners = new Set<(state: ConnectionState) => void>();
  private readonly reconnectListeners = new Set<() => void | Promise<void>>();

  constructor() {
    // 不限制 transport：先使用 polling，再由 Socket.IO 自動升級 WebSocket。
    this.socket = io({ upgrade: true });
    this.socket.on("connect", () => this.setConnectionState("connected"));
    this.socket.on("disconnect", () => this.setConnectionState("disconnected"));
    this.socket.on("connect_error", () => this.setConnectionState("reconnecting"));
    this.socket.io.on("reconnect_attempt", () => this.setConnectionState("reconnecting"));
    this.socket.io.on("reconnect_error", () => this.setConnectionState("reconnecting"));
    this.socket.io.on("reconnect", () => {
      // transport 已恢復，但 room session 尚未 resume 完成；控制器在收到 resume ack 後才恢復操作。
      this.setConnectionState("reconnecting");
      for (const listener of this.reconnectListeners) void listener();
    });
  }

  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state;
    for (const listener of this.connectionStateListeners) listener(state);
  }

  onConnectionState(cb: (state: ConnectionState) => void): void {
    this.connectionStateListeners.add(cb);
    cb(this.connectionState);
  }

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  onReconnect(cb: () => void | Promise<void>): void {
    this.reconnectListeners.add(cb);
  }

  setPlayerSession(session: PlayerSession): void {
    this.playerSession = { ...session };
    savePlayerSession(this.playerSession);
  }

  setHostSession(session: HostSession): void {
    this.hostSession = { ...session };
    saveHostSession(this.hostSession);
  }

  getNextPlayerClientSeq(): number {
    if (!this.playerSession) return 0;
    const seq = this.playerSession.nextClientSeq;
    this.playerSession.nextClientSeq += 1;
    savePlayerSession(this.playerSession);
    return seq;
  }

  resumeHostRoom(): Promise<HostResumeRoomAck> {
    if (!this.hostSession) return Promise.resolve({ ok: false, error: "SESSION_INVALID" });
    return this.resumeHost({ roomCode: this.hostSession.roomCode, sessionToken: this.hostSession.sessionToken });
  }

  resumePlayerRoom(): Promise<PlayerResumeRoomAck> {
    if (!this.playerSession) return Promise.resolve({ ok: false, error: "SESSION_INVALID" });
    return this.resumePlayer({
      roomCode: this.playerSession.roomCode,
      playerId: this.playerSession.playerId,
      sessionToken: this.playerSession.sessionToken,
    });
  }

  private emitAck<TPayload, TAck>(event: string, payload: TPayload): Promise<TAck> {
    return new Promise((resolve, reject) => {
      this.socket.timeout(REQUEST_TIMEOUT_MS).emit(event, payload, (error: Error | null, ack: TAck) => {
        if (error) reject(error);
        else resolve(ack);
      });
    });
  }

  createRoom(payload: HostCreateRoomPayload): Promise<HostCreateRoomAck> {
    return this.emitAck(SOCKET_EVENTS.hostCreateRoom, payload);
  }
  resumeHost(payload: HostResumeRoomPayload): Promise<HostResumeRoomAck> {
    return this.emitAck(SOCKET_EVENTS.hostResumeRoom, payload);
  }
  startCountdown(payload: HostRoomActionPayload): Promise<HostRoomActionAck> {
    return this.emitAck(SOCKET_EVENTS.hostStartCountdown, payload);
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
  updateSettings(payload: HostUpdateSettingsPayload): Promise<HostRoomActionAck> {
    return this.emitAck(SOCKET_EVENTS.hostUpdateSettings, payload);
  }
  joinRoom(payload: PlayerJoinRoomPayload): Promise<PlayerJoinRoomAck> {
    return this.emitAck(SOCKET_EVENTS.playerJoinRoom, payload);
  }
  resumePlayer(payload: PlayerResumeRoomPayload): Promise<PlayerResumeRoomAck> {
    return this.emitAck(SOCKET_EVENTS.playerResumeRoom, payload);
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
  onStartCountdown(cb: (payload: RoomStartCountdownPayload) => void): void {
    this.socket.on(SOCKET_EVENTS.roomStartCountdown, cb);
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
