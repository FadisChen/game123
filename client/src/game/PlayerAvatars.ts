import * as THREE from "three";
import { FINISH_DISTANCE_M, MAX_PLAYERS_PER_ROOM, type PlayerSummary } from "shared";
import { createPlayerGeometry } from "./characterModels";

/** 被抓到出局時倒地的動畫長度；夠慢到旁邊的玩家看得見發生了什麼，又不會拖到整局節奏。 */
const COLLAPSE_DURATION_MS = 600;
const NAME_HEIGHT_M = 1.78;
/** 倒下後名牌跟著落到地面附近，才不會浮在半空跟躺著的身體對不起來。 */
const NAME_COLLAPSED_HEIGHT_M = 0.5;

const ALIVE_COLOR = new THREE.Color(0xffffff);
const OFFLINE_COLOR = new THREE.Color(0x999999);
const DEAD_COLOR = new THREE.Color(0x686868);

export interface PlayerAvatarOptions {
  /** 在每個角色頭上掛一張姓名牌。玩家第一人稱視角用；主辦方端已有 DOM 標籤，不需要重複。 */
  showNames?: boolean;
}

interface AvatarState {
  x: number;
  z: number;
  eliminated: boolean;
  connected: boolean;
  /** 第一次在 animate() 看到出局的時間戳，用來推進倒地補間；null＝還沒出局。 */
  collapsedAt: number | null;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function playerLaneX(index: number, total: number): number {
  return total > 1 ? ((index % Math.min(total, 14)) / (Math.min(total, 14) - 1) - 0.5) * 19 : 0;
}

/** 每排 14 人從起點後方排隊；到終點時收斂到同一條線，判定距離仍由伺服器管理。 */
export function playerWorldZ(index: number, distance: number): number {
  return distance - Math.floor(index / 14) * 1.1 * Math.max(0, 1 - distance / FINISH_DISTANCE_M);
}

/**
 * 把姓名牌畫成貼圖：深色底框 + 描邊白字，跟主辦方端的 .avatar-label 是同一套視覺，
 * 這樣不管在什麼背景（沙地、天空、圍欄）前面都讀得到。字太長就自動縮字級。
 */
function drawNameTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let fontSize = 64;
  do {
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    if (ctx.measureText(text).width <= canvas.width - 72) break;
    fontSize -= 4;
  } while (fontSize > 28);

  const textWidth = ctx.measureText(text).width;
  const boxWidth = Math.min(textWidth + 44, canvas.width - 8);
  ctx.fillStyle = "#1e312ad9";
  ctx.strokeStyle = "#edf6de4d";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect((canvas.width - boxWidth) / 2, 14, boxWidth, 100, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#f4f1df";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * 場上所有玩家的角色。位置與顏色用 InstancedMesh（一次 draw call 撐得住上百人逐幀更新），
 * 背號與姓名牌則是每人一個獨立物件。
 *
 * update() 只吃資料，動畫交給每幀呼叫的 animate(now)——出局倒地是補間動畫，
 * 而玩家清單只在伺服器有變動時才更新，兩者節奏不同，必須分開。
 * animate() 的 now 基準由呼叫端決定（玩家端是伺服器時間、主辦方端是 performance.now()），
 * 這裡只在第一次看到出局時記下當下的 now，所以兩種基準都能正確運作。
 */
export class PlayerAvatars {
  private readonly scene: THREE.Scene;
  private readonly mesh: THREE.InstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private readonly color = new THREE.Color();
  private readonly numbers = new Map<string, THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>>();
  private readonly names = new Map<string, { sprite: THREE.Sprite; text: string }>();
  private readonly states = new Map<string, AvatarState>();
  private readonly showNames: boolean;
  /** animate() 要照 update() 當下的順序寫回 instance，否則角色會在畫面上互換位置。 */
  private order: string[] = [];

  constructor(scene: THREE.Scene, options: PlayerAvatarOptions = {}) {
    this.scene = scene;
    this.showNames = options.showNames ?? false;
    this.mesh = new THREE.InstancedMesh(createPlayerGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), MAX_PLAYERS_PER_ROOM);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);
  }

