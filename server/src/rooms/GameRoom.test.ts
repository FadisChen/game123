import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_ROOM_SETTINGS,
  GHOST_TURN_DURATION_MS,
  HIT_LOCKOUT_MS,
  MAX_GAME_DURATION_MS,
  MUSIC_LOOKING_MIN_MS,
  MUSIC_TRACK_DURATION_MS,
  RECONNECT_GRACE_MS,
  SPEED_BOOST_CHECK_INTERVAL_MS,
  SPEED_BOOST_DURATION_MS,
  SPEED_BOOST_MULTIPLIER,
  STEP_DISTANCE_M,
} from "shared";
import { GameRoom, type RoomEvent } from "./GameRoom";

/**
 * 鬼的時間點一律由 MP3 長度與共用節奏常數推導，避免測試寫死播放前等待時間。
 */
const PLAYING_STARTS_AT = 0;
const LOOK_AWAY_1_END = PLAYING_STARTS_AT + MUSIC_TRACK_DURATION_MS;
const TURNING_TO_LOOK_END = LOOK_AWAY_1_END + GHOST_TURN_DURATION_MS;
const LOOKING_END = TURNING_TO_LOOK_END + MUSIC_LOOKING_MIN_MS;
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

/** rng 讓審視時間固定為最短，方便測試精準對時。 */
function noFakeTurnRng(): () => number {
  return scriptedRng([0, 0, 0, 0, 0, 0, 0, 0, 0]);
}

/** 把一個房間走到剛進入 PLAYING 的那一刻（now=0，鬼的第一次 LOOK_AWAY 才剛開始），回傳該房間。 */
function roomJustStartedPlaying(
  rng: () => number,
  boostRng: () => number,
): GameRoom {
  const room = new GameRoom("AB12", "host1", rng, boostRng);
  room.join("p1", "Alice");
  room.startGame(0);
  return room;
}

/**
 * 把一個房間走到 PLAYING 且鬼已經跑完第一輪回頭、停在下一次 LOOK_AWAY 的狀態。
 * （update() 每次呼叫最多只追上一次轉換，中間的時間點一定要一步一步 tick 過，否則會在檢查點當下
 * 補一次遲到的轉換。）加速測試另外用 boostEventsOnly() 濾掉鬼的事件。
 */
function roomSettledIntoPlaying(
  rng: () => number,
  boostRng: () => number,
  extraPlayerIds: string[] = [],
): GameRoom {
  const room = new GameRoom("AB12", "host1", rng, boostRng);
  room.join("p1", "Alice");
  for (const id of extraPlayerIds) room.join(id, id);
  room.startGame(0);
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
  assert.deepEqual(room.join("p1", "12345678901"), {
    ok: false,
    error: "NAME_INVALID",
  });
  assert.deepEqual(room.join("p1", "Alice"), { ok: true });
  assert.deepEqual(room.join("p2", "ALICE"), {
    ok: false,
    error: "NAME_TAKEN",
  });
  assert.deepEqual(room.join("p2", "Bob"), { ok: true });
});

test("room full rejects joins beyond the max player cap", () => {
  const room = new GameRoom("AB12", "host1");
  for (let i = 0; i < 100; i++) {
    assert.deepEqual(room.join(`p${i}`, `n${i}`), { ok: true });
  }
  assert.deepEqual(room.join("overflow", "Overflow"), {
    ok: false,
    error: "ROOM_FULL",
  });
});

test("starting a room enters PLAYING immediately and creates the first music cycle", () => {
  const room = new GameRoom("AB12", "host1", noFakeTurnRng());
  room.join("p1", "Alice");
  assert.deepEqual(room.startGame(0), { ok: true });
  assert.equal(room.phase, "PLAYING");
  assert.ok(room.ghost);
  assert.equal(room.ghost?.getMusicCycle(), 0);
  assert.deepEqual(room.tick(1), []);
});

