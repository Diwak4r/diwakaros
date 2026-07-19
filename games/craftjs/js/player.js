/**
 * First-person player: movement, gravity, collision, fly mode, block interaction.
 */

import * as THREE from "three";
import { getBlock, BlockID, AIR } from "./blocks.js";

const PLAYER_WIDTH = 0.6;
const PLAYER_HEIGHT = 1.8;
const EYE_HEIGHT = 1.62;
const CROUCH_HEIGHT = 1.5;
const GRAVITY = 28;
const JUMP_SPEED = 9.2;
const WALK_SPEED = 4.3;
const SPRINT_SPEED = 5.6;
const CROUCH_SPEED = 1.3;
const FLY_SPEED = 10.5;
const REACH = 5;

export class Player {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;

    this.position = new THREE.Vector3(0, 80, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;

    this.onGround = false;
    this.flying = false;
    this.crouching = false;
    this.sprinting = false;

    this.keys = {};
    this.lookSensitivity = 0.0022;

    // Block breaking
    this.breaking = null; // {x,y,z, progress, hardness}
    this.breakProgress = 0;

    this.health = 20;
    this.food = 20;
    this.xp = 0;
    this.xpLevel = 0;

    this.fallDistance = 0;
    this.lastSpace = 0;
    this.bobPhase = 0;
    this.footstepTimer = 0;

    this._fwd = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._wish = new THREE.Vector3();
  }

