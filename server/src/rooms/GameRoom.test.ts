import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_ROOM_SETTINGS,
  DIFFICULTY_PROFILES,
  GHOST_LOOKING_DURATION_MS,
  GHOST_LOOK_AWAY_MIN_MS,
  GHOST_TURN_DURATION_MS,
  MAX_GAME_DURATION_MS,
  RECONNECT_GRACE_MS,
  SPEED_BOOST_CHECK_INTERVAL_MS,
  SPEED_BOOST_DURATION_MS,
  SPEED_BOOST_MULTIPLIER,
  STEP_DISTANCE_M,
} from "shared";
import { GameRoom, type RoomEvent } from "./GameRoom";

/**
 * 鬼的時間點一律由預設難度的常數推導，難度表調整時測試會自動跟著走。
 * 起算點：倒數 3 秒 + GO 之後的 500ms，房間在 3500ms 進入 PLAYING。
 */
const PLAYING_STARTS_AT = 3500;
const LOOK_AWAY_1_END = PLAYING_STARTS_AT + GHOST_LOOK_AWAY_MIN_MS;
const TURNING_TO_LOOK_END = LOOK_AWAY_1_END + GHOST_TURN_DURATION_MS;
const LOOKING_END = TURNING_TO_LOOK_END + GHOST_LOOKING_DURATION_MS;
const TURNING_AWAY_END = LOOKING_END + GHOST_TURN_DURATION_MS;

/**
 * 只留下加速事件。鬼的狀態轉換與加速排程是兩套獨立的時鐘，週期長度不同，時間點難免交錯；
 * 加速測試只關心加速，過濾掉鬼的事件比去對兩套時鐘的最小公倍數穩健得多。
 */
function boostEventsOnly(events: RoomEvent[]): RoomEvent[] {
  return events.filter((event) => event.type !== "ghostStateChanged");
}

function scriptedRng(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

function alwaysRng(value: number): () => number {
  return () => value;
}

/** rng 讓 LOOK_AWAY 一律最短、且第一次決策一律走真轉身而非假動作，方便測試精準對時。 */
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
 * 把一個房間走到 PLAYING 且鬼已經跑完第一輪回頭、停在下一次 LOOK_AWAY 的狀態。
 * （update() 每次呼叫最多只追上一次轉換，中間的時間點一定要一步一步 tick 過，否則會在檢查點當下
 * 補一次遲到的轉換。）加速測試另外用 boostEventsOnly() 濾掉鬼的事件。
 */
function roomSettledIntoPlaying(rng: () => number, boostRng: () => number, extraPlayerIds: string[] = []): GameRoom {
  const room = new GameRoom("AB12", "host1", rng, boostRng);
  room.join("p1", "Alice");
  for (const id of extraPlayerIds) room.join(id, id);
  room.startGame(0);
  room.tick(1000);
  room.tick(2000);
  room.tick(3000);
  room.tick(PLAYING_STARTS_AT); // PLAYING begins, ghost enters LOOK_AWAY
  room.tick(LOOK_AWAY_1_END); // -> TURNING_TO_LOOK
  room.tick(TURNING_TO_LOOK_END); // -> LOOKING
  room.tick(LOOKING_END); // -> TURNING_AWAY
  room.tick(TURNING_AWAY_END); // -> LOOK_AWAY again
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
  room.tick(PLAYING_STARTS_AT); // now PLAYING, ghost LOOK_AWAY starts here

  assert.deepEqual(room.tick(LOOK_AWAY_1_END), [{ type: "ghostStateChanged" }]); // -> TURNING_TO_LOOK
  assert.deepEqual(room.tick(TURNING_TO_LOOK_END), [{ type: "ghostStateChanged" }]); // -> LOOKING
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
  room.tick(LOOK_AWAY_1_END);
  room.tick(TURNING_TO_LOOK_END); // LOOKING window now open

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
  room.tick(PLAYING_STARTS_AT); // PLAYING starts, LOOK_AWAY due to end at LOOK_AWAY_1_END

  assert.deepEqual(room.pause(4000), { ok: true });
  assert.equal(room.phase, "PAUSED");
  // "wall clock" keeps moving for 100000ms while paused, but that must not count against the ghost's timer
  assert.deepEqual(room.resume(104000), { ok: true });
  assert.equal(room.phase, "PLAYING");

  // shifted boundary: the original deadline plus the (104000-4000) paused delta
  const shiftedBoundary = LOOK_AWAY_1_END + 100000;
  assert.deepEqual(room.tick(shiftedBoundary - 1), []);
  assert.equal(room.ghost?.getState(), "LOOK_AWAY");
  assert.deepEqual(room.tick(shiftedBoundary), [{ type: "ghostStateChanged" }]);
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
  const firstRollAt = PLAYING_STARTS_AT + SPEED_BOOST_CHECK_INTERVAL_MS;

  const activateEvents = boostEventsOnly(room.tick(firstRollAt));
  assert.deepEqual(activateEvents, [
    { type: "playerBoostChanged", playerId: "p1", boosted: true, untilMs: firstRollAt + SPEED_BOOST_DURATION_MS },
  ]);
  assert.equal(room.toSnapshot(firstRollAt + 1).players[0].boosted, true);

  const expiryAt = firstRollAt + SPEED_BOOST_DURATION_MS;
  const expireEvents = boostEventsOnly(room.tick(expiryAt));
  assert.deepEqual(expireEvents, [{ type: "playerBoostChanged", playerId: "p1", boosted: false }]);
  assert.equal(room.toSnapshot(expiryAt + 1).players[0].boosted, undefined);
});

