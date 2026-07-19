/**
 * CraftJS — Minecraft-style voxel game entry point.
 */

import * as THREE from "three";
import { createAtlas } from "./textures.js";
import { World, RENDER_DISTANCE } from "./world.js";
import { Player } from "./player.js";
import { Inventory } from "./inventory.js";
import { UI } from "./ui.js";
import { AudioManager } from "./audio.js";
import { BlockID } from "./blocks.js";

// ── DOM ──
const canvas = document.getElementById("game");
const loading = document.getElementById("loading");
const loadFill = document.getElementById("load-fill");
const loadText = document.getElementById("load-text");
const menu = document.getElementById("menu");
const pause = document.getElementById("pause");
const hud = document.getElementById("hud");

// ── Renderer ──
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x87ceeb);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = false;

// ── Scene / Camera ──
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.FogExp2(0xc8e0f0, 0.012);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.05,
  400
);

// ── Lighting ──
const ambient = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xfff5e0, 0.95);
sun.position.set(80, 120, 40);
scene.add(sun);

const hemi = new THREE.HemisphereLight(0x87ceeb, 0x3d5c2e, 0.35);
scene.add(hemi);

// Sun/moon mesh for day cycle
const sunMesh = new THREE.Mesh(
  new THREE.SphereGeometry(8, 12, 12),
  new THREE.MeshBasicMaterial({ color: 0xffee88 })
);
scene.add(sunMesh);

const moonMesh = new THREE.Mesh(
  new THREE.SphereGeometry(6, 12, 12),
  new THREE.MeshBasicMaterial({ color: 0xddeeff })
);
scene.add(moonMesh);

// Stars
const starGeo = new THREE.BufferGeometry();
const starCount = 800;
const starPos = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i++) {
  const r = 200 + Math.random() * 80;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
  starPos[i * 3 + 1] = r * Math.cos(phi);
  starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
}
starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
const stars = new THREE.Points(
  starGeo,
  new THREE.PointsMaterial({ color: 0xffffff, size: 0.8, sizeAttenuation: true, transparent: true, opacity: 0 })
);
scene.add(stars);

// Selection outline (wireframe box)
const selectGeo = new THREE.BoxGeometry(1.002, 1.002, 1.002);
const selectEdges = new THREE.EdgesGeometry(selectGeo);
const selectMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 });
const selectBox = new THREE.LineSegments(selectEdges, selectMat);
selectBox.visible = false;
scene.add(selectBox);

// Simple block break / dig particles
const particles = [];
const particleGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
function spawnBlockParticles(x, y, z, color = 0x8b5a2b, count = 12) {
  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshLambertMaterial({ color });
    const m = new THREE.Mesh(particleGeo, mat);
    m.position.set(x + 0.5 + (Math.random() - 0.5) * 0.6, y + 0.5 + (Math.random() - 0.5) * 0.6, z + 0.5 + (Math.random() - 0.5) * 0.6);
    const vel = new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 4 + 1, (Math.random() - 0.5) * 4);
    scene.add(m);
    particles.push({ mesh: m, vel, life: 0.5 + Math.random() * 0.4 });
  }
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.vel.y -= 18 * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.mesh.rotation.x += dt * 8;
    p.mesh.rotation.y += dt * 6;
    if (p.life <= 0) {
      scene.remove(p.mesh);
      p.mesh.material.dispose();
      particles.splice(i, 1);
    }
  }
}

const BLOCK_PARTICLE_COLORS = {
  1: 0x5d9b3e, 2: 0x8b5a2b, 3: 0x7a7a7a, 4: 0x6e6e6e, 6: 0x6b4f2a,
  7: 0x3c8c28, 8: 0xb28e50, 9: 0xdcd296, 13: 0x2a2a2a, 16: 0x50dce6,
};

