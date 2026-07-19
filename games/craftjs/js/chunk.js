/**
 * Chunk storage + greedy-ish face-culled mesh builder.
 */

import * as THREE from "three";
import { AIR, BLOCKS, FACE, isSolid, isTransparent, isLiquid } from "./blocks.js";

export const CHUNK_W = 16;
export const CHUNK_H = 96;
export const CHUNK_D = 16;

const DIRS = [
  { face: FACE.TOP,    dx: 0, dy: 1, dz: 0, corners: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]], nx: 0, ny: 1, nz: 0 },
  { face: FACE.BOTTOM, dx: 0, dy:-1, dz: 0, corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]], nx: 0, ny:-1, nz: 0 },
  { face: FACE.NORTH,  dx: 0, dy: 0, dz:-1, corners: [[1,0,0],[0,0,0],[0,1,0],[1,1,0]], nx: 0, ny: 0, nz:-1 },
  { face: FACE.SOUTH,  dx: 0, dy: 0, dz: 1, corners: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]], nx: 0, ny: 0, nz: 1 },
  { face: FACE.WEST,   dx:-1, dy: 0, dz: 0, corners: [[0,0,0],[0,0,1],[0,1,1],[0,1,0]], nx:-1, ny: 0, nz: 0 },
  { face: FACE.EAST,   dx: 1, dy: 0, dz: 0, corners: [[1,0,1],[1,0,0],[1,1,0],[1,1,1]], nx: 1, ny: 0, nz: 0 },
];

// Per-face AO / light shade
const FACE_SHADE = [1.0, 0.5, 0.8, 0.8, 0.6, 0.6];

export class Chunk {
  constructor(cx, cz, world) {
    this.cx = cx;
    this.cz = cz;
    this.world = world;
    this.blocks = new Uint8Array(CHUNK_W * CHUNK_H * CHUNK_D);
    this.mesh = null;
    this.waterMesh = null;
    this.dirty = true;
    this.generated = false;
    this.group = new THREE.Group();
    this.group.position.set(cx * CHUNK_W, 0, cz * CHUNK_D);
  }

  index(x, y, z) {
    return y * CHUNK_W * CHUNK_D + z * CHUNK_W + x;
  }

  inBounds(x, y, z) {
    return x >= 0 && x < CHUNK_W && y >= 0 && y < CHUNK_H && z >= 0 && z < CHUNK_D;
  }

  get(x, y, z) {
    if (!this.inBounds(x, y, z)) return AIR;
    return this.blocks[this.index(x, y, z)];
  }

  set(x, y, z, id) {
    if (!this.inBounds(x, y, z)) return false;
    this.blocks[this.index(x, y, z)] = id;
    this.dirty = true;
    return true;
  }

  /** Get block including neighbor chunks for face culling */
  getWorldLocal(x, y, z) {
    if (this.inBounds(x, y, z)) return this.get(x, y, z);
    const wx = this.cx * CHUNK_W + x;
    const wz = this.cz * CHUNK_D + z;
    return this.world.getBlock(wx, y, wz);
  }

  shouldDrawFace(id, nx, ny, nz) {
    const neighbor = this.getWorldLocal(nx, ny, nz);
    if (neighbor === AIR) return true;
    if (id === neighbor && isLiquid(id)) return false;
    if (isTransparent(neighbor) && neighbor !== id) return true;
    if (isLiquid(neighbor) && !isLiquid(id)) return true;
    return false;
  }

