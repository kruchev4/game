/**
 * main.js — Entry point. Self-executes on load.
 *
 * Flow:
 *   TitleScreen (shows saved characters + New Character button)
 *     ├─ Play [saved char] → Engine
 *     └─ New Character     → CharacterCreation → save → Engine
 */

import { Engine }                    from "./core/Engine.js";
import { Renderer }                  from "./render/Renderer.js";
import { SupabaseOverworldProvider } from "./adapters/SupabaseOverworldProvider.js";
import { SaveProvider }              from "./adapters/SaveProvider.js";
import { TitleScreen }               from "./ui/TitleScreen.js";
import { CharacterCreation }         from "./ui/CharacterCreation.js";

const WORLD_ID = "overworld_C";

async function start() {
  try {
    const canvas = document.getElementById("game");
    if (!canvas) throw new Error("Canvas #game not found");

    const renderer      = new Renderer(canvas);
    const worldProvider = new SupabaseOverworldProvider();
    const saveProvider  = new SaveProvider();

    // Load data files once
    const [abilitiesRes, classesRes] = await Promise.all([
      fetch("./src/data/abilities.json"),
      fetch("./src/data/classes.json")
    ]);

    if (!abilitiesRes.ok) throw new Error(`Failed to load abilities.json: ${abilitiesRes.status}`);
    if (!classesRes.ok)   throw new Error(`Failed to load classes.json: ${classesRes.status}`);

    const abilities = await abilitiesRes.json();
    const classes   = await classesRes.json();

    // Load save slots once — mutated in place as characters are saved/deleted
    const slots = await saveProvider.loadAll();

    // ── Launch engine ──────────────────────────────────────────────────
    async function launchGame(character, saveSlot) {
      const engine        = new Engine({ worldProvider, renderer });
      engine.saveSlot     = saveSlot;
      engine.saveProvider = saveProvider;

      // Return to title screen if player quits after death
      engine.onQuitToTitle = () => showTitle();

      await engine.loadWorld(WORLD_ID, character);
      engine.start();
      window.engine = engine;
    }

    // ── Title screen ───────────────────────────────────────────────────
    function showTitle() {
      const title = new TitleScreen({ canvas, slots, saveProvider });

      // Load existing character
      title.onLoad = async (slotIndex, saveData) => {
        await launchGame({
          name:    saveData.name,
          raceId:  saveData.raceId,
          classId: saveData.classId,
          stats:   saveData.stats
        }, slotIndex + 1);
      };

      // New character — slotIndex is the first free slot
      title.onNew = (slotIndex) => {
        showCharacterCreation(slotIndex);
      };

      title.show();
    }

    // ── Character creation ─────────────────────────────────────────────
    function showCharacterCreation(slotIndex) {
      const creation = new CharacterCreation({ canvas, classes, abilities });

      creation.onConfirm = async ({ name, raceId, classId, stats }) => {
        const character = { name, raceId, classId, stats };

        // Save immediately into the assigned slot
        await saveProvider.save(slotIndex + 1, {
          ...character,
          position:  { worldId: WORLD_ID, x: null, y: null },
          gold:      0,
          inventory: []
        });

        // Update local slots array so title screen reflects new save
        slots[slotIndex] = { name, raceId, classId, stats };

        await launchGame(character, slotIndex + 1);
      };

      creation.show();
    }

    showTitle();

  } catch (e) {
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

start();
