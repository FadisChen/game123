import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export function part(parent: THREE.Object3D, geometry: THREE.BufferGeometry, color: number, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.82 }));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function sphere(parent: THREE.Object3D, color: number, x: number, y: number, z: number, sx: number, sy = sx, sz = sx): THREE.Mesh {
  const mesh = part(parent, new THREE.SphereGeometry(1, 16, 12), color, x, y, z);
  mesh.scale.set(sx, sy, sz);
  return mesh;
}

/** 大頭、短四肢與綠色運動服，正面朝 +Z。 */
export function createCharacter(kind: "player" | "doll" | "guard" = "player"): THREE.Group {
  const root = new THREE.Group();
  const suit = kind === "doll" ? 0xeaa31c : kind === "guard" ? 0xb72f5c : 0x087f78;
  const skin = 0xe6b78b;
  const hair = 0x26231f;
  sphere(root, suit, 0, 0.65, 0, 0.28, 0.32, 0.21);
  for (const side of [-1, 1]) {
    part(root, new THREE.CapsuleGeometry(0.085, 0.23, 4, 8), kind === "doll" ? skin : suit, side * 0.115, 0.27, 0);
    sphere(root, kind === "doll" ? 0x292923 : 0xe9e4cb, side * 0.115, 0.075, 0.055, 0.105, 0.07, 0.16);
    const arm = part(root, new THREE.CapsuleGeometry(0.08, 0.27, 4, 8), suit, side * 0.3, 0.63, 0);
    arm.rotation.z = side * 0.18;
    sphere(root, skin, side * 0.33, 0.41, 0.015, 0.085);
    if (kind === "player") {
      part(root, new THREE.BoxGeometry(0.022, 0.35, 0.026), 0xe7e7d5, side * 0.202, 0.3, 0.01);
      part(root, new THREE.BoxGeometry(0.032, 0.28, 0.03), 0xe7e7d5, side * 0.315, 0.68, -0.05);
    }
  }
  sphere(root, skin, 0, 1.13, 0.015, 0.32, 0.32, 0.3);
  sphere(root, hair, 0, 1.19, -0.055, 0.34, 0.35, 0.31);
  for (let strand = 0; strand < 11; strand++) {
    const angle = strand / 10 * Math.PI;
    const lock = sphere(root, hair, Math.cos(angle) * 0.23, 1.22 + Math.sin(angle) * 0.09, -0.09 - Math.sin(angle) * 0.16, 0.105, 0.2, 0.13);
    lock.rotation.z = (angle - Math.PI / 2) * 0.22;
  }
  for (const side of [-1, 1]) {
    sphere(root, skin, side * 0.315, 1.12, 0.015, 0.06, 0.09, 0.06);
    sphere(root, hair, side * 0.11, 1.12, 0.287, 0.027, 0.037, 0.018);
    sphere(root, 0xfff7e7, side * 0.115, 1.13, 0.302, 0.008);
  }
  sphere(root, skin, 0, 1.045, 0.305, 0.035, 0.04, 0.035);
  if (kind === "doll") {
    part(root, new THREE.CylinderGeometry(0.19, 0.32, 0.4, 16), 0xd96c17, 0, 0.52, 0);
    for (const side of [-1, 1]) sphere(root, hair, side * 0.31, 1.07, -0.11, 0.14, 0.2, 0.12);
  }
  if (kind !== "guard") {
    // 小領口、袖口、鞋底和臉部細節；沿用可合併成 instanced geometry 的實色材質。
    for (const side of [-1, 1]) {
      const collar = part(root, new THREE.BoxGeometry(0.105, 0.07, 0.035), 0xf3e8c8, side * 0.055, 0.9, 0.12);
      collar.rotation.z = side * 0.4;
      sphere(root, 0xd79777, side * 0.2, 1.035, 0.257, 0.047, 0.019, 0.012);
      sphere(root, 0xf8f2db, side * 0.115, 0.034, 0.055, 0.11, 0.028, 0.163);
      if (kind === "player") {
        part(root, new THREE.CylinderGeometry(0.086, 0.083, 0.05, 12), 0x075c59, side * 0.33, 0.46, 0);
        part(root, new THREE.CylinderGeometry(0.088, 0.09, 0.04, 12), 0x075c59, side * 0.115, 0.13, 0);
      } else {
        part(root, new THREE.CylinderGeometry(0.087, 0.085, 0.2, 12), 0xf3edda, side * 0.115, 0.21, 0);
        sphere(root, 0xe4a12c, side * 0.31, 1.18, -0.06, 0.05, 0.033, 0.06);
      }
    }
    sphere(root, 0x985d48, 0, 0.988, 0.285, 0.027, 0.007, 0.008);
    if (kind === "player") {
      part(root, new THREE.BoxGeometry(0.015, 0.37, 0.025), 0xb1c8ae, 0, 0.69, 0.201);
      part(root, new THREE.BoxGeometry(0.085, 0.053, 0.02), 0xf3e8c8, 0.13, 0.77, 0.194);
      part(root, new THREE.CylinderGeometry(0.22, 0.215, 0.06, 16), 0x075c59, 0, 0.43, 0);
    }
  }
  if (kind === "guard") {
    sphere(root, suit, 0, 1.17, 0, 0.35, 0.37, 0.32);
    sphere(root, 0x20282b, 0, 1.14, 0.24, 0.24, 0.27, 0.08);
    const triangle = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.09, 1.09, 0.323), new THREE.Vector3(0, 1.25, 0.323),
      new THREE.Vector3(0.09, 1.09, 0.323), new THREE.Vector3(-0.09, 1.09, 0.323),
    ]);
    root.add(new THREE.Line(triangle, new THREE.LineBasicMaterial({ color: 0xe4e1da })));
  }
  return root;
}

/** 將角色烘焙成帶頂點色的單一幾何體，百人場景仍只需一次角色 draw call。 */
export function createPlayerGeometry(): THREE.BufferGeometry {
  const model = createCharacter("player");
  model.updateMatrixWorld(true);
  const parts: THREE.BufferGeometry[] = [];
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
    const material = object.material as THREE.MeshStandardMaterial;
    const colors = new Float32Array(geometry.getAttribute("position").count * 3);
    for (let i = 0; i < colors.length; i += 3) material.color.toArray(colors, i);
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    parts.push(geometry);
    object.geometry.dispose();
    material.dispose();
  });
  const merged = mergeGeometries(parts)!;
  parts.forEach((geometry) => geometry.dispose());
  return merged;
}
