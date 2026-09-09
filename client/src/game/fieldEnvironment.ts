import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createCharacter, part } from "./characterModels";
import { barkTexture, countrysideTexture, sandTexture, skyTexture } from "./fieldTextures";
import { replaceWithBlenderAsset } from "./blenderAssets";

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

function wheatTuft(): THREE.BufferGeometry {
  const pieces: THREE.BufferGeometry[] = [];
  for (let stalk = 0; stalk < 3; stalk++) {
    const x = (stalk - 1) * 0.11, height = 0.72 + stalk * 0.09;
    pieces.push(new THREE.CylinderGeometry(0.009, 0.012, height, 3).translate(x, height / 2, 0));
    for (let seed = 0; seed < 4; seed++) {
      const grain = new THREE.SphereGeometry(1, 5, 3);
      grain.scale(0.036, 0.066, 0.024);
      grain.rotateZ((seed % 2 ? -1 : 1) * 0.3);
      grain.translate(x + (seed % 2 ? -0.018 : 0.018), height + seed * 0.046, 0);
      pieces.push(grain);
    }
    const leaf = new THREE.ConeGeometry(0.048, 0.32, 3);
    leaf.scale(1, 1, 0.22);
    leaf.rotateZ(stalk % 2 ? 0.7 : -0.7);
    leaf.translate(x + (stalk % 2 ? -0.1 : 0.1), height * 0.58, 0);
    pieces.push(leaf);
  }
  const geometry = mergeGeometries(pieces)!;
  pieces.forEach((piece) => piece.dispose());
  return geometry;
}

function countrysideHeight(x: number, z: number): number {
  return 1.8 + Math.sin(x * 0.043 + z * 0.035) * 1.1 + Math.cos(x * 0.08 - z * 0.031) * 0.8;
}

function buildCountryside(scene: THREE.Scene): void {
  const geometry = new THREE.PlaneGeometry(230, 150, 80, 50);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 0, 111);
  const positions = geometry.getAttribute("position");
  const colors: number[] = [];
  const color = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i);
    const ramp = THREE.MathUtils.smoothstep(z, 36, 70);
    const height = countrysideHeight(x, z) * ramp;
    positions.setY(i, height - 0.03);
    const tone = 0.84 + height * 0.025;
    color.setRGB(tone, tone, tone * 0.94);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const hillSand = sandTexture();
  hillSand.repeat.set(46, 30);
  const hills = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map: hillSand, vertexColors: true, roughness: 1 }));
  hills.receiveShadow = true;
  scene.add(hills);

  // Small irregular lobes read as leafy crowns instead of oversized smooth ellipses.
  const rng = random(261);
  const lobes: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 15; i++) {
    const lobe = new THREE.SphereGeometry(0.55 + rng() * 0.28, 10, 7);
    const p = lobe.getAttribute("position");
    for (let vertex = 0; vertex < p.count; vertex++) {
      const x = p.getX(vertex), y = p.getY(vertex), z = p.getZ(vertex);
      const scale = 1 + 0.08 * Math.sin(x * 23 + y * 15 + z * 32);
      p.setXYZ(vertex, x * scale, y * scale, z * scale);
    }
    lobe.translate((rng() - 0.5) * 2, (rng() - 0.5) * 1.4, (rng() - 0.5) * 1.6);
    lobe.computeVertexNormals();
    lobes.push(lobe);
  }
  const crown = mergeGeometries(lobes)!;
  lobes.forEach((lobe) => lobe.dispose());
  const forest = new THREE.InstancedMesh(crown, new THREE.MeshStandardMaterial({ roughness: 0.95 }), 380);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < forest.count; i++) {
    const x = (rng() - 0.5) * 220, z = 65 + rng() * 75;
    const scale = 0.9 + rng() * 1.1;
    dummy.position.set(x, countrysideHeight(x, z) + scale * 0.75, z);
    dummy.scale.set(scale, scale * (0.8 + rng() * 0.3), scale);
    dummy.rotation.y = rng() * Math.PI * 2;
    dummy.updateMatrix(); forest.setMatrixAt(i, dummy.matrix);
    color.setHSL(0.19 + rng() * 0.045, 0.32 + rng() * 0.15, 0.26 + rng() * 0.13).convertSRGBToLinear();
    forest.setColorAt(i, color);
  }
  scene.add(forest);
}

