/**
 * ShopWindow.js
 *
 * Two-tab shop: Buy (shop inventory) and Sell (player bag).
 * Buy prices from townData.shopInventory.
 * Sell prices = item.value * sellMultiplier (default 0.5).
 *
 * Usage:
 *   const win = new ShopWindow({ npc, player, townData, itemDefs, lootSystem });
 *   win.show();
 */

export class ShopWindow {
  constructor({ npc, player, townData, itemDefs, lootSystem }) {
    this.npc        = npc;
    this.player     = player;
    this.townData   = townData;
    this.itemDefs   = itemDefs;
    this.lootSystem = lootSystem;
    this._el        = null;
    this._tab       = "buy";
  }

  show() {
    document.getElementById("shop-window")?.remove();

    this._el = document.createElement("div");
    this._el.id = "shop-window";
    this._el.style.cssText = `
      position: fixed;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      z-index: 150;
      background: linear-gradient(160deg, #1a1006, #0d0802);
      border: 1px solid #7a5020;
      width: 460px;
      max-height: 85vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      font-family: 'Crimson Text', serif;
      color: #f0ddb8;
      box-shadow: 0 0 40px rgba(0,0,0,0.85), 0 0 14px rgba(201,146,42,0.2);
    `;

    document.body.appendChild(this._el);
    this._render();

    this._onKey = e => { if (e.key === "Escape") this.hide(); };
    window.addEventListener("keydown", this._onKey);
  }

  hide() {
    window.removeEventListener("keydown", this._onKey);
    this._el?.remove();
    this._el = null;
  }

  _render() {
    if (!this._el) return;

    const inventory = this.townData.shopInventory ?? [];

    this._el.innerHTML = `
      <style>
        .shop-row { display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid rgba(74,46,16,0.4);transition:background .15s;cursor:pointer; }
        .shop-row:hover { background:rgba(201,146,42,0.07); }
        .shop-row:last-child { border-bottom:none; }
        .shop-icon { font-size:1.3rem;width:28px;text-align:center;flex-shrink:0; }
        .shop-name { flex:1;font-size:.85rem; }
        .shop-price { font-family:'Cinzel',serif;font-size:.78rem;color:#e8b84a;flex-shrink:0; }
        .shop-btn { font-family:'Cinzel',serif;font-size:.6rem;letter-spacing:1px;text-transform:uppercase;padding:4px 10px;border:1px solid;cursor:pointer;background:transparent;transition:all .2s;flex-shrink:0; }
        .shop-btn-buy { border-color:#c9922a;color:#c9922a; }
        .shop-btn-buy:hover { background:rgba(201,146,42,0.14); }
        .shop-btn-sell { border-color:#44aa44;color:#44aa44; }
        .shop-btn-sell:hover { background:rgba(40,160,40,0.14); }
        .shop-btn:disabled { opacity:.3;cursor:not-allowed;pointer-events:none; }
        .shop-tab { font-family:'Cinzel',serif;font-size:.65rem;letter-spacing:2px;text-transform:uppercase;padding:8px 20px;cursor:pointer;border-bottom:2px solid transparent;color:#a8865a;transition:all .2s; }
        .shop-tab.active { color:#e8b84a;border-bottom-color:#c9922a; }
      </style>

      <!-- Header -->
      <div style="background:linear-gradient(90deg,#1e1206,#120c04);padding:12px 16px;border-bottom:1px solid #4a2e10;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
        <div>
          <div style="font-family:'Cinzel Decorative',serif;font-size:.65rem;color:#a8865a;letter-spacing:2px;">${this.npc.name}</div>
          <div style="font-family:'Cinzel',serif;font-size:1rem;color:#e8b84a;">${this.npc.shopName ?? "Shop"}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:.82rem;color:#e8b84a;">🪙 ${this.player.gold} gp</span>
          <button id="shop-close" style="font-family:'Cinzel',serif;font-size:.58rem;letter-spacing:2px;text-transform:uppercase;padding:5px 10px;border:1px solid #4a2e10;color:#a8865a;background:transparent;cursor:pointer;">✕</button>
        </div>
      </div>

      <!-- Tabs -->
      <div style="display:flex;border-bottom:1px solid #4a2e10;flex-shrink:0;">
        <div class="shop-tab ${this._tab === "buy" ? "active" : ""}" id="tab-buy">Buy</div>
        <div class="shop-tab ${this._tab === "sell" ? "active" : ""}" id="tab-sell">Sell</div>
      </div>

      <!-- Content -->
      <div id="shop-content" style="overflow-y:auto;flex:1;">
        ${this._tab === "buy" ? this._renderBuyTab(inventory) : this._renderSellTab()}
      </div>
    `;

    this._el.querySelector("#shop-close").addEventListener("click", () => this.hide());
    this._el.querySelector("#tab-buy").addEventListener("click", () => { this._tab = "buy"; this._render(); });
    this._el.querySelector("#tab-sell").addEventListener("click", () => { this._tab = "sell"; this._render(); });

    // Buy buttons
    this._el.querySelectorAll(".btn-buy-item").forEach(btn => {
      btn.addEventListener("click", () => {
        const itemId = btn.dataset.item;
        const price  = parseInt(btn.dataset.price);
        this._buyItem(itemId, price);
      });
    });

    // Sell buttons
    this._el.querySelectorAll(".btn-sell-item").forEach(btn => {
      btn.addEventListener("click", () => {
        const itemId    = btn.dataset.item;
        const sellPrice = parseInt(btn.dataset.price);
        this._sellItem(itemId, sellPrice);
      });
    });
  }

