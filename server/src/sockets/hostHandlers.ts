import type { Server, Socket } from "socket.io";
import {
  SOCKET_EVENTS,
  normalizeRoomSettings,
  type HostCreateRoomAck,
  type HostCreateRoomPayload,
  type HostRoomActionAck,
  type HostRoomActionPayload,
  type HostUpdateSettingsPayload,
} from "shared";
import type { GameRoom } from "../rooms/GameRoom";
import type { RoomManager } from "../rooms/RoomManager";
import { broadcastSnapshot } from "./broadcast";

function withHostRoom(
  io: Server,
  roomManager: RoomManager,
  payload: HostRoomActionPayload,
  ack: (res: HostRoomActionAck) => void,
  action: (room: GameRoom, now: number) => { ok: true } | { ok: false; error: string },
): void {
  const room = roomManager.getRoom(payload.roomCode);
  if (!room || room.hostId !== payload.hostId) {
    ack({ ok: false, error: "ROOM_NOT_FOUND" });
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
    // 主辦方「結束遊戲」屬於強制結算，不會經過 tick()/applyStep() 的自然結束路徑，
    // 所以這裡要自己補送 room:gameOver，否則玩家端永遠不會收到排名資料。
    io.to(room.code).emit(SOCKET_EVENTS.roomGameOver, { ranking: room.getLastRanking(), reason: room.getLastGameOverReason() });
  }
  ack({ ok: true });
}

export function registerHostHandlers(io: Server, socket: Socket, roomManager: RoomManager): void {
  socket.on(SOCKET_EVENTS.hostCreateRoom, (payload: HostCreateRoomPayload, ack: (res: HostCreateRoomAck) => void) => {
    const now = Date.now();
    const room = roomManager.createRoom(payload.hostId);
    room.attachHostSocket(socket.id);
    socket.data.hostId = payload.hostId;
    socket.data.roomCode = room.code;
    socket.join(room.code);
    ack({ ok: true, roomCode: room.code, snapshot: room.toSnapshot(now) });
  });

  socket.on(SOCKET_EVENTS.hostStartGame, (payload: HostRoomActionPayload, ack: (res: HostRoomActionAck) => void) => {
    withHostRoom(io, roomManager, payload, ack, (room, now) => room.startGame(now));
  });

  socket.on(SOCKET_EVENTS.hostPauseGame, (payload: HostRoomActionPayload, ack: (res: HostRoomActionAck) => void) => {
    withHostRoom(io, roomManager, payload, ack, (room, now) => room.pause(now));
  });

  socket.on(SOCKET_EVENTS.hostResumeGame, (payload: HostRoomActionPayload, ack: (res: HostRoomActionAck) => void) => {
    withHostRoom(io, roomManager, payload, ack, (room, now) => room.resume(now));
  });

  socket.on(SOCKET_EVENTS.hostEndGame, (payload: HostRoomActionPayload, ack: (res: HostRoomActionAck) => void) => {
    withHostRoom(io, roomManager, payload, ack, (room) => room.forceEndGame());
  });

  socket.on(SOCKET_EVENTS.hostRestartGame, (payload: HostRoomActionPayload, ack: (res: HostRoomActionAck) => void) => {
    withHostRoom(io, roomManager, payload, ack, (room) => room.restart());
  });

  socket.on(SOCKET_EVENTS.hostUpdateSettings, (payload: HostUpdateSettingsPayload, ack: (res: HostRoomActionAck) => void) => {
    // 走 withHostRoom 是為了沿用它的主辦方身分驗證與「套用後廣播完整快照」——玩家端就是靠這份
    // 快照裡的 settings.maxScore 決定 HUD 要畫幾格愛心。
    withHostRoom(io, roomManager, payload, ack, (room) => room.updateSettings(normalizeRoomSettings(payload.settings)));
  });
}
