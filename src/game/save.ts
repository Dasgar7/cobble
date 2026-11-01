export type SaveData = {
  version: 1;
  seed: number;
  edits: [number, number, number, number][];
  player: { x: number; y: number; z: number; yaw: number; pitch: number; flying: boolean };
};

const KEY = "cobble-world-v1";

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    if (data.version !== 1 || typeof data.seed !== "number" || !Array.isArray(data.edits)) return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* quota — drop oldest edits and try once */
    try {
      const slim = { ...data, edits: data.edits.slice(-4000) };
      localStorage.setItem(KEY, JSON.stringify(slim));
    } catch {
      /* ignore */
    }
  }
}

export function clearSave(): void {
  localStorage.removeItem(KEY);
}
