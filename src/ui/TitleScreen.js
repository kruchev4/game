/**
 * TitleScreen.js
 *
 * Canvas-drawn title + character select screen.
 * Shows all save slots. Filled slots are selectable characters.
 * Empty slots are greyed out. A "New Character" button is always visible.
 *
 * Automatically assigns the next free slot on new character creation.
 * If all slots are full, the oldest save is overwritten (future: let user choose).
 *
 * Usage:
 *   const title = new TitleScreen({ canvas, slots, saveProvider });
 *   title.onLoad   = (slotIndex, saveData) => { ... };
 *   title.onNew    = (slotIndex) => { ... };  // slotIndex = slot to save new char into
 *   title.show();
 */

const BG_COLOR  = "#0a0a14";
const GOLD      = "#e8c84a";
const WHITE     = "#eeeeee";
const DIM       = "#555566";
const RED       = "#cc4444";
const FONT_MONO = "monospace";

export class TitleScreen {
  /**
   * @param {object}             opts
   * @param {HTMLCanvasElement}  opts.canvas
   * @param {Array<object|null>} opts.slots        - save slot data, null = empty
   * @param {SaveProvider}       opts.saveProvider
   */
  constructor({ canvas, slots, saveProvider }) {
    this.canvas       = canvas;
    this.ctx          = canvas.getContext("2d");
    this.slots        = slots;
    this.saveProvider = saveProvider;
    this.active       = false;

    this.onLoad = null;   // (slotIndex, saveData) => {}
    this.onNew  = null;   // (slotIndex) => {}

    this._regions  = [];
    this._tick     = 0;
    this._confirm  = null; // { action: "delete", slotIndex }
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

  // ─────────────────────────────────────────────
  // DRAWING
  // ─────────────────────────────────────────────

  _draw() {
    const { ctx, canvas } = this;
    const W = canvas.width  = window.innerWidth;
    const H = canvas.height = window.innerHeight;

    this._regions = [];

    // Background
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, W, H);
    this._drawStars(W, H);

    // Panel
    const panelW = Math.min(580, W - 40);
    const panelH = Math.min(600, H - 40);
    const panelX = (W - panelW) / 2;
    const panelY = (H - panelH) / 2;

    ctx.fillStyle   = "rgba(12, 12, 26, 0.97)";
    ctx.strokeStyle = "rgba(120, 100, 180, 0.45)";
    ctx.lineWidth   = 1.5;
    this._roundRect(panelX, panelY, panelW, panelH, 14);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1;

    const cx = panelX + panelW / 2;
    let cy    = panelY + 44;

    // ── Title ──
    ctx.textAlign = "center";

    const pulse       = 0.75 + 0.25 * Math.sin(this._tick * 0.03);
    ctx.shadowColor   = `rgba(200, 160, 50, ${pulse * 0.7})`;
    ctx.shadowBlur    = 20;
    ctx.fillStyle     = GOLD;
    ctx.font          = `bold 28px ${FONT_MONO}`;
    ctx.fillText("REALM OF ECHOES", cx, cy);
    ctx.shadowBlur    = 0;
    cy += 20;

    ctx.fillStyle = DIM;
    ctx.font      = `12px ${FONT_MONO}`;
    ctx.fillText("Select your hero or begin anew", cx, cy);
    cy += 32;

    // Divider
    ctx.strokeStyle = "rgba(120,100,180,0.25)";
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(panelX + 30, cy);
    ctx.lineTo(panelX + panelW - 30, cy);
    ctx.stroke();
    cy += 20;

    // ── Save slots ──
    const slotH   = 68;
    const slotGap = 8;
    const slotX   = panelX + 20;
    const slotW   = panelW - 40;

    for (let i = 0; i < this.slots.length; i++) {
      const data   = this.slots[i];
      const sy     = cy + i * (slotH + slotGap);
      const filled = data !== null;

      // Slot background
      ctx.fillStyle   = filled
        ? "rgba(24, 28, 52, 0.9)"
        : "rgba(14, 14, 24, 0.5)";
      ctx.strokeStyle = filled
        ? "rgba(100, 120, 200, 0.45)"
        : "rgba(50, 50, 70, 0.3)";
      ctx.lineWidth = 1;
      this._roundRect(slotX, sy, slotW, slotH, 8);
      ctx.fill();
      ctx.stroke();

      if (filled) {
        // Character name
        ctx.fillStyle = WHITE;
        ctx.font      = `bold 15px ${FONT_MONO}`;
        ctx.textAlign = "left";
        ctx.fillText(data.name ?? "Unknown", slotX + 14, sy + 24);

        // Class + date
        ctx.fillStyle = "rgba(160,160,200,0.8)";
        ctx.font      = `11px ${FONT_MONO}`;
        const classLabel = (data.classId ?? "")
          .replace(/([A-Z])/g, " $1")
          .replace(/\b\w/g, c => c.toUpperCase())
          .trim();
        const dateStr = data.savedAt
          ? new Date(data.savedAt).toLocaleDateString()
          : "";
        ctx.fillText(
          `${classLabel}${dateStr ? "  ·  " + dateStr : ""}`,
          slotX + 14, sy + 42
        );

        // Gold
        if (data.gold !== undefined) {
          ctx.fillStyle = GOLD;
          ctx.font      = `10px ${FONT_MONO}`;
          ctx.fillText(`${data.gold} gold`, slotX + 14, sy + 58);
        }

        // Play button
        const playW = 80;
        const playX = slotX + slotW - playW - 50;
        this._drawBtn(ctx, playX, sy + 19, playW, 30, "Play →", "#223355", WHITE);
        this._addRegion(`load_${i}`, playX, sy + 19, playW, 30);

        // Delete button
        const delX = slotX + slotW - 40;
        this._drawBtn(ctx, delX, sy + 19, 32, 30, "✕", "#331111", RED);
        this._addRegion(`delete_${i}`, delX, sy + 19, 32, 30);

      } else {
        // Empty slot — just a label
        ctx.fillStyle = "rgba(80,80,100,0.35)";
        ctx.font      = `11px ${FONT_MONO}`;
        ctx.textAlign = "center";
        ctx.fillText(`— Empty —`, slotX + slotW / 2, sy + slotH / 2 + 4);
      }
    }

    cy += this.slots.length * (slotH + slotGap) + 16;

    // ── New Character button ──
    const newBtnW = 200;
    const newBtnX = cx - newBtnW / 2;
    this._drawBtn(ctx, newBtnX, cy, newBtnW, 42, "+ New Character", "#1a2e1a", "#88ee88");
    this._addRegion("new", newBtnX, cy, newBtnW, 42);

    cy += 56;

    // Version footer
    ctx.fillStyle = "rgba(80,80,100,0.4)";
    ctx.font      = `10px ${FONT_MONO}`;
    ctx.textAlign = "center";
    ctx.fillText("v0.1 — Early Development", cx, panelY + panelH - 16);

    // Confirm dialog overlay
    if (this._confirm) {
      this._drawConfirm(ctx, W, H);
    }

    ctx.textAlign = "left";
  }

