import * as THREE from "three";

/**
 * 用 Canvas 2D 手繪程序化的「扁平插畫風」貼圖，取代基本幾何體堆疊，
 * 貼近美術參考圖的乾淨向量插畫風格（色塊＋黑色描邊＋簡單陰影）。
 * 這些貼圖會貼在永遠面向攝影機的 THREE.Sprite（billboard）上顯示。
 */

const OUTLINE = "#2b2b2b";
const OUTLINE_WIDTH = 6;

function makeCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  return { canvas, ctx };
}

function textureFromCanvas(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function drawGroundShadow(ctx: CanvasRenderingContext2D, cx: number, y: number, radiusX: number): void {
  const gradient = ctx.createRadialGradient(cx, y, 0, cx, y, radiusX);
  gradient.addColorStop(0, "rgba(0,0,0,0.35)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(cx, y, radiusX, radiusX * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
}

function strokeAndFill(ctx: CanvasRenderingContext2D, fill: string): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = OUTLINE_WIDTH;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
}

/** 鬼娃正面：橘色洋裝＋雙馬尾＋圓臉，眼睛與微笑呼應參考圖 Q 版女孩人偶。 */
export function drawDollFront(dollOrangeHex: string, dollSkinHex: string, dollHairHex: string): THREE.CanvasTexture {
  const W = 200;
  const H = 340;
  const { canvas, ctx } = makeCanvas(W, H);
  const cx = W / 2;

  drawGroundShadow(ctx, cx, H - 18, 70);

  // 洋裝身體
  ctx.beginPath();
  ctx.moveTo(cx - 55, H - 30);
  ctx.quadraticCurveTo(cx - 65, 190, cx - 38, 150);
  ctx.lineTo(cx + 38, 150);
  ctx.quadraticCurveTo(cx + 65, 190, cx + 55, H - 30);
  ctx.closePath();
  strokeAndFill(ctx, dollOrangeHex);

  // 衣服中線
  ctx.beginPath();
  ctx.moveTo(cx, 150);
  ctx.lineTo(cx, H - 30);
  ctx.strokeStyle = "#00000022";
  ctx.lineWidth = 3;
  ctx.stroke();

  // 手臂
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.roundRect(cx + side * 58 - 10, 155, 20, 75, 10);
    strokeAndFill(ctx, dollOrangeHex);
  }

  // 頭
  ctx.beginPath();
  ctx.arc(cx, 95, 62, 0, Math.PI * 2);
  strokeAndFill(ctx, dollSkinHex);

  // 瀏海／頭髮頂
  ctx.beginPath();
  ctx.arc(cx, 80, 64, Math.PI, Math.PI * 2);
  strokeAndFill(ctx, dollHairHex);

  // 雙馬尾
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(cx + side * 66, 100, 26, 0, Math.PI * 2);
    strokeAndFill(ctx, dollHairHex);
  }

  // 眼睛
  ctx.fillStyle = dollHairHex;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(cx + side * 20, 98, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // 微笑
  ctx.beginPath();
  ctx.arc(cx, 110, 14, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.lineWidth = 4;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();

  return textureFromCanvas(canvas);
}

/** 鬼娃背面：只看得到後腦勺雙馬尾與洋裝背面，用於「背對玩家」狀態。 */
export function drawDollBack(dollOrangeHex: string, dollHairHex: string): THREE.CanvasTexture {
  const W = 200;
  const H = 340;
  const { canvas, ctx } = makeCanvas(W, H);
  const cx = W / 2;

  drawGroundShadow(ctx, cx, H - 18, 70);

  ctx.beginPath();
  ctx.moveTo(cx - 55, H - 30);
  ctx.quadraticCurveTo(cx - 65, 190, cx - 38, 150);
  ctx.lineTo(cx + 38, 150);
  ctx.quadraticCurveTo(cx + 65, 190, cx + 55, H - 30);
  ctx.closePath();
  strokeAndFill(ctx, dollOrangeHex);

  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.roundRect(cx + side * 58 - 10, 155, 20, 75, 10);
    strokeAndFill(ctx, dollOrangeHex);
  }

  // 整顆後腦勺都是頭髮（看不到臉）
  ctx.beginPath();
  ctx.arc(cx, 95, 62, 0, Math.PI * 2);
  strokeAndFill(ctx, dollHairHex);

  // 中分髮線
  ctx.beginPath();
  ctx.moveTo(cx, 34);
  ctx.lineTo(cx, 150);
  ctx.strokeStyle = "#00000033";
  ctx.lineWidth = 3;
  ctx.stroke();

  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(cx + side * 66, 100, 26, 0, Math.PI * 2);
    strokeAndFill(ctx, dollHairHex);
  }

  return textureFromCanvas(canvas);
}

