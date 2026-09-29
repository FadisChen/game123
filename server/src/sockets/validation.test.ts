import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isPlayerJoinRoomPayload,
  isPlayerReactionPayload,
  isPlayerStepPayload,
  isHostRoomActionPayload,
} from "./validation";

test("socket payload validators reject malformed and unexpected fields", () => {
  assert.equal(isHostRoomActionPayload({}), true);
  assert.equal(isHostRoomActionPayload({ roomCode: "ABCD" }), false);
  assert.equal(
    isPlayerJoinRoomPayload({ roomCode: "ABCD", name: "Alice" }),
    true,
  );
  assert.equal(
    isPlayerJoinRoomPayload({
      roomCode: "ABCD",
      name: "Alice",
      playerId: "spoof",
    }),
    false,
  );
  assert.equal(isPlayerStepPayload({ foot: "left", clientSeq: 1 }), true);
  assert.equal(
    isPlayerStepPayload({ foot: "left", clientSeq: 1, playerId: "spoof" }),
    false,
  );
  assert.equal(
    isPlayerStepPayload({ foot: "left", clientSeq: Number.NaN }),
    false,
  );
  assert.equal(isPlayerReactionPayload({ emoji: "🔥" }), true);
  assert.equal(isPlayerReactionPayload({ emoji: "<script>" }), false);
  assert.equal(isPlayerReactionPayload({ emoji: "🔥", name: "spoof" }), false);
});
