import { Camera } from "./Camera.js";

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

  render(world) {
    const { ctx, tileSize, camera } = this;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    const tilesWide = Math.ceil(ctx.canvas.width / tileSize);
    const tilesHigh = Math.ceil(ctx.canvas.height / tileSize);

    for (let y = 0; y < tilesHigh; y++) {
      for (let x = 0; x < tilesWide; x++) {
        const wx = x + camera.x;
        const wy = y + camera.y;

        const tile = world.getTile(wx, wy);
        if (tile == null) continue;

        const isEven = (wx + wy) % 2 === 0;
        ctx.fillStyle =
          tile === 0
            ? (isEven ? "#1a1a1a" : "#222")
            : (isEven ? "#3a5" : "#4b6");

        const { sx, sy } = camera.worldToScreen(wx, wy);
        ctx.fillRect(sx, sy, tileSize, tileSize);

        ctx.strokeStyle = "rgba(0,0,0,0.25)";
        ctx.strokeRect(sx, sy, tileSize, tileSize);
      }
    }
  }
}
