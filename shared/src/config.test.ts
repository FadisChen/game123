import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_ROOM_SETTINGS, normalizeRoomSettings } from "./config";

test("room distance defaults to 50 m and accepts tenths of a metre", () => {
  assert.equal(DEFAULT_ROOM_SETTINGS.finishDistanceM, 50);
  assert.equal(normalizeRoomSettings({ finishDistanceM: 72.35 }).finishDistanceM, 72.4);
  assert.equal(normalizeRoomSettings({ finishDistanceM: 0.1 }).finishDistanceM, 0.1);
});

test("missing, non-numeric and invalid distances fall back to the default", () => {
  for (const finishDistanceM of [undefined, null, "80", 0, -1, 0.01, NaN, Infinity, -Infinity, Number.MAX_VALUE]) {
    assert.equal(normalizeRoomSettings({ finishDistanceM }).finishDistanceM, 50);
  }
});
