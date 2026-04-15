/**
 * IsoRenderer.js
 *
 * Phaser 3 based isometric renderer for Realm of Echoes.
 * Replaces the Canvas 2D Renderer.js once assets are ready.
 *
 * Coordinate system:
 *   World tile (tx, ty) → Screen pixel (sx, sy):
 *     sx = (tx - ty) * TILE_W_HALF
 *     sy = (tx + ty) * TILE_H_HALF
 *
 * Tile dimensions (128x64 standard isometric 2:1 ratio):
 *   TILE_W      = 128  (full tile width)
 *   TILE_H      = 64   (full tile height)
 *   TILE_W_HALF = 64
 *   TILE_H_HALF = 32
 *
 * Character sprites: 64x64 per frame
 * Draw order: sort all entities by (tx + ty) — painter's algorithm
 */

import Phaser from "https://cdn.jsdelivr.net/npm/phaser@3.60.0/dist/phaser.esm.js";

// ── Constants ─────────────────────────────────────────────────────────────
export const TILE_W      = 128;
export const TILE_H      = 64;
export const TILE_W_HALF = TILE_W / 2;
export const TILE_H_HALF = TILE_H / 2;

export const CHAR_SIZE   = 64;  // sprite frame size

// Animation frame counts per action (will match spritesheet layout)
export const ANIM_FRAMES = {
  idle:   4,
  walk:   8,
  attack: 6,
  death:  6,
  hurt:   3
};

// 8 directions in isometric space
// Order matches standard spritesheet layout (S, SW, W, NW, N, NE, E, SE)
export const DIRECTIONS = ["S","SW","W","NW","N","NE","E","SE"];

// ── World → Screen conversion ─────────────────────────────────────────────
export function worldToScreen(tx, ty) {
  return {
    x: (tx - ty) * TILE_W_HALF,
    y: (tx + ty) * TILE_H_HALF
  };
}

// ── Screen → World conversion ─────────────────────────────────────────────
export function screenToWorld(sx, sy) {
  return {
    tx: Math.floor((sx / TILE_W_HALF + sy / TILE_H_HALF) / 2),
    ty: Math.floor((sy / TILE_H_HALF - sx / TILE_W_HALF) / 2)
  };
}

// ── Draw depth sort key ───────────────────────────────────────────────────
export function depthKey(tx, ty) {
  return (tx + ty) * 1000;
}

// ── Direction from velocity ───────────────────────────────────────────────
export function velocityToDirection(dx, dy) {
  // dx/dy in isometric world space
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  const dirs  = ["E","SE","S","SW","W","NW","N","NE"];
  const index = Math.round(((angle + 360) % 360) / 45) % 8;
  return dirs[index];
}

// ─────────────────────────────────────────────────────────────────────────
// IsoScene — the main Phaser scene
// ─────────────────────────────────────────────────────────────────────────
export class IsoScene extends Phaser.Scene {
  constructor() {
    super({ key: "IsoScene" });

    // Set by IsoRenderer after scene starts
    this.onReady   = null;
    this._sprites  = new Map(); // entityId -> Phaser.GameObjects.Sprite
    this._tiles    = [];        // ground tile images
    this._isoGroup = null;      // depth-sorted container
  }

  preload() {
    // ── Placeholder assets (replace with real Kenney assets) ──────────────

    // Tile placeholders — diamond shaped
    this.load.image("tile_grass",  this._makePlaceholderTileURL("#4a7a3a", "#3a6a2a"));
    this.load.image("tile_stone",  this._makePlaceholderTileURL("#888880", "#666660"));
    this.load.image("tile_water",  this._makePlaceholderTileURL("#2a4a8a", "#1a3a7a"));
    this.load.image("tile_dirt",   this._makePlaceholderTileURL("#8a6040", "#7a5030"));
    this.load.image("tile_path",   this._makePlaceholderTileURL("#aaaaaa", "#999999"));

    // Character placeholder spritesheet (64x64 frames)
    // Will be replaced with rendered Kenney character sprites
    this.load.spritesheet("char_fighter", this._makeCharPlaceholderURL("#cc2222"), {
      frameWidth:  CHAR_SIZE,
      frameHeight: CHAR_SIZE
    });
    this.load.spritesheet("char_ranger", this._makeCharPlaceholderURL("#2a8a2a"), {
      frameWidth:  CHAR_SIZE,
      frameHeight: CHAR_SIZE
    });
    this.load.spritesheet("char_paladin", this._makeCharPlaceholderURL("#2244cc"), {
      frameWidth:  CHAR_SIZE,
      frameHeight: CHAR_SIZE
    });

    // Monster placeholders
    this.load.spritesheet("mob_goblin", this._makeCharPlaceholderURL("#4a7a2a"), {
      frameWidth:  CHAR_SIZE,
      frameHeight: CHAR_SIZE
    });
    this.load.spritesheet("mob_skeleton", this._makeCharPlaceholderURL("#ccccaa"), {
      frameWidth:  CHAR_SIZE,
      frameHeight: CHAR_SIZE
    });
  }

