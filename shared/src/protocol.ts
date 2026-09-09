import type { RoomSettings } from "./config";
import type { Foot } from "./Player";
import type { GhostState } from "./GhostAI";
import type { RankedPlayer } from "./ranking";

export type RoomCode = string;
export type PlayerId = string;
export type HostId = string;

export type RoomPhase = "WAITING" | "PLAYING" | "PAUSED" | "GAME_OVER";

export type JoinErrorCode =
  | "ROOM_NOT_FOUND"
  | "NAME_TAKEN"
  | "NAME_INVALID"
  | "GAME_ALREADY_STARTED"
  | "ROOM_FULL"
  | "SESSION_INVALID"
  | "INVALID_PAYLOAD"
  | "RATE_LIMITED";

export type ResumeErrorCode = "ROOM_NOT_FOUND" | "SESSION_INVALID";
export type StepErrorCode =
  | "NOT_YOUR_TURN"
  | "ROOM_NOT_PLAYING"
  | "UNKNOWN_PLAYER"
  | "NOT_AUTHENTICATED"
  | "RATE_LIMITED"
  | "DUPLICATE_STEP"
  | "INVALID_PAYLOAD";

export type ConnectionState =
  "connecting" | "connected" | "reconnecting" | "disconnected";

export type GameOverReason =
  "all-finished" | "all-eliminated" | "time-limit" | "host-ended";

export interface PlayerSummary {
  playerId: PlayerId;
  name: string;
  score: number;
  distance: number;
  eliminated: boolean;
  finished: boolean;
  finishedAtMs?: number;
  connected: boolean;
  /** 斷線寬限期過後仍未重連，標記為淘汰但顯示為「離線」而非「被抓」（見 PRD 19 章的預設判斷）。 */
  disconnectedPermanently?: boolean;
  /** 目前是否處於隨機加速窗口（PRD 22.2）。 */
  boosted?: boolean;
}

export interface GhostVisualState {
  state: GhostState;
  /** 伺服器時間戳（ms），配合 client 端 ClockSync 的 nowServerMs() 使用。 */
  stateStartedAtMs: number;
  stateDurationMs: number;
  /** 目前音樂循環的序號與播放速度；客戶端只用來同步音檔，不能反過來驅動伺服器。 */
  musicCycle: number;
  musicPlaybackRate: number;
}

export interface RoomStateSnapshot {
  roomCode: RoomCode;
  phase: RoomPhase;
  players: PlayerSummary[];
  ghost: GhostVisualState | null;
  serverNowMs: number;
  roundStartedAtMs?: number;
  roundDeadlineMs?: number;
  /** 主辦方為這一場設定的血量與玩家玩法。 */
  settings: RoomSettings;
}

export type StepResultMsg =
  | { kind: "rejected-no-alternate" }
  | { kind: "caught"; scoreAfter: number; eliminated: boolean }
  | {
      kind: "advanced";
      distanceAfter: number;
      finished: boolean;
      finishedAtMs?: number;
    }
  | { kind: "locked"; remainingMs: number };

// ---------- Client -> Server（皆用 ack 回覆） ----------

export type HostCreateRoomPayload = Record<string, never>;
export type HostCreateRoomAck =
  | {
      ok: true;
      roomCode: RoomCode;
      hostSessionToken: string;
      snapshot: RoomStateSnapshot;
    }
  | { ok: false; error: string };

export interface HostResumeRoomPayload {
  roomCode: RoomCode;
  sessionToken: string;
}
export type HostResumeRoomAck =
  | {
      ok: true;
      roomCode: RoomCode;
      sessionToken: string;
      snapshot: RoomStateSnapshot;
    }
  | { ok: false; error: ResumeErrorCode };

export type HostRoomActionPayload = Record<string, never>;
export type HostRoomActionAck = { ok: true } | { ok: false; error: string };

export interface HostUpdateSettingsPayload {
  settings: RoomSettings;
}

export interface PlayerJoinRoomPayload {
  roomCode: RoomCode;
  name: string;
}
export type PlayerJoinRoomAck =
  | {
      ok: true;
      playerId: PlayerId;
      playerSessionToken: string;
      snapshot: RoomStateSnapshot;
    }
  | { ok: false; error: JoinErrorCode };

export interface PlayerResumeRoomPayload {
  roomCode: RoomCode;
  playerId: PlayerId;
  sessionToken: string;
}
export type PlayerResumeRoomAck =
  | {
      ok: true;
      playerId: PlayerId;
      playerSessionToken: string;
      snapshot: RoomStateSnapshot;
    }
  | { ok: false; error: ResumeErrorCode };

export interface PlayerStepPayload {
  foot: Foot;
  clientSeq: number;
}
export type PlayerStepAck =
  { ok: true; result: StepResultMsg } | { ok: false; error: StepErrorCode };

// ---------- Server -> Room（廣播） ----------

export interface RoomPhaseChangedPayload {
  phase: RoomPhase;
  serverNowMs: number;
  roundStartedAtMs?: number;
  roundDeadlineMs?: number;
  /** 主辦方為這一場設定的血量與玩家玩法。 */
  settings: RoomSettings;
}

export interface RoomStartCountdownPayload {
  serverNowMs: number;
  durationMs: number;
}

export interface RoomPlayerSteppedPayload {
  playerId: PlayerId;
  foot: Foot;
  result: StepResultMsg;
}

export interface RoomPlayerConnectionChangedPayload {
  playerId: PlayerId;
  connected: boolean;
  timedOut?: boolean;
}

export interface RoomGameOverPayload {
  ranking: RankedPlayer[];
  reason: GameOverReason;
}

export interface RoomClosedPayload {
  reason: "host-ended" | "expired";
}

export interface RoomPlayerBoostChangedPayload {
  playerId: PlayerId;
  boosted: boolean;
  untilMs?: number;
}

/** Socket.IO 事件名稱常數，前後端都從這裡引用，避免字串打錯字造成訊息對不上。 */
export const SOCKET_EVENTS = {
  hostCreateRoom: "host:createRoom",
  hostResumeRoom: "host:resumeRoom",
  hostStartCountdown: "host:startCountdown",
  hostStartGame: "host:startGame",
  hostPauseGame: "host:pauseGame",
  hostResumeGame: "host:resumeGame",
  hostEndGame: "host:endGame",
  hostRestartGame: "host:restartGame",
  hostUpdateSettings: "host:updateSettings",
  playerJoinRoom: "player:joinRoom",
  playerResumeRoom: "player:resumeRoom",
  playerStep: "player:step",

  roomState: "room:state",
  roomStartCountdown: "room:startCountdown",
  roomPlayerJoined: "room:playerJoined",
  roomPlayerLeft: "room:playerLeft",
  roomPhaseChanged: "room:phaseChanged",
  ghostStateChanged: "ghost:stateChanged",
  roomPlayerStepped: "room:playerStepped",
  roomPlayerConnectionChanged: "room:playerConnectionChanged",
  roomPlayerBoostChanged: "room:playerBoostChanged",
  roomGameOver: "room:gameOver",
  roomClosed: "room:closed",
} as const;
