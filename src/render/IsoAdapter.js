/**
 * IsoAdapter.js
 *
 * Wraps the Phaser isometric scene and presents the same interface
 * as Renderer.js so Engine.js needs zero changes to switch renderers.
 *
 * Drop-in replacement:
 *   const renderer = new IsoAdapter(canvas);   // instead of new Renderer(canvas)
 *
 * The adapter handles:
 *   - render(world, entities)  — main render call from Engine loop
 *   - camera.centerOn(x, y)    — follow player
 *   - camera.screenToWorld()   — click → world tile
 *   - canvas event listeners   — pointer, wheel, keyboard
 *   - All renderer.xxx = yyy   — property assignments from Engine
 */

// ── Isometric constants ───────────────────────────────────────────────────
const TILE_W      = 128;
const TILE_H      = 64;
const TILE_W_HALF = 64;
const TILE_H_HALF = 32;
const CHAR_SIZE   = 64;
const DIRS        = ["S","SW","W","NW","N","NE","E","SE"];

// ── Coordinate helpers ────────────────────────────────────────────────────
function isoToScreen(tx, ty) {
  return {
    x: (tx - ty) * TILE_W_HALF,
    y: (tx + ty) * TILE_H_HALF
  };
}

function screenToIso(sx, sy) {
  return {
    x: Math.floor((sx / TILE_W_HALF + sy / TILE_H_HALF) / 2),
    y: Math.floor((sy / TILE_H_HALF - sx / TILE_W_HALF) / 2)
  };
}

function depthOf(tx, ty) {
  return (tx + ty) * 1000;
}

function vecToDir(dx, dy) {
  if (dx === 0 && dy === 0) return "S";
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  const dirs  = ["E","SE","S","SW","W","NW","N","NE"];
  return dirs[Math.round(((angle + 360) % 360) / 45) % 8];
}

// ── Tile type → texture key ───────────────────────────────────────────────
const TILE_KEYS = {
  0:  "tile_grass",
  1:  "tile_grass",   // will differentiate with proper assets
  2:  "tile_water",
  3:  "tile_dirt",
  4:  "tile_grass",
  5:  "tile_path",
  6:  "tile_path",
  7:  "tile_stone",
  8:  "tile_stone",
  9:  "tile_grass",
  10: "tile_grass",
  11: "tile_water",
  12: "tile_stone",
  default: "tile_grass"
};

function tileKey(tileId) {
  return TILE_KEYS[tileId] ?? TILE_KEYS.default;
}

// ── Class → texture key ───────────────────────────────────────────────────
function charKey(classId) {
  const map = {
    fighter:     "char_fighter",
    ranger:      "char_ranger",
    paladin:     "char_paladin",
    rogue:       "char_fighter",
    wizard:      "char_paladin",
    goblinMelee: "mob_goblin",
    goblinArcher:"mob_goblin",
    skeleton:    "mob_skeleton",
    zombie:      "mob_goblin",
    wraith:      "mob_skeleton",
    necromancer: "mob_skeleton",
    lich:        "mob_skeleton",
  };
  return map[classId] ?? "char_fighter";
}

// ─────────────────────────────────────────────────────────────────────────
// IsoCamera — mirrors Camera.js interface for Engine compatibility
// ─────────────────────────────────────────────────────────────────────────
class IsoCamera {
  constructor(scene) {
    this._scene  = scene;
    this.x       = 0;   // world tile x (camera center)
    this.y       = 0;   // world tile y
    this.tileSize = TILE_W; // for compatibility
    this.zoomStep = 0.1;
  }

  centerOn(tx, ty, world) {
    this.x = tx;
    this.y = ty;
    if (!this._scene?.cameras?.main) return;
    const { x, y } = isoToScreen(tx, ty);
    // Use lerp for smooth camera follow instead of instant snap
    const cam    = this._scene.cameras.main;
    const cx     = cam.scrollX + cam.width  / 2;
    const cy     = cam.scrollY + cam.height / 2;
    const lerpX  = cx + (x - cx) * 0.12;
    const lerpY  = cy + (y - cy) * 0.12;
    cam.centerOn(lerpX, lerpY);
  }

