import type {
  HostCreateRoomPayload,
  HostResumeRoomPayload,
  HostRoomActionPayload,
  HostUpdateSettingsPayload,
  PlayerJoinRoomPayload,
  PlayerResumeRoomPayload,
  PlayerStepPayload,
} from "shared";

const ROOM_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{4}$/;
const SESSION_TOKEN_MIN_LENGTH = 32;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index]);
}

export function normalizeRoomCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return ROOM_CODE_PATTERN.test(code) ? code : null;
}

export function isSessionToken(value: unknown): value is string {
  return typeof value === "string" && value.length >= SESSION_TOKEN_MIN_LENGTH && value.length <= 128;
}

export function isEmptyPayload(value: unknown): value is Record<string, never> {
  return isRecord(value) && Object.keys(value).length === 0;
}

export function isHostCreateRoomPayload(value: unknown): value is HostCreateRoomPayload {
  return isEmptyPayload(value);
}

export function isHostResumeRoomPayload(value: unknown): value is HostResumeRoomPayload {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["roomCode", "sessionToken"]) &&
    normalizeRoomCode(value.roomCode) !== null &&
    isSessionToken(value.sessionToken)
  );
}

export function isHostRoomActionPayload(value: unknown): value is HostRoomActionPayload {
  return isEmptyPayload(value);
}

export function isHostUpdateSettingsPayload(value: unknown): value is HostUpdateSettingsPayload {
  return isRecord(value) && hasExactKeys(value, ["settings"]) && isRecord(value.settings);
}

export function isPlayerJoinRoomPayload(value: unknown): value is PlayerJoinRoomPayload {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["roomCode", "name"]) &&
    normalizeRoomCode(value.roomCode) !== null &&
    typeof value.name === "string"
  );
}

export function isPlayerResumeRoomPayload(value: unknown): value is PlayerResumeRoomPayload {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["roomCode", "playerId", "sessionToken"]) &&
    normalizeRoomCode(value.roomCode) !== null &&
    typeof value.playerId === "string" &&
    value.playerId.length > 0 &&
    isSessionToken(value.sessionToken)
  );
}

export function isPlayerStepPayload(value: unknown): value is PlayerStepPayload {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["foot", "clientSeq"]) &&
    (value.foot === "left" || value.foot === "right") &&
    typeof value.clientSeq === "number" &&
    Number.isSafeInteger(value.clientSeq) &&
    value.clientSeq >= 0
  );
}

export function safeAck<T>(ack: unknown): (response: T) => void {
  return typeof ack === "function" ? (ack as (response: T) => void) : () => undefined;
}
