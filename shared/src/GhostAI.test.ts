import { test } from "node:test";
import assert from "node:assert/strict";
import { GhostAI, GhostReplicaAI, computeFacingAmount } from "./GhostAI";
import { FAKE_TURN_DURATION_MS, FAKE_TURN_PEAK } from "./config";

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
  // call#1: initial LOOK_AWAY duration fraction -> 0 => 5000ms
  // call#2: fake-turn-chance check at t=5000 -> 0.9 (>= 0.35) => real turn, not fake
  // call#3: next LOOK_AWAY duration fraction after the loop completes
  const rng = scriptedRng([0, 0.9, 0.9]);
  const ghost = new GhostAI(0, rng);

  assert.equal(ghost.getState(), "LOOK_AWAY");
  ghost.update(4999);
  assert.equal(ghost.getState(), "LOOK_AWAY");
  assert.equal(ghost.isLooking(), false);

  ghost.update(5000);
  assert.equal(ghost.getState(), "TURNING_TO_LOOK");
  assert.equal(ghost.isLooking(), false);

  ghost.update(5400);
  assert.equal(ghost.getState(), "LOOKING");
  assert.equal(ghost.isLooking(), true);

  ghost.update(7200);
  assert.equal(ghost.getState(), "TURNING_AWAY");
  assert.equal(ghost.isLooking(), false);

  ghost.update(7600);
  assert.equal(ghost.getState(), "LOOK_AWAY");
  assert.equal(ghost.isLooking(), false);
});

test("fake turn never enters LOOKING and never exceeds FAKE_TURN_PEAK", () => {
  // call#1: initial LOOK_AWAY duration -> 0 => 5000ms
  // call#2: fake-turn-chance check -> 0.1 (< 0.35) => FAKE_TURN
  const rng = scriptedRng([0, 0.1]);
  const ghost = new GhostAI(0, rng);

  ghost.update(5000);
  assert.equal(ghost.getState(), "FAKE_TURN");
  assert.equal(ghost.isLooking(), false);

  const early = ghost.getFacingPlayerAmount(5000 + 100);
  const mid = ghost.getFacingPlayerAmount(5000 + FAKE_TURN_DURATION_MS / 2);
  const late = ghost.getFacingPlayerAmount(5000 + FAKE_TURN_DURATION_MS - 100);

  assert.ok(mid <= FAKE_TURN_PEAK + 1e-9, `mid=${mid} should not exceed FAKE_TURN_PEAK`);
  assert.ok(early < mid, "facing amount should ramp up towards the midpoint");
  assert.ok(late < mid, "facing amount should ramp back down after the midpoint");
  assert.ok(mid <= 0.5, "fake turn should never cross the 0.5 front/back sprite-swap threshold");

  ghost.update(5000 + FAKE_TURN_DURATION_MS);
  assert.equal(ghost.getState(), "LOOK_AWAY");
  assert.equal(ghost.isLooking(), false);
});

test("shiftClock moves the state-transition boundary for pause/resume", () => {
  const rng = scriptedRng([0]);
  const ghost = new GhostAI(0, rng);
  ghost.shiftClock(1000); // pretend 1000ms passed while paused
  ghost.update(5999); // without the shift this would already be >= 5000
  assert.equal(ghost.getState(), "LOOK_AWAY");
  ghost.update(6000);
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
