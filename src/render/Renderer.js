export class Renderer {
  constructor(canvas) {
    this.ctx = canvas.getContext("2d");
    this.tileSize = 16;
  }

  render(world) {
    const { ctx, tileSize } = this;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        const tile = world.getTile(x, y);
        ctx.fillStyle = tile === 0 ? "#000" : "#3a5";
        ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
      }
    }
  }
}
