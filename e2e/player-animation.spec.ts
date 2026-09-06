import { test, expect } from "@playwright/test";

test("first-person collapse matches the avatar's world direction and timing", async ({ page }) => {
  await page.goto("/player.html?offline=1");
  const poses = await page.evaluate(async () => {
    const sceneUrl = "/src/game/Scene.ts";
    const avatarUrl = "/src/game/PlayerAvatars.ts";
    const { GameScene } = await import(sceneUrl);
    const { PlayerAvatars } = await import(avatarUrl);
    const container = document.createElement("div");
    container.style.cssText = "width:640px;height:360px";
    document.body.append(container);
    const game = new GameScene(container);
    const avatars = new PlayerAvatars(game.scene);
    const player = { playerId: "fallen", name: "倒下", distance: 0, score: 0, eliminated: true, finished: false, connected: true };
    avatars.update([player]);
    avatars.animate(1000);
    game.playCollapse(1000);
    const mesh = game.scene.children.filter((object: any) => object.isInstancedMesh).at(-1);
    const result = [1300, 1600].map((now) => {
      avatars.animate(now);
      game.updateAnimations(now);
      game.camera.updateMatrix();
      // Matrix 的第二欄是物件在世界中的 up，直接比較相機與角色的側倒方向。
      return {
        cameraUp: game.camera.matrix.elements.slice(4, 7),
        avatarUp: Array.from(mesh.instanceMatrix.array.slice(4, 7)),
        cameraX: game.camera.position.x,
      };
    });
    game.renderer.dispose();
    container.remove();
    return result;
  });
  for (const pose of poses) {
    expect(pose.cameraUp[0]).toBeLessThan(0);
    expect(pose.cameraX).toBeLessThan(0);
    pose.cameraUp.forEach((value: number, index: number) => expect(value).toBeCloseTo(pose.avatarUp[index] as number, 4));
  }
});

test("avatar steps interpolate, shift weight, and settle without snapping on unchanged snapshots", async ({ page }) => {
  await page.goto("/player.html?offline=1");
  const poses = await page.evaluate(async () => {
    const sceneUrl = "/src/game/Scene.ts";
    const avatarUrl = "/src/game/PlayerAvatars.ts";
    const { GameScene } = await import(sceneUrl);
    const { PlayerAvatars, playerWorldZ } = await import(avatarUrl);
    const container = document.createElement("div");
    container.style.cssText = "width:640px;height:360px";
    document.body.append(container);
    const game = new GameScene(container);
    const avatars = new PlayerAvatars(game.scene);
    const player = { playerId: "walker", name: "前進", distance: 0, score: 3, eliminated: false, finished: false, connected: true };
    const mesh = game.scene.children.filter((object: any) => object.isInstancedMesh).at(-1);
    const read = () => Array.from(mesh.instanceMatrix.array.slice(0, 16)) as number[];
    avatars.update([player]);
    avatars.animate(1000);
    player.distance = 0.32;
    avatars.update([player]);
    avatars.animate(1000);
    const start = read();
    avatars.animate(1090);
    const mid = read();
    avatars.update([player]);
    avatars.animate(1180);
    const end = read();
    game.renderer.dispose();
    container.remove();
    return { start, mid, end, target: playerWorldZ(0, 0.32) };
  });
  expect(poses.start[14]).toBeCloseTo(0);
  expect(poses.mid[14]).toBeGreaterThan(0);
  expect(poses.mid[14]).toBeLessThan(poses.target);
  expect(poses.mid[13]).toBeGreaterThan(0);
  expect(Math.abs(poses.mid[4])).toBeGreaterThan(0.01);
  expect(poses.end[14]).toBeCloseTo(poses.target);
  expect(poses.end[13]).toBeCloseTo(0);
  expect(poses.end[4]).toBeCloseTo(0);
});
