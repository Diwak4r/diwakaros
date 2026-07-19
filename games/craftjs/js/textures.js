/**
 * Procedural Minecraft-style 16×16 block textures + atlas packing.
 */

import * as THREE from "three";

const SIZE = 16;
const PAD = 0; // atlas packing without padding for classic look

/** Deterministic PRNG from seed */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function setPx(data, x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const i = (y * SIZE + x) * 4;
  data[i] = r;
  data[i + 1] = g;
  data[i + 2] = b;
  data[i + 3] = a;
}

function fill(data, r, g, b, a = 255) {
  for (let i = 0; i < SIZE * SIZE; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = a;
  }
}

function noiseFill(data, base, variance, seed, alpha = 255) {
  const r = rng(seed);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const n = (r() - 0.5) * 2 * variance;
      setPx(
        data,
        x,
        y,
        clamp(base[0] + n, 0, 255),
        clamp(base[1] + n, 0, 255),
        clamp(base[2] + n, 0, 255),
        alpha
      );
    }
  }
}

function speckles(data, count, color, seed, size = 1) {
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    const x = Math.floor(r() * SIZE);
    const y = Math.floor(r() * SIZE);
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        setPx(data, x + dx, y + dy, color[0], color[1], color[2], color[3] ?? 255);
      }
    }
  }
}

function drawBorder(data, color, width = 1) {
  for (let i = 0; i < SIZE; i++) {
    for (let w = 0; w < width; w++) {
      setPx(data, i, w, color[0], color[1], color[2]);
      setPx(data, i, SIZE - 1 - w, color[0], color[1], color[2]);
      setPx(data, w, i, color[0], color[1], color[2]);
      setPx(data, SIZE - 1 - w, i, color[0], color[1], color[2]);
    }
  }
}

function createCanvas() {
  const c = document.createElement("canvas");
  c.width = SIZE;
  c.height = SIZE;
  return c;
}

function canvasFromData(data) {
  const c = createCanvas();
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(SIZE, SIZE);
  img.data.set(data);
  ctx.putImageData(img, 0, 0);
  return c;
}

function blank() {
  return new Uint8ClampedArray(SIZE * SIZE * 4);
}

// ── Individual texture generators ──

