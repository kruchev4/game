import { isWalkable } from "../world/isWalkable.js";
import { findNearestWalkable } from "../world/findNearestWalkable.js";

export class ClickToMoveSystem {
  constructor({ canvas, camera, world, movementSystem }) {
    this.canvas = canvas;
    this.camera = camera;
    this.world = world;
    this.movementSystem = movementSystem;

    // disable right-click menu (optional but nice)
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    this.canvas.addEventListener("pointerdown", (e) => {
      // right click cancels target
      if (e.button === 2) {
        this.movementSystem.clearTarget?.();
        return;
      }

      const { x, y } = this._eventToWorldTile(e);

      // if clicked tile is blocked, snap to nearest walkable within small radius
      let target = { x, y };
      const tileId = this.world.getTile(x, y);

      if (!isWalkable(tileId)) {
        try {
          target = findNearestWalkable(this.world, x, y, 6);
        } catch {
          return; // no valid target nearby
        }
      }

      this.movementSystem.setTarget(target.x, target.y);
    });
  }

  _eventToWorldTile(e) {
    // Convert CSS pixels → canvas pixels (handles DPR + resizing correctly)
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;

    return this.camera.screenToWorld(px, py);
  }
}
