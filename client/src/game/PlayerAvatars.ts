import * as THREE from "three";
import { FINISH_DISTANCE_M, MAX_PLAYERS_PER_ROOM, type PlayerSummary } from "shared";
import { createPlayerGeometry } from "./characterModels";

export function playerLaneX(index: number, total: number): number {
  return total > 1 ? ((index % Math.min(total, 14)) / (Math.min(total, 14) - 1) - 0.5) * 19 : 0;
}

/** 每排 14 人從起點後方排隊；到終點時收斂到同一條線，判定距離仍由伺服器管理。 */
export function playerWorldZ(index: number, distance: number): number {
  return distance - Math.floor(index / 14) * 1.1 * Math.max(0, 1 - distance / FINISH_DISTANCE_M);
}

export class PlayerAvatars {
  private readonly scene: THREE.Scene;
  private readonly mesh: THREE.InstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private readonly numbers = new Map<string, THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>>();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.mesh = new THREE.InstancedMesh(createPlayerGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), MAX_PLAYERS_PER_ROOM);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);
  }

  update(players: PlayerSummary[], excludeId?: string): void {
    let count = 0;
    const seen = new Set<string>();
    players.slice(0, MAX_PLAYERS_PER_ROOM).forEach((player, index) => {
      if (player.playerId === excludeId) return;
      seen.add(player.playerId);
      const x = playerLaneX(index, players.length);
      const z = playerWorldZ(index, player.distance);
      this.dummy.position.set(x, 0, z);
      this.dummy.rotation.z = player.eliminated ? Math.PI / 2 : 0;
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(count, this.dummy.matrix);
      const color = new THREE.Color(player.eliminated ? 0x686868 : !player.connected ? 0x999999 : 0xffffff);
      this.mesh.setColorAt(count++, color);
      let number = this.numbers.get(player.playerId);
      if (!number) {
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
        number = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.15), new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false }));
        number.rotation.y = Math.PI;
        this.scene.add(number);
        this.numbers.set(player.playerId, number);
      }
      number.position.set(x, 0.76, z - 0.185);
      number.visible = !player.eliminated;
    });
    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    for (const [id, number] of this.numbers) {
      if (seen.has(id)) continue;
      this.scene.remove(number);
      number.geometry.dispose();
      number.material.map?.dispose();
      number.material.dispose();
      this.numbers.delete(id);
    }
  }
}