// ── Game state ──
const SEED = (Math.random() * 1e9) | 0;
let atlas, world, player, inventory, ui, audio;
let state = "loading"; // loading | menu | playing | paused
let pointerLocked = false;
let mouseLeft = false;
let mouseRight = false;
let rightClickCooldown = 0;
let dayTime = 0.25; // 0–1, 0.25 = morning
let lastTime = performance.now();
let fps = 60;
let fpsAccum = 0;
let fpsFrames = 0;
let chunkUpdateTimer = 0;

function setLoad(p, text) {
  loadFill.style.width = `${Math.floor(p * 100)}%`;
  if (text) loadText.textContent = text;
}

async function init() {
  setLoad(0.05, "Building textures…");
  await frame();
  atlas = createAtlas();

  setLoad(0.15, "Creating world…");
  await frame();
  world = new World(scene, atlas, SEED);

  setLoad(0.2, "Generating terrain…");
  await frame();

  // Generate initial chunks with progress (async — does not freeze the tab)
  const radius = Math.min(RENDER_DISTANCE, 3);
  await world.generateInitial(radius, (p) => {
    setLoad(0.2 + p * 0.7, `Generating world… ${Math.floor(p * 100)}%`);
  });

  setLoad(0.95, "Spawning player…");
  await frame();

  player = new Player(camera, world);
  inventory = new Inventory();
  ui = new UI(atlas);
  audio = new AudioManager();

  player.spawn(0, 0);
  // Give starting items
  inventory.addItem(BlockID.OAK_PLANKS, 64);
  inventory.addItem(BlockID.GLOWSTONE, 16);
  inventory.addItem(BlockID.TNT, 8);

  ui.updateHotbar(inventory);
  ui.updatePlayerBars(player);

  setLoad(1, "Done!");
  await sleep(200);

  loading.classList.add("hidden");
  menu.classList.remove("hidden");
  state = "menu";

  bindEvents();
  requestAnimationFrame(loop);
}

function frame() {
  return new Promise((r) => requestAnimationFrame(() => r()));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function bindEvents() {
  document.getElementById("btn-play").addEventListener("click", startGame);
  document.getElementById("btn-resume").addEventListener("click", resumeGame);
  document.getElementById("btn-menu").addEventListener("click", () => {
    pause.classList.add("hidden");
    hud.classList.add("hidden");
    menu.classList.remove("hidden");
    state = "menu";
    exitPointerLock();
  });

  window.addEventListener("resize", onResize);

  document.addEventListener("pointerlockchange", () => {
    pointerLocked = document.pointerLockElement === canvas;
    if (!pointerLocked && state === "playing") {
      // Don't auto-pause if inventory open
      if (!ui.inventoryOpen) {
        pauseGame();
      }
    }
  });

  canvas.addEventListener("click", () => {
    if (state === "playing" && !ui.inventoryOpen && !pointerLocked) {
      requestPointerLock();
    }
  });

  document.addEventListener("mousemove", (e) => {
    if (state === "playing" && pointerLocked && !ui.inventoryOpen) {
      player.onMouseMove(e.movementX, e.movementY);
    }
  });

  document.addEventListener("mousedown", (e) => {
    if (state !== "playing" || ui.inventoryOpen) return;
    if (!pointerLocked) return;
    if (e.button === 0) mouseLeft = true;
    if (e.button === 2) {
      mouseRight = true;
      // place immediately
      const hit = player.getReachRay();
      player.placeBlock(hit, inventory, audio);
      rightClickCooldown = 0.25;
      ui.updateHotbar(inventory);
    }
    if (e.button === 1) {
      e.preventDefault();
      const hit = player.getReachRay();
      player.pickBlock(hit, inventory);
      ui.updateHotbar(inventory);
      audio.play("click");
    }
  });

  document.addEventListener("mouseup", (e) => {
    if (e.button === 0) {
      mouseLeft = false;
      player.cancelBreak();
    }
    if (e.button === 2) mouseRight = false;
  });

  document.addEventListener("contextmenu", (e) => e.preventDefault());

  document.addEventListener("wheel", (e) => {
    if (state !== "playing" || ui.inventoryOpen) return;
    e.preventDefault();
    inventory.scroll(e.deltaY > 0 ? 1 : -1);
    ui.updateHotbar(inventory);
    audio.play("click");
  }, { passive: false });

  document.addEventListener("keydown", (e) => {
    if (e.code === "Escape") {
      if (ui.inventoryOpen) {
        ui.closeInventory(inventory);
        if (state === "playing") requestPointerLock();
        return;
      }
      if (state === "playing") pauseGame();
      else if (state === "paused") resumeGame();
      return;
    }

    if (state === "menu" || state === "loading") return;

    // Number keys hotbar
    if (e.code.startsWith("Digit")) {
      const n = parseInt(e.code.replace("Digit", ""), 10);
      if (n >= 1 && n <= 9) {
        inventory.selectIndex(n - 1);
        ui.updateHotbar(inventory);
        audio.play("click");
      }
    }

    if (e.code === "KeyE") {
      e.preventDefault();
      if (state === "playing" || ui.inventoryOpen) {
        if (!ui.inventoryOpen) {
          exitPointerLock();
          ui.openInventory(inventory);
          audio.play("ui");
        } else {
          ui.closeInventory(inventory);
          requestPointerLock();
        }
      }
      return;
    }

    if (e.code === "KeyF" && !e.repeat) {
      player.toggleFly();
      audio.play("ui");
    }

    if (e.code === "F3") {
      e.preventDefault();
      ui.toggleDebug();
    }

    // Double-tap space for fly (also F)
    if (e.code === "Space" && !e.repeat) {
      const now = performance.now();
      if (now - player.lastSpace < 300) {
        player.toggleFly();
      }
      player.lastSpace = now;
    }

    player.setKey(e.code, true);

    // Prevent page scroll
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
      e.preventDefault();
    }
  });

  document.addEventListener("keyup", (e) => {
    player.setKey(e.code, false);
  });
}

