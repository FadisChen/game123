import * as THREE from "three";
import { FINISH_DISTANCE_M } from "shared";
import { createCharacter, part, sphere } from "./characterModels";

export const PATH_HALF_WIDTH_M = 12;
export const FIELD_HALF_WIDTH_M = 12;

function random(seed: number): () => number {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function groundTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  const rng = random(123);
  ctx.fillStyle = "#b7a17a";
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 42000; i++) {
    const shade = rng() > 0.5 ? "255,232,174" : "100,73,34";
    ctx.fillStyle = `rgba(${shade},${rng() * 0.13})`;
    ctx.fillRect(rng() * 512, rng() * 512, rng() * 5 + 1, rng() * 3 + 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(100, 100);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function skyTexture(): THREE.CanvasTexture {
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
  const sand = groundTexture();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshStandardMaterial({ map: sand, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.02, 20);
  ground.receiveShadow = true;
  scene.add(ground);

  const sky = skyTexture();
  const backdrop = new THREE.Mesh(new THREE.SphereGeometry(110, 64, 32), new THREE.MeshBasicMaterial({ map: sky, side: THREE.BackSide, fog: false }));
  backdrop.position.set(0, 0, 15);
  scene.add(backdrop);

  for (const side of [-1, 1]) {
    const wall = part(scene, new THREE.BoxGeometry(0.22, 5.5, FINISH_DISTANCE_M + 12), 0xffffff, side * FIELD_HALF_WIDTH_M, 2.75, FINISH_DISTANCE_M / 2 - 2);
    (wall.material as THREE.MeshStandardMaterial).map = sky;
    part(scene, new THREE.BoxGeometry(0.32, 0.12, FINISH_DISTANCE_M + 12), 0xe8dfc8, side * FIELD_HALF_WIDTH_M, 5.52, FINISH_DISTANCE_M / 2 - 2);
  }
  for (const [z, color] of [[0, 0xf1ead2], [FINISH_DISTANCE_M, 0xe58aa3]]) {
    part(scene, new THREE.BoxGeometry(24, 0.024, 0.12), color, 0, 0.02, z);
  }

  buildTree(scene);
  buildHouse(scene, -7.4);
  buildHouse(scene, 7.4);
  for (const x of [-10, -4.6, 4.6, 10]) {
    const guard = createCharacter("guard");
    guard.position.set(x, 0, FINISH_DISTANCE_M + 0.7);
    guard.rotation.y = Math.PI;
    scene.add(guard);
  }

  const rng = random(37);
  const wheat = new THREE.InstancedMesh(new THREE.ConeGeometry(0.08, 0.8, 3), new THREE.MeshStandardMaterial({ color: 0xb9a34d, roughness: 1 }), 2000);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 2000; i++) {
    const side = i % 2 ? 1 : -1;
    dummy.position.set(side * (13 + rng() * 48), 0.35, -15 + rng() * 90);
    dummy.rotation.set(rng() * 0.2, rng() * 6, rng() * 0.15);
    dummy.scale.setScalar(0.7 + rng() * 0.8);
    dummy.updateMatrix();
    wheat.setMatrixAt(i, dummy.matrix);
  }
  scene.add(wheat);
  for (let i = 0; i < 45; i++) {
    const x = (rng() - 0.5) * 160;
    const z = 64 + rng() * 28;
    const height = 2 + rng() * 3;
    part(scene, new THREE.CylinderGeometry(0.15, 0.25, height, 6), 0x686044, x, height / 2, z);
    sphere(scene, [0x59663c, 0x657244, 0x75814b][i % 3], x, height + 0.8, z, 2 + rng(), 1.8, 2);
  }
}

function buildTree(scene: THREE.Scene): void {
  const root = new THREE.Group();
  root.position.set(0, 0, FINISH_DISTANCE_M + 2.8);
  scene.add(root);
  const rng = random(84);
  const branch = (from: THREE.Vector3, to: THREE.Vector3, radius: number, depth: number) => {
    const direction = to.clone().sub(from);
    const mesh = part(root, new THREE.CylinderGeometry(radius * 0.55, radius, direction.length(), 9), 0x584331, ...from.clone().add(to).multiplyScalar(0.5).toArray());
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    if (depth === 0) return;
    for (const side of [-1, 1]) {
      const next = to.clone().sub(from).multiplyScalar(0.6 + rng() * 0.15);
      next.applyAxisAngle(new THREE.Vector3(0, 0, 1), side * (0.2 + rng() * 0.6));
      next.z += (rng() - 0.5) * 0.9;
      branch(to, to.clone().add(next), radius * 0.56, depth - 1);
    }
  };
  branch(new THREE.Vector3(), new THREE.Vector3(0.2, 3.5, 0), 0.68, 0);
  branch(new THREE.Vector3(0.2, 3.5, 0), new THREE.Vector3(-0.4, 5.8, 0.2), 0.4, 3);
  branch(new THREE.Vector3(0.1, 2.7, 0), new THREE.Vector3(-2, 4.5, -0.1), 0.32, 3);
  branch(new THREE.Vector3(0.2, 3.5, 0), new THREE.Vector3(2.8, 5.3, 0.5), 0.3, 3);
  branch(new THREE.Vector3(0, 4.5, 0.1), new THREE.Vector3(1.1, 6.7, -0.3), 0.2, 2);
  for (let i = 0; i < 7; i++) {
    const angle = i * Math.PI * 2 / 7;
    branch(new THREE.Vector3(Math.cos(angle) * 1.5, 0.05, Math.sin(angle)), new THREE.Vector3(0, 0.8, 0), 0.2, 0);
  }
}

function buildHouse(scene: THREE.Scene, x: number): void {
  const z = FINISH_DISTANCE_M + 3.1;
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
  scene.fog = new THREE.Fog(0xc7d3bc, 65, 160);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  scene.add(new THREE.HemisphereLight(0xe2eeff, 0xa69161, 2.4));
  const sun = new THREE.DirectionalLight(0xffecd0, 2.4);
  sun.position.set(-16, 26, 10);
  sun.target.position.set(0, 0, 15);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 35, bottom: -30, near: 0.5, far: 100 });
  sun.shadow.normalBias = 0.035;
  sun.shadow.bias = -0.0001;
  scene.add(sun, sun.target);
}
