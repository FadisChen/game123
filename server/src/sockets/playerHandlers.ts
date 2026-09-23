import { randomUUID } from "node:crypto";
import type { Server, Socket } from "socket.io";
import {
  SOCKET_EVENTS,
  type PlayerJoinRoomAck,
  type PlayerResumeRoomAck,
  type PlayerStepAck,
} from "shared";
import type { RoomManager } from "../rooms/RoomManager";
import { RateLimiter } from "../RateLimiter";
import { broadcastGhostState, broadcastSnapshot, flushProgress } from "./broadcast";
import {
  isPlayerJoinRoomPayload,
  isPlayerResumeRoomPayload,
  isPlayerStepPayload,
  normalizeRoomCode,
  safeAck,
} from "./validation";
import { getAuthenticatedPlayerSession, setPlayerSession } from "./socketSession";

function createPlayerId(roomManager: RoomManager, roomCode: string): string {
  const room = roomManager.getRoom(roomCode);
  let playerId = randomUUID();
  while (room?.players.has(playerId)) playerId = randomUUID();
  return playerId;
}

export function registerPlayerHandlers(
  io: Server,
  socket: Socket,
  roomManager: RoomManager,
  joinRoomLimiter: RateLimiter,
): void {
  socket.on(SOCKET_EVENTS.playerJoinRoom, (payload: unknown, ack: unknown) => {
    const reply = safeAck<PlayerJoinRoomAck>(ack);
    try {
      if (!isPlayerJoinRoomPayload(payload)) {
        reply({ ok: false, error: "INVALID_PAYLOAD" });
        return;
      }
      if (socket.data.role) {
        reply({ ok: false, error: "SESSION_INVALID" });
        return;
      }
      const roomCode = normalizeRoomCode(payload.roomCode)!;
      const now = Date.now();
      if (!joinRoomLimiter.allow(socket.handshake.address, now)) {
        reply({ ok: false, error: "RATE_LIMITED" });
        return;
      }
      const room = roomManager.getRoom(roomCode);
      if (!room) {
        reply({ ok: false, error: "ROOM_NOT_FOUND" });
        return;
      }

      const playerId = createPlayerId(roomManager, room.code);
      const result = room.join(playerId, payload.name);
      if (!result.ok) {
        reply(result);
        return;
      }

      room.attachSocket(playerId, socket.id);
      setPlayerSession(socket, room, playerId);
      socket.join(room.code);

      const snapshot = room.toSnapshot(now);
      reply({
        ok: true,
        playerId,
        playerSessionToken: room.getPlayerSessionToken(playerId)!,
        snapshot,
      });
      // 完整快照已經包含新玩家，不再另外送 room:playerJoined（沒有任何客戶端使用，只是重複流量）。
      broadcastSnapshot(io, room, now);
    } catch {
      reply({ ok: false, error: "INVALID_PAYLOAD" });
    }
  });

  socket.on(SOCKET_EVENTS.playerResumeRoom, (payload: unknown, ack: unknown) => {
    const reply = safeAck<PlayerResumeRoomAck>(ack);
    try {
      if (!isPlayerResumeRoomPayload(payload)) {
        reply({ ok: false, error: "SESSION_INVALID" });
        return;
      }
      if (socket.data.role) {
        reply({ ok: false, error: "SESSION_INVALID" });
        return;
      }
      const roomCode = normalizeRoomCode(payload.roomCode)!;
      const room = roomManager.getRoom(roomCode);
      if (!room) {
        reply({ ok: false, error: "ROOM_NOT_FOUND" });
        return;
      }
      const result = room.resumePlayer(payload.playerId, payload.sessionToken, socket.id);
      if (!result.ok) {
        reply(result);
        return;
      }

      setPlayerSession(socket, room, payload.playerId);
      socket.join(room.code);
      const now = Date.now();
      reply({
        ok: true,
        playerId: payload.playerId,
        playerSessionToken: payload.sessionToken,
        snapshot: room.toSnapshot(now),
      });
      io.to(room.code).emit(SOCKET_EVENTS.roomPlayerConnectionChanged, {
        playerId: payload.playerId,
        connected: true,
      });
      broadcastSnapshot(io, room, now);
    } catch {
      reply({ ok: false, error: "SESSION_INVALID" });
    }
  });

  socket.on(SOCKET_EVENTS.playerStep, (payload: unknown, ack: unknown) => {
    const reply = safeAck<PlayerStepAck>(ack);
    try {
      if (!isPlayerStepPayload(payload)) {
        reply({ ok: false, error: "INVALID_PAYLOAD" });
        return;
      }
      const session = getAuthenticatedPlayerSession(socket, roomManager);
      if (!session) {
        reply({ ok: false, error: "NOT_AUTHENTICATED" });
        return;
      }
      const now = Date.now();
      const outcome = session.room.applyStep(session.playerId, payload.foot, now, payload.clientSeq);
      if (!outcome.ok) {
        reply(outcome);
        return;
      }

      // 踩腳者自己的結果直接走 ack；其他人看到的進度由 tick 迴圈的 flushProgress() 每 100ms 合併送出。
      reply({ ok: true, result: outcome.result });
      if (outcome.duplicate) return;
      if (outcome.ghostChanged) broadcastGhostState(io, session.room, now);
      if (outcome.concluded) {
        // 結算前先把最後一批進度送出，讓主控台的終點畫面跟排名一致。
        flushProgress(io, session.room);
        io.to(session.room.code).emit(SOCKET_EVENTS.roomGameOver, {
          ranking: session.room.getLastRanking(),
          reason: outcome.concluded,
        });
      }
    } catch {
      reply({ ok: false, error: "INVALID_PAYLOAD" });
    }
  });
}
