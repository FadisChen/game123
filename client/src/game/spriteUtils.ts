import * as THREE from "three";

export function colorHex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

/** 建立一個永遠面向攝影機的 2D 插畫看板（billboard），錨點在底部貼地（position.y = 0 即為地面）。 */
export function createBillboardSprite(texture: THREE.CanvasTexture, width: number, height: number): THREE.Sprite {
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(width, height, 1);
  sprite.center.set(0.5, 0);
  return sprite;
}
