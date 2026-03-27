// game/engine/movement/pathfinding.js

import { PASSABLE } from "../world/constants.js";

export function bfsPath(map, sx, sy, tx, ty, maxNodes=2000) {
  const W = map.width;
  const H = map.height;

  const q = [[sx, sy]];
  const visited = new Set([sy * W + sx]);
  const parent = {};

  let idx = 0;
  while (idx < q.length && q.length < maxNodes) {
    const [x, y] = q[idx++];

    if (x === tx && y === ty) break;

    for (const [nx, ny] of [[x+1,y], [x-1,y], [x,y+1], [x,y-1]]) {
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      if (!PASSABLE.has(map.getTile(nx, ny))) continue;

      const id = ny * W + nx;
      if (!visited.has(id)) {
        visited.add(id);
        parent[id] = [x, y];
        q.push([nx, ny]);
      }
    }
  }

  const path = [];
  let cur = [tx, ty];
  while (cur[0] !== sx || cur[1] !== sy) {
    path.push(cur);
    const id = cur[1] * W + cur[0];
    cur = parent[id];
    if (!cur) return null;
  }

  return path.reverse();
}