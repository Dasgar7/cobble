import * as THREE from "three";
import { AIR, COBBLE, DIRT, GRASS, PLANKS, SAND, STONE, WATER } from "./blocks";
import type { World } from "./world";

/** Blocky wildlife. One instanced mesh for every body part. */

const MAX = 18;
const PARTS = 10;
const STAND = new Set([GRASS, DIRT, SAND, STONE, COBBLE, PLANKS]);

export type AnimalSnap = { name: string; x: number; y: number; z: number };

type Role = "body" | "leg" | "wing" | "bob";

type PartDef = {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  color: number;
  role: Role;
  phase: number;
};

type Kind = {
  name: string;
  speed: number;
  scare: number;
  hop: number;
  voice: "chirp" | "snort";
  parts: PartDef[];
};

const HARE: Kind = {
  name: "Hare",
  speed: 1.55,
  scare: 6.2,
  hop: 0.18,
  voice: "chirp",
  parts: [
    { x: -0.14, y: 0.11, z: 0.16, sx: 0.1, sy: 0.22, sz: 0.1, color: 0x8d5a32, role: "leg", phase: 0 },
    { x: 0.14, y: 0.11, z: 0.16, sx: 0.1, sy: 0.22, sz: 0.1, color: 0x8d5a32, role: "leg", phase: Math.PI },
    { x: -0.14, y: 0.11, z: -0.16, sx: 0.1, sy: 0.22, sz: 0.1, color: 0x8d5a32, role: "leg", phase: Math.PI },
    { x: 0.14, y: 0.11, z: -0.16, sx: 0.1, sy: 0.22, sz: 0.1, color: 0x8d5a32, role: "leg", phase: 0 },
    { x: 0, y: 0.36, z: 0, sx: 0.4, sy: 0.28, sz: 0.52, color: 0xc4a06a, role: "body", phase: 0 },
    { x: 0, y: 0.56, z: 0.3, sx: 0.24, sy: 0.22, sz: 0.24, color: 0xf4efe6, role: "bob", phase: 0 },
    { x: -0.06, y: 0.84, z: 0.28, sx: 0.07, sy: 0.36, sz: 0.06, color: 0xe4b15a, role: "bob", phase: 0.4 },
    { x: 0.06, y: 0.84, z: 0.28, sx: 0.07, sy: 0.36, sz: 0.06, color: 0xe4b15a, role: "bob", phase: 0.4 },
    { x: 0, y: 0.52, z: 0.44, sx: 0.08, sy: 0.08, sz: 0.08, color: 0xe39262, role: "bob", phase: 0 },
    { x: 0, y: 0.4, z: -0.3, sx: 0.12, sy: 0.12, sz: 0.12, color: 0xf4efe6, role: "body", phase: 0 },
  ],
};

const BOAR: Kind = {
  name: "Boar",
  speed: 0.85,
  scare: 4.4,
  hop: 0.04,
  voice: "snort",
  parts: [
    { x: -0.2, y: 0.09, z: 0.26, sx: 0.12, sy: 0.18, sz: 0.12, color: 0x3a2a1c, role: "leg", phase: 0 },
    { x: 0.2, y: 0.09, z: 0.26, sx: 0.12, sy: 0.18, sz: 0.12, color: 0x3a2a1c, role: "leg", phase: Math.PI },
    { x: -0.2, y: 0.09, z: -0.26, sx: 0.12, sy: 0.18, sz: 0.12, color: 0x3a2a1c, role: "leg", phase: Math.PI },
    { x: 0.2, y: 0.09, z: -0.26, sx: 0.12, sy: 0.18, sz: 0.12, color: 0x3a2a1c, role: "leg", phase: 0 },
    { x: 0, y: 0.38, z: 0, sx: 0.62, sy: 0.36, sz: 0.86, color: 0x6b4423, role: "body", phase: 0 },
    { x: 0, y: 0.48, z: 0.5, sx: 0.36, sy: 0.28, sz: 0.32, color: 0x8d5a32, role: "bob", phase: 0 },
    { x: 0, y: 0.38, z: 0.72, sx: 0.22, sy: 0.14, sz: 0.18, color: 0xe4d2a0, role: "bob", phase: 0 },
    { x: -0.08, y: 0.28, z: 0.78, sx: 0.05, sy: 0.12, sz: 0.05, color: 0xf4efe6, role: "body", phase: 0 },
    { x: 0.08, y: 0.28, z: 0.78, sx: 0.05, sy: 0.12, sz: 0.05, color: 0xf4efe6, role: "body", phase: 0 },
    { x: 0, y: 0.46, z: -0.48, sx: 0.12, sy: 0.1, sz: 0.14, color: 0x3a2a1c, role: "body", phase: 0 },
  ],
};