  _drawBtn(ctx, x, y, w, h, label, bg, color) {
    ctx.fillStyle   = bg;
    ctx.strokeStyle = "rgba(180,180,220,0.15)";
    ctx.lineWidth   = 1;
    this._roundRect(x, y, w, h, 7);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.font      = `bold 12px ${FONT_MONO}`;
    ctx.textAlign = "center";
    ctx.fillText(label, x + w / 2, y + h / 2 + 4);
  }

  _drawConfirm(ctx, W, H) {
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(0, 0, W, H);

    const dW = 300, dH = 130;
    const dx = (W - dW) / 2;
    const dy = (H - dH) / 2;

    ctx.fillStyle   = "rgba(18,14,32,0.98)";
    ctx.strokeStyle = "rgba(180,50,50,0.6)";
    ctx.lineWidth   = 1.5;
    this._roundRect(dx, dy, dW, dH, 12);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1;

    ctx.fillStyle = WHITE;
    ctx.font      = `bold 14px ${FONT_MONO}`;
    ctx.textAlign = "center";
    ctx.fillText("Delete this character?", dx + dW / 2, dy + 34);

    ctx.fillStyle = DIM;
    ctx.font      = `11px ${FONT_MONO}`;
    ctx.fillText("This cannot be undone.", dx + dW / 2, dy + 54);

    const bW     = 106;
    const gap    = 14;
    const startX = dx + (dW - (bW * 2 + gap)) / 2;
    const bY     = dy + 76;

    this._drawBtn(ctx, startX,          bY, bW, 32, "Cancel", "#223344", WHITE);
    this._addRegion("confirm_cancel", startX, bY, bW, 32);

    this._drawBtn(ctx, startX + bW + gap, bY, bW, 32, "Delete", "#441111", RED);
    this._addRegion("confirm_delete", startX + bW + gap, bY, bW, 32);
  }

  _drawStars(W, H) {
    const ctx = this.ctx;
    for (let i = 0; i < 100; i++) {
      const sx      = (i * 137 + 41) % W;
      const sy      = (i * 251 + 83) % H;
      const twinkle = 0.15 + 0.6 * Math.abs(Math.sin(i * 0.7 + this._tick * 0.012));
      ctx.fillStyle = `rgba(255,255,255,${twinkle})`;
      ctx.beginPath();
      ctx.arc(sx, sy, i % 4 === 0 ? 1.2 : 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ─────────────────────────────────────────────
  // INPUT
  // ─────────────────────────────────────────────

  _addRegion(id, x, y, w, h) {
    this._regions.push({ id, x, y, w, h });
  }

  async _handleClick(e) {
    if (!this.active) return;

    const rect   = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width  / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const px     = (e.clientX - rect.left) * scaleX;
    const py     = (e.clientY - rect.top)  * scaleY;

    for (let i = this._regions.length - 1; i >= 0; i--) {
      const r = this._regions[i];
      if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) {
        await this._handleRegion(r.id);
        return;
      }
    }
  }

  async _handleRegion(id) {
    if (id === "new") {
      this.hide();
      // Find the first empty slot to save into; fall back to slot 0 if all full
      const slotIndex = this.slots.findIndex(s => s === null);
      this.onNew?.(slotIndex >= 0 ? slotIndex : 0);
      return;
    }

    if (id === "confirm_cancel") {
      this._confirm = null;
      return;
    }

    if (id === "confirm_delete") {
      if (this._confirm) {
        const idx = this._confirm.slotIndex;
        await this.saveProvider.delete(idx + 1);
        this.slots[idx] = null;
        this._confirm   = null;
      }
      return;
    }

    if (id.startsWith("load_")) {
      const idx  = parseInt(id.replace("load_", ""));
      const data = this.slots[idx];
      if (data) {
        this.hide();
        this.onLoad?.(idx, data);
      }
      return;
    }

    if (id.startsWith("delete_")) {
      const idx = parseInt(id.replace("delete_", ""));
      if (this.slots[idx]) {
        this._confirm = { action: "delete", slotIndex: idx };
      }
      return;
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
