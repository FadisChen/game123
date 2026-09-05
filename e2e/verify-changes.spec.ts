import { test, expect, type BrowserContext, type Page } from "@playwright/test";

async function joinPlayer(context: BrowserContext, baseURL: string, roomCode: string, name: string): Promise<Page> {
  const page = await context.newPage();
  await page.setViewportSize({ width: 900, height: 420 });
  await page.goto(`${baseURL}/join/${roomCode}`);
  await page.locator('input[placeholder="你的名字"]').fill(name);
  await page.locator("button", { hasText: "加入遊戲" }).click();
  await page.waitForTimeout(500);
  const teachingBtn = page.locator("button", { hasText: "我知道了" });
  if (await teachingBtn.count()) await teachingBtn.click();
  return page;
}

test("host settings, player name tags and outcome effects", async ({ browser, baseURL }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];

  const hostPage = await (await browser.newContext()).newPage();
  hostPage.on("pageerror", (e) => errors.push(`[host] ${e.message}`));
  await hostPage.setViewportSize({ width: 1280, height: 720 });
  await hostPage.goto("/host.html");
  await hostPage.waitForSelector("text=123 木頭人");
  const roomCode = (await hostPage.locator("[data-room-code]").getAttribute("data-room-code"))!;

  // --- 主辦方設定：血量 1、難度困難 ---
  await hostPage.getByRole("button", { name: "1", exact: true }).click();
  await expect(hostPage.getByRole("button", { name: "1", exact: true })).toHaveAttribute("aria-pressed", "true");
  await hostPage.getByRole("button", { name: "困難", exact: true }).click();
  await expect(hostPage.getByRole("button", { name: "困難", exact: true })).toHaveAttribute("aria-pressed", "true");

  const p0 = await joinPlayer(await browser.newContext(), baseURL!, roomCode, "阿明");
  const p1 = await joinPlayer(await browser.newContext(), baseURL!, roomCode, "小華");
  p0.on("pageerror", (e) => errors.push(`[p0] ${e.message}`));
  p1.on("pageerror", (e) => errors.push(`[p1] ${e.message}`));

  // 血量設定要在玩家 HUD 上生效：只畫一格愛心。
  await expect(p0.locator(".player-health")).toHaveText("♥");

  await hostPage.getByRole("button", { name: "開始遊戲" }).click();
  await hostPage.waitForTimeout(4000);

  // 設定區塊開打後應該收起來。
  await expect(hostPage.getByRole("button", { name: "困難", exact: true })).toBeHidden();

  await p0.locator("canvas").screenshot({ path: "test-results/verify-player-names.png" });
  await hostPage.locator("canvas").screenshot({ path: "test-results/verify-host-labels.png" });

  // 主辦方角色標籤只剩姓名與狀態，不再有愛心。
  const labels = await hostPage.locator(".avatar-label").allTextContents();
  expect(labels.join(" ")).not.toContain("❤️");
  expect(labels.join(" ")).toContain("阿明");

  // --- 一路踩到被抓：血量 1 + 困難，撞上鬼回頭就立刻出局 ---
  // 用鍵盤而不是點按鈕：按鈕在玩家出局的瞬間會消失，click 會卡在 actionability 等待上。
  for (let i = 0; i < 60; i++) {
    if (await p0.locator('.outcome-overlay[data-outcome="eliminated"]').isVisible()) break;
    await p0.keyboard.press(i % 2 === 0 ? "ArrowLeft" : "ArrowRight");
    await p0.waitForTimeout(140);
  }

  // 名單高亮只有 2 秒、鳥瞰特效只有 1.1 秒，兩者都要在偵測到出局的當下立刻確認。
  await expect(hostPage.locator(".host-player-row.row-flash-out")).toHaveCount(1);
  await hostPage.locator("canvas").screenshot({ path: "test-results/verify-host-effect.png" });
  await expect(p0.locator('.outcome-overlay[data-outcome="eliminated"]')).toBeVisible();
  await p0.screenshot({ path: "test-results/verify-player-eliminated.png" });

  // 旁觀者看得到出局者倒下（名牌換成 💀）。
  await p1.locator("canvas").screenshot({ path: "test-results/verify-spectator.png" });

  expect(errors).toEqual([]);
});

test("other players' name tags are readable from the first-person view", async ({ browser, baseURL }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];

  const hostPage = await (await browser.newContext()).newPage();
  await hostPage.setViewportSize({ width: 1280, height: 720 });
  await hostPage.goto("/host.html");
  await hostPage.waitForSelector("text=123 木頭人");
  const roomCode = (await hostPage.locator("[data-room-code]").getAttribute("data-room-code"))!;
  await hostPage.getByRole("button", { name: "簡單", exact: true }).click();

  // 四位玩家把車道間距壓到 6.3m（兩人時是 19m，彼此剛好落在對方視野外），
  // 再讓 p1 往前跑一段，p0 的第一人稱視角才看得到他頭上的名牌。
  const players = [];
  for (const name of ["阿明", "小華", "阿美", "大雄"]) {
    players.push(await joinPlayer(await browser.newContext(), baseURL!, roomCode, name));
  }
  const [p0, p1] = players;
  p0.on("pageerror", (e) => errors.push(`[p0] ${e.message}`));

  await hostPage.getByRole("button", { name: "開始遊戲" }).click();
  await hostPage.waitForTimeout(4000);

  for (let i = 0; i < 25; i++) {
    await p1.keyboard.press(i % 2 === 0 ? "ArrowLeft" : "ArrowRight");
    await p1.waitForTimeout(130);
  }

  await p0.locator("canvas").screenshot({ path: "test-results/verify-name-tags.png" });
  expect(errors).toEqual([]);
});