/** 玩家與主辦方共用完整競技場，位置及比例保持一致。 */
export function buildFieldEnvironment(scene: THREE.Scene): void {
  const sand = sandTexture();
  const groundGeometry = new THREE.PlaneGeometry(240, 240, 96, 96);
  const positions = groundGeometry.getAttribute("position");
  const groundColors: number[] = [];
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i);
    const tone = 0.91 + Math.sin(x * 0.27 + Math.cos(y * 0.19)) * 0.035 + Math.cos(y * 0.39 + x * 0.11) * 0.025;
    groundColors.push(tone, tone, tone);
  }
  groundGeometry.setAttribute("color", new THREE.Float32BufferAttribute(groundColors, 3));
  const ground = new THREE.Mesh(groundGeometry, new THREE.MeshStandardMaterial({ map: sand, vertexColors: true, roughness: 0.94, bumpMap: sand, bumpScale: 0.024 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.02, 20);
  ground.receiveShadow = true;
  scene.add(ground);

  const sky = countrysideTexture();
  scene.background = scene.environment = skyTexture();
  scene.environmentIntensity = 0.25;

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
    void replaceWithBlenderAsset(guard, "guard");
  }

  const rng = random(37);
  const wheatCount = 6500;
  const wheat = new THREE.InstancedMesh(wheatTuft(), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), wheatCount);
  const dummy = new THREE.Object3D();
  const wheatColor = new THREE.Color();
  for (let i = 0; i < wheatCount; i++) {
    const side = i % 2 ? 1 : -1;
    dummy.position.set(side * (19 + rng() * 48), 0, -15 + rng() * 50);
    if (i % 2 === 0) {
      const x = (rng() - 0.5) * 110, z = 36 + rng() * 27;
      dummy.position.set(x, countrysideHeight(x, z) * THREE.MathUtils.smoothstep(z, 36, 70), z);
    }
    dummy.rotation.set(rng() * 0.2, rng() * 6, rng() * 0.15);
    dummy.scale.setScalar(0.7 + rng() * 0.8);
    dummy.updateMatrix();
    wheat.setMatrixAt(i, dummy.matrix);
    wheatColor.setHSL(0.115 + rng() * 0.025, 0.55 + rng() * 0.15, 0.4 + rng() * 0.16).convertSRGBToLinear();
    wheat.setColorAt(i, wheatColor);
  }
  wheat.receiveShadow = true;
  scene.add(wheat);
  buildCountryside(scene);

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
  void replaceWithBlenderAsset(root, "tree");
}

function buildHouse(scene: THREE.Scene, x: number): void {
  const z = FIELD_LENGTH + 3.1;
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  scene.add(root);
  part(root, new THREE.BoxGeometry(3.5, 2.35, 2.6), 0xe5dfc1, 0, 1.18, 0);
  part(root, new THREE.BoxGeometry(1.15, 1.8, 0.035), 0x365749, 0, 0.9, -1.32);
  for (const side of [-1, 1]) part(root, new THREE.BoxGeometry(0.5, 0.65, 0.035), 0x576c52, side * 1.12, 1.15, -1.32);
  for (const side of [-1, 1]) {
    const roof = part(root, new THREE.BoxGeometry(3.95, 0.16, 1.85), 0xa34f2c, 0, 2.75, side * 0.71);
    roof.rotation.x = side * 0.48;
    for (let tile = 0; tile < 18; tile++) {
      const ridge = part(root, new THREE.CylinderGeometry(0.045, 0.045, 1.85, 6), 0xc27242, -1.87 + tile * 0.22, 2.84, side * 0.71);
      ridge.rotation.x = Math.PI / 2 + side * 0.48;
    }
  }
  void replaceWithBlenderAsset(root, "house");
}

export function lightScene(scene: THREE.Scene, renderer: THREE.WebGLRenderer): void {
  scene.background = new THREE.Color(0x74acd5);
  scene.fog = new THREE.Fog(0xc5d6c5, 95, 200);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene.add(new THREE.HemisphereLight(0xe4f0ff, 0xb6a17b, 1.8));
  const sun = new THREE.DirectionalLight(0xffebce, 3);
  sun.position.set(-18, 28, -6);
  sun.target.position.set(0, 0, 15);
  sun.castShadow = true;
  const shadowSize = Math.min(4096, renderer.capabilities.maxTextureSize);
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 32, bottom: -24, near: 0.5, far: 100 });
  sun.shadow.normalBias = 0.018;
  sun.shadow.bias = -0.0001;
  scene.add(sun, sun.target);
}
