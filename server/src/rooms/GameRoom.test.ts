import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_GAME_DURATION_MS,
  RECONNECT_GRACE_MS,
  SPEED_BOOST_CHECK_INTERVAL_MS,
  SPEED_BOOST_DURATION_MS,
  SPEED_BOOST_MULTIPLIER,
  STEP_DISTANCE_M,
} from "shared";
import { GameRoom } from "./GameRoom";

function scriptedRng(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

function alwaysRng(value: number): () => number {
  return () => value;
}

/** rng 讓 LOOK_AWAY 一律最短(5000ms)、且第一次決策一律走真轉身而非假動作，方便測試精準對時。 */
function noFakeTurnRng(): () => number {
  return scriptedRng([0, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9]);
}

/** 把一個房間走到剛進入 PLAYING 的那一刻（now=3500，鬼的第一次 LOOK_AWAY 才剛開始），回傳該房間。 */
function roomJustStartedPlaying(rng: () => number, boostRng: () => number): GameRoom {
  const room = new GameRoom("AB12", "host1", rng, boostRng);
  room.join("p1", "Alice");
  room.startGame(0);
  room.tick(1000);
  room.tick(2000);
  room.tick(3000);
  room.tick(3500);
  return room;
}

/**
 * 把一個房間走到 PLAYING 且鬼已經跑完第一輪回頭、安穩停在下一次 LOOK_AWAY（11100~20600ms）的狀態，
 * 這樣後面的加速測試在這段時間內隨便挑時間點檢查，都不會混到未預期的 ghostStateChanged 事件。
 * （update() 每次呼叫最多只追上一次轉換，中間的時間點一定要一步一步 tick 過，否則會在檢查點當下
 * 補一次遲到的轉換，混進事件陣列。）
 */
function roomSettledIntoPlaying(rng: () => number, boostRng: () => number, extraPlayerIds: string[] = []): GameRoom {
  const room = new GameRoom("AB12", "host1", rng, boostRng);
  room.join("p1", "Alice");
  for (const id of extraPlayerIds) room.join(id, id);
  room.startGame(0);
  room.tick(1000);
  room.tick(2000);
  room.tick(3000);
  room.tick(3500); // PLAYING begins, ghost LOOK_AWAY 3500-8500
  room.tick(8500); // -> TURNING_TO_LOOK 8500-8900
  room.tick(8900); // -> LOOKING 8900-10700
  room.tick(10700); // -> TURNING_AWAY 10700-11100
  room.tick(11100); // -> LOOK_AWAY 11100-20600 (rng call#3 duration fraction 0.9 -> 9500ms)
  return room;
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

// ---------- PRD 22.2 隨機加速 ----------

test("a winning boost roll activates a window, and it later expires on its own tick", () => {
  const room = roomSettledIntoPlaying(noFakeTurnRng(), alwaysRng(0.1)); // 0.1 < SPEED_BOOST_CHANCE always wins
  const firstRollAt = 3500 + SPEED_BOOST_CHECK_INTERVAL_MS;

  const activateEvents = room.tick(firstRollAt);
  assert.deepEqual(activateEvents, [
    { type: "playerBoostChanged", playerId: "p1", boosted: true, untilMs: firstRollAt + SPEED_BOOST_DURATION_MS },
  ]);
  assert.equal(room.toSnapshot(firstRollAt + 1).players[0].boosted, true);

  const expiryAt = firstRollAt + SPEED_BOOST_DURATION_MS;
  const expireEvents = room.tick(expiryAt);
  assert.deepEqual(expireEvents, [{ type: "playerBoostChanged", playerId: "p1", boosted: false }]);
  assert.equal(room.toSnapshot(expiryAt + 1).players[0].boosted, undefined);
});

test("a losing boost roll produces no event and reschedules the next check", () => {
  const room = roomSettledIntoPlaying(noFakeTurnRng(), alwaysRng(0.9)); // 0.9 >= SPEED_BOOST_CHANCE always loses
  const firstRollAt = 3500 + SPEED_BOOST_CHECK_INTERVAL_MS;
  assert.deepEqual(room.tick(firstRollAt), []);
  assert.equal(room.toSnapshot(firstRollAt).players[0].boosted, undefined);
});

test("a step taken during an active boost window advances by SPEED_BOOST_MULTIPLIER, and reverts once expired", () => {
  const room = roomSettledIntoPlaying(noFakeTurnRng(), alwaysRng(0.1));
  const boostStartsAt = 3500 + SPEED_BOOST_CHECK_INTERVAL_MS;
  room.tick(boostStartsAt);

  const boostedStep = room.applyStep("p1", "left", boostStartsAt + 100);
  assert.ok(boostedStep.ok);
  if (boostedStep.ok) {
    assert.deepEqual(boostedStep.result, {
      kind: "advanced",
      distanceAfter: STEP_DISTANCE_M * SPEED_BOOST_MULTIPLIER,
      finished: false,
    });
  }

  // Past expiry, even without an intervening tick() to run the bookkeeping — the multiplier
  // check in applyStep is time-based, so it must self-expire regardless of tick() timing.
  const afterExpiry = boostStartsAt + SPEED_BOOST_DURATION_MS + 100;
  const normalStep = room.applyStep("p1", "right", afterExpiry);
  assert.ok(normalStep.ok);
  if (normalStep.ok) {
    assert.deepEqual(normalStep.result, {
      kind: "advanced",
      distanceAfter: STEP_DISTANCE_M * SPEED_BOOST_MULTIPLIER + STEP_DISTANCE_M,
      finished: false,
    });
  }
});

test("speed boost rolls skip players who are already eliminated or finished", () => {
  // A second player is kept active so the room doesn't auto-conclude the instant p1 is eliminated.
  const room = roomSettledIntoPlaying(noFakeTurnRng(), alwaysRng(0.1), ["p2"]);
  room.players.get("p1")!.player.eliminated = true;

  const firstRollAt = 3500 + SPEED_BOOST_CHECK_INTERVAL_MS;
  const events = room.tick(firstRollAt);
  assert.deepEqual(events, [{ type: "playerBoostChanged", playerId: "p2", boosted: true, untilMs: firstRollAt + SPEED_BOOST_DURATION_MS }]);
});

test("pausing and resuming shifts a pending boost roll so it doesn't fire early off stale wall-clock time", () => {
  const room = roomJustStartedPlaying(noFakeTurnRng(), alwaysRng(0.1));
  room.pause(4000); // only ~500ms of real PLAYING time has elapsed since 3500
  room.resume(104000); // 100000ms of "wall clock" passes while paused

  // If the pause/resume shift were NOT applied, the original roll deadline (3500+8000=11500)
  // would already be far in the past the instant we resume, firing here incorrectly.
  const immediatelyAfterResume = room.tick(104001);
  assert.ok(
    !immediatelyAfterResume.some((e) => e.type === "playerBoostChanged"),
    "the boost roll must not fire immediately on resume just because unshifted wall-clock time has passed",
  );
});
