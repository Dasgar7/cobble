/** Deterministic value noise. Same seed → same hills. */

function mix(n: number): number {
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return (n ^ (n >>> 16)) >>> 0;
}

export function makeHasher(seed: number) {
  const s = seed | 0;
  function hash2(x: number, y: number): number {
    return mix(Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s, 1442695041));
  }
  function hash3(x: number, y: number, z: number): number {
    return mix(
      Math.imul(x | 0, 374761393) ^
        Math.imul(y | 0, 668265263) ^
        Math.imul(z | 0, 1274126177) ^
        Math.imul(s, 1442695041),
    );
  }
  function fade(t: number): number {
    return t * t * (3 - 2 * t);
  }
  function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }
  function noise2(x: number, y: number): number {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = fade(x - x0);
    const ty = fade(y - y0);
    const v00 = hash2(x0, y0) / 4294967295;
    const v10 = hash2(x0 + 1, y0) / 4294967295;
    const v01 = hash2(x0, y0 + 1) / 4294967295;
    const v11 = hash2(x0 + 1, y0 + 1) / 4294967295;
    return lerp(lerp(v00, v10, tx), lerp(v01, v11, tx), ty);
  }
  function fbm(x: number, y: number): number {
    let a = 0;
    let f = 1;
    let w = 0.5;
    let sum = 0;
    for (let i = 0; i < 4; i++) {
      a += noise2(x * f, y * f) * w;
      sum += w;
      f *= 2;
      w *= 0.5;
    }
    return a / sum;
  }
  function noise3(x: number, y: number, z: number): number {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const z0 = Math.floor(z);
    const tx = fade(x - x0);
    const ty = fade(y - y0);
    const tz = fade(z - z0);
    let acc = 0;
    for (let dz = 0; dz <= 1; dz++) {
      const wz = dz === 0 ? 1 - tz : tz;
      for (let dy = 0; dy <= 1; dy++) {
        const wy = dy === 0 ? 1 - ty : ty;
        for (let dx = 0; dx <= 1; dx++) {
          const wx = dx === 0 ? 1 - tx : tx;
          acc += (hash3(x0 + dx, y0 + dy, z0 + dz) / 4294967295) * wx * wy * wz;
        }
      }
    }
    return acc;
  }
  return { hash2, fbm, noise3 };
}
