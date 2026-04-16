/**
 * DeathScreen.js
 *
 * HTML overlay death screen — works with both Canvas and Phaser renderers.
 * Replaces the old canvas-drawn version.
 */

export class DeathScreen {
  constructor({ canvas, killerName = "the darkness", goldLost = 0, xpLost = 0 }) {
    this.canvas     = canvas; // kept for API compatibility
    this.killerName = killerName;
    this.goldLost   = goldLost;
    this.xpLost     = xpLost;
    this.active     = false;
    this.onRespawn  = null;
    this.onQuit     = null;
    this._el        = null;
  }

  show() {
    this.active = true;
    this._render();
  }

  hide() {
    this.active = false;
    this._el?.remove();
    this._el = null;
  }

  _render() {
    document.getElementById("death-screen-overlay")?.remove();

    const el = document.createElement("div");
    el.id = "death-screen-overlay";
    el.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:10000",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "background:rgba(20,0,0,0.88)",
      "font-family:monospace",
      "animation:deathFadeIn 1s ease both"
    ].join(";");

    el.innerHTML = `
      <style>
        @keyframes deathFadeIn { from{opacity:0} to{opacity:1} }
        @keyframes deathPulse {
          0%,100%{text-shadow:0 0 20px rgba(200,30,30,0.8)}
          50%{text-shadow:0 0 40px rgba(255,60,60,1)}
        }
        #death-screen-overlay button {
          font-family:monospace; font-size:14px; font-weight:bold;
          padding:12px 32px; border-radius:6px; cursor:pointer;
          transition:all 0.2s; border:1.5px solid;
        }
        #death-btn-respawn {
          background:rgba(20,60,20,0.9); color:#88ee88;
          border-color:rgba(60,160,60,0.8);
        }
        #death-btn-respawn:hover {
          background:rgba(30,90,30,0.95);
          box-shadow:0 0 16px rgba(60,200,60,0.4);
        }
        #death-btn-quit {
          background:rgba(40,10,10,0.9); color:#ee8888;
          border-color:rgba(140,40,40,0.8);
        }
        #death-btn-quit:hover {
          background:rgba(70,15,15,0.95);
          box-shadow:0 0 16px rgba(200,60,60,0.4);
        }
      </style>
      <div style="text-align:center;max-width:420px;padding:32px;">
        <div style="color:#ff5555;font-size:36px;font-weight:bold;letter-spacing:4px;margin-bottom:10px;animation:deathPulse 2s ease infinite;">
          YOU HAVE FALLEN
        </div>
        <div style="width:360px;height:1px;background:linear-gradient(90deg,transparent,rgba(180,40,40,0.6),transparent);margin:0 auto 14px;"></div>
        <div style="color:#888899;font-style:italic;font-size:15px;margin-bottom:24px;">
          Slain by ${this.killerName}
        </div>
        <div style="background:rgba(20,0,0,0.7);border:1px solid rgba(140,30,30,0.5);border-radius:6px;padding:16px 24px;margin-bottom:28px;">
          <div style="color:rgba(180,60,60,0.9);font-size:11px;font-weight:bold;letter-spacing:2px;margin-bottom:12px;">DEATH PENALTY</div>
          <div style="color:#e8c84a;font-size:13px;margin-bottom:6px;">Gold lost: ${this.goldLost}</div>
          <div style="color:#aa88ff;font-size:13px;margin-bottom:10px;">XP lost: ${this.xpLost}</div>
          <div style="color:#555566;font-size:10px;">(A bank will protect your gold in towns)</div>
        </div>
        <div style="display:flex;gap:16px;justify-content:center;">
          <button id="death-btn-respawn">Respawn [R]</button>
          <button id="death-btn-quit">Quit [Q]</button>
        </div>
      </div>
    `;

    document.body.appendChild(el);
    this._el = el;

    document.getElementById("death-btn-respawn").onclick = () => {
      this.hide(); this.onRespawn?.();
    };
    document.getElementById("death-btn-quit").onclick = () => {
      this.hide(); this.onQuit?.();
    };

    const onKey = (e) => {
      if (!this.active) { window.removeEventListener("keydown", onKey); return; }
      if (e.key === "r" || e.key === "R") {
        window.removeEventListener("keydown", onKey);
        this.hide(); this.onRespawn?.();
      } else if (e.key === "q" || e.key === "Q" || e.key === "Escape") {
        window.removeEventListener("keydown", onKey);
        this.hide(); this.onQuit?.();
      }
    };
    window.addEventListener("keydown", onKey);
  }
}
