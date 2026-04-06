/**
 * InnWindow.js
 *
 * Dialog shown when player clicks the innkeeper.
 * Free rest — restores full HP/resource and sets respawn point.
 *
 * Usage:
 *   const win = new InnWindow({ npc, player, townData });
 *   win.onRest = () => { ... };
 *   win.show();
 */

export class InnWindow {
  constructor({ npc, player, townData }) {
    this.npc      = npc;
    this.player   = player;
    this.townData = townData;
    this.onRest   = null;
    this._el      = null;
  }

  show() {
    document.getElementById("inn-window")?.remove();

    this._el = document.createElement("div");
    this._el.id = "inn-window";
    this._el.style.cssText = `
      position: fixed;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      z-index: 150;
      background: linear-gradient(160deg, #1a1006, #0d0802);
      border: 1px solid #7a5020;
      min-width: 320px;
      max-width: 400px;
      font-family: 'Crimson Text', serif;
      color: #f0ddb8;
      box-shadow: 0 0 40px rgba(0,0,0,0.85), 0 0 14px rgba(201,146,42,0.2);
    `;

    const missingHp  = this.player.maxHp - this.player.hp;
    const missingRes = this.player.maxResource - (this.player.resource ?? 0);
    const needsRest  = missingHp > 0 || missingRes > 0;

    this._el.innerHTML = `
      <div style="background:linear-gradient(90deg,#1e1206,#120c04);padding:14px 18px;border-bottom:1px solid #4a2e10;">
        <div style="font-family:'Cinzel Decorative',serif;font-size:.65rem;color:#a8865a;letter-spacing:2px;">Welcome to</div>
        <div style="font-family:'Cinzel',serif;font-size:1.1rem;color:#e8b84a;">${this.npc.innName ?? "The Inn"}</div>
      </div>

      <div style="padding:18px 20px;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
          <span style="font-size:2rem;">${this.npc.icon ?? "🏠"}</span>
          <div>
            <div style="font-family:'Cinzel',serif;font-size:.82rem;color:#e8b84a;">${this.npc.name}</div>
            <div style="font-size:.78rem;color:#a8865a;font-style:italic;margin-top:3px;">"${this.npc.dialog}"</div>
          </div>
        </div>

        ${needsRest ? `
          <div style="border:1px solid #4a2e10;padding:12px;margin-bottom:14px;background:rgba(0,0,0,0.3);">
            <div style="font-size:.72rem;color:#a8865a;margin-bottom:8px;">Current condition:</div>
            <div style="display:flex;gap:16px;">
              <div>
                <div style="font-size:.62rem;color:#a8865a;margin-bottom:2px;">HP</div>
                <div style="font-family:'Cinzel',serif;color:${missingHp > 0 ? "#cc4444" : "#44cc44"};">
                  ${Math.ceil(this.player.hp)} / ${this.player.maxHp}
                </div>
              </div>
              <div>
                <div style="font-size:.62rem;color:#a8865a;margin-bottom:2px;">${this.player.resourceDef?.label ?? "Resource"}</div>
                <div style="font-family:'Cinzel',serif;color:${missingRes > 0 ? "#4466cc" : "#44cc44"};">
                  ${Math.floor(this.player.resource ?? 0)} / ${this.player.maxResource}
                </div>
              </div>
            </div>
          </div>
          <div style="font-size:.75rem;color:#a8865a;font-style:italic;text-align:center;margin-bottom:14px;">
            Rest here to restore full health. Your respawn point will be set to ${this.townData.name}.
          </div>
        ` : `
          <div style="text-align:center;padding:12px;font-size:.82rem;color:#88cc88;font-style:italic;margin-bottom:14px;">
            You are fully rested. ✦
          </div>
        `}

        <div style="display:flex;gap:10px;justify-content:center;">
          ${needsRest ? `
            <button id="inn-rest-btn" style="font-family:'Cinzel',serif;font-size:.72rem;letter-spacing:2px;text-transform:uppercase;padding:10px 24px;border:1px solid #c9922a;color:#c9922a;background:transparent;cursor:pointer;transition:all .2s;">
              ✦ Rest (Free)
            </button>
          ` : ""}
          <button id="inn-close-btn" style="font-family:'Cinzel',serif;font-size:.72rem;letter-spacing:2px;text-transform:uppercase;padding:10px 18px;border:1px solid #4a2e10;color:#a8865a;background:transparent;cursor:pointer;">
            Leave
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(this._el);

    this._el.querySelector("#inn-close-btn")?.addEventListener("click", () => this.hide());
    this._el.querySelector("#inn-rest-btn")?.addEventListener("click", () => {
      this.onRest?.();
      this.hide();
    });

    this._onKey = e => { if (e.key === "Escape") this.hide(); };
    window.addEventListener("keydown", this._onKey);
  }

  hide() {
    window.removeEventListener("keydown", this._onKey);
    this._el?.remove();
    this._el = null;
  }
}
