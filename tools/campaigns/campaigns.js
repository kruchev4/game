import { OVERWORLD_DEFS } from "../world/overworldDefs.js";
import { generateOverworldTiles, WORLD_WIDTH, WORLD_HEIGHT } from "../world/overworldGenerator.js";
import { saveWorld } from "../campaign/persistence/saveDungeon.js";

import { generateCampaign } from "../campaign/generator/generateCampaign.js";

document.getElementById("generate").addEventListener("click", async () => {
  const seed = document.getElementById("seed").value;

  await generateCampaign(seed);

  alert("Campaign and overworlds generated!");
});

/**
 * Generate and persist all overworlds (center + 8 neighbors)
 * using a shared campaign seed.
 */
export async function generateOverworlds(seed) {
  for (const [id, def] of Object.entries(OVERWORLD_DEFS)) {
    const tiles = generateOverworldTiles({
      biomeKey: def.biome,
      seed: `${seed}:${id}`, // deterministic per-world
    });

    await saveWorld({
      id,
      name: id.replace("overworld_", "").toUpperCase(),
      type: "world",
      width: WORLD_WIDTH,
      height: WORLD_HEIGHT,
      biome: def.biome,
      dx: def.dx,
      dy: def.dy,
      tiles,
      npcs: [],
      meta: {
        generatedBy: "overworldGenerator",
        seed,
      },
    });
  }
}