const FINCH: Kind = {
  name: "Finch",
  speed: 1.25,
  scare: 7.4,
  hop: 0.06,
  voice: "chirp",
  parts: [
    { x: -0.07, y: 0.07, z: 0.02, sx: 0.06, sy: 0.14, sz: 0.06, color: 0x241c16, role: "leg", phase: 0 },
    { x: 0.07, y: 0.07, z: 0.02, sx: 0.06, sy: 0.14, sz: 0.06, color: 0x241c16, role: "leg", phase: Math.PI },
    { x: 0, y: 0.3, z: 0, sx: 0.38, sy: 0.27, sz: 0.46, color: 0xe4b15a, role: "body", phase: 0 },
    { x: 0, y: 0.46, z: 0.24, sx: 0.22, sy: 0.19, sz: 0.22, color: 0xf4efe6, role: "bob", phase: 0 },
    { x: 0, y: 0.44, z: 0.4, sx: 0.08, sy: 0.08, sz: 0.12, color: 0xe39262, role: "bob", phase: 0 },
    { x: -0.32, y: 0.32, z: 0, sx: 0.3, sy: 0.07, sz: 0.22, color: 0x8d5a32, role: "wing", phase: 0 },
    { x: 0.32, y: 0.32, z: 0, sx: 0.3, sy: 0.07, sz: 0.22, color: 0x8d5a32, role: "wing", phase: Math.PI },
    { x: 0, y: 0.36, z: -0.32, sx: 0.12, sy: 0.06, sz: 0.2, color: 0x6b4423, role: "body", phase: 0 },
    { x: -0.07, y: 0.52, z: 0.34, sx: 0.06, sy: 0.06, sz: 0.05, color: 0x14110e, role: "bob", phase: 0 },
    { x: 0.07, y: 0.52, z: 0.34, sx: 0.06, sy: 0.06, sz: 0.05, color: 0x14110e, role: "bob", phase: 0 },
  ],
};

const KINDS = [HARE, BOAR, FINCH];

type Slot = {
  on: boolean;
  kind: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  tx: number;
  tz: number;
  state: "idle" | "walk" | "flee" | "fly";
  timer: number;
  phase: number;
  cx: number;
  cz: number;
  lift: number;
};

function mix(n: number): number {
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return (n ^ (n >>> 16)) >>> 0;
}

function hash(seed: number, x: number, z: number, i: number): number {
  return mix(
    Math.imul(x | 0, 374761393) ^
      Math.imul(z | 0, 668265263) ^
      Math.imul(i | 0, 1274126177) ^
      Math.imul(seed | 0, 1442695041),
  );
}

export class Animals {
  private world: World | null = null;
  private slots: Slot[] = [];
  private seen = new Set<string>();
  private mesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private color = new THREE.Color();
  private noiseAt = 0;
  private clock = 0;

