/**
 * InventoryWindow.js
 *
 * WoW-style HTML inventory overlay.
 * Left panel: equipment slots around a character silhouette + 2 rune sockets.
 * Right panel: 24-slot bag grid + gold display + stat summary.
 * Click equipment slot to unequip. Click bag item to equip/use/assign quick slot.
 * Right-click bag item for context menu (use, equip, socket rune, assign quick slot).
 *
 * Usage:
 *   const inv = new InventoryWindow({ player, lootSystem, itemDefs });
 *   inv.show();
 *   inv.hide();
 *   inv.toggle();
 */

const EQUIPMENT_SLOTS = [
  { id: "head",     label: "Head",      icon: "🪖", pos: { top: "2%",   left: "10%" } },
  { id: "chest",    label: "Chest",     icon: "🥋", pos: { top: "22%",  left: "10%" } },
  { id: "legs",     label: "Legs",      icon: "👖", pos: { top: "42%",  left: "10%" } },
  { id: "boots",    label: "Boots",     icon: "👢", pos: { top: "62%",  left: "10%" } },
  { id: "mainhand", label: "Main Hand", icon: "⚔️", pos: { top: "22%",  right: "10%" } },
  { id: "offhand",  label: "Off Hand",  icon: "🛡️", pos: { top: "42%",  right: "10%" } },
  { id: "ring1",    label: "Ring",      icon: "💍", pos: { top: "62%",  right: "10%" } },
  { id: "necklace", label: "Necklace",  icon: "📿", pos: { top: "2%",   right: "10%" } },
];

const RUNE_SLOTS = [
  { id: "rune1", label: "Rune I" },
  { id: "rune2", label: "Rune II" },
];

const BAG_COLS = 8;
const BAG_SIZE = 24;

export class InventoryWindow {
  constructor({ player, lootSystem, itemDefs }) {
    this.player       = player;
    this.lootSystem   = lootSystem;
    this.itemDefs     = itemDefs;
    this._el          = null;
    this._visible     = false;
    this._tooltip     = null;
    this._contextMenu = null;
  }

  get visible() { return this._visible; }

  toggle() { this._visible ? this.hide() : this.show(); }

  show() {
    if (this._visible) { this._render(); return; }
    this._visible = true;
    this._inject();
    this._render();
  }

  hide() {
    this._visible = false;
    this._el?.remove();
    this._el = null;
    this._hideTooltip();
    this._hideContextMenu();
  }

  refresh() { if (this._visible) this._render(); }

  // ─────────────────────────────────────────────
  // BUILD
  // ─────────────────────────────────────────────

  _inject() {
    document.getElementById("inv-window")?.remove();

    this._el = document.createElement("div");
    this._el.id = "inv-window";
    this._el.style.cssText = `
      position: fixed;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      z-index: 140;
      display: flex;
      gap: 0;
      background: linear-gradient(160deg, #1a1006, #0d0802);
      border: 1px solid #7a5020;
      box-shadow: 0 0 60px rgba(0,0,0,0.85), 0 0 18px rgba(201,146,42,0.15);
      font-family: 'Crimson Text', serif;
      color: #f0ddb8;
      min-width: 620px;
      max-height: 90vh;
      overflow: hidden;
    `;
    document.body.appendChild(this._el);

    this._tooltip = document.createElement("div");
    this._tooltip.id = "inv-tooltip";
    this._tooltip.style.cssText = `
      position:fixed;z-index:200;background:linear-gradient(160deg,#1a1006,#0d0802);
      border:1px solid #7a5020;padding:8px 12px;max-width:220px;
      font-family:'Crimson Text',serif;font-size:.78rem;color:#f0ddb8;
      pointer-events:none;display:none;
      box-shadow:0 4px 16px rgba(0,0,0,0.7);
    `;
    document.body.appendChild(this._tooltip);
  }

