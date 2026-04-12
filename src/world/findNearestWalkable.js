import { isWalkable } from "./isWalkable.js";

export function findNearestWalkable(world, startX, startY, maxRadius = 20) {
  if (isWalkable(world.getTile(startX, startY))) {
    return { x: startX, y: startY };
  }

  for (let r = 1; r <= maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = startX + dx;
        const y = startY + dy;

        if (
          x < 0 ||
          y < 0 ||
          x >= world.width ||
          y >= world.height
        ) {
          continue;
        }

        if (isWalkable(world.getTile(x, y))) {
          return { x, y };
        }
      }
    }
  }

  // Fallback: no walkable tile found nearby
  throw new Error(
    `No walkable tile found near (${startX}, ${startY})`
  );
}
