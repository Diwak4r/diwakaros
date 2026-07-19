/**
 * Block type registry — IDs, names, properties, texture face maps.
 * Face order: [top, bottom, side] or [top, bottom, front, back, left, right]
 */

export const AIR = 0;

export const BlockID = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  COBBLE: 4,
  BEDROCK: 5,
  OAK_LOG: 6,
  OAK_LEAVES: 7,
  OAK_PLANKS: 8,
  SAND: 9,
  GRAVEL: 10,
  WATER: 11,
  GLASS: 12,
  COAL_ORE: 13,
  IRON_ORE: 14,
  GOLD_ORE: 15,
  DIAMOND_ORE: 16,
  BRICKS: 17,
  SNOW: 18,
  SNOWY_GRASS: 19,
  CACTUS: 20,
  SANDSTONE: 21,
  CLAY: 22,
  PUMPKIN: 23,
  TNT: 24,
  BOOKSHELF: 25,
  OBSIDIAN: 26,
  GLOWSTONE: 27,
};

/** Face indices for mesh builder */
export const FACE = {
  TOP: 0,
  BOTTOM: 1,
  NORTH: 2, // -Z
  SOUTH: 3, // +Z
  WEST: 4,  // -X
  EAST: 5,  // +X
};

/**
 * Each block:
 *  id, name, solid, transparent, liquid, breakTime (seconds), drops, light
 *  textures: array of texture keys for [top, bottom, north, south, west, east]
 *            or shorter forms expanded in resolveFaces()
 */
const defs = [
  {
    id: BlockID.AIR,
    name: "Air",
    solid: false,
    transparent: true,
    liquid: false,
    breakTime: 0,
    textures: ["air"],
  },
  {
    id: BlockID.GRASS,
    name: "Grass Block",
    solid: true,
    transparent: false,
    liquid: false,
    breakTime: 0.6,
    textures: ["grass_top", "dirt", "grass_side"],
  },
  {
    id: BlockID.DIRT,
    name: "Dirt",
    solid: true,
    transparent: false,
    liquid: false,
    breakTime: 0.5,
    textures: ["dirt"],
  },
  {
    id: BlockID.STONE,
    name: "Stone",
    solid: true,
    transparent: false,
    liquid: false,
    breakTime: 1.5,
    textures: ["stone"],
    drops: BlockID.COBBLE,
  },
  {
    id: BlockID.COBBLE,
    name: "Cobblestone",
    solid: true,
    transparent: false,
    liquid: false,
    breakTime: 2.0,
    textures: ["cobble"],
  },
  {
    id: BlockID.BEDROCK,
    name: "Bedrock",
    solid: true,
    transparent: false,
    liquid: false,
    breakTime: Infinity,
    textures: ["bedrock"],
  },
  {
    id: BlockID.OAK_LOG,
    name: "Oak Log",
    solid: true,
    transparent: false,
    liquid: false,
    breakTime: 2.0,
    textures: ["log_top", "log_top", "log_side"],
  },
  {
    id: BlockID.OAK_LEAVES,
    name: "Oak Leaves",
    solid: true,
    transparent: true,
    liquid: false,
    breakTime: 0.2,
    textures: ["leaves"],
  },
  {
    id: BlockID.OAK_PLANKS,
    name: "Oak Planks",
    solid: true,
    transparent: false,
    liquid: false,
    breakTime: 2.0,
    textures: ["planks"],
  },
  {
    id: BlockID.SAND,
    name: "Sand",
    solid: true,
    transparent: false,
    liquid: false,
    breakTime: 0.5,
    textures: ["sand"],
  },
  {
    id: BlockID.GRAVEL,
    name: "Gravel",
    solid: true,
    transparent: false,
    liquid: false,
    breakTime: 0.6,
    textures: ["gravel"],
  },
  {
    id: BlockID.WATER,
    name: "Water",
    solid: false,
    transparent: true,
    liquid: true,
    breakTime: Infinity,
    textures: ["water"],
  },
  {
    id: BlockID.GLASS,
    name: "Glass",
    solid: true,
    transparent: true,
    liquid: false,
    breakTime: 0.3,
    textures: ["glass"],
  },
  {
    id: BlockID.COAL_ORE,
    name: "Coal Ore",
    solid: true,
    transparent: false,
    liquid: false,
    breakTime: 3.0,
    textures: ["coal_ore"],
  },
  {
    id: BlockID.IRON_ORE,
    name: "Iron Ore",
    solid: true,
    transparent: false,
    liquid: false,
    breakTime: 3.0,
    textures: ["iron_ore"],
  },
  {
    id: BlockID.GOLD_ORE,
    name: "Gold Ore",
    solid: true,
    transparent: false,
    liquid: false,
    breakTime: 3.0,
    textures: ["gold_ore"],
  },
  {
    id: BlockID.DIAMOND_ORE,
    name: "Diamond Ore",
    solid: true,
    transparent: false,
    liquid: false,
    breakTime: 3.5,
    textures: ["diamond_ore"],
  },
  {
    id: BlockID.BRICKS,
    name: "Bricks",
    solid: true,
    transparent: false,
    liquid: false,
    breakTime: 2.0,
    textures: ["bricks"],
  },
  {
    id: BlockID.SNOW,
    name: "Snow",
    solid: true,
    transparent: false,
    liquid: false,
    breakTime: 0.2,
    textures: ["snow"],
  },
  {
    id: BlockID.SNOWY_GRASS,
    name: "Snowy Grass",
    solid: true,
    transparent: false,
    liquid: false,
    breakTime: 0.6,
    textures: ["snow", "dirt", "snow_side"],
  },
  {
    id: BlockID.CACTUS,
    name: "Cactus",
    solid: true,
    transparent: false,
    liquid: false,
    breakTime: 0.4,
    textures: ["cactus_top", "cactus_bottom", "cactus_side"],
  },
  {
    id: BlockID.SANDSTONE,
    name: "Sandstone",
    solid: true,
    transparent: false,
    liquid: false,
    breakTime: 0.8,
    textures: ["sandstone_top", "sandstone_bottom", "sandstone_side"],
  },
  {
    id: BlockID.CLAY,
    name: "Clay",
    solid: true,
    transparent: false,
    liquid: false,
    breakTime: 0.6,
    textures: ["clay"],
  },
  {
    id: BlockID.PUMPKIN,
    name: "Pumpkin",
    solid: true,
    transparent: false,
    liquid: false,
    breakTime: 1.0,
    textures: ["pumpkin_top", "pumpkin_top", "pumpkin_side", "pumpkin_side", "pumpkin_side", "pumpkin_face"],
  },
  {
    id: BlockID.TNT,
    name: "TNT",
    solid: true,
    transparent: false,
    liquid: false,
    breakTime: 0.0,
    textures: ["tnt_top", "tnt_bottom", "tnt_side"],
  },
  {
    id: BlockID.BOOKSHELF,
    name: "Bookshelf",
    solid: true,
    transparent: false,
    liquid: false,
    breakTime: 1.5,
    textures: ["planks", "planks", "bookshelf"],
  },
  {
    id: BlockID.OBSIDIAN,
    name: "Obsidian",
    solid: true,
    transparent: false,
    liquid: false,
    breakTime: 50,
    textures: ["obsidian"],
  },
  {
    id: BlockID.GLOWSTONE,
    name: "Glowstone",
    solid: true,
    transparent: false,
    liquid: false,
    breakTime: 0.3,
    light: 15,
    textures: ["glowstone"],
  },
];

