import { Camera }     from "./Camera.js";
import { getTileDef } from "../world/getTileDef.js";

// ── UI Layout constants ───────────────────────────────────────────────────────
const ABILITY_BAR = {
  slotSize: 56,
  gap:      8,
  paddingY: 12,
  borderR:  10,
  count:    4
};

const TARGET_FRAME = {
  width:     220,
  height:    56,
  paddingX:  14,
  paddingY:  10,
  borderR:   10,
  topOffset: 14
};

// ─────────────────────────────────────────────────────────────────────────────

export class Renderer {
  constructor(canvas) {
    this.canvas   = canvas;
    this.ctx      = canvas.getContext("2d");
    this.tileSize = 16;

    this.camera = new Camera({ tileSize: this.tileSize });

    // Set by Engine — used for HUD rendering
    this.currentTarget   = null;  // NPC entity or null
    this.playerAbilities = [];    // array of ability definition objects { id, name, ... }
    this.abilities       = {};    // full ability map (id -> def), for lookup

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

    // Determine color before drawing
    if (entity.type === "npc") {
      ctx.fillStyle = entity === this.currentTarget
        ? "#ffaa00"                      // orange = targeted
        : entity.state === "alert"
          ? "#ff5555"                    // red = aware/chasing
          : "#cc3333";                   // dark red = roaming
    } else {
      ctx.fillStyle = "#ffd700";         // player gold
    }

    ctx.fillRect(sx + 2, sy + 2, tileSize - 4, tileSize - 4);

    ctx.strokeStyle = entity === this.currentTarget ? "#ffffff" : "#000000";
    ctx.lineWidth   = entity === this.currentTarget ? 2 : 1;
    ctx.strokeRect(sx + 2, sy + 2, tileSize - 4, tileSize - 4);
    ctx.lineWidth = 1;
  }

  // ── Main render ───────────────────────────────────────────────────────────

