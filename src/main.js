/**
 * main.js — Entry point
 *
 * Flow:
 *   TitleScreen
 *     ├─ New  → CharacterCreation → SlotPicker (pick slot to save into) → Engine
 *     └─ Load → SlotPicker (pick slot to load from) → Engine
 */

import { Engine }                  from "./core/Engine.js";
import { Renderer }                from "./render/Renderer.js";
import { SupabaseOverworldProvider } from "./adapters/SupabaseOverworldProvider.js";
import { SaveProvider }            from "./adapters/SaveProvider.js";
import { TitleScreen }             from "./ui/TitleScreen.js";
import { SlotPicker }              from "./ui/SlotPicker.js";
import { CharacterCreation }       from "./ui/CharacterCreation.js";

const WORLD_ID = "overworld_C";

export async function start(canvas) {
  const renderer      = new Renderer(canvas);
  const worldProvider = new SupabaseOverworldProvider();
  const saveProvider  = new SaveProvider();

  // Load data files once — reused across all screens
  const [abilitiesRes, classesRes] = await Promise.all([
    fetch("./src/data/abilities.json"),
    fetch("./src/data/classes.json")
  ]);
  const abilities = await abilitiesRes.json();
  const classes   = await classesRes.json();

  // Load save slots to know whether "Load" is available
  const slots    = await saveProvider.loadAll();
  const hasSaves = slots.some(s => s !== null);

  // ── Helper: launch the engine with character data ──────────────────────
  async function launchGame(character, saveSlot) {
    const engine = new Engine({ worldProvider, renderer });

    // Tell engine which slot to auto-save into on zone change
    engine.saveSlot     = saveSlot;
    engine.saveProvider = saveProvider;

    await engine.loadWorld(WORLD_ID, character);
    engine.start();
    window.engine = engine;
  }

  // ── Helper: show slot picker in "save-into" mode after new character ───
  function showSaveSlotPicker(character) {
    const picker = new SlotPicker({ canvas, slots, saveProvider });

    // In new-character mode, clicking a slot saves into it then launches
    picker.onLoad = async (slotIndex, _existingData) => {
      // Overwrite existing slot or fill empty — same action
      await saveProvider.save(slotIndex + 1, {
        name:      character.name,
        classId:   character.classId,
        stats:     character.stats,
        position:  { worldId: WORLD_ID, x: null, y: null },
        gold:      0,
        inventory: []
      });
      await launchGame(character, slotIndex + 1);
    };

    // Allow picking any slot including empty ones for new character
    // Override: show all slots as "pick to save into"
    picker._drawSlotLabel = (i) =>
      slots[i] ? "Overwrite" : `New — Slot ${i + 1}`;

    picker.onBack = () => showCharacterCreation();
    picker.show();
  }

  // ── Character creation ─────────────────────────────────────────────────
  function showCharacterCreation() {
    const creation = new CharacterCreation({ canvas, classes, abilities });

    creation.onConfirm = ({ name, classId, stats }) => {
      showSaveSlotPicker({ name, classId, stats });
    };

    creation.show();
  }

  // ── Slot picker in "load" mode ─────────────────────────────────────────
  function showLoadPicker() {
    const picker = new SlotPicker({ canvas, slots, saveProvider });

    picker.onLoad = async (slotIndex, saveData) => {
      const character = {
        name:    saveData.name,
        classId: saveData.classId,
        stats:   saveData.stats
      };
      await launchGame(character, slotIndex + 1);
    };

    picker.onBack = () => showTitle();
    picker.show();
  }

  // ── Title screen ───────────────────────────────────────────────────────
  function showTitle() {
    const title = new TitleScreen({ canvas, hasSaves });

    title.onNew  = () => showCharacterCreation();
    title.onLoad = () => showLoadPicker();
    title.show();
  }

  // ── Kick off ───────────────────────────────────────────────────────────
  showTitle();
}
