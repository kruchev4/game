import { isWalkable }         from "../world/isWalkable.js";
import { findNearestWalkable } from "../world/findNearestWalkable.js";

export class ClickToMoveSystem {
  /**
   * @param {object} opts
   * @param {HTMLCanvasElement} opts.canvas
   * @param {Camera}            opts.camera
   * @param {object}            opts.world
   * @param {MovementSystem}    opts.movementSystem
   * @param {object[]}          opts.npcs          - live NPC list for hit-testing
   * @param {Function}          opts.onTarget       - called with NPC or null when target changes
   */
  constructor({ canvas, camera, world, movementSystem, npcs, onTarget }) {
    this.canvas          = canvas;
    this.camera          = camera;
    this.world           = world;
    this.movementSystem  = movementSystem;
    this.npcs            = npcs;
    this.onTarget        = onTarget ?? (() => {});

    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("pointerdown", (e) => this._onPointerDown(e));
  }

  _onPointerDown(e) {
    const tile = this._eventToWorldTile(e);

    // ── RIGHT CLICK → move ──────────────────────────────────────────
    if (e.button === 2) {
      let target = tile;
      const tileId = this.world.getTile(tile.x, tile.y);
      if (!isWalkable(tileId)) {
        try { target = findNearestWalkable(this.world, tile.x, tile.y, 6); }
        catch { return; }
      }
      this.movementSystem.setTarget(target.x, target.y);
      return;
    }

    // ── LEFT CLICK → target ─────────────────────────────────────────
    if (e.button === 0) {
      // Hit-test NPCs — find one whose tile matches the clicked tile
      const hit = this.npcs.find(
        n => !n.dead && n.x === tile.x && n.y === tile.y
      );

      if (hit) {
        this.onTarget(hit);       // Engine stores current target
      } else {
        this.onTarget(null);      // clicked empty tile — clear target
      }
    }
  }

  _eventToWorldTile(e) {
    const rect   = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width  / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const px     = (e.clientX - rect.left) * scaleX;
    const py     = (e.clientY - rect.top)  * scaleY;
    return this.camera.screenToWorld(px, py);
  }
}
