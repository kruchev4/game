/**
 * main.js — Entry point
 *
 * Flow:
 *   ScreenManager (character select + creation)
 *     ├─ Play saved char  → Engine
 *     └─ Create new char  → auto-save → Engine
 *
 * Multiplayer:
 *   - Fetches available servers from Supabase roe2_servers table
 *   - Player selects server (or plays offline if none available)
 *   - Engine connects via MultiplayerSystem
 */

import { Engine }                    from "./core/Engine.js";
import { Renderer }                  from "./render/Renderer.js";
import { SupabaseOverworldProvider } from "./adapters/SupabaseOverworldProvider.js";
import { SaveProvider }              from "./adapters/SaveProvider.js";
import { ScreenManager }             from "./ui/ScreenManager.js";
import { MultiplayerSystem }         from "./systems/MultiplayerSystem.js";
import { fetchAvailableServers }     from "./adapters/ServerDirectory.js";

const WORLD_ID = "overworld_C";

// ── Entry point ───────────────────────────────────────────────────────────

async function start() {
  try {
    const canvas = document.getElementById("game");
    if (!canvas) throw new Error("Canvas #game not found");

    const renderer      = new Renderer(canvas);
    const worldProvider = new SupabaseOverworldProvider();
    const saveProvider  = new SaveProvider();

    const [abilitiesRes, classesRes] = await Promise.all([
      fetch("./src/data/abilities.json"),
      fetch("./src/data/classes.json")
    ]);

    if (!abilitiesRes.ok) throw new Error(`Failed to load abilities.json: ${abilitiesRes.status}`);
    if (!classesRes.ok)   throw new Error(`Failed to load classes.json: ${classesRes.status}`);

    const abilities = await abilitiesRes.json();
    const classes   = await classesRes.json();

    // ── Launch engine ─────────────────────────────────────────────────────
    async function launchGame(character, saveSlot, serverUrl = null) {
      const engine = new Engine({ worldProvider, renderer });

      engine.saveSlot      = saveSlot;
      engine.saveProvider  = saveProvider;
      engine.serverUrl     = serverUrl;  // pass URL to engine before loadWorld
      engine.onQuitToTitle = () => showScreens();

      await engine.loadWorld(WORLD_ID, character);

      engine.start();
      window.engine = engine;
    }

    // ── Show pre-game screens ─────────────────────────────────────────────
    async function showScreens() {
      // Stop any running engine
      if (window.engine) {
        window.engine.running = false;
        window.engine.multiplayerSystem?.leave();
        window.engine = null;
      }

      const [slots, servers] = await Promise.all([
        saveProvider.loadAll(),
        fetchAvailableServers()
      ]);

      const mgr = new ScreenManager({
        slots,
        servers,
        saveProvider,
        classes,
        abilities
      });

      mgr.onPlay = async (slotIndex, saveData, serverUrl) => {
        await launchGame({
          name:          saveData.name,
          raceId:        saveData.raceId,
          classId:       saveData.classId,
          stats:         saveData.stats,
          gold:          saveData.gold,
          xp:            saveData.xp,
          level:         saveData.level,
          bag:           saveData.bag,
          equipment:     saveData.equipment,
          quickSlots:    saveData.quickSlots,
          learnedSkills: saveData.learnedSkills,
          abilities:     saveData.abilities,
          position:      saveData.position
        }, slotIndex + 1, serverUrl);
      };

      mgr.onCreate = async (slotIndex, character, serverUrl) => {
        await saveProvider.save(slotIndex + 1, {
          ...character,
          position:  { worldId: WORLD_ID, x: null, y: null },
          gold:      50,
          xp:        0,
          inventory: []
        });
        await launchGame(character, slotIndex + 1, serverUrl);
      };

      mgr.show();
    }

    await showScreens();

    // Keep cloud server warm — ping every 14 minutes to prevent Render spin-down
    setInterval(() => {
      fetch("https://realm-echoes-broker-2.onrender.com").catch(() => {});
    }, 14 * 60 * 1000);

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