  create() {
    // ── Camera setup ──────────────────────────────────────────────────────
    this.cameras.main.setBackgroundColor("#1a1008");

    // ── Depth-sorted group ────────────────────────────────────────────────
    this._isoGroup = this.add.group();

    // ── Register placeholder animations ──────────────────────────────────
    this._registerAnims("char_fighter");
    this._registerAnims("char_ranger");
    this._registerAnims("char_paladin");
    this._registerAnims("mob_goblin");
    this._registerAnims("mob_skeleton");

    // ── Input ──────────────────────────────────────────────────────────────
    this.input.on("pointerdown", (ptr) => {
      const worldPt = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
      const tile    = screenToWorld(worldPt.x, worldPt.y);
      this.events.emit("tile_clicked", tile.tx, tile.ty, ptr);
    });

    // ── Ready ──────────────────────────────────────────────────────────────
    this.onReady?.();
    console.log("[IsoScene] Ready");
  }

  update(time, delta) {
    // Re-sort all objects by depth each frame
    const objects = this._isoGroup.getChildren();
    objects.sort((a, b) => (a.depth ?? 0) - (b.depth ?? 0));
  }

  // ── Tile rendering ────────────────────────────────────────────────────────

  /**
   * Draw a tile at world position (tx, ty).
   * key: texture key e.g. "tile_grass"
   */
  drawTile(tx, ty, key = "tile_grass") {
    const { x, y } = worldToScreen(tx, ty);
    const img = this.add.image(x, y, key);
    img.setOrigin(0.5, 0.5);
    img.setDepth(depthKey(tx, ty) - 1); // tiles always behind entities
    this._isoGroup.add(img);
    return img;
  }

  // ── Entity sprites ────────────────────────────────────────────────────────

  /**
   * Add or update a character/monster sprite.
   */
  upsertSprite(id, tx, ty, textureKey, direction = "S", action = "idle") {
    let sprite = this._sprites.get(id);

    if (!sprite) {
      const { x, y } = worldToScreen(tx, ty);
      sprite = this.add.sprite(x, y - TILE_H_HALF, textureKey);
      sprite.setOrigin(0.5, 1.0); // feet at tile center
      this._isoGroup.add(sprite);
      this._sprites.set(id, sprite);
    }

    // Update position
    const { x, y } = worldToScreen(tx, ty);
    sprite.setX(x);
    sprite.setY(y - TILE_H_HALF);
    sprite.setDepth(depthKey(tx, ty));

    // Play animation
    const animKey = `${textureKey}_${action}_${direction}`;
    if (sprite.anims.currentAnim?.key !== animKey) {
      sprite.play(animKey, true);
    }

    return sprite;
  }

  removeSprite(id) {
    const sprite = this._sprites.get(id);
    if (sprite) {
      sprite.destroy();
      this._sprites.delete(id);
    }
  }

  // ── Camera ────────────────────────────────────────────────────────────────

  followTile(tx, ty) {
    const { x, y } = worldToScreen(tx, ty);
    this.cameras.main.centerOn(x, y);
  }

  panTo(tx, ty, duration = 300) {
    const { x, y } = worldToScreen(tx, ty);
    this.cameras.main.pan(x, y, duration, "Power2");
  }

  // ── Effects ────────────────────────────────────────────────────────────────