  update(players: PlayerSummary[], excludeId?: string): void {
    const seen = new Set<string>();
    this.order = [];

    players.slice(0, MAX_PLAYERS_PER_ROOM).forEach((player, index) => {
      if (player.playerId === excludeId) return;
      seen.add(player.playerId);
      this.order.push(player.playerId);

      const existing = this.states.get(player.playerId);
      this.states.set(player.playerId, {
        x: playerLaneX(index, players.length),
        z: playerWorldZ(index, player.distance),
        eliminated: player.eliminated,
        connected: player.connected,
        // 重玩時 eliminated 會變回 false，倒地動畫的時間戳也要跟著清掉。
        collapsedAt: player.eliminated ? existing?.collapsedAt ?? null : null,
      });

      this.ensureNumber(player.playerId, index);
      if (this.showNames) this.ensureName(player.playerId, this.nameLabel(player));
    });

    this.mesh.count = this.order.length;
    this.forgetUnseen(seen);
  }

  /** 每幀呼叫：把最新位置寫回 instance，並推進出局倒地的補間。 */
  animate(now: number): void {
    this.order.forEach((playerId, slot) => {
      const state = this.states.get(playerId);
      if (!state) return;

      let collapse = 0;
      if (state.eliminated) {
        state.collapsedAt ??= now;
        collapse = easeOutCubic(Math.min((now - state.collapsedAt) / COLLAPSE_DURATION_MS, 1));
      }

      this.dummy.position.set(state.x, 0, state.z);
      this.dummy.rotation.z = collapse * (Math.PI / 2);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(slot, this.dummy.matrix);

      // 出局的人隨著倒下逐漸褪成灰色，倒地動畫結束時剛好完全變灰。
      this.color.copy(state.eliminated ? ALIVE_COLOR : state.connected ? ALIVE_COLOR : OFFLINE_COLOR);
      if (state.eliminated) this.color.lerp(DEAD_COLOR, collapse);
      this.mesh.setColorAt(slot, this.color);

      const number = this.numbers.get(playerId);
      if (number) {
        number.position.set(state.x, 0.76, state.z - 0.185);
        number.visible = !state.eliminated;
      }

      const name = this.names.get(playerId);
      if (name) {
        name.sprite.position.set(state.x, NAME_HEIGHT_M + (NAME_COLLAPSED_HEIGHT_M - NAME_HEIGHT_M) * collapse, state.z);
        name.sprite.material.opacity = state.eliminated ? 0.65 : 1;
      }
    });

    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  private nameLabel(player: PlayerSummary): string {
    const status = player.finished ? "🏆 " : player.eliminated ? "💀 " : !player.connected ? "📴 " : "";
    return `${status}${player.name}`;
  }

  private ensureNumber(playerId: string, index: number): void {
    if (this.numbers.has(playerId)) return;
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#f4f1df";
    ctx.font = "bold 48px Arial";
    ctx.textAlign = "center";
    ctx.fillText(String(index + 1).padStart(3, "0"), 64, 49);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    const number = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.15), new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false }));
    number.rotation.y = Math.PI;
    this.scene.add(number);
    this.numbers.set(playerId, number);
  }

  /** 用 Sprite 而非平面：Sprite 一定正對鏡頭，玩家橫向走動時名字不會被看成側面的一條線。 */
  private ensureName(playerId: string, text: string): void {
    const existing = this.names.get(playerId);
    if (existing) {
      if (existing.text === text) return;
      existing.sprite.material.map?.dispose();
      existing.sprite.material.map = drawNameTexture(text);
      existing.sprite.material.needsUpdate = true;
      existing.text = text;
      return;
    }
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: drawNameTexture(text), transparent: true, depthWrite: false }));
    sprite.scale.set(2, 0.5, 1);
    this.scene.add(sprite);
    this.names.set(playerId, { sprite, text });
  }

  private forgetUnseen(seen: Set<string>): void {
    for (const [id, number] of this.numbers) {
      if (seen.has(id)) continue;
      this.scene.remove(number);
      number.geometry.dispose();
      number.material.map?.dispose();
      number.material.dispose();
      this.numbers.delete(id);
    }
    for (const [id, name] of this.names) {
      if (seen.has(id)) continue;
      this.scene.remove(name.sprite);
      name.sprite.material.map?.dispose();
      name.sprite.material.dispose();
      this.names.delete(id);
    }
    for (const id of [...this.states.keys()]) {
      if (!seen.has(id)) this.states.delete(id);
    }
  }
}
