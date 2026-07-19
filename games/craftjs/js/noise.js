/**
 * 3D Value / Gradient noise (simplex-style) for terrain generation.
 * Deterministic given a seed.
 */

export class Noise {
  constructor(seed = 1337) {
    this.perm = new Uint8Array(512);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;

    let s = seed >>> 0;
    const rand = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0xffffffff;
    };

    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const t = p[i];
      p[i] = p[j];
      p[j] = t;
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  lerp(a, b, t) {
    return a + t * (b - a);
  }

  grad(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  /** 3D Perlin noise in roughly [-1, 1] */
  noise3(x, y, z) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;

    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const zf = z - Math.floor(z);

    const u = this.fade(xf);
    const v = this.fade(yf);
    const w = this.fade(zf);

    const p = this.perm;
    const A = p[X] + Y;
    const AA = p[A] + Z;
    const AB = p[A + 1] + Z;
    const B = p[X + 1] + Y;
    const BA = p[B] + Z;
    const BB = p[B + 1] + Z;

    return this.lerp(
      this.lerp(
        this.lerp(this.grad(p[AA], xf, yf, zf), this.grad(p[BA], xf - 1, yf, zf), u),
        this.lerp(this.grad(p[AB], xf, yf - 1, zf), this.grad(p[BB], xf - 1, yf - 1, zf), u),
        v
      ),
      this.lerp(
        this.lerp(this.grad(p[AA + 1], xf, yf, zf - 1), this.grad(p[BA + 1], xf - 1, yf, zf - 1), u),
        this.lerp(this.grad(p[AB + 1], xf, yf - 1, zf - 1), this.grad(p[BB + 1], xf - 1, yf - 1, zf - 1), u),
        v
      ),
      w
    );
  }

  /** Fractal Brownian motion */
  fbm(x, y, z, octaves = 4, lacunarity = 2, gain = 0.5) {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let max = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * this.noise3(x * freq, y * freq, z * freq);
      max += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / max;
  }

  /** 2D convenience */
  noise2(x, y) {
    return this.noise3(x, y, 0);
  }

  fbm2(x, y, octaves = 4, lacunarity = 2, gain = 0.5) {
    return this.fbm(x, y, 0, octaves, lacunarity, gain);
  }
}
