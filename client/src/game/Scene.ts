import * as THREE from "three";
import { COLORS, FINISH_DISTANCE_M, STEP_TWEEN_MS } from "../config";
import type { Foot } from "./Player";

const CAMERA_HEIGHT_M = 1.6;
const PATH_HALF_WIDTH_M = 3;
const FIELD_HALF_WIDTH_M = 12;
const GHOST_OFFSET_FROM_FINISH_M = 2;
const BOB_HEIGHT_M = 0.06;
const SHAKE_DURATION_MS = 220;
const SHAKE_MAGNITUDE_M = 0.05;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** 建立一段角度不一的枯枝，貼近參考圖「枯樹」的裸枝造型。 */
function buildTree(): THREE.Group {
  const tree = new THREE.Group();

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.28, 2.4, 8),
    new THREE.MeshStandardMaterial({ color: COLORS.trunkBrown, roughness: 1 }),
  );
  trunk.position.y = 1.2;
  tree.add(trunk);

  const branchMaterial = new THREE.MeshStandardMaterial({ color: COLORS.trunkBrown, roughness: 1 });
  const branchCount = 7;
  for (let i = 0; i < branchCount; i++) {
    const length = 1.1 + Math.random() * 0.8;
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, length, 5), branchMaterial);
    const angle = (i / branchCount) * Math.PI * 2 + Math.random() * 0.4;
    const tilt = 0.5 + Math.random() * 0.6;
    branch.position.set(0, 2.3 + Math.random() * 0.6, 0);
    branch.rotation.z = Math.cos(angle) * tilt;
    branch.rotation.x = Math.sin(angle) * tilt;
    branch.translateY(length / 2);
    tree.add(branch);
  }

  return tree;
}

/** 鬼（娃）：橘色洋裝 + 雙馬尾 Q 版女孩人偶，眼睛顏色可在 LOOKING 時變紅。 */
function buildGhostDoll(): { group: THREE.Group; eyeMaterial: THREE.MeshStandardMaterial } {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.32, 0.7, 4, 8),
    new THREE.MeshStandardMaterial({ color: COLORS.dollOrange }),
  );
  body.position.y = 0.75;
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 16, 12),
    new THREE.MeshStandardMaterial({ color: COLORS.dollSkin }),
  );
  head.position.y = 1.5;
  group.add(head);

  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.27, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshStandardMaterial({ color: COLORS.dollHair }),
  );
  hairCap.position.y = 1.58;
  group.add(hairCap);

  const pigtailGeometry = new THREE.SphereGeometry(0.1, 10, 8);
  const pigtailMaterial = new THREE.MeshStandardMaterial({ color: COLORS.dollHair });
  const leftPigtail = new THREE.Mesh(pigtailGeometry, pigtailMaterial);
  leftPigtail.position.set(-0.3, 1.5, 0);
  group.add(leftPigtail);
  const rightPigtail = new THREE.Mesh(pigtailGeometry, pigtailMaterial);
  rightPigtail.position.set(0.3, 1.5, 0);
  group.add(rightPigtail);

  const eyeMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.dollHair,
    emissive: new THREE.Color(COLORS.dollHair),
    emissiveIntensity: 0.4,
  });
  const eyeGeometry = new THREE.CircleGeometry(0.035, 12);
  const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  leftEye.position.set(-0.09, 1.51, 0.245);
  group.add(leftEye);
  const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  rightEye.position.set(0.09, 1.51, 0.245);
  group.add(rightEye);

  return { group, eyeMaterial };
}

/** 純裝飾用的粉紅守衛，不參與判定，強化尾牙活動氛圍。 */
function buildDecorativeGuard(): THREE.Group {
  const guard = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 1.1, 0.3),
    new THREE.MeshStandardMaterial({ color: COLORS.guardMagenta }),
  );
  body.position.y = 0.85;
  guard.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 10),
    new THREE.MeshStandardMaterial({ color: COLORS.guardMagenta }),
  );
  head.position.y = 1.55;
  guard.add(head);
  return guard;
}

export class GameScene {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;

  private readonly ghostGroup: THREE.Group;
  private readonly ghostEyeMaterial: THREE.MeshStandardMaterial;
  private readonly container: HTMLElement;

  private cameraDistance = 0;
  private tweenFromDistance = 0;
  private tweenTargetDistance = 0;
  private tweenStartedAt = 0;
  private tweenActive = false;
  private tweenFoot: Foot = "left";

  private shakeStartedAt = -Infinity;

  constructor(container: HTMLElement) {
    this.container = container;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.skyBlue);
    this.scene.fog = new THREE.Fog(COLORS.skyBlue, 15, FINISH_DISTANCE_M + 20);

    this.camera = new THREE.PerspectiveCamera(60, this.aspect(), 0.1, 200);
    this.camera.position.set(0, CAMERA_HEIGHT_M, 0);
    this.camera.lookAt(0, CAMERA_HEIGHT_M, 1);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.HemisphereLight(COLORS.skyBlue, COLORS.fieldYellow, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(5, 10, 5);
    this.scene.add(sun);

    this.buildGround();
    this.buildLines();
    this.buildFence();

    const tree = buildTree();
    tree.position.set(-2.2, 0, FINISH_DISTANCE_M - 1);
    this.scene.add(tree);

    const { group: ghostGroup, eyeMaterial } = buildGhostDoll();
    ghostGroup.position.set(0, 0, FINISH_DISTANCE_M - GHOST_OFFSET_FROM_FINISH_M);
    this.scene.add(ghostGroup);
    this.ghostGroup = ghostGroup;
    this.ghostEyeMaterial = eyeMaterial;

    for (const x of [-FIELD_HALF_WIDTH_M * 0.6, FIELD_HALF_WIDTH_M * 0.6]) {
      const guard = buildDecorativeGuard();
      guard.position.set(x, 0, FINISH_DISTANCE_M * 0.4);
      guard.rotation.y = x < 0 ? Math.PI / 6 : -Math.PI / 6;
      this.scene.add(guard);
    }

    window.addEventListener("resize", () => this.handleResize());
  }

