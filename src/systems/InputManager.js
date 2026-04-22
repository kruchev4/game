export class InputManager {
  constructor(engine) {
    this.engine = engine;
    this._bindInputs();
  }

  _bindInputs() {
    // ── KEYBOARD BINDINGS ──
    window.addEventListener("keydown", (e) => {
      const key = e.key.toLowerCase();

      // Ability slots 1-6
      const slot = parseInt(e.key) - 1;
      if (slot >= 0 && slot <= 5) { this.engine.actionManager.useAbilitySlot(slot); return; }

      // Quick slots 7-8
      if (slot >= 6 && slot <= 7) { this.engine.lootSystem?.useQuickSlot(slot - 6); return; }

      // UI Toggles
      if (key === "i") { this.engine.uiManager.inventoryWindow?.toggle(); return; }
      if (key === "c") { this.engine.uiManager.charSheet?.toggle(); return; }

      // Tab targeting
      if (e.key === "Tab") {
        e.preventDefault();
        this.engine.actionManager.cycleTarget();
        return;
      }

      // Cancel ground targeting (Volley)
      if (e.key === "Escape" && this.engine._groundTargeting) {
        e.preventDefault();
        const ab = this.engine._abilities[this.engine._groundTargeting.abilityId];
        const cost = ab?.cost?.mana ?? 0;
        this.engine.player.resource = Math.min(this.engine.player.maxResource, this.engine.player.resource + cost);
        this.engine._groundTargeting = null;
        this.engine.renderer.groundTargeting = null;
        this.engine.combatLog?.push({ text: "Volley cancelled.", type: "system" });
        return;
      }

      // Pause menu
      if (e.key === "Escape") {
        e.preventDefault();
        this.engine.uiManager.togglePauseMenu();
        return;
      }

      // Manual save — F5
      if (e.key === "F5") {
        e.preventDefault();
        this.engine.saveManager.save();
        return;
      }
    });

    // ── MOUSE WHEEL (ZOOM) ──
    this.engine.renderer.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta  = e.deltaY > 0 ? -this.engine.renderer.camera.zoomStep : this.engine.renderer.camera.zoomStep;
      const anchor = this.engine.renderer.camera.screenToWorld(e.offsetX, e.offsetY);
      this.engine.renderer.camera.zoom(delta, anchor.x, anchor.y, this.engine.renderer);

      if (this.engine.world) {
        this.engine.renderer.camera.centerOn(this.engine.player.x, this.engine.player.y, this.engine.world);
      }
    }, { passive: false });

    // ── MOUSE MOVEMENT (GROUND TARGETING) ──
    this.engine.renderer.canvas.addEventListener("pointermove", (e) => {
      if (!this.engine._groundTargeting) return;
      const rect   = this.engine.renderer.canvas.getBoundingClientRect();
      const scaleX = this.engine.renderer.canvas.width  / rect.width;
      const scaleY = this.engine.renderer.canvas.height / rect.height;
      const px = (e.clientX - rect.left) * scaleX;
      const py = (e.clientY - rect.top)  * scaleY;
      this.engine.renderer.groundTargetingMouse = { px, py };
    });

    // ── MOUSE CLICKS ──
    this.engine.renderer.canvas.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;

      const rect   = this.engine.renderer.canvas.getBoundingClientRect();
      const scaleX = this.engine.renderer.canvas.width  / rect.width;
      const scaleY = this.engine.renderer.canvas.height / rect.height;
      const px     = (e.clientX - rect.left) * scaleX;
      const py     = (e.clientY - rect.top)  * scaleY;

      // Ground targeting mode — place Volley on click
      if (this.engine._groundTargeting) {
        const worldTileGT = this.engine.renderer.camera.screenToWorld(px, py);
        const dx = worldTileGT.x - this.engine.player.x;
        const dy = worldTileGT.y - this.engine.player.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist <= this.engine._groundTargeting.range) {
          this.engine._groundTargeting.onPlace(worldTileGT.x, worldTileGT.y);
        } else {
          this.engine.combatLog?.push({ text: "Out of range!", type: "system" });
        }
        return;
      }

      // Pause menu intercepts all clicks when open
      if (this.engine._paused) {
        this.engine.uiManager.handlePauseMenuClick(px, py);
        return;
      }

      // UI Overlays: Ability bar, Quick slots, Bag icon
      const abilitySlot = this.engine.renderer.getAbilitySlotAt(px, py);
      if (abilitySlot >= 0) { this.engine.actionManager.useAbilitySlot(abilitySlot); return; }

      const quickSlot = this.engine.renderer.getQuickSlotAt(px, py);
      if (quickSlot >= 0) { this.engine.lootSystem?.useQuickSlot(quickSlot); return; }

      if (this.engine.renderer.getBagIconHit(px, py)) {
        this.engine.uiManager.inventoryWindow?.toggle();
        return;
      }

      // Convert screen to world tile — used by all remaining checks
      const worldTile = this.engine.renderer.camera.screenToWorld(px, py);

      // Town NPC click
      if (this.engine.townSystem) {
        const hit = this.engine.townSystem.handleClick(worldTile.x, worldTile.y);
        if (hit) return;
      }

      // Town + dungeon portal clicks
      if (!this.engine.townSystem && this.engine.world?.type !== "town") {
        const towns   = this.engine.world?._raw?.towns   ?? this.engine.world?.towns   ?? [];
        const portals = this.engine.world?._raw?.portals ?? this.engine.world?.portals ?? [];

        const clickedTown = towns.find(t => Math.abs(t.x - worldTile.x) <= 2 && Math.abs(t.y - worldTile.y) <= 2);
        if (clickedTown) {
          const townId = clickedTown.worldId ?? "town_" + clickedTown.name.toLowerCase().replace(/\s+/g, "_");
          this.engine._transitionToWorld({
            targetWorld: townId,
            entryX: clickedTown.entryX ?? null,
            entryY: clickedTown.entryY ?? null,
            returnWorld: this.engine._currentWorldId,
            returnX: clickedTown.x,
            returnY: clickedTown.y
          });
          return;
        }

        const clickedPortal = portals.find(p => Math.abs(p.x - worldTile.x) <= 2 && Math.abs(p.y - worldTile.y) <= 2);
        if (clickedPortal) {
          this.engine._transitionToWorld({
            targetWorld: clickedPortal.campaignId,
            entryX: clickedPortal.entryX ?? null,
            entryY: clickedPortal.entryY ?? null,
            returnWorld: this.engine._currentWorldId,
            returnX: clickedPortal.x,
            returnY: clickedPortal.y
          });
          return;
        }
      }

      // Friendly player click — target the player
      if (this.engine.player.x === worldTile.x && this.engine.player.y === worldTile.y) {
        this.engine.actionManager.setTarget(this.engine.player);
        return;
      }

      // Remote players - Exact tile only
      const otherPlayer = this.engine.multiplayerSystem?.getRemotePlayers() ?? [];
      const clickedPlayer = otherPlayer.find(p => p.x === worldTile.x && p.y === worldTile.y);
      if (clickedPlayer) {
        this.engine.actionManager.setTarget(clickedPlayer);
        return;
      }

      // NPC click — target the NPC
      const clickedNPC = this.engine.npcs.find(n => !n.dead && Math.abs(n.x - worldTile.x) <= 1 && Math.abs(n.y - worldTile.y) <= 1);
      if (clickedNPC) {
        this.engine.actionManager.setTarget(clickedNPC);
        return;
      }

      // Corpse click
      const corpse = this.engine.lootSystem?.corpses.find(c => c.x === worldTile.x && c.y === worldTile.y);
      if (corpse) {
        this.engine.uiManager.openLootWindow(corpse);
        return;
      }
      this.engine.actionManager.setTarget(null);
    });
  }
}