  _render() {
    if (!this._el) return;
    const p = this.player;

    // ── Equipment slots ──
    const eqSlots = EQUIPMENT_SLOTS.map(slot => {
      const itemId = p.equipment?.[slot.id];
      const def    = itemId ? this.itemDefs[itemId] : null;
      const posStr = Object.entries(slot.pos).map(([k,v]) => `${k}:${v}`).join(";");
      return `
        <div class="inv-eq-slot ${def ? "filled" : ""}"
             data-slot="${slot.id}"
             style="position:absolute;${posStr};width:44px;height:44px;"
             title="${slot.label}">
          <span class="inv-eq-icon">${def ? (def.icon ?? "📦") : slot.icon}</span>
          ${def ? "" : `<span class="inv-eq-empty">${slot.label[0]}</span>`}
        </div>`;
    }).join("");

    // ── Rune slots ──
    const runeSlots = RUNE_SLOTS.map(slot => {
      const itemId = p.equipment?.[slot.id];
      const def    = itemId ? this.itemDefs[itemId] : null;
      const abilityId = def?.runeAbility ?? def?.effect?.runeAbility;
      const rank   = abilityId ? (p.learnedSkills?.[abilityId]?.rank ?? 1) : null;
      return `
        <div class="inv-eq-slot inv-rune-slot ${def ? "filled" : ""}"
             data-slot="${slot.id}"
             title="${slot.label}${def ? `: ${def.name}` : ""}">
          <span class="inv-eq-icon">${def ? (def.icon ?? "🔮") : "🔮"}</span>
          ${def && rank !== null ? `<span class="inv-rune-rank">R${rank}</span>` : ""}
          ${def ? "" : `<span class="inv-eq-empty">${slot.label}</span>`}
        </div>`;
    }).join("");

    // ── Bag grid ──
    const bagHtml = p.bag.map((slot, i) => {
      if (!slot) return `<div class="inv-bag-slot" data-bag="${i}"></div>`;
      const def = this.itemDefs[slot.itemId];
      const isQS = p.quickSlots?.includes(slot.itemId);
      return `
        <div class="inv-bag-slot filled ${def?.type === "rune" ? "rune-item" : ""}"
             data-bag="${i}" data-item="${slot.itemId}">
          <span class="inv-bag-icon">${def?.icon ?? "📦"}</span>
          ${slot.qty > 1 ? `<span class="inv-bag-qty">${slot.qty}</span>` : ""}
          ${isQS ? `<span class="inv-bag-qs">Q</span>` : ""}
        </div>`;
    }).join("");

    // ── Quick slots ──
    const qsHtml = (p.quickSlots ?? []).map((itemId, i) => {
      const def     = itemId ? this.itemDefs[itemId] : null;
      const bagSlot = itemId ? p.bag?.find(s => s?.itemId === itemId) : null;
      const qty     = bagSlot?.qty ?? 0;
      return `
        <div class="inv-qs-slot ${def ? "filled" : ""}" data-qs="${i}" title="Quick Slot ${i+5}">
          ${def ? `<span class="inv-bag-icon">${def.icon}</span>` : ""}
          ${qty > 0 ? `<span class="inv-bag-qty">${qty}</span>` : ""}
          <span class="inv-qs-key">${i + 5}</span>
        </div>`;
    }).join("");

    // ── Stat summary ──
    const stats   = p.stats ?? {};
    const statRows = [
      { label: "STR", val: stats.STR ?? 10, color: "#e8a060" },
      { label: "DEX", val: stats.DEX ?? 10, color: "#60e880" },
      { label: "CON", val: stats.CON ?? 10, color: "#e86060" },
      { label: "INT", val: stats.INT ?? 10, color: "#80a0ff" },
    ].map(s => `
      <div class="inv-stat-row">
        <span class="inv-stat-label" style="color:${s.color}">${s.label}</span>
        <span class="inv-stat-val">${s.val}</span>
      </div>`).join("");

    const hpRow  = `<div class="inv-stat-row"><span class="inv-stat-label" style="color:#44cc44">HP</span><span class="inv-stat-val">${Math.ceil(p.hp ?? 0)} / ${p.maxHp ?? 0}</span></div>`;
    const resLabel = p.resourceDef?.label ?? "MP";
    const resRow = `<div class="inv-stat-row"><span class="inv-stat-label" style="color:${p.resourceDef?.color ?? "#4488cc"}">${resLabel}</span><span class="inv-stat-val">${Math.floor(p.resource ?? 0)} / ${p.maxResource ?? 0}</span></div>`;

    this._el.innerHTML = `
      <style>
        #inv-window * { box-sizing:border-box; }
        .inv-panel { padding:14px; }
        .inv-title { font-family:'Cinzel',serif;font-size:.58rem;letter-spacing:4px;text-transform:uppercase;color:#c9922a;border-bottom:1px solid #4a2e10;padding-bottom:6px;margin-bottom:10px; }
        .inv-eq-panel { width:240px;border-right:1px solid #4a2e10;position:relative;display:flex;flex-direction:column; }
        .inv-eq-area { position:relative;height:260px;flex-shrink:0; }
        .inv-eq-slot { border:1px solid #4a2e10;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .2s;background:rgba(0,0,0,0.3);position:relative; }
        .inv-eq-slot.filled { border-color:#7a5020; }
        .inv-eq-slot:hover { border-color:#c9922a;background:rgba(201,146,42,0.1); }
        .inv-eq-icon { font-size:1.4rem; }
        .inv-eq-empty { position:absolute;bottom:2px;right:3px;font-size:.4rem;color:#4a2e10;text-transform:uppercase; }
        .inv-char-silhouette { position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:4rem;opacity:.15;pointer-events:none; }
        .inv-rune-section { margin-top:10px;flex-shrink:0; }
        .inv-rune-row { display:flex;gap:6px; }
        .inv-rune-slot { flex:1;height:44px;border:1px solid #8855cc !important;background:rgba(136,85,204,0.08) !important;border-radius:2px; }
        .inv-rune-slot.filled { border-color:#cc99ff !important;box-shadow:0 0 8px rgba(136,85,204,0.35); }
        .inv-rune-slot:hover { border-color:#cc99ff !important;background:rgba(136,85,204,0.18) !important; }
        .inv-rune-rank { position:absolute;top:1px;left:3px;font-size:.42rem;color:#cc99ff;font-family:'Cinzel',serif;font-weight:600; }
        .inv-stat-section { margin-top:10px;border-top:1px solid #4a2e10;padding-top:8px; }
        .inv-stat-row { display:flex;justify-content:space-between;align-items:center;padding:1px 0; }
        .inv-stat-label { font-family:'Cinzel',serif;font-size:.55rem;letter-spacing:2px; }
        .inv-stat-val { font-size:.7rem;color:#f0ddb8; }
        .inv-bag-panel { width:380px;display:flex;flex-direction:column; }
        .inv-bag-grid { display:grid;grid-template-columns:repeat(8,1fr);gap:3px;margin-bottom:10px; }
        .inv-bag-slot { border:1px solid #4a2e10;aspect-ratio:1;display:flex;align-items:center;justify-content:center;position:relative;cursor:pointer;transition:all .15s;background:rgba(0,0,0,0.2); }
        .inv-bag-slot.filled { border-color:#7a5020; }
        .inv-bag-slot.rune-item { border-color:#8855cc; }
        .inv-bag-slot.rune-item:hover { border-color:#cc99ff;background:rgba(136,85,204,0.12); }
        .inv-bag-slot:not(.rune-item):hover { border-color:#c9922a;background:rgba(201,146,42,0.08); }
        .inv-bag-icon { font-size:1.1rem; }
        .inv-bag-qty { position:absolute;bottom:1px;right:2px;font-size:.5rem;color:#e8b84a;font-family:'Cinzel',serif; }
        .inv-bag-qs  { position:absolute;top:1px;left:2px;font-size:.45rem;color:#88aaff; }
        .inv-qs-row { display:flex;gap:4px;margin-bottom:10px; }
        .inv-qs-slot { flex:1;border:1px solid #4a2e10;aspect-ratio:1;display:flex;align-items:center;justify-content:center;position:relative;cursor:pointer;transition:all .15s;background:rgba(0,0,0,0.3); }
        .inv-qs-slot.filled { border-color:#7a5020; }
        .inv-qs-slot:hover { border-color:#c9922a; }
        .inv-qs-key { position:absolute;bottom:1px;right:2px;font-size:.48rem;color:#5a4030;font-family:'Cinzel',serif; }
        .inv-gold-row { display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid #4a2e10;font-size:.82rem;margin-top:auto; }
        .inv-close-btn { font-family:'Cinzel',serif;font-size:.58rem;letter-spacing:2px;text-transform:uppercase;padding:5px 10px;border:1px solid #4a2e10;color:#a8865a;background:transparent;cursor:pointer;transition:all .2s;float:right; }
        .inv-close-btn:hover { border-color:#a8865a;color:#f0ddb8; }
        .inv-ctx { position:fixed;z-index:250;background:linear-gradient(160deg,#1a1006,#0d0802);border:1px solid #7a5020;font-family:'Crimson Text',serif;min-width:160px; }
        .inv-ctx-item { padding:7px 14px;font-size:.8rem;color:#f0ddb8;cursor:pointer;transition:background .15s; }
        .inv-ctx-item:hover { background:rgba(201,146,42,0.12); }
        .inv-ctx-item.disabled { color:#4a3020;cursor:default; }
        .inv-ctx-item.disabled:hover { background:transparent; }
        .inv-ctx-sep { border-top:1px solid #4a2e10;margin:2px 0; }
      </style>

      <div class="inv-panel inv-eq-panel">
        <div class="inv-title">Equipment</div>
        <div class="inv-eq-area">
          <span class="inv-char-silhouette">🧙</span>
          ${eqSlots}
        </div>

        <div class="inv-rune-section">
          <div class="inv-title" style="font-size:.5rem;letter-spacing:3px;color:#8855cc;border-color:#8855cc33;">⬡ Rune Sockets</div>
          <div class="inv-rune-row">${runeSlots}</div>
        </div>

        <div class="inv-stat-section">
          <div class="inv-title" style="font-size:.5rem;letter-spacing:3px;">Character</div>
          ${hpRow}${resRow}${statRows}
        </div>
      </div>

      <div class="inv-panel inv-bag-panel">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div class="inv-title" style="border:none;margin:0;padding:0;">Bag</div>
          <button class="inv-close-btn" id="inv-close">[I] Close</button>
        </div>
        <div class="inv-bag-grid">${bagHtml}</div>
        <div class="inv-title" style="font-size:.5rem;letter-spacing:3px;">Quick Slots</div>
        <div class="inv-qs-row">${qsHtml}</div>
        <div class="inv-gold-row">
          <span>🪙</span>
          <span style="font-family:'Cinzel',serif;color:#e8b84a;">${p.gold ?? 0} gp</span>
          <span style="margin-left:auto;font-size:.65rem;color:#5a4030;">Lv ${p.level ?? 1} · ${p.xp ?? 0} XP</span>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  // ─────────────────────────────────────────────
  // EVENTS
  // ─────────────────────────────────────────────

  _bindEvents() {
    if (!this._el) return;

    this._el.querySelector("#inv-close")?.addEventListener("click", () => this.hide());

    // Equipment + rune slots — click to unequip
    this._el.querySelectorAll(".inv-eq-slot").forEach(el => {
      el.addEventListener("click", () => {
        const slot = el.dataset.slot;
        if (this.player.equipment?.[slot]) {
          this.lootSystem.unequipItem(slot);
          this._render();
        }
      });
      el.addEventListener("mouseenter", e => this._showTooltip(e, this.player.equipment?.[el.dataset.slot]));
      el.addEventListener("mouseleave", () => this._hideTooltip());
    });

    // Bag slots — left click uses/equips, right click context menu
    this._el.querySelectorAll(".inv-bag-slot.filled").forEach(el => {
      const itemId = el.dataset.item;

      el.addEventListener("click", () => {
        const def = this.itemDefs[itemId];
        if (!def) return;
        if (def.type === "equipment") {
          this.lootSystem.equipItem(itemId);
          this._render();
        } else if (def.type === "consumable") {
          this.lootSystem.useItem(itemId);
          this._render();
        }
        // Runes require right-click → Socket from context menu
      });

      el.addEventListener("contextmenu", e => {
        e.preventDefault();
        this._showContextMenu(e, itemId);
      });

      el.addEventListener("mouseenter", e => this._showTooltip(e, itemId));
      el.addEventListener("mouseleave", () => this._hideTooltip());
    });

    // Quick slots — left click uses, right click clears
    this._el.querySelectorAll(".inv-qs-slot.filled").forEach(el => {
      const idx = parseInt(el.dataset.qs);
      el.addEventListener("click", () => {
        this.lootSystem.useQuickSlot(idx);
        this._render();
      });
      el.addEventListener("contextmenu", e => {
        e.preventDefault();
        this.lootSystem.assignQuickSlot(idx, null);
        this._render();
      });
    });

    document.addEventListener("click", () => this._hideContextMenu(), { once: true });
  }

  // ─────────────────────────────────────────────
  // CONTEXT MENU
  // ─────────────────────────────────────────────

  _showContextMenu(e, itemId) {
    this._hideContextMenu();
    const def = this.itemDefs[itemId];
    if (!def) return;

    const menu = document.createElement("div");
    menu.className  = "inv-ctx";
    menu.style.left = e.clientX + "px";
    menu.style.top  = e.clientY + "px";

    const options = [];

    if (def.type === "consumable") {
      options.push({
        label: "Use",
        action: () => { this.lootSystem.useItem(itemId); this._render(); }
      });
      options.push({ sep: true });
      for (let q = 0; q < 4; q++) {
        const qi = q;
        options.push({
          label: `Assign Quick Slot ${q + 5}`,
          action: () => { this.lootSystem.assignQuickSlot(qi, itemId); this._render(); }
        });
      }
    }

    if (def.type === "equipment") {
      options.push({
        label: "Equip",
        action: () => { this.lootSystem.equipItem(itemId); this._render(); }
      });
    }

    if (def.type === "rune") {
      const abilityId = def.runeAbility ?? def.effect?.runeAbility;
      const learned   = abilityId ? this.player.learnedSkills?.[abilityId] : false;
      const slotsFull = this.player.equipment?.rune1 && this.player.equipment?.rune2;
      const alreadyEquipped =
        this.player.equipment?.rune1 === itemId ||
        this.player.equipment?.rune2 === itemId;
      const abilityLabel = abilityId
        ? abilityId.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
        : "Unknown";

      let runeLabel, runeDisabled;
      if (!learned && abilityId !== "all") {
        runeLabel    = `Socket: ${abilityLabel} (not learned)`;
        runeDisabled = true;
      } else if (slotsFull) {
        runeLabel    = "Socket Rune (slots full)";
        runeDisabled = true;
      } else if (alreadyEquipped) {
        runeLabel    = "Already socketed";
        runeDisabled = true;
      } else {
        runeLabel    = `Socket: ${abilityLabel}`;
        runeDisabled = false;
      }

      options.push({
        label:    runeLabel,
        disabled: runeDisabled,
        action:   () => { this.lootSystem.equipItem(itemId); this._render(); }
      });
    }

    if (!options.length) return;

    options.forEach(opt => {
      if (opt.sep) {
        const sep = document.createElement("div");
        sep.className = "inv-ctx-sep";
        menu.appendChild(sep);
        return;
      }
      const item = document.createElement("div");
      item.className   = "inv-ctx-item" + (opt.disabled ? " disabled" : "");
      item.textContent = opt.label;
      if (!opt.disabled) {
        item.addEventListener("click", () => { opt.action(); this._hideContextMenu(); });
      }
      menu.appendChild(item);
    });

    document.body.appendChild(menu);
    this._contextMenu = menu;
  }

  _hideContextMenu() {
    this._contextMenu?.remove();
    this._contextMenu = null;
  }

  // ─────────────────────────────────────────────
  // TOOLTIP
  // ─────────────────────────────────────────────

  _showTooltip(e, itemId) {
    if (!itemId || !this._tooltip) return;
    const def = this.itemDefs[itemId];
    if (!def) return;

    const rarityColor = {
      common:    "#f0ddb8",
      uncommon:  "#88aaff",
      rare:      "#aa66ff",
      legendary: "#ffaa22"
    }[def.rarity] ?? "#f0ddb8";

    const statsHtml = def.stats
      ? Object.entries(def.stats).map(([k, v]) => {
          const sign  = v >= 0 ? "+" : "";
          const color = v >= 0 ? "#88aaff" : "#ff8888";
          const label = k === "hp" ? "Max HP" : k === "mana" ? "Max Mana" : k.toUpperCase();
          return `<div style="color:${color};font-size:.7rem;">${sign}${v} ${label}</div>`;
        }).join("")
      : "";

    // Rune-specific info
    let runeHtml = "";
    if (def.type === "rune") {
      const abilityId = def.runeAbility ?? def.effect?.runeAbility;
      if (abilityId) {
        const learned     = this.player.learnedSkills?.[abilityId];
        const currentRank = learned?.rank ?? 0;
        const color       = learned ? "#cc99ff" : "#5a3a5a";
        const abilityLabel = abilityId === "all"
          ? "All Abilities"
          : abilityId.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        const status = learned
          ? `Upgrades ${abilityLabel} → Rank ${Math.min(3, currentRank + 1)}`
          : `Requires: ${abilityLabel} (not learned)`;
        runeHtml = `
          <div style="color:${color};font-size:.7rem;margin-top:5px;border-top:1px solid #4a2e10;padding-top:4px;">
            🔮 ${status}
          </div>`;
      }
    }

    this._tooltip.innerHTML = `
      <div style="font-family:'Cinzel',serif;font-size:.78rem;color:${rarityColor};margin-bottom:3px;">
        ${def.icon ?? "📦"} ${def.name}
      </div>
      ${def.rarity ? `<div style="font-size:.6rem;color:${rarityColor};text-transform:capitalize;margin-bottom:4px;">${def.rarity}</div>` : ""}
      <div style="font-size:.72rem;color:#a8865a;font-style:italic;margin-bottom:4px;">${def.description ?? ""}</div>
      ${statsHtml}
      ${runeHtml}
      ${def.value ? `<div style="font-size:.65rem;color:#e8b84a;margin-top:4px;">🪙 ${def.value} gp</div>` : ""}
    `;

    this._tooltip.style.display = "block";
    this._tooltip.style.left    = (e.clientX + 14) + "px";
    this._tooltip.style.top     = (e.clientY - 10) + "px";
  }

  _hideTooltip() {
    if (this._tooltip) this._tooltip.style.display = "none";
  }
}