export const BLOCKS = {};
for (const d of defs) {
  BLOCKS[d.id] = {
    ...d,
    faces: resolveFaces(d.textures),
    drops: d.drops !== undefined ? d.drops : d.id,
    light: d.light || 0,
  };
}

function resolveFaces(tex) {
  if (tex.length === 1) {
    return [tex[0], tex[0], tex[0], tex[0], tex[0], tex[0]];
  }
  if (tex.length === 3) {
    // top, bottom, side
    return [tex[0], tex[1], tex[2], tex[2], tex[2], tex[2]];
  }
  if (tex.length === 6) return [...tex];
  return [tex[0], tex[0], tex[0], tex[0], tex[0], tex[0]];
}

export function isSolid(id) {
  return id !== AIR && BLOCKS[id] && BLOCKS[id].solid && !BLOCKS[id].liquid;
}

export function isTransparent(id) {
  return id === AIR || (BLOCKS[id] && BLOCKS[id].transparent);
}

export function isLiquid(id) {
  return BLOCKS[id] && BLOCKS[id].liquid;
}

export function getBlock(id) {
  return BLOCKS[id] || BLOCKS[AIR];
}

/** Creative hotbar defaults */
export const CREATIVE_HOTBAR = [
  BlockID.GRASS,
  BlockID.DIRT,
  BlockID.STONE,
  BlockID.COBBLE,
  BlockID.OAK_LOG,
  BlockID.OAK_PLANKS,
  BlockID.SAND,
  BlockID.BRICKS,
  BlockID.GLASS,
];

/** Full creative inventory palette */
export const CREATIVE_PALETTE = [
  BlockID.GRASS,
  BlockID.DIRT,
  BlockID.STONE,
  BlockID.COBBLE,
  BlockID.BEDROCK,
  BlockID.OAK_LOG,
  BlockID.OAK_LEAVES,
  BlockID.OAK_PLANKS,
  BlockID.SAND,
  BlockID.GRAVEL,
  BlockID.GLASS,
  BlockID.COAL_ORE,
  BlockID.IRON_ORE,
  BlockID.GOLD_ORE,
  BlockID.DIAMOND_ORE,
  BlockID.BRICKS,
  BlockID.SNOW,
  BlockID.SNOWY_GRASS,
  BlockID.CACTUS,
  BlockID.SANDSTONE,
  BlockID.CLAY,
  BlockID.PUMPKIN,
  BlockID.TNT,
  BlockID.BOOKSHELF,
  BlockID.OBSIDIAN,
  BlockID.GLOWSTONE,
  BlockID.WATER,
];
