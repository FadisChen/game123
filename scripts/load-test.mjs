#!/usr/bin/env node
/**
 * 壓力測試腳本：模擬一個主辦方 + 多名玩家（預設到 MAX_PLAYERS_PER_ROOM 上限）同時連進同一個房間，
 * 走完開始遊戲→倒數→PLAYING 階段並持續踩腳，量測加入延遲、player:step 往返延遲、
 * 主控台收到廣播的延遲，以及倒數計時的抖動（用來間接觀察伺服器單一 tick 迴圈有沒有被大量連線拖慢）。
 *
 * 用法（先在另一個終端機用 `npm run dev -w server` 或 `npm run start -w server` 啟動伺服器）：
 *   node scripts/load-test.mjs
 *   LOAD_TEST_PLAYERS=150 LOAD_TEST_PLAY_MS=60000 node scripts/load-test.mjs
 */
import { io } from "socket.io-client";
import crypto from "node:crypto";

const SERVER_URL = process.env.LOAD_TEST_SERVER_URL ?? "http://localhost:3001";
const PLAYER_COUNT = Number(process.env.LOAD_TEST_PLAYERS ?? 100);
const PLAY_DURATION_MS = Number(process.env.LOAD_TEST_PLAY_MS ?? 30000);
const STEP_MIN_INTERVAL_MS = 300;
const STEP_MAX_INTERVAL_MS = 900;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function emitAck(socket, event, payload) {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = io(url, { transports: ["websocket"] });
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", reject);
  });
}

function percentile(sorted, p) {
  if (sorted.length === 0) return NaN;
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[idx];
}

function printStats(label, values) {
  if (values.length === 0) {
    console.log(`${label}: 無樣本`);
    return;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  console.log(
    `${label}: n=${values.length} avg=${avg.toFixed(1)}ms p50=${percentile(sorted, 0.5).toFixed(1)}ms ` +
      `p95=${percentile(sorted, 0.95).toFixed(1)}ms p99=${percentile(sorted, 0.99).toFixed(1)}ms max=${sorted[sorted.length - 1].toFixed(1)}ms`,
  );
}

async function main() {
  console.log(`連線到 ${SERVER_URL}，模擬 1 位主辦方 + ${PLAYER_COUNT} 位玩家`);

  const host = await connect(SERVER_URL);
  const hostId = crypto.randomUUID();
  const createAck = await emitAck(host, "host:createRoom", { hostId });
  if (!createAck.ok) throw new Error("建立房間失敗");
  const roomCode = createAck.roomCode;
  console.log("房間代碼:", roomCode);

  const players = [];
  const joinLatencies = [];
  const joinStart = Date.now();
  for (let i = 0; i < PLAYER_COUNT; i++) {
    const socket = await connect(SERVER_URL);
    const playerId = crypto.randomUUID();
    const t0 = performance.now();
    const ack = await emitAck(socket, "player:joinRoom", { roomCode, playerId, name: `P${i}` });
    joinLatencies.push(performance.now() - t0);
    if (!ack.ok) {
      console.error(`玩家 ${i} 加入失敗:`, ack.error);
      socket.disconnect();
      continue;
    }
    players.push({ socket, playerId, stepLatencies: [] });
  }
  console.log(`${players.length}/${PLAYER_COUNT} 位玩家加入完成，耗時 ${Date.now() - joinStart}ms`);
  printStats("加入房間 ack 延遲", joinLatencies);

  // 確認超過人數上限會被正確拒絕（PRD 房間人數上限保護）。
  {
    const overflow = await connect(SERVER_URL);
    const ack = await emitAck(overflow, "player:joinRoom", {
      roomCode,
      playerId: crypto.randomUUID(),
      name: "Overflow",
    });
    console.log("超額玩家加入結果（房間未滿時應為 ok:true，已滿時應為 ROOM_FULL）:", ack.ok ? "ok" : ack.error);
    overflow.disconnect();
    if (ack.ok) players.push({ socket: overflow, playerId: ack.snapshot.players.at(-1).playerId, stepLatencies: [] });
  }

  const countdownTimestamps = [];
  host.on("room:countdownTick", () => countdownTimestamps.push(Date.now()));

  const startAck = await emitAck(host, "host:startGame", { roomCode, hostId });
  console.log("開始遊戲 ack:", startAck);

  await sleep(6000); // 走完倒數，進入 PLAYING

  const deltas = [];
  for (let i = 1; i < countdownTimestamps.length; i++) deltas.push(countdownTimestamps[i] - countdownTimestamps[i - 1]);
  console.log("倒數 tick 間隔（應接近 1000ms，偏差過大代表伺服器 tick 迴圈被塞住）:", deltas.map((d) => Math.round(d)));

  console.log(`開始讓 ${players.length} 位玩家連續踩腳 ${PLAY_DURATION_MS}ms...`);

  const broadcastLatencies = [];
  const pendingBroadcastAt = new Map();
  host.on("room:playerStepped", (payload) => {
    const t0 = pendingBroadcastAt.get(payload.playerId);
    if (t0 !== undefined) {
      broadcastLatencies.push(performance.now() - t0);
      pendingBroadcastAt.delete(payload.playerId);
    }
  });

  let clientSeq = 0;
  const playEnd = Date.now() + PLAY_DURATION_MS;
  const stepLoops = players.map(async (p) => {
    let foot = "left";
    while (Date.now() < playEnd) {
      const t0 = performance.now();
      pendingBroadcastAt.set(p.playerId, t0);
      await emitAck(p.socket, "player:step", { roomCode, playerId: p.playerId, foot, clientSeq: clientSeq++ });
      p.stepLatencies.push(performance.now() - t0);
      foot = foot === "left" ? "right" : "left";
      await sleep(STEP_MIN_INTERVAL_MS + Math.random() * (STEP_MAX_INTERVAL_MS - STEP_MIN_INTERVAL_MS));
    }
  });
  await Promise.all(stepLoops);

  printStats(
    "player:step ack 延遲",
    players.flatMap((p) => p.stepLatencies),
  );
  printStats("room:playerStepped 廣播到主控台的延遲", broadcastLatencies);

  await emitAck(host, "host:endGame", { roomCode, hostId });

  for (const p of players) p.socket.disconnect();
  host.disconnect();
  console.log("壓力測試完成。");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("壓力測試失敗:", err);
    process.exit(1);
  });
