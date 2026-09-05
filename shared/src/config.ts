// 遊戲可調參數（對應 PRD 第 20 章）。前後端共用同一份，避免權威判定跟顯示動畫用到不同數值。

/** 主辦方每一場可挑的難度檔位。 */
export type DifficultyLevel = "easy" | "normal" | "hard";

/**
 * 一組難度對應的權威判定數值。刻意只收「純伺服器端」會用到的參數：
 * client 端一律吃伺服器廣播的結果（distanceAfter／stateDurationMs），
 * 所以難度能 per-room 變動，不必把數值傳穿整個渲染鏈。
 * 賽道長度 FINISH_DISTANCE_M 不分難度（client 端大量硬引用），改用步距長短調節路程。
 */
export interface DifficultyProfile {
  ghostLookAwayMinMs: number;
  ghostLookAwayMaxMs: number;
  ghostLookingDurationMs: number;
  ghostTurnDurationMs: number;
  fakeTurnChance: number;
  stepDistanceM: number;
  speedBoostChance: number;
}

/**
 * 三檔全部比初版更緊：能動的時間更短、罰站更久、轉頭反應窗口更窄、路更長、加速更少。
 * 連 easy 都刻意比初版難一級（初版：背對 5~10s、盯 1.8s、轉頭 400ms、步距 0.4m、加速 30%）。
 */
export const DIFFICULTY_PROFILES: Record<DifficultyLevel, DifficultyProfile> = {
  easy: {
    ghostLookAwayMinMs: 4000, ghostLookAwayMaxMs: 8000, ghostLookingDurationMs: 2200,
    ghostTurnDurationMs: 350, fakeTurnChance: 0.4, stepDistanceM: 0.4, speedBoostChance: 0.3,
  },
  normal: {
    ghostLookAwayMinMs: 3000, ghostLookAwayMaxMs: 6000, ghostLookingDurationMs: 2800,
    ghostTurnDurationMs: 260, fakeTurnChance: 0.5, stepDistanceM: 0.32, speedBoostChance: 0.2,
  },
  hard: {
    ghostLookAwayMinMs: 2000, ghostLookAwayMaxMs: 4000, ghostLookingDurationMs: 3500,
    ghostTurnDurationMs: 180, fakeTurnChance: 0.6, stepDistanceM: 0.25, speedBoostChance: 0.1,
  },
};

/** 假動作的整段時長＝該難度轉頭時間的兩倍（轉過去再轉回來）。 */
export function fakeTurnDurationMs(profile: DifficultyProfile): number {
  return profile.ghostTurnDurationMs * 2;
}

/** 主辦方在 WAITING 階段可以決定的每場設定。 */
export interface RoomSettings {
  maxScore: number;
  difficulty: DifficultyLevel;
}

export const SCORE_OPTIONS = [1, 2, 3] as const;
export const DIFFICULTY_OPTIONS: DifficultyLevel[] = ["easy", "normal", "hard"];
export const DEFAULT_ROOM_SETTINGS: RoomSettings = { maxScore: 3, difficulty: "normal" };

/** 主辦方送來的設定不可信（可能來自竄改過的 client），超出允許範圍一律退回預設值。 */
export function normalizeRoomSettings(input: unknown): RoomSettings {
  const raw = (input ?? {}) as Partial<RoomSettings>;
  return {
    maxScore: SCORE_OPTIONS.find((option) => option === raw.maxScore) ?? DEFAULT_ROOM_SETTINGS.maxScore,
    difficulty: DIFFICULTY_OPTIONS.find((option) => option === raw.difficulty) ?? DEFAULT_ROOM_SETTINGS.difficulty,
  };
}

/**
 * 預設難度的數值別名。單機離線版（?offline=1 的 GameController）與單元測試沿用這一組，
 * 調整上面的難度表時會自動跟著走，不會出現兩份各自漂移的數值。
 */
const DEFAULT_PROFILE = DIFFICULTY_PROFILES[DEFAULT_ROOM_SETTINGS.difficulty];

export const INITIAL_SCORE = DEFAULT_ROOM_SETTINGS.maxScore;
export const GHOST_LOOK_AWAY_MIN_MS = DEFAULT_PROFILE.ghostLookAwayMinMs;
export const GHOST_LOOK_AWAY_MAX_MS = DEFAULT_PROFILE.ghostLookAwayMaxMs;
export const GHOST_LOOKING_DURATION_MS = DEFAULT_PROFILE.ghostLookingDurationMs;
export const GHOST_TURN_DURATION_MS = DEFAULT_PROFILE.ghostTurnDurationMs;
export const STEP_DISTANCE_M = DEFAULT_PROFILE.stepDistanceM;
export const FINISH_DISTANCE_M = 30;
export const COUNTDOWN_SECONDS = 3;
export const STEP_TWEEN_MS = 180;
export const CAUGHT_TOAST_MS = 1000;
export const FOOT_BUTTON_LOCKOUT_MS = 120;

// 鬼的假動作（PRD 22.1）：偶爾只轉一半就轉回去，製造心理壓力但不判定違規
export const FAKE_TURN_CHANCE = DEFAULT_PROFILE.fakeTurnChance;
export const FAKE_TURN_PEAK = 0.4;
export const FAKE_TURN_DURATION_MS = fakeTurnDurationMs(DEFAULT_PROFILE);

// 最後衝刺（PRD 22.3）：距終點剩這個距離內顯示緊張提示與警示暈影
export const FINAL_SPRINT_REMAINING_M = 10;

// 隨機加速（PRD 22.2）：每位玩家每隔一段時間有機率進入短暫加速窗口
export const SPEED_BOOST_CHECK_INTERVAL_MS = 8000;
export const SPEED_BOOST_CHANCE = DEFAULT_PROFILE.speedBoostChance;
export const SPEED_BOOST_DURATION_MS = 4000;
export const SPEED_BOOST_MULTIPLIER = 1.5;

// Phase 2：多人連線相關參數
export const MAX_GAME_DURATION_MS = 4 * 60_000; // PRD 23.6 建議 3~5 分鐘
export const RECONNECT_GRACE_MS = 30_000; // PRD 第 19 章
export const SERVER_TICK_MS = 100;
export const MAX_PLAYERS_PER_ROOM = 100;
export const ROOM_CODE_LENGTH = 4;

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
export const PLAYER_LANE_COLORS = [0x118a65, 0x2f6fed, 0x8a4fd6, 0xfdd835, 0xf4a261, 0xe639e6] as const;
