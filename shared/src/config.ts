// 遊戲可調參數（對應 PRD 第 20 章）。前後端共用同一份，避免權威判定跟顯示動畫用到不同數值。

export type PlayerMode = "main" | "motion";

/** 主辦方在 WAITING 階段可以決定的每場設定。 */
export interface RoomSettings {
  maxScore: number;
  playerMode: PlayerMode;
  finishDistanceM: number;
}

export const SCORE_OPTIONS = [1, 2, 3] as const;
export const PLAYER_MODE_OPTIONS = [
  "main",
  "motion",
] as const satisfies readonly PlayerMode[];
export const FINISH_DISTANCE_M = 30;
export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  maxScore: 3,
  playerMode: "main",
  finishDistanceM: FINISH_DISTANCE_M,
};

/** 主辦方送來的設定不可信（可能來自竄改過的 client），超出允許範圍一律退回預設值。 */
export function normalizeRoomSettings(input: unknown): RoomSettings {
  const raw = (input ?? {}) as Partial<RoomSettings>;
  const distance =
    typeof raw.finishDistanceM === "number"
      ? Math.round(raw.finishDistanceM * 10) / 10
      : NaN;
  return {
    maxScore:
      SCORE_OPTIONS.find((option) => option === raw.maxScore) ??
      DEFAULT_ROOM_SETTINGS.maxScore,
    playerMode:
      PLAYER_MODE_OPTIONS.find((option) => option === raw.playerMode) ??
      DEFAULT_ROOM_SETTINGS.playerMode,
    finishDistanceM:
      Number.isFinite(distance) && distance >= 0.1
        ? distance
        : FINISH_DISTANCE_M,
  };
}

export const INITIAL_SCORE = DEFAULT_ROOM_SETTINGS.maxScore;
export const STEP_DISTANCE_M = 0.32;
export const STEP_TWEEN_MS = 180;
export const CAUGHT_TOAST_MS = 1000;
export const FOOT_BUTTON_LOCKOUT_MS = 120;

// 音樂節奏：音檔為 44.1kHz、184 frames，實際長度約 4.807 秒。
export const MUSIC_TRACK_DURATION_MS = 4807;
export const MUSIC_INITIAL_PLAYBACK_RATE = 1;
export const MUSIC_PLAYBACK_RATE_STEP = 0.1;
export const MUSIC_MAX_PLAYBACK_RATE = 2;
export const MUSIC_LOOKING_MIN_MS = 3000;
export const MUSIC_LOOKING_MAX_MS = 6000;
export const GHOST_TURN_DURATION_MS = 260;

export function musicPlaybackRate(cycle: number): number {
  const steppedRate =
    MUSIC_INITIAL_PLAYBACK_RATE + Math.max(0, cycle) * MUSIC_PLAYBACK_RATE_STEP;
  return Math.min(Math.round(steppedRate * 10) / 10, MUSIC_MAX_PLAYBACK_RATE);
}

export function musicPhaseDurationMs(cycle: number): number {
  return Math.round(MUSIC_TRACK_DURATION_MS / musicPlaybackRate(cycle));
}

// 最後衝刺（PRD 22.3）：距終點剩這個距離內顯示緊張提示與警示暈影
export const FINAL_SPRINT_REMAINING_M = 10;

// 隨機加速（PRD 22.2）：每位玩家每隔一段時間有機率進入短暫加速窗口
export const SPEED_BOOST_CHECK_INTERVAL_MS = 8000;
export const SPEED_BOOST_CHANCE = 0.2;
export const SPEED_BOOST_DURATION_MS = 4000;
export const SPEED_BOOST_MULTIPLIER = 1.5;

// 中槍後的「聖人模式」保護期：這段時間內不可前進、也不會再被扣血
export const HIT_LOCKOUT_MS = 3000;

// Phase 2：多人連線相關參數
export const MAX_GAME_DURATION_MS = 4 * 60_000; // PRD 23.6 建議 3~5 分鐘
export const RECONNECT_GRACE_MS = 30_000; // PRD 第 19 章
export const SERVER_TICK_MS = 100;
export const MAX_PLAYERS_PER_ROOM = 100;
export const ROOM_CODE_LENGTH = 4;
export const STEP_RATE_LIMIT_WINDOW_MS = 1000;
export const MAX_STEP_EVENTS_PER_WINDOW = 10;
export const START_COUNTDOWN_MS = 3000;

// 色票（對應使用者提供的美術參考圖）
export const COLORS = {
  playerGreen: 0x118a65,
  dollOrange: 0xf4a261,
  guardMagenta: 0xe639e6,
  fieldYellow: 0xfdd835,
  alertRed: 0xf94144,
  ink: 0x333333,
  paper: 0xf2f2f2,
  skyBlue: 0x8ecae6,
  pathTan: 0xc9a06a,
  trunkBrown: 0x6b4a33,
  finishPink: 0xe8447a,
  startWhite: 0xf2f2f2,
  dollSkin: 0xffd9b3,
  dollHair: 0x3a2a1e,
} as const;

// 玩家在主辦方鳥瞰畫面上的車道顏色變體（PRD 9 章色彩參考／角色顏色變體）
export const PLAYER_LANE_COLORS = [
  0x118a65, 0x2f6fed, 0x8a4fd6, 0xfdd835, 0xf4a261, 0xe639e6,
] as const;