function startGame() {
  menu.classList.add("hidden");
  pause.classList.add("hidden");
  hud.classList.remove("hidden");
  state = "playing";
  audio.ensure();
  requestPointerLock();
  lastTime = performance.now();
}

function pauseGame() {
  if (state !== "playing") return;
  state = "paused";
  pause.classList.remove("hidden");
  exitPointerLock();
  mouseLeft = false;
  mouseRight = false;
  player.cancelBreak();
}

function resumeGame() {
  pause.classList.add("hidden");
  hud.classList.remove("hidden");
  state = "playing";
  requestPointerLock();
  lastTime = performance.now();
}

function requestPointerLock() {
  canvas.requestPointerLock?.();
}

function exitPointerLock() {
  if (document.pointerLockElement) document.exitPointerLock?.();
}

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

// ── Day / night ──
function updateDayNight(dt) {
  // Full day ~ 20 minutes real time (Minecraft-ish compressed: 10 min)
  dayTime = (dayTime + dt / 600) % 1;

  // 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset
  const angle = dayTime * Math.PI * 2;
  const sunDist = 180;
  const px = player.position.x;
  const pz = player.position.z;
  const py = player.position.y;

  sunMesh.position.set(
    px + Math.cos(angle) * sunDist,
    py + Math.sin(angle) * sunDist,
    pz + 40
  );
  moonMesh.position.set(
    px - Math.cos(angle) * sunDist,
    py - Math.sin(angle) * sunDist,
    pz + 40
  );

  sun.position.copy(sunMesh.position).sub(player.position).normalize().multiplyScalar(100).add(player.position);

  // Sky colors
  const elev = Math.sin(angle); // -1..1
  const dayFactor = Math.max(0, Math.min(1, elev * 1.2 + 0.15));
  const nightFactor = 1 - dayFactor;

  const skyDay = new THREE.Color(0x87ceeb);
  const skySunset = new THREE.Color(0xff8c4a);
  const skyNight = new THREE.Color(0x0a0a1e);

  let sky = skyDay.clone();
  if (elev > -0.15 && elev < 0.25) {
    // sunrise/sunset blend
    const t = 1 - Math.abs(elev - 0.05) / 0.3;
    sky.lerp(skySunset, Math.max(0, t) * 0.7);
  }
  sky.lerp(skyNight, nightFactor);

  scene.background.copy(sky);
  scene.fog.color.copy(sky);
  renderer.setClearColor(sky);

  ambient.intensity = 0.2 + dayFactor * 0.45;
  sun.intensity = dayFactor * 1.0;
  sun.color.set(dayFactor > 0.3 ? 0xfff5e0 : 0xffaa77);
  hemi.intensity = 0.15 + dayFactor * 0.25;

  stars.material.opacity = nightFactor * 0.9;
  stars.position.copy(player.position);

  // Dim solid material at night via ambient — already handled by lights
}

