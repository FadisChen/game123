/* global window, document, requestAnimationFrame, innerWidth, innerHeight */
// Run against npm run dev: node scripts/capture-art.mjs before|after
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";

const stage = process.argv[2] ?? "after";
if (!["before", "after"].includes(stage)) throw new Error("Use before or after");
const directory = `artifacts/visual-upgrade/${stage}`;
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  args: process.platform === "win32" ? ["--use-angle=d3d11"] : [],
});
const reports = [];
try {
  for (const [width, height] of [[1536, 864], [844, 390]]) {
    for (const mode of ["host", "player"]) {
      const page = await browser.newPage({ viewport: { width, height } });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/art-preview", (route) => route.fulfill({
        contentType: "text/html",
        body: "<body style='margin:0'><div id='scene' style='width:100vw;height:100vh'></div></body>",
      }));
      await page.goto("http://localhost:5173/art-preview");
      // The isolated preview has no app stylesheet; suppress host DOM labels.
      await page.addStyleTag({ content: ".avatar-label { display: none !important; }" });
      await page.evaluate(async (mode) => {
        const path = mode === "host" ? "/src/host/HostScene.ts" : "/src/game/Scene.ts";
        const module = await import(path);
        window.preview = mode === "host"
          ? new module.HostScene(document.getElementById("scene"))
          : new module.GameScene(document.getElementById("scene"), false);
        window.preview.updateGhostVisual(1, false);
      }, mode);
      await page.waitForFunction(() => {
        let count = 0;
        window.preview.scene.traverse((o) => { if (o.userData.blenderAsset) count++; });
        return count === 9;
      });
      for (const count of [32, 100]) {
        const report = await page.evaluate(async ({ count, mode }) => {
          const view = window.preview;
          const players = Array.from({ length: count }, (_, i) => ({
            playerId: `art-${i}`, name: `${i + 1}`.padStart(3, "0"),
            distance: i === 7 ? 0 : 3 + (i * 17 % 44),
            score: 3, connected: true, eliminated: false, finished: false,
          }));
          if (mode === "host") view.updateAvatars(players);
          else { view.updatePlayers(players, "art-7"); view.setCameraDistanceImmediate(0); }
          const frames = [], intervals = [];
          let previousFrame = 0;
          const gl = view.renderer.getContext();
          for (let i = 0; i < 15; i++) {
            const timestamp = await new Promise(requestAnimationFrame);
            if (i >= 3) intervals.push(timestamp - previousFrame);
            previousFrame = timestamp;
            const start = performance.now();
            if (mode === "player") view.updateAnimations(1000);
            view.render();
            gl.finish(); // Includes GPU completion; not an FPS measurement.
            if (i >= 3) frames.push(performance.now() - start);
          }
          frames.sort((a, b) => a - b);
          intervals.sort((a, b) => a - b);
          const debug = gl.getExtension("WEBGL_debug_renderer_info");
          return {
            mode, count, width: innerWidth, height: innerHeight,
            medianRenderMs: frames[6], p95RenderMs: frames[11],
            medianFrameIntervalMs: intervals[6], p95FrameIntervalMs: intervals[11],
            calls: view.renderer.info.render.calls, triangles: view.renderer.info.render.triangles,
            gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
          };
        }, { count, mode });
        reports.push({ ...report, errors });
        if (count === 32) {
          await page.screenshot({ path: `${directory}/${mode}-${width}.png` });
          if (mode === "host" && width === 1536) {
            for (const [name, position, target] of [
              ["finish", [10, 7, 20], [0, 3, 32]],
              ["character", [-8.5, 1.3, 4.8], [-9.5, 0.8, 1.8]],
            ]) {
              await page.evaluate(({ position, target }) => {
                const view = window.preview;
                view.camera.position.set(...position); view.camera.lookAt(...target);
                view.render();
              }, { position, target });
              await page.screenshot({ path: `${directory}/${name}.png` });
            }
            await page.evaluate(() => {
              const view = window.preview;
              view.camera.position.set(0, 26, -23); view.camera.lookAt(0, 0, 15);
            });
          }
        }
        console.log(report);
      }
      await page.close();
    }
  }
  await writeFile(`${directory}/metrics.json`, JSON.stringify({
    platform: `${os.platform()} ${os.release()}`, cpu: os.cpus()[0].model,
    browser: browser.version(), note: "Desktop headless browser; mobile viewport is not real mobile hardware. Render-call times include gl.finish but may exclude driver work. RAF intervals measure delivered frame cadence. 3 warmup and 12 measured frames per scene; not a hardware FPS guarantee.", reports,
  }, null, 2));
} finally { await browser.close(); }
