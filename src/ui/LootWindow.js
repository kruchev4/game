/**
 * LootWindow.js
 *
 * HTML overlay showing loot available in a corpse.
 * Player clicks "Take All" or individual items.
 * Calls lootSystem.lootCorpse() and updates display.
 *
 * Usage:
 *   const win = new LootWindow({ corpse, lootSystem, itemDefs });
 *   win.onClose = () => { ... };
 *   win.show();
 */

export class LootWindow {
  constructor({ corpse, lootSystem, itemDefs }) {
    this.corpse     = corpse;
    this.lootSystem = lootSystem;
    this.itemDefs   = itemDefs;
    this.onClose    = null;
    this._el        = null;
  }

  show() {
    this._el = document.createElement("div");
    this._el.id = "loot-window";
    this._el.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 150;
      background: linear-gradient(160deg, #1a1006, #0d0802);
      border: 1px solid #7a5020;
      min-width: 280px;
      max-width: 340px;
      font-family: 'Crimson Text', serif;
      color: #f0ddb8;
      box-shadow: 0 0 40px rgba(0,0,0,0.8), 0 0 14px rgba(201,146,42,0.2);
      animation: lootIn 0.2s ease both;
    `;

    document.head.insertAdjacentHTML("beforeend", `
      <style>
        @keyframes lootIn { from { opacity:0; transform:translate(-50%,-50%) scale(.95); } to { opacity:1; transform:translate(-50%,-50%) scale(1); } }
        .loot-item { display:flex; align-items:center; gap:10px; padding:7px 12px; border-bottom:1px solid rgba(74,46,16,0.4); cursor:pointer; transition:background .15s; }
        .loot-item:hover { background:rgba(201,146,42,0.08); }
        .loot-item:last-child { border-bottom:none; }
        .loot-icon { font-size:1.3rem; width:28px; text-align:center; }
        .loot-name { flex:1; font-size:.85rem; }
        .loot-qty  { font-size:.75rem; color:#a8865a; font-family:'Cinzel',serif; }
        .loot-rarity-uncommon { color:#88aaff; }
        .loot-rarity-rare     { color:#aa66ff; }
      </style>
    `);

    this._render();
    document.body.appendChild(this._el);

    // Close on Escape
    this._onKey = (e) => { if (e.key === "Escape") this.hide(); };
    window.addEventListener("keydown", this._onKey);
  }

  hide() {
    window.removeEventListener("keydown", this._onKey);
    this._el?.remove();
    this._el = null;
    this.onClose?.();
  }

  _render() {
    const corpse   = this.corpse;
    const hasLoot  = corpse.hasLoot;
    const npcLabel = corpse.npcClassId
      .replace(/([A-Z])/g, " $1")
      .replace(/\b\w/g, c => c.toUpperCase())
      .trim();

    const goldHtml = corpse.gold > 0
      ? `<div class="loot-item" id="loot-gold">
           <span class="loot-icon">🪙</span>
           <span class="loot-name">Gold</span>
           <span class="loot-qty">${corpse.gold} gp</span>
         </div>`
      : "";

    const itemsHtml = corpse.items.map(drop => {
  const def = this.itemDefs[drop.itemId] ?? drop;
  const rarityClass = def.rarity ? `loot-rarity-${def.rarity}` : "";
  return `
    <div class="loot-item" data-item="${drop.itemId}">
      <span class="loot-icon">${def.icon ?? "📦"}</span>
      <span class="loot-name ${rarityClass}">${def.name ?? drop.itemId}</span>
      <span class="loot-qty">${drop.qty > 1 ? "x" + drop.qty : ""}</span>
    </div>`;
}).join("");

    this._el.innerHTML = `
      <div style="background:linear-gradient(90deg,#1e1206,#120c04);padding:12px 16px;border-bottom:1px solid #4a2e10;display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-family:'Cinzel Decorative',serif;font-size:.7rem;color:#a8865a;letter-spacing:2px;">Slain</div>
          <div style="font-family:'Cinzel',serif;font-size:.95rem;color:#e8b84a;">${npcLabel}</div>
        </div>
        <button id="loot-close" style="font-family:'Cinzel',serif;font-size:.58rem;letter-spacing:2px;text-transform:uppercase;padding:5px 10px;border:1px solid #4a2e10;color:#a8865a;background:transparent;cursor:pointer;">✕ Close</button>
      </div>

      ${hasLoot ? `
        <div style="padding:4px 0;" id="loot-items">
          ${goldHtml}
          ${itemsHtml}
        </div>
        <div style="padding:10px 14px;border-top:1px solid #4a2e10;">
          <button id="loot-take-all" style="width:100%;font-family:'Cinzel',serif;font-size:.72rem;letter-spacing:2px;text-transform:uppercase;padding:9px;border:1px solid #c9922a;color:#c9922a;background:transparent;cursor:pointer;transition:all .2s;">
            ✦ Take All
          </button>
        </div>
      ` : `
        <div style="padding:24px;text-align:center;font-size:.8rem;color:#a8865a;font-style:italic;">
          Nothing remains.
        </div>
      `}
    `;

    this._el.querySelector("#loot-close").addEventListener("click", () => this.hide());

    if (hasLoot) {
      this._el.querySelector("#loot-take-all").addEventListener("click", () => {
        this.lootSystem.lootCorpse(this.corpse);
        this.hide();
      });

      this._el.querySelector("#loot-take-all").addEventListener("mouseenter", e => {
        e.target.style.background = "rgba(201,146,42,0.14)";
      });
      this._el.querySelector("#loot-take-all").addEventListener("mouseleave", e => {
        e.target.style.background = "transparent";
      });
    }
  }
}
