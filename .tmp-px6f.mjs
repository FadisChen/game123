import { chromium } from "playwright";

const url = "https://game123-l0kf.onrender.com/join/PX6F";
const names = Array.from({ length: 50 }, (_, i) => `Run${String(i + 1).padStart(2, "0")}`);
const browser = await chromium.launch({ headless: true });
const sessions = [];
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function join(name) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.locator('input[aria-label="房間代碼"]').fill("PX6F");
    await page.locator('input[aria-label="你的名字"]').fill(name);
    await page.getByRole("button", { name: "加入遊戲" }).click({ noWaitAfter: true });
    await page.waitForFunction(
      () => !document.querySelector(".join-overlay") || Boolean(document.querySelector(".join-overlay p")?.textContent?.trim()),
      { timeout: 15_000 },
    );
    if (await page.locator(".join-overlay").count()) {
      throw new Error((await page.locator(".join-overlay p").innerText().catch(() => "加入失敗")) || "加入失敗");
    }
    sessions.push({ context, page, name });
    return { name, ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
    await context.close().catch(() => {});
    return { name, ok: false, error: message };
  }
}

async function drive({ page, name }) {
  let foot = "ArrowLeft";
  let steps = 0;
  while (true) {
    const state = await page.evaluate(() => {
      const body = document.body.innerText;
      const controls = document.querySelector(".player-controls");
      return { active: controls instanceof HTMLElement && !controls.hidden, concluded: /你被淘汰了|成功抵達終點線|遊戲結束!/.test(body) };
    }).catch(() => ({ active: false, concluded: true }));
    if (state.concluded) return { name, steps };
    if (state.active) {
      await page.keyboard.press(foot).catch(() => {});
      foot = foot === "ArrowLeft" ? "ArrowRight" : "ArrowLeft";
      steps += 1;
    }
    await delay(400);
  }
}

const results = [];
for (let start = 0; start < names.length; start += 5) {
  const batch = await Promise.all(names.slice(start, start + 5).map(join));
  results.push(...batch);
  console.log(JSON.stringify({ completed: results.length, joined: sessions.length, batch }));
  await delay(250);
}
console.log(JSON.stringify({ summary: { attempted: results.length, joined: sessions.length, failed: results.length - sessions.length } }));
console.log("All successful players remain connected and will alternate left/right steps after the host starts.");
await Promise.all(sessions.map(drive));
console.log("All simulated players concluded.");
await Promise.all(sessions.map(({ context }) => context.close().catch(() => {})));
await browser.close();
