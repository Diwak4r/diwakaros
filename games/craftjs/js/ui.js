/**
 * HUD / inventory / debug UI binding.
 */

import { AIR, getBlock } from "./blocks.js";

export class UI {
  constructor(atlas) {
    this.atlas = atlas;
    this.hotbarEl = document.getElementById("hotbar-slots");
    this.invGrid = document.getElementById("inv-grid");
    this.invHotbar = document.getElementById("inv-hotbar-row");
    this.debugEl = document.getElementById("debug");
    this.debugText = document.getElementById("debug-text");
    this.heldName = document.getElementById("held-name");
    this.breakOverlay = document.getElementById("break-overlay");
    this.hearts = document.getElementById("hearts");
    this.food = document.getElementById("food");
    this.xpFill = document.getElementById("xp-fill");
    this.xpLevel = document.getElementById("xp-level");
    this.debugVisible = false;
    this.inventoryOpen = false;

    this.buildHotbarDOM();
    this.buildHearts();
    this.buildFood();
  }

  buildHotbarDOM() {
    this.hotbarEl.innerHTML = "";
    this.hotbarSlots = [];
    for (let i = 0; i < 9; i++) {
      const slot = document.createElement("div");
      slot.className = "slot" + (i === 0 ? " selected" : "");
      slot.dataset.index = i;
      const hint = document.createElement("span");
      hint.className = "key-hint";
      hint.textContent = String(i + 1);
      slot.appendChild(hint);
      const canvas = document.createElement("canvas");
      canvas.width = 16;
      canvas.height = 16;
      slot.appendChild(canvas);
      const count = document.createElement("span");
      count.className = "count";
      slot.appendChild(count);
      this.hotbarEl.appendChild(slot);
      this.hotbarSlots.push({ el: slot, canvas, count });
    }
  }

  buildHearts() {
    this.hearts.innerHTML = "";
    this.heartEls = [];
    for (let i = 0; i < 10; i++) {
      const s = document.createElement("span");
      s.className = "heart";
      s.textContent = "❤";
      this.hearts.appendChild(s);
      this.heartEls.push(s);
    }
  }

  buildFood() {
    this.food.innerHTML = "";
    this.foodEls = [];
    for (let i = 0; i < 10; i++) {
      const s = document.createElement("span");
      s.className = "drumstick";
      s.textContent = "🍖";
      this.food.appendChild(s);
      this.foodEls.push(s);
    }
  }

