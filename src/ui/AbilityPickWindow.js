/**
 * AbilityPickWindow.js
 * Shown every 3rd level. Player can:
 *   - Add a new ability from the class pool (if they have < 5 learned)
 *   - Upgrade an existing ability (always available)
 * Basic attack (slot 1) is fixed and never shown here.
 *
 * Callbacks:
 *   onPick(abilityId)          — player picked a new ability
 *   onUpgrade(abilityId)       — player upgraded an existing ability
 */

export class AbilityPickWindow {
  constructor() {
    this._el      = null;
    this.onPick    = null;
    this.onUpgrade = null;
    this._inject();
  }

  // ── Public ────────────────────────────────────────────────────────────────

  /**
   * @param {object} opts
   * @param {number}   opts.level         - current level
   * @param {string[]} opts.learnedIds    - abilities the player already has (excluding basic)
   * @param {string[]} opts.poolIds       - full class pool (excluding basic)
   * @param {object}   opts.abilityDefs   - abilities.json map
   * @param {object}   opts.upgrades      - { [abilityId]: rank } current upgrade ranks
   */
  show({ level, learnedIds, poolIds, abilityDefs, upgrades = {} }) {
    this._el.style.display = "flex";

    const MAX_LEARNED = 5;
    const canLearnNew  = learnedIds.length < MAX_LEARNED;
    const availableNew = poolIds.filter(id => !learnedIds.includes(id));

    // Title
    this._el.querySelector("#apw-title").textContent = `Level ${level} — Ability Pick`;
    this._el.querySelector("#apw-sub").textContent   =
      `${learnedIds.length}/${MAX_LEARNED} abilities learned`;

    // Build card lists
    const newList    = this._el.querySelector("#apw-new-list");
    const upgradeList = this._el.querySelector("#apw-upgrade-list");

    // ── New abilities ──
    const newSection = this._el.querySelector("#apw-new-section");
    if (!canLearnNew || !availableNew.length) {
      newSection.style.display = "none";
    } else {
      newSection.style.display = "";
      newList.innerHTML = availableNew.map(id => {
        const ab = abilityDefs[id];
        if (!ab) return "";
        return this._cardHTML(id, ab, upgrades[id] ?? 0, "pick");
      }).join("");

      newList.querySelectorAll(".apw-btn-pick").forEach(btn => {
        btn.addEventListener("click", () => {
          this.onPick?.(btn.dataset.id);
          this.hide();
        });
      });
    }

    // ── Upgrade existing ──
    const upgradeSection = this._el.querySelector("#apw-upgrade-section");
    if (!learnedIds.length) {
      upgradeSection.style.display = "none";
    } else {
      upgradeSection.style.display = "";
      upgradeList.innerHTML = learnedIds.map(id => {
        const ab = abilityDefs[id];
        if (!ab) return "";
        return this._cardHTML(id, ab, upgrades[id] ?? 1, "upgrade");
      }).join("");

      upgradeList.querySelectorAll(".apw-btn-upgrade").forEach(btn => {
        btn.addEventListener("click", () => {
          this.onUpgrade?.(btn.dataset.id);
          this.hide();
        });
      });
    }

    // If nothing to do at all, just hide (shouldn't happen)
    if (!canLearnNew && !learnedIds.length) this.hide();
  }

  hide() {
    this._el.style.display = "none";
  }

  // ── Card HTML ─────────────────────────────────────────────────────────────

  _cardHTML(id, ab, rank, action) {
    const dmg = ab.damage?.base
      ? `${ab.damage.base}–${ab.damage.base + ab.damage.variance} dmg`
      : ab.heal?.base
      ? `${ab.heal.base}–${ab.heal.base + ab.heal.variance} heal`
      : "";
    const cost = ab.cost?.mana ? `${ab.cost.mana} mana`
               : ab.cost?.rage ? `${ab.cost.rage} rage` : "";
    const cd   = ab.cooldown   ? `${(ab.cooldown/60).toFixed(1)}s cd` : "";
    const meta = [dmg, cost, cd].filter(Boolean).join(" · ");

    const rankDisplay = rank > 0 ? `<span class="apw-rank">Rank ${rank}</span>` : "";
    const btnLabel    = action === "pick" ? "Learn" : `Upgrade → Rank ${rank + 1}`;
    const btnClass    = action === "pick" ? "apw-btn-pick" : "apw-btn-upgrade";

    return `
      <div class="apw-card">
        <div class="apw-card-header">
          <span class="apw-icon">${ab.icon ?? "⚔️"}</span>
          <div class="apw-card-info">
            <span class="apw-name">${ab.name}</span>
            ${rankDisplay}
            <span class="apw-type">${(ab.type ?? "").toUpperCase()}</span>
          </div>
        </div>
        ${ab.description ? `<div class="apw-desc">${ab.description}</div>` : ""}
        ${meta ? `<div class="apw-meta">${meta}</div>` : ""}
        <button class="${btnClass} apw-btn" data-id="${id}">${btnLabel}</button>
      </div>`;
  }