const generators = {
  dirt: () => {
    const d = blank();
    noiseFill(d, [134, 96, 67], 18, 1);
    speckles(d, 20, [100, 70, 45], 2);
    speckles(d, 12, [160, 120, 85], 3);
    return d;
  },

  grass_top: () => {
    const d = blank();
    noiseFill(d, [91, 153, 58], 22, 10);
    speckles(d, 30, [70, 130, 40], 11);
    speckles(d, 20, [110, 175, 70], 12);
    return d;
  },

  grass_side: () => {
    const d = blank();
    noiseFill(d, [134, 96, 67], 18, 20);
    const r = rng(21);
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < SIZE; x++) {
        const n = (r() - 0.5) * 20;
        const green = [91 + n, 153 + n * 0.5, 58 + n * 0.3];
        const edge = y === 4 && r() > 0.55;
        if (!edge) {
          setPx(d, x, y, clamp(green[0], 0, 255), clamp(green[1], 0, 255), clamp(green[2], 0, 255));
        }
      }
    }
    // grass overhang pixels
    for (let x = 0; x < SIZE; x++) {
      if (r() > 0.4) {
        setPx(d, x, 4, 91, 153, 58);
        if (r() > 0.6) setPx(d, x, 5, 80, 140, 50);
      }
    }
    return d;
  },

  stone: () => {
    const d = blank();
    noiseFill(d, [125, 125, 125], 16, 30);
    speckles(d, 25, [100, 100, 100], 31);
    speckles(d, 15, [145, 145, 145], 32);
    return d;
  },

  cobble: () => {
    const d = blank();
    fill(d, 110, 110, 110);
    const r = rng(40);
    // pebble shapes
    for (let i = 0; i < 12; i++) {
      const cx = Math.floor(r() * SIZE);
      const cy = Math.floor(r() * SIZE);
      const rad = 2 + Math.floor(r() * 3);
      const shade = 90 + Math.floor(r() * 50);
      for (let y = -rad; y <= rad; y++) {
        for (let x = -rad; x <= rad; x++) {
          if (x * x + y * y <= rad * rad) {
            setPx(d, cx + x, cy + y, shade, shade, shade);
          }
        }
      }
    }
    // mortar lines
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if ((x + y * 3) % 7 === 0 || (y + x * 2) % 8 === 0) {
          const i = (y * SIZE + x) * 4;
          d[i] = Math.max(0, d[i] - 30);
          d[i + 1] = Math.max(0, d[i + 1] - 30);
          d[i + 2] = Math.max(0, d[i + 2] - 30);
        }
      }
    }
    return d;
  },

  bedrock: () => {
    const d = blank();
    noiseFill(d, [50, 50, 50], 25, 50);
    speckles(d, 40, [30, 30, 30], 51, 2);
    speckles(d, 20, [80, 80, 80], 52);
    return d;
  },

  log_top: () => {
    const d = blank();
    fill(d, 160, 130, 80);
    const cx = 7.5, cy = 7.5;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const dist = Math.hypot(x - cx, y - cy);
        if (dist < 2) {
          setPx(d, x, y, 90, 70, 40);
        } else if (dist < 3.5) {
          setPx(d, x, y, 120, 95, 55);
        } else if (dist < 6) {
          setPx(d, x, y, 155, 125, 75);
        } else if (dist < 7.2) {
          setPx(d, x, y, 100, 75, 40);
        } else {
          setPx(d, x, y, 90, 65, 35);
        }
      }
    }
    return d;
  },

  log_side: () => {
    const d = blank();
    noiseFill(d, [100, 78, 45], 12, 60);
    for (let y = 0; y < SIZE; y++) {
      for (let x of [0, 1, 14, 15]) {
        setPx(d, x, y, 70, 52, 28);
      }
      // bark rings
      if (y % 4 === 0) {
        for (let x = 2; x < 14; x++) {
          const i = (y * SIZE + x) * 4;
          d[i] = Math.max(0, d[i] - 20);
          d[i + 1] = Math.max(0, d[i + 1] - 15);
          d[i + 2] = Math.max(0, d[i + 2] - 10);
        }
      }
    }
    return d;
  },

  leaves: () => {
    const d = blank();
    fill(d, 0, 0, 0, 0);
    const r = rng(70);
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (r() > 0.28) {
          const n = (r() - 0.5) * 30;
          setPx(d, x, y, clamp(48 + n, 0, 255), clamp(120 + n, 0, 255), clamp(30 + n, 0, 255), 220);
        }
      }
    }
    return d;
  },

  planks: () => {
    const d = blank();
    noiseFill(d, [178, 142, 80], 10, 80);
    // board seams
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (y % 4 === 0) {
          setPx(d, x, y, 120, 90, 50);
        }
        // vertical grain
        if (x % 8 === 3 || x % 8 === 4) {
          const i = (y * SIZE + x) * 4;
          d[i] = Math.max(0, d[i] - 15);
          d[i + 1] = Math.max(0, d[i + 1] - 12);
        }
      }
    }
    return d;
  },

  sand: () => {
    const d = blank();
    noiseFill(d, [220, 210, 150], 14, 90);
    speckles(d, 20, [200, 190, 130], 91);
    return d;
  },

  gravel: () => {
    const d = blank();
    noiseFill(d, [130, 125, 120], 30, 100);
    speckles(d, 30, [90, 90, 90], 101, 2);
    speckles(d, 20, [160, 155, 150], 102);
    return d;
  },

  water: () => {
    const d = blank();
    noiseFill(d, [40, 80, 200], 20, 110, 160);
    speckles(d, 15, [60, 120, 220, 180], 111);
    return d;
  },

  glass: () => {
    const d = blank();
    fill(d, 180, 220, 240, 50);
    drawBorder(d, [220, 240, 255], 1);
    // corner highlights so alphaTest keeps a visible frame
    for (let i = 1; i < 5; i++) {
      setPx(d, i, 1, 255, 255, 255, 200);
      setPx(d, 1, i, 255, 255, 255, 200);
      setPx(d, SIZE - 1 - i, SIZE - 2, 200, 230, 255, 160);
    }
    return d;
  },

  coal_ore: () => {
    const d = blank();
    noiseFill(d, [125, 125, 125], 16, 120);
    speckles(d, 18, [20, 20, 20], 121, 2);
    speckles(d, 8, [40, 40, 40], 122, 1);
    return d;
  },

  iron_ore: () => {
    const d = blank();
    noiseFill(d, [125, 125, 125], 16, 130);
    speckles(d, 16, [200, 170, 140], 131, 2);
    speckles(d, 10, [180, 150, 120], 132);
    return d;
  },

  gold_ore: () => {
    const d = blank();
    noiseFill(d, [125, 125, 125], 16, 140);
    speckles(d, 16, [250, 210, 50], 141, 2);
    speckles(d, 10, [220, 180, 30], 142);
    return d;
  },

  diamond_ore: () => {
    const d = blank();
    noiseFill(d, [125, 125, 125], 16, 150);
    speckles(d, 14, [80, 220, 230], 151, 2);
    speckles(d, 8, [120, 255, 255], 152);
    return d;
  },

  bricks: () => {
    const d = blank();
    fill(d, 150, 80, 60);
    // brick pattern
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const row = Math.floor(y / 4);
        const offset = row % 2 === 0 ? 0 : 4;
        const bx = (x + offset) % 8;
        if (y % 4 === 0 || bx === 0) {
          setPx(d, x, y, 180, 170, 160); // mortar
        } else {
          const shade = ((row * 3 + Math.floor((x + offset) / 8)) % 3) * 12;
          setPx(d, x, y, 150 + shade, 75 + shade * 0.5, 55);
        }
      }
    }
    return d;
  },

  snow: () => {
    const d = blank();
    noiseFill(d, [240, 245, 250], 10, 160);
    speckles(d, 15, [220, 230, 240], 161);
    return d;
  },

  snow_side: () => {
    const d = blank();
    noiseFill(d, [134, 96, 67], 18, 170);
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < SIZE; x++) {
        setPx(d, x, y, 240, 245, 250);
      }
    }
    return d;
  },

  cactus_top: () => {
    const d = blank();
    fill(d, 20, 20, 20, 0);
    for (let y = 2; y < 14; y++) {
      for (let x = 2; x < 14; x++) {
        setPx(d, x, y, 90, 140, 50);
      }
    }
    for (let y = 4; y < 12; y++) {
      for (let x = 4; x < 12; x++) {
        setPx(d, x, y, 70, 110, 40);
      }
    }
    return d;
  },

  cactus_bottom: () => {
    const d = blank();
    fill(d, 70, 100, 40);
    return d;
  },

  cactus_side: () => {
    const d = blank();
    noiseFill(d, [85, 130, 45], 10, 180);
    for (let y = 0; y < SIZE; y++) {
      setPx(d, 0, y, 60, 100, 30);
      setPx(d, 15, y, 60, 100, 30);
      setPx(d, 5, y, 70, 110, 35);
      setPx(d, 10, y, 70, 110, 35);
    }
    // spines
    const r = rng(181);
    for (let i = 0; i < 8; i++) {
      setPx(d, Math.floor(r() * SIZE), Math.floor(r() * SIZE), 200, 200, 180);
    }
    return d;
  },

  sandstone_top: () => {
    const d = blank();
    noiseFill(d, [218, 206, 150], 12, 190);
    return d;
  },

  sandstone_bottom: () => {
    const d = blank();
    noiseFill(d, [200, 185, 130], 12, 191);
    return d;
  },

  sandstone_side: () => {
    const d = blank();
    noiseFill(d, [210, 195, 140], 10, 192);
    for (let y = 0; y < SIZE; y++) {
      if (y === 0 || y === 15 || y === 7 || y === 8) {
        for (let x = 0; x < SIZE; x++) {
          setPx(d, x, y, 180, 165, 110);
        }
      }
    }
    return d;
  },

  clay: () => {
    const d = blank();
    noiseFill(d, [158, 164, 176], 12, 200);
    return d;
  },

  pumpkin_top: () => {
    const d = blank();
    noiseFill(d, [190, 110, 20], 15, 210);
    // stem
    for (let y = 6; y < 10; y++) {
      for (let x = 6; x < 10; x++) {
        setPx(d, x, y, 50, 100, 30);
      }
    }
    return d;
  },

  pumpkin_side: () => {
    const d = blank();
    noiseFill(d, [200, 120, 25], 12, 211);
    for (let x of [3, 8, 12]) {
      for (let y = 0; y < SIZE; y++) {
        const i = (y * SIZE + x) * 4;
        d[i] = Math.max(0, d[i] - 30);
        d[i + 1] = Math.max(0, d[i + 1] - 20);
      }
    }
    return d;
  },

  pumpkin_face: () => {
    const d = generators.pumpkin_side();
    // face
    const black = [20, 10, 5];
    // eyes
    setPx(d, 4, 5, ...black); setPx(d, 5, 5, ...black);
    setPx(d, 4, 6, ...black); setPx(d, 5, 6, ...black);
    setPx(d, 10, 5, ...black); setPx(d, 11, 5, ...black);
    setPx(d, 10, 6, ...black); setPx(d, 11, 6, ...black);
    // mouth
    for (let x = 4; x <= 11; x++) setPx(d, x, 10, ...black);
    setPx(d, 4, 9, ...black); setPx(d, 11, 9, ...black);
    setPx(d, 6, 11, ...black); setPx(d, 9, 11, ...black);
    return d;
  },

  tnt_top: () => {
    const d = blank();
    fill(d, 160, 40, 40);
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if ((x + y) % 4 < 2) setPx(d, x, y, 220, 220, 220);
      }
    }
    return d;
  },

  tnt_bottom: () => {
    const d = blank();
    fill(d, 160, 40, 40);
    return d;
  },

  tnt_side: () => {
    const d = blank();
    fill(d, 180, 50, 50);
    // white band
    for (let y = 5; y < 11; y++) {
      for (let x = 0; x < SIZE; x++) {
        setPx(d, x, y, 230, 230, 230);
      }
    }
    // TNT text dots
    for (let x = 3; x < 13; x++) {
      setPx(d, x, 7, 20, 20, 20);
      setPx(d, x, 8, 20, 20, 20);
    }
    return d;
  },

  bookshelf: () => {
    const d = blank();
    // wood edges
    noiseFill(d, [178, 142, 80], 8, 220);
    // book rows
    const colors = [
      [140, 40, 40],
      [40, 80, 140],
      [40, 120, 50],
      [140, 100, 30],
      [90, 40, 120],
    ];
    for (let row = 0; row < 2; row++) {
      const y0 = row === 0 ? 1 : 9;
      for (let b = 0; b < 5; b++) {
        const x0 = 1 + b * 3;
        const c = colors[b];
        for (let y = y0; y < y0 + 6; y++) {
          for (let x = x0; x < x0 + 2; x++) {
            setPx(d, x, y, c[0], c[1], c[2]);
          }
        }
      }
      // shelf line
      for (let x = 0; x < SIZE; x++) {
        setPx(d, x, y0 + 6, 120, 90, 50);
      }
    }
    return d;
  },

  obsidian: () => {
    const d = blank();
    noiseFill(d, [20, 15, 30], 12, 230);
    speckles(d, 20, [40, 20, 60], 231);
    speckles(d, 8, [60, 40, 80], 232);
    return d;
  },

  glowstone: () => {
    const d = blank();
    noiseFill(d, [200, 170, 80], 25, 240);
    speckles(d, 25, [255, 230, 120], 241);
    speckles(d, 15, [180, 140, 50], 242);
    return d;
  },

  air: () => {
    const d = blank();
    fill(d, 0, 0, 0, 0);
    return d;
  },
};

