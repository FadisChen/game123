import * as THREE from "three";

// 玩家與主辦方共用程序材質，不需要下載外部圖片。
export function sandTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1024;
  const ctx = canvas.getContext("2d")!;
  let seed = 732;
  const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  ctx.fillStyle = "#d6ad65";
  ctx.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 800; i++) {
    const x = rng() * 1024, y = rng() * 1024, r = 8 + rng() * 85;
    const wash = ctx.createRadialGradient(x, y, 0, x, y, r);
    wash.addColorStop(0, i % 2 ? "#fff1bb25" : "#88612f18");
    wash.addColorStop(1, "#d6ad6500");
    ctx.fillStyle = wash;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 180000; i++) {
    ctx.fillStyle = i % 2 ? `rgba(255,239,191,${rng() * 0.24})` : `rgba(103,71,27,${rng() * 0.17})`;
    ctx.fillRect(rng() * 1024, rng() * 1024, 0.5 + rng() * 2, 0.5 + rng());
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(30, 30);
  texture.anisotropy = 8;
  return texture;
}

export function skyTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createLinearGradient(0, 0, 0, 1024);
  gradient.addColorStop(0, "#2672c3");
  gradient.addColorStop(0.28, "#428ed6");
  gradient.addColorStop(0.5, "#61a7e0");
  gradient.addColorStop(0.54, "#ced2aa");
  gradient.addColorStop(1, "#d6bb7c");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 2048, 1024);
  let seed = 231;
  const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let cloud = 0; cloud < 40; cloud++) {
    const x = rng() * 2048, y = 270 + rng() * 220;
    const size = 0.35 + (500 - y) / 170;
    for (let puff = 0; puff < 14; puff++) {
      const px = x + (puff - 7) * 6 * size;
      const py = y - Math.sin(puff / 13 * Math.PI) * 8 * size;
      const r = (5 + rng() * 9) * size;
      const cloudColor = ctx.createRadialGradient(px, py - r * 0.2, 1, px, py, r);
      cloudColor.addColorStop(0, "#fffef9ef");
      cloudColor.addColorStop(0.6, "#f9fcffcf");
      cloudColor.addColorStop(1, "#f9fcff00");
      ctx.fillStyle = cloudColor;
      ctx.fillRect(px - r, py - r, r * 2, r * 2);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  return texture;
}

export function barkTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#796047";
  ctx.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 95; i++) {
    const x = (i * 43.7) % 128;
    ctx.strokeStyle = i % 2 ? "#3e30254a" : "#ba936a44";
    ctx.lineWidth = 0.6 + i % 3;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + 7, 75, x - 9, 180, x + 3, 256);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
