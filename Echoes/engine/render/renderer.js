// game/engine/render/renderer.js

import { TILE_COLORS, TILE, PASSABLE } from "../world/constants.js";

/**
 * Draw one tile from a GameMap at screen coords.
 * Replaces your old drawTile() completely.
 */
export function drawTile(ctx, map, tx, ty, sx, sy) {
  const { width, height } = map;

  // Out-of-bounds = infinite ocean (your existing effect)
  if (tx < 0 || ty < 0 || tx >= width || ty >= height) {
    drawOceanTile(ctx, tx, ty, sx, sy);
    return;
  }

  const idx = ty * width + tx;
  const type = map.tiles[idx];
  const variant = map.variants[idx];

  const palette = TILE_COLORS[type] || TILE_COLORS[TILE.GRASS];
  ctx.fillStyle = palette[variant % palette.length];

  ctx.fillRect(sx, sy, TILE, TILE);

  // Portals have special animation
  if (type === TILE.PORTAL) {
    drawPortalEffect(ctx, sx, sy);
  }
}


/**
 * Draw the entire visible portion of the map.
 * Replaces ALL world/dungeon drawing code.
 */
export function renderMap(ctx, map, camera, entities = []) {
  const { width, height } = map;

  const startTileX = Math.floor(camera.x / TILE);
  const startTileY = Math.floor(camera.y / TILE);

  const endTileX = Math.ceil((camera.x + camera.w) / TILE);
  const endTileY = Math.ceil((camera.y + camera.h) / TILE);

  // Clear the screen
  ctx.clearRect(0, 0, camera.w, camera.h);

  // Draw tiles
  for (let ty = startTileY; ty <= endTileY; ty++) {
    for (let tx = startTileX; tx <= endTileX; tx++) {
      const sx = (tx * TILE) - camera.x;
      const sy = (ty * TILE) - camera.y;

      drawTile(ctx, map, tx, ty, sx, sy);
    }
  }

  // Draw entities (player, NPCs, monsters)
  for (const e of entities) {
    drawEntity(ctx, e, camera);
  }
}


/**
 * Draw an entity (player, NPC, monster).
 * You can extend this as needed.
 */
function drawEntity(ctx, entity, camera) {
  const sx = entity.x * TILE - camera.x;
  const sy = entity.y * TILE - camera.y;

  ctx.fillStyle = entity.color || "#ffd700";
  ctx.fillRect(sx + 8, sy + 8, TILE - 16, TILE - 16);
}


/**
 * SPECIAL: Out-of-bounds infinite ocean effect (your old logic)
 */
function drawOceanTile(ctx, tx, ty, sx, sy) {
  const TILE = 32;
  const wx = (tx + 1000) * TILE;
  const wy = (ty + 1000) * TILE;
  const waveIndex = (wx * 7 + wy * 13) % 4;
  const oceanCols = ["#0d2a4a","#0f3055","#0b2440","#102e52"];

  ctx.fillStyle = oceanCols[waveIndex];
  ctx.fillRect(sx, sy, TILE, TILE);

  // shimmer
  const t = Date.now() / 1800;
  const woff = ((wx * 0.03 + wy * 0.05 + t) % TILE);

  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx, sy + woff);
  ctx.lineTo(sx + TILE, sy + woff);
  ctx.stroke();
}


/**
 * Portal visual effect from your original code
 */
function drawPortalEffect(ctx, sx, sy) {
  const TILE = 32;
  const t = Date.now() / 700;
  const pulse = 0.5 + Math.sin(t) * 0.35;
  const pulse2 = 0.5 + Math.sin(t + 1.5) * 0.35;

  // Halo
  const grad = ctx.createRadialGradient(
    sx + TILE / 2, sy + TILE / 2, 4,
    sx + TILE / 2, sy + TILE / 2, TILE
  );
  grad.addColorStop(0, `rgba(120,40,255,${pulse * 0.6})`);
  grad.addColorStop(1, 'rgba(80,20,160,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(sx - TILE/2, sy - TILE/2, TILE*2, TILE*2);

  // Inner stone
  ctx.fillStyle = `rgba(60,15,130,${0.7 + pulse * 0.3})`;
  ctx.fillRect(sx + 3, sy + 3, TILE - 6, TILE - 6);

  // Border
  ctx.strokeStyle = `rgba(180,100,255,${0.5 + pulse2 * 0.4})`;
  ctx.lineWidth = 2;
  ctx.strokeRect(sx + 3, sy + 3, TILE - 6, TILE - 6);

  // Rune
  ctx.font = "16px serif";
  ctx.textAlign = "center";
  ctx.fillStyle = `rgba(220,170,255,${0.6 + pulse * 0.3})`;
  ctx.fillText("⬟", sx + TILE/2, sy + TILE/2 + 6);
}
``