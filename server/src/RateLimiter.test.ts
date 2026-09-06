import { test } from "node:test";
import assert from "node:assert/strict";
import { RateLimiter } from "./RateLimiter";

test("RateLimiter rejects bursts and opens a new window after the timeout", () => {
  const limiter = new RateLimiter(1000, 2);
  assert.equal(limiter.allow("client", 100), true);
  assert.equal(limiter.allow("client", 200), true);
  assert.equal(limiter.allow("client", 300), false);
  assert.equal(limiter.allow("client", 1100), true);
});
