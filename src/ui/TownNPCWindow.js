/**
 * TownNPCWindow.js
 *
 * Simple dialog shown when player clicks an ambient town NPC.
 */

export class TownNPCWindow {
  constructor({ npc }) {
    this.npc  = npc;
    this._el  = null;
  }

  show() {
    document.getElementById("townnpc-window")?.remove();

    this._el = document.createElement("div");
    this._el.id = "townnpc-window";
    this._el.style.cssText = `
      position: fixed;
      bottom: 120px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 150;
      background: linear-gradient(160deg, #1a1006, #0d0802);
      border: 1px solid #7a5020;
      max-width: 380px;
      width: 90%;
      font-family: 'Crimson Text', serif;
      color: #f0ddb8;
      box-shadow: 0 0 24px rgba(0,0,0,0.7);
      animation: npcIn .2s ease both;
    `;

    document.head.insertAdjacentHTML("beforeend", `
      <style>@keyframes npcIn { from { opacity:0; transform:translateX(-50%) translateY(8px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }</style>
    `);

    this._el.innerHTML = `
      <div style="padding:12px 16px;display:flex;align-items:center;gap:12px;">
        <span style="font-size:1.8rem;flex-shrink:0;">${this.npc.icon ?? "👤"}</span>
        <div style="flex:1;">
          <div style="font-family:'Cinzel',serif;font-size:.78rem;color:#e8b84a;">${this.npc.name}<span style="color:#a8865a;font-size:.65rem;margin-left:6px;">${this.npc.title ?? ""}</span></div>
          <div style="font-size:.8rem;color:#d4c4a0;font-style:italic;margin-top:4px;">"${this.npc.dialog}"</div>
        </div>
        <button id="townnpc-close" style="font-size:.7rem;padding:4px 8px;border:1px solid #4a2e10;color:#a8865a;background:transparent;cursor:pointer;flex-shrink:0;">✕</button>
      </div>
    `;

    document.body.appendChild(this._el);

    this._el.querySelector("#townnpc-close").addEventListener("click", () => this.hide());

    // Auto-close after 5 seconds
    this._timer = setTimeout(() => this.hide(), 5000);

    this._onKey = e => { if (e.key === "Escape" || e.key === " ") this.hide(); };
    window.addEventListener("keydown", this._onKey);
  }

  hide() {
    clearTimeout(this._timer);
    window.removeEventListener("keydown", this._onKey);
    this._el?.remove();
    this._el = null;
  }
}
