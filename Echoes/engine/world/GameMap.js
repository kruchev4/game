// game/engine/world/GameMap.js

export class GameMap {
  constructor(json) {
    this.id = json.id;
    this.name = json.name || json.id;
    this.type = json.type || "world";   // "world" | "dungeon" | "instance"

    this.width = json.width;
    this.height = json.height;

    // Tiles stored as flattened Uint8 arrays
    const size = (json.width || 0) * (json.height || 0);

this.tiles = Uint8Array.from(json.tiles || new Array(size).fill(0));
this.variants = Uint8Array.from(json.variants || new Array(size).fill(0));
    this.theme = json.theme || null;
    this.metadata = json.metadata || {};

    this.towns = json.towns || [];
    this.portals = json.portals || [];
    this.npcs = json.npcs || [];
    this.entities = json.entities || [];
    this.encounters = json.encounters || [];
  }

  getTile(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
    return this.tiles[y * this.width + x];
  }

  setTile(x, y, type) {
    this.tiles[y * this.width + x] = type;
  }

  getVariant(x, y) {
    return this.variants[y * this.width + x];
  }

  fill(type) {
    this.tiles.fill(type);
  }

  isPassable(x, y, PASSABLE) {
    const t = this.getTile(x, y);
    return PASSABLE.has(t);
  }
}