  constructor(scene: THREE.Scene) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX * PARTS);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = MAX * PARTS;
    scene.add(this.mesh);
    for (let i = 0; i < MAX; i++) {
      this.slots.push({
        on: false,
        kind: 0,
        x: 0,
        y: 0,
        z: 0,
        yaw: 0,
        tx: 0,
        tz: 0,
        state: "idle",
        timer: 0,
        phase: Math.random() * 6,
        cx: 0,
        cz: 0,
        lift: 0,
      });
    }
    this.hideAll();
  }

  clear(): void {
    this.seen.clear();
    for (const s of this.slots) s.on = false;
    this.hideAll();
  }

  welcome(world: World): void {
    this.world = world;
    this.clear();
    const spots: [number, number, number][] = [
      [0, 0.4, -6.4],
      [1, 3.6, -4.4],
      [2, -4.6, -7.2],
      [0, 8.2, 5.4],
      [1, -7.4, 3.2],
    ];
    for (const [kind, x, z] of spots) this.trySpawn(kind, x, z, true);
  }

  /** Roll wildlife for a freshly meshed chunk. Safe to call again. */
  consider(cx: number, cz: number): void {
    const world = this.world;
    if (!world) return;
    const key = `${cx},${cz}`;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    if (this.alive() >= MAX) return;
    const roll = hash(world.seed, cx, cz, 1) % 8;
    if (roll > 2) return;
    const x = cx * 16 + 3 + (hash(world.seed, cx, cz, 2) % 10);
    const z = cz * 16 + 3 + (hash(world.seed, cx, cz, 3) % 10);
    this.trySpawn(roll % 3, x, z, false);
  }

  forget(cx: number, cz: number): void {
    this.seen.delete(`${cx},${cz}`);
    let dirty = false;
    for (const s of this.slots) {
      if (s.on && s.cx === cx && s.cz === cz) {
        s.on = false;
        dirty = true;
      }
    }
    if (dirty) this.draw(0);
  }

  tint(r: number, g: number, b: number): void {
    (this.mesh.material as THREE.MeshBasicMaterial).color.setRGB(r, g, b);
  }

  update(dt: number, player: THREE.Vector3 | null, voice: (kind: "chirp" | "snort") => void): void {
    this.clock += dt;
    const world = this.world;
    if (!world) return;
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (!s.on) continue;
      const kind = KINDS[s.kind];
      s.phase += dt * (s.state === "idle" ? 1.6 : s.state === "fly" ? 14 : 7);
      s.timer -= dt;

      if (player && s.state !== "flee" && s.state !== "fly") {
        const dx = s.x - player.x;
        const dz = s.z - player.z;
        const d = Math.hypot(dx, dz);
        if (d < kind.scare && d > 0.05) {
          s.state = s.kind === 2 ? "fly" : "flee";
          s.timer = s.kind === 2 ? 1.7 : 2.3;
          s.tx = s.x + (dx / d) * 8;
          s.tz = s.z + (dz / d) * 8;
          if (this.clock - this.noiseAt > 0.45) {
            this.noiseAt = this.clock;
            voice(kind.voice);
          }
        }
      }

      if ((s.state === "flee" || s.state === "fly") && s.timer <= 0) {
        s.state = "idle";
        s.timer = 0.8;
      }

      if (s.timer <= 0 && s.state === "idle") {
        if (hash(i, Math.floor(this.clock * 4), s.cx, 4) % 3 === 0) {
          s.state = "idle";
          s.timer = 1.1 + (hash(i, s.cx, s.cz, 5) % 180) / 90;
        } else {
          const ang = ((hash(i, Math.floor(s.x), Math.floor(s.z), 6) % 628) / 100);
          const dist = 2 + (hash(i, s.cz, s.cx, 7) % 40) / 10;
          s.tx = s.x + Math.sin(ang) * dist;
          s.tz = s.z + Math.cos(ang) * dist;
          s.state = "walk";
          s.timer = 2.2 + (hash(i, 3, 5, 8) % 20) / 10;
        }
      }

      if (s.state === "walk" && s.timer <= 0) {
        s.state = "idle";
        s.timer = 0.7;
      }

      if (s.state === "walk" || s.state === "flee" || s.state === "fly") {
        let dx = s.tx - s.x;
        let dz = s.tz - s.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.35) {
          s.timer = 0;
          s.state = "idle";
        } else {
          dx /= d;
          dz /= d;
          const sp = kind.speed * (s.state === "flee" ? 2.15 : s.state === "fly" ? 2.4 : 1);
          const nx = s.x + dx * sp * dt;
          const nz = s.z + dz * sp * dt;
          if (s.state === "fly" || this.standY(nx, nz) !== null) {
            s.x = nx;
            s.z = nz;
            s.yaw = Math.atan2(dx, dz);
          } else {
            s.timer = 0;
            s.state = "idle";
          }
        }
      }

      const ground = this.standY(s.x, s.z);
      if (ground !== null && s.y - ground < 5) s.y = ground;
      if (s.state === "fly") {
        const k = Math.max(0, Math.min(1, s.timer / 1.7));
        s.lift = Math.sin((1 - k) * Math.PI) * 2.15;
      } else {
        s.lift += (0 - s.lift) * Math.min(1, dt * 6);
      }

      if (s.kind === 2 && s.state === "idle" && hash(i, Math.floor(this.clock), 2, 9) % 520 === 0) {
        if (this.clock - this.noiseAt > 1.4) {
          this.noiseAt = this.clock;
          voice("chirp");
        }
      }
    }
    if (player) this.nudge(player.x, player.z);
    this.separate();
    this.draw(dt);
  }

  /** Slide animals out of the player so you bump past them. */
  nudge(px: number, pz: number): void {
    for (const s of this.slots) {
      if (!s.on) continue;
      const dx = s.x - px;
      const dz = s.z - pz;
      const d = Math.hypot(dx, dz) || 0.0001;
      const min = s.kind === 2 ? 0.45 : 0.72;
      if (d < min) {
        s.x += (dx / d) * (min - d);
        s.z += (dz / d) * (min - d);
        if (s.state === "idle") {
          s.state = s.kind === 2 ? "fly" : "flee";
          s.timer = 1.2;
          s.tx = s.x + (dx / d) * 6;
          s.tz = s.z + (dz / d) * 6;
        }
      }
    }
  }

  look(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number): { name: string; dist: number } | null {
    let best: { name: string; dist: number } | null = null;
    for (const s of this.slots) {
      if (!s.on) continue;
      const h = s.kind === 1 ? 0.45 : s.kind === 2 ? 0.28 : 0.55;
      const vx = s.x - ox;
      const vy = s.y + h - oy;
      const vz = s.z - oz;
      const dist = Math.hypot(vx, vy, vz);
      if (dist > 7 || dist < 0.2) continue;
      const dot = (vx * dx + vy * dy + vz * dz) / dist;
      if (dot < 0.86) continue;
      if (!best || dist < best.dist) best = { name: KINDS[s.kind].name, dist };
    }
    return best;
  }

  snapshot(): AnimalSnap[] {
    const out: AnimalSnap[] = [];
    for (const s of this.slots) {
      if (!s.on) continue;
      out.push({ name: KINDS[s.kind].name, x: s.x, y: s.y, z: s.z });
    }
    return out;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }

  private alive(): number {
    let n = 0;
    for (const s of this.slots) if (s.on) n++;
    return n;
  }

  private trySpawn(kind: number, x: number, z: number, welcome: boolean): void {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    if (this.spawnAt(kind, ix, iz, welcome)) return;
    if (!welcome) return;
    for (let dz = -4; dz <= 4; dz++) {
      for (let dx = -4; dx <= 4; dx++) {
        if (dx === 0 && dz === 0) continue;
        if (this.spawnAt(kind, ix + dx, iz + dz, true)) return;
      }
    }
  }

  private spawnAt(kind: number, ix: number, iz: number, welcome: boolean): boolean {
    const world = this.world;
    if (!world || this.alive() >= MAX) return false;
    const y = this.standY(ix + 0.5, iz + 0.5);
    if (y === null) return false;
    const under = world.get(ix, y - 1, iz);
    if (welcome) {
      if (under !== GRASS && under !== SAND && under !== DIRT) return false;
    } else if (under !== GRASS && under !== SAND) return false;
    if (world.get(ix, y, iz) === WATER) return false;
    for (const s of this.slots) {
      if (!s.on) continue;
      if (Math.hypot(s.x - ix - 0.5, s.z - iz - 0.5) < 2.4) return false;
    }
    const slot = this.slots.find((s) => !s.on);
    if (!slot) return false;
    const cx = Math.floor(ix / 16);
    const cz = Math.floor(iz / 16);
    slot.on = true;
    slot.kind = kind;
    slot.x = ix + 0.5;
    slot.y = y;
    slot.z = iz + 0.5;
    slot.yaw = (hash(ix, iz, kind, 3) % 628) / 100;
    slot.tx = slot.x;
    slot.tz = slot.z;
    slot.state = "idle";
    slot.timer = 0.4 + (hash(ix, iz, 1, 2) % 100) / 80;
    slot.cx = cx;
    slot.cz = cz;
    slot.lift = 0;
    this.seen.add(`${cx},${cz}`);
    return true;
  }

  private standY(x: number, z: number): number | null {
    const world = this.world;
    if (!world) return null;
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const y = world.surfaceY(ix, iz);
    const under = world.get(ix, y - 1, iz);
    if (!STAND.has(under)) return null;
    if (world.get(ix, y, iz) !== AIR && world.get(ix, y, iz) !== WATER) return null;
    if (world.get(ix, y, iz) === WATER) return null;
    return y;
  }

  private separate(): void {
    const list = this.slots;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (!a.on) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (!b.on) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        const min = 0.85;
        if (d < min && d > 0.0001) {
          const push = (min - d) * 0.5;
          const nx = dx / d;
          const nz = dz / d;
          a.x -= nx * push;
          a.z -= nz * push;
          b.x += nx * push;
          b.z += nz * push;
        }
      }
    }
  }

  private draw(_dt: number): void {
    let dirty = false;
    for (let i = 0; i < MAX; i++) {
      const s = this.slots[i];
      const kind = KINDS[s.kind];
      const moving = s.on && s.state !== "idle";
      const hop = s.on && moving && s.state !== "fly" ? Math.abs(Math.sin(s.phase)) * kind.hop : 0;
      for (let p = 0; p < PARTS; p++) {
        const idx = i * PARTS + p;
        const part = kind.parts[p];
        if (!s.on || !part) {
          this.dummy.position.set(0, -50, 0);
          this.dummy.rotation.set(0, 0, 0);
          this.dummy.scale.set(0, 0, 0);
          this.dummy.updateMatrix();
          this.mesh.setMatrixAt(idx, this.dummy.matrix);
          continue;
        }
        let lx = part.x;
        let ly = part.y + hop + s.lift;
        let lz = part.z;
        if (part.role === "leg" && moving && s.state !== "fly") lz += Math.sin(s.phase + part.phase) * 0.07;
        if (part.role === "wing") ly += Math.sin(s.phase + part.phase) * (s.state === "fly" ? 0.12 : 0.025);
        if (part.role === "bob") ly += Math.sin(s.phase * 0.5 + part.phase) * 0.025;
        const sy = Math.sin(s.yaw);
        const cy = Math.cos(s.yaw);
        const wx = s.x + lx * cy + lz * sy;
        const wz = s.z - lx * sy + lz * cy;
        this.dummy.position.set(wx, s.y + ly - 0.04, wz);
        this.dummy.rotation.set(0, s.yaw, 0);
        this.dummy.scale.set(part.sx, part.sy, part.sz);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(idx, this.dummy.matrix);
        this.mesh.setColorAt(idx, this.color.setHex(part.color));
        dirty = true;
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (dirty && this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  private hideAll(): void {
    for (let i = 0; i < MAX * PARTS; i++) {
      this.dummy.position.set(0, -50, 0);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(0, 0, 0);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, this.color.setHex(0xffffff));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
