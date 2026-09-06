import { test, expect } from "@playwright/test";

test("player keyboard and touch share stepping rules; portrait and paused play block input", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const host = await hostContext.newPage();
  const playerContext = await browser.newContext({ viewport: { width: 960, height: 540 } });
  const player = await playerContext.newPage();
  const errors: string[] = [];
  const sent: string[] = [];
  const results: string[] = [];
  player.on("pageerror", (error) => errors.push(error.message));
  player.on("websocket", (socket) => {
    socket.on("framesent", ({ payload }) => {
      const text = String(payload);
      if (text.includes('["player:step",')) sent.push(JSON.parse(text.slice(text.indexOf("[")))[1].foot);
    });
    socket.on("framereceived", ({ payload }) => {
      const text = String(payload);
      if (text.includes('["room:playerStepped",')) results.push(JSON.parse(text.slice(text.indexOf("[")))[1].result.kind);
    });
  });
  try {
    await host.goto("/host.html");
    const code = await host.locator(".room-code").textContent();
    await player.goto(`/join/${code}`);
    await player.getByPlaceholder("你的名字").fill("Keyboard");
    await player.keyboard.press("ArrowLeft");
    expect(sent).toHaveLength(0);
    await player.getByRole("button", { name: "加入遊戲" }).click();
    await player.getByRole("button", { name: "我知道了" }).click();
    await player.keyboard.press("ArrowRight");
    expect(sent).toHaveLength(0);
    await host.getByRole("button", { name: "開始遊戲" }).click();
    await expect(player.locator(".player-controls")).toBeVisible();
    await expect(player.locator(".player-hud .game-status")).toHaveCount(0);
    await expect(player.locator(".start-countdown")).toHaveCount(0);
    await player.keyboard.press("ArrowLeft");
    await expect.poll(() => results.length).toBe(1);
    expect(results[0]).toBe("advanced");
    await player.waitForTimeout(140);
    await player.keyboard.press("ArrowLeft");
    await expect.poll(() => results.length).toBe(2);
    expect(results[1]).toBe("rejected-no-alternate");
    await player.waitForTimeout(140);
    await player.keyboard.down("ArrowRight");
    await player.waitForTimeout(160);
    await player.keyboard.down("ArrowRight"); // repeat=true：不能連踩。
    await player.keyboard.up("ArrowRight");
    await expect.poll(() => sent.length).toBe(3);
    expect(sent).toEqual(["left", "left", "right"]);
    await player.getByRole("button", { name: "左腳" }).click();
    await expect.poll(() => sent.length).toBe(4);

    await player.setViewportSize({ width: 390, height: 844 });
    await expect(player.getByRole("dialog", { name: "轉個方向，準備出發" })).toBeVisible();
    expect(await player.locator("#app").evaluate((app: HTMLElement) => app.inert)).toBe(true);
    await player.keyboard.press("ArrowRight");
    await player.locator(".foot-button--right").dispatchEvent("pointerdown", { button: 0 });
    await player.waitForTimeout(160);
    expect(sent).toHaveLength(4);

    await player.setViewportSize({ width: 844, height: 390 });
    await expect(player.locator(".landscape-guard")).toBeHidden();
    expect(await player.locator("#app").evaluate((app: HTMLElement) => app.inert)).toBe(false);
    await player.keyboard.press("ArrowRight");
    await expect.poll(() => sent.length).toBe(5);
    await host.getByRole("button", { name: "暫停遊戲" }).click();
    await expect(player.locator(".player-controls")).toBeHidden();
    await player.keyboard.press("ArrowLeft");
    await player.waitForTimeout(160);
    expect(sent).toHaveLength(5);
    await expect(player.locator(".player-hud .game-status")).toHaveCount(0);
    await host.getByRole("button", { name: "繼續遊戲" }).click();
    await expect(player.locator(".player-controls")).toBeVisible();

    // 可編輯欄位即使出現在遊戲進行中，也不可被快捷鍵攔截。
    await player.evaluate(() => {
      const input = document.createElement("input");
      input.id = "keyboard-focus-check";
      document.body.appendChild(input);
      input.focus();
    });
    await player.keyboard.press("ArrowLeft");
    expect(sent).toHaveLength(5);
    expect(errors).toEqual([]);
  } finally {
    await hostContext.close();
    await playerContext.close();
  }
});

test("offline player also requires landscape and accepts arrow keys", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/player.html?offline=1");
  await expect(page.locator(".landscape-guard")).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.requestFullscreen = async () => { throw new Error("Fullscreen unavailable"); };
  });
  await page.getByRole("button", { name: "開啟橫向全螢幕" }).click();
  await expect(page.locator(".landscape-guard")).toBeVisible();
  await page.setViewportSize({ width: 844, height: 390 });
  await page.getByRole("button", { name: "我知道了" }).click();
  await expect(page.locator(".player-controls")).toBeVisible();
  await page.keyboard.down("ArrowLeft");
  await expect(page.locator(".foot-button--left")).toHaveClass(/is-pressed/);
  await page.keyboard.up("ArrowLeft");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".landscape-guard")).toBeVisible();
  expect(errors).toEqual([]);
});
