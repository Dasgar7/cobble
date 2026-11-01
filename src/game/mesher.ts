import * as THREE from "three";
import { AIR, BLOCKS, CHUNK, HEIGHT, tileFor } from "./blocks";
import type { World } from "./world";

type Bucket = {
  positions: number[];
  normals: number[];
  uvs: number[];
  colors: number[];
  indices: number[];
};

function bucket(): Bucket {
  return { positions: [], normals: [], uvs: [], colors: [], indices: [] };
}

const FACES: {
  nx: number;
  ny: number;
  nz: number;
  shade: number;
  corners: [number, number, number][];
  uvs: [number, number][];
}[] = [
  {
    nx: -1, ny: 0, nz: 0, shade: 0.62,
    corners: [[0, 1, 0], [0, 0, 0], [0, 1, 1], [0, 0, 1]],
    uvs: [[0, 1], [0, 0], [1, 1], [1, 0]],
  },
  {
    nx: 1, ny: 0, nz: 0, shade: 0.62,
    corners: [[1, 1, 1], [1, 0, 1], [1, 1, 0], [1, 0, 0]],
    uvs: [[0, 1], [0, 0], [1, 1], [1, 0]],
  },
  {
    nx: 0, ny: -1, nz: 0, shade: 0.48,
    corners: [[1, 0, 1], [0, 0, 1], [1, 0, 0], [0, 0, 0]],
    uvs: [[1, 1], [0, 1], [1, 0], [0, 0]],
  },
  {
    nx: 0, ny: 1, nz: 0, shade: 1,
    corners: [[0, 1, 1], [1, 1, 1], [0, 1, 0], [1, 1, 0]],
    uvs: [[0, 1], [1, 1], [0, 0], [1, 0]],
  },
  {
    nx: 0, ny: 0, nz: -1, shade: 0.78,
    corners: [[1, 0, 0], [0, 0, 0], [1, 1, 0], [0, 1, 0]],
    uvs: [[1, 0], [0, 0], [1, 1], [0, 1]],
  },
  {
    nx: 0, ny: 0, nz: 1, shade: 0.78,
    corners: [[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]],
    uvs: [[0, 0], [1, 0], [0, 1], [1, 1]],
  },
];

function hidden(selfId: number, neighborId: number): boolean {
  if (neighborId === AIR) return false;
  const n = BLOCKS[neighborId];
  const s = BLOCKS[selfId];
  if (!n) return false;
  if (n.opaque) return true;
  if (selfId === neighborId && (s.fluid || s.bucket === "glass" || s.bucket === "cutout")) return true;
  return false;
}

function occludes(world: World, x: number, y: number, z: number): boolean {
  if (y < 0 || y >= HEIGHT) return y < 0;
  return BLOCKS[world.get(x, y, z)]?.opaque ?? false;
}

function tangents(nx: number, ny: number): [[number, number, number], [number, number, number]] {
  if (ny !== 0) return [[1, 0, 0], [0, 0, 1]];
  if (nx !== 0) return [[0, 1, 0], [0, 0, 1]];
  return [[1, 0, 0], [0, 1, 0]];
}

function signAlong(t: [number, number, number], c: [number, number, number]): number {
  if (t[0]) return c[0] === 1 ? 1 : -1;
  if (t[1]) return c[1] === 1 ? 1 : -1;
  return c[2] === 1 ? 1 : -1;
}

function vertexAO(
  world: World,
  x: number,
  y: number,
  z: number,
  nx: number,
  ny: number,
  nz: number,
  c: [number, number, number],
): number {
  const [t1, t2] = tangents(nx, ny);
  const s1 = signAlong(t1, c);
  const s2 = signAlong(t2, c);
  const a1 = occludes(world, x + nx + t1[0] * s1, y + ny + t1[1] * s1, z + nz + t1[2] * s1);
  const a2 = occludes(world, x + nx + t2[0] * s2, y + ny + t2[1] * s2, z + nz + t2[2] * s2);
  const ac = occludes(
    world,
    x + nx + t1[0] * s1 + t2[0] * s2,
    y + ny + t1[1] * s1 + t2[1] * s2,
    z + nz + t1[2] * s1 + t2[2] * s2,
  );
  if (a1 && a2) return 0.52;
  const hits = (a1 ? 1 : 0) + (a2 ? 1 : 0) + (ac ? 1 : 0);
  return 1 - hits * 0.16;
}

const ATLAS = 16;
function packUV(tile: number, u: number, v: number): [number, number] {
  const inset = 0.06;
  const uu = tile + inset + u * (1 - inset * 2);
  const vv = inset + v * (1 - inset * 2);
  return [uu / ATLAS, vv];
}

function pushFace(
  b: Bucket,
  wx: number,
  wy: number,
  wz: number,
  face: (typeof FACES)[number],
  tile: number,
  aos: number[],
): void {
  const base = b.positions.length / 3;
  for (let i = 0; i < 4; i++) {
    const c = face.corners[i];
    b.positions.push(wx + c[0], wy + c[1], wz + c[2]);
    b.normals.push(face.nx, face.ny, face.nz);
    const [u, v] = packUV(tile, face.uvs[i][0], face.uvs[i][1]);
    b.uvs.push(u, v);
    const lit = face.shade * aos[i];
    b.colors.push(lit, lit, lit);
  }
  b.indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
}

export type BuiltBuffers = Record<"opaque" | "cutout" | "glass" | "water", Bucket>;

export function meshChunk(world: World, cx: number, cz: number): BuiltBuffers {
  const out: BuiltBuffers = {
    opaque: bucket(),
    cutout: bucket(),
    glass: bucket(),
    water: bucket(),
  };
  const x0 = cx * CHUNK;
  const z0 = cz * CHUNK;
  for (let lz = 0; lz < CHUNK; lz++) {
    for (let lx = 0; lx < CHUNK; lx++) {
      for (let y = 0; y < HEIGHT; y++) {
        const id = world.get(x0 + lx, y, z0 + lz);
        if (id === AIR) continue;
        const info = BLOCKS[id];
        const dest = out[info.bucket];
        for (const face of FACES) {
          const nid = world.get(x0 + lx + face.nx, y + face.ny, z0 + lz + face.nz);
          if (hidden(id, nid)) continue;
          const tile = tileFor(id, face.nx, face.ny);
          const aos = face.corners.map((c) =>
            info.fluid ? 1 : vertexAO(world, x0 + lx, y, z0 + lz, face.nx, face.ny, face.nz, c),
          );
          pushFace(dest, lx, y, lz, face, tile, aos);
        }
      }
    }
  }
  return out;
}

export function geometryFrom(b: Bucket): THREE.BufferGeometry | null {
  if (b.positions.length === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(b.positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(b.normals, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(b.uvs, 2));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(b.colors, 3));
  geo.setIndex(b.indices);
  geo.computeBoundingSphere();
  return geo;
}
