import type { Server, Socket } from "socket.io";
import {
  SOCKET_EVENTS,
  normalizeRoomSettings,
  type HostCreateRoomAck,
  type HostResumeRoomAck,
  type HostRoomActionAck,
  type HostUpdateSettingsPayload,
} from "shared";
import type { GameRoom } from "../rooms/GameRoom";
import type { RoomManager } from "../rooms/RoomManager";
import { RateLimiter } from "../RateLimiter";
import { broadcastSnapshot } from "./broadcast";
import {
  isEmptyPayload,
  isHostCreateRoomPayload,
  isHostResumeRoomPayload,
  isHostUpdateSettingsPayload,
  normalizeRoomCode,
  safeAck,
} from "./validation";
import { getAuthenticatedHostRoom, setHostSession } from "./socketSession";

function withHostRoom(
  io: Server,
  socket: Socket,
  roomManager: RoomManager,
  ack: (res: HostRoomActionAck) => void,
  action: (room: GameRoom, now: number) => { ok: true } | { ok: false; error: string },
): void {
  const room = getAuthenticatedHostRoom(socket, roomManager);
  if (!room) {
    ack({ ok: false, error: "NOT_AUTHENTICATED" });
    return;
  }
  const now = Date.now();
  const result = action(room, now);
  if (!result.ok) {
    ack(result);
    return;
  }
  const snapshot = room.toSnapshot(now);
  broadcastSnapshot(io, room, now);
  io.to(room.code).emit(SOCKET_EVENTS.roomPhaseChanged, {
    phase: snapshot.phase,
    serverNowMs: snapshot.serverNowMs,
    roundStartedAtMs: snapshot.roundStartedAtMs,
    roundDeadlineMs: snapshot.roundDeadlineMs,
    settings: snapshot.settings,
  });
  if (room.phase === "GAME_OVER") {
    io.to(room.code).emit(SOCKET_EVENTS.roomGameOver, {
      ranking: room.getLastRanking(),
      reason: room.getLastGameOverReason(),
    });
  }
  ack({ ok: true });
}

export function registerHostHandlers(
  io: Server,
  socket: Socket,
  roomManager: RoomManager,
  createRoomLimiter: RateLimiter,
): void {
  socket.on(SOCKET_EVENTS.hostCreateRoom, (payload: unknown, ack: unknown) => {
    const reply = safeAck<HostCreateRoomAck>(ack);
    try {
      const now = Date.now();
      if (!isHostCreateRoomPayload(payload)) {
        reply({ ok: false, error: "INVALID_PAYLOAD" });
        return;
      }
      if (socket.data.role) {
        reply({ ok: false, error: "NOT_AUTHENTICATED" });
        return;
      }
      if (!createRoomLimiter.allow(socket.handshake.address, now)) {
        reply({ ok: false, error: "RATE_LIMITED" });
        return;
      }
      const room = roomManager.createRoom();
      room.attachHostSocket(socket.id);
      setHostSession(socket, room);
      socket.join(room.code);
      reply({
        ok: true,
        roomCode: room.code,
        hostSessionToken: room.getHostSessionToken(),
        snapshot: room.toSnapshot(now),
      });
    } catch {
      reply({ ok: false, error: "INVALID_PAYLOAD" });
    }
  });

  socket.on(SOCKET_EVENTS.hostResumeRoom, (payload: unknown, ack: unknown) => {
    const reply = safeAck<HostResumeRoomAck>(ack);
    try {
      if (!isHostResumeRoomPayload(payload)) {
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
      const result = room.resumeHost(payload.sessionToken, socket.id);
      if (!result.ok) {
        reply(result);
        return;
      }
      setHostSession(socket, room);
      socket.join(room.code);
      const now = Date.now();
      reply({
        ok: true,
        roomCode: room.code,
        sessionToken: payload.sessionToken,
        snapshot: room.toSnapshot(now),
      });
      broadcastSnapshot(io, room, now);
    } catch {
      reply({ ok: false, error: "SESSION_INVALID" });
    }
  });

  socket.on(SOCKET_EVENTS.hostStartGame, (payload: unknown, ack: unknown) => {
    const reply = safeAck<HostRoomActionAck>(ack);
    if (!isEmptyPayload(payload)) {
      reply({ ok: false, error: "INVALID_PAYLOAD" });
      return;
    }
    withHostRoom(io, socket, roomManager, reply, (room, now) => room.startGame(now));
  });

  socket.on(SOCKET_EVENTS.hostPauseGame, (payload: unknown, ack: unknown) => {
    const reply = safeAck<HostRoomActionAck>(ack);
    if (!isEmptyPayload(payload)) {
      reply({ ok: false, error: "INVALID_PAYLOAD" });
      return;
    }
    withHostRoom(io, socket, roomManager, reply, (room, now) => room.pause(now));
  });

  socket.on(SOCKET_EVENTS.hostResumeGame, (payload: unknown, ack: unknown) => {
    const reply = safeAck<HostRoomActionAck>(ack);
    if (!isEmptyPayload(payload)) {
      reply({ ok: false, error: "INVALID_PAYLOAD" });
      return;
    }
    withHostRoom(io, socket, roomManager, reply, (room, now) => room.resume(now));
  });

  socket.on(SOCKET_EVENTS.hostEndGame, (payload: unknown, ack: unknown) => {
    const reply = safeAck<HostRoomActionAck>(ack);
    if (!isEmptyPayload(payload)) {
      reply({ ok: false, error: "INVALID_PAYLOAD" });
      return;
    }
    withHostRoom(io, socket, roomManager, reply, (room) => room.forceEndGame());
  });

  socket.on(SOCKET_EVENTS.hostRestartGame, (payload: unknown, ack: unknown) => {
    const reply = safeAck<HostRoomActionAck>(ack);
    if (!isEmptyPayload(payload)) {
      reply({ ok: false, error: "INVALID_PAYLOAD" });
      return;
    }
    withHostRoom(io, socket, roomManager, reply, (room) => room.restart());
  });

  socket.on(SOCKET_EVENTS.hostUpdateSettings, (payload: unknown, ack: unknown) => {
    const reply = safeAck<HostRoomActionAck>(ack);
    if (!isHostUpdateSettingsPayload(payload)) {
      reply({ ok: false, error: "INVALID_PAYLOAD" });
      return;
    }
    const settingsPayload = payload as HostUpdateSettingsPayload;
    withHostRoom(io, socket, roomManager, reply, (room) =>
      room.updateSettings(normalizeRoomSettings(settingsPayload.settings)),
    );
  });
}
