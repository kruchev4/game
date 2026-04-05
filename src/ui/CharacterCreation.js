/**
 * CharacterCreation.js
 *
 * A fully canvas-drawn character creation screen.
 * No HTML elements except the canvas itself.
 *
 * Usage:
 *   const cc = new CharacterCreation({ canvas, classes, abilities });
 *   cc.onConfirm = ({ name, classId, stats }) => startGame(...);
 *   cc.show();
 */

const STAT_NAMES   = ["STR", "DEX", "INT", "CON", "WIS", "CHA"];
const PLAYER_CLASSES = ["fighter", "ranger"]; // shown in creation screen

// Visual constants
const BG_COLOR     = "#0a0a14";
const PANEL_COLOR  = "rgba(16, 16, 32, 0.97)";
const BORDER_COLOR = "rgba(120, 100, 180, 0.5)";
const GOLD         = "#e8c84a";
const WHITE        = "#eeeeee";
const DIM          = "#888899";
const FONT_MONO    = "monospace";

export class CharacterCreation {
  /**
   * @param {object} opts
   * @param {HTMLCanvasElement} opts.canvas
   * @param {object}            opts.classes    - classes.json data
   * @param {object}            opts.abilities  - abilities.json data
   */
  constructor({ canvas, classes, abilities }) {
    this.canvas    = canvas;
    this.ctx       = canvas.getContext("2d");
    this.classes   = classes;
    this.abilities = abilities;

    // State
    this.name      = "";
    this.classId   = PLAYER_CLASSES[0];
    this.stats     = this._rollAll();
    this.active    = false;

    // Callback — set before calling show()
    this.onConfirm = null;

    // Input cursor blink
    this._cursorOn   = true;
    this._cursorTick = 0;

    // Clickable regions built each frame
    this._regions = [];

    // Keyboard handler ref for cleanup
    this._onKey = (e) => this._handleKey(e);
    this._onClick = (e) => this._handleClick(e);
  }

  // ─────────────────────────────────────────────
  // PUBLIC
  // ─────────────────────────────────────────────

  show() {
    this.active = true;
    window.addEventListener("keydown", this._onKey);
    this.canvas.addEventListener("pointerdown", this._onClick);
    this._loop();
  }

  hide() {
    this.active = false;
    window.removeEventListener("keydown", this._onKey);
    this.canvas.removeEventListener("pointerdown", this._onClick);
  }

  // ─────────────────────────────────────────────
  // ROLLING
  // ─────────────────────────────────────────────

  _rollAll() {
    return Object.fromEntries(
      STAT_NAMES.map(s => [s, this._roll4d6DropLowest()])
    );
  }

  _roll4d6DropLowest() {
    const dice = Array.from({ length: 4 }, () => Math.ceil(Math.random() * 6));
    dice.sort((a, b) => a - b);
    return dice.slice(1).reduce((a, b) => a + b, 0); // drop lowest
  }

  // ─────────────────────────────────────────────
  // RENDER LOOP
  // ─────────────────────────────────────────────

