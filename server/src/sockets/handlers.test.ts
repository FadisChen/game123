import { test } from "node:test";
import assert from "node:assert/strict";
import type { Server, Socket } from "socket.io";
import {
  type HostCreateRoomAck,
  type PlayerJoinRoomAck,
  type PlayerResumeRoomAck,
  type PlayerStepAck,
} from "shared";
import { RateLimiter } from "../RateLimiter";
import { RoomManager } from "../rooms/RoomManager";
import { registerHostHandlers } from "./hostHandlers";
import { registerPlayerHandlers } from "./playerHandlers";

type Handler = (payload: unknown, ack: (response: unknown) => void) => void;

interface FakeSocket {
  id: string;
  data: Record<string, unknown>;
  handshake: { address: string };
  handlers: Map<string, Handler>;
  on(event: string, handler: Handler): void;
  join(): void;
}

function fakeSocket(id: string): FakeSocket {
  const socket: FakeSocket = {
    id,
    data: {},
    handshake: { address: "127.0.0.1" },
    handlers: new Map(),
    on(event, handler) {
      this.handlers.set(event, handler);
    },
    join() {
      // no-op room membership for the handler unit test
    },
  };
  return socket;
}

function invoke<T>(socket: FakeSocket, event: string, payload: unknown): Promise<T> {
  return new Promise((resolve) => {
    const handler = socket.handlers.get(event);
    if (!handler) throw new Error(`handler not registered: ${event}`);
    handler(payload, (response) => resolve(response as T));
  });
}

test("socket handlers issue server identities and reject spoofed or malformed operations", async () => {
  const io = { to: () => ({ emit: () => undefined }) } as unknown as Server;
  const roomManager = new RoomManager(() => () => 0.5);
  const createLimiter = new RateLimiter(60_000, 10);
  const joinLimiter = new RateLimiter(60_000, 300);
  const host = fakeSocket("host-1");
  const player = fakeSocket("player-1");

  registerHostHandlers(io, host as unknown as Socket, roomManager, createLimiter);
  registerHostHandlers(io, player as unknown as Socket, roomManager, createLimiter);
  registerPlayerHandlers(io, player as unknown as Socket, roomManager, joinLimiter);

  const created = await invoke<HostCreateRoomAck>(host, "host:createRoom", {});
  if (!created.ok) throw new Error(`create failed: ${created.error}`);
  assert.equal(created.hostSessionToken.length >= 32, true);

  const joined = await invoke<PlayerJoinRoomAck>(player, "player:joinRoom", {
    roomCode: created.roomCode,
    name: "Alice",
  });
  if (!joined.ok) throw new Error(`join failed: ${joined.error}`);
  assert.equal(joined.playerId.length > 0, true);
  assert.equal(joined.playerSessionToken.length >= 32, true);

  const spoofedHostAction = await invoke<{ ok: false; error: string }>(player, "host:startGame", {});
  assert.deepEqual(spoofedHostAction, { ok: false, error: "NOT_AUTHENTICATED" });
  const malformedStep = await invoke<PlayerStepAck>(player, "player:step", {
    foot: "left",
    clientSeq: "0",
  });
  assert.deepEqual(malformedStep, { ok: false, error: "INVALID_PAYLOAD" });

  const wrongResumeSocket = fakeSocket("player-2");
  registerPlayerHandlers(io, wrongResumeSocket as unknown as Socket, roomManager, joinLimiter);
  const wrongResume = await invoke<PlayerResumeRoomAck>(wrongResumeSocket, "player:resumeRoom", {
    roomCode: created.roomCode,
    playerId: joined.playerId,
    sessionToken: "x".repeat(43),
  });
  assert.deepEqual(wrongResume, { ok: false, error: "SESSION_INVALID" });

  const started = await invoke<{ ok: true }>(host, "host:startGame", {});
  assert.deepEqual(started, { ok: true });
  const stepped = await invoke<PlayerStepAck>(player, "player:step", { foot: "left", clientSeq: 0 });
  assert.equal(stepped.ok, true);
});