test("a step during the LOOKING window is judged as caught, driven purely by tick()-advanced ghost state", () => {
  const room = new GameRoom("AB12", "host1", noFakeTurnRng());
  room.join("p1", "Alice");
  room.startGame(0);
  room.tick(PLAYING_STARTS_AT); // now PLAYING, ghost LOOK_AWAY starts here

  assert.deepEqual(room.tick(LOOK_AWAY_1_END), [{ type: "ghostStateChanged" }]); // -> TURNING_TO_LOOK
  assert.deepEqual(room.tick(TURNING_TO_LOOK_END), [
    { type: "ghostStateChanged" },
  ]); // -> LOOKING
  assert.equal(room.ghost?.getState(), "LOOKING");

  const outcome = room.applyStep("p1", "left", TURNING_TO_LOOK_END + 100);
  assert.ok(outcome.ok);
  if (outcome.ok) {
    assert.deepEqual(outcome.result, {
      kind: "caught",
      scoreAfter: 2,
      eliminated: false,
    });
    assert.equal(outcome.ghostChanged, false);
    assert.equal(outcome.concluded, null);
  }
});

test("being caught starts a lockout window where further steps are ignored (no score change, no movement)", () => {
  const room = new GameRoom("AB12", "host1", noFakeTurnRng());
  room.join("p1", "Alice");
  room.startGame(0);
  room.tick(PLAYING_STARTS_AT);
  room.tick(LOOK_AWAY_1_END);
  room.tick(TURNING_TO_LOOK_END); // -> LOOKING

  const caughtAt = TURNING_TO_LOOK_END + 100;
  const caught = room.applyStep("p1", "left", caughtAt);
  assert.ok(caught.ok);
  if (caught.ok) {
    assert.deepEqual(caught.result, {
      kind: "caught",
      scoreAfter: 2,
      eliminated: false,
    });
  }

  // Still inside the lockout: even though the ghost is still LOOKING, the step must be ignored entirely.
  const duringLock = room.applyStep(
    "p1",
    "right",
    caughtAt + HIT_LOCKOUT_MS - 1,
  );
  assert.ok(duringLock.ok);
  if (duringLock.ok) {
    assert.deepEqual(duringLock.result, { kind: "locked", remainingMs: 1 });
  }
  assert.equal(room.players.get("p1")!.player.score, 2);
  assert.equal(room.players.get("p1")!.player.distance, 0);

  // Lockout has just expired: normal judging resumes, whatever the ghost happens to be doing by then.
  const afterLock = room.applyStep("p1", "right", caughtAt + HIT_LOCKOUT_MS);
  assert.ok(afterLock.ok);
  if (afterLock.ok) assert.notEqual(afterLock.result.kind, "locked");
});

test("pausing and resuming shifts a pending hit-lockout so it doesn't expire early off stale wall-clock time", () => {
  const room = new GameRoom("AB12", "host1", noFakeTurnRng());
  room.join("p1", "Alice");
  room.startGame(0);
  room.tick(PLAYING_STARTS_AT);
  room.tick(LOOK_AWAY_1_END);
  room.tick(TURNING_TO_LOOK_END); // -> LOOKING

  const caughtAt = TURNING_TO_LOOK_END + 100;
  room.applyStep("p1", "left", caughtAt); // starts a HIT_LOCKOUT_MS lockout

  room.pause(caughtAt + 500); // only 500ms of the lockout has elapsed
  room.resume(caughtAt + 500 + 100000); // 100000ms of "wall clock" passes while paused

  // If the pause/resume shift were NOT applied, the un-shifted lockout would already be long over.
  const immediatelyAfterResume = room.applyStep(
    "p1",
    "right",
    caughtAt + 500 + 100000 + 1,
  );
  assert.ok(immediatelyAfterResume.ok);
  if (immediatelyAfterResume.ok) {
    assert.equal(immediatelyAfterResume.result.kind, "locked");
  }
});