/** 枯樹：棕色樹幹＋角度不一的裸枝，貼近參考圖「枯樹」造型。 */
export function drawTree(trunkBrownHex: string): THREE.CanvasTexture {
  const W = 240;
  const H = 320;
  const { canvas, ctx } = makeCanvas(W, H);
  const cx = W / 2;

  drawGroundShadow(ctx, cx, H - 14, 60);

  ctx.beginPath();
  ctx.moveTo(cx - 16, H - 24);
  ctx.lineTo(cx - 10, 110);
  ctx.lineTo(cx + 10, 110);
  ctx.lineTo(cx + 16, H - 24);
  ctx.closePath();
  strokeAndFill(ctx, trunkBrownHex);

  ctx.strokeStyle = trunkBrownHex;
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  const branches = [
    [0, 110, -55, 40],
    [0, 120, -20, 20],
    [0, 115, 15, 15],
    [0, 108, 50, 45],
    [-4, 130, -35, 75],
    [4, 128, 38, 78],
  ];
  for (const [dx, y, tx, ty] of branches) {
    ctx.beginPath();
    ctx.moveTo(cx + dx, y);
    ctx.quadraticCurveTo(cx + dx + tx * 0.5, y - 30, cx + tx, ty);
    ctx.stroke();
  }
  // 描邊補強（避免枝幹看起來太細軟）
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  for (const [dx, y, tx, ty] of branches) {
    ctx.beginPath();
    ctx.moveTo(cx + dx, y);
    ctx.quadraticCurveTo(cx + dx + tx * 0.5, y - 30, cx + tx, ty);
    ctx.stroke();
  }

  return textureFromCanvas(canvas);
}

/** 裝飾用粉紅守衛：純粹背景氛圍，不參與判定。 */
export function drawGuard(guardMagentaHex: string): THREE.CanvasTexture {
  const W = 160;
  const H = 280;
  const { canvas, ctx } = makeCanvas(W, H);
  const cx = W / 2;

  drawGroundShadow(ctx, cx, H - 14, 50);

  ctx.beginPath();
  ctx.roundRect(cx - 42, 90, 84, 150, 24);
  strokeAndFill(ctx, guardMagentaHex);

  ctx.beginPath();
  ctx.arc(cx, 70, 48, 0, Math.PI * 2);
  strokeAndFill(ctx, guardMagentaHex);

  // 兜帽陰影
  ctx.beginPath();
  ctx.arc(cx, 74, 34, Math.PI * 0.15, Math.PI * 0.85);
  ctx.fillStyle = "#00000033";
  ctx.fill();

  // 面罩小孔
  ctx.beginPath();
  ctx.arc(cx, 78, 8, 0, Math.PI * 2);
  ctx.fillStyle = "#1a1a1a";
  ctx.fill();

  return textureFromCanvas(canvas);
}

/** 感測器紅光：LOOKING 判定期間顯示的發光圓點，對齊參考圖「感測器（紅光）」道具。 */
export function drawSensorGlow(alertRedHex: string): THREE.CanvasTexture {
  const size = 128;
  const { canvas, ctx } = makeCanvas(size, size);
  const cx = size / 2;
  const gradient = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.25, alertRedHex);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cx, cx, 0, Math.PI * 2);
  ctx.fill();
  return textureFromCanvas(canvas);
}
