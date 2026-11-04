import * as THREE from "three";
import { Animals } from "./animals";
import { AIR, BEDROCK, BLOCKS, CHUNK, HOTBAR, WATER } from "./blocks";
import { GameAudio } from "./audio";
import { geometryFrom, meshChunk } from "./mesher";
import type { SaveData } from "./save";
import { writeSave } from "./save";
import { makeAtlas, makeCloudTexture } from "./textures";
import { World } from "./world";

const HW = 0.3;
const PH = 1.72;
const EYE = 1.58;
const STEP = 1 / 60;
const REACH = 5.5;
const MENU_SEED = 20261031;

export type Analog = {
  x: number;
  y: number;
  jump: boolean;
  down: boolean;
  sprint: boolean;
  breaking: boolean;
  placing: boolean;
};

export type HudState = {
  slot: number;
  held: string;
  aimed: string | null;
  x: number;
  y: number;
  z: number;
  flying: boolean;
  breakProgress: number;
  seed: number;
  muted: boolean;
  mode: "menu" | "play" | "pause";
};

const ZERO_ANALOG: Analog = {
  x: 0,
  y: 0,
  jump: false,
  down: false,
  sprint: false,
  breaking: false,
  placing: false,
};

type Part = {
  alive: boolean;
  life: number;
  max: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  color: number;
};

export class Engine {
  mode: "menu" | "play" | "pause" = "menu";
  world: World;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private timer = new THREE.Timer();
  private audio = new GameAudio();
  private atlas: THREE.CanvasTexture;
  private matOpaque: THREE.MeshBasicMaterial;
  private matCutout: THREE.MeshBasicMaterial;
  private matGlass: THREE.MeshBasicMaterial;
  private matWater: THREE.MeshBasicMaterial;
  private meshes = new Map<string, THREE.Group>();
  private queue: [number, number][] = [];
  private queued = new Set<string>();
  private highlight: THREE.LineSegments;
  private hand: THREE.Mesh;
  private cloud: THREE.Mesh;
  private sun: THREE.Mesh;
  private moon: THREE.Mesh;
  private stars: THREE.Points;
  private parts: Part[];
  private pmesh: THREE.InstancedMesh;
  private animals: Animals;
  private dummy = new THREE.Object3D();
  private color = new THREE.Color();
  private sky = new THREE.Color();
  private dir = new THREE.Vector3();
  private keys = new Set<string>();
  private injected = new Set<string>();
  private pos = new THREE.Vector3(0.5, 20, 0.5);
  private vx = 0;
  private vy = 0;
  private vz = 0;
  private yaw = 0;
  private pitch = -0.2;
  private grounded = false;
  private flying = false;
  private slot = 0;
  private acc = 0;
  private elapsed = 0;
  private skyT = 0.25;
  private lookDX = 0;
  private lookDY = 0;
  private lookTouch = false;
  private lookId: number | null = null;
  private lastLX = 0;
  private lastLY = 0;
  private breaking = false;
  private placing = false;
  private placeLatch = false;
  private placeHold = 0;
  private breakTime = 0;
  private breakKey = "";
  private bob = 0;
  private stepAcc = 0;
  private lastJump = -1;
  private saveAcc = 0;
  private dirty = false;
  private session = false;
  private hudAcc = 0;
  private lastCx = 999;
  private lastCz = 999;
  private radius: number;
  private mobile: boolean;
  private disposed = false;
  private onResize: () => void;
  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;
  private onBlur: () => void;
  private onPointerDown: (e: PointerEvent) => void;
  private onPointerMove: (e: PointerEvent) => void;
  private onPointerUp: (e: PointerEvent) => void;
  private onWheel: (e: WheelEvent) => void;
  private onContext: (e: Event) => void;
  private onVis: () => void;
  private onUnlock: () => void;
  private ro: ResizeObserver;

