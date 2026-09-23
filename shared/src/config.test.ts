import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_ROOM_SETTINGS, normalizeRoomSettings } from "./config";

test("room distance defaults to 30 m and accepts tenths of a metre", () => {
  assert.equal(DEFAULT_ROOM_SETTINGS.finishDistanceM, 30);
  assert.equal(
    normalizeRoomSettings({ finishDistanceM: 72.35 }).finishDistanceM,
    72.4,
  );
  assert.equal(
    normalizeRoomSettings({ finishDistanceM: 0.1 }).finishDistanceM,
    0.1,
  );
});

test("missing, non-numeric and invalid distances fall back to the default", () => {
  for (const finishDistanceM of [
    undefined,
    null,
    "80",
    0,
    -1,
    0.01,
    NaN,
    Infinity,
    -Infinity,
    Number.MAX_VALUE,
  ]) {
    assert.equal(
      normalizeRoomSettings({ finishDistanceM }).finishDistanceM,
      30,
    );
  }
});

test("grace window and rhythm mode accept only the listed options", () => {
  assert.equal(DEFAULT_ROOM_SETTINGS.graceMs, 500);
  assert.equal(DEFAULT_ROOM_SETTINGS.rhythmMode, "classic");
  assert.equal(normalizeRoomSettings({ graceMs: 800 }).graceMs, 800);
  assert.equal(normalizeRoomSettings({ graceMs: 0 }).graceMs, 0);
  assert.equal(normalizeRoomSettings({ graceMs: 5000 }).graceMs, 500);
  assert.equal(normalizeRoomSettings({ graceMs: "300" }).graceMs, 500);
  assert.equal(
    normalizeRoomSettings({ rhythmMode: "fake-out" }).rhythmMode,
    "fake-out",
  );
  assert.equal(
    normalizeRoomSettings({ rhythmMode: "random-cut" }).rhythmMode,
    "random-cut",
  );
  assert.equal(
    normalizeRoomSettings({ rhythmMode: "chaos" }).rhythmMode,
    "classic",
  );
});
