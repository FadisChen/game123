// 遊戲可調參數（對應 PRD 第 20 章）。前後端共用同一份，避免權威判定跟顯示動畫用到不同數值。
export const INITIAL_SCORE = 3;
export const GHOST_LOOK_AWAY_MIN_MS = 5000;
export const GHOST_LOOK_AWAY_MAX_MS = 10000;
export const GHOST_LOOKING_DURATION_MS = 1800;
export const GHOST_TURN_DURATION_MS = 400;
export const STEP_DISTANCE_M = 0.4;
export const FINISH_DISTANCE_M = 30;
export const COUNTDOWN_SECONDS = 3;
export const STEP_TWEEN_MS = 180;
export const CAUGHT_TOAST_MS = 1000;
export const FOOT_BUTTON_LOCKOUT_MS = 120;

// 鬼的假動作（PRD 22.1）：偶爾只轉一半就轉回去，製造心理壓力但不判定違規
export const FAKE_TURN_CHANCE = 0.35;
export const FAKE_TURN_PEAK = 0.4;
export const FAKE_TURN_DURATION_MS = GHOST_TURN_DURATION_MS * 2;

// 最後衝刺（PRD 22.3）：距終點剩這個距離內顯示緊張提示與警示暈影
export const FINAL_SPRINT_REMAINING_M = 10;

// 隨機加速（PRD 22.2）：每位玩家每隔一段時間有機率進入短暫加速窗口
export const SPEED_BOOST_CHECK_INTERVAL_MS = 8000;
export const SPEED_BOOST_CHANCE = 0.3;
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
