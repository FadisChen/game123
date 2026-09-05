import type { Server, Socket } from "socket.io";
import { SOCKET_EVENTS } from "shared";
import type { RoomManager } from "../rooms/RoomManager";
import { broadcastSnapshot } from "./broadcast";

interface SocketSessionData {
  roomCode?: string;
  playerId?: string;
  hostId?: string;
}

/**
 * 斷線時：玩家標記 connected=false 並凍結分數/距離；主辦方斷線不會自動暫停遊戲，
 * 只是主控台暫時看不到畫面（見 PRD 19 章與規劃文件的預設判斷）。
 */
export function registerDisconnectHandler(io: Server, socket: Socket, roomManager: RoomManager): void {
  socket.on("disconnect", () => {
    const { roomCode, playerId, hostId } = socket.data as SocketSessionData;
    if (!roomCode) return;
    const room = roomManager.getRoom(roomCode);
    if (!room) return;
    const now = Date.now();

    if (playerId) {
      room.markPlayerDisconnected(playerId, now);
      io.to(room.code).emit(SOCKET_EVENTS.roomPlayerConnectionChanged, { playerId, connected: false });
      broadcastSnapshot(io, room, now);
    } else if (hostId) {
      room.markHostDisconnected();
    }
  });
}