  spawn(x, z) {
    const y = this.world.findSpawnY(x, z);
    this.position.set(x + 0.5, y + 0.1, z + 0.5);
    this.velocity.set(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.updateCamera();
  }

  setKey(code, down) {
    this.keys[code] = down;
  }

  onMouseMove(dx, dy) {
    this.yaw -= dx * this.lookSensitivity;
    this.pitch -= dy * this.lookSensitivity;
    const lim = Math.PI / 2 - 0.01;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
  }

  toggleFly() {
    this.flying = !this.flying;
    this.velocity.y = 0;
    this.fallDistance = 0;
  }

  get eyePosition() {
    const h = this.crouching ? CROUCH_HEIGHT - 0.18 : EYE_HEIGHT;
    return new THREE.Vector3(
      this.position.x,
      this.position.y + h,
      this.position.z
    );
  }

  get lookDirection() {
    const dir = new THREE.Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch)
    );
    return dir.normalize();
  }

  updateCamera() {
    const eye = this.eyePosition;
    // View bobbing
    let bobX = 0, bobY = 0;
    if (this.onGround && !this.flying) {
      bobX = Math.sin(this.bobPhase) * 0.03;
      bobY = Math.abs(Math.cos(this.bobPhase)) * 0.04;
    }
    this.camera.position.set(eye.x + bobX, eye.y + bobY, eye.z);
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  update(dt, inventory, audio) {
    this.crouching = !!(this.keys["ShiftLeft"] || this.keys["ShiftRight"]) && !this.flying;
    this.sprinting =
      !!(this.keys["ControlLeft"] || this.keys["ControlRight"]) &&
      !this.crouching &&
      !this.flying;

    // Movement wish
    this._fwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this._right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this._wish.set(0, 0, 0);

    if (this.keys["KeyW"]) this._wish.add(this._fwd);
    if (this.keys["KeyS"]) this._wish.sub(this._fwd);
    if (this.keys["KeyA"]) this._wish.sub(this._right);
    if (this.keys["KeyD"]) this._wish.add(this._right);

    if (this._wish.lengthSq() > 0) this._wish.normalize();

    let speed = WALK_SPEED;
    if (this.flying) speed = FLY_SPEED;
    else if (this.crouching) speed = CROUCH_SPEED;
    else if (this.sprinting) speed = SPRINT_SPEED;

    // Water slow
    const inWater = this.world.getBlock(
      Math.floor(this.position.x),
      Math.floor(this.position.y + 1),
      Math.floor(this.position.z)
    ) === BlockID.WATER;
    if (inWater && !this.flying) speed *= 0.45;

    if (this.flying) {
      this.velocity.x = this._wish.x * speed;
      this.velocity.z = this._wish.z * speed;
      this.velocity.y = 0;
      if (this.keys["Space"]) this.velocity.y = speed;
      if (this.keys["ShiftLeft"] || this.keys["ShiftRight"]) this.velocity.y = -speed;
    } else {
      this.velocity.x = this._wish.x * speed;
      this.velocity.z = this._wish.z * speed;

      if (inWater) {
        this.velocity.y += (this.keys["Space"] ? 12 : -6) * dt;
        this.velocity.y *= 0.9;
      } else {
        this.velocity.y -= GRAVITY * dt;
        if (this.keys["Space"] && this.onGround) {
          this.velocity.y = JUMP_SPEED;
          this.onGround = false;
          if (audio) audio.play("jump");
        }
      }
    }

    // Integrate with collision
    this.moveWithCollision(this.velocity.x * dt, 0, 0);
    this.moveWithCollision(0, this.velocity.y * dt, 0);
    this.moveWithCollision(0, 0, this.velocity.z * dt);

    // Fall damage
    if (!this.flying && !inWater) {
      if (this.velocity.y < -0.1) {
        this.fallDistance += -this.velocity.y * dt;
      }
      if (this.onGround && this.fallDistance > 3.5) {
        const dmg = Math.floor(this.fallDistance - 3);
        if (dmg > 0) {
          this.hurt(dmg, audio);
        }
        this.fallDistance = 0;
      }
      if (this.onGround) this.fallDistance = 0;
    } else {
      this.fallDistance = 0;
    }

    // Bobbing / footsteps
    const moving = this._wish.lengthSq() > 0 && this.onGround;
    if (moving) {
      this.bobPhase += dt * (this.sprinting ? 14 : 10);
      this.footstepTimer -= dt;
      if (this.footstepTimer <= 0) {
        this.footstepTimer = this.sprinting ? 0.28 : 0.4;
        if (audio) audio.play("step");
      }
    } else {
      this.bobPhase *= 0.9;
    }

    this.updateCamera();
  }

  moveWithCollision(dx, dy, dz) {
    const w = PLAYER_WIDTH / 2;
    const h = this.crouching ? CROUCH_HEIGHT : PLAYER_HEIGHT;

    // X
    if (dx !== 0) {
      this.position.x += dx;
      if (this.collides(w, h)) {
        if (dx > 0) this.position.x = Math.floor(this.position.x + w) - w - 0.0001;
        else this.position.x = Math.floor(this.position.x - w) + 1 + w + 0.0001;
        this.velocity.x = 0;
      }
    }

    // Y
    if (dy !== 0) {
      this.position.y += dy;
      this.onGround = false;
      if (this.collides(w, h)) {
        if (dy < 0) {
          this.position.y = Math.floor(this.position.y) + 1;
          this.onGround = true;
        } else {
          this.position.y = Math.floor(this.position.y + h) - h - 0.0001;
        }
        this.velocity.y = 0;
      }
    }

    // Z
    if (dz !== 0) {
      this.position.z += dz;
      if (this.collides(w, h)) {
        if (dz > 0) this.position.z = Math.floor(this.position.z + w) - w - 0.0001;
        else this.position.z = Math.floor(this.position.z - w) + 1 + w + 0.0001;
        this.velocity.z = 0;
      }
    }
  }

  collides(w, h) {
    const minX = Math.floor(this.position.x - w);
    const maxX = Math.floor(this.position.x + w);
    const minY = Math.floor(this.position.y + 0.001);
    const maxY = Math.floor(this.position.y + h - 0.001);
    const minZ = Math.floor(this.position.z - w);
    const maxZ = Math.floor(this.position.z + w);

    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let x = minX; x <= maxX; x++) {
          if (this.world.isSolidBlock(x, y, z)) return true;
        }
      }
    }
    return false;
  }

  /** Check if a block placement would intersect player AABB */
  wouldCollideWithBlock(bx, by, bz) {
    const w = PLAYER_WIDTH / 2;
    const h = this.crouching ? CROUCH_HEIGHT : PLAYER_HEIGHT;
    const minX = this.position.x - w;
    const maxX = this.position.x + w;
    const minY = this.position.y;
    const maxY = this.position.y + h;
    const minZ = this.position.z - w;
    const maxZ = this.position.z + w;

    return (
      minX < bx + 1 && maxX > bx &&
      minY < by + 1 && maxY > by &&
      minZ < bz + 1 && maxZ > bz
    );
  }

  startBreak(hit) {
    if (!hit.hit) {
      this.cancelBreak();
      return;
    }
    const block = getBlock(hit.id);
    if (!isFinite(block.breakTime) || block.breakTime === Infinity) {
      this.cancelBreak();
      return;
    }
    if (
      !this.breaking ||
      this.breaking.x !== hit.x ||
      this.breaking.y !== hit.y ||
      this.breaking.z !== hit.z
    ) {
      this.breaking = { x: hit.x, y: hit.y, z: hit.z, id: hit.id };
      this.breakProgress = 0;
    }
  }

  updateBreak(dt, inventory, audio) {
    if (!this.breaking) return null;
    const still = this.world.getBlock(this.breaking.x, this.breaking.y, this.breaking.z);
    if (still !== this.breaking.id) {
      this.cancelBreak();
      return null;
    }
    const block = getBlock(this.breaking.id);
    // Instant break in creative-like mode for soft blocks; always mine with time
    const t = Math.max(0.05, block.breakTime);
    this.breakProgress += dt / t;

    if (this.breakProgress >= 1) {
      const drop = block.drops;
      this.world.setBlock(this.breaking.x, this.breaking.y, this.breaking.z, AIR);
      if (drop && drop !== AIR) inventory.addItem(drop, 1);
      if (audio) audio.play("break");
      // XP from ores
      if (
        still === BlockID.COAL_ORE ||
        still === BlockID.IRON_ORE ||
        still === BlockID.GOLD_ORE ||
        still === BlockID.DIAMOND_ORE
      ) {
        this.addXp(still === BlockID.DIAMOND_ORE ? 5 : 2);
      }
      const result = { ...this.breaking };
      this.cancelBreak();
      return result;
    }
    return null;
  }

  cancelBreak() {
    this.breaking = null;
    this.breakProgress = 0;
  }

  placeBlock(hit, inventory, audio) {
    if (!hit.hit) return false;
    const id = inventory.getSelectedId();
    if (!id || id === AIR) return false;

    const px = hit.placeX;
    const py = hit.placeY;
    const pz = hit.placeZ;

    if (py < 0 || py >= 96) return false;
    if (this.world.getBlock(px, py, pz) !== AIR && this.world.getBlock(px, py, pz) !== BlockID.WATER) {
      return false;
    }
    if (this.wouldCollideWithBlock(px, py, pz)) return false;

    // Creative infinite place; survival would consume
    this.world.setBlock(px, py, pz, id);
    if (audio) audio.play("place");
    return true;
  }

  pickBlock(hit, inventory) {
    if (!hit.hit) return;
    inventory.selectBlock(hit.id);
  }

  hurt(amount, audio) {
    this.health = Math.max(0, this.health - amount);
    if (audio) audio.play("hurt");
    document.body.classList.remove("hurt");
    void document.body.offsetWidth;
    document.body.classList.add("hurt");
    setTimeout(() => document.body.classList.remove("hurt"), 400);
  }

  addXp(n) {
    this.xp += n;
    while (this.xp >= this.xpToLevel()) {
      this.xp -= this.xpToLevel();
      this.xpLevel++;
    }
  }

  xpToLevel() {
    return 7 + this.xpLevel * 2;
  }

  getReachRay() {
    return this.world.raycast(this.eyePosition, this.lookDirection, REACH);
  }
}