  _loop() {
    if (!this.active) return;

    this._cursorTick++;
    if (this._cursorTick % 30 === 0) this._cursorOn = !this._cursorOn;

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

    // Starfield effect — subtle dots
    this._drawStars(W, H);

    // Panel
    const panelW = Math.min(600, W - 40);
    const panelH = 520;
    const panelX = (W - panelW) / 2;
    const panelY = (H - panelH) / 2;

    ctx.fillStyle = PANEL_COLOR;
    this._roundRect(panelX, panelY, panelW, panelH, 14);
    ctx.fill();

    ctx.strokeStyle = BORDER_COLOR;
    ctx.lineWidth   = 1.5;
    this._roundRect(panelX, panelY, panelW, panelH, 14);
    ctx.stroke();
    ctx.lineWidth = 1;

    let cy = panelY + 36;
    const cx = panelX + panelW / 2;
    const lx = panelX + 30;

    // ── Title ──
    ctx.fillStyle = GOLD;
    ctx.font      = `bold 22px ${FONT_MONO}`;
    ctx.textAlign = "center";
    ctx.fillText("REALM OF ECHOES", cx, cy);
    cy += 24;

    ctx.fillStyle = DIM;
    ctx.font      = `13px ${FONT_MONO}`;
    ctx.fillText("Character Creation", cx, cy);
    cy += 36;

    ctx.textAlign = "left";

    // ── Name field ──
    this._drawLabel(ctx, lx, cy, "Name");
    cy += 20;

    const nameFieldW = panelW - 60;
    this._drawTextField(ctx, lx, cy, nameFieldW, 32, this.name, this._cursorOn);
    this._addRegion("namefield", lx, cy, nameFieldW, 32);
    cy += 48;

    // ── Class selection ──
    this._drawLabel(ctx, lx, cy, "Class");
    cy += 20;

    const btnW     = 110;
    const btnH     = 36;
    const btnGap   = 12;
    let   btnX     = lx;

    for (const id of PLAYER_CLASSES) {
      const classDef = this.classes[id];
      const selected = id === this.classId;

      ctx.fillStyle   = selected ? "rgba(120,100,200,0.35)" : "rgba(30,30,50,0.8)";
      ctx.strokeStyle = selected ? "rgba(160,140,255,0.8)"  : "rgba(80,80,100,0.5)";
      ctx.lineWidth   = selected ? 2 : 1;
      this._roundRect(btnX, cy, btnW, btnH, 8);
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = 1;

      ctx.fillStyle = selected ? WHITE : DIM;
      ctx.font      = `bold 13px ${FONT_MONO}`;
      ctx.textAlign = "center";
      ctx.fillText(classDef?.name ?? id, btnX + btnW / 2, cy + 23);
      ctx.textAlign = "left";

      this._addRegion(`class_${id}`, btnX, cy, btnW, btnH);
      btnX += btnW + btnGap;
    }
    cy += btnH + 16;

    // ── Class description + abilities ──
    const classDef    = this.classes[this.classId];
    const abilityIds  = classDef?.abilities ?? [];

    ctx.fillStyle = DIM;
    ctx.font      = `italic 12px ${FONT_MONO}`;
    ctx.fillText(`"${classDef?.description ?? ""}"`, lx, cy);
    cy += 20;

    const abilityNames = abilityIds
      .map(id => this.abilities[id]?.name ?? id)
      .join(", ");

    ctx.fillStyle = "rgba(136, 170, 255, 0.9)";
    ctx.font      = `12px ${FONT_MONO}`;
    ctx.fillText(`Abilities: ${abilityNames}`, lx, cy);
    cy += 32;

    // ── Stats ──
    this._drawLabel(ctx, lx, cy, "Stats  (4d6 drop lowest)");
    cy += 22;

    const statCount  = STAT_NAMES.length;
    const statBoxW   = Math.floor((panelW - 60) / statCount);
    const statBoxH   = 52;

    for (let i = 0; i < statCount; i++) {
      const name  = STAT_NAMES[i];
      const value = this.stats[name] ?? 10;
      const sx    = lx + i * statBoxW;

      // Box
      ctx.fillStyle   = "rgba(20, 20, 40, 0.8)";
      ctx.strokeStyle = "rgba(100, 100, 140, 0.4)";
      this._roundRect(sx, cy, statBoxW - 4, statBoxH, 6);
      ctx.fill();
      ctx.stroke();

      // Stat name
      ctx.fillStyle = DIM;
      ctx.font      = `10px ${FONT_MONO}`;
      ctx.textAlign = "center";
      ctx.fillText(name, sx + (statBoxW - 4) / 2, cy + 15);

      // Stat value — color by bracket
      ctx.fillStyle = value >= 16 ? "#ffdd55"
                    : value >= 13 ? "#aaffaa"
                    : value >= 10 ? WHITE
                    :               "#ff8888";
      ctx.font      = `bold 20px ${FONT_MONO}`;
      ctx.fillText(value, sx + (statBoxW - 4) / 2, cy + 40);
      ctx.textAlign = "left";
    }
    cy += statBoxH + 24;

    // ── Buttons ──
    const rollBtnW   = 140;
    const beginBtnW  = 140;
    const btnTotalW  = rollBtnW + beginBtnW + 16;
    const buttonsX   = panelX + (panelW - btnTotalW) / 2;
    const buttonY    = cy;

    // Roll Stats button
    this._drawButton(ctx, buttonsX, buttonY, rollBtnW, 38, "Roll Stats", "#6655aa");
    this._addRegion("roll", buttonsX, buttonY, rollBtnW, 38);

    // Begin button — only fully lit if name is filled
    const nameReady  = this.name.trim().length > 0;
    this._drawButton(
      ctx,
      buttonsX + rollBtnW + 16,
      buttonY,
      beginBtnW,
      38,
      "Begin",
      nameReady ? "#336633" : "#222222",
      nameReady ? WHITE : DIM
    );
    this._addRegion("begin", buttonsX + rollBtnW + 16, buttonY, beginBtnW, 38);

    if (!nameReady) {
      ctx.fillStyle = DIM;
      ctx.font      = `11px ${FONT_MONO}`;
      ctx.textAlign = "center";
      ctx.fillText("Enter a name to begin", panelX + panelW / 2, buttonY + 54);
      ctx.textAlign = "left";
    }
  }

