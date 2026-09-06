import { test, expect, type Page } from "@playwright/test";

async function emitVerticalMotion(page: Page, y: number): Promise<void> {
  await page.evaluate((value) => {
    const event = new Event("devicemotion");
    Object.defineProperty(event, "acceleration", {
      value: { x: 0, y: value, z: 0 },
    });
    window.dispatchEvent(event);
  }, y);
}

test("switching an existing first-person player to motion hides the canvas and restores it in main mode", async ({
  browser,
}) => {
  const hostContext = await browser.newContext();
  const playerContext = await browser.newContext({
    viewport: { width: 900, height: 420 },
  });
  const host = await hostContext.newPage();
  const player = await playerContext.newPage();
  try {
    await player.addInitScript(() => {
      class MockDeviceMotionEvent {}
      Object.assign(MockDeviceMotionEvent, {
        requestPermission: async () => "granted",
      });
      Object.defineProperty(window, "DeviceMotionEvent", {
        configurable: true,
        value: MockDeviceMotionEvent,
      });
    });
    await host.goto("/host.html");
    const room = (await host.locator(".room-code").textContent())!.trim();
    await player.goto(`/join/${room}`);
    await player.getByPlaceholder("你的名字").fill("切換模式");
    await player.getByRole("button", { name: "加入遊戲" }).click();
    await player.getByRole("button", { name: "我知道了" }).click();
    await expect(player.locator(".game-canvas")).toBeVisible();
    await host.getByRole("button", { name: "感應式", exact: true }).click();
    await expect(player.locator(".game-canvas")).toBeHidden();
    await player.getByRole("button", { name: "我知道了" }).click();
    for (let i = 0; i < 7; i++) await emitVerticalMotion(player, 0);
    await host.getByRole("button", { name: "開始遊戲" }).click();
    await expect(player.locator(".motion-prompt")).toBeVisible();
    await expect(player.locator(".game-canvas")).toBeHidden();
    await player.screenshot({
      path: "artifacts/ui-previews/motion-player.png",
    });
    await player.setViewportSize({ width: 390, height: 844 });
    await expect(player.locator(".landscape-guard")).toBeHidden();
    await player.screenshot({
      path: "artifacts/ui-previews/motion-player-portrait.png",
    });
    await host.getByRole("button", { name: "結束遊戲" }).click();
    await expect(player.locator(".motion-prompt")).toBeHidden();
    await host.getByRole("button", { name: "關閉排名" }).click();
    await host.getByRole("button", { name: "重新開始" }).click();
    await host.getByRole("button", { name: "主視角", exact: true }).click();
    await expect(player.locator(".landscape-guard")).toBeVisible();
    await player.setViewportSize({ width: 900, height: 420 });
    await expect(player.locator(".landscape-guard")).toBeHidden();
    await player.getByRole("button", { name: "我知道了" }).click();
    await host.getByRole("button", { name: "開始遊戲" }).click();
    await expect(player.locator(".game-canvas")).toBeVisible();
    await expect(player.locator(".foot-button--left")).toBeVisible();
    await expect(player.locator(".motion-prompt")).toBeHidden();
  } finally {
    await hostContext.close();
    await playerContext.close();
  }
});