// Break stage overlays (destroy stages 0–9)
function makeBreakStage(stage) {
  const d = blank();
  fill(d, 0, 0, 0, 0);
  const r = rng(300 + stage);
  const cracks = 4 + stage * 6;
  for (let i = 0; i < cracks; i++) {
    let x = Math.floor(r() * SIZE);
    let y = Math.floor(r() * SIZE);
    const len = 2 + Math.floor(r() * (3 + stage));
    for (let j = 0; j < len; j++) {
      setPx(d, x, y, 0, 0, 0, 180);
      x += Math.floor(r() * 3) - 1;
      y += Math.floor(r() * 3) - 1;
    }
  }
  return d;
}

export class TextureAtlas {
  constructor() {
    this.tileSize = SIZE;
    this.keys = Object.keys(generators);
    this.uvMap = {};
    this.canvases = {};
    this.iconCanvases = {};
    this.breakCanvases = [];
    this.texture = null;
    this.tilesPerRow = 0;
  }

  build() {
    // Build individual textures
    for (const key of this.keys) {
      const data = generators[key]();
      this.canvases[key] = canvasFromData(data);
      this.iconCanvases[key] = this.canvases[key];
    }

    for (let i = 0; i < 10; i++) {
      this.breakCanvases.push(canvasFromData(makeBreakStage(i)));
    }

    // Pack atlas
    const n = this.keys.length;
    this.tilesPerRow = Math.ceil(Math.sqrt(n));
    const atlasSize = this.tilesPerRow * SIZE;
    const atlas = document.createElement("canvas");
    atlas.width = atlasSize;
    atlas.height = atlasSize;
    const ctx = atlas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, atlasSize, atlasSize);

    this.keys.forEach((key, i) => {
      const col = i % this.tilesPerRow;
      const row = Math.floor(i / this.tilesPerRow);
      ctx.drawImage(this.canvases[key], col * SIZE, row * SIZE);
      // UV with slight inset to prevent bleeding
      const inset = 0.5 / atlasSize;
      this.uvMap[key] = {
        u0: col / this.tilesPerRow + inset,
        v0: 1 - (row + 1) / this.tilesPerRow + inset,
        u1: (col + 1) / this.tilesPerRow - inset,
        v1: 1 - row / this.tilesPerRow - inset,
      };
    });

    this.texture = new THREE.CanvasTexture(atlas);
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.needsUpdate = true;

    return this;
  }

  getUV(key) {
    return this.uvMap[key] || this.uvMap.stone;
  }

  getIcon(key) {
    return this.iconCanvases[key] || this.iconCanvases.stone;
  }

  getBreakCanvas(stage) {
    return this.breakCanvases[clamp(stage, 0, 9)];
  }
}

export function createAtlas() {
  return new TextureAtlas().build();
}
