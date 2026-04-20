import { Camera }     from "./Camera.js";
import { getTileDef } from "../world/getTileDef.js";
import { TileFactory } from "./TileFactory.js";
import { ChunkLayer } from "./ChunkLayer.js";
import { drawSprite, SPRITE_COLORS } from "./CharacterSprites.js";
// ── Color constants ───────────────────────────────────────────────────────────
const WHITE = "#eeeeee";
const DIM   = "#888899";
const GOLD  = "#e8c84a";
// ── UI Layout constants ───────────────────────────────────────────────────────
const ABILITY_BAR = {
  slotSize: 50,
  gap:      6,
  paddingY: 12,
  borderR:  10,
  count:    6
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
    this.tileSize = 24;
    this.tileFactory = new TileFactory({ tileSize: this.tileSize });
    this.chunkLayer = new ChunkLayer({
      tileSize: this.tileSize,
      chunkSize: 32,
      tileFactory: this.tileFactory
    });
    this.camera = new Camera({ tileSize: this.tileSize });
    // Set by Engine
    this.currentTarget   = null;
    this.playerAbilities = [];
    this.abilities       = {};
    this.itemDefs        = {};
    this.player          = null;
    this.combatLog       = null;
    this.animSystem      = null;  // set by Engine
    this.effectSystem    = null;  // set by Engine
    // Set by Engine when in a town
    this.currentWorld    = null;
    this._lastWorld      = null;
    this.paused          = false;
    this._minimapCanvas  = null;
    this._minimapWorld   = null;
    this.elementalCharge = null;  // "frost" | "fire" | null
    this.eaglesEye       = null;
    this.castBar             = null;
    this.battleCry           = null;
    this.fortify             = null;
    this._whirlwindAnims     = [];
    this.groundTargeting     = null;  // { abilityId, range, radius } — targeting mode
    this.groundTargetingMouse = null; // { px, py } screen coords
    this.volleyZones         = [];    // active haze zones
    this._decorationImgs = {};    // cache: src -> HTMLImageElement
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
    if (!entity) return;
    const { ctx, tileSize, camera } = this;
    if (!ctx || !tileSize || !camera) return;
    const { sx, sy } = camera.worldToScreen(entity.x, entity.y);

    if (entity.type === "corpse")       { this._drawCorpse(entity, sx, sy); return; }
    if (entity.type === "friendly_npc") { this._drawFriendlyNPC(entity, sx, sy); return; }
    if (entity.type === "remote_player"){ this._drawRemotePlayer(entity, sx, sy); return; }

    const cx = sx + tileSize / 2;
    const cy = sy + tileSize / 2;

    // Get animation state
    const anim  = this.animSystem?.getEntityRenderState(entity.id, tileSize)
                  ?? { offsetX: 0, offsetY: 0, scaleY: 1, alpha: 1, flash: null };

    if (entity.type === "npc") {
      // Target indicator
      if (entity === this.currentTarget) {
        ctx.strokeStyle = "rgba(255,200,0,0.9)";
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.arc(cx, cy + tileSize * 0.4, tileSize * 0.35, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1;
      }
      // Alert ring
      if (entity.state === "alert") {
        ctx.strokeStyle = entity === this.currentTarget
          ? "rgba(255,200,0,0.6)" : "rgba(255,60,60,0.5)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx + anim.offsetX, cy + anim.offsetY, tileSize * 0.55, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1;
      }
      // Sprite — guard against unknown classId
      const npcClassId = entity.classId ?? entity.monsterId ?? "goblinMelee";
      drawSprite(ctx, npcClassId, cx + anim.offsetX, cy + anim.offsetY,
                 tileSize, SPRITE_COLORS[npcClassId], anim.alpha, anim);
      // Flash overlay
      if (anim.flash) {
        ctx.fillStyle = anim.flash;
        ctx.fillRect(sx, sy, tileSize, tileSize);
      }

    } else if (entity.type === "player") {
      // Player glow
      ctx.fillStyle = "rgba(255,220,80,0.12)";
      ctx.beginPath();
      ctx.arc(cx, cy, tileSize * 0.55, 0, Math.PI * 2);
      ctx.fill();
      // Sprite — guard against unknown classId
      const npcClassId = entity.classId ?? entity.monsterId ?? "goblinMelee";
      drawSprite(ctx, npcClassId, cx + anim.offsetX, cy + anim.offsetY,
                 tileSize, SPRITE_COLORS[npcClassId], anim.alpha, anim);
      // Flash overlay
      if (anim.flash) {
        ctx.fillStyle = anim.flash;
        ctx.fillRect(sx, sy, tileSize, tileSize);
      }
    }
  }
  // ── Friendly NPC ─────────────────────────────────────────────────────────
  _drawRemotePlayer(entity, sx, sy) {
    const { ctx, tileSize } = this;
    const cx = sx + tileSize / 2;
    const cy = sy + tileSize / 2;

    // Blue glow to distinguish from local player
    ctx.fillStyle = "rgba(40,80,220,0.20)";
    ctx.beginPath();
    ctx.arc(cx, cy, tileSize * 0.55, 0, Math.PI * 2);
    ctx.fill();

    // Sprite
    drawSprite(ctx, entity.classId, cx, cy, tileSize, SPRITE_COLORS[entity.classId]);

    // Name tag above
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    const nameW = ctx.measureText(entity.name ?? "").width + 6;
    ctx.fillRect(cx - nameW/2, sy - 14, nameW, 12);
    ctx.fillStyle = "#88ccff";
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.fillText(entity.name ?? "", cx, sy - 4);
    // Stun indicator
    if (entity._stunned) {
      ctx.font      = "14px serif";
      ctx.textAlign = "center";
      const pulse = 0.7 + 0.3 * Math.sin(Date.now() * 0.02);
      ctx.globalAlpha = pulse;
      ctx.fillText("💫", sx + tileSize / 2, sy - 4);
      ctx.globalAlpha = 1;
    } else if (entity._slowed) {
      ctx.font      = "10px serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#88aaff";
      ctx.fillText("❄", sx + tileSize / 2, sy - 4);
    }
    ctx.textAlign = "left";

    // HP bar below name
    const barW = tileSize;
    const hpPct = Math.max(0, (entity.hp ?? 0) / (entity.maxHp ?? 1));
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(sx, sy - 18, barW, 3);
    ctx.fillStyle = hpPct > 0.5 ? "#44cc44" : hpPct > 0.25 ? "#ccaa22" : "#cc3333";
    ctx.fillRect(sx, sy - 18, barW * hpPct, 3);
  }

  _drawFriendlyNPC(npc, sx, sy) {
    const { ctx, tileSize } = this;
    // Green background tile
    ctx.fillStyle   = "rgba(20, 80, 20, 0.7)";
    ctx.strokeStyle = "#44cc44";
    ctx.lineWidth   = 1.5;
    ctx.fillRect(sx + 1, sy + 1, tileSize - 2, tileSize - 2);
    ctx.strokeRect(sx + 1, sy + 1, tileSize - 2, tileSize - 2);
    ctx.lineWidth = 1;
    // Icon centered on tile
    ctx.font      = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(npc.icon ?? "👤", sx + tileSize / 2, sy + tileSize / 2 + 4);
    // Name label above tile
    ctx.fillStyle = "#88ee88";
    ctx.font      = "8px monospace";
    ctx.fillText(npc.name?.split(" ")[0] ?? "", sx + tileSize / 2, sy - 2);
    ctx.textAlign = "left";
  }
  // ── Main render ───────────────────────────────────────────────────────────
  render(world, entities = []) {
    const { ctx, tileSize, camera } = this;
    // Store world ref for overlay drawing
    this.currentWorld = world;
      // clear background
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    const tilesWide = Math.ceil(ctx.canvas.width  / tileSize) + 2;
    const tilesHigh = Math.ceil(ctx.canvas.height / tileSize) + 2;
    const startX = Math.floor(camera.x);
    const startY = Math.floor(camera.y);

    // ── Tiles — ChunkLayer (fast cached) ──
    if (this._lastWorld !== world) {
      this._lastWorld = world;
      this.chunkLayer.setWorld(world);
    }
    this.chunkLayer.draw(ctx, camera);

    // ── Town overlays ──
    this._drawTownOverlays(world, camera, tileSize);
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
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(10, 10, 260, 40);
      ctx.fillStyle = "#0f0";
      ctx.font = "12px monospace";
      ctx.fillText(
        `cam(tile)=(${camera.x.toFixed(2)}, ${camera.y.toFixed(2)})`,
        16, 34
      );
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
    // ── Decorations (ground layer — player walks in front) ──
    this._drawDecorations(world, camera, tileSize, "ground");

    // ── Entities ──
    for (const entity of entities) {
      if (!entity.dead) this.drawEntity(entity);
    }

    // ── Decorations (tall layer — player walks behind) ──
    this._drawDecorations(world, camera, tileSize, "tall");
    // ── Effect indicators ──
    if (this.effectSystem) {
      this._drawEffectIndicators(entities);
    }

    // ── Projectiles ──
    if (this.animSystem) {
      this._drawProjectiles();
      this._drawParticles(entities);
    }

    // ── HUD ──
    this._drawTargetFrame();
    this._drawPlayerFrame();
    this._drawAbilityBar();
    this._drawQuickSlots();
    this._drawBagIcon();
    this.combatLog?.draw(ctx, ctx.canvas.width, ctx.canvas.height);

    this._drawGroundTargeting();
    this._drawVolleyZones();
    this._drawElementalCharge();
    this._drawEaglesEye();
    this._drawCastBar();
    this._drawBattleCry();
    this._drawFortify();
    this._drawWhirlwindAnims();
    this._drawMinimap(entities);
    if (this.paused) this._drawPauseMenu();
  }
  // ── Town overlays ─────────────────────────────────────────────────────────
  _drawTownOverlays(world, camera, tileSize) {
    if (!world) return;
    const { ctx } = this;

    if (world.type !== "town") {
      // ── Overworld: draw town markers ──
      const towns = world._raw?.towns ?? world.towns ?? [];
      for (const town of towns) {
        const { sx, sy } = camera.worldToScreen(town.x, town.y);
        if (sx < -tileSize || sy < -tileSize ||
            sx > ctx.canvas.width + tileSize ||
            sy > ctx.canvas.height + tileSize) continue;
        ctx.fillStyle   = "rgba(20, 60, 20, 0.75)";
        ctx.strokeStyle = "#44cc44";
        ctx.lineWidth   = 1.5;
        ctx.fillRect(sx, sy, tileSize, tileSize);
        ctx.strokeRect(sx, sy, tileSize, tileSize);
        ctx.lineWidth = 1;
        ctx.font      = "10px monospace";
        ctx.textAlign = "center";
        ctx.fillText("🏰", sx + tileSize / 2, sy + tileSize / 2 + 3);
        ctx.fillStyle = "#88ee88";
        ctx.font      = "8px monospace";
        ctx.fillText(town.name, sx + tileSize / 2, sy - 2);
        ctx.textAlign = "left";
      }

      // ── Overworld: draw dungeon portal markers ──
      const portals = world._raw?.portals ?? world.portals ?? [];
      for (const portal of portals) {
        const { sx, sy } = camera.worldToScreen(portal.x, portal.y);
        if (sx < -tileSize || sy < -tileSize ||
            sx > ctx.canvas.width + tileSize ||
            sy > ctx.canvas.height + tileSize) continue;
        const pulse = 0.5 + 0.3 * Math.sin(Date.now() * 0.004);
        ctx.fillStyle   = `rgba(80, 30, 140, ${pulse})`;
        ctx.strokeStyle = "#aa55ff";
        ctx.lineWidth   = 1.5;
        ctx.fillRect(sx, sy, tileSize, tileSize);
        ctx.strokeRect(sx, sy, tileSize, tileSize);
        ctx.lineWidth = 1;
        ctx.font      = "10px monospace";
        ctx.textAlign = "center";
        ctx.fillText("🌀", sx + tileSize / 2, sy + tileSize / 2 + 3);
        ctx.fillStyle = "#cc99ff";
        ctx.font      = "8px monospace";
        ctx.fillText(portal.name ?? portal.campaignId, sx + tileSize / 2, sy - 2);
        ctx.textAlign = "left";
      }
      return;
    }

    // ── Town/dungeon map: draw pulsing exit markers ──
    for (const exit of (world.exits ?? [])) {
      const { sx, sy } = camera.worldToScreen(exit.x, exit.y);
      if (sx < -tileSize || sy < -tileSize ||
          sx > ctx.canvas.width + tileSize ||
          sy > ctx.canvas.height + tileSize) continue;
      const pulse = 0.45 + 0.3 * Math.sin(Date.now() * 0.003);
      ctx.fillStyle   = `rgba(80, 140, 255, ${pulse})`;
      ctx.strokeStyle = "#88aaff";
      ctx.lineWidth   = 1.5;
      ctx.fillRect(sx, sy, tileSize, tileSize);
      ctx.strokeRect(sx, sy, tileSize, tileSize);
      ctx.lineWidth = 1;
      ctx.fillStyle = "#aaccff";
      ctx.font      = "8px monospace";
      ctx.textAlign = "center";
      ctx.fillText("Exit", sx + tileSize / 2, sy - 2);
      ctx.textAlign = "left";
    }
  }
  // ── Projectiles ──────────────────────────────────────────────────────────
  _drawProjectiles() {
    const { ctx, camera, tileSize } = this;
    for (const p of this.animSystem.projectiles) {
      const { sx: x1, sy: y1 } = camera.worldToScreen(p.x, p.y);
      const progress = p.elapsed / p.duration;

      ctx.save();
      ctx.translate(x1 + tileSize/2, y1 + tileSize/2);
      ctx.rotate(p.angle);

      if (p.type === "arrow") {
        // Arrow shaft
        ctx.fillStyle = p.color;
        ctx.fillRect(-tileSize * 0.5, -1.5, tileSize * 0.5, 3);
        // Arrowhead
        ctx.fillStyle = "#aaaaaa";
        ctx.beginPath();
        ctx.moveTo(2,  0);
        ctx.lineTo(-6, -4);
        ctx.lineTo(-6,  4);
        ctx.fill();
        // Fletching
        ctx.fillStyle = "#e74c3c";
        ctx.fillRect(-tileSize*0.5, -3, 6, 2);
        ctx.fillRect(-tileSize*0.5,  1, 6, 2);
      } else if (p.type === "holy") {
        // Holy bolt — glowing cross
        ctx.fillStyle = "#ffffcc";
        ctx.globalAlpha = 0.9;
        ctx.fillRect(-8, -2, 16, 4);
        ctx.fillRect(-2, -8, 4, 16);
        ctx.fillStyle = "rgba(255,255,180,0.4)";
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI*2);
        ctx.fill();
      } else {
        // Generic spell bolt
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.beginPath();
        ctx.arc(-2, -2, 2, 0, Math.PI*2);
        ctx.fill();
      }

      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  _drawParticles(entities) {
    const { ctx, camera, tileSize } = this;
    for (const p of this.animSystem.particles) {
      // AOE marker
      if (p.type === "aoe") {
        const { sx, sy } = camera.worldToScreen(p.x, p.y);
        ctx.globalAlpha = p.alpha * 0.6;
        ctx.fillStyle   = p.color;
        ctx.beginPath();
        ctx.arc(sx + tileSize/2, sy + tileSize/2, p.radius * tileSize, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1;
        continue;
      }

      // Entity-attached particles
      if (p.entityId) {
        const entity = entities.find(e => e.id === p.entityId);
        if (!entity) continue;
        const { sx, sy } = camera.worldToScreen(entity.x, entity.y);
        const ex = sx + tileSize/2 + p.offsetX + p.vx * p.elapsed;
        const ey = sy + tileSize/2 + p.offsetY + p.vy * p.elapsed;
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle   = p.color;
        ctx.beginPath();
        ctx.arc(ex, ey, p.size, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  // ── Effect indicators ─────────────────────────────────────────────────
  _drawEffectIndicators(entities) {
    const { ctx, camera, tileSize } = this;

    for (const entity of entities) {
      if (entity.dead) continue;
      const effects = this.effectSystem.getEffects(entity.id);
      if (!effects.length) continue;

      const { sx, sy } = camera.worldToScreen(entity.x, entity.y);
      const cx = sx + tileSize / 2;

      // Draw effect icons in a row above the entity
      const iconSize = Math.max(8, tileSize * 0.3);
      const totalW   = effects.length * (iconSize + 2);
      let iconX      = cx - totalW / 2;
      const iconY    = sy - iconSize - 4;

      ctx.font         = `${iconSize}px serif`;
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";

      for (const effect of effects) {
        // Background pip
        const barColor = effect.category === "buff" ? "#224422"
          : effect.category === "hot"  ? "#224422"
          : effect.category === "dot"  ? "#442222"
          : "#222244";

        ctx.fillStyle = barColor;
        ctx.fillRect(iconX, iconY - iconSize/2, iconSize, iconSize);

        // Icon
        ctx.globalAlpha = 0.9;
        ctx.fillText(effect.icon ?? "?", iconX + iconSize/2, iconY);
        ctx.globalAlpha = 1;

        // Duration bar underneath
        const pct = 1 - effect.elapsed / effect.duration;
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(iconX, iconY + iconSize/2, iconSize, 2);
        ctx.fillStyle = effect.color ?? "#ffffff";
        ctx.fillRect(iconX, iconY + iconSize/2, iconSize * pct, 2);

        iconX += iconSize + 2;
      }

      ctx.textBaseline = "alphabetic";
      ctx.textAlign    = "left";
    }
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
    const x = (ctx.canvas.width - width) / 2;
    const y = ctx.canvas.height - abilityBarH - height - 6;
    ctx.fillStyle = "rgba(10, 10, 20, 0.85)";
    this._roundRect(x, y, width, height, borderR);
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 160, 100, 0.6)";
    ctx.lineWidth   = 1.5;
    this._roundRect(x, y, width, height, borderR);
    ctx.stroke();
    ctx.lineWidth = 1;
    const portX = x + paddingX;
    const portY = y + (height - portraitSize) / 2;
    const classColor  = this._classColor();
    ctx.fillStyle     = "rgba(20, 20, 35, 0.9)";
    ctx.strokeStyle   = classColor;
    ctx.lineWidth     = 1.5;
    ctx.fillRect(portX, portY, portraitSize, portraitSize);
    ctx.strokeRect(portX, portY, portraitSize, portraitSize);
    ctx.lineWidth = 1;
    const initial = (player.classId ?? "?")[0].toUpperCase();
    ctx.fillStyle = classColor;
    ctx.font      = `bold 18px monospace`;
    ctx.textAlign = "center";
    ctx.fillText(initial, portX + portraitSize / 2, portY + portraitSize / 2 + 6);
    ctx.textAlign = "left";
    const xpPct    = Math.min(1, (player.xp ?? 0) / Math.max(1,
      100 * Math.pow(player.level ?? 1, 1.5)));
    const ringCx   = portX + portraitSize / 2;
    const ringCy   = portY + portraitSize / 2;
    const ringR    = portraitSize / 2 + 3;
    ctx.strokeStyle = "rgba(60,40,10,0.6)";
    ctx.lineWidth   = 2.5;
    ctx.beginPath();
    ctx.arc(ringCx, ringCy, ringR, 0, Math.PI * 2);
    ctx.stroke();
    if (xpPct > 0) {
      const startA  = -Math.PI / 2;
      const endA    = startA + Math.PI * 2 * xpPct;
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
    ctx.fillStyle = "rgba(200,160,50,0.8)";
    ctx.font      = `bold 9px monospace`;
    ctx.textAlign = "center";
    ctx.fillText(`Lv ${player.level ?? 1}`, portX + portraitSize / 2, portY + portraitSize + 11);
    ctx.textAlign = "left";
    const barsX = portX + portraitSize + paddingX;
    const barsW = width - portraitSize - paddingX * 3;
    const nameH      = 14;
    const totalBarsH = nameH + barHeight * 2 + barGap + 4;
    const barsY      = y + (height - totalBarsH) / 2;
    ctx.fillStyle = WHITE;
    ctx.font      = `bold 11px monospace`;
    ctx.fillText(player.name ?? "Hero", barsX, barsY + nameH - 2);
    this._drawResourceBar(
      ctx, barsX, barsY + nameH + 2, barsW, barHeight,
      player.hp, player.maxHp,
      "#44cc44", "#cc3333", "#ccaa22",
      `${Math.ceil(player.hp)} / ${player.maxHp}`
    );
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
  _drawResourceBar(ctx, x, y, w, h, current, max, colorHigh, colorLow, colorMid, label) {
    const pct = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
    ctx.fillStyle = "#222233";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = colorHigh === colorLow
      ? colorHigh
      : pct > 0.5 ? colorHigh : pct > 0.25 ? colorMid : colorLow;
    ctx.fillRect(x, y, w * pct, h);
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
    const hasTarget = this.currentTarget && !this.currentTarget.dead;
    const cooldowns = this.player?.abilityCooldowns ?? {};
    const resource  = this.player?.resource  ?? 0;
    const resDef    = this.player?.resourceDef;

    for (let i = 0; i < abilities.length; i++) {
      const ability = abilities[i];
      const sx = startX + i * (slotSize + gap);
      const sy = startY;
      const cx = sx + slotSize / 2;
      const cy = sy + slotSize / 2;

      const cd      = cooldowns[ability.id] ?? null;
      const onCD    = cd && cd.remaining > 0;

      // Check if player can afford this ability
      const manaCost = ability.cost?.mana ?? 0;
      const rageCost = ability.cost?.rage ?? 0;
      const noMana   = manaCost > 0 && resource < manaCost;
      const noRage   = rageCost > 0 && resource < rageCost;
      const noResource = noMana || noRage;

      // Is this an elemental charge ability that matches active charge?
      // Eagle's Eye active — glow on all ranged slots
      const isEaglesEyeActive = this.eaglesEye && Date.now() < this.eaglesEye.expiresAt;
      const isChargeAbility = ability.tags?.includes("charge");
      const chargeActive    = isChargeAbility &&
        ((this.elementalCharge === "frost" && ability.id === "frost_arrow") ||
         (this.elementalCharge === "fire"  && ability.id === "fire_arrow"));

      // Slot background
      ctx.fillStyle = onCD
        ? "rgba(6, 6, 14, 0.92)"
        : noResource
          ? "rgba(14, 6, 6, 0.92)"   // dark red tint = no resource
          : "rgba(10, 10, 20, 0.88)";
      this._roundRect(sx, sy, slotSize, slotSize, borderR);
      ctx.fill();

      // Slot border — charge active = elemental color, eagles eye = green glow
      const isRanged = ability.type === "ranged" || ability.tags?.includes("ranged");
      if (chargeActive) {
        const pulse = 0.7 + 0.3 * Math.sin(Date.now() * 0.008);
        ctx.strokeStyle = this.elementalCharge === "frost"
          ? `rgba(100,180,255,${pulse})`
          : `rgba(255,120,30,${pulse})`;
      } else if (isEaglesEyeActive && isRanged && !onCD && !noResource) {
        const pulse = 0.6 + 0.4 * Math.sin(Date.now() * 0.006);
        ctx.strokeStyle = `rgba(80,220,120,${pulse})`;
      } else {
        ctx.strokeStyle = onCD
          ? "rgba(80, 80, 100, 0.5)"
          : noResource
            ? "rgba(160, 50, 50, 0.6)"   // red border = can't afford
            : hasTarget
              ? "rgba(255, 180, 50, 0.85)"
              : "rgba(120, 120, 140, 0.55)";
      }
      ctx.lineWidth = 1.5;
      this._roundRect(sx, sy, slotSize, slotSize, borderR);
      ctx.stroke();
      ctx.lineWidth = 1;

      // Ability name — grayed if on CD or no resource
      ctx.fillStyle = (onCD || noResource) ? "rgba(130,130,130,0.7)" : "#ffffff";
      ctx.font      = "bold 10px monospace";
      ctx.textAlign = "center";
      this._drawWrappedText(ability.name, cx, sy + 18, slotSize - 8, 12);

      // Type/range label
      ctx.fillStyle = onCD || noResource
        ? "rgba(100,100,120,0.6)"
        : ability.type === "melee" ? "#ffaa55" : "#88aaff";
      ctx.font = "9px monospace";
      ctx.fillText(
        ability.type === "melee" ? "MELEE" : `${ability.range ?? 0}t`,
        cx, sy + slotSize - 18
      );

      // Mana cost hint when player is low — show cost in red
      if (noResource && !onCD) {
        ctx.fillStyle = "rgba(255,80,80,0.8)";
        ctx.font      = "8px monospace";
        ctx.fillText(manaCost > 0 ? `${manaCost}mp` : `${rageCost}rage`, cx, sy + slotSize - 18);
      }

      // Keybind
      ctx.fillStyle = "rgba(200,200,200,0.55)";
      ctx.font      = "10px monospace";
      ctx.fillText(`[${i + 1}]`, cx, sy + slotSize - 6);
      ctx.textAlign = "left";

      if (onCD) {
        this._drawCooldownRing(cx, cy, slotSize, cd);
      }

      // Gray overlay for no-resource (distinct from cooldown ring)
      if (noResource && !onCD) {
        ctx.fillStyle = "rgba(80, 0, 0, 0.25)";
        this._roundRect(sx, sy, slotSize, slotSize, borderR);
        ctx.fill();
      }
    }
  }
  // ── Decoration Layer ─────────────────────────────────────────────────────

  /**
   * Draw decoration props for the given zOrder pass.
   * Decorations live in world.decorations[] (stored in Supabase world JSON):
   *   { src, x, y, w, h, zOrder }
   *   src     — filename in src/assets/decorations/ (e.g. "giant_oak.png")
   *   x, y    — world tile position (top-left corner of the prop)
   *   w, h    — size in tiles (default 1×1)
   *   zOrder  — "ground" (player in front) or "tall" (player behind)
   */
  _drawDecorations(world, camera, tileSize, zOrder) {
    const decorations = world?._raw?.decorations ?? world?.decorations ?? [];
    if (!decorations.length) return;
    const { ctx } = this;

    for (const dec of decorations) {
      if ((dec.zOrder ?? "ground") !== zOrder) continue;

      const w = dec.w ?? 1;
      const h = dec.h ?? 1;

      // Frustum cull — skip if entirely off screen
      const { sx, sy } = camera.worldToScreen(dec.x, dec.y);
      const drawW = w * tileSize;
      const drawH = h * tileSize;
      if (sx + drawW < 0 || sy + drawH < 0 ||
          sx > ctx.canvas.width || sy > ctx.canvas.height) continue;

      const img = this._getDecorationImg(dec.src);
      if (!img) continue; // still loading

      ctx.drawImage(img, sx, sy, drawW, drawH);
    }
  }

  /** Load and cache a decoration image. Returns null while loading. */
  _getDecorationImg(src) {
    if (this._decorationImgs[src]) return this._decorationImgs[src];

    // Mark as loading so we don't spawn duplicate requests
    this._decorationImgs[src] = null;
    const img = new Image();
    img.src = `./src/assets/decorations/${src}`;
    img.onload  = () => { this._decorationImgs[src] = img; };
    img.onerror = () => {
      console.warn(`[Renderer] Decoration not found: ${src}`);
      // Use a sentinel so we don't retry every frame
      this._decorationImgs[src] = undefined;
    };
    return null;
  }

  // ── Ground Targeting (Volley placement) ──────────────────────────────────
  _drawGroundTargeting() {
    if (!this.groundTargeting || !this.groundTargetingMouse) return;
    const { ctx, camera } = this;
    const tileSize = camera.tileSize;
    const { px, py }  = this.groundTargetingMouse;
    const worldPos    = camera.screenToWorldF(px, py);
    const { range, radius } = this.groundTargeting;

    // Clamp to max range from player
    const player = this.player;
    if (!player) return;
    const dx    = worldPos.x - player.x;
    const dy    = worldPos.y - player.y;
    const dist  = Math.sqrt(dx*dx + dy*dy);
    const clamp = dist > range ? range / dist : 1;
    const cx    = player.x + dx * clamp;
    const cy    = player.y + dy * clamp;

    const { sx, sy } = camera.worldToScreen(cx, cy);
    const screenR    = radius * tileSize;

    // Max range ring around player
    const { sx: psx, sy: psy } = camera.worldToScreen(player.x, player.y);
    ctx.strokeStyle = "rgba(255,80,80,0.25)";
    ctx.lineWidth   = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(psx + tileSize/2, psy + tileSize/2, range * tileSize, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Volley impact circle at cursor
    const pulse = 0.5 + 0.3 * Math.sin(Date.now() * 0.01);
    ctx.fillStyle   = `rgba(220,50,50,${pulse * 0.25})`;
    ctx.strokeStyle = `rgba(255,80,80,${pulse * 0.9})`;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(sx + tileSize/2, sy + tileSize/2, screenR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1;

    // "CLICK TO PLACE" label
    ctx.fillStyle = "rgba(255,180,180,0.9)";
    ctx.font      = "bold 10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("CLICK TO PLACE", sx + tileSize/2, sy + tileSize/2 - screenR - 6);
    ctx.textAlign = "left";
  }

  _drawVolleyZones() {
    const now    = Date.now();
    const { ctx, camera } = this;
    const tileSize = camera.tileSize;

    // Remove expired zones
    this.volleyZones = this.volleyZones.filter(z => now < z.expiresAt);

    for (const zone of this.volleyZones) {
      const progress = (now - zone.startedAt) / zone.duration; // 0→1
      const alpha    = Math.max(0, (1 - progress) * 0.45);
      const { sx, sy } = camera.worldToScreen(zone.wx, zone.wy);
      const screenR    = zone.radius * tileSize;

      // Red haze
      ctx.fillStyle = `rgba(220,50,30,${alpha})`;
      ctx.beginPath();
      ctx.arc(sx + tileSize/2, sy + tileSize/2, screenR, 0, Math.PI * 2);
      ctx.fill();

      // Arrow rain particles — simple dashes
      const seed = Math.floor(now / 200) + zone.wx * 13 + zone.wy * 7;
      ctx.strokeStyle = `rgba(255,120,80,${alpha * 1.5})`;
      ctx.lineWidth   = 1.5;
      for (let i = 0; i < 6; i++) {
        const angle  = (seed * 2654435761 + i * 999983) % 360;
        const r      = ((seed * 1234567 + i * 7654321) % 100) / 100 * screenR;
        const ax     = sx + tileSize/2 + Math.cos(angle) * r;
        const ay     = sy + tileSize/2 + Math.sin(angle) * r;
        ctx.beginPath();
        ctx.moveTo(ax, ay - 8);
        ctx.lineTo(ax, ay + 4);
        ctx.stroke();
      }
      ctx.lineWidth = 1;
    }
  }

  // ── Elemental Charge Indicator ───────────────────────────────────────────
  _drawElementalCharge() {
    if (!this.elementalCharge) return;
    const { ctx } = this;
    const { slotSize, gap, paddingY, borderR } = ABILITY_BAR;
    const isFrost = this.elementalCharge === "frost";
    const icon    = isFrost ? "❄️" : "🔥";
    const label   = isFrost ? "FROST CHARGED" : "FIRE CHARGED";
    const color   = isFrost ? "rgba(100,180,255,0.95)" : "rgba(255,140,40,0.95)";
    const bgColor = isFrost ? "rgba(20,40,80,0.85)"    : "rgba(80,30,10,0.85)";

    // Small pill badge centered just above the ability bar
    const abilities = (this.playerAbilities ?? []).slice(0, ABILITY_BAR.count);
    const totalW    = abilities.length * slotSize + (abilities.length - 1) * gap;
    const barStartX = (ctx.canvas.width - totalW) / 2;
    const barStartY = ctx.canvas.height - slotSize - paddingY;

    ctx.font = "bold 11px monospace";
    const textW  = ctx.measureText(`${icon} ${label}`).width;
    const padX   = 10;
    const pillW  = textW + padX * 2;
    const pillH  = 18;
    const pillX  = barStartX + totalW / 2 - pillW / 2;
    const pillY  = barStartY - pillH - 4;

    // Pulsing alpha
    const pulse = 0.85 + 0.15 * Math.sin(Date.now() * 0.008);
    ctx.globalAlpha = pulse;

    // Background pill
    ctx.fillStyle = bgColor;
    this._roundRect(pillX, pillY, pillW, pillH, 6);
    ctx.fill();

    // Border
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.5;
    this._roundRect(pillX, pillY, pillW, pillH, 6);
    ctx.stroke();
    ctx.lineWidth = 1;

    // Text
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.fillText(`${icon} ${label}`, pillX + pillW / 2, pillY + 13);
    ctx.textAlign    = "left";
    ctx.globalAlpha  = 1;
  }

  _drawCastBar() {
    if (!this.castBar) return;
    const { ctx } = this;
    const elapsed  = Date.now() - this.castBar.startedAt;
    const progress = Math.min(1, elapsed / this.castBar.duration);

    const barW = 220;
    const barH = 18;
    const barX = (ctx.canvas.width - barW) / 2;
    const barY = ctx.canvas.height / 2 + 40;

    // Background
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    this._roundRect(barX - 2, barY - 2, barW + 4, barH + 4, 4);
    ctx.fill();

    // Fill
    const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    grad.addColorStop(0, "rgba(180,120,40,0.9)");
    grad.addColorStop(1, "rgba(240,200,60,0.9)");
    ctx.fillStyle = grad;
    this._roundRect(barX, barY, barW * progress, barH, 3);
    ctx.fill();

    // Border
    ctx.strokeStyle = "rgba(200,160,50,0.7)";
    ctx.lineWidth   = 1.5;
    this._roundRect(barX, barY, barW, barH, 3);
    ctx.stroke();
    ctx.lineWidth = 1;

    // Label
    ctx.fillStyle = "#ffffff";
    ctx.font      = "bold 11px monospace";
    ctx.textAlign = "center";
    ctx.fillText("🎯 Casting...", ctx.canvas.width / 2, barY + 13);
    ctx.textAlign = "left";
  }

  /** Trigger whirlwind animation centered on player */
  spawnWhirlwind(x, y, radius) {
    // Boost visual radius so it looks impactful
    this._whirlwindAnims.push({ x, y, radius: radius + 1.5, startedAt: Date.now(), duration: 550 });
  }

  _drawWhirlwindAnims() {
    const now = Date.now();
    this._whirlwindAnims = this._whirlwindAnims.filter(a => now < a.startedAt + a.duration);
    for (const anim of this._whirlwindAnims) {
      const { ctx, camera } = this;
      const tileSize = camera.tileSize;
      const progress = (now - anim.startedAt) / anim.duration; // 0→1
      const ease     = Math.sin(progress * Math.PI); // peak in middle, fade out
      const { sx, sy } = camera.worldToScreen(anim.x, anim.y);
      const cx = sx + tileSize / 2;
      const cy = sy + tileSize / 2;
      const screenR = anim.radius * tileSize;
      const numArcs = 8;

      // Outer ring
      ctx.strokeStyle = `rgba(255, 200, 60, ${ease * 0.4})`;
      ctx.lineWidth   = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, screenR, 0, Math.PI * 2);
      ctx.stroke();

      // Spinning arc blades
      for (let i = 0; i < numArcs; i++) {
        const angle = (i / numArcs) * Math.PI * 2 + progress * Math.PI * 6;
        const ax = cx + Math.cos(angle) * screenR * (0.4 + progress * 0.6);
        const ay = cy + Math.sin(angle) * screenR * (0.4 + progress * 0.6);
        const alpha = ease;
        ctx.strokeStyle = `rgba(255, 160, 30, ${alpha})`;
        ctx.lineWidth   = 3.5;
        ctx.beginPath();
        ctx.arc(ax, ay, tileSize * 0.35, angle + Math.PI * 0.6, angle + Math.PI * 1.4);
        ctx.stroke();
        // Bright inner highlight
        ctx.strokeStyle = `rgba(255, 240, 160, ${alpha * 0.7})`;
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.arc(ax, ay, tileSize * 0.15, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Central flash
      ctx.strokeStyle = `rgba(255, 255, 200, ${ease * 0.5})`;
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, screenR * 0.3, 0, Math.PI * 2);
      ctx.stroke();

      ctx.lineWidth = 1;
    }
  }

  _drawBattleCry() {
    if (!this.battleCry || Date.now() >= this.battleCry.expiresAt) { this.battleCry = null; return; }
    const secsLeft = Math.ceil((this.battleCry.expiresAt - Date.now()) / 1000);
    this._drawBuffPill("⚔️ BATTLE CRY", `${secsLeft}s`, "rgba(255,140,30,0.95)", "rgba(80,30,5,0.85)", 0);
  }

  _drawFortify() {
    if (!this.fortify || Date.now() >= this.fortify.expiresAt) { this.fortify = null; return; }
    const secsLeft = Math.ceil((this.fortify.expiresAt - Date.now()) / 1000);
    this._drawBuffPill("🏰 FORTIFY", `${secsLeft}s`, "rgba(100,180,255,0.95)", "rgba(10,30,60,0.85)", 1);
  }

  /** Draw a generic buff pill above the ability bar */
  _drawBuffPill(label, sublabel, color, bgColor, slot) {
    const { ctx } = this;
    const { slotSize, gap, paddingY } = ABILITY_BAR;
    const abilities = (this.playerAbilities ?? []).slice(0, ABILITY_BAR.count);
    const totalW    = abilities.length * slotSize + (abilities.length - 1) * gap;
    const barStartX = (ctx.canvas.width - totalW) / 2;
    const barStartY = ctx.canvas.height - slotSize - paddingY;
    const text  = `${label} (${sublabel})`;
    ctx.font    = "bold 11px monospace";
    const textW = ctx.measureText(text).width;
    const padX  = 10;
    const pillW = textW + padX * 2;
    const pillH = 18;
    const pillX = barStartX + totalW / 2 - pillW / 2 + slot * (pillW + 8);
    const pillY = barStartY - pillH - 4;
    const pulse = 0.85 + 0.15 * Math.sin(Date.now() * 0.008);
    ctx.globalAlpha = pulse;
    ctx.fillStyle   = bgColor;
    this._roundRect(pillX, pillY, pillW, pillH, 6); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 1.5;
    this._roundRect(pillX, pillY, pillW, pillH, 6); ctx.stroke();
    ctx.lineWidth = 1; ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.fillText(text, pillX + pillW / 2, pillY + 13);
    ctx.textAlign = "left"; ctx.globalAlpha = 1;
  }

  _drawEaglesEye() {
    if (!this.eaglesEye || Date.now() >= this.eaglesEye.expiresAt) {
      this.eaglesEye = null;
      return;
    }
    const { ctx } = this;
    const { slotSize, gap, paddingY, borderR } = ABILITY_BAR;
    const abilities = (this.playerAbilities ?? []).slice(0, ABILITY_BAR.count);
    const totalW    = abilities.length * slotSize + (abilities.length - 1) * gap;
    const barStartX = (ctx.canvas.width - totalW) / 2;
    const barStartY = ctx.canvas.height - slotSize - paddingY;

    // Show remaining time
    const secsLeft = Math.ceil((this.eaglesEye.expiresAt - Date.now()) / 1000);
    const label    = `🦅 +${this.eaglesEye.rangeBonus} RANGE (${secsLeft}s)`;

    ctx.font = "bold 11px monospace";
    const textW = ctx.measureText(label).width;
    const padX  = 10;
    const pillW = textW + padX * 2;
    const pillH = 18;
    // Place to right of elemental charge pill if both active
    const offsetX = this.elementalCharge ? pillW + 8 : 0;
    const pillX   = barStartX + totalW / 2 - pillW / 2 + offsetX;
    const pillY   = barStartY - pillH - 4;

    const pulse = 0.85 + 0.15 * Math.sin(Date.now() * 0.006);
    ctx.globalAlpha = pulse;
    ctx.fillStyle   = "rgba(20,60,30,0.85)";
    this._roundRect(pillX, pillY, pillW, pillH, 6);
    ctx.fill();
    ctx.strokeStyle = "rgba(80,220,120,0.9)";
    ctx.lineWidth   = 1.5;
    this._roundRect(pillX, pillY, pillW, pillH, 6);
    ctx.stroke();
    ctx.lineWidth   = 1;
    ctx.fillStyle   = "rgba(80,220,120,0.95)";
    ctx.textAlign   = "center";
    ctx.fillText(label, pillX + pillW / 2, pillY + 13);
    ctx.textAlign   = "left";
    ctx.globalAlpha = 1;
  }

  // ── Minimap ───────────────────────────────────────────────────────────────
  _drawMinimap(entities) {
    const world = this.currentWorld;
    if (!world || !this.player) return;
    const { ctx } = this;

    // Fixed 192px (8 × 24px standard tile size) — never scales with zoom
    const tileSize  = this.camera.tileSize;
    const mapPx     = 192;
    const padding   = 10;
    const mx        = padding;           // top-left X
    const my        = padding;           // top-left Y

    // ── Rebuild offscreen terrain canvas when world changes ──
    if (this._minimapWorld !== world) {
      this._minimapWorld  = world;
      this._minimapCanvas = this._buildMinimapTerrain(world, mapPx);
    }

    // ── Panel background ──
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.strokeStyle = "rgba(100,100,140,0.6)";
    ctx.lineWidth = 1.5;
    this._roundRect(mx - 3, my - 3, mapPx + 6, mapPx + 6, 5);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1;

    // ── Draw cached terrain ──
    if (this._minimapCanvas) {
      ctx.drawImage(this._minimapCanvas, mx, my, mapPx, mapPx);
    }

    // Scale factors: world tile → minimap pixel
    const scaleX = mapPx / world.width;
    const scaleY = mapPx / world.height;

    // ── Towns ──
    const towns = world._raw?.towns ?? world.towns ?? [];
    for (const t of towns) {
      const tx = mx + t.x * scaleX;
      const ty = my + t.y * scaleY;
      ctx.fillStyle = "#44cc44";
      ctx.beginPath();
      ctx.arc(tx, ty, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Portals ──
    const portals = world._raw?.portals ?? world.portals ?? [];
    for (const p of portals) {
      const px = mx + p.x * scaleX;
      const py = my + p.y * scaleY;
      ctx.fillStyle = "#aa55ff";
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── NPCs ──
    for (const e of entities) {
      if (e.type !== "npc" || e.dead) continue;
      const ex = mx + e.x * scaleX;
      const ey = my + e.y * scaleY;
      ctx.fillStyle = e.state === "alert" ? "#ff4444" : "#cc8844";
      ctx.fillRect(ex - 1, ey - 1, 2, 2);
    }

    // ── Player ──
    const px = mx + this.player.x * scaleX;
    const py = my + this.player.y * scaleY;
    // Viewport rect
    const vpW = (this.canvas.width  / tileSize) * scaleX;
    const vpH = (this.canvas.height / tileSize) * scaleY;
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth   = 0.5;
    ctx.strokeRect(px - vpW/2, py - vpH/2, vpW, vpH);
    ctx.lineWidth   = 1;
    // Player dot
    ctx.fillStyle   = "#ffffff";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.arc(px, py, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1;

    // ── Border ──
    ctx.strokeStyle = "rgba(120,120,180,0.5)";
    ctx.strokeRect(mx, my, mapPx, mapPx);
  }

  /** Build an offscreen canvas with terrain colours — only rebuilt on world change */
  _buildMinimapTerrain(world, mapPx) {
    const c   = document.createElement("canvas");
    c.width   = mapPx;
    c.height  = mapPx;
    const ctx = c.getContext("2d");

    // Terrain colour palette keyed by tile ID
    const COLORS = {
      0:  "#2d5a24",  // grass
      1:  "#163a12",  // forest
      2:  "#4a3e2e",  // mountain
      3:  "#0f2a4a",  // deep water
      4:  "#1a4a6a",  // shallow water
      5:  "#a07818",  // town tile
      6:  "#4a1010",  // danger
      7:  "#b89858",  // sand
      8:  "#111118",  // wall
      9:  "#1e1810",  // floor
      12: "#6b3e10",  // door
      13: "#9a7818",  // chest
      14: "#602090",  // portal tile
      15: "#0a2a14",  // jungle
      20: "#4a4038",  // town floor
      21: "#141008",  // town wall
      27: "#6b4a2e",  // road dirt
      28: "#5a5d62",  // road stone
      29: "#111118",  // road obsidian
      33: "#3a2810",  // road bridge
    };

    const sw = mapPx / world.width;   // screen pixels per world tile
    const sh = mapPx / world.height;

    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        const tileId = world.getTile(x, y);
        ctx.fillStyle = COLORS[tileId] ?? "#1a1a2a";
        ctx.fillRect(
          Math.floor(x * sw),
          Math.floor(y * sh),
          Math.ceil(sw) + 1,
          Math.ceil(sh) + 1
        );
      }
    }
    return c;
  }

  // ── Pause Menu ────────────────────────────────────────────────────────────
  _drawPauseMenu() {
    const { ctx } = this;
    const cw = ctx.canvas.width;
    const ch = ctx.canvas.height;

    // Dim overlay
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(0, 0, cw, ch);

    // Panel
    const pw = 280, ph = 240;
    const px = (cw - pw) / 2;
    const py = (ch - ph) / 2;

    ctx.fillStyle = "rgba(10,10,25,0.97)";
    this._roundRect(px, py, pw, ph, 14);
    ctx.fill();
    ctx.strokeStyle = "rgba(120,120,180,0.7)";
    ctx.lineWidth = 2;
    this._roundRect(px, py, pw, ph, 14);
    ctx.stroke();
    ctx.lineWidth = 1;

    // Title
    ctx.fillStyle = "#e8c84a";
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "center";
    ctx.fillText("⚙  MENU", cw / 2, py + 38);

    // Divider
    ctx.strokeStyle = "rgba(120,120,180,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + 20, py + 50);
    ctx.lineTo(px + pw - 20, py + 50);
    ctx.stroke();

    const buttons = this.getPauseMenuButtons();
    const labels  = { resume: "▶  Return to Game", save: "💾  Save Game", quit: "🚪  Leave Game" };
    for (const btn of buttons) {
      ctx.fillStyle   = "rgba(30,30,55,0.9)";
      ctx.strokeStyle = btn.id === "quit" ? "rgba(180,60,60,0.6)" : "rgba(100,100,160,0.5)";
      ctx.lineWidth   = 1.5;
      this._roundRect(btn.x, btn.y, btn.w, btn.h, 8);
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth  = 1;
      ctx.fillStyle  = btn.id === "quit" ? "#ff8888" : "#ddddee";
      ctx.font       = "bold 12px monospace";
      ctx.textAlign  = "center";
      ctx.fillText(labels[btn.id], btn.x + btn.w / 2, btn.y + btn.h / 2 + 5);
    }
    ctx.textAlign = "left";
  }

  getPauseMenuButtons() {
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const pw = 280, ph = 240;
    const px = (cw - pw) / 2;
    const py = (ch - ph) / 2;
    const bw = pw - 40, bh = 44, bx = px + 20;
    return [
      { id: "resume", x: bx, y: py + 66,  w: bw, h: bh },
      { id: "save",   x: bx, y: py + 118, w: bw, h: bh },
      { id: "quit",   x: bx, y: py + 170, w: bw, h: bh }
    ];
  }

  _drawCooldownRing(cx, cy, slotSize, cd) {
    const { ctx } = this;
    const radius   = slotSize * 0.38;
    const progress = cd.remaining / cd.max;
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(60, 60, 80, 0.7)";
    ctx.lineWidth   = 3.5;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    const startAngle = -Math.PI / 2;
    const endAngle   = startAngle + (Math.PI * 2 * progress);
    ctx.strokeStyle = "rgba(220, 180, 60, 0.9)";
    ctx.lineWidth   = 3.5;
    ctx.lineCap     = "round";
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle, false);
    ctx.stroke();
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
    const alpha = Math.max(0.2, 1 - corpse.despawnProgress * 0.8);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = corpse.hasLoot ? "#cc9922" : "#555555";
    ctx.lineWidth   = 2;
    const pad = 4;
    ctx.beginPath();
    ctx.moveTo(sx + pad,            sy + pad);
    ctx.lineTo(sx + tileSize - pad, sy + tileSize - pad);
    ctx.moveTo(sx + tileSize - pad, sy + pad);
    ctx.lineTo(sx + pad,            sy + tileSize - pad);
    ctx.stroke();
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
      ctx.fillStyle   = "rgba(10, 10, 20, 0.85)";
      ctx.strokeStyle = def ? "rgba(100, 160, 100, 0.7)" : "rgba(60, 60, 80, 0.4)";
      ctx.lineWidth   = 1.5;
      this._roundRect(sx, startY, slotSize, slotSize, borderR);
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = 1;
      if (def) {
        ctx.font      = "18px monospace";
        ctx.textAlign = "center";
        ctx.fillText(def.icon ?? "📦", cx, cy + 6);
        if (qty > 1) {
          ctx.fillStyle = "#e8b84a";
          ctx.font      = "9px monospace";
          ctx.fillText(qty, sx + slotSize - 6, startY + slotSize - 4);
        }
      }
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