  flashSprite(id, color = 0xff4444, duration = 150) {
    const sprite = this._sprites.get(id);
    if (!sprite) return;
    sprite.setTintFill(color);
    this.time.delayedCall(duration, () => sprite.clearTint());
  }

  shakeCamera(intensity = 0.01, duration = 200) {
    this.cameras.main.shake(duration, intensity);
  }

  spawnParticle(tx, ty, opts = {}) {
    const { x, y } = worldToScreen(tx, ty);
    // Placeholder — will use Phaser particle emitter with real assets
    const circle = this.add.circle(x, y, opts.size ?? 4, opts.color ?? 0xffff00);
    circle.setDepth(depthKey(tx, ty) + 100);
    this.tweens.add({
      targets:  circle,
      y:        y - (opts.rise ?? 30),
      alpha:    0,
      duration: opts.duration ?? 600,
      onComplete: () => circle.destroy()
    });
  }

  spawnDamageText(tx, ty, text, color = "#ff4444") {
    const { x, y } = worldToScreen(tx, ty);
    const label = this.add.text(x, y - TILE_H_HALF, text, {
      fontFamily: "monospace",
      fontSize:   "14px",
      color,
      stroke:     "#000000",
      strokeThickness: 3
    }).setOrigin(0.5, 1).setDepth(99999);

    this.tweens.add({
      targets:  label,
      y:        y - TILE_H_HALF - 40,
      alpha:    0,
      duration: 800,
      ease:     "Power2",
      onComplete: () => label.destroy()
    });
  }

  // ── Animation registration ────────────────────────────────────────────────

  /**
   * Register all standard animations for a character texture.
   * Assumes spritesheet layout:
   *   Rows: S, SW, W, NW, N, NE, E, SE (one row per direction)
   *   Cols: idle(4) | walk(8) | attack(6) | death(6) | hurt(3)
   */
  _registerAnims(textureKey) {
    const { idle, walk, attack, death, hurt } = ANIM_FRAMES;
    const colOffsets = {
      idle:   0,
      walk:   idle,
      attack: idle + walk,
      death:  idle + walk + attack,
      hurt:   idle + walk + attack + death
    };
    const totalCols = idle + walk + attack + death + hurt;

    DIRECTIONS.forEach((dir, row) => {
      Object.entries(colOffsets).forEach(([action, colStart]) => {
        const frameCount = ANIM_FRAMES[action];
        const frames = Array.from({ length: frameCount }, (_, i) =>
          row * totalCols + colStart + i
        );
        const key = `${textureKey}_${action}_${dir}`;
        if (!this.anims.exists(key)) {
          this.anims.create({
            key,
            frames:    this.anims.generateFrameNumbers(textureKey, { frames }),
            frameRate: action === "idle" ? 4 : action === "walk" ? 8 : 10,
            repeat:    action === "death" || action === "hurt" ? 0 : -1
          });
        }
      });
    });
  }

  // ── Placeholder asset generation ──────────────────────────────────────────
  // These generate canvas-based placeholder textures until real assets arrive

  _makePlaceholderTileURL(fill, stroke) {
    const c   = document.createElement("canvas");
    c.width   = TILE_W;
    c.height  = TILE_H;
    const ctx = c.getContext("2d");

    // Diamond shape
    ctx.beginPath();
    ctx.moveTo(TILE_W_HALF, 0);
    ctx.lineTo(TILE_W, TILE_H_HALF);
    ctx.lineTo(TILE_W_HALF, TILE_H);
    ctx.lineTo(0, TILE_H_HALF);
    ctx.closePath();
    ctx.fillStyle   = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth   = 1;
    ctx.stroke();

    return c.toDataURL();
  }