  // ── DOM injection ─────────────────────────────────────────────────────────

  _inject() {
    const style = document.createElement("style");
    style.textContent = `
      #apw-overlay {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.90);
        display: none; align-items: center; justify-content: center;
        z-index: 500; padding: 16px; box-sizing: border-box;
        font-family: 'Georgia', serif;
      }
      .apw-box {
        background: linear-gradient(160deg, #1a1208 0%, #0d0a04 100%);
        border: 1px solid #8a6a20;
        max-width: 640px; width: 100%; max-height: 88vh;
        overflow-y: auto; color: #c8b580;
        box-shadow: 0 0 80px rgba(0,0,0,0.9), 0 0 30px rgba(232,200,74,0.2);
        animation: apwIn .22s ease both;
      }
      @keyframes apwIn {
        from { opacity:0; transform:translateY(14px) scale(.97); }
        to   { opacity:1; transform:none; }
      }
      .apw-box::-webkit-scrollbar { width: 4px; }
      .apw-box::-webkit-scrollbar-thumb { background: #6b4e1a; }

      .apw-header {
        padding: 18px 22px 14px;
        border-bottom: 1px solid #3a2a0a;
        background: rgba(0,0,0,0.35);
        text-align: center;
      }
      #apw-title {
        font-size: 1.1rem; color: #e8c84a; letter-spacing: 3px;
        text-shadow: 0 0 14px rgba(232,200,74,0.4);
      }
      #apw-sub {
        font-size: 0.68rem; color: #6b5030; margin-top: 4px; letter-spacing: 1px;
      }

      .apw-body { padding: 16px 20px 20px; }

      .apw-section-title {
        font-size: 0.6rem; letter-spacing: 3px; text-transform: uppercase;
        color: #e8c84a; border-bottom: 1px solid #2a1e06;
        padding-bottom: 4px; margin: 16px 0 10px;
      }
      .apw-section-title:first-child { margin-top: 0; }

      .apw-card {
        background: rgba(0,0,0,0.3); border: 1px solid #2a1e06;
        padding: 10px 12px; margin-bottom: 8px; border-radius: 2px;
        transition: border-color .15s;
      }
      .apw-card:hover { border-color: #6b4e1a; }

      .apw-card-header {
        display: flex; align-items: flex-start; gap: 10px; margin-bottom: 5px;
      }
      .apw-icon { font-size: 1.4rem; flex-shrink: 0; }
      .apw-card-info { display: flex; flex-direction: column; gap: 2px; }
      .apw-name  { font-size: 0.85rem; color: #e8c84a; font-weight: bold; }
      .apw-rank  { font-size: 0.62rem; color: #8a7a40; letter-spacing: 1px; }
      .apw-type  { font-size: 0.58rem; color: #6b5030; letter-spacing: 2px; }

      .apw-desc {
        font-size: 0.7rem; color: #8a7040; line-height: 1.55;
        margin-bottom: 6px;
      }
      .apw-meta {
        font-size: 0.62rem; color: #7a8a60; margin-bottom: 8px;
      }

      .apw-btn {
        font-family: 'Georgia', serif;
        font-size: 0.7rem; letter-spacing: 1px;
        padding: 7px 16px; cursor: pointer;
        border-radius: 1px; transition: all .15s;
      }
      .apw-btn-pick {
        background: rgba(30,60,30,0.5);
        border: 1px solid #3a6a3a; color: #88cc88;
      }
      .apw-btn-pick:hover {
        background: rgba(40,80,40,0.7); border-color: #55aa55; color: #aaeaaa;
      }
      .apw-btn-upgrade {
        background: rgba(40,30,10,0.5);
        border: 1px solid #6b4e1a; color: #c8a050;
      }
      .apw-btn-upgrade:hover {
        background: rgba(60,45,15,0.7); border-color: #e8c84a; color: #e8c84a;
      }
    `;
    document.head.appendChild(style);

    const el = document.createElement("div");
    el.id = "apw-overlay";
    el.innerHTML = `
      <div class="apw-box">
        <div class="apw-header">
          <div id="apw-title">Level Up — Ability Pick</div>
          <div id="apw-sub"></div>
        </div>
        <div class="apw-body">
          <div id="apw-new-section">
            <div class="apw-section-title">Learn New Ability</div>
            <div id="apw-new-list"></div>
          </div>
          <div id="apw-upgrade-section">
            <div class="apw-section-title">Upgrade Existing Ability</div>
            <div id="apw-upgrade-list"></div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(el);
    this._el = el;
  }
}