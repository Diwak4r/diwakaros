/**
 * World manager: terrain generation, chunks, block get/set, trees, caves, ores.
 */

import * as THREE from "three";
import { Noise } from "./noise.js";
import { Chunk, CHUNK_W, CHUNK_H, CHUNK_D } from "./chunk.js";
import { AIR, BlockID, isSolid } from "./blocks.js";

export const SEA_LEVEL = 42;
export const RENDER_DISTANCE = 5;

const BIOME = {
  OCEAN: 0,
  BEACH: 1,
  PLAINS: 2,
  FOREST: 3,
  DESERT: 4,
  MOUNTAINS: 5,
  SNOW: 6,
};

export class World {
  constructor(scene, atlas, seed = 42) {
    this.scene = scene;
    this.atlas = atlas;
    this.seed = seed;
    this.noise = new Noise(seed);
    this.noiseCaves = new Noise(seed + 99);
    this.noiseOre = new Noise(seed + 777);
    this.noiseBiome = new Noise(seed + 1234);
    this.noiseTree = new Noise(seed + 555);

    this.chunks = new Map();
    this.group = new THREE.Group();
    scene.add(this.group);

    this.solidMaterial = new THREE.MeshLambertMaterial({
      map: atlas.texture,
      vertexColors: true,
      side: THREE.FrontSide,
      alphaTest: 0.15,
      transparent: false,
    });

    this.waterMaterial = new THREE.MeshLambertMaterial({
      map: atlas.texture,
      vertexColors: true,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.seaLevel = SEA_LEVEL;
  }

  chunkKey(cx, cz) {
    return `${cx},${cz}`;
  }

  worldToChunk(wx, wz) {
    const cx = Math.floor(wx / CHUNK_W);
    const cz = Math.floor(wz / CHUNK_D);
    return { cx, cz, lx: ((wx % CHUNK_W) + CHUNK_W) % CHUNK_W, lz: ((wz % CHUNK_D) + CHUNK_D) % CHUNK_D };
  }

  getChunk(cx, cz) {
    return this.chunks.get(this.chunkKey(cx, cz));
  }

  getBlock(wx, y, wz) {
    if (y < 0 || y >= CHUNK_H) return AIR;
    const { cx, cz, lx, lz } = this.worldToChunk(wx, wz);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return AIR;
    return chunk.get(lx, y, lz);
  }

  setBlock(wx, y, wz, id) {
    if (y < 0 || y >= CHUNK_H) return false;
    if (y === 0 && id === AIR) return false; // protect bedrock layer partially
    const { cx, cz, lx, lz } = this.worldToChunk(wx, wz);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return false;

    const prev = chunk.get(lx, y, lz);
    if (prev === BlockID.BEDROCK && id === AIR) return false;

    chunk.set(lx, y, lz, id);
    this.markNeighborsDirty(cx, cz, lx, lz);
    return true;
  }

  markNeighborsDirty(cx, cz, lx, lz) {
    const c = this.getChunk(cx, cz);
    if (c) c.dirty = true;
    if (lx === 0) {
      const n = this.getChunk(cx - 1, cz);
      if (n) n.dirty = true;
    }
    if (lx === CHUNK_W - 1) {
      const n = this.getChunk(cx + 1, cz);
      if (n) n.dirty = true;
    }
    if (lz === 0) {
      const n = this.getChunk(cx, cz - 1);
      if (n) n.dirty = true;
    }
    if (lz === CHUNK_D - 1) {
      const n = this.getChunk(cx, cz + 1);
      if (n) n.dirty = true;
    }
  }

  isSolidBlock(wx, y, wz) {
    return isSolid(this.getBlock(wx, y, wz));
  }

  getBiome(wx, wz) {
    const cont = this.noiseBiome.fbm2(wx * 0.003, wz * 0.003, 4);
    const temp = this.noiseBiome.fbm2(wx * 0.004 + 200, wz * 0.004 + 200, 3);
    const hum = this.noiseBiome.fbm2(wx * 0.005 + 500, wz * 0.005 + 500, 3);

    if (cont < -0.25) return BIOME.OCEAN;
    if (cont < -0.12) return BIOME.BEACH;
    if (temp < -0.25) return BIOME.SNOW;
    if (temp > 0.3 && hum < -0.1) return BIOME.DESERT;
    if (cont > 0.35) return BIOME.MOUNTAINS;
    if (hum > 0.1) return BIOME.FOREST;
    return BIOME.PLAINS;
  }

  getHeight(wx, wz) {
    const biome = this.getBiome(wx, wz);
    const base = this.noise.fbm2(wx * 0.01, wz * 0.01, 5, 2, 0.5);
    const ridge = Math.abs(this.noise.fbm2(wx * 0.02 + 50, wz * 0.02 + 50, 3));
    const detail = this.noise.fbm2(wx * 0.05, wz * 0.05, 2) * 0.15;

    let h;
    switch (biome) {
      case BIOME.OCEAN:
        h = SEA_LEVEL - 8 + base * 4;
        break;
      case BIOME.BEACH:
        h = SEA_LEVEL + base * 2;
        break;
      case BIOME.PLAINS:
        h = SEA_LEVEL + 4 + base * 6 + detail * 2;
        break;
      case BIOME.FOREST:
        h = SEA_LEVEL + 5 + base * 8 + detail * 3;
        break;
      case BIOME.DESERT:
        h = SEA_LEVEL + 3 + base * 5 + ridge * 3;
        break;
      case BIOME.MOUNTAINS:
        h = SEA_LEVEL + 10 + base * 18 + ridge * 22 + detail * 4;
        break;
      case BIOME.SNOW:
        h = SEA_LEVEL + 8 + base * 12 + ridge * 8;
        break;
      default:
        h = SEA_LEVEL + base * 8;
    }
    return Math.floor(Math.max(4, Math.min(CHUNK_H - 8, h)));
  }

  generateChunk(cx, cz) {
    const chunk = new Chunk(cx, cz, this);
    const ox = cx * CHUNK_W;
    const oz = cz * CHUNK_D;

    // Heights cache
    const heights = new Int16Array(CHUNK_W * CHUNK_D);
    const biomes = new Uint8Array(CHUNK_W * CHUNK_D);

    for (let z = 0; z < CHUNK_D; z++) {
      for (let x = 0; x < CHUNK_W; x++) {
        const wx = ox + x;
        const wz = oz + z;
        heights[z * CHUNK_W + x] = this.getHeight(wx, wz);
        biomes[z * CHUNK_W + x] = this.getBiome(wx, wz);
      }
    }

    for (let z = 0; z < CHUNK_D; z++) {
      for (let x = 0; x < CHUNK_W; x++) {
        const wx = ox + x;
        const wz = oz + z;
        const h = heights[z * CHUNK_W + x];
        const biome = biomes[z * CHUNK_W + x];

        for (let y = 0; y < CHUNK_H; y++) {
          let id = AIR;

          if (y === 0) {
            id = BlockID.BEDROCK;
          } else if (y <= 2 && this.noise.noise3(wx * 0.8, y * 2.1, wz * 0.8) > 0.15) {
            id = BlockID.BEDROCK;
          } else if (y > h) {
            if (y <= SEA_LEVEL) id = BlockID.WATER;
            else id = AIR;
          } else {
            // caves
            const cave = this.noiseCaves.fbm(wx * 0.06, y * 0.08, wz * 0.06, 3);
            const deep = y < h - 4 && y > 4;
            if (deep && cave > 0.42) {
              id = AIR;
            } else if (y === h) {
              id = this.surfaceBlock(biome, h);
            } else if (y >= h - 3) {
              id = this.subsurfaceBlock(biome);
            } else {
              id = BlockID.STONE;
              // ores
              id = this.placeOre(wx, y, wz, id);
            }
          }

          if (id !== AIR) chunk.set(x, y, z, id);
        }
      }
    }

    // Trees / cactus / features (second pass)
    for (let z = 2; z < CHUNK_D - 2; z++) {
      for (let x = 2; x < CHUNK_W - 2; x++) {
        const wx = ox + x;
        const wz = oz + z;
        const h = heights[z * CHUNK_W + x];
        const biome = biomes[z * CHUNK_W + x];
        if (h <= SEA_LEVEL) continue;
        if (chunk.get(x, h, z) === AIR) continue;

        const n = this.noiseTree.noise2(wx * 0.5, wz * 0.5);

        if (biome === BIOME.FOREST && n > 0.55) {
          this.placeTree(chunk, x, h + 1, z);
        } else if (biome === BIOME.PLAINS && n > 0.78) {
          this.placeTree(chunk, x, h + 1, z);
        } else if (biome === BIOME.DESERT && n > 0.72) {
          this.placeCactus(chunk, x, h + 1, z);
        } else if ((biome === BIOME.PLAINS || biome === BIOME.FOREST) && n > 0.85) {
          // pumpkin
          if (chunk.get(x, h, z) === BlockID.GRASS) {
            chunk.set(x, h + 1, z, BlockID.PUMPKIN);
          }
        }
      }
    }

    chunk.generated = true;
    chunk.dirty = true;
    this.chunks.set(this.chunkKey(cx, cz), chunk);
    this.group.add(chunk.group);
    return chunk;
  }

  surfaceBlock(biome, h) {
    switch (biome) {
      case BIOME.BEACH:
      case BIOME.DESERT:
        return BlockID.SAND;
      case BIOME.OCEAN:
        return h < SEA_LEVEL - 2 ? BlockID.GRAVEL : BlockID.SAND;
      case BIOME.SNOW:
        return h > SEA_LEVEL + 20 ? BlockID.SNOW : BlockID.SNOWY_GRASS;
      case BIOME.MOUNTAINS:
        if (h > SEA_LEVEL + 28) return BlockID.SNOW;
        if (h > SEA_LEVEL + 20) return BlockID.STONE;
        return BlockID.GRASS;
      default:
        return BlockID.GRASS;
    }
  }

  subsurfaceBlock(biome) {
    if (biome === BIOME.DESERT || biome === BIOME.BEACH) return BlockID.SAND;
    if (biome === BIOME.OCEAN) return BlockID.SAND;
    return BlockID.DIRT;
  }

  placeOre(wx, y, wz, current) {
    if (current !== BlockID.STONE) return current;
    const n = this.noiseOre.noise3(wx * 0.12, y * 0.12, wz * 0.12);
    if (y < 16 && n > 0.72) return BlockID.DIAMOND_ORE;
    if (y < 32 && n > 0.68) return BlockID.GOLD_ORE;
    if (y < 48 && n > 0.62) return BlockID.IRON_ORE;
    if (y < 64 && n > 0.58) return BlockID.COAL_ORE;
    // rare obsidian pockets deep
    if (y < 10 && n > 0.85) return BlockID.OBSIDIAN;
    return current;
  }

  placeTree(chunk, x, y, z) {
    const trunkH = 4 + Math.floor(Math.abs(this.noiseTree.noise2(x * 3, z * 3)) * 3);
    // ensure space
    if (y + trunkH + 3 >= CHUNK_H) return;
    if (chunk.get(x, y - 1, z) !== BlockID.GRASS && chunk.get(x, y - 1, z) !== BlockID.DIRT && chunk.get(x, y - 1, z) !== BlockID.SNOWY_GRASS) return;

    for (let i = 0; i < trunkH; i++) {
      chunk.set(x, y + i, z, BlockID.OAK_LOG);
    }

    const top = y + trunkH;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          if (Math.abs(dx) === 2 && Math.abs(dz) === 2 && Math.abs(dy) > 0) continue;
          if (dy === 2 && (Math.abs(dx) + Math.abs(dz) > 1)) continue;
          const lx = x + dx;
          const ly = top + dy;
          const lz = z + dz;
          if (!chunk.inBounds(lx, ly, lz)) continue;
          if (chunk.get(lx, ly, lz) === AIR) {
            chunk.set(lx, ly, lz, BlockID.OAK_LEAVES);
          }
        }
      }
    }
  }

  placeCactus(chunk, x, y, z) {
    if (chunk.get(x, y - 1, z) !== BlockID.SAND) return;
    const h = 2 + Math.floor(Math.abs(this.noiseTree.noise2(x, z)) * 3);
    for (let i = 0; i < h; i++) {
      if (y + i >= CHUNK_H) break;
      chunk.set(x, y + i, z, BlockID.CACTUS);
    }
  }

  /**
   * Ensure chunks around player are loaded; unload far ones.
   */
  updateChunks(playerX, playerZ, onProgress) {
    const pcx = Math.floor(playerX / CHUNK_W);
    const pcz = Math.floor(playerZ / CHUNK_D);
    const rd = RENDER_DISTANCE;

    // Load
    const needed = new Set();
    for (let dz = -rd; dz <= rd; dz++) {
      for (let dx = -rd; dx <= rd; dx++) {
        // circular-ish
        if (dx * dx + dz * dz > (rd + 0.5) * (rd + 0.5)) continue;
        const cx = pcx + dx;
        const cz = pcz + dz;
        needed.add(this.chunkKey(cx, cz));
        if (!this.chunks.has(this.chunkKey(cx, cz))) {
          this.generateChunk(cx, cz);
          if (onProgress) onProgress();
        }
      }
    }

    // Unload far chunks
    for (const [key, chunk] of this.chunks) {
      if (!needed.has(key)) {
        this.group.remove(chunk.group);
        chunk.dispose();
        this.chunks.delete(key);
      }
    }

    // Rebuild dirty meshes
    for (const chunk of this.chunks.values()) {
      if (chunk.dirty) {
        chunk.buildMesh(this.atlas);
      }
    }
  }

  /**
   * Initial world gen around spawn.
   * Async + yields so the loading UI can paint between chunks.
   */
  async generateInitial(radius, onProgress) {
    const jobs = [];
    for (let cz = -radius; cz <= radius; cz++) {
      for (let cx = -radius; cx <= radius; cx++) {
        jobs.push({ cx, cz });
      }
    }
    const total = jobs.length;
    let done = 0;

    for (const { cx, cz } of jobs) {
      if (!this.chunks.has(this.chunkKey(cx, cz))) {
        this.generateChunk(cx, cz);
      }
      done++;
      if (onProgress) onProgress(done / total * 0.7);
      // Yield every chunk so the browser stays responsive
      await new Promise((r) => setTimeout(r, 0));
    }

    // Build meshes in a second pass (needs neighbors for face culling)
    const chunks = [...this.chunks.values()];
    for (let i = 0; i < chunks.length; i++) {
      chunks[i].buildMesh(this.atlas);
      if (onProgress) onProgress(0.7 + (i + 1) / chunks.length * 0.3);
      if (i % 2 === 0) await new Promise((r) => setTimeout(r, 0));
    }
  }

  findSpawnY(x, z) {
    for (let y = CHUNK_H - 1; y > 0; y--) {
      if (isSolid(this.getBlock(x, y, z))) return y + 1;
    }
    return SEA_LEVEL + 5;
  }

  /**
   * Voxel raycast DDA — returns hit block + adjacent empty cell for placing.
   */
  raycast(origin, direction, maxDist = 6) {
    const ox = origin.x;
    const oy = origin.y;
    const oz = origin.z;
    let dx = direction.x;
    let dy = direction.y;
    let dz = direction.z;
    const len = Math.hypot(dx, dy, dz) || 1;
    dx /= len; dy /= len; dz /= len;

    let x = Math.floor(ox);
    let y = Math.floor(oy);
    let z = Math.floor(oz);

    const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
    const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
    const stepZ = dz > 0 ? 1 : dz < 0 ? -1 : 0;

    const tDeltaX = stepX !== 0 ? Math.abs(1 / dx) : Infinity;
    const tDeltaY = stepY !== 0 ? Math.abs(1 / dy) : Infinity;
    const tDeltaZ = stepZ !== 0 ? Math.abs(1 / dz) : Infinity;

    let tMaxX = stepX > 0 ? (Math.floor(ox) + 1 - ox) * tDeltaX : stepX < 0 ? (ox - Math.floor(ox)) * tDeltaX : Infinity;
    let tMaxY = stepY > 0 ? (Math.floor(oy) + 1 - oy) * tDeltaY : stepY < 0 ? (oy - Math.floor(oy)) * tDeltaY : Infinity;
    let tMaxZ = stepZ > 0 ? (Math.floor(oz) + 1 - oz) * tDeltaZ : stepZ < 0 ? (oz - Math.floor(oz)) * tDeltaZ : Infinity;

    let face = null;
    let dist = 0;

    for (let i = 0; i < maxDist * 3; i++) {
      const id = this.getBlock(x, y, z);
      if (id !== AIR && id !== BlockID.WATER) {
        // previous cell for place
        let px = x, py = y, pz = z;
        if (face === "x") px -= stepX;
        else if (face === "y") py -= stepY;
        else if (face === "z") pz -= stepZ;

        return {
          hit: true,
          x, y, z,
          id,
          placeX: px,
          placeY: py,
          placeZ: pz,
          face,
          distance: dist,
        };
      }

      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          dist = tMaxX;
          if (dist > maxDist) break;
          x += stepX;
          tMaxX += tDeltaX;
          face = "x";
        } else {
          dist = tMaxZ;
          if (dist > maxDist) break;
          z += stepZ;
          tMaxZ += tDeltaZ;
          face = "z";
        }
      } else {
        if (tMaxY < tMaxZ) {
          dist = tMaxY;
          if (dist > maxDist) break;
          y += stepY;
          tMaxY += tDeltaY;
          face = "y";
        } else {
          dist = tMaxZ;
          if (dist > maxDist) break;
          z += stepZ;
          tMaxZ += tDeltaZ;
          face = "z";
        }
      }
    }

    return { hit: false };
  }
}