  drawIcon(canvas, blockId) {
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 16, 16);
    if (!blockId || blockId === AIR) return;
    const block = getBlock(blockId);
    const key = block.faces[0]; // top face as icon
    const src = this.atlas.getIcon(key);
    if (src) ctx.drawImage(src, 0, 0);
  }

  updateHotbar(inventory) {
    for (let i = 0; i < 9; i++) {
      const slot = inventory.hotbar[i];
      const dom = this.hotbarSlots[i];
      dom.el.classList.toggle("selected", i === inventory.selected);
      this.drawIcon(dom.canvas, slot.id);
      dom.count.textContent = slot.count > 1 ? String(slot.count) : "";
    }

    if (inventory.nameTimer > 0 && inventory.lastName) {
      this.heldName.textContent = inventory.lastName;
      this.heldName.classList.add("show");
    } else {
      this.heldName.classList.remove("show");
    }
  }

  updatePlayerBars(player) {
    const hearts = Math.ceil(player.health / 2);
    for (let i = 0; i < 10; i++) {
      this.heartEls[i].classList.toggle("empty", i >= hearts);
    }
    const food = Math.ceil(player.food / 2);
    for (let i = 0; i < 10; i++) {
      this.foodEls[i].classList.toggle("empty", i >= food);
    }
    const pct = (player.xp / player.xpToLevel()) * 100;
    this.xpFill.style.width = `${pct}%`;
    this.xpLevel.textContent = String(player.xpLevel);
  }

  updateBreak(player) {
    if (player.breaking && player.breakProgress > 0) {
      const stage = Math.min(9, Math.floor(player.breakProgress * 10));
      const c = this.atlas.getBreakCanvas(stage);
      this.breakOverlay.style.opacity = "0.85";
      this.breakOverlay.style.backgroundImage = `url(${c.toDataURL()})`;
    } else {
      this.breakOverlay.style.opacity = "0";
      this.breakOverlay.style.backgroundImage = "none";
    }
  }

  toggleDebug() {
    this.debugVisible = !this.debugVisible;
    this.debugEl.classList.toggle("hidden", !this.debugVisible);
  }

  updateDebug(player, world, fps, hit) {
    if (!this.debugVisible) return;
    const p = player.position;
    const biome = world.getBiome(Math.floor(p.x), Math.floor(p.z));
    const biomeNames = ["Ocean", "Beach", "Plains", "Forest", "Desert", "Mountains", "Snow"];
    const look = player.lookDirection;
    const target = hit.hit
      ? `${getBlock(hit.id).name} @ ${hit.x}, ${hit.y}, ${hit.z}`
      : "none";

    this.debugText.textContent = [
      `CraftJS / Three.js`,
      `${fps} fps`,
      `XYZ: ${p.x.toFixed(2)} / ${p.y.toFixed(2)} / ${p.z.toFixed(2)}`,
      `Block: ${Math.floor(p.x)} ${Math.floor(p.y)} ${Math.floor(p.z)}`,
      `Chunk: ${Math.floor(p.x / 16)} ${Math.floor(p.z / 16)}  (${world.chunks.size} loaded)`,
      `Facing: ${this.facingName(player.yaw)} (${((player.yaw * 180) / Math.PI).toFixed(1)}°)`,
      `Pitch: ${((player.pitch * 180) / Math.PI).toFixed(1)}°`,
      `Biome: ${biomeNames[biome] || biome}`,
      `Light: sky`,
      `Flying: ${player.flying ? "ON" : "OFF"}  OnGround: ${player.onGround}`,
      `Target: ${target}`,
      `Seed: ${world.seed}`,
      `Mem chunks: ${world.chunks.size}`,
    ].join("\n");
  }

  facingName(yaw) {
    // Minecraft-style: 0 = south? we use -sin for X of forward so 0 faces -Z (north-like)
    let a = ((-yaw) * 180) / Math.PI;
    a = ((a % 360) + 360) % 360;
    if (a >= 315 || a < 45) return "north (-Z)";
    if (a < 135) return "west (-X)";
    if (a < 225) return "south (+Z)";
    return "east (+X)";
  }

  openInventory(inventory) {
    this.inventoryOpen = true;
    document.getElementById("inventory-screen").classList.remove("hidden");
    this.renderInventory(inventory);
  }

  closeInventory(inventory) {
    this.inventoryOpen = false;
    inventory.clearCursor();
    document.getElementById("inventory-screen").classList.add("hidden");
  }

  toggleInventory(inventory) {
    if (this.inventoryOpen) this.closeInventory(inventory);
    else this.openInventory(inventory);
  }

  renderInventory(inventory) {
    this.invGrid.innerHTML = "";
    this.invHotbar.innerHTML = "";

    for (let i = 0; i < inventory.slots.length; i++) {
      this.invGrid.appendChild(this.makeInvSlot("inv", i, inventory.slots[i], inventory));
    }
    for (let i = 0; i < inventory.hotbar.length; i++) {
      this.invHotbar.appendChild(this.makeInvSlot("hot", i, inventory.hotbar[i], inventory));
    }
  }

  makeInvSlot(type, index, item, inventory) {
    const el = document.createElement("div");
    el.className = "inv-slot";
    if (
      inventory.cursor &&
      inventory.cursor.type === type &&
      inventory.cursor.index === index
    ) {
      el.classList.add("active");
    }
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    el.appendChild(canvas);
    this.drawIcon(canvas, item.id);
    if (item.count > 1) {
      const c = document.createElement("span");
      c.className = "count";
      c.textContent = String(item.count);
      el.appendChild(c);
    }
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      inventory.clickSlot(type, index);
      this.renderInventory(inventory);
      this.updateHotbar(inventory);
    });
    return el;
  }
}
