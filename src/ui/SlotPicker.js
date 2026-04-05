/**
 * SlotPicker.js
 *
 * Canvas-drawn save slot picker.
 * Shows up to 5 slots — filled slots show character info,
 * empty slots show "Empty". Supports loading and deleting.
 *
 * Usage:
 *   const picker = new SlotPicker({ canvas, slots });
 *   picker.onLoad = (slotIndex, data) => { ... };  // 0-based index
 *   picker.onBack = () => { ... };
 *   picker.show();
 */

const BG_COLOR  = "#0a0a14";
const GOLD      = "#e8c84a";
const WHITE     = "#eeeeee";
const DIM       = "#888899";
const RED       = "#cc4444";
const FONT_MONO = "monospace";

export class SlotPicker {
  /**
   * @param {object}             opts
   * @param {HTMLCanvasElement}  opts.canvas
   * @param {Array<object|null>} opts.slots      - array of save data, null = empty
   * @param {SaveProvider}       opts.saveProvider
   */
  constructor({ canvas, slots, saveProvider }) {
    this.canvas       = canvas;
    this.ctx          = canvas.getContext("2d");
    this.slots        = slots;      // length = MAX_SLOTS
    this.saveProvider = saveProvider;
    this.active       = false;

    // Callbacks
    this.onLoad = null; // (slotIndex, saveData) => {}
    this.onBack = null;

    this._regions  = [];
    this._confirm  = null; // { action: "load"|"delete", slotIndex }
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
    this._draw();
    requestAnimationFrame(() => this._loop());
  }

  _draw() {
    const { ctx, canvas } = this;
    const W = canvas.width  = window.innerWidth;
    const H = canvas.height = window.innerHeight;

    this._regions = [];

    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, W, H);

    // Panel
    const panelW = Math.min(560, W - 40);
    const panelH = Math.min(540, H - 60);
    const panelX = (W - panelW) / 2;
    const panelY = (H - panelH) / 2;

    ctx.fillStyle   = "rgba(16,16,32,0.97)";
    ctx.strokeStyle = "rgba(120,100,180,0.5)";
    ctx.lineWidth   = 1.5;
    this._roundRect(panelX, panelY, panelW, panelH, 14);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1;

    let cy = panelY + 36;
    const cx = panelX + panelW / 2;

    // Title
    ctx.fillStyle = GOLD;
    ctx.font      = `bold 20px ${FONT_MONO}`;
    ctx.textAlign = "center";
    ctx.fillText("Load Character", cx, cy);
    cy += 36;

    // Slots
    const slotH   = 64;
    const slotGap = 10;
    const slotX   = panelX + 24;
    const slotW   = panelW - 48;

    for (let i = 0; i < this.slots.length; i++) {
      const data   = this.slots[i];
      const sy     = cy + i * (slotH + slotGap);
      const filled = data !== null;

      // Slot background
      ctx.fillStyle   = filled ? "rgba(24,28,50,0.9)" : "rgba(14,14,24,0.7)";
      ctx.strokeStyle = filled ? "rgba(100,120,180,0.5)" : "rgba(60,60,80,0.35)";
      this._roundRect(slotX, sy, slotW, slotH, 8);
      ctx.fill();
      ctx.stroke();

      if (filled) {
        // Character info
        const savedDate = data.savedAt
          ? new Date(data.savedAt).toLocaleDateString()
          : "Unknown date";

        ctx.fillStyle = WHITE;
        ctx.font      = `bold 14px ${FONT_MONO}`;
        ctx.textAlign = "left";
        ctx.fillText(data.name ?? "Unknown", slotX + 14, sy + 22);

        ctx.fillStyle = DIM;
        ctx.font      = `11px ${FONT_MONO}`;
        const classLabel = (data.classId ?? "").replace(/\b\w/g, c => c.toUpperCase());
        ctx.fillText(
          `${classLabel}  ·  ${data.position?.worldId ?? ""}  ·  Saved ${savedDate}`,
          slotX + 14, sy + 40
        );

        // Gold if present
        if (data.gold !== undefined) {
          ctx.fillStyle = GOLD;
          ctx.fillText(`${data.gold} gold`, slotX + 14, sy + 56);
        }

        // Load button
        const loadBtnW = 80;
        const loadBtnX = slotX + slotW - loadBtnW - 50;
        this._drawSmallButton(ctx, loadBtnX, sy + 16, loadBtnW, 30, "Load", "#334466", WHITE);
        this._addRegion(`load_${i}`, loadBtnX, sy + 16, loadBtnW, 30);

        // Delete button
        const delBtnX = slotX + slotW - 42;
        this._drawSmallButton(ctx, delBtnX, sy + 16, 34, 30, "✕", "#441414", RED);
        this._addRegion(`delete_${i}`, delBtnX, sy + 16, 34, 30);

      } else {
        // Empty slot
        ctx.fillStyle = DIM;
        ctx.font      = `12px ${FONT_MONO}`;
        ctx.textAlign = "center";
        ctx.fillText(`Slot ${i + 1} — Empty`, slotX + slotW / 2, sy + slotH / 2 + 5);
      }
    }

