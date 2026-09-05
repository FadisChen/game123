import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { COLORS, FINISH_DISTANCE_M, MAX_PLAYERS_PER_ROOM, PLAYER_LANE_COLORS } from "shared";
import { buildFieldEnvironment, PATH_HALF_WIDTH_M } from "../game/fieldEnvironment";
import { GhostVisual } from "../game/ghostVisual";

const GHOST_OFFSET_FROM_FINISH_M = 2;
const AVATAR_HEIGHT_M = 0.35;
const LANE_SPREAD_M = PATH_HALF_WIDTH_M * 1.6;

const BIRDSEYE_POSITION = new THREE.Vector3(0, 18, -6);
const BIRDSEYE_LOOK_AT = new THREE.Vector3(0, 0, FINISH_DISTANCE_M * 0.6);
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
  private readonly avatarMesh: THREE.InstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private readonly labelsContainer: HTMLDivElement;
  private readonly labelEls = new Map<string, HTMLDivElement>();
  private readonly latestAvatars = new Map<string, { x: number; z: number; player: HostAvatarInput }>();
  private readonly currentLookAt = BIRDSEYE_LOOK_AT.clone();

  private cameraMode: HostCameraMode = "birdseye";
  private orbitControls: OrbitControls | null = null;

  constructor(container: HTMLElement) {
    this.container = container;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.skyBlue);
    this.scene.fog = new THREE.Fog(COLORS.skyBlue, 20, FINISH_DISTANCE_M + 30);

    this.camera = new THREE.PerspectiveCamera(50, this.aspect(), 0.1, 200);
    this.camera.position.copy(BIRDSEYE_POSITION);
    this.camera.lookAt(this.currentLookAt);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.HemisphereLight(COLORS.skyBlue, COLORS.fieldYellow, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(5, 10, 5);
    this.scene.add(sun);

    buildFieldEnvironment(this.scene);

    const ghostZ = FINISH_DISTANCE_M - GHOST_OFFSET_FROM_FINISH_M;
    this.ghostVisual = new GhostVisual(this.scene, new THREE.Vector3(0, 0, ghostZ));

    const geometry = new THREE.CapsuleGeometry(0.22, 0.5, 4, 8);
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
    this.avatarMesh = new THREE.InstancedMesh(geometry, material, MAX_PLAYERS_PER_ROOM);
    this.avatarMesh.count = 0;
    // InstancedMesh 的包圍球是從建構當下（此時全部實例矩陣都還是 0）算出來的，之後只改 setMatrixAt
    // 不會自動重算，可能導致整個 mesh 被錯誤地視錐剔除；實例數最多 100 個，直接關閉剔除最簡單可靠。
    this.avatarMesh.frustumCulled = false;
    this.scene.add(this.avatarMesh);

    this.labelsContainer = document.createElement("div");
    this.labelsContainer.style.cssText = "position:absolute; inset:0; pointer-events:none;";
    container.appendChild(this.labelsContainer);

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

  /** 依目前玩家清單重新擺放所有玩家的頭像與姓名/分數標籤（依加入順序分配固定車道）。 */
  updateAvatars(players: HostAvatarInput[]): void {
    const count = Math.min(players.length, MAX_PLAYERS_PER_ROOM);
    this.avatarMesh.count = count;
    const seenIds = new Set<string>();

    for (let index = 0; index < count; index++) {
      const player = players[index];
      seenIds.add(player.playerId);

      const x = players.length > 1 ? (index / (players.length - 1) - 0.5) * LANE_SPREAD_M : 0;
      const z = player.distance;

      this.dummy.position.set(x, AVATAR_HEIGHT_M, z);
      this.dummy.updateMatrix();
      this.avatarMesh.setMatrixAt(index, this.dummy.matrix);

      const color = new THREE.Color(PLAYER_LANE_COLORS[index % PLAYER_LANE_COLORS.length]);
      if (player.eliminated) color.multiplyScalar(0.4);
      if (!player.connected) color.multiplyScalar(0.5);
      if (player.boosted) color.lerp(new THREE.Color(0xffffff), 0.5);
      this.avatarMesh.setColorAt(index, color);

      this.updateLabel(player, x, z);
      this.latestAvatars.set(player.playerId, { x, z, player });
    }

    this.avatarMesh.instanceMatrix.needsUpdate = true;
    if (this.avatarMesh.instanceColor) this.avatarMesh.instanceColor.needsUpdate = true;

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
    if (this.orbitControls) this.orbitControls.enabled = mode === "free";
    if (mode === "free") this.ensureOrbitControls().target.copy(this.currentLookAt);
    if (mode === "birdseye") {
      this.camera.position.copy(BIRDSEYE_POSITION);
      this.currentLookAt.copy(BIRDSEYE_LOOK_AT);
      this.camera.lookAt(this.currentLookAt);
    }
  }

  getCameraMode(): HostCameraMode {
    return this.cameraMode;
  }

  private ensureOrbitControls(): OrbitControls {
    if (!this.orbitControls) {
      this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
      this.orbitControls.enableDamping = true;
      this.orbitControls.target.copy(this.currentLookAt);
    }
    return this.orbitControls;
  }

  /** 依目前鏡頭模式決定攝影機這一幀該在哪裡：leader/last 平滑跟隨，free 交給 OrbitControls，birdseye 固定不動。 */
  private updateCameraFollow(): void {
    if (this.cameraMode === "free") {
      this.orbitControls?.update();
      return;
    }
    if (this.cameraMode === "birdseye") return;

    const target = this.pickFollowTarget();
    if (!target) return;

    const desiredPosition = new THREE.Vector3(0, FOLLOW_HEIGHT_M, target.z - FOLLOW_BACK_OFFSET_M);
    this.camera.position.lerp(desiredPosition, CAMERA_FOLLOW_LERP);
    this.currentLookAt.lerp(new THREE.Vector3(0, 0, target.z + FOLLOW_LOOKAHEAD_M), CAMERA_FOLLOW_LERP);
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
      el.style.cssText = `
        position:absolute; transform:translate(-50%, -100%);
        background:#333333cc; color:#f2f2f2; border-radius:8px; padding:2px 8px;
        font-size:12px; white-space:nowrap; text-align:center;
      `;
      this.labelsContainer.appendChild(el);
      this.labelEls.set(player.playerId, el);
    }

    const status = player.finished ? "🏆" : player.eliminated ? "💀" : !player.connected ? "📴" : player.boosted ? "⚡" : "";
    el.textContent = `${player.name} ${status} ${"❤️".repeat(Math.max(player.score, 0))}`;

    const worldPos = new THREE.Vector3(worldX, 1.1, worldZ);
    const projected = worldPos.project(this.camera);
    const screenX = (projected.x * 0.5 + 0.5) * this.container.clientWidth;
    const screenY = (-projected.y * 0.5 + 0.5) * this.container.clientHeight;
    el.style.left = `${screenX}px`;
    el.style.top = `${screenY}px`;
    el.style.display = projected.z > 1 ? "none" : "block";
  }

  render(): void {
    this.updateCameraFollow();
    this.renderer.render(this.scene, this.camera);
  }
}