  private aspect(): number {
    return this.container.clientWidth / this.container.clientHeight;
  }

  private handleResize(): void {
    this.camera.aspect = this.aspect();
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }

  private buildGround(): void {
    const field = new THREE.Mesh(
      new THREE.PlaneGeometry(FIELD_HALF_WIDTH_M * 2, FINISH_DISTANCE_M + 20),
      new THREE.MeshStandardMaterial({ color: COLORS.fieldYellow, roughness: 1 }),
    );
    field.rotation.x = -Math.PI / 2;
    field.position.set(0, 0, FINISH_DISTANCE_M / 2);
    this.scene.add(field);

    const path = new THREE.Mesh(
      new THREE.PlaneGeometry(PATH_HALF_WIDTH_M * 2, FINISH_DISTANCE_M + 4),
      new THREE.MeshStandardMaterial({ color: COLORS.pathTan, roughness: 1 }),
    );
    path.rotation.x = -Math.PI / 2;
    path.position.set(0, 0.01, FINISH_DISTANCE_M / 2);
    this.scene.add(path);
  }

  private buildLines(): void {
    const startLine = new THREE.Mesh(
      new THREE.BoxGeometry(PATH_HALF_WIDTH_M * 2, 0.02, 0.3),
      new THREE.MeshStandardMaterial({ color: COLORS.startWhite }),
    );
    startLine.position.set(0, 0.02, 0);
    this.scene.add(startLine);

    const finishLine = new THREE.Mesh(
      new THREE.BoxGeometry(PATH_HALF_WIDTH_M * 2, 0.02, 0.3),
      new THREE.MeshStandardMaterial({ color: COLORS.finishPink }),
    );
    finishLine.position.set(0, 0.02, FINISH_DISTANCE_M);
    this.scene.add(finishLine);
  }

  private buildFence(): void {
    const postMaterial = new THREE.MeshStandardMaterial({ color: COLORS.trunkBrown, roughness: 1 });
    const railGeometry = new THREE.BoxGeometry(0.06, 0.06, FINISH_DISTANCE_M + 2);
    const postGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.7, 6);

    for (const side of [-1, 1]) {
      const x = side * PATH_HALF_WIDTH_M;
      const rail = new THREE.Mesh(railGeometry, postMaterial);
      rail.position.set(x, 0.5, FINISH_DISTANCE_M / 2);
      this.scene.add(rail);

      const postCount = 8;
      for (let i = 0; i <= postCount; i++) {
        const post = new THREE.Mesh(postGeometry, postMaterial);
        post.position.set(x, 0.35, (i / postCount) * FINISH_DISTANCE_M);
        this.scene.add(post);
      }
    }
  }

  /** 更新鬼的轉身動畫（0=背對玩家，1=正面朝玩家）與眼睛偵測燈號。 */
  updateGhostVisual(facingAmount: number, isLooking: boolean): void {
    this.ghostGroup.rotation.y = Math.PI * (1 - facingAmount);
    const eyeColor = isLooking ? COLORS.alertRed : COLORS.dollHair;
    this.ghostEyeMaterial.color.set(eyeColor);
    this.ghostEyeMaterial.emissive.set(eyeColor);
    this.ghostEyeMaterial.emissiveIntensity = isLooking ? 1.2 : 0.4;
  }

  /** 觸發一次成功前進的攝影機補間動畫（含依左右腳交替的踏步擺動）。 */
  startStepTween(targetDistance: number, foot: Foot, now: number): void {
    this.tweenFromDistance = this.cameraDistance;
    this.tweenTargetDistance = targetDistance;
    this.tweenStartedAt = now;
    this.tweenActive = true;
    this.tweenFoot = foot;
  }

  /** 觸發違規時的「震動」提示，取代前進動畫。 */
  startCaughtShake(now: number): void {
    this.shakeStartedAt = now;
  }

  setCameraDistanceImmediate(distance: number): void {
    this.cameraDistance = distance;
    this.tweenActive = false;
    this.camera.position.z = distance;
  }

  /** 每幀呼叫：推進攝影機補間、踏步擺動與震動效果。 */
  updateAnimations(now: number): void {
    let bobOffset = 0;
    let lateralOffset = 0;

    if (this.tweenActive) {
      const t = Math.min((now - this.tweenStartedAt) / STEP_TWEEN_MS, 1);
      const eased = easeOutCubic(t);
      this.cameraDistance = this.tweenFromDistance + (this.tweenTargetDistance - this.tweenFromDistance) * eased;
      bobOffset = Math.sin(t * Math.PI) * BOB_HEIGHT_M;
      lateralOffset = Math.sin(t * Math.PI) * 0.03 * (this.tweenFoot === "left" ? -1 : 1);
      if (t >= 1) this.tweenActive = false;
    }

    let shakeOffset = 0;
    const shakeElapsed = now - this.shakeStartedAt;
    if (shakeElapsed >= 0 && shakeElapsed < SHAKE_DURATION_MS) {
      const t = shakeElapsed / SHAKE_DURATION_MS;
      shakeOffset = Math.sin(t * Math.PI * 6) * SHAKE_MAGNITUDE_M * (1 - t);
    }

    this.camera.position.z = this.cameraDistance;
    this.camera.position.y = CAMERA_HEIGHT_M + bobOffset;
    this.camera.position.x = lateralOffset + shakeOffset;
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
