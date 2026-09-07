import { test, expect, type Page, type BrowserContext } from "@playwright/test";

/**
 * 主辦方鏡頭模式（PRD 22.4）回歸測試：確認四種模式（鳥瞰/領先者/落後者/自由鏡頭）都能正確切換、
 * 按鈕高亮狀態正確、切換過程中畫面不會拋錯或黑屏，而且鏡頭真的有依模式移動——
 * 用玩家姓名標籤（HostScene.updateLabel 依 camera.project() 算出的螢幕座標）當作可觀察的證據，
 * 不需要額外開一個只給測試用的內部狀態存取口。
 *
 * 每一個「鏡頭移動後應該怎樣」的斷言都用 expect.poll 而不是固定 waitForTimeout 再讀一次：
 * 主控台頁面在測試過程中大多數時間不是瀏覽器認定的「作用中」分頁（操作焦點在 p0/p1 頁面上踩腳/
 * 拖曳），背景分頁的 requestAnimationFrame 可能被瀏覽器降頻，固定等待偶爾會在畫面真的追上新鏡頭
 * 之前就搶先讀到殘留的舊座標；用輪詢等到條件成立才做斷言可以兩者兼顧。
 */

const CAMERA_MODES = ["birdseye", "leader", "last", "free"] as const;

async function readRoomCode(hostPage: Page): Promise<string> {
  const text = await hostPage
    .locator("div")
    .filter({ hasText: /^[A-Z0-9]{4,6}$/ })
    .first()
    .textContent();
  const roomCode = text?.trim();
  if (!roomCode) throw new Error("讀不到房間代碼");
  return roomCode;
}

async function joinPlayer(context: BrowserContext, baseURL: string, roomCode: string, name: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`${baseURL}/join/${roomCode}`);
  await page.locator('input[placeholder="你的名字"]').fill(name);
  await page.locator("button", { hasText: "加入遊戲" }).click();
  await page.waitForTimeout(500);
  const teachingBtn = page.locator("button", { hasText: "我知道了" });
  if (await teachingBtn.count()) await teachingBtn.click();
  return page;
}

async function readPersistentPlayerId(page: Page): Promise<string> {
  const id = await page.evaluate(() => {
    const raw = localStorage.getItem("123-doll-player-session");
    return raw ? (JSON.parse(raw) as { playerId?: string }).playerId ?? null : null;
  });
  if (!id) throw new Error("讀不到玩家的持久 id");
  return id;
}

/**
 * 讀標籤的 CSS left/top 錨點座標，而不是 boundingBox()——標籤有 transform:translate(-50%,-100%)，
 * boundingBox() 量到的是套用 transform 之後的框，會隨標籤文字內容變寬變窄（例如玩家被隨機加速選中
 * 時多出一個「⚡」圖示）而跟著平移，即使 HostScene 算出來的錨點座標其實完全沒變，因此不能拿來判斷
 * 「鏡頭有沒有動」。標籤目前不存在（camera 剛好把它投影到畫面外，或還沒渲染出來）時回傳 null，
 * 交給呼叫端決定要不要輪詢重試。
 */
async function labelPosition(hostPage: Page, playerId: string): Promise<{ x: number; y: number } | null> {
  const locator = hostPage.locator(`.avatar-label[data-player-id="${playerId}"]`);
  if ((await locator.count()) === 0) return null;
  return locator.evaluate((el: HTMLElement) => {
    if (el.style.display === "none") return null;
    return { x: parseFloat(el.style.left), y: parseFloat(el.style.top) };
  });
}