  // ─────────────────────────────────────────────
  // DRAW HELPERS
  // ─────────────────────────────────────────────

  _drawLabel(ctx, x, y, text) {
    ctx.fillStyle = GOLD;
    ctx.font      = `bold 12px ${FONT_MONO}`;
    ctx.fillText(text, x, y);
  }

  _drawTextField(ctx, x, y, w, h, value, cursorOn) {
    ctx.fillStyle   = "rgba(10,10,24,0.9)";
    ctx.strokeStyle = "rgba(140,120,220,0.6)";
    ctx.lineWidth   = 1.5;
    this._roundRect(x, y, w, h, 6);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1;

    ctx.fillStyle = WHITE;
    ctx.font      = `15px ${FONT_MONO}`;
    const display = value + (cursorOn ? "|" : " ");
    ctx.fillText(display, x + 10, y + 21);
  }

  _drawButton(ctx, x, y, w, h, label, bgColor, textColor = WHITE) {
    ctx.fillStyle   = bgColor;
    ctx.strokeStyle = "rgba(180,180,220,0.3)";
    this._roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.font      = `bold 13px ${FONT_MONO}`;
    ctx.textAlign = "center";
    ctx.fillText(label, x + w / 2, y + h / 2 + 5);
    ctx.textAlign = "left";
  }

  _drawStars(W, H) {
    // Deterministic pseudo-random stars using fixed seed pattern
    ctx: {
      const ctx = this.ctx;
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      for (let i = 0; i < 80; i++) {
        const sx = ((i * 137 + 41)  % W);
        const sy = ((i * 251 + 83)  % H);
        const r  = i % 3 === 0 ? 1.2 : 0.7;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
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

  // ─────────────────────────────────────────────
  // REGIONS (click detection)
  // ─────────────────────────────────────────────

  _addRegion(id, x, y, w, h) {
    this._regions.push({ id, x, y, w, h });
  }

  _hitRegion(px, py) {
    for (const r of this._regions) {
      if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) {
        return r.id;
      }
    }
    return null;
  }

  // ─────────────────────────────────────────────
  // INPUT
  // ─────────────────────────────────────────────

  _handleKey(e) {
    if (!this.active) return;

    if (e.key === "Backspace") {
      this.name = this.name.slice(0, -1);
    } else if (e.key === "Enter") {
      this._tryBegin();
    } else if (e.key.length === 1 && this.name.length < 20) {
      this.name += e.key;
    }
  }

  _handleClick(e) {
    if (!this.active) return;

    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width  / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top)  * scaleY;

    const hit = this._hitRegion(px, py);
    if (!hit) return;

    if (hit === "roll") {
      this.stats = this._rollAll();
    } else if (hit === "begin") {
      this._tryBegin();
    } else if (hit.startsWith("class_")) {
      this.classId = hit.replace("class_", "");
    }
  }

  _tryBegin() {
    if (!this.name.trim()) return;

    this.hide();
    this.onConfirm?.({
      name:    this.name.trim(),
      classId: this.classId,
      stats:   { ...this.stats }
    });
  }
}
