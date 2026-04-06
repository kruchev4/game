import { TILE_COLORS } from "../world/constants.js";
import { GameState } from "../state/GameState.js";

const TS = GameState.TILE; // 32

// ── Position hash for deterministic per-tile decoration ───────────────────────
function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = ((h ^ (h >> 13)) * 1274126177) >>> 0;
  return (h >>> 0) / 4294967296;
}
function hash2(x, y) { return hash(x ^ 0xDEAD, y ^ 0xBEEF); }

// ── Tile drawers ──────────────────────────────────────────────────────────────
function drawRoadDirt(ctx, px, py, tx, ty) {
  ctx.fillStyle = "#8b6a44";
  ctx.fillRect(px, py, tx, ty);
  ctx.fillStyle = "rgba(0,0,0,0.14)";
  ctx.fillRect(px + tx*0.18, py + ty*0.40, tx*0.64, ty*0.20);
}

function drawRoadStone(ctx, px, py, tx, ty) {
  ctx.fillStyle = "#7c7f86";
  ctx.fillRect(px, py, tx, ty);
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = 1;
  ctx.strokeRect(px + tx*0.10, py + ty*0.20, tx*0.35, ty*0.28);
  ctx.strokeRect(px + tx*0.55, py + ty*0.20, tx*0.35, ty*0.28);
  ctx.strokeRect(px + tx*0.20, py + ty*0.55, tx*0.35, ty*0.28);
}

function drawRoadObsidian(ctx, px, py, tx, ty) {
  ctx.fillStyle = "#1b1b22";
  ctx.fillRect(px, py, tx, ty);
  ctx.fillStyle = "rgba(255,120,40,0.16)";
  ctx.fillRect(px + tx*0.12, py + ty*0.48, tx*0.76, ty*0.06);
}

function drawRoadBlight(ctx, px, py, tx, ty) {
  ctx.fillStyle = "#2b2626";
  ctx.fillRect(px, py, tx, ty);
  ctx.fillStyle = "rgba(120,220,120,0.14)";
  ctx.fillRect(px + tx*0.22, py + ty*0.38, tx*0.56, ty*0.24);
}

function drawRoadRunic(ctx, px, py, tx, ty) {
  ctx.fillStyle = "#0f0f18";
  ctx.fillRect(px, py, tx, ty);
  ctx.fillStyle = "rgba(60,220,255,0.22)";
  ctx.fillRect(px + tx*0.48, py + ty*0.12, tx*0.04, ty*0.76);
  ctx.fillRect(px + tx*0.12, py + ty*0.48, tx*0.76, ty*0.04);
}

function drawGrass(ctx, px, py, x, y) {
  const h = hash(x, y);
  // Varied base colour
  ctx.fillStyle = h > 0.65 ? '#4e8a3a' : h > 0.35 ? '#3d7530' : '#2e6828';
  ctx.fillRect(px, py, TS, TS);
  // Subtle grid seam
  ctx.fillStyle = 'rgba(0,0,0,0.07)';
  ctx.fillRect(px, py, 1, TS);
  ctx.fillRect(px, py, TS, 1);
  // Grass tufts
  const tuftCount = Math.floor(h * 4);
  for (let i = 0; i < tuftCount; i++) {
    const hx = hash(x + i*11, y + i*7);
    const hy = hash2(x + i*5, y + i*13);
    const tx = px + 2 + Math.floor(hx * (TS - 4));
    const ty = py + 2 + Math.floor(hy * (TS - 4));
    ctx.fillStyle = 'rgba(90,160,60,0.35)';
    ctx.fillRect(tx, ty, 2, 3);
    ctx.fillRect(tx + 1, ty - 1, 1, 2);
  }
  // Flowers
  if (h > 0.91) {
    ctx.fillStyle = h > 0.96 ? '#f1c40f' : h > 0.93 ? '#e74c3c' : '#ffffff';
    ctx.fillRect(px + Math.floor(hash2(x,y)*26)+3, py + Math.floor(hash(x,y+1)*26)+3, 2, 2);
  }

}
function drawForest(ctx, px, py, x, y) {
  const h = hash(x, y);
  // Dark mossy floor
  ctx.fillStyle = h > 0.5 ? '#1a3810' : '#122808';
  ctx.fillRect(px, py, TS, TS);
  // Floor dapple
  if (h > 0.6) {
    ctx.fillStyle = 'rgba(50,100,30,0.2)';
    ctx.fillRect(px + Math.floor(h*20), py + Math.floor(hash2(x,y)*20), 6, 4);
  }
  // Tree trunks
  const treeCount = 1 + Math.floor(h * 2);
   for (let i = 0; i < treeCount; i++) {
    const hx = hash(x + i*7, y + i*3);
    const hy = hash(x + i*5, y + i*9);
    const r  = 6 + Math.floor(hx * 5);
    const tx = px + 5 + Math.floor(hx * (TS - 10));
    const ty = py + 5 + Math.floor(hy * (TS - 10));
    // Trunk
    ctx.fillStyle = '#3d2010';
    ctx.fillRect(tx - 1, ty + r - 2, 3, 5);
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(tx + 3, ty + 3, r, r * 0.7, 0, 0, Math.PI*2);
    ctx.fill();
    // Canopy layers
    ctx.fillStyle = hx > 0.5 ? '#2a5520' : '#1c4015';
    ctx.beginPath();
    ctx.arc(tx, ty, r, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = hx > 0.4 ? '#367025' : '#28551c';
    ctx.beginPath();
    ctx.arc(tx - 1, ty - 2, r * 0.7, 0, Math.PI*2);
    ctx.fill();
    // Highlight
    ctx.fillStyle = 'rgba(80,170,50,0.2)';
    ctx.beginPath();
    ctx.arc(tx - 2, ty - 3, r * 0.4, 0, Math.PI*2);
    ctx.fill();
  }
}

function drawMountain(ctx, px, py, x, y) {
  const h = hash(x, y);
  // Rocky base
  ctx.fillStyle = h > 0.5 ? '#5c5045' : '#4a4035';
  ctx.fillRect(px, py, TS, TS);
  // Two layered peaks for depth
  const midX = px + TS/2 + (h - 0.5) * 10;
  // Back peak (darker)
  ctx.fillStyle = '#6a5a48';
  ctx.beginPath();
  ctx.moveTo(midX + 5, py + 6);
  ctx.lineTo(px + TS - 1, py + TS - 1);
  ctx.lineTo(px + TS/2 + 2, py + TS - 1);
  ctx.closePath();
  ctx.fill();
  // Front peak
  ctx.fillStyle = h > 0.55 ? '#7a6a58' : '#6a5a48';
  ctx.beginPath();
  ctx.moveTo(midX, py + 2);
  ctx.lineTo(px + TS - 3, py + TS - 1);
  ctx.lineTo(px + 3, py + TS - 1);
  ctx.closePath();
  ctx.fill();
  // Snow cap
  if (h > 0.4) {
    ctx.fillStyle = '#eeeeff';
    ctx.beginPath();
    ctx.moveTo(midX, py + 2);
    ctx.lineTo(midX + 7, py + 11);
    ctx.lineTo(midX - 7, py + 11);
    ctx.closePath();
    ctx.fill();
    // Blue shadow on snow
    ctx.fillStyle = 'rgba(100,120,200,0.2)';
    ctx.beginPath();
    ctx.moveTo(midX, py + 2);
    ctx.lineTo(midX, py + 11);
    ctx.lineTo(midX - 7, py + 11);
    ctx.closePath();
    ctx.fill();
  }
  // Rock texture lines
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px + 6, py + TS - 4);
  ctx.lineTo(midX - 3, py + 15);
  ctx.stroke();
}