async function assertOnlyActive(hostPage: Page, activeMode: (typeof CAMERA_MODES)[number]): Promise<void> {
  for (const mode of CAMERA_MODES) {
    await expect(hostPage.locator(`[data-camera-mode="${mode}"]`)).toHaveAttribute("aria-pressed", String(mode === activeMode));
  }
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

test("host control panel can be collapsed and reopened", async ({ page }) => {
  await page.goto("/host.html");
  const panel = page.locator(".host-panel");
  const toggle = page.getByRole("button", { name: "收起主辦方控制面板" });

  await expect(panel).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await toggle.click();
  await expect(page.locator("#app")).toHaveClass(/host-panel-closed/);
  await expect(page.locator(".host-viewport")).toHaveCSS("right", "0px");
  await expect(
    page.getByRole("button", { name: "開啟主辦方控制面板" }),
  ).toHaveAttribute("aria-expanded", "false");

  await page
    .getByRole("button", { name: "開啟主辦方控制面板" })
    .click();
  await expect(page.locator("#app")).not.toHaveClass(/host-panel-closed/);
  await expect(page.locator(".host-viewport")).toHaveCSS("right", "276px");
  await expect(
    page.getByRole("button", { name: "收起主辦方控制面板" }),
  ).toHaveAttribute("aria-expanded", "true");
});

/** 輪詢直到某玩家標籤跟參考點的螢幕距離符合預期關係，抵銷背景分頁 rAF 降頻造成的量測時機誤差。 */
async function pollLabelDistanceFrom(
  hostPage: Page,
  playerId: string,
  reference: { x: number; y: number },
  matcher: (d: number) => boolean,
): Promise<{ x: number; y: number }> {
  let last: { x: number; y: number } | null = null;
  await expect
    .poll(
      async () => {
        last = await labelPosition(hostPage, playerId);
        return last ? matcher(distance(last, reference)) : false;
      },
      { timeout: 8000 },
    )
    .toBe(true);
  return last!;
}

test("host camera modes switch correctly and keep the 3D scene alive", async ({ browser, baseURL }) => {
  // 三個 browser context 各自跑一份 WebGL 場景，在較慢的機器上光是啟動就要數十秒。
  test.setTimeout(180_000);
  const pageErrors: string[] = [];

  const hostContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  hostPage.on("pageerror", (err) => pageErrors.push(`[host] ${err.message}`));
  await hostPage.goto("/host.html");
  await hostPage.waitForSelector("text=123 木頭人");
  const roomCode = await readRoomCode(hostPage);

  const p0Context = await browser.newContext();
  const p1Context = await browser.newContext();
  const p0 = await joinPlayer(p0Context, baseURL!, roomCode, "Leader");
  const p1 = await joinPlayer(p1Context, baseURL!, roomCode, "Straggler");
  p0.on("pageerror", (err) => pageErrors.push(`[p0] ${err.message}`));
  p1.on("pageerror", (err) => pageErrors.push(`[p1] ${err.message}`));

  const p0Id = await readPersistentPlayerId(p0);
  const p1Id = await readPersistentPlayerId(p1);

  await hostPage.locator("button", { hasText: "開始遊戲" }).click();
  await expect(hostPage.locator(".phase-label")).toHaveText("遊戲進行中", { timeout: 15_000 });

  // 只讓 p0 前進，製造出領先/落後的明顯距離差，這樣「領先者/落後者」模式才有意義可以驗證。
  // 踩腳全部塞在第一輪音樂播放期內，避免撞上鬼回頭導致玩家被淘汰；間隔只比按鈕鎖定時間長一點點。
  const leftBtn = p0.locator("button", { hasText: "左腳" });
  const rightBtn = p0.locator("button", { hasText: "右腳" });
  for (let i = 0; i < 8; i++) {
    const btn = i % 2 === 0 ? leftBtn : rightBtn;
    if (!(await btn.isVisible())) break; // 萬一真的被淘汰/抵達終點就提早停止，不要卡住重試
    await btn.click({ timeout: 2000 }).catch(() => {});
    await p0.waitForTimeout(140);
  }

  await expect(hostPage.locator("canvas")).toBeVisible();

  // --- 鳥瞰（baseline） ---
  await assertOnlyActive(hostPage, "birdseye");
  const birdseyeP0 = await labelPosition(hostPage, p0Id);
  const birdseyeP1 = await labelPosition(hostPage, p1Id);
  if (!birdseyeP0 || !birdseyeP1) throw new Error("鳥瞰基準畫面應該要看得到兩位玩家的標籤");

  // --- 領先者：鏡頭應該往前面那位玩家移動，標籤螢幕座標要跟鳥瞰時不一樣 ---
  await hostPage.locator('[data-camera-mode="leader"]').click();
  await assertOnlyActive(hostPage, "leader");
  const leaderP0 = await pollLabelDistanceFrom(hostPage, p0Id, birdseyeP0, (d) => d > 5);

  // --- 落後者：目標玩家不同，鏡頭位置應該跟領先者模式不一樣 ---
  await hostPage.locator('[data-camera-mode="last"]').click();
  await assertOnlyActive(hostPage, "last");
  await pollLabelDistanceFrom(hostPage, p0Id, leaderP0, (d) => d > 5);

  // --- 自由鏡頭：拖曳滑鼠應該能轉動 OrbitControls，畫面跟著變 ---
  await hostPage.locator('[data-camera-mode="free"]').click();
  await assertOnlyActive(hostPage, "free");
  const beforeDrag = await labelPosition(hostPage, p0Id);
  if (!beforeDrag) throw new Error("切到自由鏡頭當下應該還看得到玩家標籤");
  const canvasBox = await hostPage.locator("canvas").boundingBox();
  if (!canvasBox) throw new Error("找不到 canvas");
  const cx = canvasBox.x + canvasBox.width / 2;
  const cy = canvasBox.y + canvasBox.height / 2;
  await hostPage.mouse.move(cx, cy);
  await hostPage.mouse.down();
  await hostPage.mouse.move(cx + 200, cy - 80, { steps: 10 });
  await hostPage.mouse.up();
  await pollLabelDistanceFrom(hostPage, p0Id, beforeDrag, (d) => d > 3);

  // --- 切回鳥瞰：應該回正到跟一開始一樣的機位 ---
  await hostPage.locator('[data-camera-mode="birdseye"]').click();
  await assertOnlyActive(hostPage, "birdseye");
  await pollLabelDistanceFrom(hostPage, p0Id, birdseyeP0, (d) => d < 5);
  await pollLabelDistanceFrom(hostPage, p1Id, birdseyeP1, (d) => d < 5);

  // 四個方向鍵會切到自由鏡頭並持續平移；放開、切離視窗會停止。
  for (const key of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]) {
    const beforeKey = await labelPosition(hostPage, p0Id);
    if (!beforeKey) throw new Error("按方向鍵前應該看得到玩家");
    await hostPage.keyboard.down(key);
    await assertOnlyActive(hostPage, "free");
    await pollLabelDistanceFrom(hostPage, p0Id, beforeKey, (d) => d > 5);
    await hostPage.keyboard.up(key);
    const stopped = await labelPosition(hostPage, p0Id);
    await hostPage.waitForTimeout(180);
    const afterRelease = await labelPosition(hostPage, p0Id);
    expect(distance(stopped!, afterRelease!)).toBeLessThan(1);
    await hostPage.locator('[data-camera-mode="birdseye"]').click();
    await pollLabelDistanceFrom(hostPage, p0Id, birdseyeP0, (d) => d < 5);
  }

  await hostPage.keyboard.down("ArrowUp");
  await pollLabelDistanceFrom(hostPage, p0Id, birdseyeP0, (d) => d > 5);
  await hostPage.evaluate(() => window.dispatchEvent(new Event("blur")));
  const blurred = await labelPosition(hostPage, p0Id);
  await hostPage.waitForTimeout(180);
  expect(distance(blurred!, (await labelPosition(hostPage, p0Id))!)).toBeLessThan(1);
  await hostPage.keyboard.up("ArrowUp");

  await hostPage.locator('[data-camera-mode="birdseye"]').click();
  // 主辦方保留鍵盤與拖曳操作，介面不再顯示方向按鈕。
  await expect(hostPage.getByRole("button", { name: "鏡頭向右" })).toHaveCount(0);

  await expect(hostPage.locator("canvas")).toBeVisible();
  expect(pageErrors, `切換鏡頭模式過程中不應該有任何 JS 例外：${pageErrors.join("; ")}`).toHaveLength(0);
});
