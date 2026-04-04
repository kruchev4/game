import { Player } from "./Player.js";
import { MovementSystem } from "../systems/MovementSystem.js";
import { findNearestWalkable } from "../world/findNearestWalkable.js";
import { ClickToMoveSystem } from "../systems/ClickToMoveSystem.js";
import { NPC } from "../entities/NPC.js";
import { NPCMovementSystem } from "../systems/NPCMovementSystem.js";
import { NPCPerceptionSystem } from "../systems/NPCPerceptionSystem.js";



export class Engine {
  constructor({ worldProvider, renderer }) {
    this.clickToMoveSystem = null;
    this.npcs = [];
    this.npcMovementSystem = null;

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

    // spawn near center, but ensure walkable
    const cx = Math.floor(this.world.width / 2);
    const cy = Math.floor(this.world.height / 2);

    const { x, y } = findNearestWalkable(this.world, cx, cy);

    this.player = new Player({ x, y });
    this.entities = [this.player];
    
    this.npcPerceptionSystem = new NPCPerceptionSystem({
      npcs: this.npcs,
      player: this.player
    });

    

// TEMP test NPC
const npc = new NPC({
  id: "npc_goblin_1",
  x: x + 5,
  y: y + 2,
  roamCenter: { x: x + 5, y: y + 2 },
  roamRadius: 5
});

this.npcs.push(npc);

// entities = player + npcs
this.entities = [this.player, ...this.npcs];

this.npcMovementSystem = new NPCMovementSystem({
  world: this.world,
  npcs: this.npcs,
  player: this.player // ✅ pass it
});

  this.movementSystem = new MovementSystem({
    world: this.world,
    player: this.player
  });
  this.clickToMoveSystem = new ClickToMoveSystem({
    canvas: this.renderer.canvas,
    camera: this.renderer.camera,
    world: this.world,
    movementSystem: this.movementSystem
});

  // initial camera snap (follow will maintain this)
  this.renderer.camera.centerOn(x, y, this.world);
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

  // update systems (exactly once)
  this.npcMovementSystem?.update();
  this.npcPerceptionSystem?.update();

  this.movementSystem?.update();

  // camera follow
  if (this.player) {
    this.renderer.camera.centerOn(
      this.player.x,
      this.player.y,
      this.world
    );
  }

  // render ONCE
  this.renderer.render(this.world, this.entities);

  // schedule next frame ONCE
  requestAnimationFrame(() => this.loop());

}
}
