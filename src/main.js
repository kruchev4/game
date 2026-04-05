/**
 * main.js — Entry point
 *
 * Flow:
 *   TitleScreen (canvas)
 *     ├─ New  → CharacterCreation (HTML overlay, 4 steps) → SlotPicker → Engine
 *     └─ Load → SlotPicker → Engine
 */

import { Engine }                    from "./core/Engine.js";
import { Renderer }                  from "./render/Renderer.js";
import { SupabaseOverworldProvider } from "./adapters/SupabaseOverworldProvider.js";
import { SaveProvider }              from "./adapters/SaveProvider.js";
import { TitleScreen }               from "./ui/TitleScreen.js";
import { SlotPicker }                from "./ui/SlotPicker.js";
import { CharacterCreation }         from "./ui/CharacterCreation.js";

const WORLD_ID = "overworld_C";

export async function start(canvas) {
  const renderer      = new Renderer(canvas);
  const worldProvider = new SupabaseOverworldProvider();
  const saveProvider  = new SaveProvider();

  // Load data files once — shared across all screens
  const [abilitiesRes, classesRes] = await Promise.all([
    fetch("./src/data/abilities.json"),
    fetch("./src/data/classes.json")
  ]);
  const abilities = await abilitiesRes.json();
  const classes   = await classesRes.json();

  // Load save slots upfront so title screen knows if Load is available
  const slots    = await saveProvider.loadAll();
  const hasSaves = slots.some(s => s !== null);

  // ── Launch engine with confirmed character ─────────────────────────────
  async function launchGame(character, saveSlot) {
    const engine        = new Engine({ worldProvider, renderer });
    engine.saveSlot     = saveSlot;
    engine.saveProvider = saveProvider;

    await engine.loadWorld(WORLD_ID, character);
    engine.start();
    window.engine = engine;
  }

  // ── After character creation: pick a slot to save into ────────────────
  function showSaveSlotPickerForNew(character) {
    // Refresh slots so any recent changes show
    const picker = new SlotPicker({ canvas, slots, saveProvider });

    picker.onLoad = async (slotIndex, _existing) => {
      // Save new character data into this slot
      await saveProvider.save(slotIndex + 1, {
        name:      character.name,
        raceId:    character.raceId,
        classId:   character.classId,
        stats:     character.stats,
        position:  { worldId: WORLD_ID, x: null, y: null },
        gold:      0,
        inventory: []
      });
      slots[slotIndex] = { name: character.name, classId: character.classId };
      await launchGame(character, slotIndex + 1);
    };

    picker.onBack = () => showCharacterCreation();
    picker.show();
  }

  // ── Character creation (HTML overlay, 4 steps) ─────────────────────────
  function showCharacterCreation() {
    const creation = new CharacterCreation({ canvas, classes, abilities });

    creation.onConfirm = ({ name, raceId, classId, stats }) => {
      showSaveSlotPickerForNew({ name, raceId, classId, stats });
    };

    creation.show();
  }

  // ── Slot picker in load mode ───────────────────────────────────────────
  function showLoadPicker() {
    const picker = new SlotPicker({ canvas, slots, saveProvider });

    picker.onLoad = async (slotIndex, saveData) => {
      const character = {
        name:    saveData.name,
        raceId:  saveData.raceId,
        classId: saveData.classId,
        stats:   saveData.stats
      };
      await launchGame(character, slotIndex + 1);
    };

    picker.onBack = () => showTitle();
    picker.show();
  }

  // ── Title screen (canvas) ──────────────────────────────────────────────
  function showTitle() {
    const title = new TitleScreen({ canvas, hasSaves });
    title.onNew  = () => showCharacterCreation();
    title.onLoad = () => showLoadPicker();
    title.show();
  }

  showTitle();
}
