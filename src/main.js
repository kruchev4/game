/**
 * main.js — Entry point
 *
 * Loaded as a module from index.html. Self-executes immediately.
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

async function start() {
  try {
    const canvas = document.getElementById("game");
    if (!canvas) throw new Error("Canvas #game not found");

    const renderer      = new Renderer(canvas);
    const worldProvider = new SupabaseOverworldProvider();
    const saveProvider  = new SaveProvider();

    // Load data files once — shared across all screens
    const [abilitiesRes, classesRes] = await Promise.all([
      fetch("./src/data/abilities.json"),
      fetch("./src/data/classes.json")
    ]);

    if (!abilitiesRes.ok) throw new Error(`Failed to load abilities.json: ${abilitiesRes.status}`);
    if (!classesRes.ok)   throw new Error(`Failed to load classes.json: ${classesRes.status}`);

    const abilities = await abilitiesRes.json();
    const classes   = await classesRes.json();

    // Load save slots upfront so title screen knows if Load is available
    const slots    = await saveProvider.loadAll();
    const hasSaves = slots.some(s => s !== null);

    // ── Launch engine with confirmed character ───────────────────────────
    async function launchGame(character, saveSlot) {
      const engine        = new Engine({ worldProvider, renderer });
      engine.saveSlot     = saveSlot;
      engine.saveProvider = saveProvider;

      await engine.loadWorld(WORLD_ID, character);
      engine.start();
      window.engine = engine;
    }

    // ── After new character creation: pick a slot to save into ───────────
    function showSaveSlotPickerForNew(character) {
      const picker = new SlotPicker({ canvas, slots, saveProvider });

      picker.onLoad = async (slotIndex, _existing) => {
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

    // ── Character creation (HTML overlay, 4 steps) ───────────────────────
    function showCharacterCreation() {
      const creation = new CharacterCreation({ canvas, classes, abilities });

      creation.onConfirm = ({ name, raceId, classId, stats }) => {
        showSaveSlotPickerForNew({ name, raceId, classId, stats });
      };

      creation.show();
    }

    // ── Slot picker in load mode ─────────────────────────────────────────
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

    // ── Title screen (canvas) ────────────────────────────────────────────
    function showTitle() {
      const title = new TitleScreen({ canvas, hasSaves });
      title.onNew  = () => showCharacterCreation();
      title.onLoad = () => showLoadPicker();
      title.show();
    }

    showTitle();

  } catch (e) {
    // Surface any startup errors visibly
    console.error("[Realm of Echoes] Startup error:", e);

    const canvas = document.getElementById("game");
    if (canvas) {
      const ctx = canvas.getContext("2d");
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#cc4444";
      ctx.font      = "16px monospace";
      ctx.textAlign = "center";
      ctx.fillText("Startup error — check console", canvas.width / 2, canvas.height / 2);
      ctx.fillStyle = "#888";
      ctx.font      = "12px monospace";
      ctx.fillText(e.message, canvas.width / 2, canvas.height / 2 + 24);
    }
  }
}

// Self-execute when module loads
start();
