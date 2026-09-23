import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { SERVER_TICK_MS, SOCKET_EVENTS, type TimeSyncAck } from "shared";
import { RoomManager } from "./rooms/RoomManager";
import { registerHostHandlers } from "./sockets/hostHandlers";
import { registerPlayerHandlers } from "./sockets/playerHandlers";
import { registerDisconnectHandler } from "./sockets/disconnectHandler";
import { applyRoomEvents, broadcastSnapshot, flushProgress } from "./sockets/broadcast";
import { isEmptyPayload, safeAck } from "./sockets/validation";
import { RateLimiter } from "./RateLimiter";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3001);
const CLIENT_DIST = path.resolve(__dirname, "../../client/dist");

/**
 * 測試用：設定 GHOST_TEST_SEED 環境變數時，改用可重現的 xorshift32 亂數而不是 Math.random()，
 * 讓 E2E 測試可以預期鬼的回頭時機，斷言所有客戶端幾乎同時看到同一次狀態轉換。
 */
function createRngFactory(): () => () => number {
  const seedEnv = process.env.GHOST_TEST_SEED;
  if (!seedEnv) return () => Math.random;
  const baseSeed = Number(seedEnv) || 1;
  return () => {
    let state = baseSeed >>> 0 || 1;
    return () => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      return state / 0xffffffff;
    };
  };
}

const app = express();
app.use(express.static(CLIENT_DIST));
app.get("/healthz", (_req, res) => {
  res.status(200).json({ status: "ok" });
});
app.get("/join/:code", (_req, res) => {
  res.sendFile(path.join(CLIENT_DIST, "player.html"));
});
app.get("/host", (_req, res) => {
  res.sendFile(path.join(CLIENT_DIST, "host.html"));
});
app.get("/", (_req, res) => {
  res.sendFile(path.join(CLIENT_DIST, "player.html"));
});

const httpServer = createServer(app);
const corsOrigin = process.env.CORS_ORIGIN;
const io = new Server(httpServer, {
  ...(corsOrigin ? { cors: { origin: corsOrigin } } : {}),
  maxHttpBufferSize: 16 * 1024,
});
const roomManager = new RoomManager(createRngFactory());
const createRoomLimiter = new RateLimiter(60_000, 10);
const joinRoomLimiter = new RateLimiter(60_000, 300);

io.on("connection", (socket) => {
  registerHostHandlers(io, socket, roomManager, createRoomLimiter);
  registerPlayerHandlers(io, socket, roomManager, joinRoomLimiter);
  registerDisconnectHandler(io, socket, roomManager);
  // 客戶端量測來回延遲、校正時鐘偏移（主控台音樂對拍與倒數用），不影響任何判定。
  socket.on(SOCKET_EVENTS.timeSync, (payload: unknown, ack: unknown) => {
    if (!isEmptyPayload(payload)) return;
    safeAck<TimeSyncAck>(ack)({ serverNowMs: Date.now() });
  });
});

setInterval(() => {
  const now = Date.now();
  const eventsByRoom = roomManager.tickAll(now);
  for (const [code, events] of eventsByRoom) {
    const room = roomManager.getRoom(code);
    if (!room) continue;
    flushProgress(io, room);
    if (events.length === 0) continue;
    applyRoomEvents(io, room, events, now);
    if (events.some((e) => e.type === "phaseChanged" || e.type === "playerConnectionChanged")) {
      broadcastSnapshot(io, room, now);
    }
  }
}, SERVER_TICK_MS);

httpServer.listen(PORT, () => {
  console.log(`[server] listening on :${PORT}`);
});
