import { test } from "node:test";
import assert from "node:assert/strict";
import { Player } from "./Player";
import { FINISH_DISTANCE_M, STEP_DISTANCE_M } from "./config";

function makeGhost(lookingRef: { current: boolean }) {
  return { isLooking: () => lookingRef.current };
}

test("first step advances by STEP_DISTANCE_M when ghost is not looking", () => {
  const looking = { current: false };
  const player = new Player(makeGhost(looking));
  const result = player.step("left");
  assert.deepEqual(result, { kind: "advanced", distanceAfter: STEP_DISTANCE_M, finished: false });
});

test("repeating the same foot is rejected without moving or penalizing", () => {
  const looking = { current: false };
  const player = new Player(makeGhost(looking));
  player.step("left");
  const result = player.step("left");
  assert.deepEqual(result, { kind: "rejected-no-alternate" });
  assert.equal(player.distance, STEP_DISTANCE_M);
  assert.equal(player.score, 3);
});

test("stepping while the ghost is looking deducts a point and does not advance", () => {
  const looking = { current: true };
  const player = new Player(makeGhost(looking));
  const result = player.step("left");
  assert.deepEqual(result, { kind: "caught", scoreAfter: 2, eliminated: false });
  assert.equal(player.distance, 0);
});

test("three catches eliminate the player and further steps are rejected", () => {
  const looking = { current: true };
  const player = new Player(makeGhost(looking));
  player.step("left");
  player.step("right");
  const third = player.step("left");
  assert.deepEqual(third, { kind: "caught", scoreAfter: 0, eliminated: true });
  assert.equal(player.eliminated, true);

  const after = player.step("right");
  assert.deepEqual(after, { kind: "rejected-no-alternate" });
});

test("distance caps exactly at FINISH_DISTANCE_M and sets finished", () => {
  const looking = { current: false };
  const player = new Player(makeGhost(looking));
  let foot: "left" | "right" = "left";
  let last;
  for (let i = 0; i < 200 && !player.finished; i++) {
    last = player.step(foot);
    foot = foot === "left" ? "right" : "left";
  }
  assert.equal(player.finished, true);
  assert.equal(player.distance, FINISH_DISTANCE_M);
  assert.equal(last?.kind, "advanced");
  if (last?.kind === "advanced") assert.equal(last.finished, true);
});

test("a distanceMultiplier (PRD 22.2 speed boost) scales the advanced distance", () => {
  const looking = { current: false };
  const player = new Player(makeGhost(looking));
  const result = player.step("left", 1.5);
  assert.deepEqual(result, { kind: "advanced", distanceAfter: STEP_DISTANCE_M * 1.5, finished: false });
});

test("a boosted step still respects the finish-distance cap", () => {
  const looking = { current: false };
  const player = new Player(makeGhost(looking));
  player.distance = FINISH_DISTANCE_M - 0.1;
  const result = player.step("left", 5);
  assert.deepEqual(result, { kind: "advanced", distanceAfter: FINISH_DISTANCE_M, finished: true });
});

test("reset() restores initial state", () => {
  const looking = { current: true };
  const player = new Player(makeGhost(looking));
  player.step("left");
  player.reset();
  assert.equal(player.distance, 0);
  assert.equal(player.score, 3);
  assert.equal(player.lastFoot, null);
  assert.equal(player.eliminated, false);
  assert.equal(player.finished, false);
});

test("an injected maxScore of 1 means a single catch eliminates the player", () => {
  const looking = { current: true };
  const player = new Player(makeGhost(looking), 1);
  assert.equal(player.score, 1);
  assert.deepEqual(player.step("left"), { kind: "caught", scoreAfter: 0, eliminated: true });
});

test("an injected stepDistanceM overrides the default step length", () => {
  const looking = { current: false };
  const player = new Player(makeGhost(looking), 3, 0.25);
  assert.deepEqual(player.step("left"), { kind: "advanced", distanceAfter: 0.25, finished: false });
});

test("configure() applies new room settings and resets the player to the new max score", () => {
  const looking = { current: true };
  const player = new Player(makeGhost(looking), 3, 0.4);
  player.step("left"); // score 3 -> 2
  player.configure(2, 0.25);
  assert.equal(player.score, 2);
  assert.equal(player.lastFoot, null);
  looking.current = false;
  assert.deepEqual(player.step("left"), { kind: "advanced", distanceAfter: 0.25, finished: false });
});

test("custom distance governs finishing and boosted steps cap at the configured line", () => {
  const player = new Player({ isLooking: () => false }, 3, STEP_DISTANCE_M, 72.4);
  player.distance = 50;
  assert.deepEqual(player.step("left"), { kind: "advanced", distanceAfter: 50.32, finished: false });
  player.distance = 72.3;
  assert.deepEqual(player.step("right", 1.5), { kind: "advanced", distanceAfter: 72.4, finished: true });
  player.configure(2, STEP_DISTANCE_M, 0.5);
  assert.equal(player.finished, false);
  player.step("left");
  assert.deepEqual(player.step("right"), { kind: "advanced", distanceAfter: 0.5, finished: true });
  player.reset();
  player.step("left");
  assert.equal(player.step("right").kind, "advanced");
  assert.equal(player.distance, 0.5);
});
