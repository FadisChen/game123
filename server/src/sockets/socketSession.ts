import type { Socket } from "socket.io";
import type { GameRoom } from "../rooms/GameRoom";
import type { RoomManager } from "../rooms/RoomManager";

export type SocketRole = "host" | "player";

export interface SocketSessionData {
  role?: SocketRole;
  roomCode?: string;
  playerId?: string;
}

export function setHostSession(socket: Socket, room: GameRoom): void {
  socket.data = {
    role: "host",
    roomCode: room.code,
  } satisfies SocketSessionData;
}

export function setPlayerSession(socket: Socket, room: GameRoom, playerId: string): void {
  socket.data = {
    role: "player",
    roomCode: room.code,
    playerId,
  } satisfies SocketSessionData;
}

export function getAuthenticatedHostRoom(socket: Socket, roomManager: RoomManager): GameRoom | undefined {
  const data = socket.data as SocketSessionData;
  if (data.role !== "host" || !data.roomCode) return undefined;
  const room = roomManager.getRoom(data.roomCode);
  return room?.hostSocketId === socket.id ? room : undefined;
}

export function getAuthenticatedPlayerSession(
  socket: Socket,
  roomManager: RoomManager,
): { room: GameRoom; playerId: string } | undefined {
  const data = socket.data as SocketSessionData;
  if (data.role !== "player" || !data.roomCode || !data.playerId) return undefined;
  const room = roomManager.getRoom(data.roomCode);
  const player = room?.players.get(data.playerId);
  if (!room || !player || player.socketId !== socket.id || !player.connected) return undefined;
  return { room, playerId: data.playerId };
}
