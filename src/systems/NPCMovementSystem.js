import { isWalkable } from "../world/isWalkable.js";

export class NPCMovementSystem {
  constructor({ world, npcs }) {
    this.world = world;
    this.npcs = npcs;
  }

  update(dt = 1) {
    for (const npc of this.npcs) {
      npc._cooldown -= dt;
      if (npc._cooldown > 0) continue;

      // small chance to move each tick
      if (Math.random() < 0.7) {
        npc._cooldown = 30 + Math.random() * 60;
        continue;
      }

      const dx = Math.floor(Math.random() * 3) - 1;
      const dy = Math.floor(Math.random() * 3) - 1;
      if (dx === 0 && dy === 0) continue;

      const nx = npc.x + dx;
      const ny = npc.y + dy;

      // bounds
      if (nx < 0 || ny < 0 || nx >= this.world.width || ny >= this.world.height)
        continue;

      // leash (soft)
      const dist =
        Math.abs(nx - npc.roamCenter.x) +
        Math.abs(ny - npc.roamCenter.y);

      if (dist > npc.roamRadius) continue;

      // collision
      if (!isWalkable(this.world.getTile(nx, ny))) continue;

      // apply move
      npc.x = nx;
      npc.y = ny;

      npc._cooldown = 30 + Math.random() * 60;
    }
  }
}
