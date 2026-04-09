/**
 * CharacterSprites.js
 *
 * Pixel-art character sprite drawing functions.
 * Each function draws a character at (sx, sy) with scale factor s.
 *
 * At tileSize=24: s = 24/32 = 0.75
 * At tileSize=16: s = 16/32 = 0.5
 *
 * Usage:
 *   import { drawSprite, SPRITE_COLORS } from "./CharacterSprites.js";
 *   drawSprite(ctx, "fighter", sx, sy, tileSize, animState);
 */

// ── Skin tones ────────────────────────────────────────────────────────────
const SKINS = ["#f5c5a3", "#e8a87c", "#c68642", "#8d5524", "#4a2912"];

// ── Class color palettes ──────────────────────────────────────────────────
export const SPRITE_COLORS = {
  fighter:     { body: "#c0392b", trim: "#e74c3c", skin: SKINS[0] },
  ranger:      { body: "#27ae60", trim: "#2ecc71", skin: SKINS[1] },
  paladin:     { body: "#2980b9", trim: "#f39c12", skin: SKINS[0] },
  rogue:       { body: "#2c3e50", trim: "#9b59b6", skin: SKINS[2] },
  wizard:      { body: "#8e44ad", trim: "#e74c3c", skin: SKINS[0] },
  warlock:     { body: "#1a1a2e", trim: "#9b59b6", skin: SKINS[3] },
  cleric:      { body: "#ecf0f1", trim: "#f39c12", skin: SKINS[0] },
  barbarian:   { body: "#e67e22", trim: "#d35400", skin: SKINS[1] },
  monk:        { body: "#e67e22", trim: "#f1c40f", skin: SKINS[2] },
  druid:       { body: "#27ae60", trim: "#f39c12", skin: SKINS[1] },
  bard:        { body: "#8e44ad", trim: "#f1c40f", skin: SKINS[0] },
  // Monsters
  goblinMelee: { body: "#27ae60", trim: "#e74c3c", skin: "#4a7a2a" },
  goblinArcher:{ body: "#2c6e2c", trim: "#e74c3c", skin: "#4a7a2a" },
  zombie:      { body: "#5d8a5d", trim: "#3a5a3a", skin: "#7aaa6a" },
  skeleton:    { body: "#d4c5a9", trim: "#bbb090", skin: "#e8dcc8" },
  wraith:      { body: "#1a1a3a", trim: "#6644aa", skin: "#4a3a6a" },
  necromancer: { body: "#2a0a2a", trim: "#aa22aa", skin: "#8a6a8a" },
  lich:        { body: "#0a0a1a", trim: "#cc00cc", skin: "#ccccdd" },
};

// ── Primitive helpers ─────────────────────────────────────────────────────

function head(ctx, sx, sy, s, skin) {
  ctx.fillStyle = skin;
  ctx.fillRect(sx+11*s, sy+4*s, 10*s, 9*s);
  ctx.fillStyle = "#2c3e50";
  ctx.fillRect(sx+13*s, sy+7*s, 2*s, 2*s);
  ctx.fillRect(sx+17*s, sy+7*s, 2*s, 2*s);
}

function body(ctx, sx, sy, s, color) {
  ctx.fillStyle = color;
  ctx.fillRect(sx+10*s, sy+13*s, 12*s, 10*s);
}

function legs(ctx, sx, sy, s, c1, c2) {
  ctx.fillStyle = c1;
  ctx.fillRect(sx+10*s, sy+23*s, 5*s, 7*s);
  ctx.fillStyle = c2 || c1;
  ctx.fillRect(sx+17*s, sy+23*s, 5*s, 7*s);
}

function arms(ctx, sx, sy, s, color) {
  ctx.fillStyle = color;
  ctx.fillRect(sx+5*s,  sy+13*s, 5*s, 8*s);
  ctx.fillRect(sx+22*s, sy+13*s, 5*s, 8*s);
}