function drawDeepWater(ctx, px, py, x, y) {
  const h  = hash(x, y);
  const t  = (Date.now() / 2500 + h * 12) % 1;
  const t2 = (Date.now() / 1800 + h * 8)  % 1;
  // Deep base — darker ocean blue
  ctx.fillStyle = '#071e3d';
  ctx.fillRect(px, py, TS, TS);
  // Subtle deep colour variation
  if (h > 0.5) {
    ctx.fillStyle = 'rgba(10,30,70,0.5)';
    ctx.fillRect(px + 4, py + 4, TS - 8, TS - 8);
  }
  // Primary wave
  const waveY = py + 8 + Math.floor(h * (TS - 18));
  ctx.strokeStyle = `rgba(20,60,130,${0.5 + Math.sin(t * Math.PI * 2) * 0.2})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(px + 1, waveY);
  ctx.bezierCurveTo(px + TS*0.3, waveY - 3, px + TS*0.65, waveY + 3, px + TS - 1, waveY);
  ctx.stroke();
  // Secondary wave offset
  const waveY2 = waveY + 7;
  ctx.strokeStyle = `rgba(15,50,110,${0.35 + Math.sin(t2 * Math.PI * 2) * 0.15})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px + 1, waveY2);
  ctx.bezierCurveTo(px + TS*0.4, waveY2 + 2, px + TS*0.7, waveY2 - 2, px + TS - 1, waveY2);
  ctx.stroke();
  // Occasional sparkle
  if (h > 0.82) {
    ctx.fillStyle = `rgba(140,190,255,${0.1 + Math.sin(t*Math.PI*3)*0.15})`;
    ctx.fillRect(px + Math.floor(h*22)+2, py + Math.floor(hash2(x,y)*18)+2, 2, 1);
  }
  // IMPASSABLE indicator — subtle darker border
  ctx.strokeStyle = 'rgba(0,5,20,0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, TS - 1, TS - 1);
}
function drawBlight(ctx, px, py, x, y) {
  const h = hash(x, y);

  ctx.fillStyle = h > 0.5 ? '#3a2a1a' : '#2e2016';
  ctx.fillRect(px, py, TS, TS);

  if (h > 0.4) {
    ctx.fillStyle = 'rgba(80,60,40,0.4)';
    ctx.beginPath();
    ctx.ellipse(
      px + Math.floor(hash(x,y)*18) + 5,
      py + Math.floor(hash2(x,y)*18) + 5,
      6, 4, h * Math.PI, 0, Math.PI * 2
    );
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(120,90,60,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px + 2, py + TS/2);
  ctx.lineTo(px + TS/2, py + 3);
  ctx.lineTo(px + TS - 3, py + TS - 4);
  ctx.stroke();

  ctx.fillStyle = 'rgba(120,160,100,0.06)';
  ctx.fillRect(px + 1, py + 1, TS - 2, TS - 2);
}


function drawVolcano(ctx, px, py, x, y) {
  const h = hash(x, y);
  const t = (Date.now() / 1200 + h * 10) % 1;

  // Basalt base
  ctx.fillStyle = h > 0.5 ? '#2b2b2b' : '#1f1f1f';
  ctx.fillRect(px, py, TS, TS);

  // Lava fissures
  ctx.strokeStyle = `rgba(220,60,20,${0.4 + Math.sin(t * Math.PI * 2) * 0.2})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(px + Math.floor(h * TS), py);
  ctx.lineTo(px + Math.floor(h * TS * 0.7), py + TS);
  ctx.stroke();

  // Molten pools
  if (h > 0.7) {
    ctx.fillStyle = `rgba(255,90,20,${0.25 + Math.sin(t * Math.PI * 3) * 0.15})`;
    ctx.beginPath();
    ctx.ellipse(
      px + Math.floor(hash(x+1,y)*20)+4,
      py + Math.floor(hash2(x,y+1)*20)+4,
      5, 3, 0, 0, Math.PI*2
    );
    ctx.fill();
  }

  // Heat shimmer highlight
  ctx.fillStyle = 'rgba(255,120,60,0.08)';
  ctx.fillRect(px + 1, py + 1, TS - 2, TS - 2);
}


function drawShallow(ctx, px, py, x, y) {
  const h = hash(x, y);
  const t = (Date.now() / 1800 + h * 8) % 1;
  // Lighter coastal water
  ctx.fillStyle = h > 0.5 ? '#1a5a8a' : '#164d78';
  ctx.fillRect(px, py, TS, TS);
  // Sandy bottom hints
  if (h > 0.55) {
    ctx.fillStyle = 'rgba(180,150,90,0.18)';
    ctx.fillRect(px + 3, py + 3, TS - 6, TS - 6);
  }
  // Ripple rings
  const rx = px + 6 + Math.floor(h * (TS - 12));
  const ry = py + 6 + Math.floor(hash2(x,y) * (TS - 12));
  ctx.strokeStyle = `rgba(100,180,220,${0.3 + Math.sin(t * Math.PI * 2) * 0.2})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(rx, ry, 3 + Math.sin(t*Math.PI*2)*1.5, 0, Math.PI*2);
  ctx.stroke();
  // Foam edge dots
  if (h > 0.75) {
    ctx.fillStyle = 'rgba(200,230,255,0.3)';
    ctx.fillRect(px + Math.floor(hash(x+2,y)*28), py + 1, 2, 1);
    ctx.fillRect(px + Math.floor(hash2(x,y+1)*25)+2, py + TS-2, 3, 1);
  }
}

function drawSand(ctx, px, py, x, y) {
  const h = hash(x, y);
  ctx.fillStyle = h > 0.65 ? '#d4aa62' : h > 0.35 ? '#c49a52' : '#b48a42';
  ctx.fillRect(px, py, TS, TS);
  // Dune ripples
  ctx.strokeStyle = 'rgba(140,100,40,0.25)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 2; i++) {
    const lineY = py + 6 + i*10 + Math.floor(hash(x+i,y) * 6);
    ctx.beginPath();
    ctx.moveTo(px + 1, lineY);
    ctx.quadraticCurveTo(px + TS/2, lineY - 2 + (h-0.5)*3, px + TS - 1, lineY);
    ctx.stroke();
  }
  // Pebbles/rocks
  if (h > 0.86) {
    ctx.fillStyle = '#a08050';
    ctx.beginPath();
    ctx.ellipse(
      px + Math.floor(h*22)+4,
      py + Math.floor(hash2(x,y)*22)+4,
      3, 2, h * Math.PI, 0, Math.PI*2
    );
    ctx.fill();
  }
  // Shell sparkle
  if (h > 0.93) {
    ctx.fillStyle = 'rgba(255,240,210,0.5)';
    ctx.fillRect(px + Math.floor(hash(x,y+3)*26)+2, py + Math.floor(hash2(x+1,y)*26)+2, 2, 1);
  }
}