// ── Main loop ──
function loop(now) {
  requestAnimationFrame(loop);

  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  fpsAccum += dt;
  fpsFrames++;
  if (fpsAccum >= 0.5) {
    fps = Math.round(fpsFrames / fpsAccum);
    fpsFrames = 0;
    fpsAccum = 0;
  }

  if (state === "playing" && !ui.inventoryOpen) {
    player.update(dt, inventory, audio);
    inventory.update(dt);

    // Chunk streaming
    chunkUpdateTimer -= dt;
    if (chunkUpdateTimer <= 0) {
      chunkUpdateTimer = 0.35;
      world.updateChunks(player.position.x, player.position.z);
    }

    // Mining
    const hit = player.getReachRay();
    if (mouseLeft) {
      player.startBreak(hit);
      const broken = player.updateBreak(dt, inventory, audio);
      if (broken) {
        const col = BLOCK_PARTICLE_COLORS[broken.id] || 0x888888;
        spawnBlockParticles(broken.x, broken.y, broken.z, col, 14);
      }
    } else {
      player.cancelBreak();
    }

    // Continuous place
    if (mouseRight) {
      rightClickCooldown -= dt;
      if (rightClickCooldown <= 0) {
        const placed = player.placeBlock(hit, inventory, audio);
        if (placed && hit.hit) {
          spawnBlockParticles(hit.placeX, hit.placeY, hit.placeZ, 0xaaaaaa, 4);
        }
        rightClickCooldown = 0.25;
      }
    }

    // Selection box
    if (hit.hit) {
      selectBox.visible = true;
      selectBox.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    } else {
      selectBox.visible = false;
    }

    // Sprint FOV punch (Minecraft-style)
    const targetFov = player.sprinting && !player.flying ? 82 : 75;
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 8);
    camera.updateProjectionMatrix();

    updateParticles(dt);
    updateDayNight(dt);

    // Underwater fog
    const eyeBlock = world.getBlock(
      Math.floor(player.eyePosition.x),
      Math.floor(player.eyePosition.y),
      Math.floor(player.eyePosition.z)
    );
    if (eyeBlock === BlockID.WATER) {
      scene.fog.density = 0.08;
      scene.fog.color.set(0x1a4a7a);
      scene.background.set(0x1a4a7a);
    } else {
      scene.fog.density = 0.012;
    }

    ui.updateHotbar(inventory);
    ui.updatePlayerBars(player);
    ui.updateBreak(player);
    ui.updateDebug(player, world, fps, hit);
  } else if (state === "playing" && ui.inventoryOpen) {
    // still render, update name timers etc
    inventory.update(dt);
    ui.updateHotbar(inventory);
  } else {
    // menu/pause — gentle day cycle idle
    updateDayNight(dt * 0.3);
  }

  // Keep stars/sun relative when paused too
  if (player) {
    stars.position.copy(player.position);
  }

  renderer.render(scene, camera);
}

// Boot
init().catch((err) => {
  console.error(err);
  loadText.textContent = "Error: " + err.message;
});
