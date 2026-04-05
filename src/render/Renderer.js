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

    this.camera.resize(this.canvas.width, this.canvas.height);
  }

  drawEntity(entity) {
    const { ctx, tileSize, camera } = this;
    const { sx, sy } = camera.worldToScreen(entity.x, entity.y);

    // Set color BEFORE drawing
    if (entity.type === "npc") {
      ctx.fillStyle = entity.state === "alert"
        ? "#ff5555"   // red = aware
        : "#cc3333";  // darker red = roaming
    } else {
      ctx.fillStyle = "#ffd700"; // player gold
    }

    ctx.fillRect(sx + 2, sy + 2, tileSize - 4, tileSize - 4);
    ctx.strokeStyle = "#000";
    ctx.strokeRect(sx + 2, sy + 2, tileSize - 4, tileSize - 4);
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

        ctx.strokeStyle = "rgba(0,0,0,0.25)";
        ctx.strokeRect(sx, sy, tileSize, tileSize);
      }
    }
for (const entity of entities) {
  if (entity.type !== "npc") continue;

  const { sx, sy } = camera.worldToScreen(entity.x, entity.y);
  const r = entity.perceptionRadius * tileSize;

  ctx.strokeStyle =
    entity.state === "alert"
      ? "rgba(255, 80, 80, 0.4)"
      : "rgba(255, 255, 255, 0.15)";

  ctx.beginPath();
  ctx.arc(
    sx + tileSize / 2,
    sy + tileSize / 2,
    r,
    0,
    Math.PI * 2
  );
  ctx.stroke();
}
    // ---- draw A* path polyline (optional) ----
// ---- draw A* path polyline (optional) ----
const player = entities.find(e => e.type === "player");

if (player && player.movePath && player.movePath.length) {
  ctx.strokeStyle = "rgba(255, 60, 60, 0.55)";
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  ctx.beginPath();

  // Start at the player's center
  {
    const { sx, sy } = camera.worldToScreen(player.x, player.y);
    ctx.moveTo(sx + tileSize / 2, sy + tileSize / 2);
  }

  for (const step of player.movePath) {
    const { sx, sy } = camera.worldToScreen(step.x, step.y);

    if (
      sx < -tileSize || sy < -tileSize ||
      sx > ctx.canvas.width + tileSize ||
      sy > ctx.canvas.height + tileSize
    ) {
      continue;
    }

    ctx.lineTo(sx + tileSize / 2, sy + tileSize / 2);
  }

  ctx.stroke();

  ctx.fillStyle = "rgba(255, 60, 60, 0.65)";
  for (let i = 0; i < player.movePath.length; i += 3) {
    const step = player.movePath[i];
    const { sx, sy } = camera.worldToScreen(step.x, step.y);
    ctx.beginPath();
    ctx.arc(sx + tileSize / 2, sy + tileSize / 2, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---- draw click target marker ----
if (player && player.moveTarget) {
  const { sx, sy } = camera.worldToScreen(
    player.moveTarget.x,
    player.moveTarget.y
  );
  ctx.fillStyle = "#ff3b3b";
  ctx.beginPath();
  ctx.arc(sx + tileSize / 2, sy + tileSize / 2, 4, 0, Math.PI * 2);
  ctx.fill();
}


    // ---- draw entities ----
    for (const entity of entities) {
      this.drawEntity(entity);
    }
  }
}
