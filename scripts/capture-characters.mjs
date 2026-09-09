/* global window, document */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

await mkdir("artifacts/visual-upgrade/after", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  args: process.platform === "win32" ? ["--use-angle=d3d11"] : [],
});
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.route("**/character-preview", (route) => route.fulfill({ contentType: "text/html", body: "<body style='margin:0'></body>" }));
  await page.goto("http://localhost:5173/character-preview");
  await page.evaluate(async () => {
    const THREE = await import("/node_modules/.vite/deps/three.js");
    const { GLTFLoader } = await import("/node_modules/.vite/deps/three_addons_loaders_GLTFLoader__js.js");
    const { lightScene } = await import("/src/game/fieldEnvironment.ts");
    const { loadBlenderPlayerGeometry } = await import("/src/game/blenderAssets.ts");
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1600 / 900, 0.1, 100);
    camera.position.set(0, 1.55, 6.8);
    camera.lookAt(0, 0.85, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(1600, 900);
    document.body.append(renderer.domElement);
    lightScene(scene, renderer);
    scene.background = new THREE.Color(0xc4d7dc);
    const sun = scene.children.find((object) => object.isDirectionalLight);
    sun.position.set(-3, 6, 4); sun.target.position.set(0, 0.8, 0);
    Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -3 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0xd6c5a2, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.015; ground.receiveShadow = true; scene.add(ground);
    const player = await loadBlenderPlayerGeometry();
    const doll = (await new GLTFLoader().loadAsync("/models/doll.glb")).scene;
    for (let i = 0; i < 4; i++) {
      const model = i < 2 ? new THREE.Mesh(player, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.66 })) : doll.clone(true);
      model.position.x = (i - 1.5) * 1.08;
      model.rotation.y = i % 2 ? Math.PI : 0.12;
      model.traverse((object) => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = false; } });
      scene.add(model);
    }
    renderer.render(scene, camera);
    window.characterPreview = { scene, camera, renderer };
  });
  await page.screenshot({ path: "artifacts/visual-upgrade/after/characters.png" });
  if (process.argv.includes("--check-shadows")) {
    await page.evaluate(() => {
      const { scene, camera, renderer } = window.characterPreview;
      renderer.shadowMap.enabled = false;
      scene.traverse((object) => { if (object.isMesh) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) material.needsUpdate = true;
      } });
      renderer.render(scene, camera);
    });
    await page.screenshot({ path: "artifacts/visual-upgrade/after/characters-no-shadows.png" });
  }
} finally { await browser.close(); }
