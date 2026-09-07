import { chromium } from "playwright";

const url = "https://game123-l0kf.onrender.com/join/6XW3";
const missingNames = [1, 2, 4, 5, 6, 7, 8, 9, 10, 21, 22, 23, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50].map(
  (n) => `Bot${String(n).padStart(2, "0")}`,
);
const browser = await chromium.launch({ headless: true });
const sessions = [];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function join(name) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.locator('input[aria-label="房間代碼"]').fill("6XW3");
    await page.locator('input[aria-label="你的名字"]').fill(name);
    await page.getByRole("button", { name: "加入遊戲" }).click({ noWaitAfter: true });
    const nameInput = page.locator('input[aria-label="你的名字"]');
    const startedError = page.getByText("遊戲已經開始，無法再加入");
    await Promise.race([
      nameInput.waitFor({ state: "detached", timeout: 20_000 }),
      startedError.waitFor({ state: "visible", timeout: 20_000 }),
    ]);
    if (await nameInput.isVisible().catch(() => false)) throw new Error("遊戲已開始，無法補入玩家");
    sessions.push({ context, page, name });
    return { name, ok: true };
  } catch (error) {
    const body = await page.locator("body").innerText().catch(() => "");
    await context.close().catch(() => {});
    return { name, ok: false, error: error instanceof Error ? error.message.split("\n")[0] : String(error), body: body.slice(-160) };
  }
}

const results = [];
for (let start = 0; start < missingNames.length; start += 5) {
  const batch = await Promise.all(missingNames.slice(start, start + 5).map(join));
  results.push(...batch);
  console.log(JSON.stringify({ joined: sessions.length, completed: results.length, batch }));
  await delay(300);
}

console.log(JSON.stringify({ summary: { attempted: results.length, joined: sessions.length, failed: results.length - sessions.length } }));
if (sessions.length > 0) {
  console.log("Waiting for the host to start; then sending alternating left/right steps.");
}

async function drive({ page, name }) {
  let foot = "ArrowLeft";
  let steps = 0;
  while (true) {
    const state = await page.evaluate(() => {
      const body = document.body.innerText;
      const controls = document.querySelector(".player-controls");
      return {
        controlsVisible: controls instanceof HTMLElement && !controls.hidden,
        concluded: /你被淘汰了|成功抵達終點線|遊戲結束!/.test(body),
      };
    }).catch(() => ({ controlsVisible: false, concluded: true }));
    if (state.concluded) return { name, steps };
    if (state.controlsVisible) {
      await page.keyboard.press(foot).catch(() => {});
      foot = foot === "ArrowLeft" ? "ArrowRight" : "ArrowLeft";
      steps += 1;
      if (steps % 10 === 0) console.log(JSON.stringify({ name, steps }));
    }
    await delay(400);
  }
}

await Promise.all(sessions.map(drive));
console.log("All simulated player pages reached a concluded state.");
await Promise.all(sessions.map(({ context }) => context.close().catch(() => {})));
await browser.close();
