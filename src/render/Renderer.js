import { Camera }     from "./Camera.js";
import { getTileDef } from "../world/getTileDef.js";
import { TileFactory } from "./TileFactory.js";


// ── Color constants ───────────────────────────────────────────────────────────
const WHITE = "#eeeeee";
const DIM   = "#888899";
const GOLD  = "#e8c84a";

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
    

    this.tileFactory = new TileFactory({ tileSize: this.tileSize });

    this.camera = new Camera({ tileSize: this.tileSize });

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

    if (entity.type === "corpse") {
      this._drawCorpse(entity, sx, sy);
      return;
    }

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

  // clear background
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    const tilesWide = Math.ceil(ctx.canvas.width  / tileSize) + 1;
    const tilesHigh = Math.ceil(ctx.canvas.height / tileSize) + 1;

 
    const startX = Math.floor(camera.x / tileSize);
    const startY = Math.floor(camera.y / tileSize);

  // ── Tiles ──
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
      
       
    }}
  

 

  
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
    this._drawQuickSlots();
    this._drawBagIcon();
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

    // ── XP ring sweep around portrait ──
    // Color shifts from dark gold → bright gold as XP fills
    // Resets each level with a flash on level up
    const xpPct    = Math.min(1, (player.xp ?? 0) / Math.max(1,
      100 * Math.pow(player.level ?? 1, 1.5)));
    const ringCx   = portX + portraitSize / 2;
    const ringCy   = portY + portraitSize / 2;
    const ringR    = portraitSize / 2 + 3;

    // Track
    ctx.strokeStyle = "rgba(60,40,10,0.6)";
    ctx.lineWidth   = 2.5;
    ctx.beginPath();
    ctx.arc(ringCx, ringCy, ringR, 0, Math.PI * 2);
    ctx.stroke();

    // Fill arc — clockwise from 12 o'clock
    if (xpPct > 0) {
      const startA  = -Math.PI / 2;
      const endA    = startA + Math.PI * 2 * xpPct;
      // Color: interpolate dark gold → bright gold based on fill
      const r = Math.round(150 + 70 * xpPct);
      const g = Math.round(80  + 80 * xpPct);
      ctx.strokeStyle = `rgba(${r}, ${g}, 20, 0.9)`;
      ctx.lineWidth   = 2.5;
      ctx.lineCap     = "round";
      ctx.beginPath();
      ctx.arc(ringCx, ringCy, ringR, startA, endA, false);
      ctx.stroke();
      ctx.lineCap = "butt";
    }

    // Level number below portrait
    ctx.fillStyle = "rgba(200,160,50,0.8)";
    ctx.font      = `bold 9px monospace`;
    ctx.textAlign = "center";
    ctx.fillText(`Lv ${player.level ?? 1}`, portX + portraitSize / 2, portY + portraitSize + 11);
    ctx.textAlign = "left";

    // ── Bars area ──
    const barsX = portX + portraitSize + paddingX;
    const barsW = width - portraitSize - paddingX * 3;

    // Total bar block height (name label + 2 bars + gap)
    const nameH      = 14;
    const totalBarsH = nameH + barHeight * 2 + barGap + 4;
    const barsY      = y + (height - totalBarsH) / 2;

    // Player name
    ctx.fillStyle = WHITE;
    ctx.font      = `bold 11px monospace`;
    ctx.fillText(player.name ?? "Hero", barsX, barsY + nameH - 2);

    // HP bar
    this._drawResourceBar(
      ctx, barsX, barsY + nameH + 2, barsW, barHeight,
      player.hp, player.maxHp,
      "#44cc44", "#cc3333", "#ccaa22",
      `${Math.ceil(player.hp)} / ${player.maxHp}`
    );

    // Resource bar
    const def      = player.resourceDef;
    const resColor = def?.color ?? "#3366ff";
    const resLabel = def?.label ?? "MP";

    this._drawResourceBar(
      ctx, barsX, barsY + nameH + barHeight + barGap + 4, barsW, barHeight,
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

  // ── Quick slot hit testing ────────────────────────────────────────────────

  getQuickSlotAt(px, py) {
    const { slotSize, gap, paddingY } = ABILITY_BAR;
    const startX = this._quickSlotsStartX();
    const startY = this.canvas.height - slotSize - paddingY;

    for (let i = 0; i < 4; i++) {
      const sx = startX + i * (slotSize + gap);
      if (px >= sx && px <= sx + slotSize && py >= startY && py <= startY + slotSize) {
        return i;
      }
    }
    return -1;
  }

  getBagIconHit(px, py) {
    const { slotSize, paddingY } = ABILITY_BAR;
    const bx = this._bagIconX();
    const by = this.canvas.height - slotSize - paddingY;
    return px >= bx && px <= bx + slotSize && py >= by && py <= by + slotSize;
  }

  _quickSlotsStartX() {
    const { slotSize, gap, paddingY } = ABILITY_BAR;
    const abilities  = (this.playerAbilities ?? []).slice(0, ABILITY_BAR.count);
    const abilityW   = abilities.length * slotSize + (abilities.length - 1) * gap;
    const abilityStartX = (this.canvas.width - abilityW) / 2;
    return abilityStartX + abilityW + 24;
  }

  _bagIconX() {
    return this._quickSlotsStartX() + 4 * (ABILITY_BAR.slotSize + ABILITY_BAR.gap) + 16;
  }

  // ── Corpse drawing ────────────────────────────────────────────────────────

  _drawCorpse(corpse, sx, sy) {
    const { ctx, tileSize } = this;

    // Fade out as despawn approaches
    const alpha = Math.max(0.2, 1 - corpse.despawnProgress * 0.8);
    ctx.globalAlpha = alpha;

    // Dark X marker
    ctx.strokeStyle = corpse.hasLoot ? "#cc9922" : "#555555";
    ctx.lineWidth   = 2;
    const pad = 4;
    ctx.beginPath();
    ctx.moveTo(sx + pad,            sy + pad);
    ctx.lineTo(sx + tileSize - pad, sy + tileSize - pad);
    ctx.moveTo(sx + tileSize - pad, sy + pad);
    ctx.lineTo(sx + pad,            sy + tileSize - pad);
    ctx.stroke();

    // Glow pulse if has loot
    if (corpse.hasLoot) {
      const pulse = 0.3 + 0.2 * Math.sin(Date.now() * 0.004);
      ctx.strokeStyle = `rgba(200, 160, 30, ${pulse})`;
      ctx.lineWidth   = 1;
      ctx.strokeRect(sx + 1, sy + 1, tileSize - 2, tileSize - 2);
    }

    ctx.globalAlpha = 1;
    ctx.lineWidth   = 1;
  }

  // ── Quick slots ───────────────────────────────────────────────────────────

  _drawQuickSlots() {
    const player = this.player;
    if (!player?.quickSlots) return;

    const { ctx }                              = this;
    const { slotSize, gap, paddingY, borderR } = ABILITY_BAR;

    const startX = this._quickSlotsStartX();
    const startY = this.canvas.height - slotSize - paddingY;

    for (let i = 0; i < 4; i++) {
      const itemId = player.quickSlots[i];
      const def    = itemId ? (this.itemDefs?.[itemId]) : null;
      const bagSlot = itemId ? player.bag?.find(s => s?.itemId === itemId) : null;
      const qty    = bagSlot?.qty ?? 0;
      const sx     = startX + i * (slotSize + gap);
      const cx     = sx + slotSize / 2;
      const cy     = startY + slotSize / 2;

      // Background
      ctx.fillStyle   = "rgba(10, 10, 20, 0.85)";
      ctx.strokeStyle = def ? "rgba(100, 160, 100, 0.7)" : "rgba(60, 60, 80, 0.4)";
      ctx.lineWidth   = 1.5;
      this._roundRect(sx, startY, slotSize, slotSize, borderR);
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = 1;

      if (def) {
        // Item icon
        ctx.font      = "18px monospace";
        ctx.textAlign = "center";
        ctx.fillText(def.icon ?? "📦", cx, cy + 6);

        // Quantity
        if (qty > 1) {
          ctx.fillStyle = "#e8b84a";
          ctx.font      = "9px monospace";
          ctx.fillText(qty, sx + slotSize - 6, startY + slotSize - 4);
        }
      }

      // Keybind hint
      ctx.fillStyle = "rgba(180,180,180,0.5)";
      ctx.font      = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`[${i + 5}]`, cx, startY + slotSize - 6);

      ctx.textAlign = "left";
    }
  }

  // ── Bag icon ──────────────────────────────────────────────────────────────

  _drawBagIcon() {
    const { ctx }                              = this;
    const { slotSize, paddingY, borderR }      = ABILITY_BAR;

    const bx = this._bagIconX();
    const by = this.canvas.height - slotSize - paddingY;
    const cx = bx + slotSize / 2;
    const cy = by + slotSize / 2;

    ctx.fillStyle   = "rgba(10, 10, 20, 0.85)";
    ctx.strokeStyle = "rgba(120, 100, 60, 0.6)";
    ctx.lineWidth   = 1.5;
    this._roundRect(bx, by, slotSize, slotSize, borderR);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1;

    ctx.font      = "22px monospace";
    ctx.textAlign = "center";
    ctx.fillText("🎒", cx, cy + 8);

    ctx.fillStyle = "rgba(180,180,180,0.5)";
    ctx.font      = "9px monospace";
    ctx.fillText("[I]", cx, by + slotSize - 5);

    ctx.textAlign = "left";
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
