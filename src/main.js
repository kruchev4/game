/**
 * main.js — Entry point. Self-executes on load.
 *
 * Flow:
 *   ScreenManager (character select + creation HTML overlay)
 *     ├─ Play saved char  → Engine
 *     └─ Create new char  → auto-save → Engine
 */

import { Engine }                    from "./core/Engine.js";
import { Renderer }                  from "./render/Renderer.js";
import { SupabaseOverworldProvider } from "./adapters/SupabaseOverworldProvider.js";
import { SaveProvider }              from "./adapters/SaveProvider.js";
import { ScreenManager }             from "./ui/ScreenManager.js";

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

    // ── Launch engine ──────────────────────────────────────────────────
    async function launchGame(config, saveSlot) {
  const engine = new Engine({ worldProvider, renderer });

  const {
    serverUrl,
    name,
    raceId,
    classId,
    stats
  } = config;

  engine.saveSlot     = saveSlot;
  engine.saveProvider = saveProvider;
  engine.onQuitToTitle = () => showScreens();

  // ── Load world & player ─────────────────────────────────────────
  await engine.loadWorld(WORLD_ID, {
    name,
    raceId,
    classId,
    stats
  });

  // ── Multiplayer setup (AFTER player exists) ─────────────────────
  if (serverUrl) {
    engine.multiplayer = new MultiplayerSystem({
      serverUrl,
      player:      engine.player,
      worldId:     WORLD_ID,
      playerToken: engine.playerToken,

      onPlayerJoin:   (entity) => engine.addRemotePlayer?.(entity),
      onPlayerLeave:  (token)  => engine.removeRemotePlayer?.(token),
      onPlayerUpdate: (entity) => engine.updateRemotePlayer?.(entity),

      onNPCDamaged:      (data) => engine.onNPCDamaged?.(data),
      onNPCKilled:       (data) => engine.onNPCKilled?.(data),
      onNPCState:        (npcs) => engine.onNPCState?.(npcs),
      onNPCAttackPlayer: (data) => engine.onNPCAttackPlayer?.(data)
    });

    engine.multiplayer.join();
  } else {
    console.warn("[MP] No serverUrl provided — running in solo mode");
  }

  engine.start();
  window.engine = engine;
}

    // ── Show pre-game screens ──────────────────────────────────────────
    async function showScreens() {
      // Always reload slots fresh — reflects any saves made during gameplay
      const slots = await saveProvider.loadAll();

      const mgr = new ScreenManager({ slots, saveProvider, classes, abilities });

      // Load existing character
      mgr.onPlay = async (slotIndex, saveData) => {
        await launchGame({
          name:    saveData.name,
          raceId:  saveData.raceId,
          classId: saveData.classId,
          stats:   saveData.stats,
          serverUrl: selectedServer.ws_url
        }, slotIndex + 1);
      };

      // New character confirmed — save then launch
      mgr.onCreate = async (slotIndex, character) => {
        
      // 1) Discover available servers
        const servers = await fetchAvailableServers();

        if (!servers.length) {
        alert("No multiplayer servers are currently online.");
        return;
     }

  // 2) Select server (same rule as onPlay)
       const selectedServer = servers[0];

        await saveProvider.save(slotIndex + 1, {
          ...character,
          position:  { worldId: WORLD_ID, x: null, y: null },
          gold:      50,
          xp:        0,
          inventory: []
        });
        await launchGame(character, slotIndex + 1);
      };

      mgr.show();
    }

    showScreens();

  } catch (e) {
    console.error("[Realm of Echoes] Startup error:", e);

    const canvas = document.getElementById("game");
    if (canvas) {
      const ctx     = canvas.getContext("2d");
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