  buildMesh(atlas) {
    if (!this.dirty && this.mesh) return;

    const positions = [];
    const normals = [];
    const uvs = [];
    const colors = [];
    const indices = [];

    const wPositions = [];
    const wNormals = [];
    const wUvs = [];
    const wColors = [];
    const wIndices = [];

    let solidIndex = 0;
    let waterIndex = 0;

    for (let y = 0; y < CHUNK_H; y++) {
      for (let z = 0; z < CHUNK_D; z++) {
        for (let x = 0; x < CHUNK_W; x++) {
          const id = this.get(x, y, z);
          if (id === AIR) continue;
          const block = BLOCKS[id];
          if (!block) continue;

          const isWater = isLiquid(id);
          const posArr = isWater ? wPositions : positions;
          const normArr = isWater ? wNormals : normals;
          const uvArr = isWater ? wUvs : uvs;
          const colArr = isWater ? wColors : colors;
          const idxArr = isWater ? wIndices : indices;
          let base = isWater ? waterIndex : solidIndex;

          for (const dir of DIRS) {
            const nx = x + dir.dx;
            const ny = y + dir.dy;
            const nz = z + dir.dz;
            if (!this.shouldDrawFace(id, nx, ny, nz)) continue;

            const texKey = block.faces[dir.face];
            const uv = atlas.getUV(texKey);
            const shade = FACE_SHADE[dir.face];
            const heightShade = 0.75 + 0.25 * (y / CHUNK_H);
            const baseShade = shade * heightShade;

            const corners = dir.corners;
            const uvCorners = [
              [uv.u0, uv.v0],
              [uv.u1, uv.v0],
              [uv.u1, uv.v1],
              [uv.u0, uv.v1],
            ];

            // Per-corner AO (side + side + diagonal solid check)
            const aoVals = [1, 1, 1, 1];
            if (!isWater) {
              for (let i = 0; i < 4; i++) {
                const c = corners[i];
                // two edge offsets in the plane of the face
                const ox = c[0] === 0 ? -1 : 1;
                const oy = c[1] === 0 ? -1 : 1;
                const oz = c[2] === 0 ? -1 : 1;
                let s1 = 0, s2 = 0, sc = 0;
                if (dir.nx !== 0) {
                  s1 = isSolid(this.getWorldLocal(nx, y + oy, z)) ? 1 : 0;
                  s2 = isSolid(this.getWorldLocal(nx, y, z + oz)) ? 1 : 0;
                  sc = isSolid(this.getWorldLocal(nx, y + oy, z + oz)) ? 1 : 0;
                } else if (dir.ny !== 0) {
                  s1 = isSolid(this.getWorldLocal(x + ox, ny, z)) ? 1 : 0;
                  s2 = isSolid(this.getWorldLocal(x, ny, z + oz)) ? 1 : 0;
                  sc = isSolid(this.getWorldLocal(x + ox, ny, z + oz)) ? 1 : 0;
                } else {
                  s1 = isSolid(this.getWorldLocal(x + ox, y, nz)) ? 1 : 0;
                  s2 = isSolid(this.getWorldLocal(x, y + oy, nz)) ? 1 : 0;
                  sc = isSolid(this.getWorldLocal(x + ox, y + oy, nz)) ? 1 : 0;
                }
                // classic Minecraft AO formula
                if (s1 && s2) aoVals[i] = 0.5;
                else aoVals[i] = 1 - (s1 + s2 + sc) / 6;
              }
            }

            for (let i = 0; i < 4; i++) {
              const c = corners[i];
              const v = baseShade * aoVals[i];
              posArr.push(x + c[0], y + c[1], z + c[2]);
              normArr.push(dir.nx, dir.ny, dir.nz);
              uvArr.push(uvCorners[i][0], uvCorners[i][1]);
              colArr.push(v, v, v);
            }

            // Flip quad winding when AO would cause anisotropic interpolation artifact
            const flip = aoVals[0] + aoVals[2] > aoVals[1] + aoVals[3];
            if (flip) {
              idxArr.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
            } else {
              idxArr.push(base, base + 1, base + 2, base, base + 2, base + 3);
            }
            base += 4;
          }

          if (isWater) waterIndex = base;
          else solidIndex = base;
        }
      }
    }

    // Dispose old
    this.disposeMeshes();

    if (positions.length > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      geo.setIndex(indices);
      geo.computeBoundingSphere();

      const mat = this.world.solidMaterial;
      this.mesh = new THREE.Mesh(geo, mat);
      this.mesh.matrixAutoUpdate = false;
      this.mesh.updateMatrix();
      this.group.add(this.mesh);
    }

    if (wPositions.length > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(wPositions, 3));
      geo.setAttribute("normal", new THREE.Float32BufferAttribute(wNormals, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(wUvs, 2));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(wColors, 3));
      geo.setIndex(wIndices);
      geo.computeBoundingSphere();

      this.waterMesh = new THREE.Mesh(geo, this.world.waterMaterial);
      this.waterMesh.matrixAutoUpdate = false;
      this.waterMesh.updateMatrix();
      this.waterMesh.renderOrder = 1;
      this.group.add(this.waterMesh);
    }

    this.dirty = false;
  }

  disposeMeshes() {
    if (this.mesh) {
      this.group.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh = null;
    }
    if (this.waterMesh) {
      this.group.remove(this.waterMesh);
      this.waterMesh.geometry.dispose();
      this.waterMesh = null;
    }
  }

  dispose() {
    this.disposeMeshes();
  }
}
