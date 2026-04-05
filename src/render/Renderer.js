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

const PLAYER_FRAME = {
  width:       240,
  height:      52,
  paddingX:    10,
  paddingY:    8,
  borderR:     10,
  portraitSize: 36,
  barHeight:   10,
  barGap:      6
};

// ─────────────────────────────────────────────────────────────────────────────

export class Renderer {
  constructor(canvas) {
    this.canvas   = canvas;
    this.ctx      = canvas.getContext("2d");
    this.tileSize = 16;

    this.camera = new Camera({ tileSize: this.tileSize });

    // Set by Engine
    this.currentTarget   = null;   // NPC entity or null
    this.playerAbilities = [];     // array of ability defs in slot order
    this.abilities       = {};     // full ability map id -> def
    this.player          = null;   // player entity ref (for cooldown reads)
    this.combatLog       = null;   // CombatLog instance

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

    if (entity.type === "npc") {
      ctx.fillStyle = entity === this.currentTarget
        ? "#ffaa00"
        : entity.state === "alert"
          ? "#ff5555"
          : "#cc3333";
    } else {
      ctx.fillStyle = "#ffd700";
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

    // ── Move target marker ──
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

    // ── HUD ──
    this._drawTargetFrame();
    this._drawPlayerFrame();
    this._drawAbilityBar();
    this.combatLog?.draw(ctx, ctx.canvas.width, ctx.canvas.height);
  }

  // ── Target Frame ─────────────────────────────────────────────────────────

  _drawTargetFrame() {
    const target = this.currentTarget;
    if (!target || target.dead) return;

    const { ctx }                                                    = this;
    const { width, height, paddingX, paddingY, borderR, topOffset } = TARGET_FRAME;

    const x = (ctx.canvas.width - width) / 2;
    const y = topOffset;

    ctx.fillStyle = "rgba(10, 10, 20, 0.85)";
    this._roundRect(x, y, width, height, borderR);
    ctx.fill();

    ctx.strokeStyle = "rgba(200, 80, 80, 0.75)";
    ctx.lineWidth   = 1.5;
    this._roundRect(x, y, width, height, borderR);
    ctx.stroke();
    ctx.lineWidth = 1;

    const label = target.id
      .replace(/_/g, " ")
      .replace(/\b\w/g, c => c.toUpperCase());

    ctx.fillStyle = "#ffffff";
    ctx.font      = "bold 13px monospace";
    ctx.fillText(label, x + paddingX, y + paddingY + 12);

    ctx.fillStyle = "#aaaaaa";
    ctx.font      = "11px monospace";
    ctx.fillText(target.classId ?? "", x + paddingX, y + paddingY + 26);

    const barX = x + paddingX;
    const barY = y + height - paddingY - 10;
    const barW = width - paddingX * 2;
    const barH = 8;

    ctx.fillStyle = "#333333";
    ctx.fillRect(barX, barY, barW, barH);

    const hpPct   = Math.max(0, target.hp / target.maxHp);
    ctx.fillStyle = hpPct > 0.5 ? "#44cc44" : hpPct > 0.25 ? "#ccaa22" : "#cc3333";
    ctx.fillRect(barX, barY, barW * hpPct, barH);

    ctx.fillStyle = "#ffffff";
    ctx.font      = "10px monospace";
    ctx.fillText(`${target.hp} / ${target.maxHp}`, barX + 2, barY + barH - 1);
  }

  // ── Player Frame (bottom-center, above ability bar) ──────────────────────

  _drawPlayerFrame() {
    const player = this.player;
    if (!player) return;

    const { ctx } = this;
    const {
      width, height, paddingX, paddingY,
      borderR, portraitSize, barHeight, barGap
    } = PLAYER_FRAME;

    const { slotSize, gap, paddingY: barPaddingY, count } = ABILITY_BAR;
    const abilities   = (this.playerAbilities ?? []).slice(0, count);
    const abilityBarH = abilities.length ? slotSize + barPaddingY : 0;

    // Position: centered horizontally, just above the ability bar
    const x = (ctx.canvas.width - width) / 2;
    const y = ctx.canvas.height - abilityBarH - height - 6;

    // ── Panel background ──
    ctx.fillStyle = "rgba(10, 10, 20, 0.85)";
    this._roundRect(x, y, width, height, borderR);
    ctx.fill();

    ctx.strokeStyle = "rgba(100, 160, 100, 0.6)";
    ctx.lineWidth   = 1.5;
    this._roundRect(x, y, width, height, borderR);
    ctx.stroke();
    ctx.lineWidth = 1;

    // ── Portrait box ──
    const portX = x + paddingX;
    const portY = y + (height - portraitSize) / 2;

    // Background
    const classColor  = this._classColor();
    ctx.fillStyle     = "rgba(20, 20, 35, 0.9)";
    ctx.strokeStyle   = classColor;
    ctx.lineWidth     = 1.5;
    ctx.fillRect(portX, portY, portraitSize, portraitSize);
    ctx.strokeRect(portX, portY, portraitSize, portraitSize);
    ctx.lineWidth = 1;

    // Class initial letter
    const initial = (player.classId ?? "?")[0].toUpperCase();
    ctx.fillStyle = classColor;
    ctx.font      = `bold 18px monospace`;
    ctx.textAlign = "center";
    ctx.fillText(initial, portX + portraitSize / 2, portY + portraitSize / 2 + 6);
    ctx.textAlign = "left";

    // ── Bars area ──
    const barsX = portX + portraitSize + paddingX;
    const barsW = width - portraitSize - paddingX * 3;

    // Total bar block height (2 bars + gap)
    const totalBarsH = barHeight * 2 + barGap;
    const barsY      = y + (height - totalBarsH) / 2;

    // HP bar
    this._drawResourceBar(
      ctx, barsX, barsY, barsW, barHeight,
      player.hp, player.maxHp,
      "#44cc44", "#cc3333", "#ccaa22",
      `${Math.ceil(player.hp)} / ${player.maxHp}`
    );

    // Resource bar (mana / rage / etc.)
    const def     = player.resourceDef;
    const resColor = def?.color ?? "#3366ff";
    const resLabel = def?.label ?? "MP";

    this._drawResourceBar(
      ctx, barsX, barsY + barHeight + barGap, barsW, barHeight,
      player.resource, player.maxResource,
      resColor, resColor, resColor,
      `${Math.floor(player.resource)} / ${player.maxResource}  ${resLabel}`
    );
  }

  /**
   * Draw a single labeled resource bar.
   * Color transitions high→mid→low using the three color params
   * (for HP). For flat-color bars (mana/rage) pass the same color for all three.
   */
  _drawResourceBar(ctx, x, y, w, h, current, max, colorHigh, colorLow, colorMid, label) {
    const pct = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;

    // Track
    ctx.fillStyle = "#222233";
    ctx.fillRect(x, y, w, h);

    // Fill — use gradient-like color steps for HP
    ctx.fillStyle = colorHigh === colorLow
      ? colorHigh
      : pct > 0.5 ? colorHigh : pct > 0.25 ? colorMid : colorLow;
    ctx.fillRect(x, y, w * pct, h);

    // Label
    ctx.fillStyle = "rgba(220,220,220,0.85)";
    ctx.font      = "9px monospace";
    ctx.fillText(label, x + 3, y + h - 2);
  }

  // ── Ability Bar ───────────────────────────────────────────────────────────

  _drawAbilityBar() {
    const abilities = (this.playerAbilities ?? []).slice(0, ABILITY_BAR.count);
    if (!abilities.length) return;

    const { ctx }                              = this;
    const { slotSize, gap, paddingY, borderR } = ABILITY_BAR;

    const totalW = abilities.length * slotSize + (abilities.length - 1) * gap;
    const startX = (ctx.canvas.width - totalW) / 2;
    const startY = ctx.canvas.height - slotSize - paddingY;

    const hasTarget   = this.currentTarget && !this.currentTarget.dead;
    const cooldowns   = this.player?.abilityCooldowns ?? {};

    for (let i = 0; i < abilities.length; i++) {
      const ability = abilities[i];
      const sx      = startX + i * (slotSize + gap);
      const sy      = startY;
      const cx      = sx + slotSize / 2;
      const cy      = sy + slotSize / 2;

      const cd      = cooldowns[ability.id] ?? null;
      const onCD    = cd && cd.remaining > 0;

      // ── Slot background ──
      ctx.fillStyle = onCD
        ? "rgba(6, 6, 14, 0.92)"      // darker when on cooldown
        : "rgba(10, 10, 20, 0.88)";
      this._roundRect(sx, sy, slotSize, slotSize, borderR);
      ctx.fill();

      // ── Border ──
      ctx.strokeStyle = onCD
        ? "rgba(80, 80, 100, 0.5)"    // dim when on cooldown
        : hasTarget
          ? "rgba(255, 180, 50, 0.85)"
          : "rgba(120, 120, 140, 0.55)";
      ctx.lineWidth = 1.5;
      this._roundRect(sx, sy, slotSize, slotSize, borderR);
      ctx.stroke();
      ctx.lineWidth = 1;

      // ── Ability name ──
      ctx.fillStyle = onCD ? "rgba(130,130,130,0.7)" : "#ffffff";
      ctx.font      = "bold 10px monospace";
      ctx.textAlign = "center";
      this._drawWrappedText(ability.name, cx, sy + 18, slotSize - 8, 12);

      // ── Range tag ──
      ctx.fillStyle = onCD
        ? "rgba(100,100,120,0.6)"
        : ability.type === "melee" ? "#ffaa55" : "#88aaff";
      ctx.font = "9px monospace";
      ctx.fillText(
        ability.type === "melee" ? "MELEE" : `${ability.range}t`,
        cx,
        sy + slotSize - 18
      );

      // ── Keybind ──
      ctx.fillStyle = "rgba(200,200,200,0.55)";
      ctx.font      = "10px monospace";
      ctx.fillText(`[${i + 1}]`, cx, sy + slotSize - 6);

      ctx.textAlign = "left";

      // ── Cooldown sweep ring ──
      if (onCD) {
        this._drawCooldownRing(cx, cy, slotSize, cd);
      }
    }
  }

  /**
   * Draws a clockwise-sweeping arc overlay on an ability slot.
   * The arc starts at 12 o'clock and sweeps clockwise.
   * Full circle = ability just used. Empty = ready.
   *
   * @param {number} cx         - centre x of slot
   * @param {number} cy         - centre y of slot
   * @param {number} slotSize
   * @param {{ remaining: number, max: number }} cd
   */
  _drawCooldownRing(cx, cy, slotSize, cd) {
    const { ctx } = this;

    const radius   = slotSize * 0.38;
    const progress = cd.remaining / cd.max;   // 1 = just fired, 0 = ready

    // Dark overlay behind the ring to dim the slot
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 3, 0, Math.PI * 2);
    ctx.fill();

    // Track ring (full circle, dim)
    ctx.strokeStyle = "rgba(60, 60, 80, 0.7)";
    ctx.lineWidth   = 3.5;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Sweep arc — starts at 12 o'clock (-π/2), sweeps clockwise
    // The filled portion represents remaining cooldown.
    // As remaining decreases toward 0, the arc shrinks.
    const startAngle = -Math.PI / 2;
    const endAngle   = startAngle + (Math.PI * 2 * progress);

    ctx.strokeStyle = "rgba(220, 180, 60, 0.9)";
    ctx.lineWidth   = 3.5;
    ctx.lineCap     = "round";
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle, false);
    ctx.stroke();

    // Cooldown remaining label (seconds approximation — ticks / 60)
    const secsRemaining = (cd.remaining / 60).toFixed(1);
    ctx.fillStyle = "rgba(255, 220, 100, 0.9)";
    ctx.font      = "bold 11px monospace";
    ctx.textAlign = "center";
    ctx.fillText(secsRemaining, cx, cy + 4);
    ctx.textAlign = "left";
    ctx.lineWidth = 1;
    ctx.lineCap   = "butt";
  }

  // ── Ability bar hit testing ───────────────────────────────────────────────

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

  _classColor() {
    const colors = {
      fighter: "#e8c84a",
      ranger:  "#6abf5e"
    };
    return colors[this.player?.classId] ?? "#aaaaaa";
  }

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
