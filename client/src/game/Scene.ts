import * as THREE from "three";
import { FINISH_DISTANCE_M, STEP_TWEEN_MS, type Foot, type PlayerSummary } from "shared";
import { buildFieldEnvironment, lightScene } from "./fieldEnvironment";
import { GhostVisual } from "./ghostVisual";
import { PlayerAvatars, playerLaneX, playerWorldZ } from "./PlayerAvatars";
import { part, sphere } from "./characterModels";

const CAMERA_HEIGHT_M = 1.3;
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
  private readonly avatars: PlayerAvatars;
  private readonly hands = new THREE.Group();
  private laneX = 0;
  private playerIndex = 0;

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

    this.camera = new THREE.PerspectiveCamera(55, this.aspect(), 0.1, 200);
    this.camera.position.set(0, CAMERA_HEIGHT_M, 0);
    this.camera.lookAt(0, CAMERA_HEIGHT_M, 1);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.domElement.className = "game-canvas";
    container.appendChild(this.renderer.domElement);

    lightScene(this.scene, this.renderer);

    buildFieldEnvironment(this.scene);

    const ghostZ = FINISH_DISTANCE_M + GHOST_OFFSET_BEYOND_FINISH_M;
    this.ghostVisual = new GhostVisual(this.scene, new THREE.Vector3(0, 0, ghostZ));

    this.avatars = new PlayerAvatars(this.scene);
    this.buildHands();
    new ResizeObserver(() => this.handleResize()).observe(container);
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
    this.camera.position.z = playerWorldZ(this.playerIndex, distance);
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

    this.camera.position.z = playerWorldZ(this.playerIndex, this.cameraDistance);
    this.camera.position.y = CAMERA_HEIGHT_M + bobOffset;
    this.camera.position.x = this.laneX + lateralOffset + shakeOffset;
    this.hands.position.y = -0.13 + bobOffset * 0.3;
  }

  updatePlayers(players: PlayerSummary[], ownId: string): void {
    this.avatars.update(players, ownId);
    const index = players.findIndex((player) => player.playerId === ownId);
    if (index >= 0) {
      this.playerIndex = index;
      this.laneX = playerLaneX(index, players.length);
    }
  }

  private buildHands(): void {
    this.hands.scale.setScalar(0.72);
    this.hands.position.set(0, -0.13, -0.1);
    for (const side of [-1, 1]) {
      const sleeve = part(this.hands, new THREE.CapsuleGeometry(0.09, 0.3, 6, 12), 0x176659, side * 0.32, -0.37, -0.5);
      sleeve.rotation.set(-0.75, 0, side * 0.6);
      sphere(this.hands, 0xe6b78b, side * 0.25, -0.23, -0.64, 0.09, 0.06, 0.115);
      for (let finger = 0; finger < 4; finger++) {
        sphere(this.hands, 0xe6b78b, side * 0.25 + (finger - 1.5) * 0.039, -0.208, -0.72, 0.024, 0.028, 0.065 - Math.abs(finger - 1.5) * 0.009);
      }
      sphere(this.hands, 0xe6b78b, side * 0.17, -0.245, -0.64, 0.045, 0.034, 0.065);
    }
    this.hands.traverse((object) => { if (object instanceof THREE.Mesh) object.castShadow = false; });
    this.camera.add(this.hands);
    this.scene.add(this.camera);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
