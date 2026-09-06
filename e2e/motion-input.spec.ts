import { test, expect, type Page } from "@playwright/test";

async function emitVerticalMotion(page: Page, y: number): Promise<void> {
  await page.evaluate((value) => {
    const event = new Event("devicemotion");
    Object.defineProperty(event, "acceleration", { value: { x: 0, y: value, z: 0 } });
    window.dispatchEvent(event);
  }, y);
}

test("motion mode turns one vertical shake into alternating steps", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const playerContext = await browser.newContext({ viewport: { width: 900, height: 420 } });
  const host = await hostContext.newPage();
  const player = await playerContext.newPage();
  const sent: string[] = [];

  try {
    await host.goto("/host.html");
    const roomCode = (await host.locator(".room-code").textContent())!.trim();
    await host.getByRole("button", { name: "感應式", exact: true }).click();
    await expect(host.getByRole("button", { name: "感應式", exact: true })).toHaveAttribute("aria-pressed", "true");

    await player.addInitScript(() => {
      class MockDeviceMotionEvent {}
      Object.assign(MockDeviceMotionEvent, { requestPermission: async () => "granted" });
      Object.defineProperty(window, "DeviceMotionEvent", { configurable: true, value: MockDeviceMotionEvent });
    });
    player.on("websocket", (socket) => {
      socket.on("framesent", ({ payload }) => {
        const text = String(payload);
        if (!text.includes('["player:step",')) return;
        sent.push(JSON.parse(text.slice(text.indexOf("[")))[1].foot);
      });
    });

    await player.goto(`/join/${roomCode}`);
    await player.getByPlaceholder("你的名字").fill("Motion");
    await player.getByRole("button", { name: "加入遊戲" }).click();
    await player.getByRole("button", { name: "我知道了" }).click();
    await expect(player.locator(".step-hint")).toHaveText("上下晃動，一次前進一步");

    for (let i = 0; i < 7; i++) await emitVerticalMotion(player, 0);
    await host.getByRole("button", { name: "開始遊戲" }).click();
    await expect(player.locator(".player-controls")).toBeVisible();
    await expect(player.locator(".foot-button--left")).toBeHidden();

    await emitVerticalMotion(player, 4);
    await emitVerticalMotion(player, 4);
    await expect.poll(() => sent.length).toBe(1);
    await expect.poll(() => sent[0]).toBe("left");

    await emitVerticalMotion(player, 0);
    await player.waitForTimeout(400);
    await emitVerticalMotion(player, 4);
    await expect.poll(() => sent.length).toBe(2);
    expect(sent).toEqual(["left", "right"]);
  } finally {
    await hostContext.close();
    await playerContext.close();
  }
});

test("motion mode falls back to foot buttons when the sensor never reports data", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const playerContext = await browser.newContext({ viewport: { width: 900, height: 420 } });
  const host = await hostContext.newPage();
  const player = await playerContext.newPage();

  try {
    await host.goto("/host.html");
    const roomCode = (await host.locator(".room-code").textContent())!.trim();
    await host.getByRole("button", { name: "感應式", exact: true }).click();

    await player.addInitScript(() => {
      class MockDeviceMotionEvent {}
      Object.assign(MockDeviceMotionEvent, { requestPermission: async () => "granted" });
      Object.defineProperty(window, "DeviceMotionEvent", { configurable: true, value: MockDeviceMotionEvent });
    });
    await player.goto(`/join/${roomCode}`);
    await player.getByPlaceholder("你的名字").fill("Fallback");
    await player.getByRole("button", { name: "加入遊戲" }).click();
    await player.getByRole("button", { name: "我知道了" }).click();
    await host.getByRole("button", { name: "開始遊戲" }).click();
    await player.waitForTimeout(1600);
    await expect(player.locator(".foot-button--left")).toBeVisible();
    await expect(player.locator(".step-hint")).toHaveText("感應不可用 · 點按左右腳備援");
    await player.getByRole("button", { name: "左腳" }).click();
  } finally {
    await hostContext.close();
    await playerContext.close();
  }
});
