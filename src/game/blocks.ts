export const AIR = 0;
export const GRASS = 1;
export const DIRT = 2;
export const STONE = 3;
export const SAND = 4;
export const LOG = 5;
export const LEAVES = 6;
export const PLANKS = 7;
export const COBBLE = 8;
export const GLASS = 9;
export const WATER = 10;
export const BEDROCK = 11;

export const CHUNK = 16;
export const HEIGHT = 40;
export const SEA = 13;

export type BlockInfo = {
  id: number;
  name: string;
  solid: boolean;
  opaque: boolean;
  fluid: boolean;
  bucket: "opaque" | "cutout" | "glass" | "water";
  top: number;
  side: number;
  bottom: number;
  /** Particle / held-block tint, 0xRRGGBB. */
  color: number;
  /** Seconds of holding the break button. */
  hard: number;
  swatch: string;
};

export const BLOCKS: BlockInfo[] = [
  { id: AIR, name: "Air", solid: false, opaque: false, fluid: false, bucket: "opaque", top: 0, side: 0, bottom: 0, color: 0x000000, hard: 0, swatch: "air" },
  { id: GRASS, name: "Grass", solid: true, opaque: true, fluid: false, bucket: "opaque", top: 0, side: 1, bottom: 2, color: 0x6ea03a, hard: 0.28, swatch: "grass" },
  { id: DIRT, name: "Dirt", solid: true, opaque: true, fluid: false, bucket: "opaque", top: 2, side: 2, bottom: 2, color: 0x8d5a32, hard: 0.26, swatch: "dirt" },
  { id: STONE, name: "Stone", solid: true, opaque: true, fluid: false, bucket: "opaque", top: 3, side: 3, bottom: 3, color: 0x8e8982, hard: 0.62, swatch: "stone" },
  { id: SAND, name: "Sand", solid: true, opaque: true, fluid: false, bucket: "opaque", top: 4, side: 4, bottom: 4, color: 0xe4d2a0, hard: 0.22, swatch: "sand" },
  { id: LOG, name: "Log", solid: true, opaque: true, fluid: false, bucket: "opaque", top: 6, side: 5, bottom: 6, color: 0x6b4423, hard: 0.4, swatch: "log" },
  { id: LEAVES, name: "Leaves", solid: true, opaque: false, fluid: false, bucket: "cutout", top: 7, side: 7, bottom: 7, color: 0x3f8f3a, hard: 0.12, swatch: "leaves" },
  { id: PLANKS, name: "Planks", solid: true, opaque: true, fluid: false, bucket: "opaque", top: 8, side: 8, bottom: 8, color: 0xc4a06a, hard: 0.36, swatch: "planks" },
  { id: COBBLE, name: "Cobble", solid: true, opaque: true, fluid: false, bucket: "opaque", top: 11, side: 11, bottom: 11, color: 0x7d7870, hard: 0.7, swatch: "cobble" },
  { id: GLASS, name: "Glass", solid: true, opaque: false, fluid: false, bucket: "glass", top: 9, side: 9, bottom: 9, color: 0xc5e4ee, hard: 0.18, swatch: "glass" },
  { id: WATER, name: "Water", solid: false, opaque: false, fluid: true, bucket: "water", top: 10, side: 10, bottom: 10, color: 0x3a78c4, hard: 0, swatch: "water" },
  { id: BEDROCK, name: "Bedrock", solid: true, opaque: true, fluid: false, bucket: "opaque", top: 12, side: 12, bottom: 12, color: 0x2a2724, hard: 99, swatch: "bedrock" },
];

export const HOTBAR = [GRASS, DIRT, STONE, COBBLE, SAND, LOG, PLANKS, LEAVES, GLASS] as const;

export function tileFor(id: number, nx: number, ny: number): number {
  const b = BLOCKS[id];
  if (ny > 0) return b.top;
  if (ny < 0) return b.bottom;
  return b.side;
}
