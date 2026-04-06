// campaign/generator/generateCampaign.js
import { generateEightDungeons } from "./generateEightDungeons.js";
import { generateOverworlds } from "../../world/generateOverworlds.js";

export async function generateCampaign(seed) {
  // 1️⃣ Generate campaign dungeons
  const dungeons = generateEightDungeons(seed);

  // (optional) persist dungeons here
  // await saveDungeons(dungeons);

  // 2️⃣ Generate overworld grid
  await generateOverworlds(seed);

  return {
    seed,
    dungeons,
    overworldsGenerated: true
  };
}
``