test("three catches eliminate the sole player and conclude the game as all-eliminated", () => {
  const room = new GameRoom("AB12", "host1", noFakeTurnRng());
  room.join("p1", "Alice");
  room.startGame(0);
  room.tick(PLAYING_STARTS_AT);
  room.tick(LOOK_AWAY_1_END);
  room.tick(TURNING_TO_LOOK_END); // LOOKING window now open

  // Each catch now opens a HIT_LOCKOUT_MS lockout, which outlasts the rest of that LOOKING window,
  // so the next two catches each have to wait for the ghost to cycle all the way back to LOOKING.
  let now = TURNING_TO_LOOK_END + 100;
  room.applyStep("p1", "left", now);
  const waitForNextLookingWindow = (): void => {
    const stateBeforeWait = room.ghost?.getState();
    do {
      now += 100;
      room.tick(now);
    } while (room.ghost?.getState() === stateBeforeWait);
    while (room.ghost?.getState() !== "LOOKING") {
      now += 100;
      room.tick(now);
    }
  };

  waitForNextLookingWindow();
  room.applyStep("p1", "right", now);
  waitForNextLookingWindow();
  const third = room.applyStep("p1", "left", now);
  assert.ok(third.ok);
  if (third.ok) {
    assert.deepEqual(third.result, {
      kind: "caught",
      scoreAfter: 0,
      eliminated: true,
    });
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

  const events = room.tick(MAX_GAME_DURATION_MS);
  assert.ok(
    events.some((e) => e.type === "gameOver" && e.reason === "time-limit"),
  );
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
  assert.deepEqual(room.forceEndGame(), {
    ok: false,
    error: "ROOM_NOT_ACTIVE",
  });
});

test("a disconnected player is preserved during the grace window, then marked timed-out and eliminated", () => {
  const room = new GameRoom("AB12", "host1");
  room.join("p1", "Alice");
  room.markPlayerDisconnected("p1", 0);

  assert.deepEqual(room.tick(RECONNECT_GRACE_MS - 1), []);
  assert.equal(room.toSnapshot(0).players[0].connected, false);
  assert.equal(
    room.toSnapshot(0).players[0].disconnectedPermanently,
    undefined,
  );

  const events = room.tick(RECONNECT_GRACE_MS);
  assert.deepEqual(events, [
    {
      type: "playerConnectionChanged",
      playerId: "p1",
      connected: false,
      timedOut: true,
    },
  ]);
  assert.equal(room.toSnapshot(0).players[0].disconnectedPermanently, true);
});

test("isAbandoned is true only once both the host and every player are disconnected", () => {
  const room = new GameRoom("AB12", "host1");
  room.join("p1", "Alice");
  assert.equal(
    room.isAbandoned(),
    false,
    "a connected player keeps the room alive even with no host socket",
  );

  room.markPlayerDisconnected("p1", 0);
  assert.equal(
    room.isAbandoned(),
    true,
    "no connected players and no host socket means abandoned",
  );

  room.attachHostSocket("host-socket-1");
  assert.equal(
    room.isAbandoned(),
    false,
    "an attached host socket keeps the room alive",
  );
});

// ---------- PRD 22.2 隨機加速 ----------

test("a winning boost roll activates a window, and it later expires on its own tick", () => {
  const room = roomSettledIntoPlaying(noFakeTurnRng(), alwaysRng(0.1)); // 0.1 < SPEED_BOOST_CHANCE always wins
  const firstRollAt = LOOKING_END + SPEED_BOOST_CHECK_INTERVAL_MS;

  const activateEvents = boostEventsOnly(room.tick(firstRollAt));
  assert.deepEqual(activateEvents, [
    { type: "playerBoostChanged", playerId: "p1", boosted: false },
    {
      type: "playerBoostChanged",
      playerId: "p1",
      boosted: true,
      untilMs: firstRollAt + SPEED_BOOST_DURATION_MS,
    },
  ]);
  assert.equal(room.toSnapshot(firstRollAt + 1).players[0].boosted, true);

  const expiryAt = firstRollAt + SPEED_BOOST_DURATION_MS;
  const expireEvents = boostEventsOnly(room.tick(expiryAt));
  assert.deepEqual(expireEvents, [
    { type: "playerBoostChanged", playerId: "p1", boosted: false },
  ]);
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

  const firstRollAt = LOOKING_END + SPEED_BOOST_CHECK_INTERVAL_MS;
  const events = boostEventsOnly(room.tick(firstRollAt));
  assert.deepEqual(events, [
    { type: "playerBoostChanged", playerId: "p2", boosted: false },
    {
      type: "playerBoostChanged",
      playerId: "p2",
      boosted: true,
      untilMs: firstRollAt + SPEED_BOOST_DURATION_MS,
    },
  ]);
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

// ---------- 主辦方的每場設定（血量／玩家玩法） ----------

test("a new room starts on the default settings and reports them in the snapshot", () => {
  const room = new GameRoom("AB12", "host1");
  assert.deepEqual(room.toSnapshot(0).settings, DEFAULT_ROOM_SETTINGS);
});

test("custom distance applies to existing players, late joins, reconnects and restarted rounds", () => {
  const room = new GameRoom("AB12", "host1", noFakeTurnRng(), alwaysRng(0.9));
  room.join("p1", "Alice");
  room.updateSettings({ ...DEFAULT_ROOM_SETTINGS, finishDistanceM: 0.5 });
  room.join("p2", "Bob");
  room.startGame(0);
  room.markPlayerDisconnected("p1", 1);
  room.join("p1", "Alice");
  assert.equal(room.toSnapshot(2).settings.finishDistanceM, 0.5);
  for (const id of ["p1", "p2"]) {
    room.applyStep(id, "left", 100);
    const result = room.applyStep(id, "right", 200);
    assert.ok(result.ok);
    if (result.ok)
      assert.deepEqual(result.result, {
        kind: "advanced",
        distanceAfter: 0.5,
        finished: true,
        finishedAtMs: 200,
      });
  }
  assert.equal(room.phase, "GAME_OVER");
  assert.ok(room.getLastRanking()!.every((entry) => entry.distance === 0.5));
  room.restart();
  assert.equal(room.toSnapshot(300).settings.finishDistanceM, 0.5);
  room.updateSettings({ ...DEFAULT_ROOM_SETTINGS, finishDistanceM: 80.2 });
  room.startGame(400);
  room.players.get("p1")!.player.distance = 50;
  const result = room.applyStep("p1", "left", 500);
  assert.ok(result.ok);
  if (result.ok)
    assert.deepEqual(result.result, {
      kind: "advanced",
      distanceAfter: 50.32,
      finished: false,
    });
});

test("updating settings while WAITING re-configures players already in the room and those joining later", () => {
  const room = new GameRoom("AB12", "host1");
  room.join("p1", "Alice");

  assert.deepEqual(
    room.updateSettings({
      ...DEFAULT_ROOM_SETTINGS,
      maxScore: 1,
      playerMode: "motion",
    }),
    { ok: true },
  );
  assert.equal(room.toSnapshot(0).players[0].score, 1);

  room.join("p2", "Bob");
  assert.equal(room.players.get("p2")!.player.score, 1);
  assert.deepEqual(room.toSnapshot(0).settings, {
    ...DEFAULT_ROOM_SETTINGS,
    maxScore: 1,
    playerMode: "motion",
  });
});

test("settings are locked once the round is under way", () => {
  const room = roomJustStartedPlaying(noFakeTurnRng(), alwaysRng(0.9));
  assert.deepEqual(
    room.updateSettings({
      ...DEFAULT_ROOM_SETTINGS,
      maxScore: 1,
      playerMode: "motion",
    }),
    { ok: false, error: "ROOM_NOT_WAITING" },
  );
  assert.deepEqual(
    room.toSnapshot(PLAYING_STARTS_AT).settings,
    DEFAULT_ROOM_SETTINGS,
  );
});

test("a maxScore of 1 room eliminates a player on their first catch", () => {
  const room = new GameRoom("AB12", "host1", noFakeTurnRng(), alwaysRng(0.9));
  room.join("p1", "Alice");
  room.join("p2", "Bob"); // keeps the round alive after p1 is out
  room.updateSettings({
    ...DEFAULT_ROOM_SETTINGS,
    maxScore: 1,
    playerMode: "motion",
  });
  room.startGame(0);
  for (const at of [PLAYING_STARTS_AT, LOOK_AWAY_1_END, TURNING_TO_LOOK_END])
    room.tick(at);

  const caught = room.applyStep("p1", "left", TURNING_TO_LOOK_END + 100);
  assert.ok(caught.ok);
  if (caught.ok)
    assert.deepEqual(caught.result, {
      kind: "caught",
      scoreAfter: 0,
      eliminated: true,
    });
});

test("player mode is room-scoped and does not alter the shared ghost timings", () => {
  const room = new GameRoom("AB12", "host1", noFakeTurnRng(), alwaysRng(0.9));
  room.join("p1", "Alice");
  room.updateSettings({
    ...DEFAULT_ROOM_SETTINGS,
    maxScore: 3,
    playerMode: "motion",
  });
  room.startGame(0);
  room.tick(PLAYING_STARTS_AT);
  assert.deepEqual(room.toSnapshot(0).settings, {
    ...DEFAULT_ROOM_SETTINGS,
    maxScore: 3,
    playerMode: "motion",
  });
  assert.equal(room.ghost!.getStateDuration(), MUSIC_TRACK_DURATION_MS);

  room.tick(PLAYING_STARTS_AT + MUSIC_TRACK_DURATION_MS);
  assert.equal(room.ghost!.getStateDuration(), GHOST_TURN_DURATION_MS);
  room.tick(
    PLAYING_STARTS_AT + MUSIC_TRACK_DURATION_MS + GHOST_TURN_DURATION_MS,
  );
  assert.equal(room.ghost!.getState(), "LOOKING");
  assert.equal(room.ghost!.getStateDuration(), MUSIC_LOOKING_MIN_MS);
});

test("session tokens resume only the matching host and player", () => {
  const room = new GameRoom("AB12", "host1", noFakeTurnRng());
  room.join("p1", "Alice");
  const hostToken = room.getHostSessionToken();
  const playerToken = room.getPlayerSessionToken("p1");
  assert.equal(hostToken.length >= 32, true);
  assert.ok(playerToken && playerToken.length >= 32);

  assert.deepEqual(room.resumeHost("wrong-token", "host-new"), {
    ok: false,
    error: "SESSION_INVALID",
  });
  assert.deepEqual(room.resumeHost(hostToken, "host-new"), { ok: true });
  assert.deepEqual(room.resumePlayer("p1", "wrong-token", "player-new"), {
    ok: false,
    error: "SESSION_INVALID",
  });
  assert.deepEqual(room.resumePlayer("p1", playerToken!, "player-new"), {
    ok: true,
  });
  assert.equal(room.players.get("p1")?.socketId, "player-new");
});

test("a stale disconnect cannot replace the current socket", () => {
  const room = new GameRoom("AB12", "host1");
  room.join("p1", "Alice");
  room.attachSocket("p1", "old-socket");
  room.resumePlayer("p1", room.getPlayerSessionToken("p1")!, "new-socket");

  assert.equal(room.markPlayerDisconnected("p1", 100, "old-socket"), false);
  assert.equal(room.players.get("p1")?.connected, true);
  assert.equal(room.markPlayerDisconnected("p1", 100, "new-socket"), true);
  assert.equal(room.players.get("p1")?.connected, false);
});

test("clientSeq makes retries idempotent and limits accepted steps per second", () => {
  const room = roomJustStartedPlaying(noFakeTurnRng(), alwaysRng(0.9));
  const first = room.applyStep("p1", "left", 100, 0);
  assert.equal(first.ok, true);
  if (!first.ok) return;

  const duplicate = room.applyStep("p1", "right", 200, 0);
  assert.deepEqual(duplicate, {
    ok: true,
    result: first.result,
    ghostChanged: false,
    concluded: null,
    duplicate: true,
  });

  for (let seq = 1; seq < 10; seq++) {
    assert.equal(room.applyStep("p1", "left", 300, seq).ok, true);
  }
  assert.deepEqual(room.applyStep("p1", "right", 400, 10), {
    ok: false,
    error: "RATE_LIMITED",
  });
  assert.deepEqual(room.applyStep("p1", "right", 1200, 10).ok, true);
});
