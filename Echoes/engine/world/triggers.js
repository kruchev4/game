import { loadMap } from "../supabase/mapLoader.js";
import { GameState } from "../state/GameState.js";

export async function checkTileTriggers(x, y) {
  const map = GameState.activeMap;

  // Towns
  const town = map.towns.find(t => Math.abs(t.x - x) <= 1 && Math.abs(t.y - y) <= 1);
  if (town) return enterTown(town);

  // Portals
  const portal = map.portals.find(p => p.x === x && p.y === y);
  if (portal) {
    GameState.activeMap = await loadMap(portal.target_map);
    GameState.player.x = portal.spawnX ?? 5;
    GameState.player.y = portal.spawnY ?? 5;
    return;
  }
}