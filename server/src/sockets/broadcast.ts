import type { Server } from "socket.io";
import { SOCKET_EVENTS, type RoomPhaseChangedPayload, type RoomStateSnapshot } from "shared";
import type { GameRoom, RoomEvent } from "../rooms/GameRoom";

export function broadcastSnapshot(io: Server, room: GameRoom, now: number): void {
  io.to(room.code).emit(SOCKET_EVENTS.roomState, room.toSnapshot(now));
}

export function phaseChangedPayload(snapshot: RoomStateSnapshot): RoomPhaseChangedPayload {
  return {
    phase: snapshot.phase,
    serverNowMs: snapshot.serverNowMs,
    roundStartedAtMs: snapshot.roundStartedAtMs,
    roundDeadlineMs: snapshot.roundDeadlineMs,
    settings: snapshot.settings,
    ...(snapshot.pausedReason ? { pausedReason: snapshot.pausedReason } : {}),
  };
}

export function broadcastGhostState(io: Server, room: GameRoom, now = Date.now()): void {
  const snapshot = room.toSnapshot(now);
  if (snapshot.ghost) io.to(room.code).emit(SOCKET_EVENTS.ghostStateChanged, snapshot.ghost);
}

/**
 * 把上一個 tick 內累積的玩家進度合併成一包送出，取代每踩一步就廣播給全房間
 * （60 人連續踩腳時，逐步廣播每秒要送出上萬則訊息）。感應模式的手機不畫其他玩家，只送給主控台。
 */
export function flushProgress(io: Server, room: GameRoom): void {
  const updates = room.drainProgress();
  if (updates.length === 0) return;
  const target = room.settings.playerMode === "motion" ? room.hostSocketId : room.code;
  if (!target) return;
  io.to(target).emit(SOCKET_EVENTS.roomPlayersProgress, { updates });
}

/** 把 GameRoom.tick() 回傳的事件轉成實際的 socket.io 廣播。 */
export function applyRoomEvents(io: Server, room: GameRoom, events: RoomEvent[], now: number): void {
  for (const event of events) {
    switch (event.type) {
      case "phaseChanged":
        io.to(room.code).emit(SOCKET_EVENTS.roomPhaseChanged, phaseChangedPayload(room.toSnapshot(now)));
        break;
      case "ghostStateChanged":
        broadcastGhostState(io, room, now);
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
