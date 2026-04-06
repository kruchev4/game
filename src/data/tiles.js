/**
 * tiles.js
 *
 * Tile definitions for all tile IDs used in Realm of Echoes.
 * Each tile has: color (fallback), walkable flag, type, and a draw() function
 * for use by TileFactory when rendering to chunk canvases.
 *
 * Tile ID map:
 *   0  = GRASS          7  = SAND           14 = PORTAL
 *   1  = FOREST         8  = DUNGEON WALL   15 = JUNGLE
 *   2  = MOUNTAIN       9  = DUNGEON FLOOR  16 = VOLCANO
 *   3  = DEEP_WATER     10 = STAIRS_UP      17 = ELDRITCH
 *   4  = PATH/SHALLOW   11 = STAIRS_DOWN    18 = OBSIDIAN
 *   5  = TOWN           12 = DOOR           19 = BLIGHT
 *   6  = DANGER         13 = CHEST          20-29 = TOWN tiles
 */

// ── Helpers ───────────────────────────────────────────────────────────────

function hash(x, y) {
  let n = (x * 374761393) ^ (y * 668265263);
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967296;
}

function hash2(x, y) {
  let n = (x * 668265263) ^ (y * 374761393);
  n = (n ^ (n >> 15)) * 2246822519;
  return ((n ^ (n >> 13)) >>> 0) / 4294967296;
}

// ── Draw functions ────────────────────────────────────────────────────────

function drawGrass(ctx, px, py, ts, x, y) {
  const h = hash(x, y);
  ctx.fillStyle = h > 0.6 ? '#4a8a3a' : h > 0.3 ? '#3a6b30' : '#2e5a28';
  ctx.fillRect(px, py, ts, ts);
  if (h > 0.8) {
    ctx.fillStyle = 'rgba(60,120,30,0.3)';
    ctx.fillRect(px + 2, py + 2, 3, 5);
    ctx.fillRect(px + ts - 5, py + ts - 6, 3, 5);
  }
}

