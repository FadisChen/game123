import { test, expect } from "@playwright/test";

test("host and player reloads resume the same room and player progress", async ({ browser }) => {
  const hostContext = await browser.newContext({ viewport: { width: 960, height: 540 } });
  const playerContext = await browser.newContext({ viewport: { width: 960, height: 540 } });
  const host = await hostContext.newPage();
  const player = await playerContext.newPage();
  try {
    await host.goto("/host.html");
    const room = (await host.locator(".room-code").textContent())!.trim();
    await player.goto(`/join/${room}`);
    await player.getByPlaceholder("你的名字").fill("重連玩家");
    await player.getByRole("button", { name: "加入遊戲" }).click();
    await player.getByRole("button", { name: "我知道了" }).click();

    await player.reload();
    await expect(player.getByRole("button", { name: "我知道了" })).toBeVisible();
    await player.getByRole("button", { name: "我知道了" }).click();
    await host.reload();
    await expect(host.locator(".room-code")).toHaveText(room);

    await host.getByRole("button", { name: "開始遊戲" }).click();
    await expect(player.locator(".player-controls")).toBeVisible();
    await player.keyboard.press("ArrowLeft");
    await expect(player.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0.32");

    await player.reload();
    await expect(player.locator(".player-controls")).toBeVisible();
    await expect(player.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0.32");
  } finally {
    await hostContext.close();
    await playerContext.close();
  }
});