  render(world, entities = []) {
    const { ctx, tileSize, camera } = this;

    // Background
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    const tilesWide = Math.ceil(ctx.canvas.width  / tileSize);
    const tilesHigh = Math.ceil(ctx.canvas.height / tileSize);

    // ── Tiles ──
    for (let y = 0; y < tilesHigh; y++) {
      for (let x = 0; x < tilesWide; x++) {
        const wx = x + camera.x;
        const wy = y + camera.y;

        const tileId = world.getTile(wx, wy);
        if (tileId == null) continue;

        const tile       = getTileDef(tileId);
        const { sx, sy } = camera.worldToScreen(wx, wy);

        ctx.fillStyle = tile.color;
        ctx.fillRect(sx, sy, tileSize, tileSize);

        ctx.strokeStyle = "rgba(0,0,0,0.25)";
        ctx.strokeRect(sx, sy, tileSize, tileSize);
      }
    }

    // ── NPC perception rings ──
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

    // ── A* path polyline ──
    const player = entities.find(e => e.type === "player");

    if (player?.movePath?.length) {
      ctx.strokeStyle = "rgba(255, 60, 60, 0.55)";
      ctx.lineWidth   = 2;
      ctx.lineJoin    = "round";
      ctx.lineCap     = "round";
      ctx.beginPath();

      const { sx: psx, sy: psy } = camera.worldToScreen(player.x, player.y);
      ctx.moveTo(psx + tileSize / 2, psy + tileSize / 2);

      for (const step of player.movePath) {
        const { sx, sy } = camera.worldToScreen(step.x, step.y);
        if (
          sx < -tileSize || sy < -tileSize ||
          sx > ctx.canvas.width  + tileSize ||
          sy > ctx.canvas.height + tileSize
        ) continue;
        ctx.lineTo(sx + tileSize / 2, sy + tileSize / 2);
      }
      ctx.stroke();

      ctx.fillStyle = "rgba(255, 60, 60, 0.65)";
      for (let i = 0; i < player.movePath.length; i += 3) {
        const { sx, sy } = camera.worldToScreen(
          player.movePath[i].x, player.movePath[i].y
        );
        ctx.beginPath();
        ctx.arc(sx + tileSize / 2, sy + tileSize / 2, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.lineWidth = 1;
    }

    // ── Right-click move target marker ──
    if (player?.moveTarget) {
      const { sx, sy } = camera.worldToScreen(
        player.moveTarget.x, player.moveTarget.y
      );
      ctx.fillStyle = "rgba(255, 59, 59, 0.75)";
      ctx.beginPath();
      ctx.arc(sx + tileSize / 2, sy + tileSize / 2, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Entities ──
    for (const entity of entities) {
      if (!entity.dead) this.drawEntity(entity);
    }

    // ── HUD overlays ──
    this._drawTargetFrame();
    this._drawAbilityBar();
  }

  // ── Target Frame (top-center) ─────────────────────────────────────────────

  _drawTargetFrame() {
    const target = this.currentTarget;
    if (!target || target.dead) return;

    const { ctx }                                         = this;
    const { width, height, paddingX, paddingY, borderR, topOffset } = TARGET_FRAME;

    const x = (ctx.canvas.width - width) / 2;
    const y = topOffset;

    // Panel
    ctx.fillStyle = "rgba(10, 10, 20, 0.85)";
    this._roundRect(x, y, width, height, borderR);
    ctx.fill();

    ctx.strokeStyle = "rgba(200, 80, 80, 0.75)";
    ctx.lineWidth   = 1.5;
    this._roundRect(x, y, width, height, borderR);
    ctx.stroke();
    ctx.lineWidth = 1;

    // Name
    const label = target.id
      .replace(/_/g, " ")
      .replace(/\b\w/g, c => c.toUpperCase());

    ctx.fillStyle = "#ffffff";
    ctx.font      = "bold 13px monospace";
    ctx.fillText(label, x + paddingX, y + paddingY + 12);

    // Class
    ctx.fillStyle = "#aaaaaa";
    ctx.font      = "11px monospace";
    ctx.fillText(target.classId ?? "", x + paddingX, y + paddingY + 26);

    // HP bar track
    const barX = x + paddingX;
    const barY = y + height - paddingY - 10;
    const barW = width - paddingX * 2;
    const barH = 8;

    ctx.fillStyle = "#333333";
    ctx.fillRect(barX, barY, barW, barH);

    // HP bar fill
    const hpPct   = Math.max(0, target.hp / target.maxHp);
    ctx.fillStyle = hpPct > 0.5 ? "#44cc44" : hpPct > 0.25 ? "#ccaa22" : "#cc3333";
    ctx.fillRect(barX, barY, barW * hpPct, barH);

    // HP label
    ctx.fillStyle = "#ffffff";
    ctx.font      = "10px monospace";
    ctx.fillText(`${target.hp} / ${target.maxHp}`, barX + 2, barY + barH - 1);
  }

  // ── Ability Bar (bottom-center) ───────────────────────────────────────────

  _drawAbilityBar() {
    const abilities = (this.playerAbilities ?? []).slice(0, ABILITY_BAR.count);
    if (!abilities.length) return;

    const { ctx }                              = this;
    const { slotSize, gap, paddingY, borderR } = ABILITY_BAR;

    const totalW = abilities.length * slotSize + (abilities.length - 1) * gap;
    const startX = (ctx.canvas.width - totalW) / 2;
    const startY = ctx.canvas.height - slotSize - paddingY;

    const hasTarget = this.currentTarget && !this.currentTarget.dead;

    for (let i = 0; i < abilities.length; i++) {
      const ability = abilities[i];
      const sx      = startX + i * (slotSize + gap);
      const sy      = startY;

      // Slot background
      ctx.fillStyle = "rgba(10, 10, 20, 0.88)";
      this._roundRect(sx, sy, slotSize, slotSize, borderR);
      ctx.fill();

      // Border — gold when usable, grey otherwise
      ctx.strokeStyle = hasTarget
        ? "rgba(255, 180, 50, 0.85)"
        : "rgba(120, 120, 140, 0.55)";
      ctx.lineWidth = 1.5;
      this._roundRect(sx, sy, slotSize, slotSize, borderR);
      ctx.stroke();
      ctx.lineWidth = 1;

      // Ability name (centered, wraps if long)
      ctx.fillStyle = "#ffffff";
      ctx.font      = "bold 10px monospace";
      ctx.textAlign = "center";
      this._drawWrappedText(
        ability.name,
        sx + slotSize / 2,
        sy + 18,
        slotSize - 8,
        12
      );

      // Range / type tag
      ctx.fillStyle = ability.type === "melee" ? "#ffaa55" : "#88aaff";
      ctx.font      = "9px monospace";
      ctx.fillText(
        ability.type === "melee" ? "MELEE" : `${ability.range}t`,
        sx + slotSize / 2,
        sy + slotSize - 18
      );

      // Keybind hint
      ctx.fillStyle = "rgba(200, 200, 200, 0.55)";
      ctx.font      = "10px monospace";
      ctx.fillText(`[${i + 1}]`, sx + slotSize / 2, sy + slotSize - 6);

      ctx.textAlign = "left";
    }
  }

  // ── Ability bar hit testing ───────────────────────────────────────────────
  // Returns 0-based slot index if (px, py) hits a slot, else -1.

  getAbilitySlotAt(px, py) {
    const abilities = (this.playerAbilities ?? []).slice(0, ABILITY_BAR.count);
    if (!abilities.length) return -1;

    const { slotSize, gap, paddingY } = ABILITY_BAR;
    const totalW = abilities.length * slotSize + (abilities.length - 1) * gap;
    const startX = (this.canvas.width - totalW) / 2;
    const startY = this.canvas.height - slotSize - paddingY;

    for (let i = 0; i < abilities.length; i++) {
      const sx = startX + i * (slotSize + gap);
      if (px >= sx && px <= sx + slotSize && py >= startY && py <= startY + slotSize) {
        return i;
      }
    }
    return -1;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  _roundRect(x, y, w, h, r) {
    this.ctx.beginPath();
    this.ctx.moveTo(x + r, y);
    this.ctx.lineTo(x + w - r, y);
    this.ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    this.ctx.lineTo(x + w, y + h - r);
    this.ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.ctx.lineTo(x + r, y + h);
    this.ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    this.ctx.lineTo(x, y + r);
    this.ctx.quadraticCurveTo(x, y, x + r, y);
    this.ctx.closePath();
  }

  _drawWrappedText(text, cx, y, maxWidth, lineHeight) {
    const words = text.split(" ");
    let line    = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (this.ctx.measureText(test).width > maxWidth && line) {
        this.ctx.fillText(line, cx, y);
        line = word;
        y   += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) this.ctx.fillText(line, cx, y);
  }
}
