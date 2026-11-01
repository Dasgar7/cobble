import {
  AIR,
  BEDROCK,
  BLOCKS,
  CHUNK,
  DIRT,
  GRASS,
  HEIGHT,
  LEAVES,
  LOG,
  SAND,
  SEA,
  STONE,
  WATER,
} from "./blocks";
import { makeHasher } from "./noise";

export type ChunkData = {
  cx: number;
  cz: number;
  blocks: Uint8Array;
};

const STRIDE = CHUNK * CHUNK;

function index(lx: number, y: number, lz: number): number {
  return lx + lz * CHUNK + y * STRIDE;
}

export class World {
  seed: number;
  chunks = new Map<string, ChunkData>();
  edits = new Map<string, number>();
  private hash: ReturnType<typeof makeHasher>;

  constructor(seed: number) {
    this.seed = seed | 0;
    this.hash = makeHasher(this.seed);
  }

  key(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  private heightAt(x: number, z: number): number {
    const n = this.hash.fbm(x * 0.035, z * 0.035);
    const ridge = this.hash.fbm(x * 0.01 + 40, z * 0.01);
    let h = Math.floor(14 + n * 12 + ridge * 7);
    const cheb = Math.max(Math.abs(x), Math.abs(z));
    if (cheb <= 6 && h < SEA + 2) {
      const t = cheb / 6;
      const lifted = Math.round((SEA + 2) * (1 - t) + h * t);
      h = Math.max(h, lifted);
    }
    if (h < 4) h = 4;
    if (h > HEIGHT - 6) h = HEIGHT - 6;
    return h;
  }

  private treeHere(x: number, z: number, h: number): number {
    if (Math.max(Math.abs(x), Math.abs(z)) <= 4) return 0;
    if (h <= SEA + 1) return 0;
    const n = this.hash.hash2(x, z);
    if (n % 29 !== 0) return 0;
    const h1 = this.heightAt(x + 1, z);
    const h2 = this.heightAt(x, z + 1);
    if (Math.abs(h1 - h) > 1 || Math.abs(h2 - h) > 1) return 0;
    return 4 + (n % 3);
  }

  ensure(cx: number, cz: number): ChunkData {
    const k = this.key(cx, cz);
    const existing = this.chunks.get(k);
    if (existing) return existing;
    const blocks = new Uint8Array(STRIDE * HEIGHT);
    const x0 = cx * CHUNK;
    const z0 = cz * CHUNK;

    for (let lz = 0; lz < CHUNK; lz++) {
      for (let lx = 0; lx < CHUNK; lx++) {
        const x = x0 + lx;
        const z = z0 + lz;
        const h = this.heightAt(x, z);
        const beach = h <= SEA + 1;
        blocks[index(lx, 0, lz)] = BEDROCK;
        const stoneTop = Math.max(2, h - 4);
        for (let y = 1; y < h; y++) {
          let id: number = STONE;
          if (y >= stoneTop) id = beach ? SAND : DIRT;
          if (y > 2 && y < h - 5) {
            const c = this.hash.noise3(x * 0.09, y * 0.14, z * 0.09);
            if (c > 0.74) id = AIR;
          }
          if (y === h - 1 && id !== AIR) id = beach ? SAND : GRASS;
          blocks[index(lx, y, lz)] = id;
        }
        for (let y = h; y < SEA; y++) {
          if (blocks[index(lx, y, lz)] === AIR) blocks[index(lx, y, lz)] = WATER;
        }
      }
    }

    for (let lz = -2; lz < CHUNK + 2; lz++) {
      for (let lx = -2; lx < CHUNK + 2; lx++) {
        const x = x0 + lx;
        const z = z0 + lz;
        const h = this.heightAt(x, z);
        const trunk = this.treeHere(x, z, h);
        if (!trunk) continue;
        const top = h + trunk - 1;
        for (let dy = 0; dy < trunk; dy++) this.paint(blocks, x0, z0, x, h + dy, z, LOG);
        for (let ly = -2; ly <= 2; ly++) {
          const rad = ly >= 1 ? 1 : 2;
          const yy = top + ly;
          for (let dz = -rad; dz <= rad; dz++) {
            for (let dx = -rad; dx <= rad; dx++) {
              if (Math.abs(dx) === 2 && Math.abs(dz) === 2 && ly < 1) continue;
              if (dx === 0 && dz === 0 && ly <= 0) continue;
              this.paint(blocks, x0, z0, x + dx, yy, z + dz, LEAVES);
            }
          }
        }
      }
    }

    for (const [ek, id] of this.edits) {
      const [xs, ys, zs] = ek.split(",");
      const x = Number(xs);
      const y = Number(ys);
      const z = Number(zs);
      if (y < 0 || y >= HEIGHT) continue;
      if (Math.floor(x / CHUNK) !== cx || Math.floor(z / CHUNK) !== cz) continue;
      const lx = x - x0;
      const lz = z - z0;
      blocks[index(lx, y, lz)] = id;
    }

    const chunk: ChunkData = { cx, cz, blocks };
    this.chunks.set(k, chunk);
    return chunk;
  }

  private paint(blocks: Uint8Array, x0: number, z0: number, x: number, y: number, z: number, id: number): void {
    if (y < 1 || y >= HEIGHT) return;
    const lx = x - x0;
    const lz = z - z0;
    if (lx < 0 || lz < 0 || lx >= CHUNK || lz >= CHUNK) return;
    const i = index(lx, y, lz);
    if (id === LEAVES && blocks[i] !== AIR && blocks[i] !== LEAVES) return;
    if (blocks[i] === LOG) return;
    blocks[i] = id;
  }

  get(x: number, y: number, z: number): number {
    if (y < 0) return BEDROCK;
    if (y >= HEIGHT) return AIR;
    const cx = Math.floor(x / CHUNK);
    const cz = Math.floor(z / CHUNK);
    const c = this.ensure(cx, cz);
    const lx = x - cx * CHUNK;
    const lz = z - cz * CHUNK;
    return c.blocks[index(lx, y, lz)];
  }

  /** Returns chunk coords that must be remeshed. */
  set(x: number, y: number, z: number, id: number): [number, number][] {
    if (y < 0 || y >= HEIGHT) return [];
    const cx = Math.floor(x / CHUNK);
    const cz = Math.floor(z / CHUNK);
    const c = this.ensure(cx, cz);
    const lx = x - cx * CHUNK;
    const lz = z - cz * CHUNK;
    const i = index(lx, y, lz);
    if (c.blocks[i] === id) return [];
    c.blocks[i] = id;
    this.edits.set(`${x},${y},${z}`, id);
    const out: [number, number][] = [[cx, cz]];
    if (lx === 0) out.push([cx - 1, cz]);
    if (lx === CHUNK - 1) out.push([cx + 1, cz]);
    if (lz === 0) out.push([cx, cz - 1]);
    if (lz === CHUNK - 1) out.push([cx, cz + 1]);
    return out;
  }

  solid(id: number): boolean {
    return BLOCKS[id]?.solid ?? false;
  }

  surfaceY(x: number, z: number): number {
    for (let y = HEIGHT - 1; y >= 0; y--) {
      if (this.solid(this.get(x, y, z))) return y + 1;
    }
    return SEA + 2;
  }

  loadEdits(edits: [number, number, number, number][]): void {
    this.edits.clear();
    for (const [x, y, z, id] of edits) this.edits.set(`${x},${y},${z}`, id);
    this.chunks.clear();
  }

  exportEdits(): [number, number, number, number][] {
    const out: [number, number, number, number][] = [];
    for (const [k, id] of this.edits) {
      const [x, y, z] = k.split(",").map(Number);
      out.push([x, y, z, id]);
    }
    return out;
  }
}
