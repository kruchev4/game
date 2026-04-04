import { isWalkable } from "../world/isWalkable.js";

update(dt = 1) {
  for (const npc of this.npcs) {
    // advance this NPC's internal timer
    npc._cooldown -= dt;
    if (npc._cooldown > 0) continue;

    // not every think cycle results in movement
    // this keeps roaming subtle
    if (Math.random() < 0.7) {
      npc._cooldown = 30 + Math.random() * 60;
      continue;
    }

    // attempt a random step
    const dx = Math.floor(Math.random() * 3) - 1; // -1,0,1
    const dy = Math.floor(Math.random() * 3) - 1;
    if (dx === 0 && dy === 0) continue;

    const nx = npc.x + dx;
    const ny = npc.y + dy;

    // world bounds
    if (
      nx < 0 ||
      ny < 0 ||
      nx >= this.world.width ||
      ny >= this.world.height
    ) {
      npc._cooldown = 20;
      continue;
    }

    // soft leash to roam center
    const dist =
      Math.abs(nx - npc.roamCenter.x) +
      Math.abs(ny - npc.roamCenter.y);

    if (dist > npc.roamRadius) {
      npc._cooldown = 20;
      continue;
    }

    // collision / walkability
    if (!isWalkable(this.world.getTile(nx, ny))) {
      npc._cooldown = 20;
      continue;
    }

    // apply move
    npc.x = nx;
    npc.y = ny;

    // reset think timer
    npc._cooldown = 30 + Math.random() * 60;
  }
}