  screenToWorld(sx, sy) {
    if (!this._scene) return { x: 0, y: 0 };
    // sx/sy are already in Phaser canvas coords (from our _fireCanvasEvent)
    const world = this._scene.cameras.main.getWorldPoint(sx, sy);
    const iso   = screenToIso(world.x, world.y);
    return { x: iso.tx ?? iso.x, y: iso.ty ?? iso.y };
  }

  worldToScreen(tx, ty) {
    if (!this._scene) return { sx: 0, sy: 0 };
    const iso    = isoToScreen(tx, ty);
    const cam    = this._scene.cameras.main;
    const scaleX = this._scene.scale.width  / cam.width;
    const scaleY = this._scene.scale.height / cam.height;
    return {
      sx: (iso.x - cam.scrollX) * cam.zoom,
      sy: (iso.y - cam.scrollY) * cam.zoom
    };
  }

  zoom(delta, ax, ay, renderer) {
    if (!this._scene) return;
    const cam     = this._scene.cameras.main;
    const newZoom = Phaser.Math.Clamp(cam.zoom + delta, 0.5, 2.5);
    cam.setZoom(newZoom);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// IsoAdapter — main class, presented to Engine as "renderer"
// ─────────────────────────────────────────────────────────────────────────
export class IsoAdapter {
  constructor(existingCanvas) {
    // ── Properties Engine sets directly ──────────────────────────────────
    this.player          = null;
    this.currentTarget   = null;
    this.combatLog       = null;
    this.animSystem      = null;
    this.effectSystem    = null;
    this.abilities       = {};
    this.playerAbilities = [];
    this.itemDefs        = {};
    this.chunkLayer      = null; // not used — Phaser handles tiles

    // ── Internal state ────────────────────────────────────────────────────
    this._scene          = null;
    this._ready          = false;
    this._pendingWorld   = null; // world queued before Phaser ready
    this._tileCache      = new Map();
    this._entitySprites  = new Map();
    this._prevPositions  = new Map();
    this._phaserGame     = null;
    this._eventListeners = [];
    this._lastWorld      = null;
    this._world          = null;

    // ── Fake canvas for Engine event listeners ────────────────────────────
    this.canvas = this._makeFakeCanvas();

    // ── Camera ────────────────────────────────────────────────────────────
    this.camera = new IsoCamera(null);

    // ── Launch Phaser (deferred to next tick so DOM is stable) ────────────
    setTimeout(() => this._launch(existingCanvas), 100);
  }

  // ── Phaser launch ─────────────────────────────────────────────────────────

  _launch(existingCanvas) {
    // Replace the existing canvas with Phaser
    // Phaser will inject its own canvas into the same parent
    const parent = existingCanvas?.parentElement ?? document.body;

    if (existingCanvas) {
      existingCanvas.style.display = "none";
    }

    // Create a dedicated container for Phaser so it doesn't conflict with UI
    const container = document.createElement("div");
    container.id    = "phaser-container";
    container.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:1",       // behind UI (z-index:100+) but above background
      "pointer-events:auto"
    ].join(";");
    document.body.insertBefore(container, document.body.firstChild);

    const w = window.innerWidth;
    const h = window.innerHeight;

    try {
      this._phaserGame = new Phaser.Game({
        type:            Phaser.AUTO,
        width:           w,
        height:          h,
        backgroundColor: "#1a1008",
        parent:          container,
        scene:           this._makeScene(),
        scale: {
          mode:       Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH
        }
      });
    } catch(e) {
      console.error("[IsoAdapter] Phaser launch failed:", e);
    }
  }

  _makeScene() {
    const adapter = this;

    return class GameIsoScene extends Phaser.Scene {
      constructor() { super({ key: "GameIsoScene" }); }

      preload() {
        try {
          adapter._loadPlaceholders(this);
        } catch(e) {
          console.error("[IsoAdapter] Preload error:", e);
        }
      }

      create() {
        try {
        adapter._scene = this;
        adapter.camera._scene = this;

        // ── Camera settings ───────────────────────────────────────────────
        this.cameras.main.setZoom(1.0);
        this.cameras.main.setBackgroundColor("#1a1008");

        // ── Register animations ───────────────────────────────────────────
        adapter._registerAllAnims(this);

        // ── Input → forward to Engine via fake canvas ─────────────────────
        this.input.on("pointerdown", (ptr) => {
          // Debounce — prevent multiple fires per click
          const now = Date.now();
          if (now - (adapter._lastClick ?? 0) < 100) return;
          adapter._lastClick = now;
          adapter._fireCanvasEvent("pointerdown", ptr.x, ptr.y, { button: ptr.event?.button ?? 0 });
        });

        this.input.on("wheel", (ptr, objs, dx, dy) => {
          adapter._fireCanvasEvent("wheel", ptr.x, ptr.y, { deltaY: dy });
        });

        // Keyboard — Engine listens on window directly so no forwarding needed
        // Just make sure Phaser doesn't consume key events exclusively
        this.input.keyboard.enabled = true;

        adapter._ready = true;
        console.log("[IsoAdapter] Phaser scene ready");

        // Flush world queued before Phaser was ready
        if (adapter._pendingWorld) {
          adapter._drawWorld(adapter._pendingWorld);
          adapter._lastWorld    = adapter._pendingWorld;
          adapter._pendingWorld = null;
        }
        } catch(e) {
          console.error("[IsoAdapter] Scene create error:", e);
        }
      }

      update(time, delta) {
        // Depth sort all game objects every frame
        if (adapter._ready) {
          adapter._depthSort(this);
        }
      }
    };
  }

  // ── Main render call (called by Engine every frame) ───────────────────────

  render(world, entities = []) {
    if (!this._ready || !this._scene) {
      // Queue world for when Phaser is ready
      if (world) this._pendingWorld = world;
      return;
    }

    // Flush pending world if we just became ready
    if (this._pendingWorld && this._pendingWorld !== this._lastWorld) {
      this._drawWorld(this._pendingWorld);
      this._lastWorld   = this._pendingWorld;
      this._pendingWorld = null;
    }

    // ── Draw world tiles (only once per world load) ──────────────────────
    if (world && world !== this._lastWorld) {
      this._drawWorld(world);
      this._lastWorld = world;
    }

    // Skip entity updates if scene not ready
    if (!this._ready || !this._scene) return;

    // Stream tiles only when player moves to a new chunk position
    // NOT every frame — tiles are permanent once drawn
    if (this.player) {
      const px = Math.floor(this.player.x);
      const py = Math.floor(this.player.y);
      const chunkX = Math.floor(px / 10);
      const chunkY = Math.floor(py / 10);
      const chunkKey = `${chunkX},${chunkY}`;
      if (chunkKey !== this._lastChunk) {
        this._lastChunk = chunkKey;
        this._updateVisibleTiles(px, py);
      }
    }

    // ── Update entity sprites ─────────────────────────────────────────────
    const activeIds = new Set();

    // Player
    if (this.player) {
      this._updateSprite(this.player, "player");
      activeIds.add("player");
    }

    // All entities (NPCs, remote players, corpses) — skip player (drawn above)
    for (const entity of entities) {
      if (!entity || entity === this.player) continue; // skip player duplicate
      if (!entity.id) continue;
      try {
        if (entity.type === "corpse") {
          this._updateCorpse(entity);
        } else {
          this._updateSprite(entity, entity.id);
        }
        activeIds.add(entity.id);
      } catch(e) {
        console.warn("[IsoAdapter] Entity render error:", entity.id, e.message);
      }
    }

    // Remove sprites for entities no longer in the world
    for (const [id] of this._entitySprites) {
      if (!activeIds.has(id)) {
        this._removeSprite(id);
      }
    }

    // Cap active sprites to prevent memory leak
    if (this._entitySprites.size > 200) {
      console.warn("[IsoAdapter] Too many sprites — possible leak");
    }

    // ── HUD — drawn on Phaser UI camera (fixed position) ─────────────────
    this._updateHUD();
  }

  // ── World tile rendering ──────────────────────────────────────────────────

  _drawWorld(world) {
    if (!world?.tiles || !world.width) return;
    console.log(`[IsoAdapter] Drawing world ${world.width}x${world.height}`);

    // Clear existing tiles
    for (const img of this._tileCache.values()) img.destroy();
    this._tileCache.clear();
    this._lastChunk = null; // reset chunk tracker

    this._world = world;

    // Draw initial chunk around spawn point (world center as fallback)
    // Player position not known yet — will be updated on first move
    const spawnX = this.player?.x ?? Math.floor(world.width  / 2);
    const spawnY = this.player?.y ?? Math.floor(world.height / 2);
    this._updateVisibleTiles(Math.floor(spawnX), Math.floor(spawnY));

    console.log(`[IsoAdapter] Drew ${this._tileCache.size} initial tiles`);
  }

  // Kept for compatibility — use _updateVisibleTiles for batched loading
  _drawChunk(world, x0, y0, x1, y1) {
    this._world = world;
    this._updateVisibleTiles(
      Math.floor((x0 + x1) / 2),
      Math.floor((y0 + y1) / 2)
    );
  }

  // Stream tiles around player — batched across frames to prevent blocking
  _updateVisibleTiles(playerX, playerY) {
    if (!this._world) return;
    const W     = this._world.width;
    const H     = this._world.height;
    const RANGE = 22;
    const x0    = Math.max(0, playerX - RANGE);
    const y0    = Math.max(0, playerY - RANGE);
    const x1    = Math.min(W, playerX + RANGE);
    const y1    = Math.min(H, playerY + RANGE);

    // Build list of only tiles not yet drawn
    const todo = [];
    for (let ty = y0; ty < y1; ty++) {
      for (let tx = x0; tx < x1; tx++) {
        if (!this._tileCache.has(`${tx},${ty}`)) {
          todo.push([tx, ty]);
        }
      }
    }

    if (!todo.length) return;

    // Cancel any in-progress batch
    if (this._tileBatchId) {
      cancelAnimationFrame(this._tileBatchId);
      this._tileBatchId = null;
    }

    // Draw in batches of 80 tiles per frame — smooth, no blocking
    const BATCH = 80;
    let   idx   = 0;

    const drawBatch = () => {
      if (!this._world || !this._scene) return;
      const end = Math.min(idx + BATCH, todo.length);
      for (; idx < end; idx++) {
        const [tx, ty] = todo[idx];
        const key2 = `${tx},${ty}`;
        if (this._tileCache.has(key2)) continue;
        const tileId    = Array.isArray(this._world.tiles[ty])
          ? this._world.tiles[ty][tx]
          : this._world.tiles[ty * this._world.width + tx];
        const texKey    = tileKey(tileId ?? 0);
        const { x, y }  = isoToScreen(tx, ty);
        const img       = this._scene.add.image(x, y, texKey);
        img.setOrigin(0.5, 0.5);
        img.setDepth(depthOf(tx, ty) - 1);
        this._tileCache.set(key2, img);
      }
      if (idx < todo.length) {
        this._tileBatchId = requestAnimationFrame(drawBatch);
      } else {
        this._tileBatchId = null;
      }
    };

    this._tileBatchId = requestAnimationFrame(drawBatch);
  }

  // ── Entity sprite management ──────────────────────────────────────────────

  _updateSprite(entity, id) {
    if (!entity || !id) return;
    if (entity.dead && entity.type !== "corpse") {
      this._removeSprite(id);
      return;
    }

    const tx  = Math.floor(entity.x ?? 0);
    const ty  = Math.floor(entity.y ?? 0);
    if (isNaN(tx) || isNaN(ty)) return; // skip entities with bad coords
    const key = charKey(entity.classId ?? entity.type);
    const { x, y } = isoToScreen(tx, ty);

    let entry = this._entitySprites.get(id);

    if (!entry) {
      // Create new sprite
      const sprite = this._scene.add.sprite(x, y, key, 0);
      sprite.setOrigin(0.5, 0.85);
      sprite.setDepth(depthOf(tx, ty) + 5);

      // Name label
      const isPlayer = id === "player";
      const label = this._scene.add.text(x, y - CHAR_SIZE * 0.9, entity.name ?? "", {
        fontFamily:      "monospace",
        fontSize:        isPlayer ? "13px" : "11px",
        color:           isPlayer ? "#e8c84a" : "#ffffff",
        stroke:          "#000000",
        strokeThickness: 3
      }).setOrigin(0.5, 1).setDepth(depthOf(tx, ty) + 10);

      // HP bar (for NPCs)
      let hpBar = null;
      if (entity.type === "npc") {
        hpBar = this._scene.add.graphics();
        hpBar.setDepth(depthOf(tx, ty) + 9);
      }

      // Target indicator
      let targetRing = null;
      if (entity.type === "npc") {
        targetRing = this._scene.add.ellipse(x, y, 40, 16, 0xffcc00, 0);
        targetRing.setStrokeStyle(2, 0xffcc00, 0);
        targetRing.setDepth(depthOf(tx, ty) - 0.5);
      }

      entry = { sprite, label, hpBar, targetRing, tx, ty, key };
      this._entitySprites.set(id, entry);

      // Start idle animation
      const animKey = `${key}_idle_S`;
      if (this._scene.anims.exists(animKey)) {
        sprite.play(animKey, true);
      }
    }

    // ── Update position ───────────────────────────────────────────────────
    const prev    = this._prevPositions.get(id);
    const moved   = prev && (prev.x !== tx || prev.y !== ty);
    const dir     = moved ? vecToDir(tx - prev.x, ty - prev.y) : null;

    this._prevPositions.set(id, { x: tx, y: ty });

    // Tween to new position smoothly
    if (moved) {
      this._scene.tweens.add({
        targets:  [entry.sprite, entry.label],
        duration: 80,
        ease:     "Linear",
        onUpdate: () => {
          entry.sprite.setX(x);
          entry.sprite.setY(y);
          if (entry.label) {
            entry.label.setX(x);
            entry.label.setY(y - CHAR_SIZE * 0.9);
          }
        }
      });

      // Switch to walk animation
      const animKey = `${key}_walk_${dir ?? "S"}`;
      if (this._scene.anims.exists(animKey)) {
        entry.sprite.play(animKey, true);
      }
    } else {
      entry.sprite.setX(x);
      entry.sprite.setY(y);
      if (entry.label) {
        entry.label.setX(x);
        entry.label.setY(y - CHAR_SIZE * 0.9);
      }

      // Return to idle if not moving
      const animKey = `${key}_idle_${entry.lastDir ?? "S"}`;
      if (this._scene.anims.exists(animKey) &&
          !entry.sprite.anims.currentAnim?.key.includes("walk")) {
        // only switch if currently in walk anim
      }
    }

    if (dir) entry.lastDir = dir;

    // ── Update depth ──────────────────────────────────────────────────────
    const depth = depthOf(tx, ty);
    entry.sprite.setDepth(depth + 5);
    entry.label?.setDepth(depth + 10);

    // ── HP bar ────────────────────────────────────────────────────────────
    if (entry.hpBar && entity.hp !== undefined && entity.maxHp) {
      const g    = entry.hpBar;
      const barW = 40;
      const barH = 4;
      const bx   = x - barW / 2;
      const by   = y - CHAR_SIZE * 0.95;
      const pct  = Math.max(0, entity.hp / entity.maxHp);

      g.clear();
      g.fillStyle(0x000000, 0.7);
      g.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
      g.fillStyle(0x222222, 1);
      g.fillRect(bx, by, barW, barH);
      g.fillStyle(pct > 0.5 ? 0x44bb44 : pct > 0.25 ? 0xddaa00 : 0xcc2222, 1);
      g.fillRect(bx, by, Math.floor(barW * pct), barH);
      g.setDepth(depth + 9);
    }

    // ── Target ring ───────────────────────────────────────────────────────
    if (entry.targetRing) {
      const isTarget = this.currentTarget?.id === entity.id;
      entry.targetRing.setX(x);
      entry.targetRing.setY(y);
      entry.targetRing.setDepth(depth - 0.5);
      if (isTarget) {
        entry.targetRing.setStrokeStyle(2, 0xffcc00, 0.9);
      } else {
        entry.targetRing.setStrokeStyle(2, 0xffcc00, 0);
      }
    }

    entry.tx = tx;
    entry.ty = ty;
  }

  _updateCorpse(entity) {
    // Simple grey X marker for corpses
    const { x, y } = isoToScreen(entity.x, entity.y);
    if (!this._entitySprites.has(entity.id)) {
      const marker = this._scene.add.text(x, y, "†", {
        fontFamily: "serif",
        fontSize:   "28px",
        color:      "#888866",
        stroke:     "#000",
        strokeThickness: 2
      }).setOrigin(0.5, 0.75).setDepth(depthOf(entity.x, entity.y) + 1);
      this._entitySprites.set(entity.id, { sprite: marker, label: null, hpBar: null, targetRing: null });
    }
  }

  _removeSprite(id) {
    const entry = this._entitySprites.get(id);
    if (!entry) return;
    entry.sprite?.destroy();
    entry.label?.destroy();
    entry.hpBar?.destroy();
    entry.targetRing?.destroy();
    this._entitySprites.delete(id);
    this._prevPositions.delete(id);
  }

  // ── Depth sort ────────────────────────────────────────────────────────────

  _depthSort(scene) {
    // Phaser handles depth via setDepth — no manual sort needed
    // but we update entity depths each frame to handle movement
  }

  // ── HUD ───────────────────────────────────────────────────────────────────

  _updateHUD() {
    // HUD is rendered by the existing HTML overlay system
    // Phaser handles the world; HTML handles UI
    // No action needed here for now
  }

  // ── Placeholder asset loading ─────────────────────────────────────────────

  _loadPlaceholders(scene) {
    const makeTile = (fillTop, fillLeft, fillRight, stroke) => {
      const c   = document.createElement("canvas");
      c.width   = TILE_W;
      c.height  = TILE_H + 20;
      const ctx = c.getContext("2d");
      // Top face
      ctx.beginPath();
      ctx.moveTo(TILE_W_HALF, 0);
      ctx.lineTo(TILE_W, TILE_H_HALF);
      ctx.lineTo(TILE_W_HALF, TILE_H);
      ctx.lineTo(0, TILE_H_HALF);
      ctx.closePath();
      ctx.fillStyle = fillTop; ctx.fill();
      // Left face
      ctx.beginPath();
      ctx.moveTo(0, TILE_H_HALF);
      ctx.lineTo(TILE_W_HALF, TILE_H);
      ctx.lineTo(TILE_W_HALF, TILE_H + 16);
      ctx.lineTo(0, TILE_H_HALF + 16);
      ctx.closePath();
      ctx.fillStyle = fillLeft; ctx.fill();
      // Right face
      ctx.beginPath();
      ctx.moveTo(TILE_W_HALF, TILE_H);
      ctx.lineTo(TILE_W, TILE_H_HALF);
      ctx.lineTo(TILE_W, TILE_H_HALF + 16);
      ctx.lineTo(TILE_W_HALF, TILE_H + 16);
      ctx.closePath();
      ctx.fillStyle = fillRight; ctx.fill();
      // Outline
      ctx.beginPath();
      ctx.moveTo(TILE_W_HALF, 0);
      ctx.lineTo(TILE_W, TILE_H_HALF);
      ctx.lineTo(TILE_W_HALF, TILE_H);
      ctx.lineTo(0, TILE_H_HALF);
      ctx.closePath();
      ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke();
      return c;
    };

    const makeChar = (color) => {
      const FRAMES = 4, DIRS = 8;
      const c   = document.createElement("canvas");
      c.width   = FRAMES * CHAR_SIZE;
      c.height  = DIRS   * CHAR_SIZE;
      const ctx = c.getContext("2d");
      for (let dir = 0; dir < DIRS; dir++) {
        for (let f = 0; f < FRAMES; f++) {
          const x   = f * CHAR_SIZE;
          const y   = dir * CHAR_SIZE;
          const bob = Math.sin(f * Math.PI / 2) * 2;
          // Shadow
          ctx.fillStyle = "rgba(0,0,0,0.25)";
          ctx.beginPath();
          ctx.ellipse(x+32, y+56, 14, 5, 0, 0, Math.PI*2);
          ctx.fill();
          // Body
          ctx.fillStyle = color;
          ctx.fillRect(x+20, y+28+bob, 24, 22);
          // Head
          ctx.beginPath();
          ctx.arc(x+32, y+22+bob, 11, 0, Math.PI*2);
          ctx.fill();
          // Shine
          ctx.fillStyle = "rgba(255,255,255,0.2)";
          ctx.beginPath();
          ctx.arc(x+28, y+18+bob, 5, 0, Math.PI*2);
          ctx.fill();
        }
      }
      return c;
    };

    // Add tile textures
    const tiles = {
      tile_grass: makeTile("#5a8a3a","#3a6a1a","#2a5a0a","#4a7a2a"),
      tile_stone: makeTile("#888880","#555550","#444440","#666660"),
      tile_path:  makeTile("#b8a878","#907850","#806840","#a09060"),
      tile_water: makeTile("#3a5aaa","#1a3a8a","#0a2a7a","#2a4a9a"),
      tile_dirt:  makeTile("#8a6040","#6a4020","#5a3010","#7a5030"),
    };
    for (const [key, canvas] of Object.entries(tiles)) {
      scene.textures.addCanvas(key, canvas);
    }

    // Add character textures with frame data
    const chars = {
      char_fighter: makeChar("#cc3322"),
      char_ranger:  makeChar("#2a8a2a"),
      char_paladin: makeChar("#2244cc"),
      mob_goblin:   makeChar("#4a8a2a"),
      mob_skeleton: makeChar("#ccccaa"),
    };
    for (const [key, canvas] of Object.entries(chars)) {
      scene.textures.addCanvas(key, canvas);
      const tex = scene.textures.get(key);
      for (let dir = 0; dir < 8; dir++) {
        for (let f = 0; f < 4; f++) {
          tex.add(dir * 4 + f, 0, f * CHAR_SIZE, dir * CHAR_SIZE, CHAR_SIZE, CHAR_SIZE);
        }
      }
    }
  }

  // ── Animation registration ────────────────────────────────────────────────

  _registerAllAnims(scene) {
    const keys  = ["char_fighter","char_ranger","char_paladin","mob_goblin","mob_skeleton"];
    const anims = {
      idle: { frames: [0,1,2,3], rate: 4,  repeat: -1 },
      walk: { frames: [0,1,2,3], rate: 8,  repeat: -1 }, // same frames for now
    };

    for (const key of keys) {
      for (let dir = 0; dir < 8; dir++) {
        const dirName = DIRS[dir];
        for (const [action, def] of Object.entries(anims)) {
          const animKey = `${key}_${action}_${dirName}`;
          if (scene.anims.exists(animKey)) continue;
          scene.anims.create({
            key:       animKey,
            frames:    def.frames.map(f => ({ key, frame: dir * 4 + f })),
            frameRate: def.rate,
            repeat:    def.repeat
          });
        }
      }
    }
  }

  // ── Fake canvas for Engine event listeners ────────────────────────────────
  // Engine registers pointerdown/wheel on renderer.canvas
  // We store those handlers and call them manually from Phaser input

  _makeFakeCanvas() {
    // Virtual canvas — NOT added to DOM to prevent event bubbling issues
    const fake = document.createElement("canvas");
    fake.width  = window.innerWidth;
    fake.height = window.innerHeight;

    const listeners = this._eventListeners = [];
    fake.addEventListener = (type, fn, opts) => {
      listeners.push({ type, fn });
    };
    fake.removeEventListener = (type, fn) => {
      const idx = listeners.findIndex(l => l.type === type && l.fn === fn);
      if (idx >= 0) listeners.splice(idx, 1);
    };
    fake.getBoundingClientRect = () => ({
      left: 0, top: 0,
      width: window.innerWidth,
      height: window.innerHeight
    });

    return fake;
  }

  _fireCanvasEvent(type, clientX, clientY, extra = {}) {
    // Build an event that Engine can read offsetX/Y and clientX/Y from
    const rect  = { left: 0, top: 0 };
    const event = {
      button:   0,
      clientX,
      clientY,
      offsetX:  clientX,
      offsetY:  clientY,
      deltaY:   extra.deltaY ?? 0,
      preventDefault: () => {},
      ...extra
    };
    for (const { type: t, fn } of this._eventListeners) {
      if (t === type) {
        try { fn(event); } catch(e) { console.warn("[IsoAdapter] Event handler error:", e); }
      }
    }
  }

  // ── Ability bar / HUD helpers (Engine sets these) ─────────────────────────
  // These are no-ops — the HTML overlay handles HUD rendering

  getAbilitySlotAt(px, py)  { return -1; }
  getQuickSlotAt(px, py)    { return -1; }
  getBagIconHit(px, py)     { return false; }

  // ── Public effect methods ─────────────────────────────────────────────────

  flashEntity(id, color = 0xff4444) {
    const entry = this._entitySprites.get(id);
    if (!entry?.sprite) return;
    entry.sprite.setTintFill(color);
    this._scene?.time.delayedCall(150, () => entry.sprite?.clearTint());
  }

  shakeCamera() {
    this._scene?.cameras.main.shake(200, 0.01);
  }

  damageNumber(tx, ty, amount) {
    if (!this._scene) return;
    const { x, y } = isoToScreen(tx, ty);
    const t = this._scene.add.text(x, y - 40, `-${amount}`, {
      fontFamily: "monospace", fontSize: "16px",
      color: "#ff4444", stroke: "#000", strokeThickness: 3
    }).setOrigin(0.5, 1).setDepth(99999);
    this._scene.tweens.add({
      targets: t, y: y - 80, alpha: 0, duration: 700,
      onComplete: () => t.destroy()
    });
  }

  healNumber(tx, ty, amount) {
    if (!this._scene) return;
    const { x, y } = isoToScreen(tx, ty);
    const t = this._scene.add.text(x, y - 40, `+${amount}`, {
      fontFamily: "monospace", fontSize: "16px",
      color: "#44ff88", stroke: "#000", strokeThickness: 3
    }).setOrigin(0.5, 1).setDepth(99999);
    this._scene.tweens.add({
      targets: t, y: y - 80, alpha: 0, duration: 700,
      onComplete: () => t.destroy()
    });
  }
}
