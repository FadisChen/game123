import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { FINISH_DISTANCE_M } from "shared";
import {
  buildFieldEnvironment,
  FIELD_LENGTH,
  lightScene,
} from "../game/fieldEnvironment";
import { GhostVisual } from "../game/ghostVisual";
import { OutcomeEffects } from "../game/OutcomeEffects";
import {
  PlayerAvatars,
  playerLaneX,
  playerWorldZ,
} from "../game/PlayerAvatars";

const GHOST_OFFSET_BEYOND_FINISH_M = 1;

/**
 * 預設機位刻意壓低成接近賽道高度的斜角，而不是正上方俯瞰：這個角度看得到地平線與鬼的正面，
 * 投影給現場觀眾看時比高空俯瞰更有臨場感。往後退到 -18 是為了讓最外側車道（±9.5m）的玩家
 * 站在起點時仍落在水平視野內——再往前就會被畫面左右邊緣裁掉。
 */
const BIRDSEYE_POSITION = new THREE.Vector3(0, 9, -18);
const BIRDSEYE_LOOK_AT = new THREE.Vector3(0, 0, FIELD_LENGTH * 0.75);
const FOLLOW_HEIGHT_M = 9;
const FOLLOW_BACK_OFFSET_M = 7;
const FOLLOW_LOOKAHEAD_M = 5;
/** 每幀往目標位置逼近的比例（0~1）：值越小鏡頭跟隨越平滑，但反應越慢。 */
const CAMERA_FOLLOW_LERP = 0.06;

/** 開場運鏡（點擊開始遊戲後）：推進→環繞→回到鳥瞰預設機位，三段各自的時長與環繞高度。 */
const INTRO_FAR_POSITION = new THREE.Vector3(0, 34, -70);
const INTRO_DOLLY_MS = 1300;
const INTRO_ORBIT_MS = 2600;
const INTRO_RETURN_MS = 1100;
const INTRO_ORBIT_HEIGHT_M = 7;
/** 環繞中心固定在起點線正中央——玩家開賽前都站在這條線上，不用等玩家清單才知道要繞哪裡。 */
const INTRO_ORBIT_CENTER = new THREE.Vector3(0, 0, 0);
/** 環繞半徑至少要蓋過最外側車道（±9.5m，見 PlayerAvatars.playerLaneX），不然鏡頭會直接穿過人群。 */
const INTRO_ORBIT_MIN_RADIUS_M = 14;
/** 環繞半徑＝目前最外圍玩家離起點線中心的距離＋這個緩衝，確保所有玩家都留在畫面邊緣內側。 */
const INTRO_ORBIT_RADIUS_MARGIN_M = 4;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * 環繞路徑上角度 angle（弧度）對應的機位，繞著 center 以 radius 轉一圈。
 * angle=0 刻意對齊鳥瞰預設機位那一側（起點線後方、z 較小的一側），
 * 這樣推進進來、環繞完退回去都是同一側平滑接上，不會中途穿過玩家群造成鏡頭瞬間翻轉。
 */
