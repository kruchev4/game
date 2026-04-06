// game/engine/dungeon/dungeonToTilemap.js

import { TILE } from "../world/constants.js";

/**
 * Convert a dungeon room-graph into a 240x180 tilemap.
 * Edges = walls. Rooms carved as rectangles. Corridors connect rooms.
 */
export function dungeonToTilemap(dungeonJson) {
  const W = 240;
  const H = 180;

  // Start with full walls
  const tiles = new Uint8Array(W * H).fill(TILE.WALL);
  const variants = new Uint8Array(W * H).fill(0);

  const rooms = dungeonJson.rooms;
  const layout = {};

  // ==== STEP 1: Position rooms vertically down the center ====

  let curY = 20;            // Start carving near top
  const roomWidth = 20;     // 20 tiles wide
  const roomHeight = 12;    // 12 tiles tall
  const centerX = Math.floor(W / 2);

  rooms.forEach((room, index) => {
    const x1 = centerX - Math.floor(roomWidth / 2);
    const y1 = curY;
    const x2 = x1 + roomWidth - 1;
    const y2 = y1 + roomHeight - 1;

    layout[room.id] = { x1, y1, x2, y2 };

    // Carve the room interior
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        tiles[y * W + x] = TILE.FLOOR;
      }
    }

    // Move Y downward for next room
    curY += roomHeight + 12;
  });


  // ==== STEP 2: Carve corridors between connected rooms ====

  rooms.forEach(room => {
    const r1 = layout[room.id];

    // handle linear next field
    const targets = [];
    if (room.next) targets.push(room.next);

    // handle choice nodes
    if (room.choices)
      room.choices.forEach(ch => targets.push(ch.next));

    targets.forEach(nextId => {
      const r2 = layout[nextId];
      if (!r2) return;

      // corridor: horizontal line then vertical line
      const midX = r1.x1 + Math.floor(roomWidth / 2);

      const startY = r1.y2;
      const endY = r2.y1;

      // carve vertical corridor
      for (let y = startY; y <= endY; y++) {
        tiles[y * W + midX] = TILE.FLOOR;
      }
    });
  });


  // ==== STEP 3: Add encounters (combat, boss) ====

  const encounters = [];

  rooms.forEach(room => {
    if (room.type === "combat" || room.type === "boss") {
      const pos = layout[room.id];
      encounters.push({
        id: room.id,
        type: room.type,
        x: Math.floor((pos.x1 + pos.x2) / 2),
        y: Math.floor((pos.y1 + pos.y2) / 2),
        data: room.encounter || null
      });
    }
  });


  // ==== Return final GameMap JSON ====

  return {
    id: dungeonJson.id,
    name: dungeonJson.name,
    type: "dungeon",
    width: W,
    height: H,
    tiles: Array.from(tiles),
    variants: Array.from(variants),
    encounters,
    metadata: {
      theme: dungeonJson.theme || null,
      roomLayout: layout
    }
  };
}