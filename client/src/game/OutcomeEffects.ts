import * as THREE from "three";
import { COLORS } from "shared";

const ELIMINATION_DURATION_MS = 1100;
const FINISH_DURATION_MS = 1800;
const DEBRIS_COUNT = 12;
const GRAVITY_M_PER_S2 = 9.8;

interface ActiveEffect {
  root: THREE.Object3D;
  startedAt: number;
  durationMs: number;
  step: (progress: number, elapsedSeconds: number) => void;
}

/**
 * 主辦方鳥瞰畫面上的勝負特效。主持人是隔著投影看整片場地的，光靠角色變灰／頭上換個圖示
 * 在幾十個人裡根本看不出來，所以出局與抵達各給一個從該位置長出來、幾秒內自己收掉的動態標記。
 *
 * 每個特效都是「一個 Object3D + 一段隨時間推進的函式」，時間到就從場景移除並釋放資源，
 * 不留任何常駐物件——一局下來可能會觸發上百次。
 */
export class OutcomeEffects {
  private readonly scene: THREE.Scene;
  private readonly effects: ActiveEffect[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** 出局：地面紅色衝擊波紋，加上一小撮往上噴再落下的碎塊。 */
  spawnElimination(x: number, z: number, now: number): void {
    const root = new THREE.Group();
    root.position.set(x, 0, z);

    const ringMaterial = new THREE.MeshBasicMaterial({ color: COLORS.alertRed, transparent: true, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.4, 32), ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    root.add(ring);

    const debrisMaterial = new THREE.MeshBasicMaterial({ color: COLORS.alertRed, transparent: true, depthWrite: false });
    const debris = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), debrisMaterial, DEBRIS_COUNT);
    debris.frustumCulled = false;
    root.add(debris);

    // 出生時就把每塊碎片的初速定下來，之後每幀只是把同一條拋物線往前推。
    const velocities = Array.from({ length: DEBRIS_COUNT }, () => {
      const angle = Math.random() * Math.PI * 2;
      const outward = 1.1 + Math.random() * 1.6;
      return new THREE.Vector3(Math.cos(angle) * outward, 3.2 + Math.random() * 2.4, Math.sin(angle) * outward);
    });
    const dummy = new THREE.Object3D();

    this.add(root, now, ELIMINATION_DURATION_MS, (progress, elapsedSeconds) => {
      const fade = 1 - progress;
      ring.scale.setScalar(1 + progress * 6);
      ringMaterial.opacity = fade * 0.95;
      debrisMaterial.opacity = fade;
      velocities.forEach((velocity, i) => {
        dummy.position.set(
          velocity.x * elapsedSeconds,
          Math.max(0.06, 0.4 + velocity.y * elapsedSeconds - 0.5 * GRAVITY_M_PER_S2 * elapsedSeconds * elapsedSeconds),
          velocity.z * elapsedSeconds,
        );
        dummy.rotation.set(elapsedSeconds * 6 + i, elapsedSeconds * 4 + i, 0);
        dummy.updateMatrix();
        debris.setMatrixAt(i, dummy.matrix);
      });
      debris.instanceMatrix.needsUpdate = true;
    });
  }

  /** 抵達終點：一道從地面升起、緩慢旋轉的金色光柱，加一圈同色擴散的地面光環。 */
  spawnFinish(x: number, z: number, now: number): void {
    const root = new THREE.Group();
    root.position.set(x, 0, z);

    const beamMaterial = new THREE.MeshBasicMaterial({ color: COLORS.fieldYellow, transparent: true, side: THREE.DoubleSide, depthWrite: false });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 6, 20, 1, true), beamMaterial);
    beam.position.y = 3;
    root.add(beam);

    const haloMaterial = new THREE.MeshBasicMaterial({ color: COLORS.fieldYellow, transparent: true, side: THREE.DoubleSide, depthWrite: false });
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.72, 32), haloMaterial);
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.07;
    root.add(halo);

    this.add(root, now, FINISH_DURATION_MS, (progress, elapsedSeconds) => {
      // 光柱先竄起來再淡出，收尾比出局的波紋慢，好讓主持人有時間看向那個位置。
      beam.scale.y = 0.35 + Math.min(progress * 4, 1) * 0.65;
      beam.position.y = 3 * beam.scale.y;
      beam.rotation.y = elapsedSeconds * 1.6;
      beamMaterial.opacity = Math.min(progress * 5, 1) * (1 - progress) * 0.6;
      halo.scale.setScalar(1 + progress * 3.5);
      haloMaterial.opacity = (1 - progress) * 0.8;
    });
  }

  /** 每幀呼叫：推進所有進行中的特效，並收掉已經播完的。 */
  update(now: number): void {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      const elapsed = now - effect.startedAt;
      const progress = elapsed / effect.durationMs;
      if (progress >= 1) {
        this.effects.splice(i, 1);
        this.dispose(effect.root);
        continue;
      }
      effect.step(Math.max(progress, 0), Math.max(elapsed, 0) / 1000);
    }
  }

  private add(root: THREE.Object3D, startedAt: number, durationMs: number, step: ActiveEffect["step"]): void {
    step(0, 0);
    this.scene.add(root);
    this.effects.push({ root, startedAt, durationMs, step });
  }

  private dispose(root: THREE.Object3D): void {
    this.scene.remove(root);
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const material = object.material;
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
      else material.dispose();
    });
  }
}
