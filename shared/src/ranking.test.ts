import { test } from "node:test";
import assert from "node:assert/strict";
import { computeRanking, type RankingInput } from "./ranking";

function player(overrides: Partial<RankingInput> & Pick<RankingInput, "playerId">): RankingInput {
  return {
    name: overrides.playerId,
    distance: 0,
    score: 3,
    finished: false,
    eliminated: false,
    ...overrides,
  };
}

test("finished players are ranked first, ordered by finish sequence ascending", () => {
  const result = computeRanking([
    player({ playerId: "b", finished: true, finishSeq: 2 }),
    player({ playerId: "a", finished: true, finishSeq: 1 }),
  ]);
  assert.deepEqual(result.map((r) => r.playerId), ["a", "b"]);
  assert.equal(result[0].rank, 1);
  assert.equal(result[1].rank, 2);
  assert.ok(result.every((r) => r.outcome === "finished"));
});

test("surviving (not finished, not eliminated) players are ranked by distance descending", () => {
  const result = computeRanking([
    player({ playerId: "near", distance: 5 }),
    player({ playerId: "far", distance: 20 }),
  ]);
  assert.deepEqual(result.map((r) => r.playerId), ["far", "near"]);
  assert.ok(result.every((r) => r.outcome === "surviving"));
});

test("eliminated players are ranked after everyone else, by distance descending among themselves", () => {
  const result = computeRanking([
    player({ playerId: "eliminated-near", eliminated: true, distance: 2 }),
    player({ playerId: "surviving", distance: 1 }),
    player({ playerId: "eliminated-far", eliminated: true, distance: 8 }),
    player({ playerId: "finisher", finished: true, finishSeq: 0 }),
  ]);
  assert.deepEqual(result.map((r) => r.playerId), ["finisher", "surviving", "eliminated-far", "eliminated-near"]);
});

test("ranks are 1-indexed and contiguous", () => {
  const result = computeRanking([player({ playerId: "a" }), player({ playerId: "b" }), player({ playerId: "c" })]);
  assert.deepEqual(result.map((r) => r.rank), [1, 2, 3]);
});
