import * as THREE from "three";
import { createCharacter } from "./characterModels";

/** 同一個立體娃娃在兩端以伺服器狀態轉身，假動作也保留完整插值。 */
export class GhostVisual {
  private readonly model: THREE.Group;

  constructor(scene: THREE.Scene, position: THREE.Vector3) {
    this.model = createCharacter("doll");
    this.model.scale.setScalar(3.1);
    this.model.position.copy(position);
    scene.add(this.model);
  }

  update(facingAmount: number, isLooking: boolean): void {
    this.model.rotation.y = facingAmount * Math.PI;
    this.model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const material = object.material as THREE.MeshStandardMaterial;
      material.emissive.setHex(isLooking ? 0x320600 : 0x000000);
    });
  }
}