// ── Class draw functions ──────────────────────────────────────────────────

function drawFighter(ctx, sx, sy, s, c) {
  legs(ctx, sx, sy, s, "#555", "#333");
  body(ctx, sx, sy, s, c.body);
  ctx.fillStyle = c.trim;
  ctx.fillRect(sx+8*s,  sy+13*s, 4*s, 4*s);
  ctx.fillRect(sx+20*s, sy+13*s, 4*s, 4*s);
  arms(ctx, sx, sy, s, "#777");
  head(ctx, sx, sy, s, c.skin);
  ctx.fillStyle = "#888";
  ctx.fillRect(sx+10*s, sy+2*s, 12*s, 5*s);
  ctx.fillStyle = c.trim;
  ctx.fillRect(sx+14*s, sy+1*s, 4*s, 3*s);
  ctx.fillStyle = "#aaa";
  ctx.fillRect(sx+27*s, sy+11*s, 2*s, 12*s);
  ctx.fillStyle = c.trim;
  ctx.fillRect(sx+25*s, sy+14*s, 6*s, 2*s);
}

function drawRanger(ctx, sx, sy, s, c) {
  legs(ctx, sx, sy, s, "#4a4a2a", "#333321");
  body(ctx, sx, sy, s, c.body);
  ctx.fillStyle = "#8b6914";
  ctx.fillRect(sx+21*s, sy+10*s, 4*s, 12*s);
  ctx.fillStyle = "#e74c3c";
  ctx.fillRect(sx+22*s, sy+9*s,  2*s, 3*s);
  ctx.fillRect(sx+22*s, sy+13*s, 2*s, 3*s);
  arms(ctx, sx, sy, s, c.body);
  head(ctx, sx, sy, s, c.skin);
  ctx.fillStyle = c.body;
  ctx.fillRect(sx+9*s,  sy+3*s, 14*s, 10*s);
  ctx.fillRect(sx+7*s,  sy+7*s, 18*s, 3*s);
  ctx.strokeStyle = "#8b6914";
  ctx.lineWidth = 2*s;
  ctx.beginPath();
  ctx.arc(sx+3*s, sy+16*s, 10*s, -Math.PI*0.5, Math.PI*0.5);
  ctx.stroke();
  ctx.strokeStyle = "#f5cba7";
  ctx.lineWidth = s * 0.5;
  ctx.beginPath();
  ctx.moveTo(sx+3*s, sy+6*s);
  ctx.lineTo(sx+3*s, sy+26*s);
  ctx.stroke();
}

function drawPaladin(ctx, sx, sy, s, c) {
  legs(ctx, sx, sy, s, "#5d6d7e", "#4a5568");
  body(ctx, sx, sy, s, "#7f8c8d");
  ctx.fillStyle = c.body;
  ctx.fillRect(sx+12*s, sy+13*s, 8*s,  10*s);
  ctx.fillStyle = c.trim;
  ctx.fillRect(sx+14*s, sy+15*s, 4*s,  6*s);
  ctx.fillRect(sx+12*s, sy+17*s, 8*s,  2*s);
  arms(ctx, sx, sy, s, "#7f8c8d");
  head(ctx, sx, sy, s, c.skin);
  ctx.fillStyle = "#95a5a6";
  ctx.fillRect(sx+10*s, sy+2*s,  12*s, 11*s);
  ctx.fillStyle = "#2c3e50";
  ctx.fillRect(sx+12*s, sy+6*s,  8*s,  3*s);
  ctx.fillStyle = c.body;
  ctx.fillRect(sx+1*s,  sy+12*s, 8*s,  11*s);
  ctx.fillStyle = c.trim;
  ctx.fillRect(sx+3*s,  sy+14*s, 4*s,  7*s);
  ctx.fillRect(sx+1*s,  sy+17*s, 8*s,  2*s);
  ctx.fillStyle = "#bdc3c7";
  ctx.fillRect(sx+27*s, sy+9*s,  2*s,  14*s);
  ctx.fillStyle = c.trim;
  ctx.fillRect(sx+25*s, sy+13*s, 6*s,  2*s);
}

