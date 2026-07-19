# CraftJS — Minecraft Clone (HTML + Three.js)

A detailed browser Minecraft-style voxel game built with **vanilla JS** and **Three.js**.

## Features

- **Chunked infinite world** (16×96×16 chunks, streaming load/unload)
- **Terrain generation** with biomes: plains, forest, desert, mountains, snow, beach, ocean
- **Caves, ores** (coal, iron, gold, diamond), trees, cacti, pumpkins
- **27 block types** with procedural 16×16 Minecraft-style textures
- **First-person controls** with pointer lock, sprint, crouch, jump
- **Physics**: gravity, AABB collision, fall damage, swimming
- **Mine & place** blocks with break stages, raycast targeting, selection outline
- **Hotbar + inventory** (E), pick-block (MMB), scroll/number select
- **Day/night cycle** with sun, moon, stars, sky colors, fog
- **Creative fly** (F or double-tap Space)
- **HUD**: hearts, hunger, XP bar, crosshair, F3 debug overlay
- **Web Audio** SFX (no external assets)

## How to run

ES modules require a local HTTP server (not `file://`).

```bash
cd minecraft-clone
npx --yes serve .
# or: python -m http.server 8080
```

Open the URL shown (e.g. `http://localhost:3000`).

## Controls

| Input | Action |
|--------|--------|
| W A S D | Move |
| Mouse | Look |
| Space | Jump / fly up |
| Shift | Crouch / fly down |
| Ctrl | Sprint |
| LMB | Break block |
| RMB | Place block |
| MMB | Pick block |
| 1–9 / Scroll | Hotbar |
| E | Inventory |
| F / double-Space | Toggle fly |
| F3 | Debug info |
| Esc | Pause |

## Project structure

```
minecraft-clone/
  index.html
  css/style.css
  js/
    main.js        # game loop, renderer, day/night
    world.js       # terrain, chunks, raycast
    chunk.js       # mesh building (face-culled)
    player.js      # movement, collision, mining
    blocks.js      # block registry
    textures.js    # procedural atlas
    noise.js       # Perlin noise
    inventory.js
    ui.js
    audio.js
```

## Tech notes

- Three.js r170 (CDN import map)
- Face-culled chunk meshes with vertex colors for simple AO/shading
- DDA voxel raycast for targeting
- No external texture packs — all textures are canvas-generated

## License

For learning / personal use. Minecraft is a trademark of Mojang/Microsoft — this is an independent fan project.
