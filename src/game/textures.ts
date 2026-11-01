import * as THREE from "three";

const TILE = 16;
const COUNT = 16;

function spec(n: number): number {
  n = (n ^ (n << 13)) >>> 0;
  return n & 255;
}

function shade(hex: string, delta: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + delta));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + delta));
  const b = Math.max(0, Math.min(255, (n & 255) + delta));
  return `rgb(${r},${g},${b})`;
}

function noisy(
  ctx: CanvasRenderingContext2D,
  base: string,
  seed: number,
  amp: number,
): void {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const d = (spec(x * 17 + y * 53 + seed) % (amp * 2 + 1)) - amp;
      ctx.fillStyle = shade(base, d);
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

export function makeAtlas(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = TILE * COUNT;
  canvas.height = TILE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");

  function tile(i: number, draw: (g: CanvasRenderingContext2D) => void): void {
    ctx!.save();
    ctx!.translate(i * TILE, 0);
    ctx!.beginPath();
    ctx!.rect(0, 0, TILE, TILE);
    ctx!.clip();
    draw(ctx!);
    ctx!.restore();
  }

  tile(0, (g) => noisy(g, "#6ea03a", 1, 18));
  tile(1, (g) => {
    noisy(g, "#8d5a32", 2, 14);
    g.fillStyle = "#6ea03a";
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < TILE; x++) {
        const d = (spec(x * 9 + y * 3) % 21) - 8;
        g.fillStyle = shade("#5f9434", d);
        g.fillRect(x, y, 1, 1);
      }
    }
    g.fillStyle = "#7a4e2c";
    g.fillRect(0, 4, TILE, 1);
  });
  tile(2, (g) => noisy(g, "#8d5a32", 3, 16));
  tile(3, (g) => {
    noisy(g, "#8a8680", 4, 12);
    g.fillStyle = "#6f6b66";
    for (let k = 0; k < 8; k++) {
      const x = spec(k * 13) % 14;
      const y = spec(k * 29) % 14;
      g.fillRect(x, y, 2, 2);
    }
  });
  tile(4, (g) => noisy(g, "#e4d2a0", 5, 14));
  tile(5, (g) => {
    noisy(g, "#6b4423", 6, 10);
    g.fillStyle = "#4e3018";
    for (let x = 2; x < TILE; x += 4) g.fillRect(x, 0, 1, TILE);
  });
  tile(6, (g) => {
    noisy(g, "#a67c42", 7, 10);
    g.strokeStyle = "#6b4423";
    g.lineWidth = 1;
    g.strokeRect(4.5, 4.5, 7, 7);
    g.fillStyle = "#6b4423";
    g.fillRect(7, 7, 2, 2);
  });
  tile(7, (g) => {
    g.clearRect(0, 0, TILE, TILE);
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const n = spec(x * 19 + y * 47 + 8);
        if (n % 7 === 0) continue;
        const d = (n % 25) - 10;
        g.fillStyle = shade(n % 5 === 0 ? "#2f6e30" : "#3f8f3a", d);
        g.fillRect(x, y, 1, 1);
      }
    }
  });
  tile(8, (g) => {
    noisy(g, "#c4a06a", 9, 8);
    g.fillStyle = "#a78455";
    for (let y = 0; y < TILE; y += 4) g.fillRect(0, y, TILE, 1);
    g.fillRect(4, 0, 1, 4);
    g.fillRect(12, 4, 1, 4);
    g.fillRect(2, 8, 1, 4);
    g.fillRect(9, 12, 1, 4);
  });
  tile(9, (g) => {
    g.clearRect(0, 0, TILE, TILE);
    g.fillStyle = "rgba(190,230,240,0.35)";
    g.fillRect(0, 0, TILE, TILE);
    g.fillStyle = "rgba(255,255,255,0.85)";
    g.fillRect(0, 0, TILE, 1);
    g.fillRect(0, 0, 1, TILE);
    g.fillRect(0, TILE - 1, TILE, 1);
    g.fillRect(TILE - 1, 0, 1, TILE);
    g.fillStyle = "rgba(255,255,255,0.55)";
    g.fillRect(3, 3, 4, 1);
    g.fillRect(3, 3, 1, 3);
  });
  tile(10, (g) => {
    noisy(g, "#3a78c4", 11, 10);
    g.fillStyle = "rgba(210,235,255,0.55)";
    for (let y = 2; y < TILE; y += 5) {
      g.fillRect(0, y, TILE, 1);
    }
  });
  tile(11, (g) => {
    noisy(g, "#7d7870", 12, 10);
    g.strokeStyle = "#5c5853";
    g.strokeRect(0.5, 0.5, 7, 7);
    g.strokeRect(8.5, 0.5, 7, 7);
    g.strokeRect(0.5, 8.5, 7, 7);
    g.strokeRect(8.5, 8.5, 7, 7);
  });
  tile(12, (g) => noisy(g, "#2c2926", 13, 8));

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export function makeCloudTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");
  ctx.clearRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) {
    const x = (spec(i * 31) / 255) * 256;
    const y = (spec(i * 17 + 4) / 255) * 256;
    const r = 18 + (spec(i * 11) % 28);
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, "rgba(255,255,255,0.85)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}
