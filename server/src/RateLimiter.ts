interface WindowState {
  startedAt: number;
  count: number;
}

/** Fixed-window limiter for the single-process deployment. The clock is injected for deterministic tests. */
export class RateLimiter {
  private readonly windows = new Map<string, WindowState>();
  private readonly windowMs: number;
  private readonly maxCount: number;

  constructor(windowMs: number, maxCount: number) {
    this.windowMs = windowMs;
    this.maxCount = maxCount;
  }

  allow(key: string, now: number): boolean {
    const current = this.windows.get(key);
    if (!current || now - current.startedAt >= this.windowMs) {
      this.windows.set(key, { startedAt: now, count: 1 });
      return true;
    }
    if (current.count >= this.maxCount) return false;
    current.count += 1;
    return true;
  }

  clear(key: string): void {
    this.windows.delete(key);
  }
}