test("a losing boost roll produces no event and reschedules the next check", () => {
  const room = roomSettledIntoPlaying(noFakeTurnRng(), alwaysRng(0.9)); // 0.9 >= SPEED_BOOST_CHANCE always loses
  const firstRollAt = PLAYING_STARTS_AT + SPEED_BOOST_CHECK_INTERVAL_MS;
  assert.deepEqual(boostEventsOnly(room.tick(firstRollAt)), []);
  assert.equal(room.toSnapshot(firstRollAt).players[0].boosted, undefined);
});

test("a step taken during an active boost window advances by SPEED_BOOST_MULTIPLIER, and reverts once expired", () => {
  const room = roomSettledIntoPlaying(noFakeTurnRng(), alwaysRng(0.1));
  const boostStartsAt = PLAYING_STARTS_AT + SPEED_BOOST_CHECK_INTERVAL_MS;
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

  const firstRollAt = PLAYING_STARTS_AT + SPEED_BOOST_CHECK_INTERVAL_MS;
  const events = boostEventsOnly(room.tick(firstRollAt));
  assert.deepEqual(events, [{ type: "playerBoostChanged", playerId: "p2", boosted: true, untilMs: firstRollAt + SPEED_BOOST_DURATION_MS }]);
});

test("pausing and resuming shifts a pending boost roll so it doesn't fire early off stale wall-clock time", () => {
  const room = roomJustStartedPlaying(noFakeTurnRng(), alwaysRng(0.1));
  room.pause(4000); // only ~500ms of real PLAYING time has elapsed since 3500
  room.resume(104000); // 100000ms of "wall clock" passes while paused

  // If the pause/resume shift were NOT applied, the original roll deadline (PLAYING_STARTS_AT+8000)
  // would already be far in the past the instant we resume, firing here incorrectly.
  const immediatelyAfterResume = room.tick(104001);
  assert.ok(
    !immediatelyAfterResume.some((e) => e.type === "playerBoostChanged"),
    "the boost roll must not fire immediately on resume just because unshifted wall-clock time has passed",
  );
});

// ---------- 主辦方的每場設定（血量／難度） ----------

test("a new room starts on the default settings and reports them in the snapshot", () => {
  const room = new GameRoom("AB12", "host1");
  assert.deepEqual(room.toSnapshot(0).settings, DEFAULT_ROOM_SETTINGS);
});

test("updating settings while WAITING re-configures players already in the room and those joining later", () => {
  const room = new GameRoom("AB12", "host1");
  room.join("p1", "Alice");

  assert.deepEqual(room.updateSettings({ maxScore: 1, difficulty: "hard" }), { ok: true });
  assert.equal(room.toSnapshot(0).players[0].score, 1);

  room.join("p2", "Bob");
  assert.equal(room.players.get("p2")!.player.score, 1);
  assert.deepEqual(room.toSnapshot(0).settings, { maxScore: 1, difficulty: "hard" });
});

test("settings are locked once the round is under way", () => {
  const room = roomJustStartedPlaying(noFakeTurnRng(), alwaysRng(0.9));
  assert.deepEqual(room.updateSettings({ maxScore: 1, difficulty: "hard" }), { ok: false, error: "ROOM_NOT_WAITING" });
  assert.deepEqual(room.toSnapshot(PLAYING_STARTS_AT).settings, DEFAULT_ROOM_SETTINGS);
});

test("a maxScore of 1 room eliminates a player on their first catch", () => {
  const room = new GameRoom("AB12", "host1", noFakeTurnRng(), alwaysRng(0.9));
  room.join("p1", "Alice");
  room.join("p2", "Bob"); // keeps the round alive after p1 is out
  room.updateSettings({ maxScore: 1, difficulty: "normal" });
  room.startGame(0);
  for (const at of [1000, 2000, 3000, PLAYING_STARTS_AT, LOOK_AWAY_1_END, TURNING_TO_LOOK_END]) room.tick(at);

  const caught = room.applyStep("p1", "left", TURNING_TO_LOOK_END + 100);
  assert.ok(caught.ok);
  if (caught.ok) assert.deepEqual(caught.result, { kind: "caught", scoreAfter: 0, eliminated: true });
});

test("the chosen difficulty drives the ghost's timings for that room", () => {
  const room = new GameRoom("AB12", "host1", noFakeTurnRng(), alwaysRng(0.9));
  room.join("p1", "Alice");
  room.updateSettings({ maxScore: 3, difficulty: "hard" });
  room.startGame(0);
  for (const at of [1000, 2000, 3000, PLAYING_STARTS_AT]) room.tick(at);

  const hard = DIFFICULTY_PROFILES.hard;
  assert.equal(room.ghost!.getStateDuration(), hard.ghostLookAwayMinMs);

  room.tick(PLAYING_STARTS_AT + hard.ghostLookAwayMinMs);
  assert.equal(room.ghost!.getStateDuration(), hard.ghostTurnDurationMs);

  room.tick(PLAYING_STARTS_AT + hard.ghostLookAwayMinMs + hard.ghostTurnDurationMs);
  assert.equal(room.ghost!.getState(), "LOOKING");
  assert.equal(room.ghost!.getStateDuration(), hard.ghostLookingDurationMs);
});