  _renderBuyTab(inventory) {
    if (!inventory.length) return `<div style="padding:24px;text-align:center;color:#a8865a;font-style:italic;">No stock available.</div>`;

    return inventory.map(entry => {
      const def        = this.itemDefs[entry.itemId];
      if (!def) return "";
      const canAfford  = this.player.gold >= entry.buyPrice;
      const bagFull    = !this.player.bag.some(s => s === null);

      return `
        <div class="shop-row">
          <span class="shop-icon">${def.icon ?? "📦"}</span>
          <div class="shop-name">
            <div>${def.name}</div>
            <div style="font-size:.68rem;color:#a8865a;font-style:italic;">${def.description}</div>
          </div>
          <span class="shop-price">🪙 ${entry.buyPrice}</span>
          <button class="shop-btn shop-btn-buy btn-buy-item"
                  data-item="${entry.itemId}"
                  data-price="${entry.buyPrice}"
                  ${(!canAfford || bagFull) ? "disabled" : ""}>
            ${bagFull ? "Full" : canAfford ? "Buy" : "Poor"}
          </button>
        </div>`;
    }).join("");
  }

  _renderSellTab() {
    const sellable = this.player.bag.filter(s => s !== null);
    if (!sellable.length) return `<div style="padding:24px;text-align:center;color:#a8865a;font-style:italic;">Nothing to sell.</div>`;

    return sellable.map(slot => {
      const def = this.itemDefs[slot.itemId];
      if (!def) return "";

      // Find sell multiplier from shop inventory if stocked, else default 0.5
      const shopEntry   = (this.townData.shopInventory ?? []).find(e => e.itemId === slot.itemId);
      const multiplier  = shopEntry?.sellMultiplier ?? 0.5;
      const sellPrice   = Math.max(1, Math.floor((def.value ?? 0) * multiplier));

      return `
        <div class="shop-row">
          <span class="shop-icon">${def.icon ?? "📦"}</span>
          <div class="shop-name">
            <div>${def.name} ${slot.qty > 1 ? `<span style="color:#e8b84a;">x${slot.qty}</span>` : ""}</div>
            <div style="font-size:.68rem;color:#a8865a;font-style:italic;">${def.description}</div>
          </div>
          <span class="shop-price" style="color:#88cc88;">🪙 ${sellPrice}</span>
          <button class="shop-btn shop-btn-sell btn-sell-item"
                  data-item="${slot.itemId}"
                  data-price="${sellPrice}">
            Sell
          </button>
        </div>`;
    }).join("");
  }

  _buyItem(itemId, price) {
    if (this.player.gold < price) return;
    const bagFull = !this.player.bag.some(s => s === null);
    if (bagFull) return;

    this.player.gold -= price;
    this.lootSystem.giveItem(itemId, 1);
    this._render();
  }

  _sellItem(itemId, sellPrice) {
    const slot = this.player.bag.find(s => s?.itemId === itemId);
    if (!slot) return;

    this.player.gold += sellPrice;
    this.lootSystem._removeFromBag(itemId, 1);
    this._render();
  }
}
