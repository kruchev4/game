// game/Echoes/engine/worldTransitions.js
import { loadWorld } from "../engine/supabase/worldLoader.js";
import { WORLD_NEIGHBORS } from "../world/worldNeighbors.js";

function syncMapGlobals(map) {
  window.MAP_W = map.width;
  window.MAP_H = map.height;

  if (window.worldMap) {
    window.worldMap.width  = map.width;
    window.worldMap.height = map.height;
  }
}

async function transitionWorldEdge(dir) {
  // Prefer window.GameState for reliability across script/module scopes
  const GS = window.GameState || GameState;

  const current = GS.currentWorldId || "overworld_C";
  const nextId = WORLD_NEIGHBORS[current]?.[dir];

  if (!nextId) return false;
  if (GS._transitioning) return true;

  GS._transitioning = true;

  try {
    // ✅ Load the next overworld from the WORLDS table (via bridged loader)
    const nextMap = await window.loadWorld(nextId);

    // ✅ Swap active map + world id
    GS.activeMap = nextMap;
    GS.currentWorldId = nextId;

    // ✅ Update globals used by renderer/minimap (if you rely on them elsewhere)
    window.MAP_W = nextMap.width;
    window.MAP_H = nextMap.height;
    if (window.worldMap) {
      window.worldMap.width = nextMap.width;
      window.worldMap.height = nextMap.height;
    }

    // ✅ Wrap player to opposite edge
    if (dir === "N")  { G.y = nextMap.height - 1; }
    if (dir === "S")  { G.y = 0; }
    if (dir === "W")  { G.x = nextMap.width - 1; }
    if (dir === "E")  { G.x = 0; }

    // (Optional diagonals if you ever add diagonal transitions)
    if (dir === "NW") { G.x = nextMap.width - 1; G.y = nextMap.height - 1; }
    if (dir === "NE") { G.x = 0;                G.y = nextMap.height - 1; }
    if (dir === "SW") { G.x = nextMap.width - 1; G.y = 0; }
    if (dir === "SE") { G.x = 0;                 G.y = 0; }

    GS.player = G;

    // Optional: feedback
    if (typeof addLog === "function") addLog(`You enter ${nextId.replace("overworld_", "")}.`);

    render();
    updateHUD();

    return true;
  } catch (e) {
    console.error("[transitionWorldEdge] failed:", e);
    if (typeof toast === "function") toast(`World transition failed: ${e.message}`, "err");
    return false;
  } finally {
    GS._transitioning = false;
  }
}

