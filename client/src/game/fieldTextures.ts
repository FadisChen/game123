import * as THREE from "three";

// Periodic noise makes the sand tile seamless at every octave.
function noise(x: number, y: number, period: number): number {
  const hash = (a: number, b: number) => {
    const value = Math.sin((a % period) * 127.1 + (b % period) * 311.7) * 43758.5453;
    return value - Math.floor(value);
  };
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix, iy), hash(ix + 1, iy), u),
    THREE.MathUtils.lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), u), v);
}

// 玩家與主辦方共用程序材質，不需要下載外部圖片。
export function sandTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1024;
  const ctx = canvas.getContext("2d")!;
  let seed = 732;
  const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const pixels = ctx.createImageData(1024, 1024);
  for (let y = 0; y < 1024; y++) {
    for (let x = 0; x < 1024; x++) {
      const n = noise(x / 128, y / 128, 8) * 0.5
        + noise(x / 32, y / 32, 32) * 0.3 + noise(x / 8, y / 8, 128) * 0.2;
      const grain = (rng() - 0.5) * 17;
      const i = (y * 1024 + x) * 4;
      pixels.data[i] = 199 + n * 35 + grain;
      pixels.data[i + 1] = 151 + n * 37 + grain;
      pixels.data[i + 2] = 76 + n * 39 + grain;
      pixels.data[i + 3] = 255;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(48, 48);
  texture.anisotropy = 8;
  return texture;
}

export function skyTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 4096;
  canvas.height = 2048;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(2, 2);
  const gradient = ctx.createLinearGradient(0, 0, 0, 1024);
  gradient.addColorStop(0, "#2672cb");
  gradient.addColorStop(0.28, "#4295e4");
  gradient.addColorStop(0.5, "#a3d2ed");
  gradient.addColorStop(0.54, "#dedcc1");
  gradient.addColorStop(1, "#d6bb7c");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 2048, 1024);
  let seed = 231;
  const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let cloud = 0; cloud < 65; cloud++) {
    const x = rng() * 2048, y = 270 + rng() * 220;
    const size = 0.35 + (500 - y) / 170;
    for (let puff = 0; puff < 14; puff++) {
      const px = x + (puff - 7) * 6 * size;
      const py = y - Math.sin(puff / 13 * Math.PI) * 8 * size;
      const r = (5 + rng() * 9) * size;
      const cloudColor = ctx.createRadialGradient(px, py - r * 0.2, 1, px, py, r);
      cloudColor.addColorStop(0, "#fffef9ef");
      cloudColor.addColorStop(0.75, "#f9fcffdf");
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

/** Painted countryside repeats around the arena, including its exterior faces. */
export function countrysideTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 4096;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(2, 2);
  const gradient = ctx.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, "#4397dc");
  gradient.addColorStop(0.65, "#acd3e7");
  gradient.addColorStop(0.66, "#aeb979");
  gradient.addColorStop(1, "#d8b154");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 2048, 512);
  let seed = 99;
  const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 30; i++) {
    const x = rng() * 2048, y = 40 + rng() * 220;
    for (let puff = 0; puff < 12; puff++) {
      const radius = 8 + rng() * 14;
      const px = x + puff * 6, py = y - Math.sin(puff / 11 * Math.PI) * 15;
      const cloud = ctx.createRadialGradient(px, py, radius * 0.4, px, py, radius);
      cloud.addColorStop(0, "#fffef9ee"); cloud.addColorStop(1, "#ffffff00");
      ctx.fillStyle = cloud;
      ctx.fillRect(px - radius, py - radius, radius * 2, radius * 2);
    }
  }
  for (let layer = 0; layer < 3; layer++) {
    for (let i = 0; i < 180; i++) {
      const x = i / 180 * 2048;
      const y = 340 + layer * 22 + Math.sin(x / 160 + layer) * 10;
      const radius = 9 + rng() * (9 + layer * 4);
      for (let lobe = 0; lobe < 7; lobe++) {
        const px = x + (rng() - 0.5) * radius * 2;
        const py = y - rng() * radius * 1.3;
        ctx.beginPath(); ctx.arc(px, py, radius * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = ["#7a925f", "#667d43", "#526637", "#7f8644"][Math.min(3, layer + (lobe % 2))];
        ctx.fill();
      }
    }
  }
  for (let i = 0; i < 14000; i++) {
    const x = rng() * 2048, y = 403 + rng() * 109;
    ctx.strokeStyle = i % 2 ? "#edd18c80" : "#9b873c80";
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + rng() * 2, y - 3 - (y - 400) * 0.1); ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
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