function drawForest(ctx, px, py, ts, x, y) {
  const h = hash(x, y);
  ctx.fillStyle = h > 0.5 ? '#2a5e20' : '#1e4a1a';
  ctx.fillRect(px, py, ts, ts);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.arc(px + ts/2, py + ts/2, ts * 0.38, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = h > 0.5 ? '#3a7a28' : '#2e6020';
  ctx.beginPath();
  ctx.arc(px + ts/2, py + ts/2 - 1, ts * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawMountain(ctx, px, py, ts, x, y) {
  const h = hash(x, y);
  ctx.fillStyle = h > 0.5 ? '#6a5e4a' : '#5a4e3a';
  ctx.fillRect(px, py, ts, ts);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.moveTo(px + ts/2, py + 2);
  ctx.lineTo(px + ts - 3, py + ts - 3);
  ctx.lineTo(px + 3, py + ts - 3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.moveTo(px + ts/2, py + 2);
  ctx.lineTo(px + ts/2 + 4, py + 8);
  ctx.lineTo(px + ts/2 - 4, py + 8);
  ctx.closePath();
  ctx.fill();
}

function drawDeepWater(ctx, px, py, ts, x, y) {
  const t = (Date.now() / 3000 + hash(x,y) * 6) % 1;
  ctx.fillStyle = '#1a3f6b';
  ctx.fillRect(px, py, ts, ts);
  ctx.fillStyle = `rgba(30,74,128,${0.4 + Math.sin(t * Math.PI * 2) * 0.15})`;
  ctx.fillRect(px, py, ts, ts);
  ctx.fillStyle = `rgba(60,120,180,${0.15 + Math.sin(t * Math.PI * 2 + 1) * 0.08})`;
  ctx.fillRect(px + 2, py + ts * 0.3, ts - 4, 2);
  ctx.fillRect(px + 1, py + ts * 0.65, ts - 3, 1);
}

function drawShallow(ctx, px, py, ts, x, y) {
  const t = (Date.now() / 2500 + hash(x,y) * 4) % 1;
  ctx.fillStyle = '#2a6080';
  ctx.fillRect(px, py, ts, ts);
  ctx.fillStyle = `rgba(80,160,180,${0.2 + Math.sin(t * Math.PI * 2) * 0.1})`;
  ctx.fillRect(px + 2, py + ts * 0.4, ts - 4, 2);
}

function drawTown(ctx, px, py, ts, x, y) {
  ctx.fillStyle = '#c9a227';
  ctx.fillRect(px, py, ts, ts);
  ctx.fillStyle = 'rgba(255,220,80,0.3)';
  ctx.fillRect(px + 2, py + 2, ts - 4, ts - 4);
}

function drawDanger(ctx, px, py, ts, x, y) {
  const h = hash(x, y);
  ctx.fillStyle = h > 0.5 ? '#8b2a2a' : '#6b1a1a';
  ctx.fillRect(px, py, ts, ts);
  if (h > 0.7) {
    ctx.fillStyle = 'rgba(200,40,40,0.15)';
    ctx.fillRect(px + 1, py + 1, ts - 2, ts - 2);
  }
}

function drawSand(ctx, px, py, ts, x, y) {
  const h = hash(x, y);
  ctx.fillStyle = h > 0.5 ? '#d4b880' : '#c8a870';
  ctx.fillRect(px, py, ts, ts);
  if (h > 0.75) {
    ctx.fillStyle = 'rgba(200,160,80,0.2)';
    ctx.fillRect(px + 3, py + h * (ts - 4), ts - 6, 1);
  }
}

function drawWall(ctx, px, py, ts, x, y) {
  const h = hash(x, y);
  ctx.fillStyle = h > 0.6 ? '#1a1a28' : h > 0.3 ? '#151520' : '#111118';
  ctx.fillRect(px, py, ts, ts);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fillRect(px, py, ts/2-1, ts/2-1);
  ctx.fillRect(px+ts/2+1, py+ts/2+1, ts/2-1, ts/2-1);
  if (h > 0.7) {
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px+4,py+3); ctx.lineTo(px+10,py+12); ctx.stroke();
    ctx.lineWidth = 1;
  }
}

function drawFloor(ctx, px, py, ts, x, y) {
  const h = hash(x, y);
  ctx.fillStyle = h > 0.6 ? '#2e2820' : h > 0.3 ? '#262018' : '#221c14';
  ctx.fillRect(px, py, ts, ts);
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  if (h > 0.8) ctx.fillRect(px+2, py+2, ts-4, 1);
  if (h > 0.9) ctx.fillRect(px+2, py+ts-4, ts-4, 1);
}

function drawStairsUp(ctx, px, py, ts, x, y) {
  drawFloor(ctx, px, py, ts, x, y);
  ctx.fillStyle = 'rgba(96,128,160,0.6)';
  for (let i = 0; i < 4; i++) ctx.fillRect(px+4+i*3, py+ts-8-i*4, ts-8-i*6, 3);
  ctx.globalAlpha = 1;
  ctx.font = `${Math.round(ts*0.5)}px serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('⬆', px+ts/2, py+ts/2);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

function drawStairsDown(ctx, px, py, ts, x, y) {
  drawFloor(ctx, px, py, ts, x, y);
  ctx.fillStyle = 'rgba(64,80,96,0.6)';
  for (let i = 0; i < 4; i++) ctx.fillRect(px+4+i*3, py+4+i*4, ts-8-i*6, 3);
  ctx.font = `${Math.round(ts*0.5)}px serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('⬇', px+ts/2, py+ts/2);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

function drawDoor(ctx, px, py, ts, x, y) {
  drawFloor(ctx, px, py, ts, x, y);
  ctx.fillStyle = '#5a3010';
  ctx.fillRect(px+4, py+2, ts-8, ts-4);
  ctx.fillStyle = '#7a4a20';
  ctx.fillRect(px+6, py+4, ts-12, ts-8);
  ctx.fillStyle = '#c9a227';
  ctx.fillRect(px+ts/2-1, py+ts/2-1, 3, 3);
  ctx.strokeStyle = '#3a2008'; ctx.lineWidth = 2;
  ctx.strokeRect(px+4, py+2, ts-8, ts-4);
  ctx.lineWidth = 1;
}

function drawChest(ctx, px, py, ts, x, y) {
  drawFloor(ctx, px, py, ts, x, y);
  ctx.fillStyle = '#6b3a10';
  ctx.fillRect(px+5, py+8, ts-10, ts-14);
  ctx.fillStyle = '#8b5a20';
  ctx.fillRect(px+5, py+8, ts-10, (ts-14)/2);
  ctx.fillStyle = '#5a2a08';
  ctx.fillRect(px+5, py+6, ts-10, 4);
  ctx.fillStyle = '#c9a227';
  ctx.fillRect(px+ts/2-2, py+ts/2-1, 4, 4);
  const t = (Date.now()/1500)%1;
  ctx.fillStyle = `rgba(201,162,39,${0.08+Math.sin(t*Math.PI*2)*0.05})`;
  ctx.fillRect(px+3, py+5, ts-6, ts-8);
}

function drawPortal(ctx, px, py, ts, x, y) {
  const t = (Date.now() / 1200 + hash(x,y) * 4) % 1;
  ctx.fillStyle = '#32104a';
  ctx.fillRect(px, py, ts, ts);
  const grd = ctx.createRadialGradient(px+ts/2, py+ts/2, 1, px+ts/2, py+ts/2, ts/2);
  grd.addColorStop(0, `rgba(160,80,255,${0.5 + Math.sin(t*Math.PI*2)*0.2})`);
  grd.addColorStop(1, 'rgba(80,20,180,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(px, py, ts, ts);
  ctx.font = `${Math.round(ts*0.55)}px serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.globalAlpha = 0.85 + Math.sin(t*Math.PI*2)*0.1;
  ctx.fillText('🌀', px+ts/2, py+ts/2);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

// ── Expansion tiles ───────────────────────────────────────────────────────

function drawJungle(ctx, px, py, ts, x, y) {
  const h = hash(x, y);
  ctx.fillStyle = h > 0.5 ? '#16502a' : '#0f3b1f';
  ctx.fillRect(px, py, ts, ts);
  ctx.fillStyle = 'rgba(0,80,20,0.4)';
  ctx.beginPath(); ctx.arc(px+ts/2, py+ts/2, ts*0.42, 0, Math.PI*2); ctx.fill();
}

function drawVolcano(ctx, px, py, ts, x, y) {
  const t = (Date.now()/800 + hash(x,y)*3) % 1;
  ctx.fillStyle = '#7a1a0a';
  ctx.fillRect(px, py, ts, ts);
  ctx.fillStyle = `rgba(255,80,0,${0.3+Math.sin(t*Math.PI*2)*0.15})`;
  ctx.fillRect(px+2, py+2, ts-4, ts-4);
}

function drawEldritch(ctx, px, py, ts, x, y) {
  const t = (Date.now()/2000 + hash(x,y)*5) % 1;
  ctx.fillStyle = '#32134d';
  ctx.fillRect(px, py, ts, ts);
  ctx.fillStyle = `rgba(120,40,220,${0.2+Math.sin(t*Math.PI*2)*0.1})`;
  ctx.fillRect(px, py, ts, ts);
}

function drawObsidian(ctx, px, py, ts, x, y) {
  const h = hash(x, y);
  ctx.fillStyle = h > 0.5 ? '#303030' : '#1a1a1a';
  ctx.fillRect(px, py, ts, ts);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(px+1, py+1, ts/2-2, ts/2-2);
}

function drawBlight(ctx, px, py, ts, x, y) {
  const h = hash(x, y);
  ctx.fillStyle = h > 0.5 ? '#5a3a2a' : '#3a2a1a';
  ctx.fillRect(px, py, ts, ts);
  ctx.fillStyle = 'rgba(80,40,0,0.3)';
  if (h > 0.6) ctx.fillRect(px+2, py+2, ts-4, ts-4);
}

// ── Town tiles ────────────────────────────────────────────────────────────

function drawTownFloor(ctx, px, py, ts, x, y) {
  const h = hash(x, y);
  ctx.fillStyle = h > 0.5 ? '#7a6e5e' : '#6a5e4e';
  ctx.fillRect(px, py, ts, ts);
  ctx.strokeStyle = 'rgba(30,20,10,0.4)'; ctx.lineWidth = 0.5;
  const offset = (Math.floor(y) % 2 === 0) ? 0 : ts/4;
  for (let i = 0; i < 4; i++) {
    ctx.strokeRect(px + (i * ts/4 + offset) % ts, py, ts/4, ts/2);
    ctx.strokeRect(px + i * ts/4, py + ts/2, ts/4, ts/2);
  }
  ctx.lineWidth = 1;
  if (h > 0.75) {
    ctx.fillStyle = 'rgba(255,240,200,0.07)';
    ctx.fillRect(px+3, py+3, ts/4-2, ts/2-4);
  }
}

function drawTownWall(ctx, px, py, ts, x, y) {
  const h = hash(x, y);
  ctx.fillStyle = h > 0.5 ? '#2e2418' : '#241c10';
  ctx.fillRect(px, py, ts, ts);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(px+1, py+1, ts/2-2, ts/2-2);
  ctx.fillRect(px+ts/2+1, py+ts/2+1, ts/2-2, ts/2-2);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1;
  ctx.strokeRect(px+0.5, py+0.5, ts-1, ts-1);
  ctx.beginPath();
  ctx.moveTo(px, py+ts/2); ctx.lineTo(px+ts, py+ts/2);
  ctx.moveTo(px+ts/2, py); ctx.lineTo(px+ts/2, py+ts/2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(px, py, ts, 2);
}

function drawTownService(ctx, px, py, ts, x, y, icon, color) {
  drawTownFloor(ctx, px, py, ts, x, y);
  ctx.fillStyle = color + '40';
  ctx.fillRect(px, py, ts, ts);
  ctx.font = `${Math.round(ts*0.5)}px serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.globalAlpha = 0.9;
  ctx.fillText(icon, px+ts/2, py+ts/2);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = color; ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.5;
  ctx.strokeRect(px+1, py+1, ts-2, ts-2);
  ctx.globalAlpha = 1; ctx.lineWidth = 1;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

function drawTownExit(ctx, px, py, ts, x, y) {
  ctx.fillStyle = '#2a5a2a';
  ctx.fillRect(px, py, ts, ts);
  ctx.fillStyle = '#3a7a3a';
  ctx.fillRect(px+2, py+2, ts-4, ts-4);
  const pulse = 0.4 + Math.sin(Date.now()/800) * 0.3;
  ctx.font = `${Math.round(ts*0.55)}px serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.globalAlpha = pulse;
  ctx.fillText('🌍', px+ts/2, py+ts/2);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

// ── Tile definitions ──────────────────────────────────────────────────────

export const TILES = {
  // World
  0:  { color: '#3a6b30', walkable: true,  type: 'grass',       draw: drawGrass },
  1:  { color: '#1e4a1a', walkable: false, type: 'forest',      draw: drawForest },
  2:  { color: '#5a4e3a', walkable: false, type: 'mountain',    draw: drawMountain },
  3:  { color: '#1a3f6b', walkable: false, type: 'deep_water',  draw: drawDeepWater },
  4:  { color: '#2a6080', walkable: true,  type: 'shallow',     draw: drawShallow },
  5:  { color: '#c9a227', walkable: true,  type: 'town',        draw: drawTown },
  6:  { color: '#6b1a1a', walkable: true,  type: 'danger',      draw: drawDanger },
  7:  { color: '#c8a870', walkable: true,  type: 'sand',        draw: drawSand },
  // Dungeon
  8:  { color: '#151520', walkable: false, type: 'wall',        draw: drawWall },
  9:  { color: '#262018', walkable: true,  type: 'floor',       draw: drawFloor },
  10: { color: '#6080a0', walkable: true,  type: 'stairs_up',   draw: drawStairsUp },
  11: { color: '#405060', walkable: true,  type: 'stairs_down', draw: drawStairsDown },
  12: { color: '#8b5e1a', walkable: true,  type: 'door',        draw: drawDoor },
  13: { color: '#c9a227', walkable: true,  type: 'chest',       draw: drawChest },
  14: { color: '#8040cc', walkable: true,  type: 'portal',      draw: drawPortal },
  // Expansion
  15: { color: '#0f3b1f', walkable: true,  type: 'jungle',     draw: drawJungle },
  16: { color: '#7a1a0a', walkable: false, type: 'volcano',    draw: drawVolcano },
  17: { color: '#32134d', walkable: true,  type: 'eldritch',   draw: drawEldritch },
  18: { color: '#1a1a1a', walkable: false, type: 'obsidian',   draw: drawObsidian },
  19: { color: '#3a2a1a', walkable: true,  type: 'blight',     draw: drawBlight },
  // Town
  20: { color: '#6a6058', walkable: true,  type: 'town_floor', draw: drawTownFloor },
  21: { color: '#1e1810', walkable: false, type: 'town_wall',  draw: drawTownWall },
  22: { color: '#7a5030', walkable: true,  type: 'inn',        draw: (ctx,px,py,ts,x,y) => drawTownService(ctx,px,py,ts,x,y,'🏨','#7a5030') },
  23: { color: '#1a3a5a', walkable: true,  type: 'shop',       draw: (ctx,px,py,ts,x,y) => drawTownService(ctx,px,py,ts,x,y,'⚒','#1a3a5a') },
  24: { color: '#4a2a6a', walkable: true,  type: 'temple',     draw: (ctx,px,py,ts,x,y) => drawTownService(ctx,px,py,ts,x,y,'✝','#4a2a6a') },
  25: { color: '#3a2808', walkable: true,  type: 'tavern',     draw: (ctx,px,py,ts,x,y) => drawTownService(ctx,px,py,ts,x,y,'🍺','#3a2808') },
  26: { color: '#1a3a1a', walkable: true,  type: 'vendor',     draw: (ctx,px,py,ts,x,y) => drawTownService(ctx,px,py,ts,x,y,'💰','#1a3a1a') },
  27: { color: '#102a2a', walkable: true,  type: 'craft',      draw: (ctx,px,py,ts,x,y) => drawTownService(ctx,px,py,ts,x,y,'⚗','#102a2a') },
  28: { color: '#1a4a1a', walkable: true,  type: 'town_exit',  draw: drawTownExit },
  29: { color: '#252015', walkable: false, type: 'deco',       draw: drawTownWall },
  // Road tiles
  30: { color: '#7a7060', walkable: true,  type: 'road_cobble', draw: drawFloor },
  31: { color: '#8a6a40', walkable: true,  type: 'road_dirt',   draw: drawFloor },
  32: { color: '#656060', walkable: true,  type: 'road_stone',  draw: drawFloor },
  33: { color: '#5a3a18', walkable: true,  type: 'road_bridge', draw: drawFloor },
  35: { color: '#7a6848', walkable: true,  type: 'road_path',   draw: drawFloor },
};
