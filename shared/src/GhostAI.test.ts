import { test } from "node:test";
import assert from "node:assert/strict";
import { GhostAI, GhostReplicaAI, computeFacingAmount } from "./GhostAI";
import {
  GHOST_TURN_DURATION_MS,
  MUSIC_LOOKING_MIN_MS,
  MUSIC_LOOKING_MAX_MS,
  MUSIC_TRACK_DURATION_MS,
  musicPlaybackRate,
  musicPhaseDurationMs,
} from "./config";

const LOOK_AWAY_END = MUSIC_TRACK_DURATION_MS;
const TURN_TO_LOOK_END = LOOK_AWAY_END + GHOST_TURN_DURATION_MS;
const LOOKING_END = TURN_TO_LOOK_END + MUSIC_LOOKING_MIN_MS;
const TURN_AWAY_END = LOOKING_END + GHOST_TURN_DURATION_MS;

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

/** 玩家端的時鐘校準只在回合開始/暫停恢復時做一次，若剛好在那個當下遇到延遲，
 * 之後整場算出來的 elapsedMs 就可能是負的（客戶端覺得「現在」還沒到伺服器的 stateStartedAtMs）。
 * facingAmount 若不 clamp 下限，TURNING_AWAY 用 1 - progress 會被推到超過 1，
 * 乘上 Math.PI 後在畫面上就是「鬼多轉了一圈」。 */
test("computeFacingAmount stays within [0, 1] even when elapsedMs is negative (clock skew)", () => {
  assert.equal(computeFacingAmount("TURNING_TO_LOOK", -235, 260), 0);
  assert.equal(computeFacingAmount("TURNING_AWAY", -314, 260), 1);
});

test("full cycle transitions through every state at the expected timestamps", () => {
  const rng = scriptedRng([0, 0]);
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
  assert.equal(ghost.getMusicCycle(), 1);
  assert.equal(ghost.getMusicPlaybackRate(), musicPlaybackRate(1));
  assert.equal(ghost.getStateDuration(), musicPhaseDurationMs(1));
});

test("looking duration is randomized within 3 to 6 seconds", () => {
  const shortest = new GhostAI(0, scriptedRng([0]));
  shortest.update(LOOK_AWAY_END);
  shortest.update(TURN_TO_LOOK_END);
  assert.equal(shortest.getState(), "LOOKING");
  assert.equal(shortest.getStateDuration(), MUSIC_LOOKING_MIN_MS);

  const longest = new GhostAI(0, scriptedRng([0.999999]));
  longest.update(LOOK_AWAY_END);
  longest.update(TURN_TO_LOOK_END);
  assert.ok(longest.getStateDuration() >= MUSIC_LOOKING_MIN_MS);
  assert.ok(longest.getStateDuration() < MUSIC_LOOKING_MAX_MS);
});

test("music playback speed increases by 0.1x per cycle and caps at 2.0x", () => {
  const expected = [1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2, 2, 2];
  assert.deepEqual(
    expected.map((_, cycle) => musicPlaybackRate(cycle)),
    expected,
  );
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

  replica.applyServerState("LOOKING", 1000, 1800, 4, 1.4);
  assert.equal(replica.getState(), "LOOKING");
  assert.equal(replica.isLooking(), true);
  assert.equal(replica.getFacingPlayerAmount(1000), 1);

  replica.applyServerState("TURNING_TO_LOOK", 2000, 400);
  assert.equal(replica.isLooking(), false);
  assert.equal(replica.getFacingPlayerAmount(2200), 0.5);
  assert.equal(replica.getMusicCycle(), 0);
  assert.equal(replica.getMusicPlaybackRate(), 1);
});
