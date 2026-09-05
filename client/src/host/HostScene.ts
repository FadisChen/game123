import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { FINISH_DISTANCE_M } from "shared";
import { buildFieldEnvironment, lightScene } from "../game/fieldEnvironment";
import { GhostVisual } from "../game/ghostVisual";
import { PlayerAvatars, playerLaneX, playerWorldZ } from "../game/PlayerAvatars";

const GHOST_OFFSET_BEYOND_FINISH_M = 1;

const BIRDSEYE_POSITION = new THREE.Vector3(0, 29, -19);
const BIRDSEYE_LOOK_AT = new THREE.Vector3(0, 0, FINISH_DISTANCE_M * 0.48);
const FOLLOW_HEIGHT_M = 9;
const FOLLOW_BACK_OFFSET_M = 7;
const FOLLOW_LOOKAHEAD_M = 5;
/** 每幀往目標位置逼近的比例（0~1）：值越小鏡頭跟隨越平滑，但反應越慢。 */
const CAMERA_FOLLOW_LERP = 0.06;

/** 主辦方鏡頭模式（PRD 22.4）：鳥瞰固定機位／自動跟隨領先者／自動跟隨落後者／自由拖曳鏡頭。 */
export type HostCameraMode = "birdseye" | "leader" | "last" | "free";

export interface HostAvatarInput {
  playerId: string;
  name: string;
  distance: number;
  score: number;
  connected: boolean;
  eliminated: boolean;
  finished: boolean;
  boosted?: boolean;
}

/**
 * 主辦方鳥瞰場景：跟玩家第一人稱場景（GameScene）共用地面/起終點線/圍欄/樹（buildFieldEnvironment）
 * 與鬼的視覺呈現（GhostVisual），因為兩邊看到的是同一份伺服器狀態。玩家頭像改用 InstancedMesh，
 * 因為同時可能有上百位玩家要逐幀更新位置，一個共用幾何體只需要一次 draw call。
 */
export class HostScene {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;

  private readonly container: HTMLElement;
  private readonly ghostVisual: GhostVisual;
  private readonly avatars: PlayerAvatars;
  private readonly labelsContainer: HTMLDivElement;
  private readonly labelEls = new Map<string, HTMLDivElement>();
  private readonly latestAvatars = new Map<string, { x: number; z: number; player: HostAvatarInput }>();
  private readonly currentLookAt = BIRDSEYE_LOOK_AT.clone();

  private cameraMode: HostCameraMode = "birdseye";
  private orbitControls: OrbitControls | null = null;
  private readonly directions = new Set<string>();
  private previousFrame = performance.now();
  onCameraModeChange?: (mode: HostCameraMode) => void;