function drawDanger(ctx, px, py, x, y) {
  const h = hash(x, y);
  // Scorched, cracked ground
  ctx.fillStyle = h > 0.55 ? '#3c0e0e' : '#2e0808';
  ctx.fillRect(px, py, TS, TS);
  // Crack network
  ctx.strokeStyle = 'rgba(120,30,30,0.6)';
  ctx.lineWidth = 1;
  if (h > 0.3) {
    ctx.beginPath();
    ctx.moveTo(px + Math.floor(h*TS*0.6) + 2, py + 2);
    ctx.lineTo(px + Math.floor(h*TS*0.4) + 4, py + TS/2);
    ctx.lineTo(px + Math.floor(h*TS*0.7), py + TS - 3);
    ctx.stroke();
  }
  if (h > 0.6) {
    ctx.beginPath();
    ctx.moveTo(px + 3, py + Math.floor(h * TS*0.5)+3);
    ctx.lineTo(px + TS/2, py + Math.floor(h * TS*0.6));
    ctx.stroke();
  }
  // Ember glow pools
  if (h > 0.72) {
    const pulse = (Date.now() / 1200 + h * 5) % 1;
    ctx.fillStyle = `rgba(200,40,10,${0.12 + Math.sin(pulse*Math.PI*2)*0.08})`;
    ctx.beginPath();
    ctx.ellipse(
      px + Math.floor(h*22)+4,
      py + Math.floor(hash2(x,y)*22)+4,
      5, 3, 0, 0, Math.PI*2
    );
    ctx.fill();
  }
  // Rare skull
  if (h > 0.95) {
    ctx.font = `${Math.round(TS*0.4)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#ff4444';
    ctx.fillText('☠', px + TS/2, py + TS/2);
    ctx.globalAlpha = 1;
  }
}

function drawTown(ctx, px, py, x, y) {
  const h  = hash(x, y);
  const h2 = hash2(x, y);

  // Cobblestone plaza base
  ctx.fillStyle = '#9e8e70';
  ctx.fillRect(px, py, TS, TS);

  // Cobblestone grid
  ctx.strokeStyle = 'rgba(50,40,25,0.35)';
  ctx.lineWidth = 0.5;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const offX = (row % 2 === 0) ? 0 : Math.floor(TS/8);
      ctx.strokeRect(px + col*(TS/4) + offX, py + row*(TS/4), TS/4, TS/4);
    }
  }

  // Main building — big, centred
  const bx = px + 4, by = py + 5;
  const bw = TS - 8, bh = TS - 16;
  // Wall
  ctx.fillStyle = h > 0.5 ? '#d4c09a' : '#c4b08a';
  ctx.fillRect(bx, by, bw, bh);
  // Wall shadow right/bottom
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(bx + bw - 3, by + 2, 3, bh);
  ctx.fillRect(bx + 2, by + bh - 3, bw - 2, 3);

  // Roof
  const roofColors = ['#8b1a1a','#5a2a0a','#1a3a6a','#4a3a0a'];
  ctx.fillStyle = roofColors[Math.floor(h * roofColors.length)];
  ctx.beginPath();
  ctx.moveTo(px + TS/2, py);
  ctx.lineTo(px + TS - 1, by + 5);
  ctx.lineTo(px + 1,      by + 5);
  ctx.closePath();
  ctx.fill();
  // Roof ridge line
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px + TS/2, py + 1);
  ctx.lineTo(px + TS - 2, by + 5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(px + TS/2, py + 1);
  ctx.lineTo(px + 2, by + 5);
  ctx.stroke();

  // Door (centred, arched top)
  const dx = bx + Math.floor(bw/2) - 3;
  const dy = by + bh - 9;
  ctx.fillStyle = '#4a2808';
  ctx.fillRect(dx, dy + 3, 6, 6);
  ctx.beginPath();
  ctx.arc(dx + 3, dy + 3, 3, Math.PI, 0);
  ctx.fill();
  // Door knob
  ctx.fillStyle = '#d4a820';
  ctx.fillRect(dx + 5, dy + 5, 1, 1);

  // Windows (two, symmetric)
  const windowGlow = (Math.sin(Date.now()/3000 + h*10) + 1) / 2;
  ctx.fillStyle = `rgba(255,210,80,${0.55 + windowGlow * 0.3})`;
  ctx.fillRect(bx + 3,      by + 4, 5, 4);
  ctx.fillRect(bx + bw - 8, by + 4, 5, 4);
  // Window frames
  ctx.strokeStyle = 'rgba(80,50,10,0.6)';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(bx + 3,      by + 4, 5, 4);
  ctx.strokeRect(bx + bw - 8, by + 4, 5, 4);
  // Window shine
  ctx.fillStyle = 'rgba(255,255,220,0.5)';
  ctx.fillRect(bx + 3, by + 4, 2, 2);
  ctx.fillRect(bx + bw - 8, by + 4, 2, 2);

  // Chimney
  if (h2 > 0.4) {
    ctx.fillStyle = '#7a6050';
    ctx.fillRect(px + Math.floor(h2*8)+5, py, 4, 7);
    // Smoke puff
    ctx.fillStyle = 'rgba(200,200,200,0.2)';
    const smokeT = (Date.now() / 2000 + h * 3) % 1;
    ctx.beginPath();
    ctx.arc(px + Math.floor(h2*8)+7, py - 2 - smokeT*4, 2 + smokeT*2, 0, Math.PI*2);
    ctx.fill();
  }

  // Gold glow border — makes town s unmistakable
  ctx.strokeStyle = 'rgba(220,170,40,0.7)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(px + 0.75, py + 0.75, TS - 1.5, TS - 1.5);
}

// ── Portal  (dungeon entrance) drawn as an overlay on whatever  type ──
// Not a standalone  type — called separately by entity rendering

// ── Class sprite drawers (unchanged) ─────────────────────────────────────────

const CLASS_COLORS = {
  fighter:   { body:'#c0392b', trim:'#e74c3c', skin:'#f5cba7' },
  barbarian: { body:'#922b21', trim:'#e74c3c', skin:'#f0b27a' },
  paladin:   { body:'#2471a3', trim:'#f0e68c', skin:'#f5cba7' },
  rogue:     { body:'#1a1a2e', trim:'#8e44ad', skin:'#f5cba7' },
  ranger:    { body:'#1e8449', trim:'#7dcea0', skin:'#f0b27a' },
  monk:      { body:'#d4ac0d', trim:'#f9e79f', skin:'#f0b27a' },
  wizard:    { body:'#6c3483', trim:'#a569bd', skin:'#f5cba7' },
  sorcerer:  { body:'#1a5276', trim:'#5dade2', skin:'#f5cba7' },
  warlock:   { body:'#212f3c', trim:'#7fb3d3', skin:'#aab7b8' },
  cleric:    { body:'#f0f3f4', trim:'#f39c12', skin:'#f5cba7' },
  druid:     { body:'#1d6a35', trim:'#a9cce3', skin:'#f0b27a' },
  bard:      { body:'#9b59b6', trim:'#f1c40f', skin:'#f5cba7' },
};
function head(ctx,sx,sy,s,skin){ctx.fillStyle=skin;ctx.fillRect(sx+11*s,sy+4*s,10*s,9*s);ctx.fillStyle='#2c3e50';ctx.fillRect(sx+13*s,sy+7*s,2*s,2*s);ctx.fillRect(sx+17*s,sy+7*s,2*s,2*s);}
function body(ctx,sx,sy,s,color){ctx.fillStyle=color;ctx.fillRect(sx+10*s,sy+13*s,12*s,10*s);}
function legs(ctx,sx,sy,s,c1,c2){ctx.fillStyle=c1;ctx.fillRect(sx+10*s,sy+23*s,5*s,7*s);ctx.fillStyle=c2||c1;ctx.fillRect(sx+17*s,sy+23*s,5*s,7*s);}
function arms(ctx,sx,sy,s,color){ctx.fillStyle=color;ctx.fillRect(sx+5*s,sy+13*s,5*s,8*s);ctx.fillRect(sx+22*s,sy+13*s,5*s,8*s);}
function drawFighter(ctx,sx,sy,s,c){legs(ctx,sx,sy,s,'#555','#333');body(ctx,sx,sy,s,c.body);ctx.fillStyle=c.trim;ctx.fillRect(sx+8*s,sy+13*s,4*s,4*s);ctx.fillRect(sx+20*s,sy+13*s,4*s,4*s);arms(ctx,sx,sy,s,'#777');head(ctx,sx,sy,s,c.skin);ctx.fillStyle='#888';ctx.fillRect(sx+10*s,sy+2*s,12*s,5*s);ctx.fillStyle=c.trim;ctx.fillRect(sx+14*s,sy+1*s,4*s,3*s);ctx.fillStyle='#aaa';ctx.fillRect(sx+27*s,sy+11*s,2*s,12*s);ctx.fillStyle=c.trim;ctx.fillRect(sx+25*s,sy+14*s,6*s,2*s);}
function drawWizard(ctx,sx,sy,s,c){legs(ctx,sx,sy,s,c.body);ctx.fillStyle=c.body;ctx.fillRect(sx+8*s,sy+13*s,16*s,14*s);arms(ctx,sx,sy,s,c.body);head(ctx,sx,sy,s,c.skin);ctx.fillStyle=c.body;ctx.beginPath();ctx.moveTo(sx+16*s,sy);ctx.lineTo(sx+9*s,sy+7*s);ctx.lineTo(sx+23*s,sy+7*s);ctx.fill();ctx.fillStyle=c.trim;ctx.fillRect(sx+9*s,sy+6*s,14*s,3*s);ctx.fillStyle='#8b6914';ctx.fillRect(sx+3*s,sy+8*s,3*s,22*s);ctx.fillStyle=c.trim;ctx.beginPath();ctx.arc(sx+4.5*s,sy+7*s,4*s,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(255,255,255,0.5)';ctx.beginPath();ctx.arc(sx+3.5*s,sy+6*s,1.5*s,0,Math.PI*2);ctx.fill();}
function drawWarlock(ctx,sx,sy,s,c){legs(ctx,sx,sy,s,'#1a1a2e');ctx.fillStyle=c.body;ctx.fillRect(sx+8*s,sy+13*s,16*s,14*s);arms(ctx,sx,sy,s,c.body);head(ctx,sx,sy,s,c.skin);ctx.fillStyle=c.body;ctx.fillRect(sx+9*s,sy+2*s,14*s,11*s);ctx.fillRect(sx+7*s,sy+7*s,4*s,7*s);ctx.fillRect(sx+21*s,sy+7*s,4*s,7*s);ctx.fillStyle=c.trim;ctx.beginPath();ctx.arc(sx+5*s,sy+21*s,4*s,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(255,255,255,0.6)';ctx.beginPath();ctx.arc(sx+4*s,sy+20*s,1.5*s,0,Math.PI*2);ctx.fill();ctx.fillStyle='#6b2d0f';ctx.fillRect(sx+23*s,sy+14*s,6*s,8*s);ctx.fillStyle=c.trim;ctx.fillRect(sx+24*s,sy+16*s,4*s,1*s);ctx.fillRect(sx+24*s,sy+18*s,4*s,1*s);}
function drawCleric(ctx,sx,sy,s,c){legs(ctx,sx,sy,s,'#aaa','#888');body(ctx,sx,sy,s,c.body);ctx.fillStyle=c.trim;ctx.fillRect(sx+14*s,sy+15*s,4*s,7*s);ctx.fillRect(sx+12*s,sy+17*s,8*s,3*s);arms(ctx,sx,sy,s,c.body);head(ctx,sx,sy,s,c.skin);ctx.fillStyle=c.body;ctx.fillRect(sx+11*s,sy+2*s,10*s,7*s);ctx.fillStyle=c.trim;ctx.fillRect(sx+14*s,sy+1*s,4*s,8*s);ctx.fillStyle='#888';ctx.fillRect(sx+24*s,sy+10*s,3*s,14*s);ctx.fillStyle='#aaa';ctx.fillRect(sx+22*s,sy+9*s,7*s,5*s);}
function drawPaladin(ctx,sx,sy,s,c){legs(ctx,sx,sy,s,'#5d6d7e','#4a5568');body(ctx,sx,sy,s,'#7f8c8d');ctx.fillStyle=c.body;ctx.fillRect(sx+12*s,sy+13*s,8*s,10*s);ctx.fillStyle=c.trim;ctx.fillRect(sx+14*s,sy+15*s,4*s,6*s);ctx.fillRect(sx+12*s,sy+17*s,8*s,2*s);arms(ctx,sx,sy,s,'#7f8c8d');head(ctx,sx,sy,s,c.skin);ctx.fillStyle='#95a5a6';ctx.fillRect(sx+10*s,sy+2*s,12*s,11*s);ctx.fillStyle='#2c3e50';ctx.fillRect(sx+12*s,sy+6*s,8*s,3*s);ctx.fillStyle=c.body;ctx.fillRect(sx+1*s,sy+12*s,8*s,11*s);ctx.fillStyle=c.trim;ctx.fillRect(sx+3*s,sy+14*s,4*s,7*s);ctx.fillRect(sx+1*s,sy+17*s,8*s,2*s);ctx.fillStyle='#bdc3c7';ctx.fillRect(sx+27*s,sy+9*s,2*s,14*s);ctx.fillStyle=c.trim;ctx.fillRect(sx+25*s,sy+13*s,6*s,2*s);}
function drawRogue(ctx,sx,sy,s,c){legs(ctx,sx,sy,s,'#2c3e50','#1a252f');body(ctx,sx,sy,s,c.body);ctx.fillStyle='#1a1a2e';ctx.fillRect(sx+7*s,sy+12*s,5*s,15*s);ctx.fillRect(sx+20*s,sy+12*s,5*s,15*s);arms(ctx,sx,sy,s,c.body);head(ctx,sx,sy,s,c.skin);ctx.fillStyle=c.body;ctx.fillRect(sx+9*s,sy+3*s,14*s,10*s);ctx.fillStyle='#1a1a2e';ctx.fillRect(sx+11*s,sy+8*s,10*s,4*s);ctx.fillStyle='#bdc3c7';ctx.fillRect(sx+3*s,sy+15*s,2*s,9*s);ctx.fillRect(sx+27*s,sy+15*s,2*s,9*s);ctx.fillStyle=c.trim;ctx.fillRect(sx+2*s,sy+14*s,4*s,2*s);ctx.fillRect(sx+26*s,sy+14*s,4*s,2*s);}
function drawRanger(ctx,sx,sy,s,c){legs(ctx,sx,sy,s,'#4a4a2a','#333321');body(ctx,sx,sy,s,c.body);ctx.fillStyle='#8b6914';ctx.fillRect(sx+21*s,sy+10*s,4*s,12*s);ctx.fillStyle='#e74c3c';ctx.fillRect(sx+22*s,sy+9*s,2*s,3*s);ctx.fillRect(sx+22*s,sy+13*s,2*s,3*s);arms(ctx,sx,sy,s,c.body);head(ctx,sx,sy,s,c.skin);ctx.fillStyle=c.body;ctx.fillRect(sx+9*s,sy+3*s,14*s,10*s);ctx.fillRect(sx+7*s,sy+7*s,18*s,3*s);ctx.strokeStyle='#8b6914';ctx.lineWidth=2*s;ctx.beginPath();ctx.arc(sx+3*s,sy+16*s,10*s,-Math.PI*0.5,Math.PI*0.5);ctx.stroke();ctx.strokeStyle='#f5cba7';ctx.lineWidth=s*0.5;ctx.beginPath();ctx.moveTo(sx+3*s,sy+6*s);ctx.lineTo(sx+3*s,sy+26*s);ctx.stroke();}
function drawBarbarian(ctx,sx,sy,s,c){legs(ctx,sx,sy,s,'#5d4037','#4e342e');ctx.fillStyle=c.body;ctx.fillRect(sx+8*s,sy+13*s,16*s,10*s);ctx.fillStyle='#795548';ctx.fillRect(sx+8*s,sy+13*s,16*s,3*s);ctx.fillStyle=c.skin;ctx.fillRect(sx+3*s,sy+13*s,7*s,9*s);ctx.fillRect(sx+22*s,sy+13*s,7*s,9*s);head(ctx,sx,sy,s,c.skin);ctx.fillStyle='#4a2f1a';ctx.fillRect(sx+9*s,sy+2*s,14*s,6*s);ctx.fillRect(sx+7*s,sy+4*s,4*s,8*s);ctx.fillRect(sx+21*s,sy+4*s,4*s,8*s);ctx.fillStyle='#888';ctx.fillRect(sx+25*s,sy+8*s,3*s,16*s);ctx.fillStyle='#aaa';ctx.fillRect(sx+24*s,sy+8*s,7*s,5*s);ctx.fillRect(sx+26*s,sy+13*s,5*s,4*s);}
function drawMonk(ctx,sx,sy,s,c){legs(ctx,sx,sy,s,c.body,'#b7950b');body(ctx,sx,sy,s,c.body);ctx.fillStyle=c.trim;ctx.fillRect(sx+10*s,sy+18*s,12*s,3*s);ctx.fillStyle=c.skin;ctx.fillRect(sx+5*s,sy+13*s,5*s,7*s);ctx.fillRect(sx+22*s,sy+13*s,5*s,7*s);ctx.fillRect(sx+4*s,sy+19*s,6*s,5*s);head(ctx,sx,sy,s,c.skin);ctx.fillStyle='#2c3e50';ctx.fillRect(sx+14*s,sy+2*s,4*s,5*s);ctx.fillStyle='rgba(255,215,0,0.4)';ctx.beginPath();ctx.arc(sx+7*s,sy+22*s,5*s,0,Math.PI*2);ctx.fill();}
function drawDruid(ctx,sx,sy,s,c){legs(ctx,sx,sy,s,'#4a2f1a');ctx.fillStyle=c.body;ctx.fillRect(sx+8*s,sy+13*s,16*s,14*s);ctx.fillStyle='#27ae60';ctx.fillRect(sx+9*s,sy+14*s,4*s,4*s);ctx.fillRect(sx+19*s,sy+14*s,4*s,4*s);ctx.fillRect(sx+13*s,sy+20*s,6*s,4*s);arms(ctx,sx,sy,s,c.body);head(ctx,sx,sy,s,c.skin);ctx.fillStyle='#8b6914';ctx.fillRect(sx+11*s,sy+3*s,10*s,3*s);ctx.fillRect(sx+11*s,sy+1*s,2*s,4*s);ctx.fillRect(sx+19*s,sy+1*s,2*s,4*s);ctx.fillRect(sx+13*s,sy,2*s,3*s);ctx.fillRect(sx+17*s,sy,2*s,3*s);ctx.fillStyle='#6b8e23';ctx.fillRect(sx+3*s,sy+10*s,3*s,20*s);ctx.fillStyle='#2ecc71';ctx.beginPath();ctx.arc(sx+4.5*s,sy+9*s,4*s,0,Math.PI*2);ctx.fill();}
function drawBard(ctx,sx,sy,s,c){legs(ctx,sx,sy,s,'#6c3483','#5b2c6f');body(ctx,sx,sy,s,c.body);ctx.fillStyle=c.trim;ctx.fillRect(sx+10*s,sy+13*s,12*s,2*s);ctx.fillRect(sx+10*s,sy+21*s,12*s,2*s);arms(ctx,sx,sy,s,c.body);head(ctx,sx,sy,s,c.skin);ctx.fillStyle=c.body;ctx.fillRect(sx+8*s,sy+5*s,16*s,4*s);ctx.fillRect(sx+11*s,sy+2*s,10*s,5*s);ctx.fillStyle=c.trim;ctx.fillRect(sx+20*s,sy+1*s,3*s,6*s);ctx.fillRect(sx+22*s,sy,2*s,4*s);ctx.fillStyle='#a0522d';ctx.beginPath();ctx.ellipse(sx+26*s,sy+20*s,4*s,5*s,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#2c3e50';ctx.fillRect(sx+25*s,sy+14*s,2*s,7*s);ctx.fillRect(sx+24*s,sy+15*s,4*s,1*s);ctx.fillRect(sx+24*s,sy+17*s,4*s,1*s);}

function drawBoss(ctx, sx, sy, ts, icon) {
  const s = ts / 32;
  // Red aura
  ctx.fillStyle = 'rgba(120,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(sx + ts/2, sy + ts*0.55, ts*0.52, ts*0.42, 0, 0, Math.PI*2);
  ctx.fill();
  // Drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.ellipse(sx + ts/2, sy + ts - 3*s, ts*0.38, ts*0.12, 0, 0, Math.PI*2);
  ctx.fill();
  // Boss icon
  ctx.font = `${Math.round(ts * 0.68)}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(icon || '💀', sx + ts/2, sy + ts * 0.45);
  // Crown
  ctx.font = `${Math.round(ts * 0.22)}px serif`;
  ctx.fillText('👑', sx + ts/2, sy + 4*s);
}

function drawSprite(ctx, sx, sy, ts, cls) {
  const c = CLASS_COLORS[cls] || CLASS_COLORS.fighter;
  const s = ts / 32;

  // Drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(
    sx + ts / 2,
    sy + ts - 2 * s,
    ts * 0.32,
    ts * 0.09,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // ✅ REQUIRED keyword
  switch (cls) {
    case 'wizard':    drawWizard(ctx, sx, sy, s, c);    break;
    case 'sorcerer':  drawWizard(ctx, sx, sy, s, c);    break;
    case 'warlock':   drawWarlock(ctx, sx, sy, s, c);   break;
    case 'cleric':    drawCleric(ctx, sx, sy, s, c);    break;
    case 'paladin':   drawPaladin(ctx, sx, sy, s, c);   break;
    case 'rogue':     drawRogue(ctx, sx, sy, s, c);     break;
    case 'ranger':    drawRanger(ctx, sx, sy, s, c);    break;
    case 'barbarian': drawBarbarian(ctx, sx, sy, s, c); break;
    case 'monk':      drawMonk(ctx, sx, sy, s, c);      break;
    case 'druid':     drawDruid(ctx, sx, sy, s, c);     break;
    case 'bard':      drawBard(ctx, sx, sy, s, c);      break;
    default:          drawFighter(ctx, sx, sy, s, c);   break;
  }
}

// ── Portal overlay (drawn on top of any  where a portal exists) ───────────
function drawPortal(ctx, px, py, ts) {
  const t = (Date.now() / 1500) % 1;
  const pulse = 0.5 + Math.sin(t * Math.PI * 2) * 0.3;
  // Dark vortex base
  ctx.fillStyle = `rgba(40,0,80,${0.6 + pulse * 0.2})`;
  ctx.beginPath();
  ctx.ellipse(px + ts/2, py + ts*0.58, ts*0.38, ts*0.3, 0, 0, Math.PI*2);
  ctx.fill();
  // Purple glow ring
  ctx.strokeStyle = `rgba(160,60,255,${0.5 + pulse * 0.4})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(px + ts/2, py + ts*0.58, ts*0.38, ts*0.3, 0, 0, Math.PI*2);
  ctx.stroke();
  // Inner swirl
  ctx.strokeStyle = `rgba(200,120,255,${0.3 + pulse * 0.3})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(px + ts/2, py + ts*0.58, ts*0.2, ts*0.15, t*Math.PI*2, 0, Math.PI*2);
  ctx.stroke();
  // Icon
  ctx.font = `${Math.round(ts * 0.38)}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🌀', px + ts/2, py + ts * 0.55);
}


// ── Dungeon tile drawers ──────────────────────────────────────────────────────

function drawWall(ctx, px, py, x, y) {
  const h = hash(x, y);
  ctx.fillStyle = h > 0.6 ? '#1a1a28' : h > 0.3 ? '#151520' : '#111118';
  ctx.fillRect(px, py, TS, TS);
  // Stone block pattern
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fillRect(px, py, TS/2-1, TS/2-1);
  ctx.fillRect(px+TS/2+1, py+TS/2+1, TS/2-1, TS/2-1);
  // Crack
  if(h>0.7){
    ctx.strokeStyle='rgba(0,0,0,0.4)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(px+4,py+3);ctx.lineTo(px+10,py+12);ctx.stroke();
  }
}

function drawFloor(ctx, px, py, x, y) {
  const h = hash(x, y);
  ctx.fillStyle = h > 0.6 ? '#2e2820' : h > 0.3 ? '#262018' : '#221c14';
  ctx.fillRect(px, py, TS, TS);
  // Subtle stone texture
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  if(h>0.8) ctx.fillRect(px+2, py+2, TS-4, 1);
  if(h>0.9) ctx.fillRect(px+2, py+TS-4, TS-4, 1);
}

function drawDoor(ctx, px, py, x, y) {
  // Floor base
  drawFloor(ctx, px, py, x, y);
  // Door frame
  ctx.fillStyle = '#5a3010';
  ctx.fillRect(px+4, py+2, TS-8, TS-4);
  ctx.fillStyle = '#7a4a20';
  ctx.fillRect(px+6, py+4, TS-12, TS-8);
  // Handle
  ctx.fillStyle = '#c9a227';
  ctx.fillRect(px+TS/2-1, py+TS/2-1, 3, 3);
  // Frame border
  ctx.strokeStyle = '#3a2008';ctx.lineWidth=2;
  ctx.strokeRect(px+4, py+2, TS-8, TS-4);
}

function drawChest(ctx, px, py, x, y) {
  drawFloor(ctx, px, py, x, y);
  // Chest body
  ctx.fillStyle = '#6b3a10';
  ctx.fillRect(px+5, py+8, TS-10, TS-14);
  ctx.fillStyle = '#8b5a20';
  ctx.fillRect(px+5, py+8, TS-10, (TS-14)/2);
  // Lid
  ctx.fillStyle = '#5a2a08';
  ctx.fillRect(px+5, py+6, TS-10, 4);
  // Lock
  ctx.fillStyle = '#c9a227';
  ctx.fillRect(px+TS/2-2, py+TS/2-1, 4, 4);
  // Glow
  const t = (Date.now()/1500)%1;
  ctx.fillStyle = `rgba(201,162,39,${0.08+Math.sin(t*Math.PI*2)*0.05})`;
  ctx.fillRect(px+3, py+5, TS-6, TS-8);
}

function drawStairsUp(ctx, px, py, x, y) {
  drawFloor(ctx, px, py, x, y);
  ctx.fillStyle = 'rgba(96,128,160,0.6)';
  for(let i=0;i<4;i++){
    ctx.fillRect(px+4+i*3, py+TS-8-i*4, TS-8-i*6, 3);
  }
  ctx.font=`${Math.round(TS*0.5)}px serif`;
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('⬆', px+TS/2, py+TS/2);
}

function drawStairsDown(ctx, px, py, x, y) {
  drawFloor(ctx, px, py, x, y);
  ctx.fillStyle = 'rgba(64,80,96,0.6)';
  for(let i=0;i<4;i++){
    ctx.fillRect(px+4+i*3, py+4+i*4, TS-8-i*6, 3);
  }
  ctx.font=`${Math.round(TS*0.5)}px serif`;
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('⬇', px+TS/2, py+TS/2);
}
function drawTownFloor(ctx, px, py, x, y) {
  const h = hash(x, y);
  // Cobblestone base
  ctx.fillStyle = h > 0.5 ? '#7a6e5e' : '#6a5e4e';
  ctx.fillRect(px, py, TS, TS);
  // Cobble grid lines
  ctx.strokeStyle = 'rgba(30,20,10,0.4)';
  ctx.lineWidth = 0.5;
  const offset = (Math.floor(y) % 2 === 0) ? 0 : TS/4;
  for (let i = 0; i < 4; i++) {
    ctx.strokeRect(px + (i * TS/4 + offset) % TS, py, TS/4, TS/2);
    ctx.strokeRect(px + i * TS/4, py + TS/2, TS/4, TS/2);
  }
  // Worn highlight on some stones
  if (h > 0.75) {
    ctx.fillStyle = 'rgba(255,240,200,0.07)';
    ctx.fillRect(px + 3, py + 3, TS/4 - 2, TS/2 - 4);
  }
}

function drawTownWall(ctx, px, py, x, y) {
  const h = hash(x, y);
  // Stone wall base
  ctx.fillStyle = h > 0.5 ? '#2e2418' : '#241c10';
  ctx.fillRect(px, py, TS, TS);
  // Stone block pattern
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(px + 1, py + 1, TS/2 - 2, TS/2 - 2);
  ctx.fillRect(px + TS/2 + 1, py + TS/2 + 1, TS/2 - 2, TS/2 - 2);
  // Mortar lines
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, TS - 1, TS - 1);
  ctx.beginPath();
  ctx.moveTo(px, py + TS/2); ctx.lineTo(px + TS, py + TS/2);
  ctx.moveTo(px + TS/2, py); ctx.lineTo(px + TS/2, py + TS/2);
  ctx.stroke();
  // Slight top highlight (depth)
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(px, py, TS, 2);
}

function drawTownService(ctx, px, py, x, y, icon, color) {
  const h = hash(x, y);
  // Coloured floor base
  ctx.fillStyle = color;
  ctx.fillRect(px, py, TS, TS);
  // Cobble texture underneath
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(px, py, TS, TS);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fillRect(px + 1, py + 1, TS/2 - 2, TS/2 - 2);
  ctx.fillRect(px + TS/2 + 1, py + TS/2 + 1, TS/2 - 2, TS/2 - 2);
  // Coloured glow
  const pulse = 0.5 + Math.sin(Date.now() / 1200 + x * 0.7 + y * 0.5) * 0.15;
  ctx.fillStyle = color + Math.round(pulse * 40).toString(16).padStart(2,'0');
  ctx.fillRect(px, py, TS, TS);
  // Icon
  ctx.font = `${Math.round(TS * 0.5)}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = 0.9;
  ctx.fillText(icon, px + TS/2, py + TS/2);
  ctx.globalAlpha = 1;
  // Bright border
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.6;
  ctx.strokeRect(px + 1, py + 1, TS - 2, TS - 2);
  ctx.globalAlpha = 1;
}

function drawTownExit(ctx, px, py, x, y) {
  const h = hash(x, y);
  // Green grass exit
  ctx.fillStyle = '#2a5a2a';
  ctx.fillRect(px, py, TS, TS);
  // Grass tufts
  ctx.fillStyle = '#3a7a3a';
  ctx.fillRect(px + 2, py + 2, TS - 4, TS - 4);
  // Pulsing arrow indicator
  const pulse = 0.4 + Math.sin(Date.now() / 800) * 0.3;
  ctx.fillStyle = `rgba(100,255,100,${pulse})`;
  ctx.font = `${Math.round(TS * 0.55)}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🌍', px + TS/2, py + TS/2);
  // Dashed border
  ctx.strokeStyle = `rgba(60,200,60,${pulse})`;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 3]);
  ctx.strokeRect(px + 1, py + 1, TS - 2, TS - 2);
  ctx.setLineDash([]);
}

function drawTownDeco(ctx, px, py, x, y) {
  const h = hash(x, y);
  // Stone base
  ctx.fillStyle = '#3a3028';
  ctx.fillRect(px, py, TS, TS);
  // Fountain pool
  ctx.fillStyle = '#1a3a5a';
  ctx.beginPath();
  ctx.ellipse(px + TS/2, py + TS*0.6, TS*0.38, TS*0.25, 0, 0, Math.PI*2);
  ctx.fill();
  // Water shimmer
  const t = (Date.now() / 1000 + h * 3) % 1;
  ctx.fillStyle = `rgba(100,180,255,${0.2 + Math.sin(t*Math.PI*2)*0.1})`;
  ctx.beginPath();
  ctx.ellipse(px + TS/2, py + TS*0.6, TS*0.25, TS*0.15, 0, 0, Math.PI*2);
  ctx.fill();
  // Centre pillar
  ctx.fillStyle = '#7a6a58';
  ctx.fillRect(px + TS/2 - 3, py + TS*0.2, 6, TS*0.45);
  // Water spout
  ctx.fillStyle = `rgba(150,210,255,${0.5 + Math.sin(t*Math.PI*4)*0.2})`;
  ctx.fillRect(px + TS/2 - 1, py + TS*0.1, 2, TS*0.15);
}


// ── Main export ───────────────────────────────────────────────────────────────

export function renderMap(ctx, map, camera, entities = []) {
  if (!map || !map.tiles) return;
  if (!TS || TS <= 0) { console.warn('[renderer] TS invalid:', TS); return; }

  const startX = Math.floor(camera.x / TS);
  const startY = Math.floor(camera.y / TS);
  const endX   = Math.ceil((camera.x + camera.w) / TS);
  const endY   = Math.ceil((camera.y + camera.h) / TS);

  // Build portal lookup for fast access
  const portals = map.portals || [];
  const portalSet = new Set(portals.map(p => `${p.x},${p.y}`));

  for (let ty = startY; ty < endY; ty++) {
    for (let tx = startX; tx < endX; tx++) {
      if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) continue;
      const px   = Math.round(tx * TS - camera.x);
      const py   = Math.round(ty * TS - camera.y);
      const tile = map.tiles[ty * map.width + tx];

      ctx.save();
switch (tile) {
        // ── World tiles ─────────────────────────────
        case 0:  drawGrass(ctx, px, py, tx, ty);     break;
        case 1:  drawForest(ctx, px, py, tx, ty);    break;
        case 2:  drawMountain(ctx, px, py, tx, ty);  break;
        case 3:  drawDeepWater(ctx, px, py, tx, ty); break;
        case 4:  drawShallow(ctx, px, py, tx, ty);   break;
        case 5:  drawTown(ctx, px, py, tx, ty);      break;
        case 6:  drawSand(ctx, px, py, tx, ty);      break;
        case 7:  drawDanger(ctx, px, py, tx, ty);    break;
        case 8:  drawBlight(ctx, px, py, tx, ty);    break;
        case 9:  drawVolcano(ctx, px, py, tx, ty);   break;

        // ── Dungeon/Interior tiles ──────────────────
        case 10: drawWall(ctx, px, py, tx, ty);      break;
        case 11: drawFloor(ctx, px, py, tx, ty);     break;
        case 12: drawDoor(ctx, px, py, tx, ty);      break;
        case 13: drawChest(ctx, px, py, tx, ty);     break;
        case 14: drawStairsUp(ctx, px, py, tx, ty);  break;
        case 15: drawStairsDown(ctx, px, py, tx, ty); break;

        // ── Town Special tiles ──────────────────────
        case 20: drawTownFloor(ctx, px, py, tx, ty); break;
        case 21: drawTownWall(ctx, px, py, tx, ty);  break;
        case 22: drawTownService(ctx, px, py, tx, ty, '⚔️', '#a33'); break; // Smithy
        case 23: drawTownService(ctx, px, py, tx, ty, '🧪', '#3a3'); break; // Alchemist
        case 24: drawTownService(ctx, px, py, tx, ty, '📜', '#33a'); break; // Library
        case 25: drawTownExit(ctx, px, py, tx, ty);  break;
        case 26: drawTownDeco(ctx, px, py, tx, ty);  break;
    // ── Roads (biome-matched) ─────────────────
        case 27: drawRoadDirt(ctx, px, py, tx, ty);     break; // grass/forest/jungle path
        case 28: drawRoadStone(ctx, px, py, tx, ty);    break; // mountain/highland road
        case 29: drawRoadObsidian(ctx, px, py, tx, ty); break; // volcanic/obsidian brick
        case 30: drawRoadBlight(ctx, px, py, tx, ty);   break; // ashen/cursed road
        case 31: drawRoadRunic(ctx, px, py, tx, ty);    break; // eldritch rune road

        default: drawFloor(ctx, px, py, tx, ty);     break;
      }

      // Draw portal overlay if it exists on this tile
      if (portalSet.has(`${tx},${ty}`)) {
        drawPortal(ctx, px, py, TS);
      }

      ctx.restore();
    }
  }


  // Entities (player + bosses)
  for (const e of entities) {
    const sx = Math.round(e.x * TS - camera.x);
    const sy = Math.round(e.y * TS - camera.y);
    ctx.save();
    if (e.isBoss) {
      drawBoss(ctx, sx, sy, TS, e.icon);
    } else {
      const cls = (e.cls?.id || e.cls || 'fighter').toLowerCase();
      drawSprite(ctx, sx, sy, TS, cls);
      // Party member name tag
      if(e.isPartyMember && e.name){
        ctx.font = "bold 9px 'Cinzel',sans-serif";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillText(e.name, sx + TS/2 + 1, sy + 1);
        // Coloured name
        ctx.fillStyle = e.color || '#c090ff';
        ctx.fillText(e.name, sx + TS/2, sy);
        // Colour dot indicator
        ctx.fillStyle = e.color || '#c090ff';
        ctx.beginPath();
        ctx.arc(sx + TS/2, sy + TS + 3, 2, 0, Math.PI*2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}
