/**
 * DeathScreen.js
 *
 * Canvas-drawn death screen. Shown when the player dies.
 * Displays cause of death, gold/XP penalty, and two options:
 *   - Respawn (with penalty applied)
 *   - Quit to Title
 *
 * Usage:
 *   const screen = new DeathScreen({ canvas, killerName, goldLost, xpLost });
 *   screen.onRespawn = () => { ... };
 *   screen.onQuit   = () => { ... };
 *   screen.show();
 */

const BG        = "rgba(0,0,0,0)";
const RED       = "#cc3333";
const RED_BRIGHT= "#ff5555";
const GOLD      = "#e8c84a";
const WHITE     = "#eeeeee";
const DIM       = "#888899";
const FONT_MONO = "monospace";

export class DeathScreen {
  /**
   * @param {object}            opts
   * @param {HTMLCanvasElement} opts.canvas
   * @param {string}            opts.killerName  - name of what killed the player
   * @param {number}            opts.goldLost    - gold penalty amount
   * @param {number}            opts.xpLost      - xp penalty amount
   */
  constructor({ canvas, killerName = "the darkness", goldLost = 0, xpLost = 0 }) {
    this.canvas     = canvas;
    this.ctx        = canvas.getContext("2d");
    this.killerName = killerName;
    this.goldLost   = goldLost;
    this.xpLost     = xpLost;
    this.active     = false;

    this.onRespawn = null;
    this.onQuit    = null;

    this._tick     = 0;
    this._regions  = [];
    this._onClick  = (e) => this._handleClick(e);
  }

  show() {
    this.active = true;
    this.canvas.addEventListener("pointerdown", this._onClick);
    this._loop();
  }

  hide() {
    this.active = false;
    this.canvas.removeEventListener("pointerdown", this._onClick);
  }

  _loop() {
    if (!this.active) return;
    this._tick++;
    this._draw();
    requestAnimationFrame(() => this._loop());
  }

  _draw() {
    const { ctx, canvas } = this;
    const W = canvas.width;
    const H = canvas.height;

    this._regions = [];

    // Dark red vignette overlay — fades in over ~60 ticks
    const fadeAlpha = Math.min(1, this._tick / 60);

    ctx.fillStyle = `rgba(30, 0, 0, ${fadeAlpha * 0.82})`;
    ctx.fillRect(0, 0, W, H);

    if (fadeAlpha < 0.5) {
      // Show a subtle "click to continue" during fade
      const promptAlpha = Math.min(1, fadeAlpha * 3);
      ctx.globalAlpha = promptAlpha;
      ctx.fillStyle   = "rgba(180, 60, 60, 0.7)";
      ctx.font        = `13px ${FONT_MONO}`;
      ctx.textAlign   = "center";
      ctx.fillText("— click to continue —", W / 2, H / 2 + 60);
      ctx.globalAlpha = 1;
      ctx.textAlign   = "left";
      return;
    }

    const uiAlpha  = Math.min(1, (fadeAlpha - 0.5) * 2);
    const cx       = W / 2;
    const cy       = H / 2;

    // ── YOU HAVE FALLEN ──
    const pulse    = 0.8 + 0.2 * Math.sin(this._tick * 0.04);
    ctx.globalAlpha = uiAlpha;

    ctx.shadowColor = `rgba(200, 30, 30, ${pulse * 0.9})`;
    ctx.shadowBlur  = 30;
    ctx.fillStyle   = RED_BRIGHT;
    ctx.font        = `bold 38px ${FONT_MONO}`;
    ctx.textAlign   = "center";
    ctx.fillText("YOU HAVE FALLEN", cx, cy - 110);
    ctx.shadowBlur  = 0;

    // Ornament line
    ctx.strokeStyle = "rgba(180, 40, 40, 0.5)";
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 180, cy - 88);
    ctx.lineTo(cx + 180, cy - 88);
    ctx.stroke();

    // Killed by
    ctx.fillStyle = DIM;
    ctx.font      = `italic 15px ${FONT_MONO}`;
    ctx.fillText(`Slain by ${this.killerName}`, cx, cy - 62);

    // Penalty panel
    const panelW = 320;
    const panelH = 90;
    const panelX = cx - panelW / 2;
    const panelY = cy - 40;

    ctx.fillStyle   = "rgba(20, 0, 0, 0.7)";
    ctx.strokeStyle = "rgba(140, 30, 30, 0.5)";
    ctx.lineWidth   = 1;
    this._roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(180, 60, 60, 0.8)";
    ctx.font      = `bold 11px ${FONT_MONO}`;
    ctx.fillText("DEATH PENALTY", cx, panelY + 18);

    ctx.fillStyle = GOLD;
    ctx.font      = `13px ${FONT_MONO}`;
    ctx.fillText(
      `Gold lost: ${this.goldLost}`,
      cx, panelY + 40
    );

    ctx.fillStyle = "#aa88ff";
    ctx.fillText(
      `XP lost: ${this.xpLost}`,
      cx, panelY + 60
    );

    ctx.fillStyle = DIM;
    ctx.font      = `10px ${FONT_MONO}`;
    ctx.fillText("(A bank will protect your gold in towns)", cx, panelY + 78);

    // ── Buttons ──
    const btnY   = cy + 72;
    const btnW   = 160;
    const btnH   = 44;
    const btnGap = 16;
    const startX = cx - btnW - btnGap / 2;

    // Respawn
    ctx.fillStyle   = "rgba(20, 60, 20, 0.9)";
    ctx.strokeStyle = "rgba(60, 160, 60, 0.6)";
    ctx.lineWidth   = 1.5;
    this._roundRect(startX, btnY, btnW, btnH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#88ee88";
    ctx.font      = `bold 13px ${FONT_MONO}`;
    ctx.fillText("Respawn", startX + btnW / 2, btnY + btnH / 2 + 5);
    this._addRegion("respawn", startX, btnY, btnW, btnH);

    // Quit to title
    const quitX = cx + btnGap / 2;
    ctx.fillStyle   = "rgba(40, 10, 10, 0.9)";
    ctx.strokeStyle = "rgba(140, 40, 40, 0.6)";
    ctx.lineWidth   = 1.5;
    this._roundRect(quitX, btnY, btnW, btnH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ee8888";
    ctx.font      = `bold 13px ${FONT_MONO}`;
    ctx.fillText("Quit to Title", quitX + btnW / 2, btnY + btnH / 2 + 5);
    this._addRegion("quit", quitX, btnY, btnW, btnH);

    ctx.globalAlpha = 1;
    ctx.textAlign   = "left";
    ctx.lineWidth   = 1;
    ctx.shadowBlur  = 0;
  }

  _addRegion(id, x, y, w, h) {
    this._regions.push({ id, x, y, w, h });
  }

  _handleClick(e) {
    if (!this.active) return;

    // Only respond after brief fade-in
    if (this._tick < 30) return;

    const rect   = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width  / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const px     = (e.clientX - rect.left) * scaleX;
    const py     = (e.clientY - rect.top)  * scaleY;

    for (const r of this._regions) {
      if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) {
        this.hide();
        if (r.id === "respawn") this.onRespawn?.();
        if (r.id === "quit")    this.onQuit?.();
        return;
      }
    }
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
}
