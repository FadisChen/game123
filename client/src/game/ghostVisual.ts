import * as THREE from "three";
import { createCharacter } from "./characterModels";
import { replaceWithBlenderAsset } from "./blenderAssets";

/** 同一個立體娃娃在兩端以伺服器狀態轉身，轉身期間保留完整插值。 */
export class GhostVisual {
  private readonly model: THREE.Group;
  private looking: boolean | null = null;

  constructor(scene: THREE.Scene, position: THREE.Vector3) {
    this.model = createCharacter("doll");
    this.model.scale.setScalar(3.8);
    this.model.position.copy(position);
    scene.add(this.model);
    void replaceWithBlenderAsset(this.model, "doll", () => this.updateMaterials());
  }

  update(facingAmount: number, isLooking: boolean): void {
    this.model.rotation.y = facingAmount * Math.PI;
    if (this.looking === isLooking) return;
    this.looking = isLooking;
    this.updateMaterials();
  }

  private updateMaterials(): void {
    this.model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (material instanceof THREE.MeshStandardMaterial) {
          material.emissive.setHex(this.looking ? 0x320600 : 0x000000);
        }
      }
    });
  }
}
