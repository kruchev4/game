export class SaveManager {
  constructor(engine) {
    this.engine = engine;
    this.autoSaveTick = 0;
    this.autoSaveInterval = 18000; // ~5 min at 60fps
  }

  /**
   * Build a save data object from current game state.
   */
  getSaveData() {
    const { player, world, _playerClassId } = this.engine;
    return {
      name:          player.name          ?? "Hero",
      classId:       player.classId       ?? _playerClassId,
      stats:         player.stats         ?? {},
      hp:            Math.ceil(player.hp  ?? player.maxHp),
      position: {
        worldId: world?.id ?? "overworld_C",
        x:       Math.round(player.x),
        y:       Math.round(player.y)
      },
      gold:          player.gold          ?? 0,
      xp:            player.xp            ?? 0,
      level:         player.level         ?? 1,
      bag:           player.bag           ?? [],
      equipment:     player.equipment     ?? {},
      quickSlots:    player.quickSlots    ?? [],
      learnedSkills: player.learnedSkills ?? {},
      abilities:     player.abilities     ?? [],
      inventory:     []
    };
  }

  /**
   * Persist current state to the assigned save slot.
   * @param {boolean} silent - If true, skips logging to the combat log (used for autosaves)
   */
  async save(silent = false) {
    const { saveProvider, saveSlot, combatLog } = this.engine;
    if (!saveProvider || !saveSlot) return;

    try {
      await saveProvider.save(saveSlot, this.getSaveData());
      if (!silent) {
        combatLog?.push({ text: "Game saved.", type: "system" });
      }
    } catch (e) {
      if (!silent) {
        console.error("[SaveManager] Save failed:", e);
      } else {
        console.warn("[SaveManager] Auto-save failed:", e.message);
      }
    }
  }

  /**
   * Tick the autosave timer. Should be called inside the main game loop.
   */
  tick() {
    this.autoSaveTick++;
    if (this.autoSaveTick >= this.autoSaveInterval) {
      this.autoSaveTick = 0;
      this.save(true); // true = silent save
    }
  }
}
