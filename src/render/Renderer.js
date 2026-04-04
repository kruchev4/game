export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.tileSize = 16;

    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  render(world) {
    const { ctx, tileSize } = this;

    // Clear to black so white background disappears
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    
const size = tileSize;
for (let y = 0; y < world.height; y++) {
  for (let x = 0; x < world.width; x++) {
    const tile = world.getTile(x, y);

    // checkerboard debug pattern
    const isEven = (x + y) % 2 === 0;

    if (tile === 0) {
      ctx.fillStyle = isEven ? "#1a1a1a" : "#222";
    } else {
      ctx.fillStyle = isEven ? "#3a5" : "#4b6";
    }

    ctx.fillRect(x * size, y * size, size, size);

    // optional thin grid line
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.strokeRect(x * size, y * size, size, size);
  }
}

  }
}
