import { Player } from "./Player.js";
import { MovementSystem } from "../systems/MovementSystem.js";



export class Engine {
  constructor({ worldProvider, renderer }) {
    this.movementSystem = null;
    this.worldProvider = worldProvider;
    this.renderer = renderer;
    this.world = null;

    this.entities = [];
    this.player = null;

    this.running = false;
  }

  async loadWorld(worldId) {
    this.world = await this.worldProvider.load(worldId);

    // TEMP: spawn player near center
    const px = Math.floor(this.world.width / 2);
    const py = Math.floor(this.world.height / 2);

    this.player = new Player({ x: px, y: py });
    this.entities = [this.player];
    this.movementSystem = new MovementSystem({
    world: this.world,
    player: this.player
});

    // Center camera initially on player
    this.renderer.camera.setPosition(px - 10, py - 8);
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

  // update systems
  if (this.movementSystem) {
    this.movementSystem.update();
  }

  // camera follow stays here
  if (this.player) {
    this.renderer.camera.centerOn(
      this.player.x,
      this.player.y,
      this.world
    );
  }

  this.renderer.render(this.world, this.entities);
  requestAnimationFrame(() => this.loop());
}
}
