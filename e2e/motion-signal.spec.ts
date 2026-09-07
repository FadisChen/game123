import { test, expect } from "@playwright/test";

for (const [strength, angle, gravity] of [
  [2.5, 0, false],
  [4, 0, false],
  [2.5, 90, false],
  [2.5, 270, true],
] as const) {
  test(`continuous ${strength} m/s² shakes at ${angle}° (gravity: ${gravity}) register every 240 ms`, async ({
    page,
  }) => {
    await page.goto("/");
    const steps = await page.evaluate(
      async ({ amplitude, angle, gravity }) => {
        const path = "/src/input/MotionInput.ts";
        const { MotionInput } = await import(path);
        const steps: string[] = [];
        let now = 0;
        const originalNow = performance.now;
        performance.now = () => now;
        Object.defineProperty(screen.orientation, "angle", {
          configurable: true,
          value: angle,
        });
        const input = new MotionInput((foot: string) => steps.push(foot));
        const emit = (time: number, y: number) => {
          now = time;
          const event = new Event("devicemotion");
          const value = y + (gravity ? 9.81 : 0);
          const axes =
            angle === 90
              ? { x: value, y: 0, z: 0 }
              : angle === 270
                ? { x: -value, y: 0, z: 0 }
                : { x: 0, y: value, z: 0 };
          Object.defineProperty(
            event,
            gravity ? "accelerationIncludingGravity" : "acceleration",
            { value: axes },
          );
          window.dispatchEvent(event);
        };
        try {
          input.start();
          input.setGameplayActive(true);
          for (let i = 0; i < 7; i++) emit(i * 16, 0);
          for (let i = 0; i < 4; i++) {
            const time = 1000 + i * 240;
            emit(time, amplitude);
            emit(time + 20, amplitude);
            emit(time + 60, 0);
            emit(time + 120, -amplitude);
            emit(time + 180, 0);
          }
          return steps;
        } finally {
          input.stop();
          performance.now = originalNow;
        }
      },
      { amplitude: strength, angle, gravity },
    );
    expect(steps).toEqual(["left", "right", "left", "right"]);
  });
}

test("stationary noise and paused shakes do not consume steps", async ({
  page,
}) => {
  await page.goto("/");
  const steps = await page.evaluate(async () => {
    const path = "/src/input/MotionInput.ts";
    const { MotionInput } = await import(path);
    const steps: string[] = [];
    const input = new MotionInput((foot: string) => steps.push(foot));
    const emit = (y: number) => {
      const event = new Event("devicemotion");
      Object.defineProperty(event, "acceleration", {
        value: { x: 0, y, z: 0 },
      });
      window.dispatchEvent(event);
    };
    try {
      input.start();
      for (let i = 0; i < 7; i++) emit(0);
      emit(4); // 等待開始時晃動，不得消耗第一腳。
      input.setGameplayActive(true);
      for (let i = 0; i < 60; i++) emit(i % 2 ? 0.4 : -0.4);
      emit(4);
      input.setGameplayActive(false);
      emit(0);
      emit(4);
      input.setGameplayActive(true);
      emit(0);
      emit(4);
      return steps;
    } finally {
      input.stop();
    }
  });
  expect(steps).toEqual(["left", "right"]);
});