function introOrbitPoint(
  center: THREE.Vector3,
  angle: number,
  radius: number,
): THREE.Vector3 {
  return new THREE.Vector3(
    center.x + Math.sin(angle) * radius,
    INTRO_ORBIT_HEIGHT_M,
    center.z - Math.cos(angle) * radius,
  );
}

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
  private readonly outcomeEffects: OutcomeEffects;
  private readonly labelsContainer: HTMLDivElement;
  private readonly labelEls = new Map<string, HTMLDivElement>();
  private readonly latestAvatars = new Map<
    string,
    { x: number; z: number; player: HostAvatarInput }
  >();
  private readonly currentLookAt = BIRDSEYE_LOOK_AT.clone();

  private finishDistanceM = FINISH_DISTANCE_M;
  private cameraMode: HostCameraMode = "birdseye";
  private orbitControls: OrbitControls | null = null;
  private readonly directions = new Set<string>();
  private previousFrame = performance.now();
  private introState: {
    onComplete: () => void;
    startTime: number;
    center: THREE.Vector3;
    radius: number;
  } | null = null;
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

    const ghostZ = FIELD_LENGTH + GHOST_OFFSET_BEYOND_FINISH_M;
    this.ghostVisual = new GhostVisual(
      this.scene,
      new THREE.Vector3(0, 0, ghostZ),
    );

    this.avatars = new PlayerAvatars(this.scene);
    this.outcomeEffects = new OutcomeEffects(this.scene);

    this.labelsContainer = document.createElement("div");
    this.labelsContainer.style.cssText =
      "position:absolute; inset:0; pointer-events:none;";
    container.appendChild(this.labelsContainer);

    new ResizeObserver(() => this.handleResize()).observe(container);
    window.addEventListener("keydown", (event) => {
      if (
        !event.key.startsWith("Arrow") ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      )
        return;
      if (
        event.target instanceof HTMLElement &&
        event.target.closest(
          "input, textarea, select, [contenteditable], [role=dialog]",
        )
      )
        return;
      event.preventDefault();
      this.setDirectionPressed(event.key, true);
    });
    window.addEventListener("keyup", (event) =>
      this.setDirectionPressed(event.key, false),
    );
    window.addEventListener("blur", () => this.directions.clear());
    document.addEventListener("visibilitychange", () =>
      this.directions.clear(),
    );
  }

  private aspect(): number {
    return this.container.clientWidth / this.container.clientHeight;
  }

  private handleResize(): void {
    this.camera.aspect = this.aspect();
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(
      this.container.clientWidth,
      this.container.clientHeight,
    );
  }

  updateGhostVisual(facingAmount: number, isLooking: boolean): void {
    this.ghostVisual.update(facingAmount, isLooking);
  }

  /** 依目前玩家清單重新擺放所有玩家的頭像與姓名/分數標籤（依加入順序分配固定車道）。 */
  updateAvatars(players: HostAvatarInput[]): void {
    this.avatars.update(players, undefined, this.finishDistanceM);
    const count = players.length;
    const seenIds = new Set<string>();

    for (let index = 0; index < count; index++) {
      const player = players[index];
      seenIds.add(player.playerId);

      const x = playerLaneX(index, players.length);
      const z = playerWorldZ(index, player.distance, this.finishDistanceM);

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

  /** 在某位玩家目前站的位置放一次出局／抵達特效；還沒進過 updateAvatars 的玩家就跳過。 */
  playOutcomeEffect(
    playerId: string,
    outcome: "eliminated" | "finished",
  ): void {
    const avatar = this.latestAvatars.get(playerId);
    if (!avatar) return;
    const now = performance.now();
    if (outcome === "eliminated")
      this.outcomeEffects.spawnElimination(avatar.x, avatar.z, now);
    else this.outcomeEffects.spawnFinish(avatar.x, avatar.z, now);
  }

  /**
   * 開場運鏡（主辦方點擊開始遊戲後）：鏡頭從最遠處推進到玩家上方、環繞一圈，
   * 再回到鳥瞰預設機位；期間忽略鏡頭模式切換與方向鍵，避免動畫被打斷。結束後呼叫 onComplete
   * （由呼叫端接著播全螢幕倒數，倒數完才真正呼叫 startGame）。
   */
  playStartCinematic(onComplete: () => void): void {
    if (this.orbitControls) {
      this.orbitControls.dispose();
      this.orbitControls = null;
    }
    this.directions.clear();
    this.cameraMode = "birdseye";
    this.onCameraModeChange?.("birdseye");
    this.introState = {
      onComplete,
      startTime: performance.now(),
      center: INTRO_ORBIT_CENTER.clone(),
      radius: this.computeOrbitRadius(),
    };
  }

  /**
   * 開場運鏡環繞的半徑：蓋過離起點線中心最遠的玩家再留一點緩衝，這樣環繞一圈時
   * 所有人都還在畫面裡，不會被鏡頭直接穿過去（見使用者回報）。還沒有玩家時退回最小半徑。
   */
  private computeOrbitRadius(): number {
    const entries = [...this.latestAvatars.values()];
    const maxSpread = entries.reduce(
      (max, entry) =>
        Math.max(
          max,
          Math.hypot(
            entry.x - INTRO_ORBIT_CENTER.x,
            entry.z - INTRO_ORBIT_CENTER.z,
          ),
        ),
      0,
    );
    return Math.max(
      INTRO_ORBIT_MIN_RADIUS_M,
      maxSpread + INTRO_ORBIT_RADIUS_MARGIN_M,
    );
  }

  /** 推進、環繞、回正三段的時間軸；回傳 true 代表這一幀由開場運鏡接管了攝影機。 */
  private updateIntroCinematic(now: number): boolean {
    if (!this.introState) return false;
    const { startTime, center, radius } = this.introState;
    const elapsed = now - startTime;
    const lookAtCenter = new THREE.Vector3(center.x, 1.2, center.z);

    if (elapsed < INTRO_DOLLY_MS) {
      const t = easeInOutCubic(elapsed / INTRO_DOLLY_MS);
      this.camera.position.lerpVectors(
        INTRO_FAR_POSITION,
        introOrbitPoint(center, 0, radius),
        t,
      );
      this.currentLookAt.lerpVectors(BIRDSEYE_LOOK_AT, lookAtCenter, t);
    } else if (elapsed < INTRO_DOLLY_MS + INTRO_ORBIT_MS) {
      const t = (elapsed - INTRO_DOLLY_MS) / INTRO_ORBIT_MS;
      this.camera.position.copy(
        introOrbitPoint(center, t * Math.PI * 2, radius),
      );
      this.currentLookAt.copy(lookAtCenter);
    } else if (elapsed < INTRO_DOLLY_MS + INTRO_ORBIT_MS + INTRO_RETURN_MS) {
      const t = easeInOutCubic(
        (elapsed - INTRO_DOLLY_MS - INTRO_ORBIT_MS) / INTRO_RETURN_MS,
      );
      this.camera.position.lerpVectors(
        introOrbitPoint(center, Math.PI * 2, radius),
        BIRDSEYE_POSITION,
        t,
      );
      this.currentLookAt.lerpVectors(lookAtCenter, BIRDSEYE_LOOK_AT, t);
    } else {
      this.camera.position.copy(BIRDSEYE_POSITION);
      this.currentLookAt.copy(BIRDSEYE_LOOK_AT);
      const { onComplete } = this.introState;
      this.introState = null;
      this.camera.lookAt(this.currentLookAt);
      onComplete();
      return true;
    }
    this.camera.lookAt(this.currentLookAt);
    return true;
  }

  /** 切換鏡頭模式（PRD 22.4）；birdseye 立刻回正機位，free 才會啟用滑鼠拖曳/縮放。 */
  setCameraMode(mode: HostCameraMode): void {
    if (this.introState) return;
    if (mode === this.cameraMode) return;
    this.cameraMode = mode;
    this.directions.clear();
    if (this.orbitControls && mode !== "free") {
      this.orbitControls.dispose();
      this.orbitControls = null;
    }
    if (mode === "free")
      this.ensureOrbitControls().target.copy(this.currentLookAt);
    if (mode === "birdseye") {
      this.camera.position.copy(BIRDSEYE_POSITION);
      this.currentLookAt.copy(BIRDSEYE_LOOK_AT);
      this.camera.lookAt(this.currentLookAt);
    }
    this.onCameraModeChange?.(mode);
  }

  setFinishDistance(distance: number): void {
    this.finishDistanceM = distance;
  }

  getCameraMode(): HostCameraMode {
    return this.cameraMode;
  }

  private ensureOrbitControls(): OrbitControls {
    if (!this.orbitControls) {
      this.orbitControls = new OrbitControls(
        this.camera,
        this.renderer.domElement,
      );
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
      const horizontal =
        Number(this.directions.has("ArrowRight")) -
        Number(this.directions.has("ArrowLeft"));
      const vertical =
        Number(this.directions.has("ArrowUp")) -
        Number(this.directions.has("ArrowDown"));
      if (horizontal || vertical) {
        const forward = this.camera.getWorldDirection(new THREE.Vector3());
        forward.y = 0;
        forward.normalize();
        const right = forward.clone().cross(new THREE.Vector3(0, 1, 0));
        const movement = forward
          .multiplyScalar(vertical)
          .addScaledVector(right, horizontal)
          .normalize()
          .multiplyScalar(12 * deltaSeconds);
        const controls = this.ensureOrbitControls();
        const next = controls.target.clone().add(movement);
        next.x = THREE.MathUtils.clamp(next.x, -24, 24);
        next.z = THREE.MathUtils.clamp(next.z, -20, FIELD_LENGTH + 20);
        movement.copy(next).sub(controls.target);
        controls.target.copy(next);
        this.camera.position.add(movement);
      }
      this.orbitControls?.update();
      if (this.orbitControls)
        this.currentLookAt.copy(this.orbitControls.target);
      return;
    }
    if (this.cameraMode === "birdseye") return;

    const target = this.pickFollowTarget();
    if (!target) return;

    const desiredPosition = new THREE.Vector3(
      target.x,
      FOLLOW_HEIGHT_M,
      target.z - FOLLOW_BACK_OFFSET_M,
    );
    this.camera.position.lerp(desiredPosition, CAMERA_FOLLOW_LERP);
    this.currentLookAt.lerp(
      new THREE.Vector3(target.x, 0, target.z + FOLLOW_LOOKAHEAD_M),
      CAMERA_FOLLOW_LERP,
    );
    this.camera.lookAt(this.currentLookAt);
  }

  /** leader 選距離最遠、last 選距離最短，優先只在還在場上的玩家（未淘汰）中選，避免鏡頭黏在已出局的人身上。 */
  private pickFollowTarget(): { x: number; z: number } | null {
    const entries = [...this.latestAvatars.values()];
    if (entries.length === 0) return null;
    const active = entries.filter((entry) => !entry.player.eliminated);
    const pool = active.length > 0 ? active : entries;
    const sorted = [...pool].sort((a, b) =>
      this.cameraMode === "leader"
        ? b.player.distance - a.player.distance
        : a.player.distance - b.player.distance,
    );
    return sorted[0] ?? null;
  }

  private updateLabel(
    player: HostAvatarInput,
    worldX: number,
    worldZ: number,
  ): void {
    let el = this.labelEls.get(player.playerId);
    if (!el) {
      el = document.createElement("div");
      el.dataset.playerId = player.playerId;
      el.className = "avatar-label";
      this.labelsContainer.appendChild(el);
      this.labelEls.set(player.playerId, el);
    }

    const status = player.finished
      ? "🏆"
      : player.eliminated
        ? "💀"
        : !player.connected
          ? "📴"
          : player.boosted
            ? "⚡"
            : "";
    el.textContent = `${player.name} ${status}`.trim();

    this.positionLabel(el, worldX, worldZ);
  }

  private positionLabel(
    el: HTMLDivElement,
    worldX: number,
    worldZ: number,
  ): void {
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
    this.avatars.animate(now);
    this.outcomeEffects.update(now);
    if (!this.updateIntroCinematic(now)) {
      this.updateCameraFollow(
        Math.min((now - this.previousFrame) / 1000, 0.05),
      );
    }
    this.previousFrame = now;
    this.repositionLabels();
    this.renderer.render(this.scene, this.camera);
  }

  setDirectionPressed(direction: string, pressed: boolean): void {
    if (this.introState) return;
    if (
      !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(direction)
    )
      return;
    if (pressed) {
      this.setCameraMode("free");
      this.directions.add(direction);
    } else this.directions.delete(direction);
  }

  getCameraTarget(): THREE.Vector3 {
    return this.currentLookAt;
  }
}
