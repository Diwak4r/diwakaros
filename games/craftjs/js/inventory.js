/**
 * Hotbar + inventory management (creative-style with stacks).
 */

import { AIR, BLOCKS, CREATIVE_HOTBAR, CREATIVE_PALETTE, getBlock } from "./blocks.js";

const HOTBAR_SIZE = 9;
const INV_SIZE = 27;

export class Inventory {
  constructor() {
    this.hotbar = CREATIVE_HOTBAR.map((id) => ({ id, count: 64 }));
    this.slots = [];
    for (let i = 0; i < INV_SIZE; i++) {
      const id = CREATIVE_PALETTE[i] || AIR;
      this.slots.push(id ? { id, count: 64 } : { id: AIR, count: 0 });
    }
    // Fill remaining creative palette into inventory
    for (let i = 0; i < CREATIVE_PALETTE.length && i < INV_SIZE; i++) {
      this.slots[i] = { id: CREATIVE_PALETTE[i], count: 64 };
    }
    this.selected = 0;
    this.cursor = null; // picked slot for swap
    this.nameTimer = 0;
    this.lastName = "";
  }

  getSelected() {
    return this.hotbar[this.selected];
  }

  getSelectedId() {
    const s = this.getSelected();
    return s && s.count > 0 ? s.id : AIR;
  }

  selectIndex(i) {
    if (i < 0 || i >= HOTBAR_SIZE) return;
    this.selected = i;
    this.showName();
  }

  scroll(dir) {
    this.selected = (this.selected + dir + HOTBAR_SIZE) % HOTBAR_SIZE;
    this.showName();
  }

  selectBlock(id) {
    if (!id || id === AIR || !BLOCKS[id]) return;
    // Find in hotbar
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      if (this.hotbar[i].id === id) {
        this.selected = i;
        this.showName();
        return;
      }
    }
    // Replace current
    this.hotbar[this.selected] = { id, count: 64 };
    this.showName();
  }

  addItem(id, count = 1) {
    if (!id || id === AIR) return false;
    // Stack into hotbar first
    for (const slot of this.hotbar) {
      if (slot.id === id && slot.count < 64) {
        const add = Math.min(64 - slot.count, count);
        slot.count += add;
        count -= add;
        if (count <= 0) return true;
      }
    }
    for (const slot of this.slots) {
      if (slot.id === id && slot.count < 64) {
        const add = Math.min(64 - slot.count, count);
        slot.count += add;
        count -= add;
        if (count <= 0) return true;
      }
    }
    // Empty slot
    for (const slot of this.hotbar) {
      if (!slot.id || slot.id === AIR || slot.count === 0) {
        slot.id = id;
        slot.count = Math.min(64, count);
        return true;
      }
    }
    for (const slot of this.slots) {
      if (!slot.id || slot.id === AIR || slot.count === 0) {
        slot.id = id;
        slot.count = Math.min(64, count);
        return true;
      }
    }
    return false;
  }

  showName() {
    const id = this.getSelectedId();
    this.lastName = id ? getBlock(id).name : "";
    this.nameTimer = 2.0;
  }

  update(dt) {
    if (this.nameTimer > 0) this.nameTimer -= dt;
  }

  /** Swap inventory UI slots. type: 'inv' | 'hot' */
  clickSlot(type, index) {
    const arr = type === "hot" ? this.hotbar : this.slots;
    if (index < 0 || index >= arr.length) return;

    if (!this.cursor) {
      if (arr[index].count > 0 && arr[index].id !== AIR) {
        this.cursor = { type, index, item: { ...arr[index] } };
      }
    } else {
      const fromArr = this.cursor.type === "hot" ? this.hotbar : this.slots;
      const from = fromArr[this.cursor.index];
      const to = arr[index];

      // swap
      const tmp = { ...to };
      to.id = this.cursor.item.id;
      to.count = this.cursor.item.count;
      from.id = tmp.id;
      from.count = tmp.count;
      this.cursor = null;
      this.showName();
    }
  }

  clearCursor() {
    this.cursor = null;
  }
}
