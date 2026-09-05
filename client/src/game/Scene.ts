import * as THREE from "three";
import { COLORS, FINISH_DISTANCE_M, STEP_TWEEN_MS, type Foot } from "shared";
import { drawGuard } from "./sprites";
import { buildFieldEnvironment, FIELD_HALF_WIDTH_M } from "./fieldEnvironment";
import { colorHex, createBillboardSprite } from "./spriteUtils";
import { GhostVisual } from "./ghostVisual";

const CAMERA_HEIGHT_M = 1.6;
const GHOST_OFFSET_BEYOND_FINISH_M = 1;
const BOB_HEIGHT_M = 0.06;
const SHAKE_DURATION_MS = 220;
const SHAKE_MAGNITUDE_M = 0.05;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export class GameScene {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;

  private readonly ghostVisual: GhostVisual;
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

    buildFieldEnvironment(this.scene);

    const ghostZ = FINISH_DISTANCE_M + GHOST_OFFSET_BEYOND_FINISH_M;
    this.ghostVisual = new GhostVisual(this.scene, new THREE.Vector3(0, 0, ghostZ));

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

  updateGhostVisual(facingAmount: number, isLooking: boolean): void {
    this.ghostVisual.update(facingAmount, isLooking);
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
