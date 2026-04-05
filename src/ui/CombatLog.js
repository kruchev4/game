/**
 * CombatLog.js
 *
 * A self-contained scrolling combat log drawn directly onto the game canvas.
 * Lives in the bottom-left corner, above the ability bar if present.
 *
 * Usage:
 *   const log = new CombatLog();
 *   log.push({ text: "Goblin hit you for 5 damage", type: "damage_in" });
 *   // in render loop:
 *   log.draw(ctx, canvasWidth, canvasHeight);
 */

// Message type → color mapping
const TYPE_COLORS = {
  damage_out:     "#ff9944",  // orange  — player deals damage
  damage_in:      "#ff4444",  // red     — player takes damage
  kill:           "#ffdd00",  // gold    — kill
  miss:           "#888888",  // grey    — out of range / blocked
  effect:         "#88aaff",  // blue    — effect applied/expired
  system:         "#aaffaa",  // green   — engage, disengage, combat end
  default:        "#cccccc"   // white-grey fallback
};

const MAX_MESSAGES  = 8;    // max lines visible at once
const LINE_HEIGHT   = 17;   // px between lines
const FONT          = "12px monospace";
const PANEL_PADDING = 10;
const PANEL_WIDTH   = 320;
const FADE_START    = 4;    // messages older than this index start fading
const BOTTOM_OFFSET = 90;   // px from bottom of canvas (clears ability bar)

export class CombatLog {
  constructor() {
    // Each entry: { text, type, age }
    // age increments each frame for fade calculation
    this._messages = [];
  }

  /**
   * Push a new message onto the log.
   * @param {{ text: string, type?: string }} msg
   */
  push({ text, type = "default" }) {
    this._messages.push({ text, type, age: 0 });

    // Keep only the last MAX_MESSAGES * 2 in memory
    if (this._messages.length > MAX_MESSAGES * 2) {
      this._messages.shift();
    }
  }

  /**
   * Call once per frame to age messages.
   * @param {number} dt
   */
  update(dt = 1) {
    for (const msg of this._messages) {
      msg.age += dt;
    }
  }

  /**
   * Draw the log onto the canvas.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} canvasWidth
   * @param {number} canvasHeight
   */
  draw(ctx, canvasWidth, canvasHeight) {
    if (!this._messages.length) return;

    // Take only the last MAX_MESSAGES to display
    const visible = this._messages.slice(-MAX_MESSAGES);

    const panelH = visible.length * LINE_HEIGHT + PANEL_PADDING * 2;
    const panelX = PANEL_PADDING;
    const panelY = canvasHeight - BOTTOM_OFFSET - panelH;

    // Panel background
    ctx.fillStyle = "rgba(6, 6, 14, 0.72)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, PANEL_WIDTH, panelH, 8);
    ctx.fill();

    ctx.font = FONT;

    for (let i = 0; i < visible.length; i++) {
      const msg = visible[i];

      // Newer messages (higher index) are brighter
      const relativeAge = visible.length - 1 - i; // 0 = newest
      const alpha = relativeAge < FADE_START
        ? 1.0
        : Math.max(0.25, 1.0 - (relativeAge - FADE_START) * 0.18);

      const baseColor = TYPE_COLORS[msg.type] ?? TYPE_COLORS.default;
      ctx.fillStyle   = this._withAlpha(baseColor, alpha);

      const textX = panelX + PANEL_PADDING;
      const textY = panelY + PANEL_PADDING + i * LINE_HEIGHT + LINE_HEIGHT - 4;

      // Truncate if too long for panel
      const maxChars = 38;
      const display  = msg.text.length > maxChars
        ? msg.text.slice(0, maxChars - 1) + "…"
        : msg.text;

      ctx.fillText(display, textX, textY);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Apply alpha to a hex color string.
   * Converts "#rrggbb" to "rgba(r,g,b,alpha)".
   */
  _withAlpha(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
}
