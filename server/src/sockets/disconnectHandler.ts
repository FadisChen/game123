import type { Server, Socket } from "socket.io";
import { SOCKET_EVENTS } from "shared";
import type { RoomManager } from "../rooms/RoomManager";
import { broadcastSnapshot } from "./broadcast";
import type { SocketSessionData } from "./socketSession";

/**
 * 斷線時：玩家標記 connected=false 並凍結分數/距離；主辦方斷線先記錄時間，
 * 若遊戲進行中且超過 HOST_DISCONNECT_PAUSE_MS 還沒重連，GameRoom.tick() 會自動暫停。
 */
export function registerDisconnectHandler(io: Server, socket: Socket, roomManager: RoomManager): void {
  socket.on("disconnect", () => {
    const { roomCode, playerId, role } = socket.data as SocketSessionData;
    if (!roomCode) return;
    const room = roomManager.getRoom(roomCode);
    if (!room) return;
    const now = Date.now();

    if (role === "player" && playerId) {
      const changed = room.markPlayerDisconnected(playerId, now, socket.id);
      if (!changed) return;
      io.to(room.code).emit(SOCKET_EVENTS.roomPlayerConnectionChanged, { playerId, connected: false });
      broadcastSnapshot(io, room, now);
    } else if (role === "host") {
      // 遊戲進行中主控台斷線超過 HOST_DISCONNECT_PAUSE_MS 會由 tick() 自動暫停（音樂只從主控台播放）。
      room.markHostDisconnected(socket.id, now);
    }
  });
}
