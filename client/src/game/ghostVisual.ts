import * as THREE from "three";
import { COLORS } from "shared";
import { drawDollBack, drawDollFront, drawSensorGlow } from "./sprites";
import { colorHex, createBillboardSprite } from "./spriteUtils";

const SENSOR_FADE_FACTOR = 0.25;

/**
 * 鬼娃的視覺呈現（正面/背面貼圖切換 + 感測器紅光淡入淡出），玩家第一人稱場景與
 * 主辦方鳥瞰場景共用同一份，因為兩邊看到的都是同一隻鬼、同一份伺服器狀態。
 */
export class GhostVisual {
  private readonly frontSprite: THREE.Sprite;
  private readonly backSprite: THREE.Sprite;
  private readonly sensorSprite: THREE.Sprite;
  private sensorOpacity = 0;

  constructor(scene: THREE.Scene, position: THREE.Vector3) {
    this.backSprite = createBillboardSprite(
      drawDollBack(colorHex(COLORS.dollOrange), colorHex(COLORS.dollHair)),
      1.0,
      1.7,
    );
    this.backSprite.position.copy(position);
    scene.add(this.backSprite);

    this.frontSprite = createBillboardSprite(
      drawDollFront(colorHex(COLORS.dollOrange), colorHex(COLORS.dollSkin), colorHex(COLORS.dollHair)),
      1.0,
      1.7,
    );
    this.frontSprite.position.copy(position);
    this.frontSprite.visible = false;
    scene.add(this.frontSprite);

    this.sensorSprite = createBillboardSprite(drawSensorGlow(colorHex(COLORS.alertRed)), 0.22, 0.22);
    this.sensorSprite.position.set(position.x + 0.16, 1.5, position.z - 0.05);
    (this.sensorSprite.material as THREE.SpriteMaterial).opacity = 0;
    scene.add(this.sensorSprite);
  }

  update(facingAmount: number, isLooking: boolean): void {
    const facingPlayer = facingAmount >= 0.5;
    this.frontSprite.visible = facingPlayer;
    this.backSprite.visible = !facingPlayer;

    const targetOpacity = isLooking ? 1 : 0;
    this.sensorOpacity += (targetOpacity - this.sensorOpacity) * SENSOR_FADE_FACTOR;
    (this.sensorSprite.material as THREE.SpriteMaterial).opacity = this.sensorOpacity;
  }
}
