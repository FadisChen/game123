import { test } from "node:test";
import assert from "node:assert/strict";
import { GhostAI, GhostReplicaAI, computeFacingAmount } from "./GhostAI";
import {
  FAKE_TURN_CHANCE,
  FAKE_TURN_DURATION_MS,
  FAKE_TURN_PEAK,
  GHOST_LOOK_AWAY_MIN_MS,
  GHOST_LOOKING_DURATION_MS,
  GHOST_TURN_DURATION_MS,
} from "./config";

// 時間點一律由預設難度的常數推導，難度表調整時測試會自動跟著走，不會留下寫死的舊數值。
const LOOK_AWAY_END = GHOST_LOOK_AWAY_MIN_MS;
const TURN_TO_LOOK_END = LOOK_AWAY_END + GHOST_TURN_DURATION_MS;
const LOOKING_END = TURN_TO_LOOK_END + GHOST_LOOKING_DURATION_MS;
const TURN_AWAY_END = LOOKING_END + GHOST_TURN_DURATION_MS;
const NO_FAKE_TURN = FAKE_TURN_CHANCE + 0.1; // 擲出這個值就不會進假動作
const FAKE_TURN = FAKE_TURN_CHANCE - 0.1;

function scriptedRng(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

test("computeFacingAmount boundary values", () => {
  assert.equal(computeFacingAmount("LOOK_AWAY", 0, 5000), 0);
  assert.equal(computeFacingAmount("LOOKING", 0, 1800), 1);
  assert.equal(computeFacingAmount("TURNING_TO_LOOK", 0, 400), 0);
  assert.equal(computeFacingAmount("TURNING_TO_LOOK", 400, 400), 1);
  assert.equal(computeFacingAmount("TURNING_AWAY", 0, 400), 1);
  assert.equal(computeFacingAmount("TURNING_AWAY", 400, 400), 0);
});

test("full cycle (no fake turn) transitions through every state at the expected timestamps", () => {
  // call#1: initial LOOK_AWAY duration fraction -> 0 => the profile's minimum
  // call#2: fake-turn-chance check -> above the chance => real turn, not fake
  // call#3: next LOOK_AWAY duration fraction after the loop completes
  const rng = scriptedRng([0, NO_FAKE_TURN, NO_FAKE_TURN]);
  const ghost = new GhostAI(0, rng);

  assert.equal(ghost.getState(), "LOOK_AWAY");
  ghost.update(LOOK_AWAY_END - 1);
  assert.equal(ghost.getState(), "LOOK_AWAY");
  assert.equal(ghost.isLooking(), false);

  ghost.update(LOOK_AWAY_END);
  assert.equal(ghost.getState(), "TURNING_TO_LOOK");
  assert.equal(ghost.isLooking(), false);

  ghost.update(TURN_TO_LOOK_END);
  assert.equal(ghost.getState(), "LOOKING");
  assert.equal(ghost.isLooking(), true);

  ghost.update(LOOKING_END);
  assert.equal(ghost.getState(), "TURNING_AWAY");
  assert.equal(ghost.isLooking(), false);

  ghost.update(TURN_AWAY_END);
  assert.equal(ghost.getState(), "LOOK_AWAY");
  assert.equal(ghost.isLooking(), false);
});

test("fake turn never enters LOOKING and never exceeds FAKE_TURN_PEAK", () => {
  // call#1: initial LOOK_AWAY duration -> 0 => the profile's minimum
  // call#2: fake-turn-chance check -> below the chance => FAKE_TURN
  const rng = scriptedRng([0, FAKE_TURN]);
  const ghost = new GhostAI(0, rng);

  ghost.update(LOOK_AWAY_END);
  assert.equal(ghost.getState(), "FAKE_TURN");
  assert.equal(ghost.isLooking(), false);

  const early = ghost.getFacingPlayerAmount(LOOK_AWAY_END + 10);
  const mid = ghost.getFacingPlayerAmount(LOOK_AWAY_END + FAKE_TURN_DURATION_MS / 2);
  const late = ghost.getFacingPlayerAmount(LOOK_AWAY_END + FAKE_TURN_DURATION_MS - 10);

  assert.ok(mid <= FAKE_TURN_PEAK + 1e-9, `mid=${mid} should not exceed FAKE_TURN_PEAK`);
  assert.ok(early < mid, "facing amount should ramp up towards the midpoint");
  assert.ok(late < mid, "facing amount should ramp back down after the midpoint");
  assert.ok(mid <= 0.5, "fake turn should never cross the 0.5 front/back sprite-swap threshold");

  ghost.update(LOOK_AWAY_END + FAKE_TURN_DURATION_MS);
  assert.equal(ghost.getState(), "LOOK_AWAY");
  assert.equal(ghost.isLooking(), false);
});

test("shiftClock moves the state-transition boundary for pause/resume", () => {
  const rng = scriptedRng([0]);
  const ghost = new GhostAI(0, rng);
  ghost.shiftClock(1000); // pretend 1000ms passed while paused
  ghost.update(LOOK_AWAY_END + 999); // without the shift this would already be past the boundary
  assert.equal(ghost.getState(), "LOOK_AWAY");
  ghost.update(LOOK_AWAY_END + 1000);
  assert.notEqual(ghost.getState(), "LOOK_AWAY");
});

test("GhostReplicaAI mirrors server-provided state without ever judging anything itself", () => {
  const replica = new GhostReplicaAI(0);
  assert.equal(replica.isLooking(), false);

  replica.applyServerState("LOOKING", 1000, 1800);
  assert.equal(replica.getState(), "LOOKING");
  assert.equal(replica.isLooking(), true);
  assert.equal(replica.getFacingPlayerAmount(1000), 1);

  replica.applyServerState("TURNING_TO_LOOK", 2000, 400);
  assert.equal(replica.isLooking(), false);
  assert.equal(replica.getFacingPlayerAmount(2200), 0.5);
});
