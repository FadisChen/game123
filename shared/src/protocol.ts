import type { RoomSettings } from "./config";
import type { Foot } from "./Player";
import type { GhostState } from "./GhostAI";
import type { RankedPlayer } from "./ranking";

export type RoomCode = string;
export type PlayerId = string;
export type HostId = string;

export type RoomPhase = "WAITING" | "PLAYING" | "PAUSED" | "GAME_OVER";

/** host：主辦方手動暫停；host-disconnected：主控台（音樂來源）斷線，伺服器自動暫停。 */
export type PausedReason = "host" | "host-disconnected";

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
  /** 這段 LOOK_AWAY 從音檔哪個位置開始播（音檔原速 ms）；fake-out 假動作後接續播放用。 */
  musicOffsetMs: number;
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
  /** 只在 PAUSED 時有值。 */
  pausedReason?: PausedReason;
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
  | { kind: "locked"; remainingMs: number }
  /** 鬼剛開始審視的判定寬容期內踩的腳：不前進、不扣分。 */
  | { kind: "ignored" };

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
  pausedReason?: PausedReason;
}

export interface RoomStartCountdownPayload {
  serverNowMs: number;
  durationMs: number;
}

/** 一位玩家在上一個 tick 內的最新進度。踩腳者自己的結果走 player:step 的 ack，不等這個批次。 */
export interface PlayerProgressUpdate {
  playerId: PlayerId;
  distance: number;
  score: number;
  eliminated: boolean;
  finished: boolean;
  finishedAtMs?: number;
  /** 這個 tick 內被抓到幾次（0 就省略），主控台用來放特效與跑馬燈。 */
  caught?: number;
}

/**
 * 伺服器每個 tick（SERVER_TICK_MS）合併一次所有玩家的進度再廣播，取代每踩一步就廣播給全房間。
 * 感應模式的手機不畫其他玩家，這個事件只送給主控台。
 */
export interface RoomPlayersProgressPayload {
  updates: PlayerProgressUpdate[];
}

export type TimeSyncPayload = Record<string, never>;
export interface TimeSyncAck {
  serverNowMs: number;
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
  timeSync: "time:sync",

  roomState: "room:state",
  roomStartCountdown: "room:startCountdown",
  roomPlayerLeft: "room:playerLeft",
  roomPhaseChanged: "room:phaseChanged",
  ghostStateChanged: "ghost:stateChanged",
  roomPlayersProgress: "room:playersProgress",
  roomPlayerConnectionChanged: "room:playerConnectionChanged",
  roomPlayerBoostChanged: "room:playerBoostChanged",
  roomGameOver: "room:gameOver",
  roomClosed: "room:closed",
} as const;
