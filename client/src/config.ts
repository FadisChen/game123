// 遊戲可調參數（對應 PRD 第 20 章）
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