test("motion mode turns one vertical shake into alternating steps", async ({
  browser,
}) => {
  const hostContext = await browser.newContext();
  const playerContext = await browser.newContext({
    viewport: { width: 900, height: 420 },
  });
  const host = await hostContext.newPage();
  const player = await playerContext.newPage();
  const sent: string[] = [];

  try {
    await host.goto("/host.html");
    const roomCode = (await host.locator(".room-code").textContent())!.trim();
    await host.getByRole("button", { name: "感應式", exact: true }).click();
    await expect(
      host.getByRole("button", { name: "感應式", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");

    await player.addInitScript(() => {
      class MockDeviceMotionEvent {}
      Object.assign(MockDeviceMotionEvent, {
        requestPermission: async () => "granted",
      });
      Object.defineProperty(window, "DeviceMotionEvent", {
        configurable: true,
        value: MockDeviceMotionEvent,
      });
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
    await expect(player.locator(".step-hint")).toHaveText(
      "上下晃動，一次前進一步",
    );

    for (let i = 0; i < 7; i++) await emitVerticalMotion(player, 0);
    await host.getByRole("button", { name: "開始遊戲" }).click();
    await expect(player.locator(".player-controls")).toBeVisible();
    await expect(player.locator(".foot-button--left")).toBeHidden();
    await expect(player.locator(".game-canvas")).toHaveCount(0);
    await expect(player.locator("#app")).toHaveCSS(
      "background-color",
      "rgb(0, 0, 0)",
    );
    await expect(player.locator(".player-hud")).toBeHidden();
    await expect(player.locator(".motion-prompt")).toContainText(
      "請看主辦方畫面",
    );
    await player.setViewportSize({ width: 390, height: 844 });
    await expect(player.locator(".landscape-guard")).toBeHidden();
    await player.keyboard.press("ArrowLeft");
    expect(sent).toEqual([]);

    await emitVerticalMotion(player, 4);
    await emitVerticalMotion(player, 4);
    await expect.poll(() => sent.length).toBe(1);
    await expect.poll(() => sent[0]).toBe("left");

    await player.waitForTimeout(400);
    // 冷卻結束後仍持續收到靜止樣本，才會重新接受下一次晃動。
    await emitVerticalMotion(player, 0);
    await emitVerticalMotion(player, 4);
    await expect.poll(() => sent.length).toBe(2);
    expect(sent).toEqual(["left", "right"]);
    await host.getByRole("button", { name: "暫停遊戲" }).click();
    await expect(player.locator(".motion-prompt")).toContainText("遊戲暫停");
    await player.waitForTimeout(400);
    await emitVerticalMotion(player, 0);
    await emitVerticalMotion(player, 4);
    expect(sent).toHaveLength(2);
    await host.getByRole("button", { name: "繼續遊戲" }).click();
    await expect(player.locator(".motion-prompt")).toContainText(
      "請看主辦方畫面",
    );
  } finally {
    await hostContext.close();
    await playerContext.close();
  }
});

test("motion mode falls back to foot buttons when the sensor never reports data", async ({
  browser,
}) => {
  const hostContext = await browser.newContext();
  const playerContext = await browser.newContext({
    viewport: { width: 900, height: 420 },
  });
  const host = await hostContext.newPage();
  const player = await playerContext.newPage();
  const sent: string[] = [];

  try {
    await host.goto("/host.html");
    const roomCode = (await host.locator(".room-code").textContent())!.trim();
    await host.getByRole("button", { name: "感應式", exact: true }).click();

    await player.addInitScript(() => {
      class MockDeviceMotionEvent {}
      Object.assign(MockDeviceMotionEvent, {
        requestPermission: async () => "granted",
      });
      Object.defineProperty(window, "DeviceMotionEvent", {
        configurable: true,
        value: MockDeviceMotionEvent,
      });
    });
    player.on("websocket", (socket) => {
      socket.on("framesent", ({ payload }) => {
        const text = String(payload);
        if (!text.includes('["player:step",')) return;
        sent.push(JSON.parse(text.slice(text.indexOf("[")))[1].foot);
      });
    });
    await player.goto(`/join/${roomCode}`);
    await player.getByPlaceholder("你的名字").fill("Fallback");
    await player.getByRole("button", { name: "加入遊戲" }).click();
    await player.getByRole("button", { name: "我知道了" }).click();
    await host.getByRole("button", { name: "開始遊戲" }).click();
    await player.waitForTimeout(1600);
    // 感應逾時後改用按鈕：本機沒有真正的感應器，其他玩家若有感應器仍可正常使用直式晃動操作。
    await expect(player.locator(".foot-button--left")).toBeVisible();
    await expect(player.locator(".step-hint")).toHaveText(
      "感應器無法使用，請改用下方左右腳按鈕",
    );
    await expect(player.locator(".game-canvas")).toHaveCount(0);
    await expect(player.locator(".motion-prompt")).toBeVisible();
    await expect(player.locator(".landscape-guard")).toBeHidden();
    await player.locator(".foot-button--left").click();
    await expect.poll(() => sent).toEqual(["left"]);
  } finally {
    await hostContext.close();
    await playerContext.close();
  }
});
