import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_GAME_DURATION_MS, RECONNECT_GRACE_MS } from "shared";
import { GameRoom } from "./GameRoom";

function scriptedRng(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

/** rng 讓 LOOK_AWAY 一律最短(5000ms)、且第一次決策一律走真轉身而非假動作，方便測試精準對時。 */
function noFakeTurnRng(): () => number {
  return scriptedRng([0, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9]);
}

test("join rejects new players after the game has started, but reconnect (same id) is allowed", () => {
  const room = new GameRoom("AB12", "host1", noFakeTurnRng());
  assert.deepEqual(room.join("p1", "Alice"), { ok: true });
  room.startGame(0);

  const newJoin = room.join("p2", "Bob");
  assert.deepEqual(newJoin, { ok: false, error: "GAME_ALREADY_STARTED" });

  const reconnect = room.join("p1", "Alice");
  assert.deepEqual(reconnect, { ok: true });
});

test("name validation: length and case-insensitive uniqueness", () => {
  const room = new GameRoom("AB12", "host1");
  assert.deepEqual(room.join("p1", ""), { ok: false, error: "NAME_INVALID" });
  assert.deepEqual(room.join("p1", "12345678901"), { ok: false, error: "NAME_INVALID" });
  assert.deepEqual(room.join("p1", "Alice"), { ok: true });
  assert.deepEqual(room.join("p2", "ALICE"), { ok: false, error: "NAME_TAKEN" });
  assert.deepEqual(room.join("p2", "Bob"), { ok: true });
});

test("room full rejects joins beyond the max player cap", () => {
  const room = new GameRoom("AB12", "host1");
  for (let i = 0; i < 100; i++) {
    assert.deepEqual(room.join(`p${i}`, `n${i}`), { ok: true });
  }
  assert.deepEqual(room.join("overflow", "Overflow"), { ok: false, error: "ROOM_FULL" });
});

test("countdown ticks, GO, then transitions to PLAYING and creates the ghost", () => {
  const room = new GameRoom("AB12", "host1", noFakeTurnRng());
  room.join("p1", "Alice");
  room.startGame(0);
  assert.equal(room.phase, "COUNTDOWN");

  assert.deepEqual(room.tick(1000), [{ type: "countdownTick", value: 2 }]);
  assert.deepEqual(room.tick(2000), [{ type: "countdownTick", value: 1 }]);
  assert.deepEqual(room.tick(3000), [{ type: "countdownTick", value: "GO" }]);
  assert.equal(room.phase, "COUNTDOWN");

  const events = room.tick(3500);
  assert.deepEqual(events, [{ type: "phaseChanged" }, { type: "ghostStateChanged" }]);
  assert.equal(room.phase, "PLAYING");
  assert.ok(room.ghost);
});

test("a step during the LOOKING window is judged as caught, driven purely by tick()-advanced ghost state", () => {
  const room = new GameRoom("AB12", "host1", noFakeTurnRng());
  room.join("p1", "Alice");
  room.startGame(0);
  room.tick(1000);
  room.tick(2000);
  room.tick(3000);
  room.tick(3500); // now PLAYING, ghost LOOK_AWAY started at 3500, duration 5000 -> ends at 8500

  assert.deepEqual(room.tick(8500), [{ type: "ghostStateChanged" }]); // -> TURNING_TO_LOOK (400ms)
  assert.deepEqual(room.tick(8900), [{ type: "ghostStateChanged" }]); // -> LOOKING (1800ms)
  assert.equal(room.ghost?.getState(), "LOOKING");

  const outcome = room.applyStep("p1", "left", 8950);
  assert.ok(outcome.ok);
  if (outcome.ok) {
    assert.deepEqual(outcome.result, { kind: "caught", scoreAfter: 2, eliminated: false });
    assert.equal(outcome.ghostChanged, false);
    assert.equal(outcome.concluded, null);
  }
});

test("three catches eliminate the sole player and conclude the game as all-eliminated", () => {
  const room = new GameRoom("AB12", "host1", noFakeTurnRng());
  room.join("p1", "Alice");
  room.startGame(0);
  room.tick(1000);
  room.tick(2000);
  room.tick(3000);
  room.tick(3500);
  room.tick(8500);
  room.tick(8900); // LOOKING window open until 10700

  room.applyStep("p1", "left", 8950);
  room.applyStep("p1", "right", 9000);
  const third = room.applyStep("p1", "left", 9050);
  assert.ok(third.ok);
  if (third.ok) {
    assert.deepEqual(third.result, { kind: "caught", scoreAfter: 0, eliminated: true });
    assert.equal(third.concluded, "all-eliminated");
  }
  assert.equal(room.phase, "GAME_OVER");
  assert.equal(room.getLastGameOverReason(), "all-eliminated");
  const ranking = room.getLastRanking();
  assert.equal(ranking.length, 1);
  assert.equal(ranking[0].outcome, "eliminated");

  const afterGameOver = room.applyStep("p1", "left", 9100);
  assert.deepEqual(afterGameOver, { ok: false, error: "ROOM_NOT_PLAYING" });
});

test("pause/resume shifts the ghost's clock so the remaining time-until-transition is preserved", () => {
  const room = new GameRoom("AB12", "host1", noFakeTurnRng());
  room.join("p1", "Alice");
  room.startGame(0);
  room.tick(1000);
  room.tick(2000);
  room.tick(3000);
  room.tick(3500); // PLAYING starts at 3500, LOOK_AWAY due to end at 8500

  assert.deepEqual(room.pause(4000), { ok: true });
  assert.equal(room.phase, "PAUSED");
  // "wall clock" keeps moving for 100000ms while paused, but that must not count against the ghost's timer
  assert.deepEqual(room.resume(104000), { ok: true });
  assert.equal(room.phase, "PLAYING");

  // shifted boundary: original 8500 + (104000-4000) delta = 108500
  assert.deepEqual(room.tick(108499), []);
  assert.equal(room.ghost?.getState(), "LOOK_AWAY");
  assert.deepEqual(room.tick(108500), [{ type: "ghostStateChanged" }]);
});

test("the round auto-concludes once MAX_GAME_DURATION_MS is reached", () => {
  const room = new GameRoom("AB12", "host1", noFakeTurnRng());
  room.join("p1", "Alice");
  room.startGame(0);
  room.tick(1000);
  room.tick(2000);
  room.tick(3000);
  room.tick(3500);

  const events = room.tick(3500 + MAX_GAME_DURATION_MS);
  assert.ok(events.some((e) => e.type === "gameOver" && e.reason === "time-limit"));
  assert.equal(room.phase, "GAME_OVER");
});

test("restart resets a GAME_OVER room back to WAITING with scores restored", () => {
  const room = new GameRoom("AB12", "host1", noFakeTurnRng());
  room.join("p1", "Alice");
  room.startGame(0);
  assert.deepEqual(room.forceEndGame(), { ok: true });
  assert.equal(room.phase, "GAME_OVER");

  assert.deepEqual(room.restart(), { ok: true });
  assert.equal(room.phase, "WAITING");
  const summary = room.toSnapshot(0).players[0];
  assert.equal(summary.score, 3);
  assert.equal(summary.distance, 0);

  assert.deepEqual(room.restart(), { ok: false, error: "ROOM_NOT_GAME_OVER" });
});

test("forceEndGame is rejected from WAITING", () => {
  const room = new GameRoom("AB12", "host1");
  room.join("p1", "Alice");
  assert.deepEqual(room.forceEndGame(), { ok: false, error: "ROOM_NOT_ACTIVE" });
});

test("a disconnected player is preserved during the grace window, then marked timed-out and eliminated", () => {
  const room = new GameRoom("AB12", "host1");
  room.join("p1", "Alice");
  room.markPlayerDisconnected("p1", 0);

  assert.deepEqual(room.tick(RECONNECT_GRACE_MS - 1), []);
  assert.equal(room.toSnapshot(0).players[0].connected, false);
  assert.equal(room.toSnapshot(0).players[0].disconnectedPermanently, undefined);

  const events = room.tick(RECONNECT_GRACE_MS);
  assert.deepEqual(events, [{ type: "playerConnectionChanged", playerId: "p1", connected: false, timedOut: true }]);
  assert.equal(room.toSnapshot(0).players[0].disconnectedPermanently, true);
});

test("isAbandoned is true only once both the host and every player are disconnected", () => {
  const room = new GameRoom("AB12", "host1");
  room.join("p1", "Alice");
  assert.equal(room.isAbandoned(), false, "a connected player keeps the room alive even with no host socket");

  room.markPlayerDisconnected("p1", 0);
  assert.equal(room.isAbandoned(), true, "no connected players and no host socket means abandoned");

  room.attachHostSocket("host-socket-1");
  assert.equal(room.isAbandoned(), false, "an attached host socket keeps the room alive");
});
