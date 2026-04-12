import { PriorityQueue } from "./PriorityQueue.js";
import { isWalkable } from "../world/isWalkable.js";

function key(x, y) {
  return `${x},${y}`;
}

function manhattan(ax, ay, bx, by) {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

// Returns an array of tiles [{x,y}, ...] from start(exclusive) to goal(inclusive)
// Returns null if no path found.
export function aStar(world, start, goal, opts = {}) {
  const maxNodes = opts.maxNodes ?? 40000; // safety cap for large worlds

  const sx = start.x, sy = start.y;
  const gx = goal.x, gy = goal.y;

  // quick rejects
  if (sx === gx && sy === gy) return [];
  if (gx < 0 || gy < 0 || gx >= world.width || gy >= world.height) return null;
  if (!isWalkable(world.getTile(gx, gy))) return null;

  // open set is priority queue by f score, tie-break by h
  const open = new PriorityQueue((a, b) => (a.f - b.f) || (a.h - b.h));
  const bestG = new Map();      // key -> best g found so far
  const cameFrom = new Map();   // key -> previous key

  const startKey = key(sx, sy);
  bestG.set(startKey, 0);

  const h0 = manhattan(sx, sy, gx, gy);
  open.push({ x: sx, y: sy, g: 0, h: h0, f: h0 });

  let expanded = 0;

  while (open.size > 0) {
    const cur = open.pop();
    const curKey = key(cur.x, cur.y);

    // stale entry check (because we may push better duplicates)
    const gRecorded = bestG.get(curKey);
    if (gRecorded == null || cur.g !== gRecorded) continue;

    expanded++;
    if (expanded > maxNodes) return null;

    // goal reached
    if (cur.x === gx && cur.y === gy) {
      return reconstructPath(cameFrom, curKey, startKey);
    }

    // neighbors (4-dir)
    const neighbors = [
      { x: cur.x + 1, y: cur.y },
      { x: cur.x - 1, y: cur.y },
      { x: cur.x, y: cur.y + 1 },
      { x: cur.x, y: cur.y - 1 }
    ];

    for (const nb of neighbors) {
      if (nb.x < 0 || nb.y < 0 || nb.x >= world.width || nb.y >= world.height) continue;
      if (!isWalkable(world.getTile(nb.x, nb.y))) continue;

      const nbKey = key(nb.x, nb.y);
      const tentativeG = cur.g + 1;

      const prevBest = bestG.get(nbKey);
      if (prevBest == null || tentativeG < prevBest) {
        bestG.set(nbKey, tentativeG);
        cameFrom.set(nbKey, curKey);

        const h = manhattan(nb.x, nb.y, gx, gy);
        open.push({ x: nb.x, y: nb.y, g: tentativeG, h, f: tentativeG + h });
      }
    }
  }

  return null;
}

function reconstructPath(cameFrom, goalKey, startKey) {
  const path = [];
  let cur = goalKey;

  while (cur && cur !== startKey) {
    const [x, y] = cur.split(",").map(Number);
    path.push({ x, y });
    cur = cameFrom.get(cur);
  }

  path.reverse();
  return path;
}
