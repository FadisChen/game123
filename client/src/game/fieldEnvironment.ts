import * as THREE from "three";
import { COLORS, FINISH_DISTANCE_M } from "shared";
import { drawTree } from "./sprites";
import { colorHex, createBillboardSprite } from "./spriteUtils";

export const PATH_HALF_WIDTH_M = 3;
export const FIELD_HALF_WIDTH_M = 12;

/**
 * 地面／起終點線／圍欄／樹——玩家第一人稱場景（GameScene）與主辦方鳥瞰場景（HostScene）共用同一套場地。
 * 抽成獨立函式避免兩份場景各自維護一份幾乎一樣的地形建置程式碼。
 */
export function buildFieldEnvironment(scene: THREE.Scene): void {
  buildGround(scene);
  buildLines(scene);
  buildFence(scene);

  const treeSprite = createBillboardSprite(drawTree(colorHex(COLORS.trunkBrown)), 2.4, 3.2);
  treeSprite.position.set(-2.2, 0, FINISH_DISTANCE_M - 1);
  scene.add(treeSprite);
}

function buildGround(scene: THREE.Scene): void {
  const field = new THREE.Mesh(
    new THREE.PlaneGeometry(FIELD_HALF_WIDTH_M * 2, FINISH_DISTANCE_M + 20),
    new THREE.MeshStandardMaterial({ color: COLORS.fieldYellow, roughness: 1 }),
  );
  field.rotation.x = -Math.PI / 2;
  field.position.set(0, 0, FINISH_DISTANCE_M / 2);
  scene.add(field);

  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(PATH_HALF_WIDTH_M * 2, FINISH_DISTANCE_M + 4),
    new THREE.MeshStandardMaterial({ color: COLORS.pathTan, roughness: 1 }),
  );
  path.rotation.x = -Math.PI / 2;
  path.position.set(0, 0.01, FINISH_DISTANCE_M / 2);
  scene.add(path);
}

function buildLines(scene: THREE.Scene): void {
  const startLine = new THREE.Mesh(
    new THREE.BoxGeometry(PATH_HALF_WIDTH_M * 2, 0.02, 0.3),
    new THREE.MeshStandardMaterial({ color: COLORS.startWhite }),
  );
  startLine.position.set(0, 0.02, 0);
  scene.add(startLine);

  const finishLine = new THREE.Mesh(
    new THREE.BoxGeometry(PATH_HALF_WIDTH_M * 2, 0.02, 0.3),
    new THREE.MeshStandardMaterial({ color: COLORS.finishPink }),
  );
  finishLine.position.set(0, 0.02, FINISH_DISTANCE_M);
  scene.add(finishLine);
}

function buildFence(scene: THREE.Scene): void {
  const postMaterial = new THREE.MeshStandardMaterial({ color: COLORS.trunkBrown, roughness: 1 });
  const railGeometry = new THREE.BoxGeometry(0.06, 0.06, FINISH_DISTANCE_M + 2);
  const postGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.7, 6);

  for (const side of [-1, 1]) {
    const x = side * PATH_HALF_WIDTH_M;
    const rail = new THREE.Mesh(railGeometry, postMaterial);
    rail.position.set(x, 0.5, FINISH_DISTANCE_M / 2);
    scene.add(rail);

    const postCount = 8;
    for (let i = 0; i <= postCount; i++) {
      const post = new THREE.Mesh(postGeometry, postMaterial);
      post.position.set(x, 0.35, (i / postCount) * FINISH_DISTANCE_M);
      scene.add(post);
    }
  }
}
