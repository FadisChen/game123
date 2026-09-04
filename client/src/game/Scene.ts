import * as THREE from "three";
import { COLORS, FINISH_DISTANCE_M, STEP_TWEEN_MS } from "../config";
import type { Foot } from "./Player";
import { drawDollBack, drawDollFront, drawGuard, drawSensorGlow, drawTree } from "./sprites";

const CAMERA_HEIGHT_M = 1.6;
const PATH_HALF_WIDTH_M = 3;
const FIELD_HALF_WIDTH_M = 12;
const GHOST_OFFSET_FROM_FINISH_M = 2;
const BOB_HEIGHT_M = 0.06;
const SHAKE_DURATION_MS = 220;
const SHAKE_MAGNITUDE_M = 0.05;
const SENSOR_FADE_FACTOR = 0.25;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function colorHex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

/** 建立一個永遠面向攝影機的 2D 插畫看板（billboard），錨點在底部貼地（position.y = 0 即為地面）。 */
function createBillboardSprite(texture: THREE.CanvasTexture, width: number, height: number): THREE.Sprite {
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(width, height, 1);
  sprite.center.set(0.5, 0);
  return sprite;
}

export class GameScene {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;

  private readonly ghostFrontSprite: THREE.Sprite;
  private readonly ghostBackSprite: THREE.Sprite;
  private readonly ghostSensorSprite: THREE.Sprite;
  private readonly container: HTMLElement;

  private cameraDistance = 0;
  private tweenFromDistance = 0;
  private tweenTargetDistance = 0;
  private tweenStartedAt = 0;
  private tweenActive = false;
  private tweenFoot: Foot = "left";

  private shakeStartedAt = -Infinity;
  private sensorOpacity = 0;

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

    const treeSprite = createBillboardSprite(drawTree(colorHex(COLORS.trunkBrown)), 2.4, 3.2);
    treeSprite.position.set(-2.2, 0, FINISH_DISTANCE_M - 1);
    this.scene.add(treeSprite);

    const ghostZ = FINISH_DISTANCE_M - GHOST_OFFSET_FROM_FINISH_M;
    this.ghostBackSprite = createBillboardSprite(
      drawDollBack(colorHex(COLORS.dollOrange), colorHex(COLORS.dollHair)),
      1.0,
      1.7,
    );
    this.ghostBackSprite.position.set(0, 0, ghostZ);
    this.scene.add(this.ghostBackSprite);

    this.ghostFrontSprite = createBillboardSprite(
      drawDollFront(colorHex(COLORS.dollOrange), colorHex(COLORS.dollSkin), colorHex(COLORS.dollHair)),
      1.0,
      1.7,
    );
    this.ghostFrontSprite.position.set(0, 0, ghostZ);
    this.ghostFrontSprite.visible = false;
    this.scene.add(this.ghostFrontSprite);

    this.ghostSensorSprite = createBillboardSprite(drawSensorGlow(colorHex(COLORS.alertRed)), 0.22, 0.22);
    this.ghostSensorSprite.position.set(0.16, 1.5, ghostZ - 0.05);
    (this.ghostSensorSprite.material as THREE.SpriteMaterial).opacity = 0;
    this.scene.add(this.ghostSensorSprite);

    const guardTexture = drawGuard(colorHex(COLORS.guardMagenta));
    for (const x of [-FIELD_HALF_WIDTH_M * 0.6, FIELD_HALF_WIDTH_M * 0.6]) {
      const guardSprite = createBillboardSprite(guardTexture, 1.0, 1.75);
      guardSprite.position.set(x, 0, FINISH_DISTANCE_M * 0.4);
      this.scene.add(guardSprite);
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

  /**
   * 更新鬼的轉身視覺：facingAmount 超過一半時切換成正面插畫（看得到臉），
   * 否則顯示背面插畫（只看得到後腦勺）；感測器紅光只在 isLooking 判定生效時淡入。
   */
  updateGhostVisual(facingAmount: number, isLooking: boolean): void {
    const facingPlayer = facingAmount >= 0.5;
    this.ghostFrontSprite.visible = facingPlayer;
    this.ghostBackSprite.visible = !facingPlayer;

    const targetOpacity = isLooking ? 1 : 0;
    this.sensorOpacity += (targetOpacity - this.sensorOpacity) * SENSOR_FADE_FACTOR;
    (this.ghostSensorSprite.material as THREE.SpriteMaterial).opacity = this.sensorOpacity;
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