  constructor(container: HTMLElement) {
    this.container = container;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(50, this.aspect(), 0.1, 200);
    this.camera.position.copy(BIRDSEYE_POSITION);
    this.camera.lookAt(this.currentLookAt);

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

    this.labelsContainer = document.createElement("div");
    this.labelsContainer.style.cssText = "position:absolute; inset:0; pointer-events:none;";
    container.appendChild(this.labelsContainer);

    new ResizeObserver(() => this.handleResize()).observe(container);
    window.addEventListener("keydown", (event) => {
      if (!event.key.startsWith("Arrow") || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable], [role=dialog]")) return;
      event.preventDefault();
      this.setDirectionPressed(event.key, true);
    });
    window.addEventListener("keyup", (event) => this.setDirectionPressed(event.key, false));
    window.addEventListener("blur", () => this.directions.clear());
    document.addEventListener("visibilitychange", () => this.directions.clear());
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

  /** 依目前玩家清單重新擺放所有玩家的頭像與姓名/分數標籤（依加入順序分配固定車道）。 */
  updateAvatars(players: HostAvatarInput[]): void {
    this.avatars.update(players);
    const count = players.length;
    const seenIds = new Set<string>();

    for (let index = 0; index < count; index++) {
      const player = players[index];
      seenIds.add(player.playerId);

      const x = playerLaneX(index, players.length);
      const z = playerWorldZ(index, player.distance);

      this.updateLabel(player, x, z);
      this.latestAvatars.set(player.playerId, { x, z, player });
    }

    for (const [id, el] of this.labelEls) {
      if (!seenIds.has(id)) {
        el.remove();
        this.labelEls.delete(id);
      }
    }
    for (const id of this.latestAvatars.keys()) {
      if (!seenIds.has(id)) this.latestAvatars.delete(id);
    }
  }

  /** 切換鏡頭模式（PRD 22.4）；birdseye 立刻回正機位，free 才會啟用滑鼠拖曳/縮放。 */
  setCameraMode(mode: HostCameraMode): void {
    if (mode === this.cameraMode) return;
    this.cameraMode = mode;
    this.directions.clear();
    if (this.orbitControls && mode !== "free") {
      this.orbitControls.dispose();
      this.orbitControls = null;
    }
    if (mode === "free") this.ensureOrbitControls().target.copy(this.currentLookAt);
    if (mode === "birdseye") {
      this.camera.position.copy(BIRDSEYE_POSITION);
      this.currentLookAt.copy(BIRDSEYE_LOOK_AT);
      this.camera.lookAt(this.currentLookAt);
    }
    this.onCameraModeChange?.(mode);
  }

  getCameraMode(): HostCameraMode {
    return this.cameraMode;
  }

  private ensureOrbitControls(): OrbitControls {
    if (!this.orbitControls) {
      this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
      this.orbitControls.enableDamping = true;
      this.orbitControls.minDistance = 4;
      this.orbitControls.maxDistance = 75;
      this.orbitControls.minPolarAngle = 0.12;
      this.orbitControls.maxPolarAngle = Math.PI / 2 - 0.08;
      this.orbitControls.target.copy(this.currentLookAt);
    }
    return this.orbitControls;
  }

  /** 依目前鏡頭模式決定攝影機這一幀該在哪裡：leader/last 平滑跟隨，free 交給 OrbitControls，birdseye 固定不動。 */
  private updateCameraFollow(deltaSeconds: number): void {
    if (this.cameraMode === "free") {
      const horizontal = Number(this.directions.has("ArrowRight")) - Number(this.directions.has("ArrowLeft"));
      const vertical = Number(this.directions.has("ArrowUp")) - Number(this.directions.has("ArrowDown"));
      if (horizontal || vertical) {
        const forward = this.camera.getWorldDirection(new THREE.Vector3());
        forward.y = 0;
        forward.normalize();
        const right = forward.clone().cross(new THREE.Vector3(0, 1, 0));
        const movement = forward.multiplyScalar(vertical).addScaledVector(right, horizontal).normalize().multiplyScalar(12 * deltaSeconds);
        const controls = this.ensureOrbitControls();
        const next = controls.target.clone().add(movement);
        next.x = THREE.MathUtils.clamp(next.x, -24, 24);
        next.z = THREE.MathUtils.clamp(next.z, -20, FINISH_DISTANCE_M + 20);
        movement.copy(next).sub(controls.target);
        controls.target.copy(next);
        this.camera.position.add(movement);
      }
      this.orbitControls?.update();
      if (this.orbitControls) this.currentLookAt.copy(this.orbitControls.target);
      return;
    }
    if (this.cameraMode === "birdseye") return;

    const target = this.pickFollowTarget();
    if (!target) return;

    const desiredPosition = new THREE.Vector3(target.x, FOLLOW_HEIGHT_M, target.z - FOLLOW_BACK_OFFSET_M);
    this.camera.position.lerp(desiredPosition, CAMERA_FOLLOW_LERP);
    this.currentLookAt.lerp(new THREE.Vector3(target.x, 0, target.z + FOLLOW_LOOKAHEAD_M), CAMERA_FOLLOW_LERP);
    this.camera.lookAt(this.currentLookAt);
  }

  /** leader 選距離最遠、last 選距離最短，優先只在還在場上的玩家（未淘汰）中選，避免鏡頭黏在已出局的人身上。 */
  private pickFollowTarget(): { x: number; z: number } | null {
    const entries = [...this.latestAvatars.values()];
    if (entries.length === 0) return null;
    const active = entries.filter((entry) => !entry.player.eliminated);
    const pool = active.length > 0 ? active : entries;
    const sorted = [...pool].sort((a, b) =>
      this.cameraMode === "leader" ? b.player.distance - a.player.distance : a.player.distance - b.player.distance,
    );
    return sorted[0] ?? null;
  }

  private updateLabel(player: HostAvatarInput, worldX: number, worldZ: number): void {
    let el = this.labelEls.get(player.playerId);
    if (!el) {
      el = document.createElement("div");
      el.dataset.playerId = player.playerId;
      el.className = "avatar-label";
      this.labelsContainer.appendChild(el);
      this.labelEls.set(player.playerId, el);
    }

    const status = player.finished ? "🏆" : player.eliminated ? "💀" : !player.connected ? "📴" : player.boosted ? "⚡" : "";
    el.textContent = `${player.name} ${status} ${"❤️".repeat(Math.max(player.score, 0))}`;

    this.positionLabel(el, worldX, worldZ);
  }

  private positionLabel(el: HTMLDivElement, worldX: number, worldZ: number): void {
    const worldPos = new THREE.Vector3(worldX, 1.65, worldZ);
    const projected = worldPos.project(this.camera);
    const screenX = (projected.x * 0.5 + 0.5) * this.container.clientWidth;
    const screenY = (-projected.y * 0.5 + 0.5) * this.container.clientHeight;
    el.style.left = `${screenX}px`;
    el.style.top = `${screenY}px`;
    el.style.display = projected.z > 1 || projected.z < -1 ? "none" : "block";
  }

  /**
   * 攝影機每一幀都可能在動（跟隨模式的平滑逼近、自由鏡頭的拖曳），但玩家清單資料本身沒變時
   * updateAvatars() 不會被呼叫，所以標籤位置需要獨立在每一幀重新投影，不能只靠資料變動時更新，
   * 不然鏡頭移動時姓名/分數標籤會停在舊位置，跟畫面上的 3D 頭像對不起來。
   */
  private repositionLabels(): void {
    for (const [playerId, avatar] of this.latestAvatars) {
      const el = this.labelEls.get(playerId);
      if (el) this.positionLabel(el, avatar.x, avatar.z);
    }
  }

  render(): void {
    const now = performance.now();
    this.updateCameraFollow(Math.min((now - this.previousFrame) / 1000, 0.05));
    this.previousFrame = now;
    this.repositionLabels();
    this.renderer.render(this.scene, this.camera);
  }

  setDirectionPressed(direction: string, pressed: boolean): void {
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(direction)) return;
    if (pressed) {
      this.setCameraMode("free");
      this.directions.add(direction);
    } else this.directions.delete(direction);
  }

  getCameraTarget(): THREE.Vector3 {
    return this.currentLookAt;
  }
}