function drawWizard(ctx, sx, sy, s, c) {
  legs(ctx, sx, sy, s, c.body, c.body);
  ctx.fillStyle = c.body;
  ctx.fillRect(sx+8*s, sy+13*s, 16*s, 14*s);
  arms(ctx, sx, sy, s, c.body);
  head(ctx, sx, sy, s, c.skin);
  ctx.fillStyle = c.body;
  ctx.beginPath();
  ctx.moveTo(sx+16*s, sy);
  ctx.lineTo(sx+9*s,  sy+7*s);
  ctx.lineTo(sx+23*s, sy+7*s);
  ctx.fill();
  ctx.fillStyle = c.trim;
  ctx.fillRect(sx+9*s, sy+6*s, 14*s, 3*s);
  ctx.fillStyle = "#8b6914";
  ctx.fillRect(sx+3*s, sy+8*s,  3*s, 22*s);
  ctx.fillStyle = c.trim;
  ctx.beginPath();
  ctx.arc(sx+4.5*s, sy+7*s, 4*s, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.beginPath();
  ctx.arc(sx+3.5*s, sy+6*s, 1.5*s, 0, Math.PI*2);
  ctx.fill();
}

function drawWarlock(ctx, sx, sy, s, c) {
  legs(ctx, sx, sy, s, "#1a1a2e", "#1a1a2e");
  ctx.fillStyle = c.body;
  ctx.fillRect(sx+8*s,  sy+13*s, 16*s, 14*s);
  arms(ctx, sx, sy, s, c.body);
  head(ctx, sx, sy, s, c.skin);
  ctx.fillStyle = c.body;
  ctx.fillRect(sx+9*s,  sy+2*s,  14*s, 11*s);
  ctx.fillRect(sx+7*s,  sy+7*s,  4*s,  7*s);
  ctx.fillRect(sx+21*s, sy+7*s,  4*s,  7*s);
  ctx.fillStyle = c.trim;
  ctx.beginPath();
  ctx.arc(sx+5*s, sy+21*s, 4*s, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.beginPath();
  ctx.arc(sx+4*s, sy+20*s, 1.5*s, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = "#6b2d0f";
  ctx.fillRect(sx+23*s, sy+14*s, 6*s, 8*s);
  ctx.fillStyle = c.trim;
  ctx.fillRect(sx+24*s, sy+16*s, 4*s, 1*s);
  ctx.fillRect(sx+24*s, sy+18*s, 4*s, 1*s);
}

function drawCleric(ctx, sx, sy, s, c) {
  legs(ctx, sx, sy, s, "#aaa", "#888");
  body(ctx, sx, sy, s, c.body);
  ctx.fillStyle = c.trim;
  ctx.fillRect(sx+14*s, sy+15*s, 4*s, 7*s);
  ctx.fillRect(sx+12*s, sy+17*s, 8*s, 3*s);
  arms(ctx, sx, sy, s, c.body);
  head(ctx, sx, sy, s, c.skin);
  ctx.fillStyle = c.body;
  ctx.fillRect(sx+11*s, sy+2*s,  10*s, 7*s);
  ctx.fillStyle = c.trim;
  ctx.fillRect(sx+14*s, sy+1*s,  4*s,  8*s);
  ctx.fillStyle = "#888";
  ctx.fillRect(sx+24*s, sy+10*s, 3*s,  14*s);
  ctx.fillStyle = "#aaa";
  ctx.fillRect(sx+22*s, sy+9*s,  7*s,  5*s);
}

function drawRogue(ctx, sx, sy, s, c) {
  legs(ctx, sx, sy, s, "#2c3e50", "#1a252f");
  body(ctx, sx, sy, s, c.body);
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(sx+7*s,  sy+12*s, 5*s, 15*s);
  ctx.fillRect(sx+20*s, sy+12*s, 5*s, 15*s);
  arms(ctx, sx, sy, s, c.body);
  head(ctx, sx, sy, s, c.skin);
  ctx.fillStyle = c.body;
  ctx.fillRect(sx+9*s,  sy+3*s,  14*s, 10*s);
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(sx+11*s, sy+8*s,  10*s, 4*s);
  ctx.fillStyle = "#bdc3c7";
  ctx.fillRect(sx+3*s,  sy+15*s, 2*s,  9*s);
  ctx.fillRect(sx+27*s, sy+15*s, 2*s,  9*s);
  ctx.fillStyle = c.trim;
  ctx.fillRect(sx+2*s,  sy+14*s, 4*s,  2*s);
  ctx.fillRect(sx+26*s, sy+14*s, 4*s,  2*s);
}

function drawBarbarian(ctx, sx, sy, s, c) {
  legs(ctx, sx, sy, s, "#5d4037", "#4e342e");
  ctx.fillStyle = c.body;
  ctx.fillRect(sx+8*s,  sy+13*s, 16*s, 10*s);
  ctx.fillStyle = "#795548";
  ctx.fillRect(sx+8*s,  sy+13*s, 16*s, 3*s);
  ctx.fillStyle = c.skin;
  ctx.fillRect(sx+3*s,  sy+13*s, 7*s,  9*s);
  ctx.fillRect(sx+22*s, sy+13*s, 7*s,  9*s);
  head(ctx, sx, sy, s, c.skin);
  ctx.fillStyle = "#4a2f1a";
  ctx.fillRect(sx+9*s,  sy+2*s,  14*s, 6*s);
  ctx.fillRect(sx+7*s,  sy+4*s,  4*s,  8*s);
  ctx.fillRect(sx+21*s, sy+4*s,  4*s,  8*s);
  ctx.fillStyle = "#888";
  ctx.fillRect(sx+25*s, sy+8*s,  3*s,  16*s);
  ctx.fillStyle = "#aaa";
  ctx.fillRect(sx+24*s, sy+8*s,  7*s,  5*s);
  ctx.fillRect(sx+26*s, sy+13*s, 5*s,  4*s);
}

function drawMonk(ctx, sx, sy, s, c) {
  legs(ctx, sx, sy, s, c.body, "#b7950b");
  body(ctx, sx, sy, s, c.body);
  ctx.fillStyle = c.trim;
  ctx.fillRect(sx+10*s, sy+18*s, 12*s, 3*s);
  ctx.fillStyle = c.skin;
  ctx.fillRect(sx+5*s,  sy+13*s, 5*s,  7*s);
  ctx.fillRect(sx+22*s, sy+13*s, 5*s,  7*s);
  ctx.fillRect(sx+4*s,  sy+19*s, 6*s,  5*s);
  head(ctx, sx, sy, s, c.skin);
  ctx.fillStyle = "#2c3e50";
  ctx.fillRect(sx+14*s, sy+2*s,  4*s,  5*s);
  ctx.fillStyle = "rgba(255,215,0,0.4)";
  ctx.beginPath();
  ctx.arc(sx+7*s, sy+22*s, 5*s, 0, Math.PI*2);
  ctx.fill();
}

function drawDruid(ctx, sx, sy, s, c) {
  legs(ctx, sx, sy, s, "#4a2f1a", "#4a2f1a");
  ctx.fillStyle = c.body;
  ctx.fillRect(sx+8*s,  sy+13*s, 16*s, 14*s);
  ctx.fillStyle = "#27ae60";
  ctx.fillRect(sx+9*s,  sy+14*s, 4*s,  4*s);
  ctx.fillRect(sx+19*s, sy+14*s, 4*s,  4*s);
  ctx.fillRect(sx+13*s, sy+20*s, 6*s,  4*s);
  arms(ctx, sx, sy, s, c.body);
  head(ctx, sx, sy, s, c.skin);
  ctx.fillStyle = "#8b6914";
  ctx.fillRect(sx+11*s, sy+3*s,  10*s, 3*s);
  ctx.fillRect(sx+11*s, sy+1*s,  2*s,  4*s);
  ctx.fillRect(sx+19*s, sy+1*s,  2*s,  4*s);
  ctx.fillRect(sx+13*s, sy,      2*s,  3*s);
  ctx.fillRect(sx+17*s, sy,      2*s,  3*s);
  ctx.fillStyle = "#6b8e23";
  ctx.fillRect(sx+3*s,  sy+10*s, 3*s,  20*s);
  ctx.fillStyle = "#2ecc71";
  ctx.beginPath();
  ctx.arc(sx+4.5*s, sy+9*s, 4*s, 0, Math.PI*2);
  ctx.fill();
}

function drawBard(ctx, sx, sy, s, c) {
  legs(ctx, sx, sy, s, "#6c3483", "#5b2c6f");
  body(ctx, sx, sy, s, c.body);
  ctx.fillStyle = c.trim;
  ctx.fillRect(sx+10*s, sy+13*s, 12*s, 2*s);
  ctx.fillRect(sx+10*s, sy+21*s, 12*s, 2*s);
  arms(ctx, sx, sy, s, c.body);
  head(ctx, sx, sy, s, c.skin);
  ctx.fillStyle = c.body;
  ctx.fillRect(sx+8*s,  sy+5*s,  16*s, 4*s);
  ctx.fillRect(sx+11*s, sy+2*s,  10*s, 5*s);
  ctx.fillStyle = c.trim;
  ctx.fillRect(sx+20*s, sy+1*s,  3*s,  6*s);
  ctx.fillRect(sx+22*s, sy,      2*s,  4*s);
  ctx.fillStyle = "#a0522d";
  ctx.beginPath();
  ctx.ellipse(sx+26*s, sy+20*s, 4*s, 5*s, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = "#2c3e50";
  ctx.fillRect(sx+25*s, sy+14*s, 2*s,  7*s);
  ctx.fillRect(sx+24*s, sy+15*s, 4*s,  1*s);
  ctx.fillRect(sx+24*s, sy+17*s, 4*s,  1*s);
}

// ── Monster sprites ───────────────────────────────────────────────────────

function drawGoblin(ctx, sx, sy, s, c, isArcher) {
  // Smaller, hunched posture
  const oy = 4*s; // offset down — goblins are shorter
  ctx.fillStyle = c.skin;
  // Body
  ctx.fillRect(sx+11*s, sy+oy+12*s, 10*s, 8*s);
  // Head — bigger relative to body
  ctx.fillRect(sx+10*s, sy+oy+4*s,  12*s, 10*s);
  // Eyes — red and beady
  ctx.fillStyle = "#ff2222";
  ctx.fillRect(sx+12*s, sy+oy+7*s,  2*s, 2*s);
  ctx.fillRect(sx+18*s, sy+oy+7*s,  2*s, 2*s);
  // Ears — pointy
  ctx.fillStyle = c.skin;
  ctx.fillRect(sx+8*s,  sy+oy+5*s,  3*s, 4*s);
  ctx.fillRect(sx+21*s, sy+oy+5*s,  3*s, 4*s);
  // Legs
  ctx.fillStyle = c.body;
  ctx.fillRect(sx+11*s, sy+oy+20*s, 4*s, 6*s);
  ctx.fillRect(sx+17*s, sy+oy+20*s, 4*s, 6*s);
  // Arms
  ctx.fillRect(sx+6*s,  sy+oy+12*s, 5*s, 7*s);
  ctx.fillRect(sx+21*s, sy+oy+12*s, 5*s, 7*s);
  // Weapon
  if (isArcher) {
    ctx.strokeStyle = "#8b6914";
    ctx.lineWidth = 1.5*s;
    ctx.beginPath();
    ctx.arc(sx+3*s, sy+oy+14*s, 7*s, -Math.PI*0.5, Math.PI*0.5);
    ctx.stroke();
    ctx.strokeStyle = "#f5cba7";
    ctx.lineWidth = s*0.5;
    ctx.beginPath();
    ctx.moveTo(sx+3*s, sy+oy+7*s);
    ctx.lineTo(sx+3*s, sy+oy+21*s);
    ctx.stroke();
  } else {
    ctx.fillStyle = "#888";
    ctx.fillRect(sx+26*s, sy+oy+10*s, 2*s, 10*s);
    ctx.fillRect(sx+24*s, sy+oy+12*s, 6*s, 2*s);
  }
}

function drawZombie(ctx, sx, sy, s, c) {
  // Shambling, tilted posture
  legs(ctx, sx, sy, s, c.body, "#3a5a3a");
  ctx.fillStyle = c.body;
  ctx.fillRect(sx+9*s,  sy+13*s, 13*s, 10*s);
  // Torn clothes
  ctx.fillStyle = "#3a5a3a";
  ctx.fillRect(sx+9*s,  sy+20*s, 4*s,  3*s);
  ctx.fillRect(sx+18*s, sy+19*s, 4*s,  4*s);
  // Arms — outstretched
  ctx.fillStyle = c.skin;
  ctx.fillRect(sx+2*s,  sy+13*s, 7*s,  5*s);
  ctx.fillRect(sx+22*s, sy+13*s, 7*s,  5*s);
  // Head
  ctx.fillStyle = c.skin;
  ctx.fillRect(sx+11*s, sy+4*s,  10*s, 9*s);
  ctx.fillStyle = "#cc2200";
  ctx.fillRect(sx+13*s, sy+7*s,  2*s,  2*s);
  ctx.fillRect(sx+17*s, sy+7*s,  2*s,  2*s);
  // Wounds
  ctx.fillStyle = "#cc2200";
  ctx.fillRect(sx+14*s, sy+10*s, 4*s,  1*s);
  ctx.fillRect(sx+11*s, sy+15*s, 2*s,  3*s);
}

function drawSkeleton(ctx, sx, sy, s, c) {
  ctx.fillStyle = c.skin;
  // Ribcage
  ctx.fillRect(sx+10*s, sy+13*s, 12*s, 10*s);
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = "#b8a898";
    ctx.fillRect(sx+10*s, sy+14*s+i*2*s, 12*s, s);
  }
  // Legs — bone segments
  ctx.fillStyle = c.skin;
  ctx.fillRect(sx+11*s, sy+23*s, 3*s, 7*s);
  ctx.fillRect(sx+18*s, sy+23*s, 3*s, 7*s);
  ctx.fillRect(sx+10*s, sy+22*s, 5*s, 2*s);
  ctx.fillRect(sx+17*s, sy+22*s, 5*s, 2*s);
  // Arms
  ctx.fillRect(sx+5*s,  sy+13*s, 3*s, 8*s);
  ctx.fillRect(sx+24*s, sy+13*s, 3*s, 8*s);
  // Sword
  ctx.fillStyle = "#aaa";
  ctx.fillRect(sx+27*s, sy+10*s, 2*s, 13*s);
  ctx.fillRect(sx+25*s, sy+13*s, 6*s, 2*s);
  // Skull
  ctx.fillStyle = c.skin;
  ctx.fillRect(sx+11*s, sy+3*s,  10*s, 10*s);
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(sx+13*s, sy+6*s,  3*s,  3*s);
  ctx.fillRect(sx+17*s, sy+6*s,  3*s,  3*s);
  ctx.fillRect(sx+14*s, sy+10*s, 4*s,  2*s);
}

function drawWraith(ctx, sx, sy, s, c) {
  // Ghostly, fading bottom
  ctx.fillStyle = c.body;
  ctx.fillRect(sx+8*s,  sy+12*s, 16*s, 12*s);
  // Fading wisps at bottom
  ctx.fillStyle = c.trim + "88";
  ctx.fillRect(sx+10*s, sy+24*s, 4*s,  4*s);
  ctx.fillRect(sx+18*s, sy+24*s, 4*s,  4*s);
  ctx.fillRect(sx+14*s, sy+26*s, 4*s,  3*s);
  // Arms — flowing
  ctx.fillStyle = c.body + "cc";
  ctx.fillRect(sx+2*s,  sy+14*s, 8*s,  4*s);
  ctx.fillRect(sx+22*s, sy+14*s, 8*s,  4*s);
  // Orb/hands
  ctx.fillStyle = c.trim;
  ctx.beginPath();
  ctx.arc(sx+3*s,  sy+17*s, 3*s, 0, Math.PI*2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(sx+29*s, sy+17*s, 3*s, 0, Math.PI*2);
  ctx.fill();
  // Head — cowl
  ctx.fillStyle = c.body;
  ctx.fillRect(sx+9*s,  sy+3*s,  14*s, 12*s);
  // Eyes — glowing
  ctx.fillStyle = c.trim;
  ctx.fillRect(sx+12*s, sy+8*s,  4*s,  3*s);
  ctx.fillRect(sx+17*s, sy+8*s,  4*s,  3*s);
  // Glow
  ctx.fillStyle = c.trim + "44";
  ctx.beginPath();
  ctx.arc(sx+16*s, sy+16*s, 10*s, 0, Math.PI*2);
  ctx.fill();
}

function drawNecromancer(ctx, sx, sy, s, c) {
  drawWizard(ctx, sx, sy, s, c);
  // Override orb with skull
  ctx.fillStyle = "#e8dcc8";
  ctx.beginPath();
  ctx.arc(sx+4.5*s, sy+7*s, 4*s, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(sx+3*s,  sy+6*s,  2*s, 2*s);
  ctx.fillRect(sx+5.5*s,sy+6*s,  2*s, 2*s);
  ctx.fillRect(sx+3.5*s,sy+9*s,  3*s, 1*s);
}

function drawLich(ctx, sx, sy, s, c) {
  // Full robes, bigger, crown
  legs(ctx, sx, sy, s, c.body, c.body);
  ctx.fillStyle = c.body;
  ctx.fillRect(sx+6*s,  sy+12*s, 20*s, 16*s);
  // Robe details
  ctx.fillStyle = c.trim;
  ctx.fillRect(sx+14*s, sy+14*s, 4*s,  14*s);
  ctx.fillRect(sx+6*s,  sy+20*s, 20*s, 2*s);
  // Arms — skeletal
  ctx.fillStyle = "#e8dcc8";
  ctx.fillRect(sx+2*s,  sy+12*s, 5*s,  8*s);
  ctx.fillRect(sx+25*s, sy+12*s, 5*s,  8*s);
  // Staff
  ctx.fillStyle = "#4a1a6a";
  ctx.fillRect(sx+29*s, sy+4*s,  3*s,  26*s);
  ctx.fillStyle = c.trim;
  ctx.beginPath();
  ctx.arc(sx+30.5*s, sy+4*s, 4*s, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = "rgba(180,0,255,0.5)";
  ctx.beginPath();
  ctx.arc(sx+30.5*s, sy+4*s, 6*s, 0, Math.PI*2);
  ctx.fill();
  // Skull head
  ctx.fillStyle = "#e8dcc8";
  ctx.fillRect(sx+9*s,  sy+2*s,  14*s, 12*s);
  // Crown
  ctx.fillStyle = "#f1c40f";
  ctx.fillRect(sx+9*s,  sy+1*s,  14*s, 3*s);
  ctx.fillRect(sx+9*s,  sy-1*s,  3*s,  4*s);
  ctx.fillRect(sx+14*s, sy-2*s,  4*s,  5*s);
  ctx.fillRect(sx+20*s, sy-1*s,  3*s,  4*s);
  // Eye sockets
  ctx.fillStyle = c.trim;
  ctx.fillRect(sx+11*s, sy+6*s,  4*s,  4*s);
  ctx.fillRect(sx+17*s, sy+6*s,  4*s,  4*s);
  ctx.fillStyle = "rgba(180,0,255,0.8)";
  ctx.fillRect(sx+12*s, sy+7*s,  2*s,  2*s);
  ctx.fillRect(sx+18*s, sy+7*s,  2*s,  2*s);
}

// ── Sprite registry ───────────────────────────────────────────────────────

const SPRITES = {
  fighter:     drawFighter,
  ranger:      drawRanger,
  paladin:     drawPaladin,
  wizard:      drawWizard,
  warlock:     drawWarlock,
  cleric:      drawCleric,
  rogue:       drawRogue,
  barbarian:   drawBarbarian,
  monk:        drawMonk,
  druid:       drawDruid,
  bard:        drawBard,
  goblinMelee: (ctx, sx, sy, s, c) => drawGoblin(ctx, sx, sy, s, c, false),
  goblinArcher:(ctx, sx, sy, s, c) => drawGoblin(ctx, sx, sy, s, c, true),
  zombie:      drawZombie,
  skeleton:    drawSkeleton,
  wraith:      drawWraith,
  necromancer: drawNecromancer,
  lich:        drawLich,
};

/**
 * Draw a character sprite centered on (cx, cy) at a given tileSize.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {string}  classId    - e.g. "fighter", "ranger", "goblinMelee"
 * @param {number}  cx         - center x in screen pixels
 * @param {number}  cy         - center y in screen pixels
 * @param {number}  tileSize   - current tile size (24 default)
 * @param {object}  [colors]   - override palette (optional)
 * @param {number}  [alpha]    - globalAlpha override (for death fade)
 * @param {object}  [anim]     - animation state { offsetX, offsetY, scaleY }
 */
export function drawSprite(ctx, classId, cx, cy, tileSize, colors, alpha = 1, anim = {}) {
  const s      = tileSize / 32;
  const w      = 32 * s;
  const h      = 32 * s;
  const sx     = cx - w / 2 + (anim.offsetX ?? 0);
  const sy     = cy - h / 2 + (anim.offsetY ?? 0);
  const c      = colors ?? SPRITE_COLORS[classId] ?? SPRITE_COLORS.fighter;
  const drawFn = SPRITES[classId];

  if (!drawFn) {
    // Fallback — draw a colored square with first letter
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = c.body ?? "#888";
    ctx.fillRect(cx - tileSize/2, cy - tileSize/2, tileSize, tileSize);
    ctx.fillStyle   = "#fff";
    ctx.font        = `bold ${tileSize * 0.5}px monospace`;
    ctx.textAlign   = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((classId[0] ?? "?").toUpperCase(), cx, cy);
    ctx.textBaseline = "alphabetic";
    ctx.textAlign    = "left";
    ctx.globalAlpha  = 1;
    return;
  }

  ctx.save();
  ctx.globalAlpha = alpha;

  // Apply scale animation (e.g. squash on landing)
  if (anim.scaleY && anim.scaleY !== 1) {
    ctx.translate(cx, cy + h / 2);
    ctx.scale(1, anim.scaleY);
    ctx.translate(-cx, -(cy + h / 2));
  }

  drawFn(ctx, sx, sy, s, c);
  ctx.restore();
}

/**
 * Pre-render a sprite to an offscreen canvas for fast drawing.
 * Use this in TileFactory-style caching if needed.
 */
export function renderSpriteToCanvas(classId, tileSize, colors) {
  const c = document.createElement("canvas");
  c.width  = tileSize;
  c.height = tileSize;
  drawSprite(c.getContext("2d"), classId, tileSize/2, tileSize/2, tileSize, colors);
  return c;
}
