import { isWalkable } from "../world/isWalkable.js";

export class NPCMovementSystem {
  constructor({ world, npcs, player }) {
    this.world = world;
    this.npcs = npcs;
    this.player = player;
  }

  update(dt = 1) {
    for (const npc of this.npcs) {
      npc._cooldown -= dt;
      if (npc._cooldown > 0) continue;

      if (npc.state === "alert") {
        if (npc.chaseSteps >= npc.maxChaseSteps) {
          npc.chaseSteps = 0;
          npc._cooldown = 20;
          continue;
        }

        const px = this.player.x;
        const py = this.player.y;
        const dx = Math.sign(px - npc.x);
        const dy = Math.sign(py - npc.y);
        const step =
          Math.abs(px - npc.x) > Math.abs(py - npc.y)
            ? { x: dx, y: 0 }
            : { x: 0, y: dy };
        const nx = npc.x + step.x;
        const ny = npc.y + step.y;

        const leashDist =
          Math.abs(nx - npc.roamCenter.x) +
          Math.abs(ny - npc.roamCenter.y);
        if (leashDist > npc.roamRadius) {
          npc.state = "roaming";
          npc.chaseSteps = 0;
          npc._cooldown = 30;
          continue;
        }

        if (!isWalkable(this.world.getTile(nx, ny))) {
          npc._cooldown = 10;
          continue;
        }

        npc.x = nx;
        npc.y = ny;
        npc.chaseSteps += 1;
        npc._cooldown = 12;

      } else {
        // Roaming logic
        if (Math.random() < 0.7) {
          npc._cooldown = 30 + Math.random() * 60;
          continue;
        }

        const dx = Math.floor(Math.random() * 3) - 1;
        const dy = Math.floor(Math.random() * 3) - 1;
        if (dx === 0 && dy === 0) continue;

        const nx = npc.x + dx;
        const ny = npc.y + dy;

        if (
          nx < 0 || ny < 0 ||
          nx >= this.world.width ||
          ny >= this.world.height
        ) {
          npc._cooldown = 20;
          continue;
        }

        const dist =
          Math.abs(nx - npc.roamCenter.x) +
          Math.abs(ny - npc.roamCenter.y);
        if (dist > npc.roamRadius) {
          npc._cooldown = 20;
          continue;
        }

        if (!isWalkable(this.world.getTile(nx, ny))) {
          npc._cooldown = 20;
          continue;
        }

        npc.x = nx;
        npc.y = ny;
        npc._cooldown = 30 + Math.random() * 60;
      }
    }
  }
}
