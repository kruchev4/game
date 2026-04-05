import { Camera }     from "./Camera.js";
import { TileFactory } from "./TileFactory.js";

// ── UI Colors ──────────────────────────────────────────────────────────────
const WHITE = "#eeeeee";

// ── Renderer ───────────────────────────────────────────────────────────────
export class Renderer {

  constructor(canvas) {
    this.canvas   = canvas;
    this.ctx      = canvas.getContext("2d");
    this.tileSize = 16;

    this.camera      = new Camera({ tileSize: this.tileSize });
    this.tileFactory = new TileFactory({ tileSize: this.tileSize });

    // Set by Engine
    this.currentTarget   = null;
    this.playerAbilities = [];
    this.abilities       = {};
    this.itemDefs        = {};
    this.player          = null;
    this.combatLog       = null;

    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.camera.resize(this.canvas.width, this.canvas.height);
  }

  // ── Entity drawing ────────────────────────────────────────────────────────
  drawEntity(entity) {
    const { ctx, tileSize, camera } = this;
    const { sx, sy } = camera.worldToScreen(entity.x, entity.y);

    if (entity.type === "corpse") return;

    ctx.fillStyle =
      entity.type === "npc"
        ? (entity === this.currentTarget
            ? "#ffaa00"
            : entity.state === "alert"
              ? "#ff5555"
              : "#cc3333")
        : "#ffd700";

    ctx.fillRect(sx + 2, sy + 2, tileSize - 4, tileSize - 4);

    ctx.strokeStyle = entity === this.currentTarget ? "#ffffff" : "#000000";
    ctx.strokeRect(sx + 2, sy + 2, tileSize - 4, tileSize - 4);
  }

  // ── Main render ───────────────────────────────────────────────────────────
  render(world, entities = []) {
    const { ctx, tileSize, camera } = this;

    // ✅ CLEAR ONCE PER FRAME
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // ── Tile bounds ────────────────────────────────────────────────────────
    const tilesWide = Math.ceil(ctx.canvas.width  / tileSize) + 1;
    const tilesHigh = Math.ceil(ctx.canvas.height / tileSize) + 1;

    // ✅ Correct world origin (this was the key fix)
    const startX = Math.floor(camera.x / tileSize);
    const startY = Math.floor(camera.y / tileSize);

    // ── Tiles ───────────────────────────────────────────────────────────────
    for (let sy = 0; sy < tilesHigh; sy++) {
      for (let sx = 0; sx < tilesWide; sx++) {

        const wx = startX + sx;
        const wy = startY + sy;
        const tileId = world.getTile(wx, wy);
        if (tileId == null) continue;

        const { sx: px, sy: py } = camera.worldToScreen(wx, wy);

        const neighbors = {
          n: world.getTile(wx, wy - 1),
          e: world.getTile(wx + 1, wy),
          s: world.getTile(wx, wy + 1),
          w: world.getTile(wx - 1, wy)
        };

        const tileCanvas =
          this.tileFactory.getTileCanvas(tileId, wx, wy, neighbors);

        ctx.drawImage(tileCanvas, px, py, tileSize, tileSize);
      }
    }

    // ── Entities ────────────────────────────────────────────────────────────
    for (const entity of entities) {
      if (!entity.dead) this.drawEntity(entity);
    }

    // ── NPC perception rings ──────────────────────────────────────────────
    for (const entity of entities) {
      if (entity.type !== "npc" || entity.dead) continue;

      const { sx, sy } = camera.worldToScreen(entity.x, entity.y);
      const r = entity.perceptionRadius * tileSize;

      ctx.strokeStyle = entity.state === "alert"
        ? "rgba(255, 80, 80, 0.4)"
        : "rgba(255, 255, 255, 0.15)";

      ctx.beginPath();
      ctx.arc(sx + tileSize / 2, sy + tileSize / 2, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ── Entities drawn above tiles ─────────────────────────────────────────
    for (const entity of entities) {
      if (!entity.dead) this.drawEntity(entity);
    }

    // ── HUD ────────────────────────────────────────────────────────────────
    this._drawTargetFrame();
    this._drawPlayerFrame();
    this._drawAbilityBar();
    this._drawQuickSlots();
    this._drawBagIcon();
    this.combatLog?.draw(ctx, ctx.canvas.width, ctx.canvas.height);
  }

  // ── HUD helpers (unchanged logic) ─────────────────────────────────────────
  _drawTargetFrame() {
    const target = this.currentTarget;
    if (!target || target.dead) return;
    const { ctx } = this;
    ctx.fillStyle = "rgba(10,10,20,0.85)";
    ctx.fillRect((ctx.canvas.width - 220) / 2, 14, 220, 56);
  }

  _drawPlayerFrame() {
    if (!this.player) return;
    const { ctx } = this;
    ctx.fillStyle = "rgba(10,10,20,0.85)";
    ctx.fillRect((ctx.canvas.width - 240) / 2, ctx.canvas.height - 140, 240, 52);
  }

  _drawAbilityBar() {}
  _drawQuickSlots() {}
  _drawBagIcon() {}
}
