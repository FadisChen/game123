import type { Server } from "socket.io";
import { SOCKET_EVENTS } from "shared";
import type { GameRoom, RoomEvent } from "../rooms/GameRoom";

export function broadcastSnapshot(io: Server, room: GameRoom, now: number): void {
  io.to(room.code).emit(SOCKET_EVENTS.roomState, room.toSnapshot(now));
}

export function broadcastGhostState(io: Server, room: GameRoom): void {
  const snapshot = room.toSnapshot(Date.now());
  if (snapshot.ghost) io.to(room.code).emit(SOCKET_EVENTS.ghostStateChanged, snapshot.ghost);
}

/** 把 GameRoom.tick() 回傳的事件轉成實際的 socket.io 廣播。 */
export function applyRoomEvents(io: Server, room: GameRoom, events: RoomEvent[], now: number): void {
  for (const event of events) {
    switch (event.type) {
      case "phaseChanged":
        io.to(room.code).emit(SOCKET_EVENTS.roomPhaseChanged, { phase: room.phase, serverNowMs: now });
        break;
      case "countdownTick":
        io.to(room.code).emit(SOCKET_EVENTS.roomCountdownTick, { value: event.value });
        break;
      case "ghostStateChanged":
        broadcastGhostState(io, room);
        break;
      case "gameOver":
        io.to(room.code).emit(SOCKET_EVENTS.roomGameOver, { ranking: room.getLastRanking(), reason: event.reason });
        break;
      case "playerConnectionChanged":
        io.to(room.code).emit(SOCKET_EVENTS.roomPlayerConnectionChanged, {
          playerId: event.playerId,
          connected: event.connected,
          timedOut: event.timedOut,
        });
        break;
      case "playerBoostChanged":
        io.to(room.code).emit(SOCKET_EVENTS.roomPlayerBoostChanged, {
          playerId: event.playerId,
          boosted: event.boosted,
          untilMs: event.untilMs,
        });
        break;
    }
  }
}
