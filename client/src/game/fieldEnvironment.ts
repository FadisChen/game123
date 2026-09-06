import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createCharacter, part } from "./characterModels";
import { barkTexture, sandTexture, skyTexture } from "./fieldTextures";

export const PATH_HALF_WIDTH_M = 12;
export const FIELD_HALF_WIDTH_M = 18;
/** 固定美術場景長度；遊戲公尺依房間設定換算，維持第一人稱構圖。 */
export const FIELD_LENGTH = 30;

function random(seed: number): () => number {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function wallTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, "#367ac2");
  gradient.addColorStop(0.65, "#82b9dc");
  gradient.addColorStop(1, "#e2d6a1");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 2048, 512);
  const rng = random(99);
  for (let cloud = 0; cloud < 26; cloud++) {
    const x = rng() * 2048;
    const y = 90 + rng() * 225;
    for (let puff = 0; puff < 12; puff++) {
      const px = x + puff * 7;
      const py = y + rng() * 12;
      const radius = 8 + rng() * 14;
      for (const wrap of [-2048, 0, 2048]) {
        const glow = ctx.createRadialGradient(px + wrap, py, 0, px + wrap, py, radius);
        glow.addColorStop(0, "rgba(255,255,250,.7)");
        glow.addColorStop(0.65, "rgba(255,255,250,.4)");
        glow.addColorStop(1, "rgba(255,255,250,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(px + wrap - radius, py - radius, radius * 2, radius * 2);
      }
    }
  }
  for (let layer = 0; layer < 3; layer++) {
    ctx.beginPath();
    ctx.moveTo(0, 512);
    for (let x = 0; x <= 2048; x += 12) ctx.lineTo(x, 425 + layer * 20 - rng() * 32);
    ctx.lineTo(2048, 512);
    ctx.fillStyle = ["#818b64", "#6d794c", "#a7a15c"][layer];
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** 玩家與主辦方共用完整競技場，位置及比例保持一致。 */
export function buildFieldEnvironment(scene: THREE.Scene): void {
  const sand = sandTexture();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshStandardMaterial({ map: sand, roughness: 1, bumpMap: sand, bumpScale: 0.055 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.02, 20);
  ground.receiveShadow = true;
  scene.add(ground);

  const sky = wallTexture();
  scene.background = skyTexture();

  for (const side of [-1, 1]) {
    const wallX = side * FIELD_HALF_WIDTH_M;
    const wall = part(scene, new THREE.BoxGeometry(0.22, 5.5, FIELD_LENGTH + 12), 0xffffff, wallX, 2.75, FIELD_LENGTH / 2 - 2);
    (wall.material as THREE.MeshStandardMaterial).map = sky;
    part(scene, new THREE.BoxGeometry(0.32, 0.12, FIELD_LENGTH + 12), 0xe8dfc8, wallX, 5.52, FIELD_LENGTH / 2 - 2);
  }
  for (const [z, color] of [[0, 0xf1ead2], [FIELD_LENGTH, 0xe58aa3]]) {
    const line = part(scene, new THREE.BoxGeometry(36, 0.024, 0.22), color, 0, 0.02, z);
    {
      (line.material as THREE.Material).dispose();
      line.material = new THREE.MeshBasicMaterial({ color });
    }
  }

  buildTree(scene);
  buildHouse(scene, -7.4);
  buildHouse(scene, 7.4);
  for (const x of [-10, -4.6, 4.6, 10]) {
    const guard = createCharacter("guard");
    guard.position.set(x, 0, FIELD_LENGTH + 0.7);
    guard.rotation.y = Math.PI;
    scene.add(guard);
  }

  const rng = random(37);
  const wheatCount = 10000;
  const wheat = new THREE.InstancedMesh(new THREE.ConeGeometry(0.08, 0.8, 3), new THREE.MeshStandardMaterial({ color: 0xcaa345, roughness: 1 }), wheatCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < wheatCount; i++) {
    const side = i % 2 ? 1 : -1;
    dummy.position.set(side * (19 + rng() * 48), 0.35, -15 + rng() * 90);
    if (i % 2 === 0) dummy.position.set((rng() - 0.5) * 100, 0.45, 36 + rng() * 18);
    dummy.rotation.set(rng() * 0.2, rng() * 6, rng() * 0.15);
    dummy.scale.setScalar(0.7 + rng() * 0.8);
    dummy.updateMatrix();
    wheat.setMatrixAt(i, dummy.matrix);
  }
  scene.add(wheat);
  {
    // 一個 instanced mesh 疊出遠景樹冠，避免大量獨立物件的繪製成本。
    const foliage = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshStandardMaterial({ roughness: 1 }), 750);
    const color = new THREE.Color();
    for (let i = 0; i < 750; i++) {
      const tree = Math.floor(i / 5);
      const x = (tree / 150 - 0.5) * 200;
      const z = 58 + rng() * 22;
      dummy.position.set(x + (rng() - 0.5) * 3, 1.8 + rng() * 4, z);
      dummy.scale.set(0.8 + rng() * 1.5, 0.8 + rng() * 0.9, 0.8 + rng() * 1.5);
      dummy.updateMatrix();
      foliage.setMatrixAt(i, dummy.matrix);
      color.setHex([0x526136, 0x677540, 0x7b8348, 0x948a45, 0x465731][i % 5]);
      foliage.setColorAt(i, color);
    }
    scene.add(foliage);
  }

}

function buildTree(scene: THREE.Scene): void {
  const root = new THREE.Group();
  root.position.set(0, 0, FIELD_LENGTH + 2.8);
  scene.add(root);
  root.scale.set(1.25, 1.25, 1.25);
  const bark = barkTexture();
  const barkMaterial = new THREE.MeshStandardMaterial({ map: bark, bumpMap: bark, bumpScale: 0.12, roughness: 0.95 });
  const rng = random(84);
  const branches: THREE.BufferGeometry[] = [];
  const branch = (from: THREE.Vector3, to: THREE.Vector3, radius: number, depth: number) => {
    const direction = to.clone().sub(from);
    const geometry = new THREE.CylinderGeometry(radius * 0.55, radius, direction.length(), 9);
    const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    geometry.applyQuaternion(rotation);
    const midpoint = from.clone().add(to).multiplyScalar(0.5);
    geometry.translate(midpoint.x, midpoint.y, midpoint.z);
    branches.push(geometry);
    if (depth === 0) return;
    for (const side of [-1, 1]) {
      const next = to.clone().sub(from).multiplyScalar(0.6 + rng() * 0.15);
      next.applyAxisAngle(new THREE.Vector3(0, 0, 1), side * (0.2 + rng() * 0.6));
      next.z += (rng() - 0.5) * 0.9;
      branch(to, to.clone().add(next), radius * 0.56, depth - 1);
    }
  };
  branch(new THREE.Vector3(), new THREE.Vector3(0.2, 3.5, 0), 0.68, 0);
  branch(new THREE.Vector3(0.2, 3.5, 0), new THREE.Vector3(-0.4, 5.8, 0.2), 0.4, 5);
  branch(new THREE.Vector3(0.1, 2.7, 0), new THREE.Vector3(-2, 4.5, -0.1), 0.32, 5);
  branch(new THREE.Vector3(0.2, 3.5, 0), new THREE.Vector3(2.8, 5.3, 0.5), 0.3, 5);
  branch(new THREE.Vector3(0, 4.5, 0.1), new THREE.Vector3(1.1, 6.7, -0.3), 0.2, 2);
  for (let i = 0; i < 7; i++) {
    const angle = i * Math.PI * 2 / 7;
    branch(new THREE.Vector3(Math.cos(angle) * 1.5, 0.05, Math.sin(angle)), new THREE.Vector3(0, 0.8, 0), 0.2, 0);
  }
  // 靜態樹枝合併成一次繪製，影子亦不必逐枝重新提交。
  const tree = new THREE.Mesh(mergeGeometries(branches)!, barkMaterial);
  branches.forEach((geometry) => geometry.dispose());
  tree.castShadow = tree.receiveShadow = true;
  root.add(tree);
}

function buildHouse(scene: THREE.Scene, x: number): void {
  const z = FIELD_LENGTH + 3.1;
  part(scene, new THREE.BoxGeometry(3.5, 2.35, 2.6), 0xe5dfc1, x, 1.18, z);
  part(scene, new THREE.BoxGeometry(1.15, 1.8, 0.035), 0x365749, x, 0.9, z - 1.32);
  for (const side of [-1, 1]) part(scene, new THREE.BoxGeometry(0.5, 0.65, 0.035), 0x576c52, x + side * 1.12, 1.15, z - 1.32);
  for (const side of [-1, 1]) {
    const roof = part(scene, new THREE.BoxGeometry(3.95, 0.16, 1.85), 0xa34f2c, x, 2.75, z + side * 0.71);
    roof.rotation.x = side * 0.48;
    for (let tile = 0; tile < 18; tile++) {
      const ridge = part(scene, new THREE.CylinderGeometry(0.045, 0.045, 1.85, 6), 0xc27242, x - 1.87 + tile * 0.22, 2.84, z + side * 0.71);
      ridge.rotation.x = Math.PI / 2 + side * 0.48;
    }
  }
}

export function lightScene(scene: THREE.Scene, renderer: THREE.WebGLRenderer): void {
  scene.background = new THREE.Color(0x74acd5);
  scene.fog = new THREE.Fog(0xc7d3bc, 80, 180);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene.add(new THREE.HemisphereLight(0xe2eeff, 0xa69161, 1.6));
  const sun = new THREE.DirectionalLight(0xffecd0, 2.4);
  sun.position.set(-12, 20, -8);
  sun.target.position.set(0, 0, 15);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 32, bottom: -24, near: 0.5, far: 100 });
  sun.shadow.normalBias = 0.018;
  sun.shadow.bias = -0.0001;
  scene.add(sun, sun.target);
}
