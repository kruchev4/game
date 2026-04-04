import { Camera } from "./Camera.js";
import { getTileDef } from "../world/getTileDef.js";


export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.tileSize = 16;

    this.camera = new Camera({
      tileSize: this.tileSize
    });

    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    this.camera.resize(
      this.canvas.width,
      this.canvas.height
    );
  }
  

  drawEntity(entity) {
  const { ctx, tileSize, camera } = this;

  const { sx, sy } = camera.worldToScreen(entity.x, entity.y);

  ctx.fillStyle = "#ffd700"; // gold
  ctx.fillRect(
    sx + 2,
    sy + 2,
    tileSize - 4,
    tileSize - 4
  );

  // outline
  ctx.strokeStyle = "#000";
  ctx.strokeRect(
    sx + 2,
    sy + 2,
    tileSize - 4,
    tileSize - 4
  );
}

  render(world, entities = []) {
  const { ctx, tileSize, camera } = this;

  // background
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  const tilesWide = Math.ceil(ctx.canvas.width / tileSize);
  const tilesHigh = Math.ceil(ctx.canvas.height / tileSize);

  // ---- draw tiles ----
  for (let y = 0; y < tilesHigh; y++) {
    for (let x = 0; x < tilesWide; x++) {
      const wx = x + camera.x;
      const wy = y + camera.y;

      const tileId = world.getTile(wx, wy);
      if (tileId == null) continue;

      const tile = getTileDef(tileId);
      const { sx, sy } = camera.worldToScreen(wx, wy);

      ctx.fillStyle = tile.color;
      ctx.fillRect(sx, sy, tileSize, tileSize);

      // optional grid
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.strokeRect(sx, sy, tileSize, tileSize);
    }
  }

  // ---- draw click target marker (optional) ----
  const p = entities.find(e => e.type === "player");
  if (p && p.moveTarget) {
    const { sx, sy } = camera.worldToScreen(p.moveTarget.x, p.moveTarget.y);
    ctx.fillStyle = "#ff3b3b";
    ctx.beginPath();
    ctx.arc(
      sx + tileSize / 2,
      sy + tileSize / 2,
      Math.max(3, tileSize * 0.18),
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  // ---- draw entities (player, etc.) ----
  for (const entity of entities) {
    this.drawEntity(entity);
  }
}
}

  // draw entities ON TOP of tiles
  for (const entity of entities) {
    this.drawEntity(entity);
  }
}
}
