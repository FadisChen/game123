import { test, expect } from "@playwright/test";

test("Blender models render in the host scene and retain the doll's current state", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // A blank document on the dev origin lets us exercise the real scene without socket timing.
  await page.route("**/asset-preview", (route) => route.fulfill({ contentType: "text/html", body: "<html><body style='margin:0'><div id='scene' style='width:100vw;height:100vh'></div></body></html>" }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/asset-preview");
  await page.addStyleTag({ path: "client/src/style.css" });
  await page.evaluate(async () => {
    const modulePath = "/src/host/HostScene.ts";
    const { HostScene } = await import(modulePath);
    const host = new HostScene(document.getElementById("scene")!);
    // The state arrives before the asynchronous asset has finished loading.
    host.updateGhostVisual(1, true);
    host.updateAvatars(Array.from({ length: 32 }, (_, i) => ({
      playerId: `preview-${i}`, name: String(i + 1).padStart(3, "0"),
      distance: (i * 17 % 47), score: 3, connected: true, eliminated: false, finished: false,
    })));
    Object.assign(window, { assetHost: host });
    const render = () => { host.render(); requestAnimationFrame(render); };
    render();
  });
  await expect.poll(() => page.evaluate(() => {
    const host = (window as any).assetHost;
    const names: string[] = [];
    host.scene.traverse((object: any) => { if (object.userData.blenderAsset) names.push(object.userData.blenderAsset); });
    return names.sort();
  })).toEqual(["doll", "guard", "guard", "guard", "guard", "house", "house", "player", "tree"]);
  const playerMesh = await page.evaluate(() => {
    const host = (window as any).assetHost;
    let player: any;
    host.scene.traverse((object: any) => { if (object.userData.blenderAsset === "player") player = object; });
    player.geometry.computeBoundingBox();
    return {
      instanced: player.isInstancedMesh, count: player.count,
      colors: player.geometry.getAttribute("color").count,
      vertices: player.geometry.getAttribute("position").count,
      height: player.geometry.boundingBox.max.y - player.geometry.boundingBox.min.y,
      triangles: (player.geometry.index?.count ?? player.geometry.getAttribute("position").count) / 3,
      materials: Array.isArray(player.material) ? player.material.length : 1,
    };
  });
  expect(playerMesh.instanced).toBe(true);
  expect(playerMesh.count).toBe(32);
  expect(playerMesh.colors).toBe(playerMesh.vertices);
  expect(playerMesh.materials).toBe(1);
  expect(playerMesh.height).toBeGreaterThan(1.4);
  expect(playerMesh.height).toBeLessThan(1.7);
  expect(playerMesh.triangles).toBeLessThan(12000);
  const state = await page.evaluate(() => {
    const host = (window as any).assetHost;
    let doll: any;
    host.scene.traverse((object: any) => { if (object.userData.blenderAsset === "doll") doll = object; });
    const emissive: number[] = [];
    doll.traverse((object: any) => { if (object.isMesh) emissive.push(object.material.emissive.getHex()); });
    const rotation = doll.rotation.y;
    host.updateGhostVisual(0, false);
    const cleared: number[] = [];
    doll.traverse((object: any) => { if (object.isMesh) cleared.push(object.material.emissive.getHex()); });
    host.updateGhostVisual(1, false);
    return { rotation, emissive, cleared };
  });
  expect(state.rotation).toBeCloseTo(Math.PI);
  expect(state.emissive.length).toBeGreaterThan(0);
  expect(state.emissive.every((color) => color === 0x320600)).toBe(true);
  expect(state.cleared.every((color) => color === 0)).toBe(true);
  await page.screenshot({ path: "art/host-scene-preview.png" });
  await page.evaluate(() => {
    const host = (window as any).assetHost;
    host.camera.position.set(10, 7, 20);
    host.camera.lookAt(0, 3, 32);
  });
  await page.screenshot({ path: "art/host-models-detail.png" });
  await page.evaluate(() => {
    const host = (window as any).assetHost;
    host.camera.position.set(1.2, 4.8, 26);
    host.camera.lookAt(0, 4.3, 31);
  });
  await page.screenshot({ path: "art/doll-expression.png" });
  await page.evaluate(() => {
    const host = (window as any).assetHost;
    host.camera.position.set(5.3, 1.25, 27.7);
    host.camera.lookAt(4.6, 0.85, 30.7);
  });
  await page.screenshot({ path: "art/guard-preview.png" });
  await page.evaluate(() => {
    const host = (window as any).assetHost;
    host.camera.position.set(-8.5, 1.3, 3);
    host.camera.lookAt(-9.5, 0.8, 0);
  });
  await page.screenshot({ path: "art/player-preview.png" });
  expect(errors).toEqual([]);
});

test("missing Blender files leave the procedural scene usable", async ({ page }) => {
  await page.route("**/models/*.glb", (route) => route.abort());
  await page.route("**/asset-preview", (route) => route.fulfill({ contentType: "text/html", body: "<div id='scene' style='width:100vw;height:100vh'></div>" }));
  await page.goto("/asset-preview");
  const warnings: string[] = [];
  page.on("console", (message) => { if (message.type() === "warning") warnings.push(message.text()); });
  await page.evaluate(async () => {
    const modulePath = "/src/host/HostScene.ts";
    const { HostScene } = await import(modulePath);
    const host = new HostScene(document.getElementById("scene")!);
    host.updateGhostVisual(1, true);
    Object.assign(window, { assetHost: host });
    host.render();
  });
  await expect.poll(() => warnings.filter((message) => message.includes("keeping procedural model")).length).toBe(9);
  expect(await page.evaluate(() => {
    const host = (window as any).assetHost;
    host.render();
    return host.renderer.info.render.triangles;
  })).toBeGreaterThan(0);
});
