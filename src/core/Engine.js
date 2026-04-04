export class Engine {
  constructor({ worldProvider, renderer }) {
    this.worldProvider = worldProvider;
    this.renderer = renderer;
    this.world = null;
    this.running = false;
  }

  async loadWorld(worldId) {
    this.world = await this.worldProvider.load(worldId);
  }

  start() {
    if (!this.world) {
      throw new Error("Engine started without a world");
    }
    this.running = true;
    this.loop();
  }

  loop() {
    if (!this.running) return;

    this.renderer.render(this.world);
    requestAnimationFrame(() => this.loop());
  }
}