  _makeCharPlaceholderURL(color) {
    // Generate a simple spritesheet — 27 frames (4+8+6+6+3) × 8 directions
    const totalCols = 27;
    const totalRows = 8;
    const c         = document.createElement("canvas");
    c.width          = totalCols * CHAR_SIZE;
    c.height         = totalRows * CHAR_SIZE;
    const ctx        = c.getContext("2d");

    for (let row = 0; row < totalRows; row++) {
      for (let col = 0; col < totalCols; col++) {
        const x = col * CHAR_SIZE;
        const y = row * CHAR_SIZE;
        // Simple character silhouette
        ctx.fillStyle = color;
        ctx.fillRect(x + 20, y + 10, 24, 30); // body
        ctx.beginPath();
        ctx.arc(x + 32, y + 16, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#000";
        ctx.font = "8px monospace";
        ctx.fillText(col, x + 2, y + CHAR_SIZE - 2);
      }
    }

    return c.toDataURL();
  }
}

// ─────────────────────────────────────────────────────────────────────────
// IsoRenderer — public API used by Engine (mirrors Renderer.js interface)
// ─────────────────────────────────────────────────────────────────────────
export class IsoRenderer {
  constructor(containerId = "game") {
    this._game   = null;
    this._scene  = null;
    this._ready  = false;
    this._queue  = []; // commands queued before ready

    const container = document.getElementById(containerId);
    const w = container?.clientWidth  || window.innerWidth;
    const h = container?.clientHeight || window.innerHeight;

    this._game = new Phaser.Game({
      type:            Phaser.AUTO,
      width:           w,
      height:          h,
      backgroundColor: "#1a1008",
      parent:          containerId,
      scene:           IsoScene,
      scale: {
        mode:       Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
      }
    });

    this._game.events.once("ready", () => {
      this._scene = this._game.scene.getScene("IsoScene");
      this._scene.onReady = () => {
        this._ready = true;
        // Flush queued commands
        for (const fn of this._queue) fn();
        this._queue = [];
        console.log("[IsoRenderer] Ready");
      };
    });
  }

  // ── Deferred execution ────────────────────────────────────────────────────
  _run(fn) {
    if (this._ready) fn();
    else this._queue.push(fn);
  }

  // ── Tile API ──────────────────────────────────────────────────────────────
  drawTile(tx, ty, tileType = 0) {
    this._run(() => {
      const key = this._tileKey(tileType);
      this._scene.drawTile(tx, ty, key);
    });
  }

  // ── Entity API ────────────────────────────────────────────────────────────
  upsertEntity(id, tx, ty, classId, direction = "S", action = "idle") {
    this._run(() => {
      const key = this._charKey(classId);
      this._scene.upsertSprite(id, tx, ty, key, direction, action);
    });
  }

  removeEntity(id) {
    this._run(() => this._scene.removeSprite(id));
  }

  // ── Camera API ────────────────────────────────────────────────────────────
  followEntity(tx, ty) {
    this._run(() => this._scene.followTile(tx, ty));
  }

  // ── Effects API ───────────────────────────────────────────────────────────
  hitFlash(id)                { this._run(() => this._scene.flashSprite(id)); }
  cameraShake()               { this._run(() => this._scene.shakeCamera()); }
  damageText(tx, ty, amount)  { this._run(() => this._scene.spawnDamageText(tx, ty, `-${amount}`, "#ff4444")); }
  healText(tx, ty, amount)    { this._run(() => this._scene.spawnDamageText(tx, ty, `+${amount}`, "#44ff88")); }
  particle(tx, ty, opts)      { this._run(() => this._scene.spawnParticle(tx, ty, opts)); }

  // ── Input forwarding ──────────────────────────────────────────────────────
  onTileClick(callback) {
    this._run(() => {
      this._scene.events.on("tile_clicked", callback);
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  _tileKey(tileType) {
    const map = {
      0: "tile_grass",
      1: "tile_stone",
      2: "tile_water",
      3: "tile_dirt",
      4: "tile_path"
    };
    return map[tileType] ?? "tile_grass";
  }

  _charKey(classId) {
    const map = {
      fighter:     "char_fighter",
      ranger:      "char_ranger",
      paladin:     "char_paladin",
      goblinMelee: "mob_goblin",
      goblinArcher:"mob_goblin",
      skeleton:    "mob_skeleton",
      zombie:      "mob_goblin",
      wraith:      "mob_skeleton",
      necromancer: "mob_skeleton",
      lich:        "mob_skeleton"
    };
    return map[classId] ?? "char_fighter";
  }

  get scene() { return this._scene; }
  get isReady() { return this._ready; }
}
