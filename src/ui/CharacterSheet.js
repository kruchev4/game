/**
 * CharacterSheet.js
 * Self-contained HTML overlay — no external CSS file needed.
 * Inject styles + DOM on first show(), update content each time.
 * Toggle with [C] key — wired in Engine._bindInput().
 */

export class CharacterSheet {
  constructor({ player, abilities, classes, itemDefs, skills }) {
    this.player   = player;
    this.abilities = abilities ?? {};
    this.classes   = classes  ?? {};
    this.itemDefs  = itemDefs ?? {};
    this.skills    = skills   ?? {};

    this._el     = null;
    this._styles = null;
    this.active  = false;

    this._inject();
  }

  // ── Public ────────────────────────────────────────────────────────────────

  show() {
    this._refresh();
    this._el.style.display = "flex";
    this.active = true;
  }

  hide() {
    this._el.style.display = "none";
    this.active = false;
  }

  toggle() {
    this.active ? this.hide() : this.show();
  }

  /** Call this if player reference changes (e.g. after world transition) */
  setPlayer(player) {
    this.player = player;
  }

  // ── DOM injection ─────────────────────────────────────────────────────────

  _inject() {
    // Styles
    const style = document.createElement("style");
    style.textContent = `
      #roe-charsheet {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.88);
        display: none; align-items: center; justify-content: center;
        z-index: 400; padding: 16px; box-sizing: border-box;
        font-family: 'Georgia', serif;
      }
      .cs-box {
        background: linear-gradient(160deg, #1a1208 0%, #0d0a04 100%);
        border: 1px solid #6b4e1a;
        max-width: 740px; width: 100%; max-height: 92vh;
        overflow-y: auto; color: #c8b580;
        box-shadow: 0 0 60px rgba(0,0,0,0.9), 0 0 24px rgba(180,130,40,0.15);
        animation: csSlideIn .2s ease both;
      }
      @keyframes csSlideIn {
        from { opacity:0; transform: translateY(10px) scale(.98); }
        to   { opacity:1; transform: none; }
      }
      .cs-box::-webkit-scrollbar { width: 4px; }
      .cs-box::-webkit-scrollbar-thumb { background: #6b4e1a; }

      /* Header */
      .cs-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 16px 20px 12px;
        border-bottom: 1px solid #3a2a0a;
        background: rgba(0,0,0,0.3);
      }
      .cs-char-name {
        font-size: 1.15rem; font-weight: bold;
        color: #e8c84a; letter-spacing: 2px;
        text-shadow: 0 0 12px rgba(232,200,74,0.4);
      }
      .cs-char-sub {
        font-size: 0.72rem; color: #8a7040; margin-top: 3px; letter-spacing: 1px;
      }
      .cs-close-btn {
        background: transparent; border: 1px solid #3a2a0a;
        color: #8a7040; padding: 6px 12px; cursor: pointer;
        font-size: 0.72rem; letter-spacing: 1px;
        transition: all .15s;
      }
      .cs-close-btn:hover { border-color: #6b4e1a; color: #c8b580; }

      /* Body layout */
      .cs-body {
        display: grid; grid-template-columns: 1fr 1fr;
        gap: 0; padding: 0;
      }
      @media (max-width: 520px) {
        .cs-body { grid-template-columns: 1fr; }
      }
      .cs-col {
        padding: 16px 18px;
      }
      .cs-col:first-child {
        border-right: 1px solid #2a1e06;
      }

      /* Section headers */
      .cs-sec {
        font-size: 0.62rem; letter-spacing: 3px; text-transform: uppercase;
        color: #e8c84a; border-bottom: 1px solid #2a1e06;
        padding-bottom: 4px; margin: 14px 0 8px;
      }
      .cs-sec:first-child { margin-top: 0; }

      /* Vitals bars */
      .cs-vital-row {
        display: flex; justify-content: space-between;
        font-size: 0.72rem; margin-bottom: 3px;
      }
      .cs-vital-lbl { color: #8a7040; }
      .cs-vital-val { color: #c8b580; font-weight: bold; }
      .cs-vbar {
        height: 6px; background: #1a1208;
        border: 1px solid #2a1e06; margin-bottom: 8px;
        border-radius: 2px; overflow: hidden;
      }
      .cs-vbar-fill { height: 100%; border-radius: 2px; transition: width .3s; }
      .cs-hp-fill  { background: linear-gradient(90deg, #4a1a1a, #cc3333); }
      .cs-mp-fill  { background: linear-gradient(90deg, #1a2a4a, #3366cc); }
      .cs-xp-fill  { background: linear-gradient(90deg, #2a1a00, #c8840a); }
      .cs-rage-fill { background: linear-gradient(90deg, #3a0a0a, #cc2200); }

      /* Stat grid */
      .cs-stat-grid {
        display: grid; grid-template-columns: repeat(3, 1fr);
        gap: 6px; margin-bottom: 4px;
      }
      .cs-stat {
        background: rgba(0,0,0,0.3); border: 1px solid #2a1e06;
        padding: 6px 4px; text-align: center; border-radius: 2px;
      }
      .cs-stat-lbl { font-size: 0.58rem; color: #6b5030; letter-spacing: 1px; display: block; }
      .cs-stat-val { font-size: 1.1rem; color: #e8c84a; font-weight: bold; display: block; }
      .cs-stat-mod { font-size: 0.65rem; color: #8a7040; display: block; }

      /* Combat row */
      .cs-combat-grid {
        display: grid; grid-template-columns: repeat(2, 1fr);
        gap: 5px; margin-bottom: 4px;
      }
      .cs-combat-item {
        background: rgba(0,0,0,0.25); border: 1px solid #2a1e06;
        padding: 5px 8px; border-radius: 2px;
      }
      .cs-combat-lbl { font-size: 0.58rem; color: #6b5030; letter-spacing: 1px; display: block; }
      .cs-combat-val { font-size: 0.85rem; color: #c8b580; font-weight: bold; display: block; }

      /* Equipment grid */
      .cs-equip-grid {
        display: grid; grid-template-columns: repeat(3, 1fr);
        gap: 5px; margin-bottom: 4px;
      }
      .cs-equip-slot {
        background: rgba(0,0,0,0.3); border: 1px solid #2a1e06;
        padding: 6px 5px; text-align: center; border-radius: 2px;
        min-height: 46px;
      }
      .cs-equip-slot.filled { border-color: #6b4e1a; }
      .cs-equip-lbl  { font-size: 0.55rem; color: #6b5030; letter-spacing: 1px; display: block; margin-bottom: 2px; }
      .cs-equip-icon { font-size: 1.1rem; display: block; }
      .cs-equip-name { font-size: 0.58rem; color: #a89060; display: block; margin-top: 2px;
                       white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

      /* Inventory grid */
      .cs-inv-grid {
        display: grid; grid-template-columns: repeat(6, 1fr);
        gap: 4px; margin-bottom: 4px;
      }
      .cs-inv-slot {
        background: rgba(0,0,0,0.3); border: 1px solid #1e1608;
        padding: 4px 2px; text-align: center; border-radius: 2px;
        min-height: 36px; position: relative;
      }
      .cs-inv-slot.filled { border-color: #3a2a0a; }
      .cs-inv-icon { font-size: 1rem; display: block; }
      .cs-inv-qty  {
        position: absolute; bottom: 1px; right: 3px;
        font-size: 0.55rem; color: #e8c84a;
      }

      /* Ability cards */
      .cs-ability-card {
        background: rgba(0,0,0,0.3); border: 1px solid #2a1e06;
        padding: 7px 9px; margin-bottom: 5px; border-radius: 2px;
      }
      .cs-ability-card:hover { border-color: #6b4e1a; }
      .cs-ability-name { font-size: 0.78rem; color: #e8c84a; font-weight: bold; }
      .cs-ability-type { font-size: 0.6rem; color: #6b5030; margin-left: 6px; letter-spacing: 1px; }
      .cs-ability-desc { font-size: 0.68rem; color: #8a7040; margin-top: 3px; line-height: 1.5; }
      .cs-ability-stats { font-size: 0.62rem; color: #7a8a60; margin-top: 3px; }

      /* Traits */
      .cs-trait-row {
        display: flex; justify-content: space-between;
        font-size: 0.72rem; padding: 3px 0;
        border-bottom: 1px solid #1e1608;
      }
      .cs-trait-lbl { color: #6b5030; }
      .cs-trait-val { color: #c8b580; }

      /* Gold */
      .cs-gold {
        font-size: 0.85rem; color: #e8c84a; font-weight: bold;
        text-align: right; padding: 4px 0 0;
      }
    `;
    document.head.appendChild(style);
    this._styles = style;

    // Overlay container
    const el = document.createElement("div");
    el.id = "roe-charsheet";
    el.innerHTML = `
      <div class="cs-box">
        <div class="cs-header">
          <div>
            <div class="cs-char-name" id="cs-name">—</div>
            <div class="cs-char-sub"  id="cs-sub">—</div>
          </div>
          <button class="cs-close-btn" id="cs-close-btn">✕ Close [C]</button>
        </div>
        <div class="cs-body">
          <!-- LEFT -->
          <div class="cs-col">
            <div class="cs-sec">Vitals</div>
            <div id="cs-vitals"></div>

            <div class="cs-sec">Ability Scores</div>
            <div class="cs-stat-grid" id="cs-stats"></div>

            <div class="cs-sec">Combat</div>
            <div class="cs-combat-grid" id="cs-combat"></div>

            <div class="cs-sec">Character</div>
            <div id="cs-traits"></div>
            <div class="cs-gold" id="cs-gold"></div>
          </div>
          <!-- RIGHT -->
          <div class="cs-col">
            <div class="cs-sec">Equipment</div>
            <div class="cs-equip-grid" id="cs-equip"></div>

            <div class="cs-sec">Inventory</div>
            <div class="cs-inv-grid" id="cs-inv"></div>

            <div class="cs-sec">Abilities</div>
            <div id="cs-abilities-list"></div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(el);
    this._el = el;

    // Close button
    el.querySelector("#cs-close-btn").addEventListener("click", () => this.hide());

    // Click backdrop to close
    el.addEventListener("click", (e) => {
      if (e.target === el) this.hide();
    });
  }

  // ── Content rendering ─────────────────────────────────────────────────────

  _refresh() {
    const p = this.player;
    if (!p) return;

    const classDef = this.classes[p.classId] ?? {};

    // Header
    this._el.querySelector("#cs-name").textContent = p.name ?? "Hero";
    this._el.querySelector("#cs-sub").textContent  =
      `${classDef.name ?? p.classId ?? "Adventurer"}  •  Level ${p.level ?? 1}`;

    this._renderVitals(p, classDef);
    this._renderStats(p);
    this._renderCombat(p, classDef);
    this._renderTraits(p, classDef);
    this._renderEquipment(p);
    this._renderInventory(p);
    this._renderAbilities(p);
  }

  _renderVitals(p, classDef) {
    const hpPct  = Math.min(1, (p.hp ?? 0) / Math.max(1, p.maxHp ?? 1));
    const resPct = Math.min(1, (p.resource ?? 0) / Math.max(1, p.maxResource ?? 1));
    const xpNeeded = Math.round(100 * Math.pow(p.level ?? 1, 1.5));
    const xpPct  = Math.min(1, (p.xp ?? 0) / xpNeeded);

    const resLabel = p.resourceDef?.label ?? "Mana";
    const resFill  = p.resourceDef?.type === "rage" ? "cs-rage-fill" : "cs-mp-fill";

    this._el.querySelector("#cs-vitals").innerHTML = `
      <div class="cs-vital-row">
        <span class="cs-vital-lbl">Hit Points</span>
        <span class="cs-vital-val">${Math.ceil(p.hp ?? 0)} / ${p.maxHp ?? 0}</span>
      </div>
      <div class="cs-vbar"><div class="cs-vbar-fill cs-hp-fill" style="width:${hpPct*100}%"></div></div>

      <div class="cs-vital-row">
        <span class="cs-vital-lbl">${resLabel}</span>
        <span class="cs-vital-val">${Math.floor(p.resource ?? 0)} / ${p.maxResource ?? 0}</span>
      </div>
      <div class="cs-vbar"><div class="cs-vbar-fill ${resFill}" style="width:${resPct*100}%"></div></div>

      <div class="cs-vital-row">
        <span class="cs-vital-lbl">Experience</span>
        <span class="cs-vital-val">${p.xp ?? 0} / ${xpNeeded} XP</span>
      </div>
      <div class="cs-vbar"><div class="cs-vbar-fill cs-xp-fill" style="width:${xpPct*100}%"></div></div>
    `;
  }

  _renderStats(p) {
    const stats = p.stats ?? {};
    const STAT_NAMES = ["STR","DEX","CON","INT","WIS","CHA"];
    const el = this._el.querySelector("#cs-stats");

    if (!Object.keys(stats).length) {
      el.innerHTML = `<div style="font-size:0.7rem;color:#6b5030;grid-column:1/-1">No ability scores recorded.</div>`;
      return;
    }

    el.innerHTML = STAT_NAMES.map(s => {
      const val = stats[s] ?? stats[s.toLowerCase()] ?? 10;
      const mod = Math.floor((val - 10) / 2);
      const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
      return `
        <div class="cs-stat">
          <span class="cs-stat-lbl">${s}</span>
          <span class="cs-stat-val">${val}</span>
          <span class="cs-stat-mod">${modStr}</span>
        </div>`;
    }).join("");
  }

  _renderCombat(p, classDef) {
    const stats  = p.stats ?? {};
    const strMod = Math.floor(((stats.STR ?? stats.str ?? 10) - 10) / 2);
    const dexMod = Math.floor(((stats.DEX ?? stats.dex ?? 10) - 10) / 2);
    const ac     = 10 + dexMod + (classDef.baseAC ?? 0);
    const toHit  = strMod >= 0 ? `+${strMod}` : `${strMod}`;
    const speed  = classDef.speed ?? p.actionSpeed ?? 60;

    this._el.querySelector("#cs-combat").innerHTML = `
      <div class="cs-combat-item">
        <span class="cs-combat-lbl">ARMOUR CLASS</span>
        <span class="cs-combat-val">${ac}</span>
      </div>
      <div class="cs-combat-item">
        <span class="cs-combat-lbl">TO HIT BONUS</span>
        <span class="cs-combat-val">${toHit}</span>
      </div>
      <div class="cs-combat-item">
        <span class="cs-combat-lbl">ACTION SPEED</span>
        <span class="cs-combat-val">${speed} ticks</span>
      </div>
      <div class="cs-combat-item">
        <span class="cs-combat-lbl">LEVEL</span>
        <span class="cs-combat-val">${p.level ?? 1}</span>
      </div>
    `;
  }

  _renderTraits(p, classDef) {
    const traits = [
      { lbl: "Class",     val: classDef.name ?? p.classId ?? "—" },
      { lbl: "Gold",      val: `${p.gold ?? 0} gp` },
      { lbl: "Kills",     val: p.kills ?? 0 },
      { lbl: "Deaths",    val: p.deaths ?? 0 },
    ];

    this._el.querySelector("#cs-traits").innerHTML = traits.map(t => `
      <div class="cs-trait-row">
        <span class="cs-trait-lbl">${t.lbl}</span>
        <span class="cs-trait-val">${t.val}</span>
      </div>`).join("");

    this._el.querySelector("#cs-gold").textContent = `💰 ${p.gold ?? 0} gp`;
  }

  _renderEquipment(p) {
    const slots = [
      { key: "head",     label: "Head" },
      { key: "chest",    label: "Chest" },
      { key: "legs",     label: "Legs" },
      { key: "mainhand", label: "Main Hand" },
      { key: "offhand",  label: "Off Hand" },
      { key: "boots",    label: "Boots" },
      { key: "ring1",    label: "Ring 1" },
      { key: "ring2",    label: "Ring 2" },
      { key: "necklace", label: "Neck" },
    ];

    const equip = p.equipment ?? {};
    this._el.querySelector("#cs-equip").innerHTML = slots.map(s => {
      const itemId = equip[s.key];
      const def    = itemId ? (this.itemDefs[itemId] ?? null) : null;
      return `
        <div class="cs-equip-slot ${def ? "filled" : ""}">
          <span class="cs-equip-lbl">${s.label.toUpperCase()}</span>
          <span class="cs-equip-icon">${def?.icon ?? "—"}</span>
          <span class="cs-equip-name">${def?.name ?? ""}</span>
        </div>`;
    }).join("");
  }

  _renderInventory(p) {
    const bag = p.bag ?? [];
    this._el.querySelector("#cs-inv").innerHTML = bag.map((slot, i) => {
      if (!slot) return `<div class="cs-inv-slot"></div>`;
      const def = this.itemDefs[slot.itemId] ?? null;
      return `
        <div class="cs-inv-slot filled" title="${def?.name ?? slot.itemId}">
          <span class="cs-inv-icon">${def?.icon ?? "📦"}</span>
          ${slot.qty > 1 ? `<span class="cs-inv-qty">${slot.qty}</span>` : ""}
        </div>`;
    }).join("");
  }

  _renderAbilities(p) {
    const abilityIds = p.abilities ?? [];
    const el = this._el.querySelector("#cs-abilities-list");

    if (!abilityIds.length) {
      el.innerHTML = `<div style="font-size:0.7rem;color:#6b5030">No abilities known.</div>`;
      return;
    }

    el.innerHTML = abilityIds.map(id => {
      const ab = this.abilities[id];
      if (!ab) return "";
      // damage uses base/variance; heal abilities use ab.heal instead
      let dmg = "";
      if (ab.damage?.base)       dmg = `${ab.damage.base}–${ab.damage.base + ab.damage.variance} dmg`;
      else if (ab.heal?.base)    dmg = `${ab.heal.base}–${ab.heal.base + ab.heal.variance} heal`;
      const range = ab.range    ? `${ab.range}t range` : "";
      const cost  = ab.cost?.mana ? `${ab.cost.mana} mana`
                  : ab.cost?.rage ? `${ab.cost.rage} rage` : "";
      const cd    = ab.cooldown ? `${(ab.cooldown/60).toFixed(1)}s cd` : "";
      const meta  = [dmg, range, cost, cd].filter(Boolean).join("  ·  ");
      return `
        <div class="cs-ability-card">
          <div>
            <span class="cs-ability-name">${ab.name ?? id}</span>
            <span class="cs-ability-type">${(ab.type ?? "").toUpperCase()}</span>
          </div>
          ${ab.description ? `<div class="cs-ability-desc">${ab.description}</div>` : ""}
          ${meta ? `<div class="cs-ability-stats">${meta}</div>` : ""}
        </div>`;
    }).filter(Boolean).join("");
  }
}