  constructor(
    private canvas: HTMLCanvasElement,
    private getAnalog: () => Analog,
    private onHud: (h: HudState) => void,
  ) {
    this.mobile = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 820;
    this.radius = this.mobile ? 3 : 4;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !this.mobile,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.mobile ? 1.35 : 1.6));
    this.renderer.setSize(w, h, false);
    this.camera = new THREE.PerspectiveCamera(72, w / Math.max(1, h), 0.08, 300);
    this.camera.rotation.order = "YXZ";
    this.scene.add(this.camera);
    this.scene.fog = new THREE.Fog(0x8ec8ea, 16, this.radius * CHUNK * 0.92);

    this.atlas = makeAtlas();
    const base = {
      map: this.atlas,
      vertexColors: true,
    } as const;
    this.matOpaque = new THREE.MeshBasicMaterial({ ...base });
    this.matCutout = new THREE.MeshBasicMaterial({ ...base, alphaTest: 0.45, side: THREE.DoubleSide });
    this.matGlass = new THREE.MeshBasicMaterial({
      ...base,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.matWater = new THREE.MeshBasicMaterial({
      ...base,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006, 1.006, 1.006));
    this.highlight = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x14110e, fog: false }),
    );
    this.highlight.visible = false;
    this.scene.add(this.highlight);

    this.hand = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.2, 0.2),
      new THREE.MeshBasicMaterial({ color: BLOCKS[HOTBAR[0]].color }),
    );
    this.hand.position.set(0.34, -0.3, -0.5);
    this.camera.add(this.hand);

    const cloudTex = makeCloudTexture();
    this.cloud = new THREE.Mesh(
      new THREE.PlaneGeometry(480, 480),
      new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, opacity: 0.9 }),
    );
    this.cloud.rotation.x = -Math.PI / 2;
    this.cloud.position.y = 48;
    this.scene.add(this.cloud);

    this.sun = new THREE.Mesh(
      new THREE.SphereGeometry(5, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xffe3a1, fog: false }),
    );
    this.moon = new THREE.Mesh(
      new THREE.SphereGeometry(3.2, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xe7eef8, fog: false }),
    );
    this.scene.add(this.sun, this.moon);

    const starPos: number[] = [];
    for (let i = 0; i < 280; i++) {
      const y = 0.15 + Math.random() * 0.85;
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      starPos.push(Math.cos(a) * r * 90, y * 90, Math.sin(a) * r * 90);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3));
    this.stars = new THREE.Points(
      sg,
      new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, fog: false, sizeAttenuation: false }),
    );
    this.camera.add(this.stars);

    this.parts = Array.from({ length: 48 }, () => ({
      alive: false, life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, color: 0xffffff,
    }));
    this.pmesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.14, 0.14, 0.14),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      this.parts.length,
    );
    this.pmesh.frustumCulled = false;
    this.pmesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.pmesh);
    this.hideParticles();

    this.animals = new Animals(this.scene);
    this.world = new World(MENU_SEED);
    this.animals.welcome(this.world);
    this.bootstrap(0, 0);
    this.pos.y = this.world.surfaceY(0, 0);

    this.timer.connect(document);
    this.renderer.setAnimationLoop((t) => this.frame(t));

    this.onResize = () => this.resize();
    this.ro = new ResizeObserver(this.onResize);
    this.ro.observe(canvas);
    window.addEventListener("resize", this.onResize);

    this.onKeyDown = (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
      if (this.mode !== "play") return;
      if (e.code === "KeyF") this.flying = !this.flying;
      if (e.code === "Digit1") this.setSlot(0);
      if (e.code === "Digit2") this.setSlot(1);
      if (e.code === "Digit3") this.setSlot(2);
      if (e.code === "Digit4") this.setSlot(3);
      if (e.code === "Digit5") this.setSlot(4);
      if (e.code === "Digit6") this.setSlot(5);
      if (e.code === "Digit7") this.setSlot(6);
      if (e.code === "Digit8") this.setSlot(7);
      if (e.code === "Digit9") this.setSlot(8);
    };
    this.onKeyUp = (e) => this.keys.delete(e.code);
    this.onBlur = () => {
      this.keys.clear();
      this.breaking = false;
      this.placing = false;
    };
    this.onPointerDown = (e) => {
      this.audio.unlock();
      if (this.mode !== "play") return;
      if (e.pointerType === "touch") {
        this.lookId = e.pointerId;
        this.lookTouch = true;
        this.lastLX = e.clientX;
        this.lastLY = e.clientY;
        this.canvas.setPointerCapture(e.pointerId);
        return;
      }
      if (document.pointerLockElement !== this.canvas) {
        this.canvas.requestPointerLock();
        return;
      }
      if (e.button === 0) this.breaking = true;
      if (e.button === 2) this.placing = true;
    };
    this.onPointerMove = (e) => {
      if (document.pointerLockElement === this.canvas) {
        this.lookDX += e.movementX;
        this.lookDY += e.movementY;
        this.lookTouch = false;
        return;
      }
      if (e.pointerId === this.lookId) {
        this.lookDX += e.clientX - this.lastLX;
        this.lookDY += e.clientY - this.lastLY;
        this.lastLX = e.clientX;
        this.lastLY = e.clientY;
        this.lookTouch = true;
      }
    };
    this.onPointerUp = (e) => {
      if (e.pointerId === this.lookId) this.lookId = null;
      if (e.button === 0) this.breaking = false;
      if (e.button === 2) this.placing = false;
    };
    this.onWheel = (e) => {
      if (this.mode !== "play") return;
      e.preventDefault();
      const dir = e.deltaY > 0 ? 1 : -1;
      this.setSlot((this.slot + dir + HOTBAR.length) % HOTBAR.length);
    };
    this.onContext = (e) => e.preventDefault();
    this.onVis = () => {
      if (document.visibilityState === "visible" && !this.disposed) this.audio.unlock();
    };
    this.onUnlock = () => {
      if (!this.disposed) this.audio.unlock();
    };

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    this.canvas.addEventListener("contextmenu", this.onContext);
    document.addEventListener("visibilitychange", this.onVis);
    window.addEventListener("pointerdown", this.onUnlock);

    window.__controlsTest = {
      getYaw: () => this.yaw,
      getSpeed: () => Math.hypot(this.vx, this.vz),
      getPos: () => ({ x: this.pos.x, y: this.pos.y, z: this.pos.z }),
      setKeys: (codes: string[]) => {
        this.injected = new Set(codes);
      },
      mine: () => this.mine(),
      place: () => this.place(),
      animals: () => this.animals.snapshot(),
    };
    window.__cobbleReady = true;
    this.pushHud();
  }

  unlock(): void {
    this.audio.unlock();
  }

  setSlot(i: number): void {
    this.slot = (i + HOTBAR.length) % HOTBAR.length;
    (this.hand.material as THREE.MeshBasicMaterial).color.setHex(BLOCKS[HOTBAR[this.slot]].color);
    this.pushHud();
  }

  toggleFly(): void {
    this.flying = !this.flying;
    this.pushHud();
  }

  toggleMute(): void {
    this.audio.unlock();
    this.audio.setMuted(!this.audio.muted);
    this.pushHud();
  }

  /** Fresh hills. Overwrites the saved world. */
  beginNew(seed?: number): void {
    const s = seed ?? ((Math.random() * 1e9) | 0);
    this.session = true;
    this.swap(s, null, true);
    this.persist();
  }

  beginContinue(save: SaveData): void {
    this.session = true;
    this.swap(save.seed, save, true);
  }

  pause(): void {
    if (this.mode !== "play") return;
    this.mode = "pause";
    this.breaking = false;
    this.placing = false;
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.persist();
    this.pushHud();
  }

  resume(): void {
    this.audio.unlock();
    this.mode = "play";
    this.hand.visible = true;
    if (!this.mobile && window.matchMedia("(pointer: fine)").matches) {
      void this.canvas.requestPointerLock();
    }
    this.pushHud();
  }

  toMenu(): void {
    this.persist();
    this.mode = "menu";
    this.breaking = false;
    this.placing = false;
    this.hand.visible = false;
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.pushHud();
  }

  requestLock(): void {
    if (this.mode === "play" && window.matchMedia("(pointer: fine)").matches) {
      void this.canvas.requestPointerLock();
    }
  }

  private swap(seed: number, save: SaveData | null, play: boolean): void {
    this.clearMeshes();
    this.world = new World(seed);
    if (save) this.world.loadEdits(save.edits);
    this.animals.welcome(this.world);
    const px = save ? Math.floor(save.player.x) : 0;
    const pz = save ? Math.floor(save.player.z) : 0;
    this.bootstrap(Math.floor(px / CHUNK), Math.floor(pz / CHUNK));
    if (save) {
      this.pos.set(save.player.x, save.player.y, save.player.z);
      this.yaw = save.player.yaw;
      this.pitch = save.player.pitch;
      this.flying = save.player.flying;
    } else {
      this.pos.set(px + 0.5, this.world.surfaceY(px, pz), pz + 0.5);
      this.yaw = 0;
      this.pitch = -0.38;
      this.flying = false;
    }
    this.vx = this.vy = this.vz = 0;
    this.skyT = 0.25;
    this.mode = play ? "play" : "menu";
    this.hand.visible = play;
    this.dirty = false;
    this.unstick();
    this.pushHud();
  }

  private bootstrap(cx: number, cz: number): void {
    const r = 2;
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) this.rebuild(cx + dx, cz + dz);
    }
    this.lastCx = 999;
  }

  private frame(timestamp: number): void {
    if (this.disposed) return;
    this.timer.update(timestamp);
    const dt = Math.min(this.timer.getDelta(), 0.05);
    this.elapsed += dt;
    if (this.mode === "play") {
      this.applyLook();
      this.acc += dt;
      let steps = 0;
      while (this.acc >= STEP && steps < 5) {
        this.simulate(STEP);
        this.acc -= STEP;
        steps++;
      }
      if (steps === 5) this.acc = 0;
      this.mineAndPlace(dt);
      this.bobCam(dt);
      this.saveAcc += dt;
      if (this.saveAcc > 4 && this.dirty) {
        this.persist();
        this.saveAcc = 0;
      }
    } else {
      this.acc = 0;
      this.menuCam(dt);
    }
    this.stream();
    this.animals.update(dt, this.mode === "play" ? this.pos : null, (kind) => {
      if (this.mode !== "play") return;
      if (kind === "snort") this.audio.snort();
      else this.audio.chirp();
    });
    this.animateBits(dt);
    this.skyPass(dt);
    this.aimHighlight();
    this.renderer.render(this.scene, this.camera);
    this.hudAcc += dt;
    if (this.hudAcc > 0.12) {
      this.hudAcc = 0;
      this.pushHud();
    }
  }

  private applyLook(): void {
    const sens = this.lookTouch ? 0.0048 : 0.0026;
    this.yaw -= this.lookDX * sens;
    this.pitch -= this.lookDY * sens;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    this.lookDX = 0;
    this.lookDY = 0;
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camera.rotation.z = 0;
  }

  private held(code: string): boolean {
    return this.keys.has(code) || this.injected.has(code);
  }

  private analog(): Analog {
    return this.getAnalog() ?? ZERO_ANALOG;
  }

  private simulate(dt: number): void {
    const a = this.analog();
    let forward =
      (this.held("KeyW") || this.held("ArrowUp") ? 1 : 0) - (this.held("KeyS") || this.held("ArrowDown") ? 1 : 0);
    let strafe =
      (this.held("KeyD") || this.held("ArrowRight") ? 1 : 0) - (this.held("KeyA") || this.held("ArrowLeft") ? 1 : 0);
    forward = Math.max(-1, Math.min(1, forward + a.y));
    strafe = Math.max(-1, Math.min(1, strafe + a.x));
    const shift = this.held("ShiftLeft") || this.held("ShiftRight");
    const sprint = (a.sprint || this.held("ControlLeft") || (!this.flying && shift)) && !this.flying;
    const down = a.down || (this.flying && shift);
    const jump = this.held("Space") || a.jump;
    let speed = sprint ? 7.4 : 4.6;
    const water = this.submerged();
    if (water) speed *= 0.62;

    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw);
    const rz = -Math.sin(this.yaw);
    let mx = fx * forward + rx * strafe;
    let mz = fz * forward + rz * strafe;
    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    this.vx = mx * speed;
    this.vz = mz * speed;

    if (this.flying) {
      const up = (jump ? 1 : 0) - (down ? 1 : 0);
      this.vy = up * (sprint ? 11 : 8.2);
      this.grounded = false;
    } else if (water) {
      this.vy -= 7 * dt;
      if (this.vy < -3.2) this.vy = -3.2;
      if (jump) {
        this.vy = 4.2;
        if (this.elapsed - this.lastJump > 0.28) {
          this.audio.jump();
          this.lastJump = this.elapsed;
        }
      }
    } else if (this.grounded) {
      if (jump) {
        this.vy = 8.55;
        this.grounded = false;
        if (this.elapsed - this.lastJump > 0.28) {
          this.audio.jump();
          this.lastJump = this.elapsed;
        }
      } else this.vy = 0;
    } else {
      this.vy -= 28 * dt;
      if (this.vy < -34) this.vy = -34;
    }

    this.moveAxis("x", dt);
    this.moveAxis("z", dt);
    const beforeY = this.pos.y;
    this.pos.y += this.vy * dt;
    if (this.blocked(this.pos.x, this.pos.y, this.pos.z)) {
      this.pos.y = beforeY;
      if (this.vy < 0) this.grounded = true;
      this.vy = 0;
    } else if (!this.flying) {
      this.grounded = this.vy <= 0 && this.blocked(this.pos.x, this.pos.y - 0.08, this.pos.z);
    }

    if (this.pos.y < -8) {
      this.pos.set(0.5, this.world.surfaceY(0, 0) + 1, 0.5);
      this.vy = 0;
    }

    const moving = Math.hypot(this.vx, this.vz) > 1 && (this.grounded || water);
    if (moving) {
      this.stepAcc += dt;
      const every = sprint ? 0.32 : 0.46;
      if (this.stepAcc > every) {
        this.audio.foot();
        this.stepAcc = 0;
      }
    }
  }

  private moveAxis(axis: "x" | "z", dt: number): void {
    const v = axis === "x" ? this.vx : this.vz;
    if (v === 0) return;
    const prev = this.pos[axis];
    this.pos[axis] += v * dt;
    if (!this.blocked(this.pos.x, this.pos.y, this.pos.z)) return;
    if (this.grounded || this.flying) {
      const oldY = this.pos.y;
      this.pos.y = oldY + 1.02;
      if (!this.blocked(this.pos.x, this.pos.y, this.pos.z)) return;
      this.pos.y = oldY;
    }
    this.pos[axis] = prev;
    if (axis === "x") this.vx = 0;
    else this.vz = 0;
  }

  private blocked(px: number, py: number, pz: number): boolean {
    const minX = Math.floor(px - HW);
    const maxX = Math.floor(px + HW - 1e-4);
    const minY = Math.floor(py + 0.001);
    const maxY = Math.floor(py + PH - 1e-3);
    const minZ = Math.floor(pz - HW);
    const maxZ = Math.floor(pz + HW - 1e-4);
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let x = minX; x <= maxX; x++) {
          if (this.world.solid(this.world.get(x, y, z))) return true;
        }
      }
    }
    return false;
  }

  private submerged(): boolean {
    const x = Math.floor(this.pos.x);
    const z = Math.floor(this.pos.z);
    const y0 = Math.floor(this.pos.y + 0.3);
    const y1 = Math.floor(this.pos.y + 1.1);
    return this.world.get(x, y0, z) === WATER || this.world.get(x, y1, z) === WATER;
  }

  private unstick(): void {
    if (!this.blocked(this.pos.x, this.pos.y, this.pos.z)) return;
    for (let i = 1; i <= 8; i++) {
      if (!this.blocked(this.pos.x, this.pos.y + i, this.pos.z)) {
        this.pos.y += i;
        return;
      }
    }
  }

  private bobCam(dt: number): void {
    const moving = Math.hypot(this.vx, this.vz) > 0.6 && this.grounded && !this.flying;
    this.bob += dt * (moving ? 9.5 : 1.5);
    const bob = moving ? Math.sin(this.bob * 2) * 0.042 : 0;
    this.camera.position.set(this.pos.x, this.pos.y + EYE + bob, this.pos.z);
    this.hand.position.y = -0.3 + (moving ? Math.abs(Math.sin(this.bob * 2)) * 0.04 : 0);
    this.hand.rotation.z = moving ? Math.sin(this.bob) * 0.08 : 0;
    this.hand.visible = true;
  }

  private menuCam(dt: void | number): void {
    void dt;
    const focus = this.world.surfaceY(0, 0);
    const ang = this.elapsed * 0.16;
    this.camera.position.set(Math.sin(ang) * 14, focus + 8, Math.cos(ang) * 14);
    this.camera.lookAt(0.5, focus + 1.2, 0.5);
    this.hand.visible = false;
  }

  private aim(): { x: number; y: number; z: number; nx: number; ny: number; nz: number } | null {
    this.camera.getWorldDirection(this.dir);
    const ox = this.camera.position.x;
    const oy = this.camera.position.y;
    const oz = this.camera.position.z;
    const dx = this.dir.x;
    const dy = this.dir.y;
    const dz = this.dir.z;
    let x = Math.floor(ox);
    let y = Math.floor(oy);
    let z = Math.floor(oz);
    const stepX = dx < 0 ? -1 : 1;
    const stepY = dy < 0 ? -1 : 1;
    const stepZ = dz < 0 ? -1 : 1;
    const tDeltaX = dx === 0 ? Infinity : Math.abs(1 / dx);
    const tDeltaY = dy === 0 ? Infinity : Math.abs(1 / dy);
    const tDeltaZ = dz === 0 ? Infinity : Math.abs(1 / dz);
    let tMaxX = dx === 0 ? Infinity : (dx > 0 ? x + 1 - ox : ox - x) * tDeltaX;
    let tMaxY = dy === 0 ? Infinity : (dy > 0 ? y + 1 - oy : oy - y) * tDeltaY;
    let tMaxZ = dz === 0 ? Infinity : (dz > 0 ? z + 1 - oz : oz - z) * tDeltaZ;
    let nx = 0;
    let ny = 0;
    let nz = 0;
    for (let i = 0; i < 72; i++) {
      const id = this.world.get(x, y, z);
      if (id !== AIR && !BLOCKS[id].fluid) return { x, y, z, nx, ny, nz };
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        if (tMaxX > REACH) return null;
        x += stepX;
        tMaxX += tDeltaX;
        nx = -stepX;
        ny = 0;
        nz = 0;
      } else if (tMaxY < tMaxZ) {
        if (tMaxY > REACH) return null;
        y += stepY;
        tMaxY += tDeltaY;
        nx = 0;
        ny = -stepY;
        nz = 0;
      } else {
        if (tMaxZ > REACH) return null;
        z += stepZ;
        tMaxZ += tDeltaZ;
        nx = 0;
        ny = 0;
        nz = -stepZ;
      }
    }
    return null;
  }

  private mineAndPlace(dt: number): void {
    const a = this.analog();
    const breaking = this.breaking || a.breaking || this.held("KeyQ");
    const placing = this.placing || a.placing || this.held("KeyE");
    const hit = this.aim();
    if (breaking && hit) {
      const id = this.world.get(hit.x, hit.y, hit.z);
      const key = `${hit.x},${hit.y},${hit.z}`;
      if (id !== BEDROCK && id !== AIR && !BLOCKS[id].fluid) {
        if (key !== this.breakKey) {
          this.breakKey = key;
          this.breakTime = 0;
        }
        this.breakTime += dt;
        if (this.breakTime >= BLOCKS[id].hard) {
          this.applyBreak(hit);
          this.breakTime = 0;
        }
      }
    } else {
      this.breakTime = 0;
      this.breakKey = "";
    }
    if (placing) {
      this.placeHold += dt;
      if (!this.placeLatch || this.placeHold > 0.22) {
        if (hit) this.tryPlace(hit);
        this.placeLatch = true;
        this.placeHold = 0;
      }
    } else {
      this.placeLatch = false;
      this.placeHold = 0;
    }
  }

  private applyBreak(hit: { x: number; y: number; z: number }): void {
    const id = this.world.get(hit.x, hit.y, hit.z);
    if (id === AIR || id === BEDROCK) return;
    const chunks = this.world.set(hit.x, hit.y, hit.z, AIR);
    for (const [cx, cz] of chunks) if (this.meshes.has(`${cx},${cz}`)) this.rebuild(cx, cz);
    this.burst(hit.x, hit.y, hit.z, BLOCKS[id].color, 12);
    this.audio.break();
    this.dirty = true;
  }

  private tryPlace(hit: { x: number; y: number; z: number; nx: number; ny: number; nz: number }): void {
    if (hit.nx === 0 && hit.ny === 0 && hit.nz === 0) return;
    const x = hit.x + hit.nx;
    const y = hit.y + hit.ny;
    const z = hit.z + hit.nz;
    if (y < 1 || y >= 39) return;
    const occ = this.world.get(x, y, z);
    if (occ !== AIR && !BLOCKS[occ].fluid) return;
    if (this.overlaps(x, y, z)) return;
    const id = HOTBAR[this.slot];
    const chunks = this.world.set(x, y, z, id);
    for (const [cx, cz] of chunks) if (this.meshes.has(`${cx},${cz}`)) this.rebuild(cx, cz);
    this.burst(x, y, z, BLOCKS[id].color, 5);
    this.audio.place();
    this.dirty = true;
  }

  private overlaps(bx: number, by: number, bz: number): boolean {
    return (
      this.pos.x + HW > bx &&
      this.pos.x - HW < bx + 1 &&
      this.pos.y + PH > by &&
      this.pos.y < by + 1 &&
      this.pos.z + HW > bz &&
      this.pos.z - HW < bz + 1
    );
  }

  mine(): boolean {
    if (this.mode !== "play") return false;
    const hit = this.aim();
    if (!hit) return false;
    const id = this.world.get(hit.x, hit.y, hit.z);
    if (id === AIR || id === BEDROCK || BLOCKS[id].fluid) return false;
    this.applyBreak(hit);
    return true;
  }

  place(): boolean {
    if (this.mode !== "play") return false;
    const hit = this.aim();
    if (!hit) return false;
    const before = this.world.exportEdits().length;
    this.tryPlace(hit);
    return this.world.exportEdits().length !== before;
  }

  private aimHighlight(): void {
    if (this.mode !== "play") {
      this.highlight.visible = false;
      return;
    }
    const hit = this.aim();
    if (!hit) {
      this.highlight.visible = false;
      return;
    }
    this.highlight.visible = true;
    this.highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
  }

  private burst(x: number, y: number, z: number, color: number, n: number): void {
    let left = n;
    for (const p of this.parts) {
      if (left <= 0) break;
      if (p.alive) continue;
      p.alive = true;
      p.max = 0.4 + Math.random() * 0.25;
      p.life = p.max;
      p.x = x + 0.2 + Math.random() * 0.6;
      p.y = y + 0.2 + Math.random() * 0.6;
      p.z = z + 0.2 + Math.random() * 0.6;
      p.vx = (Math.random() - 0.5) * 3.4;
      p.vy = 1.8 + Math.random() * 2.6;
      p.vz = (Math.random() - 0.5) * 3.4;
      p.color = color;
      left--;
    }
  }

  private hideParticles(): void {
    for (let i = 0; i < this.parts.length; i++) {
      this.dummy.position.set(0, -999, 0);
      this.dummy.scale.setScalar(0);
      this.dummy.updateMatrix();
      this.pmesh.setMatrixAt(i, this.dummy.matrix);
      this.pmesh.setColorAt(i, this.color.setHex(0xffffff));
    }
    this.pmesh.instanceMatrix.needsUpdate = true;
    if (this.pmesh.instanceColor) this.pmesh.instanceColor.needsUpdate = true;
  }

  private animateBits(dt: number): void {
    let dirty = false;
    for (let i = 0; i < this.parts.length; i++) {
      const p = this.parts[i];
      if (!p.alive) {
        this.dummy.scale.setScalar(0);
        this.dummy.position.set(0, -999, 0);
        this.dummy.updateMatrix();
        this.pmesh.setMatrixAt(i, this.dummy.matrix);
        continue;
      }
      dirty = true;
      p.life -= dt;
      p.vy -= 9 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.life <= 0) {
        p.alive = false;
        this.dummy.scale.setScalar(0);
      } else {
        const s = Math.max(0.15, p.life / p.max);
        this.dummy.scale.setScalar(s);
        this.dummy.position.set(p.x, p.y, p.z);
        this.color.setHex(p.color);
        this.pmesh.setColorAt(i, this.color);
      }
      this.dummy.updateMatrix();
      this.pmesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.pmesh.instanceMatrix.needsUpdate = true;
    if (dirty && this.pmesh.instanceColor) this.pmesh.instanceColor.needsUpdate = true;

    const map = (this.cloud.material as THREE.MeshBasicMaterial).map;
    if (map) map.offset.x += dt * 0.004;
    const cx = this.mode === "play" ? this.pos.x : this.camera.position.x;
    const cz = this.mode === "play" ? this.pos.z : this.camera.position.z;
    this.cloud.position.x = cx;
    this.cloud.position.z = cz;
    const ang = this.skyT * Math.PI * 2;
    const sx = Math.cos(ang) * 78;
    const sy = Math.sin(ang) * 78;
    this.sun.position.set(this.camera.position.x + sx, this.camera.position.y + sy, this.camera.position.z + 12);
    this.moon.position.set(this.camera.position.x - sx, this.camera.position.y - sy, this.camera.position.z - 12);
    const elev = Math.sin(ang);
    (this.stars.material as THREE.PointsMaterial).opacity = Math.max(0, Math.min(1, 0.15 - elev));
    (this.stars.material as THREE.PointsMaterial).transparent = true;
    this.sun.visible = elev > -0.15;
    this.moon.visible = elev < 0.2;
  }

  private skyPass(dt: number): void {
    const t = this.skyT;
    const elev = Math.sin(t * Math.PI * 2);
    const noon = new THREE.Color(0x8ec8ea);
    const dusk = new THREE.Color(0xe39262);
    const night = new THREE.Color(0x10162b);
    const dawn = new THREE.Color(0xf2b48a);
    const wrapped = ((t % 1) + 1) % 1;
    const horizon = wrapped < 0.25 || wrapped > 0.75 ? dawn : dusk;
    if (elev >= 0) this.sky.copy(horizon).lerp(noon, elev);
    else this.sky.copy(night).lerp(horizon, 1 + elev);
    this.scene.background = this.sky;
    const fog = this.scene.fog as THREE.Fog;
    fog.color.copy(this.sky);
    fog.near = 14;
    fog.far = this.radius * CHUNK * 0.95;
    const k = elev * 0.5 + 0.5;
    const day = 0.32 + 0.68 * k;
    const rb = day;
    const g = day * 0.98 + 0.02;
    const b = day * 0.92 + (1 - k) * 0.1;
    this.matOpaque.color.setRGB(rb, g, b);
    this.matCutout.color.setRGB(rb, g, b);
    this.matGlass.color.setRGB(rb, g, Math.min(1, b + 0.05));
    this.matWater.color.setRGB(rb * 0.85, g * 0.92, Math.min(1, b + 0.08));
    this.animals.tint(rb, g, b);
    if (this.mode === "play") this.skyT = (this.skyT + dt / 240) % 1;
  }

  private stream(): void {
    const pcx = Math.floor(this.pos.x / CHUNK);
    const pcz = Math.floor(this.pos.z / CHUNK);
    if (pcx !== this.lastCx || pcz !== this.lastCz) {
      this.lastCx = pcx;
      this.lastCz = pcz;
      const r = this.radius;
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dz * dz > r * r + r) continue;
          const cx = pcx + dx;
          const cz = pcz + dz;
          const key = `${cx},${cz}`;
          if (this.meshes.has(key) || this.queued.has(key)) continue;
          this.queued.add(key);
          this.queue.push([cx, cz]);
        }
      }
      this.queue.sort((a, b) => (a[0] - pcx) ** 2 + (a[1] - pcz) ** 2 - ((b[0] - pcx) ** 2 + (b[1] - pcz) ** 2));
      for (const key of [...this.meshes.keys()]) {
        const [cx, cz] = key.split(",").map(Number);
        if (Math.abs(cx - pcx) > r + 1 || Math.abs(cz - pcz) > r + 1) this.dropMesh(key, true);
      }
    }
    const budget = this.mobile ? 1 : 2;
    for (let i = 0; i < budget && this.queue.length; i++) {
      const next = this.queue.shift();
      if (!next) break;
      const key = `${next[0]},${next[1]}`;
      this.queued.delete(key);
      if (Math.abs(next[0] - pcx) > this.radius + 1 || Math.abs(next[1] - pcz) > this.radius + 1) continue;
      if (!this.meshes.has(key)) this.rebuild(next[0], next[1]);
    }
  }

  private rebuild(cx: number, cz: number): void {
    const key = `${cx},${cz}`;
    this.dropMesh(key);
    const built = meshChunk(this.world, cx, cz);
    const group = new THREE.Group();
    group.position.set(cx * CHUNK, 0, cz * CHUNK);
    const add = (bucket: typeof built.opaque, mat: THREE.Material) => {
      const geo = geometryFrom(bucket);
      if (!geo) return;
      group.add(new THREE.Mesh(geo, mat));
    };
    add(built.opaque, this.matOpaque);
    add(built.cutout, this.matCutout);
    add(built.glass, this.matGlass);
    add(built.water, this.matWater);
    this.scene.add(group);
    this.meshes.set(key, group);
    this.animals.consider(cx, cz);
  }

  private dropMesh(key: string, unload = false): void {
    const group = this.meshes.get(key);
    if (unload) {
      const [cx, cz] = key.split(",").map(Number);
      this.animals.forget(cx, cz);
    }
    if (!group) return;
    this.scene.remove(group);
    group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      mesh.geometry?.dispose();
    });
    this.meshes.delete(key);
  }

  private clearMeshes(): void {
    for (const key of [...this.meshes.keys()]) this.dropMesh(key);
    this.queue = [];
    this.queued.clear();
    this.lastCx = 999;
  }

  persist(): void {
    if (!this.session) return;
    const data: SaveData = {
      version: 1,
      seed: this.world.seed,
      edits: this.world.exportEdits(),
      player: {
        x: this.pos.x,
        y: this.pos.y,
        z: this.pos.z,
        yaw: this.yaw,
        pitch: this.pitch,
        flying: this.flying,
      },
    };
    writeSave(data);
    this.dirty = false;
  }

  private pushHud(): void {
    let aimed: string | null = null;
    if (this.mode === "play") {
      const hit = this.aim();
      let blockDist = Infinity;
      if (hit) {
        const id = this.world.get(hit.x, hit.y, hit.z);
        if (id !== AIR) aimed = BLOCKS[id].name;
        blockDist = Math.hypot(
          hit.x + 0.5 - this.camera.position.x,
          hit.y + 0.5 - this.camera.position.y,
          hit.z + 0.5 - this.camera.position.z,
        );
      }
      const animal = this.animals.look(
        this.camera.position.x,
        this.camera.position.y,
        this.camera.position.z,
        this.dir.x,
        this.dir.y,
        this.dir.z,
      );
      if (animal && animal.dist < 6.5 && animal.dist < blockDist + 1.25) aimed = animal.name;
    }
    const hard = this.breakKey
      ? BLOCKS[this.world.get(
          Number(this.breakKey.split(",")[0]),
          Number(this.breakKey.split(",")[1]),
          Number(this.breakKey.split(",")[2]),
        )].hard
      : 1;
    this.onHud({
      slot: this.slot,
      held: BLOCKS[HOTBAR[this.slot]].name,
      aimed,
      x: Math.floor(this.pos.x),
      y: Math.floor(this.pos.y),
      z: Math.floor(this.pos.z),
      flying: this.flying,
      breakProgress: this.breakKey && hard < 50 ? Math.max(0, Math.min(1, this.breakTime / hard)) : 0,
      seed: this.world.seed,
      muted: this.audio.muted,
      mode: this.mode,
    });
  }

  private resize(): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    if (w < 2 || h < 2) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  dispose(): void {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.persist();
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("wheel", this.onWheel);
    this.canvas.removeEventListener("contextmenu", this.onContext);
    document.removeEventListener("visibilitychange", this.onVis);
    window.removeEventListener("pointerdown", this.onUnlock);
    this.ro.disconnect();
    this.clearMeshes();
    this.atlas.dispose();
    this.matOpaque.dispose();
    this.matCutout.dispose();
    this.matGlass.dispose();
    this.matWater.dispose();
    this.highlight.geometry.dispose();
    (this.highlight.material as THREE.Material).dispose();
    this.pmesh.geometry.dispose();
    (this.pmesh.material as THREE.Material).dispose();
    this.animals.dispose();
    this.renderer.dispose();
    this.audio.dispose();
    this.timer.disconnect();
    if (window.__controlsTest) delete window.__controlsTest;
    window.__cobbleReady = false;
  }
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      getPos: () => { x: number; y: number; z: number };
      setKeys: (codes: string[]) => void;
      mine: () => boolean;
      place: () => boolean;
      animals: () => { name: string; x: number; y: number; z: number }[];
    };
    __cobbleReady?: boolean;
  }
}
