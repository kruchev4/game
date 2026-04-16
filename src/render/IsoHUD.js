/**
 * IsoHUD.js
 *
 * HTML overlay HUD for the isometric renderer.
 * Replaces the canvas-drawn HUD from Renderer.js.
 *
 * Shows:
 *  - Player frame (portrait, name, HP, resource, XP ring)
 *  - Ability bar (slots 1-4, cooldowns, icons)
 *  - Quick slots (consumables)
 *  - Target frame (when an NPC or player is targeted)
 *  - Combat log (reuses existing CombatLog system)
 */

export class IsoHUD {
  constructor() {
    this._el        = null;
    this._player    = null;
    this._abilities = {};
    this._abilityBar = [];
    this._cooldowns  = {};
    this._target     = null;
    this._frame      = 0;
    this._running    = false;
    this._rafId      = null;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  mount(player, abilities, abilityBar) {
    this._player     = player;
    this._abilities  = abilities ?? {};
    this._abilityBar = abilityBar ?? [];
    this._build();
    this._running = true;
    this._loop();
  }

  unmount() {
    this._running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._el?.remove();
    this._el = null;
  }

  setTarget(entity) {
    this._target = entity;
  }

  setCooldowns(cooldowns) {
    this._cooldowns = cooldowns ?? {};
  }

  setAbilityBar(bar) {
    this._abilityBar = bar ?? [];
    this._rebuildAbilitySlots();
  }

  // ── Build DOM ──────────────────────────────────────────────────────────────

  _build() {
    document.getElementById("iso-hud")?.remove();

    const el = document.createElement("div");
    el.id = "iso-hud";
    el.style.cssText = [
      "position:fixed",
      "inset:0",
      "pointer-events:none",
      "z-index:50",
      "font-family:monospace",
    ].join(";");

    el.innerHTML = `
      <style>
        #iso-hud * { box-sizing: border-box; }

        /* ── Player Frame ── */
        #hud-player {
          position: absolute;
          bottom: 80px;
          left: 12px;
          width: 240px;
          background: rgba(10,10,20,0.88);
          border: 1.5px solid rgba(100,160,100,0.5);
          border-radius: 6px;
          padding: 8px 10px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        #hud-portrait {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 2px solid #44aa44;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          flex-shrink: 0;
          background: rgba(20,20,35,0.9);
          position: relative;
        }
        #hud-portrait canvas {
          position: absolute;
          inset: -4px;
          width: calc(100% + 8px);
          height: calc(100% + 8px);
        }
        #hud-portrait-level {
          position: absolute;
          bottom: -10px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 9px;
          color: rgba(200,160,50,0.9);
          font-weight: bold;
          white-space: nowrap;
        }
        #hud-bars { flex: 1; min-width: 0; }
        #hud-name {
          font-size: 11px;
          font-weight: bold;
          color: #eee;
          margin-bottom: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .hud-bar-wrap {
          margin-bottom: 4px;
        }
        .hud-bar-bg {
          height: 12px;
          background: #222233;
          border-radius: 2px;
          overflow: hidden;
          position: relative;
        }
        .hud-bar-fill {
          height: 100%;
          border-radius: 2px;
          transition: width 0.15s ease;
        }
        .hud-bar-label {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          padding: 0 4px;
          font-size: 8px;
          color: rgba(220,220,220,0.9);
          pointer-events: none;
        }

        /* ── Ability Bar ── */
        #hud-abilities {
          position: absolute;
          bottom: 12px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 6px;
          align-items: flex-end;
        }
        .hud-slot {
          width: 56px;
          height: 56px;
          background: rgba(10,10,20,0.88);
          border: 1.5px solid rgba(80,80,120,0.7);
          border-radius: 4px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: relative;
          cursor: pointer;
          pointer-events: auto;
          transition: border-color 0.15s;
        }
        .hud-slot:hover { border-color: rgba(160,160,255,0.9); }
        .hud-slot.on-cooldown { opacity: 0.6; }
        .hud-slot-icon {
          font-size: 20px;
          line-height: 1;
          margin-bottom: 1px;
        }
        .hud-slot-name {
          font-size: 7px;
          color: #aaa;
          text-align: center;
          padding: 0 2px;
          line-height: 1.1;
          max-width: 52px;
          overflow: hidden;
        }
        .hud-slot-key {
          position: absolute;
          top: 2px;
          left: 3px;
          font-size: 8px;
          color: rgba(180,180,180,0.7);
        }
        .hud-slot-cd {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.6);
          border-radius: 3px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: bold;
          color: #fff;
        }
        .hud-slot-cd.hidden { display: none; }

        /* ── Quick Slots ── */
        #hud-quickslots {
          position: absolute;
          bottom: 12px;
          right: 12px;
          display: flex;
          gap: 4px;
        }
        .hud-qslot {
          width: 44px;
          height: 44px;
          background: rgba(10,10,20,0.88);
          border: 1.5px solid rgba(80,80,80,0.6);
          border-radius: 4px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          pointer-events: auto;
          cursor: pointer;
          position: relative;
        }
        .hud-qslot-icon { font-size: 18px; }
        .hud-qslot-qty {
          position: absolute;
          bottom: 2px;
          right: 3px;
          font-size: 8px;
          color: #fff;
        }
        .hud-qslot-key {
          position: absolute;
          top: 1px;
          left: 3px;
          font-size: 8px;
          color: rgba(180,180,180,0.6);
        }

        /* ── Target Frame ── */
        #hud-target {
          position: absolute;
          top: 12px;
          left: 50%;
          transform: translateX(-50%);
          min-width: 180px;
          background: rgba(10,10,20,0.88);
          border: 1.5px solid rgba(200,80,80,0.6);
          border-radius: 6px;
          padding: 6px 10px;
        }
        #hud-target.hidden { display: none; }
        #hud-target-name {
          font-size: 11px;
          color: #ffaaaa;
          font-weight: bold;
          margin-bottom: 4px;
          text-align: center;
        }
      </style>

      <!-- Player Frame -->
      <div id="hud-player">
        <div id="hud-portrait">
          <canvas id="hud-xp-ring" width="52" height="52"></canvas>
          <span id="hud-portrait-icon">⚔️</span>
          <div id="hud-portrait-level">Lv 1</div>
        </div>
        <div id="hud-bars">
          <div id="hud-name">Hero</div>
          <div class="hud-bar-wrap">
            <div class="hud-bar-bg">
              <div id="hud-hp-fill" class="hud-bar-fill" style="width:100%;background:#44cc44;"></div>
              <div class="hud-bar-label" id="hud-hp-label">100 / 100</div>
            </div>
          </div>
          <div class="hud-bar-wrap">
            <div class="hud-bar-bg">
              <div id="hud-res-fill" class="hud-bar-fill" style="width:100%;background:#3366ff;"></div>
              <div class="hud-bar-label" id="hud-res-label">100 / 100</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Ability Bar -->
      <div id="hud-abilities"></div>

      <!-- Quick Slots -->
      <div id="hud-quickslots"></div>

      <!-- Minimap -->
      <div id="hud-minimap" style="
        position:absolute;
        top:12px;
        right:12px;
        width:160px;
        height:160px;
        background:rgba(10,10,20,0.88);
        border:1.5px solid rgba(100,160,100,0.5);
        border-radius:6px;
        overflow:hidden;
      ">
        <canvas id="hud-minimap-canvas" width="160" height="160"></canvas>
        <div style="
          position:absolute;
          bottom:4px;
          left:0;right:0;
          text-align:center;
          font-size:8px;
          color:rgba(150,200,150,0.7);
          pointer-events:none;
        " id="hud-minimap-label"></div>
      </div>

      <!-- Target Frame -->
      <div id="hud-target" class="hidden">
        <div id="hud-target-name">Target</div>
        <div class="hud-bar-wrap">
          <div class="hud-bar-bg">
            <div id="hud-target-fill" class="hud-bar-fill" style="width:100%;background:#cc4444;"></div>
            <div class="hud-bar-label" id="hud-target-label"></div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(el);
    this._el = el;
    this._rebuildAbilitySlots();
    this._rebuildQuickSlots();
  }

  // ── Ability Slots ──────────────────────────────────────────────────────────

  _rebuildAbilitySlots() {
    const container = document.getElementById("hud-abilities");
    if (!container) return;
    container.innerHTML = "";

    const bar = this._abilityBar.slice(0, 6);
    bar.forEach((abilityId, i) => {
      const ability = this._abilities[abilityId];
      const slot    = document.createElement("div");
      slot.className   = "hud-slot";
      slot.id          = `hud-slot-${i}`;
      slot.dataset.idx = i;
      slot.innerHTML = `
        <span class="hud-slot-key">${i + 1}</span>
        <span class="hud-slot-icon">${ability?.icon ?? "⚔️"}</span>
        <span class="hud-slot-name">${ability?.name ?? abilityId}</span>
        <div class="hud-slot-cd hidden" id="hud-slot-cd-${i}"></div>
      `;
      slot.addEventListener("pointerdown", () => {
        window.dispatchEvent(new KeyboardEvent("keydown", {
          key: String(i + 1), code: `Digit${i + 1}`, bubbles: true
        }));
      });
      container.appendChild(slot);
    });
  }

  _rebuildQuickSlots() {
    const container = document.getElementById("hud-quickslots");
    if (!container) return;
    container.innerHTML = "";

    for (let i = 0; i < 4; i++) {
      const slot = document.createElement("div");
      slot.className = "hud-qslot";
      slot.id        = `hud-qslot-${i}`;
      slot.innerHTML = `
        <span class="hud-qslot-key">F${i + 1}</span>
        <span class="hud-qslot-icon" id="hud-qi-${i}">—</span>
        <span class="hud-qslot-qty" id="hud-qq-${i}"></span>
      `;
      container.appendChild(slot);
    }
  }

  // ── Update Loop ────────────────────────────────────────────────────────────

  _loop() {
    if (!this._running) return;
    this._frame++;
    if (this._frame % 3 === 0) this._update(); // update every 3 frames
    this._rafId = requestAnimationFrame(() => this._loop());
  }

  _update() {
    const p = this._player;
    if (!p || !this._el) return;

    // ── Player bars ──────────────────────────────────────────────────────────
    const hpPct  = Math.max(0, Math.min(1, (p.hp ?? 0) / Math.max(1, p.maxHp ?? 1)));
    const resPct = Math.max(0, Math.min(1, (p.resource ?? 0) / Math.max(1, p.maxResource ?? 1)));

    const hpFill  = document.getElementById("hud-hp-fill");
    const resFill = document.getElementById("hud-res-fill");
    const hpLabel = document.getElementById("hud-hp-label");
    const resLabel= document.getElementById("hud-res-label");

    if (hpFill) {
      hpFill.style.width = `${hpPct * 100}%`;
      const r = Math.round(68 + 120 * (1 - hpPct));
      const g = Math.round(204 * hpPct);
      hpFill.style.background = `rgb(${r},${g},${Math.round(68 * hpPct)})`;
    }
    if (hpLabel)  hpLabel.textContent  = `${Math.ceil(p.hp ?? 0)} / ${p.maxHp ?? 0}`;
    if (resFill)  resFill.style.width  = `${resPct * 100}%`;
    if (resLabel) {
      const def = p.resourceDef;
      resLabel.textContent = `${Math.floor(p.resource ?? 0)} / ${p.maxResource ?? 0} ${def?.label ?? "MP"}`;
      if (resFill && def?.color) resFill.style.background = def.color;
    }

    // ── Name and portrait ────────────────────────────────────────────────────
    const nameEl = document.getElementById("hud-name");
    if (nameEl) nameEl.textContent = p.name ?? "Hero";

    const portIcon = document.getElementById("hud-portrait-icon");
    if (portIcon) {
      const icons = { fighter:"⚔️", ranger:"🏹", paladin:"🛡️" };
      portIcon.textContent = icons[p.classId] ?? "⚔️";
    }

    const levelEl = document.getElementById("hud-portrait-level");
    if (levelEl) levelEl.textContent = `Lv ${p.level ?? 1}`;

    // ── XP ring ──────────────────────────────────────────────────────────────
    this._drawXPRing(p);

    // ── Cooldowns ────────────────────────────────────────────────────────────
    const bar = this._abilityBar.slice(0, 6);
    bar.forEach((abilityId, i) => {
      const cd    = this._cooldowns[abilityId] ?? 0;
      const cdEl  = document.getElementById(`hud-slot-cd-${i}`);
      const slot  = document.getElementById(`hud-slot-${i}`);
      if (!cdEl) return;
      if (cd > 0) {
        const secs = Math.ceil(cd / 20); // ticks to seconds (20 ticks/sec)
        cdEl.textContent = secs > 0 ? secs : "";
        cdEl.classList.remove("hidden");
        slot?.classList.add("on-cooldown");
      } else {
        cdEl.classList.add("hidden");
        slot?.classList.remove("on-cooldown");
      }
    });

    // ── Quick slots ──────────────────────────────────────────────────────────
    const quickSlots = p.quickSlots ?? [];
    for (let i = 0; i < 4; i++) {
      const itemId  = quickSlots[i];
      const iconEl  = document.getElementById(`hud-qi-${i}`);
      const qtyEl   = document.getElementById(`hud-qq-${i}`);
      if (!iconEl) continue;
      if (itemId) {
        const count = p.bag?.filter(s => s?.itemId === itemId).reduce((n, s) => n + (s?.qty ?? 1), 0) ?? 0;
        iconEl.textContent = "🧪"; // placeholder — replace with item icon lookup
        if (qtyEl) qtyEl.textContent = count > 1 ? count : "";
      } else {
        iconEl.textContent = "—";
        if (qtyEl) qtyEl.textContent = "";
      }
    }

    // ── Minimap ───────────────────────────────────────────────────────────────
    this._updateMinimap(p);

    // ── Target frame ─────────────────────────────────────────────────────────
    const targetEl    = document.getElementById("hud-target");
    const targetName  = document.getElementById("hud-target-name");
    const targetFill  = document.getElementById("hud-target-fill");
    const targetLabel = document.getElementById("hud-target-label");

    if (this._target && !this._target.dead && targetEl) {
      targetEl.classList.remove("hidden");
      if (targetName) targetName.textContent = this._target.name ?? this._target.classId ?? "Enemy";
      const tHpPct = Math.max(0, Math.min(1,
        (this._target.hp ?? 0) / Math.max(1, this._target.maxHp ?? 1)
      ));
      if (targetFill)  targetFill.style.width   = `${tHpPct * 100}%`;
      if (targetLabel) targetLabel.textContent  = `${Math.ceil(this._target.hp ?? 0)} / ${this._target.maxHp ?? 0}`;
    } else if (targetEl) {
      targetEl.classList.add("hidden");
    }
  }

  setWorld(world) {
    this._world = world;
    this._minimapDirty = true;
  }

  setEntities(entities) {
    this._entities = entities;
  }

  _updateMinimap(p) {
    const canvas = document.getElementById("hud-minimap-canvas");
    if (!canvas || !this._world) return;

    const ctx  = canvas.getContext("2d");
    const W    = canvas.width;   // 160
    const H    = canvas.height;  // 160
    const mw   = this._world.width  ?? 240;
    const mh   = this._world.height ?? 180;
    const scaleX = W / mw;
    const scaleY = H / mh;

    // Only redraw base map when world changes
    if (this._minimapDirty) {
      this._minimapDirty = false;
      this._minimapCache = document.createElement("canvas");
      this._minimapCache.width  = W;
      this._minimapCache.height = H;
      const mc = this._minimapCache.getContext("2d");

      const tiles = this._world.tiles;
      if (tiles) {
        const COLORS = {
          water:   "#1a3a8a",
          forest:  "#1a5a1a",
          mountain:"#666660",
          path:    "#8a6040",
          default: "#3a6a2a"
        };
        const getTileColor = (id) => {
          if (id >= 7  && id <= 10) return COLORS.water;
          if (id >= 15 && id <= 18) return COLORS.forest;
          if (id >= 19 && id <= 21) return COLORS.mountain;
          if (id === 4 || id === 5) return COLORS.path;
          return COLORS.default;
        };

        // Draw every 2nd tile for performance
        const step = 2;
        for (let ty = 0; ty < mh; ty += step) {
          for (let tx = 0; tx < mw; tx += step) {
            const tileId = Array.isArray(tiles[ty])
              ? tiles[ty][tx]
              : tiles[ty * mw + tx];
            mc.fillStyle = getTileColor(tileId ?? 0);
            mc.fillRect(
              Math.floor(tx * scaleX), Math.floor(ty * scaleY),
              Math.ceil(step * scaleX) + 1, Math.ceil(step * scaleY) + 1
            );
          }
        }
      }
    }

    // Draw cached base map
    if (this._minimapCache) {
      ctx.drawImage(this._minimapCache, 0, 0);
    } else {
      ctx.fillStyle = "#1a2a1a";
      ctx.fillRect(0, 0, W, H);
    }

    // Draw entities (NPCs) as red dots
    for (const e of this._entities ?? []) {
      if (!e || e.dead) continue;
      ctx.fillStyle = "rgba(220,60,60,0.8)";
      ctx.fillRect(
        Math.floor(e.x * scaleX) - 1,
        Math.floor(e.y * scaleY) - 1,
        2, 2
      );
    }

    // Draw player as bright dot
    if (p) {
      const px = Math.floor(p.x * scaleX);
      const py = Math.floor(p.y * scaleY);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
      // View radius indicator
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth   = 0.5;
      ctx.beginPath();
      ctx.arc(px, py, 20 * scaleX, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Coords label
    const label = document.getElementById("hud-minimap-label");
    if (label && p) {
      label.textContent = `${Math.floor(p.x)}, ${Math.floor(p.y)}`;
    }
  }

  _drawXPRing(p) {
    const canvas = document.getElementById("hud-xp-ring");
    if (!canvas) return;
    const ctx  = canvas.getContext("2d");
    const cx   = 26, cy = 26, r = 24;
    const xpPct = Math.min(1, (p.xp ?? 0) / Math.max(1, 100 * Math.pow(p.level ?? 1, 1.5)));

    ctx.clearRect(0, 0, 52, 52);

    // Background ring
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(60,40,10,0.5)";
    ctx.lineWidth   = 3;
    ctx.stroke();

    // XP progress
    if (xpPct > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * xpPct);
      const r2 = Math.round(150 + 70 * xpPct);
      const g2 = Math.round(80  + 80 * xpPct);
      ctx.strokeStyle = `rgba(${r2},${g2},20,0.9)`;
      ctx.lineWidth   = 3;
      ctx.lineCap     = "round";
      ctx.stroke();
      ctx.lineCap = "butt";
    }
  }
}
