import type { Server, Socket } from "socket.io";
import {
  SOCKET_EVENTS,
  type PlayerJoinRoomAck,
  type PlayerJoinRoomPayload,
  type PlayerStepAck,
  type PlayerStepPayload,
} from "shared";
import type { RoomManager } from "../rooms/RoomManager";
import { broadcastGhostState, broadcastSnapshot } from "./broadcast";

export function registerPlayerHandlers(io: Server, socket: Socket, roomManager: RoomManager): void {
  socket.on(SOCKET_EVENTS.playerJoinRoom, (payload: PlayerJoinRoomPayload, ack: (res: PlayerJoinRoomAck) => void) => {
    const room = roomManager.getRoom(payload.roomCode);
    if (!room) {
      ack({ ok: false, error: "ROOM_NOT_FOUND" });
      return;
    }
    const now = Date.now();
    const result = room.join(payload.playerId, payload.name);
    if (!result.ok) {
      ack(result);
      return;
    }

    room.attachSocket(payload.playerId, socket.id);
    socket.data.playerId = payload.playerId;
    socket.data.roomCode = room.code;
    socket.join(room.code);

    const snapshot = room.toSnapshot(now);
    ack({ ok: true, snapshot });

    const joinedSummary = snapshot.players.find((p) => p.playerId === payload.playerId);
    if (joinedSummary) {
      io.to(room.code).emit(SOCKET_EVENTS.roomPlayerJoined, { player: joinedSummary });
    }
    broadcastSnapshot(io, room, now);
  });

  socket.on(SOCKET_EVENTS.playerStep, (payload: PlayerStepPayload, ack: (res: PlayerStepAck) => void) => {
    const room = roomManager.getRoom(payload.roomCode);
    if (!room) {
      ack({ ok: false, error: "UNKNOWN_PLAYER" });
      return;
    }
    const now = Date.now();
    const outcome = room.applyStep(payload.playerId, payload.foot, now);
    if (!outcome.ok) {
      ack(outcome);
      return;
    }

    ack({ ok: true, result: outcome.result });
    io.to(room.code).emit(SOCKET_EVENTS.roomPlayerStepped, {
      playerId: payload.playerId,
      foot: payload.foot,
      result: outcome.result,
    });
    if (outcome.ghostChanged) broadcastGhostState(io, room);
    if (outcome.concluded) {
      io.to(room.code).emit(SOCKET_EVENTS.roomGameOver, { ranking: room.getLastRanking(), reason: outcome.concluded });
    }
  });
}