    cy += this.slots.length * (slotH + slotGap) + 16;

    // Back button
    const backBtnW = 100;
    const backBtnX = cx - backBtnW / 2;
    this._drawSmallButton(ctx, backBtnX, cy, backBtnW, 36, "← Back", "#222233", DIM);
    this._addRegion("back", backBtnX, cy, backBtnW, 36);

    // Confirm dialog (delete)
    if (this._confirm) {
      this._drawConfirmDialog(ctx, W, H);
    }

    ctx.textAlign = "left";
  }

  _drawConfirmDialog(ctx, W, H) {
    // Dim overlay
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(0, 0, W, H);

    const dW = 320, dH = 140;
    const dx = (W - dW) / 2;
    const dy = (H - dH) / 2;

    ctx.fillStyle   = "rgba(20,16,36,0.98)";
    ctx.strokeStyle = "rgba(180,60,60,0.6)";
    ctx.lineWidth   = 1.5;
    this._roundRect(dx, dy, dW, dH, 12);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1;

    ctx.fillStyle = WHITE;
    ctx.font      = `bold 14px ${FONT_MONO}`;
    ctx.textAlign = "center";
    ctx.fillText("Delete this save?", dx + dW / 2, dy + 36);

    ctx.fillStyle = DIM;
    ctx.font      = `11px ${FONT_MONO}`;
    ctx.fillText("This cannot be undone.", dx + dW / 2, dy + 56);

    const btnY  = dy + 80;
    const btnW  = 110;
    const gap   = 16;
    const totalW = btnW * 2 + gap;
    const startX = dx + (dW - totalW) / 2;

    this._drawSmallButton(ctx, startX,          btnY, btnW, 34, "Cancel", "#223", WHITE);
    this._addRegion("confirm_cancel", startX, btnY, btnW, 34);

    this._drawSmallButton(ctx, startX + btnW + gap, btnY, btnW, 34, "Delete", "#441414", RED);
    this._addRegion("confirm_delete", startX + btnW + gap, btnY, btnW, 34);
  }

  _drawSmallButton(ctx, x, y, w, h, label, bg, color) {
    ctx.fillStyle   = bg;
    ctx.strokeStyle = "rgba(180,180,220,0.2)";
    this._roundRect(x, y, w, h, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.font      = `bold 11px ${FONT_MONO}`;
    ctx.textAlign = "center";
    ctx.fillText(label, x + w / 2, y + h / 2 + 4);
  }

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

    // Check regions back-to-front (confirm dialog regions registered last)
    for (let i = this._regions.length - 1; i >= 0; i--) {
      const r = this._regions[i];
      if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) {
        await this._handleRegion(r.id);
        return;
      }
    }
  }

  async _handleRegion(id) {
    if (id === "back") {
      this._confirm = null;
      this.hide();
      this.onBack?.();
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
