import * as THREE from "three";
import { FINISH_DISTANCE_M, STEP_TWEEN_MS, type Foot, type PlayerSummary } from "shared";
import { buildFieldEnvironment, FIELD_LENGTH, lightScene } from "./fieldEnvironment";
import { GhostVisual } from "./ghostVisual";
import { COLLAPSE_DURATION_MS, COLLAPSE_ROLL_RAD, PlayerAvatars, playerLaneX, playerWorldZ } from "./PlayerAvatars";

const CAMERA_HEIGHT_M = 1.3;
const GHOST_OFFSET_BEYOND_FINISH_M = 1;
const BOB_HEIGHT_M = 0.06;
const SHAKE_DURATION_MS = 220;
const SHAKE_MAGNITUDE_M = 0.05;
const COLLAPSE_EYE_HEIGHT_M = 0.3;

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
  private finishDistanceM = FINISH_DISTANCE_M;
  private laneX = 0;
  private playerIndex = 0;

  private cameraDistance = 0;
  private tweenFromDistance = 0;
  private tweenTargetDistance = 0;
  private tweenStartedAt = 0;
  private tweenActive = false;
  private tweenFoot: Foot = "left";

  private shakeStartedAt = -Infinity;
  private collapseStartedAt: number | null = null;
  /**
   * 建構子 lookAt() 之後的相機朝向。倒地動畫一律從這個四元數重新算起，
   * 而不是去寫 camera.rotation.z——看向 +Z 的 lookAt 產生的 Euler 是 (π, 0, π) 這種表示法，
   * 直接覆寫其中的 z 分量會把整個場景轉成上下顛倒。
   */
  private readonly baseQuaternion = new THREE.Quaternion();

  constructor(container: HTMLElement, showNames = true) {
    this.container = container;
    container.classList.add("player-game");

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(48, this.aspect(), 0.1, 200);
    this.camera.position.set(0, CAMERA_HEIGHT_M, 0);
    this.camera.lookAt(0, CAMERA_HEIGHT_M, 1);
    this.baseQuaternion.copy(this.camera.quaternion);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.domElement.className = "game-canvas";
    container.appendChild(this.renderer.domElement);

    lightScene(this.scene, this.renderer);

    buildFieldEnvironment(this.scene);

    const ghostZ = FIELD_LENGTH + GHOST_OFFSET_BEYOND_FINISH_M;
    this.ghostVisual = new GhostVisual(this.scene, new THREE.Vector3(0, 0, ghostZ));

    this.avatars = new PlayerAvatars(this.scene, { showNames });
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

  /** 自己被淘汰：鏡頭側倒並沉到地面高度，之後就停在那裡直到下一回合。 */
  playCollapse(now: number): void {
    this.collapseStartedAt = now;
  }

  /** 新回合開始時把倒地的鏡頭扶正。 */
  resetCollapse(): void {
    this.collapseStartedAt = null;
    this.camera.quaternion.copy(this.baseQuaternion);
  }

  setCameraDistanceImmediate(distance: number): void {
    this.cameraDistance = distance;
    this.tweenActive = false;
    this.camera.position.z = playerWorldZ(this.playerIndex, distance, this.finishDistanceM);
  }

  /** 每幀呼叫：推進攝影機補間、踏步擺動、震動效果，以及其他玩家的出局倒地動畫。 */
  updateAnimations(now: number): void {
    this.avatars.animate(now);
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

    let collapse = 0;
    if (this.collapseStartedAt !== null) {
      collapse = easeOutCubic(Math.min(Math.max(now - this.collapseStartedAt, 0) / COLLAPSE_DURATION_MS, 1));
    }

    this.camera.position.z = playerWorldZ(this.playerIndex, this.cameraDistance, this.finishDistanceM);
    const fallAngle = COLLAPSE_ROLL_RAD * collapse;
    const eyeRadius = CAMERA_HEIGHT_M - COLLAPSE_EYE_HEIGHT_M;
    this.camera.position.y = COLLAPSE_EYE_HEIGHT_M + eyeRadius * Math.cos(fallAngle) + bobOffset * (1 - collapse);
    this.camera.position.x = this.laneX + (lateralOffset + shakeOffset) * (1 - collapse) - eyeRadius * Math.sin(fallAngle);
    if (collapse > 0) {
      this.camera.quaternion.copy(this.baseQuaternion);
      // 相機看向 +Z，local Z 與角色的 world Z 相反，必須反號才會倒向同一側。
      this.camera.rotateZ(-fallAngle);
    }
  }

  updatePlayers(players: PlayerSummary[], ownId: string): void {
    this.avatars.update(players, ownId, this.finishDistanceM);
    const index = players.findIndex((player) => player.playerId === ownId);
    if (index >= 0) {
      this.playerIndex = index;
      this.laneX = playerLaneX(index, players.length);
    }
  }

  setFinishDistance(distance: number): void {
    this.finishDistanceM = distance;
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
