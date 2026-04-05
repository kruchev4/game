/**
 * TitleScreen.js
 *
 * Canvas-drawn title screen. First thing the player sees.
 * Provides two paths:
 *   - New Character → CharacterCreation
 *   - Load Character → SlotPicker
 *
 * Usage:
 *   const title = new TitleScreen({ canvas, hasSaves });
 *   title.onNew  = () => { ... };
 *   title.onLoad = () => { ... };
 *   title.show();
 */

const BG_COLOR   = "#0a0a14";
const GOLD       = "#e8c84a";
const WHITE      = "#eeeeee";
const DIM        = "#888899";
const FONT_MONO  = "monospace";

export class TitleScreen {
  /**
   * @param {object}            opts
   * @param {HTMLCanvasElement} opts.canvas
   * @param {boolean}           opts.hasSaves  - whether any save slots are filled
   */
  constructor({ canvas, hasSaves = false }) {
    this.canvas   = canvas;
    this.ctx      = canvas.getContext("2d");
    this.hasSaves = hasSaves;
    this.active   = false;

    this.onNew  = null;
    this.onLoad = null;

    this._regions  = [];
    this._tick     = 0;
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
    const W = canvas.width  = window.innerWidth;
    const H = canvas.height = window.innerHeight;

    this._regions = [];

    // Background
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, W, H);

    // Starfield
    this._drawStars(W, H);

    const cx = W / 2;
    let   cy = H * 0.28;

    // ── Title ──
    ctx.textAlign = "center";

    // Glow pulse on title
    const pulse = 0.7 + 0.3 * Math.sin(this._tick * 0.03);
    ctx.shadowColor = `rgba(180, 140, 60, ${pulse * 0.8})`;
    ctx.shadowBlur  = 24;

    ctx.fillStyle = GOLD;
    ctx.font      = `bold 42px ${FONT_MONO}`;
    ctx.fillText("REALM OF ECHOES", cx, cy);

    ctx.shadowBlur = 0;
    cy += 32;

    ctx.fillStyle = DIM;
    ctx.font      = `14px ${FONT_MONO}`;
    ctx.fillText("An online D&D adventure", cx, cy);
    cy += 80;

    // ── Buttons ──
    const btnW = 220;
    const btnH = 48;
    const btnX = cx - btnW / 2;

    // New Character
    this._drawButton(ctx, btnX, cy, btnW, btnH, "New Character", "#334466", WHITE);
    this._addRegion("new", btnX, cy, btnW, btnH);
    cy += btnH + 16;

    // Load Character — dimmed if no saves
    this._drawButton(
      ctx, btnX, cy, btnW, btnH,
      "Load Character",
      this.hasSaves ? "#334433" : "#1e1e28",
      this.hasSaves ? WHITE     : DIM
    );
    this._addRegion("load", btnX, cy, btnW, btnH);

    if (!this.hasSaves) {
      ctx.fillStyle = DIM;
      ctx.font      = `10px ${FONT_MONO}`;
      ctx.fillText("No saved characters", cx, cy + btnH + 14);
    }

    // ── Version / credit footer ──
    ctx.fillStyle = "rgba(100,100,120,0.5)";
    ctx.font      = `10px ${FONT_MONO}`;
    ctx.fillText("v0.1 — Early Development", cx, H - 20);

    ctx.textAlign = "left";
  }

  _drawButton(ctx, x, y, w, h, label, bgColor, textColor) {
    ctx.fillStyle   = bgColor;
    ctx.strokeStyle = "rgba(180,180,220,0.25)";
    ctx.lineWidth   = 1.5;
    this._roundRect(x, y, w, h, 10);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1;

    ctx.fillStyle = textColor;
    ctx.font      = `bold 15px ${FONT_MONO}`;
    ctx.textAlign = "center";
    ctx.fillText(label, x + w / 2, y + h / 2 + 5);
  }

  _drawStars(W, H) {
    const ctx = this.ctx;
    for (let i = 0; i < 120; i++) {
      const sx    = (i * 137 + 41)  % W;
      const sy    = (i * 251 + 83)  % H;
      const twinkle = 0.2 + 0.8 * Math.abs(Math.sin(i + this._tick * 0.01));
      ctx.fillStyle = `rgba(255,255,255,${twinkle * 0.5})`;
      ctx.beginPath();
      ctx.arc(sx, sy, i % 3 === 0 ? 1.2 : 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _addRegion(id, x, y, w, h) {
    this._regions.push({ id, x, y, w, h });
  }

  _handleClick(e) {
    if (!this.active) return;
    const rect   = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width  / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const px     = (e.clientX - rect.left) * scaleX;
    const py     = (e.clientY - rect.top)  * scaleY;

    for (const r of this._regions) {
      if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) {
        if (r.id === "new") { this.hide(); this.onNew?.(); }
        if (r.id === "load" && this.hasSaves) { this.hide(); this.onLoad?.(); }
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
