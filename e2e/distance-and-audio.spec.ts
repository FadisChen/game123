import { test, expect, type BrowserContext, type Page } from "@playwright/test";

declare global {
  interface Window {
    shotStarts: number[];
    shotContextStates: AudioContextState[];
  }
}

async function observeShots(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    // 步聲使用即時生成的 noise buffer；只有 shoot.mp3 經過 decodeAudioData。
    const decoded = new WeakSet<AudioBuffer>();
    window.shotStarts = [];
    window.shotContextStates = [];
    const decode = BaseAudioContext.prototype.decodeAudioData;
    BaseAudioContext.prototype.decodeAudioData = function (data: ArrayBuffer) {
      return decode.call(this, data).then((buffer: AudioBuffer) => { decoded.add(buffer); return buffer; });
    };
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      if (this.buffer && decoded.has(this.buffer)) {
        window.shotStarts.push(args[0] ?? this.context.currentTime);
        window.shotContextStates.push(this.context.state);
      }
      return start.apply(this, args);
    };
  });
}

async function join(page: Page, roomCode: string, name: string): Promise<void> {
  await page.goto(`/join/${roomCode}`);
  await page.getByPlaceholder("你的名字").fill(name);
  await page.getByRole("button", { name: "加入遊戲" }).click();
  await page.getByRole("button", { name: "我知道了" }).click();
}

async function shotCount(page: Page): Promise<number> {
  return page.evaluate(() => window.shotStarts.length);
}

test("host distance synchronizes through joins, reconnects, finishing and restart", async ({ browser }) => {
  const contexts = await Promise.all(Array.from({ length: 3 }, () => browser.newContext({ viewport: { width: 1280, height: 720 } })));
  const [host, p0, p1] = await Promise.all(contexts.map((context) => context.newPage()));
  const errors: string[] = [];
  for (const page of [host, p0, p1]) page.on("pageerror", (error) => errors.push(error.message));
  try {
    await host.goto("/host.html");
    const distance = host.getByRole("spinbutton", { name: "遊戲距離（m）", includeHidden: true });
    await expect(distance).toHaveValue("50.0");
    const room = (await host.locator(".room-code").textContent())!.trim();
    await join(p0, room, "先加入");
    await distance.fill("72.4");
    await distance.press("Tab");
    await expect(host.locator(".host-course-distance")).toHaveText("全程 72.4 m");
    await join(p1, room, "後加入");
    await join(p0, room, "先加入"); // 同一個持久 playerId 取得最新快照。
    await host.getByRole("button", { name: "開始遊戲" }).click();
    for (const player of [p0, p1]) {
      await expect(player.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "72.4");
      await expect(player.locator(".crosshair, .mute-button")).toHaveCount(0);
      await expect(player.locator(".preview-sample-note")).toHaveCount(0);
      await expect(player.locator(".player-survivors strong")).toHaveText("2");
    }
    await expect(distance).toBeDisabled();
    await p0.keyboard.press("ArrowLeft");
    await expect(p0.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0.32");
    await expect(p0.locator(".course-progress strong")).toHaveText("距終點 72.1 m");
    await host.getByRole("button", { name: "結束遊戲" }).click();
    await host.getByRole("button", { name: "關閉排名" }).click();
    await host.getByRole("button", { name: "重新開始" }).click();
    await expect(distance).toHaveValue("72.4");
    await distance.fill("0.5");
    await distance.press("Tab");
    await expect(host.locator(".host-course-distance")).toHaveText("全程 0.5 m");
    await host.getByRole("button", { name: "開始遊戲" }).click();
    for (const player of [p0, p1]) {
      await expect(player.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "0.5");
      await player.keyboard.press("ArrowLeft");
      await player.waitForTimeout(150);
      await player.keyboard.press("ArrowRight");
      await expect(player.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0.5");
    }
    await expect(host.getByRole("dialog", { name: "排名結果" })).toBeVisible();
    await expect(host.locator(".ranking-list")).toContainText("0.5 m");
    const dots = await host.locator(".camera-map g circle").evaluateAll((elements) => elements.map((el) => Number(el.getAttribute("cy"))));
    expect(dots).toEqual([28, 28]); // 完賽位置正好落在小地圖的終點線。
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test("each caught event plays one shot on the host and only the affected player", async ({ browser }) => {
  const contexts = await Promise.all(Array.from({ length: 4 }, () => browser.newContext({ viewport: { width: 960, height: 540 } })));
  await Promise.all(contexts.map(observeShots));
  const [host, p0, p1, spectator] = await Promise.all(contexts.map((context) => context.newPage()));
  const errors: string[] = [];
  for (const page of [host, p0, p1, spectator]) page.on("pageerror", (error) => errors.push(error.message));
  try {
    await host.goto("/host.html");
    const room = (await host.locator(".room-code").textContent())!.trim();
    await host.getByRole("button", { name: "2", exact: true }).click();
    await expect(host.getByRole("button", { name: "2", exact: true })).toHaveAttribute("aria-pressed", "true");
    await join(p0, room, "玩家甲");
    await join(p1, room, "玩家乙");
    await join(spectator, room, "未移動");
    await host.getByRole("button", { name: "開始遊戲" }).click();
    await expect(host.locator('.game-status[data-status="looking"]')).toBeVisible({ timeout: 10000 });
    await Promise.all([p0.keyboard.press("ArrowLeft"), p1.keyboard.press("ArrowLeft")]);
    await p0.waitForTimeout(150);
    await p0.keyboard.press("ArrowRight"); // 最後一分扣光也只播放一次。
    await expect(p0.locator('.outcome-overlay[data-outcome="eliminated"]')).toBeVisible();
    await expect.poll(() => shotCount(host)).toBe(3);
    await expect.poll(() => shotCount(p0)).toBe(2);
    expect(await shotCount(p1)).toBe(1);
    expect(await shotCount(spectator)).toBe(0);
    await host.getByRole("button", { name: "暫停遊戲" }).click(); // 完整快照不補播扣分。
    await expect(host.getByRole("button", { name: "繼續遊戲" })).toBeVisible();
    await host.waitForTimeout(250);
    expect(await shotCount(host)).toBe(3);
    expect(await shotCount(p0)).toBe(2);
    const starts = await host.evaluate(() => window.shotStarts);
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(0.119);
    for (const page of [host, p0, p1]) {
      expect(await page.evaluate(() => window.shotContextStates.every((state) => state === "running"))).toBe(true);
    }
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
