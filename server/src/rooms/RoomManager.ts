import { ROOM_CODE_LENGTH } from "shared";
import { GameRoom, type RoomEvent } from "./GameRoom";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 排除易混淆的 0/O/1/I

/** 房間閒置多久（沒有任何連線中的人）就回收，避免記憶體無限累積。 */
const ABANDONED_ROOM_TTL_MS = 10 * 60_000;

function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

export class RoomManager {
  private readonly rooms = new Map<string, GameRoom>();
  private readonly abandonedSince = new Map<string, number>();
  private readonly rngFactory: () => () => number;

  constructor(rngFactory: () => () => number = () => Math.random) {
    this.rngFactory = rngFactory;
  }

  createRoom(hostId: string): GameRoom {
    let code = generateRoomCode();
    while (this.rooms.has(code)) code = generateRoomCode();
    const room = new GameRoom(code, hostId, this.rngFactory(), this.rngFactory());
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code: string): GameRoom | undefined {
    return this.rooms.get(code);
  }

  removeRoom(code: string): void {
    this.rooms.delete(code);
    this.abandonedSince.delete(code);
  }

  /** 由伺服器唯一的全域計時器呼叫，推進所有房間的狀態，並回收長時間沒人連線的房間。 */
  tickAll(now: number): Map<string, RoomEvent[]> {
    const eventsByRoom = new Map<string, RoomEvent[]>();
    for (const [code, room] of this.rooms) {
      eventsByRoom.set(code, room.tick(now));

      if (room.isAbandoned()) {
        const since = this.abandonedSince.get(code) ?? now;
        this.abandonedSince.set(code, since);
        if (now - since >= ABANDONED_ROOM_TTL_MS) {
          this.removeRoom(code);
        }
      } else {
        this.abandonedSince.delete(code);
      }
    }
    return eventsByRoom;
  }
}
