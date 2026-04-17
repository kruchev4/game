/**
 * db/sync.js
 *
 * Pulls spawn_groups and spawn_group_monsters from Supabase
 * and saves them into the local SQLite database.
 *
 * Run whenever spawn camps change in Supabase:
 *   node db/sync.js
 *
 * Safe to re-run — clears and re-inserts spawn data each time.
 * Monster definitions are NOT touched (managed by seed.js).
 */

require("dotenv").config();
const Database = require("better-sqlite3");
const path     = require("path");

const DB_PATH       = path.join(__dirname, "roe_server.db");
const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("[Sync] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

async function sbFetch(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      "apikey":        SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Accept":        "application/json"
    }
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  console.log("[Sync] Connecting to Supabase...");

  // ── Fetch from Supabase ──────────────────────────────────────────────────
  const [groups, members] = await Promise.all([
    sbFetch("spawn_groups?select=*&order=world_id"),
    sbFetch("spawn_group_monsters?select=*")
  ]);

  console.log(`[Sync] Fetched ${groups.length} spawn groups, ${members.length} monsters`);

  // ── Write to local DB ────────────────────────────────────────────────────
  const db = new Database(DB_PATH);
  db.pragma("foreign_keys = ON");

  const insertGroup = db.prepare(`
    INSERT OR REPLACE INTO spawn_groups
      (id, world_id, name, kind, respawn_seconds, enabled)
    VALUES
      (@id, @world_id, @name, @kind, @respawn_seconds, @enabled)
  `);

  const insertMember = db.prepare(`
    INSERT OR REPLACE INTO spawn_group_monsters
      (id, spawn_group_id, monster_id, x, y, is_boss, roam_radius)
    VALUES
      (@id, @spawn_group_id, @monster_id, @x, @y, @is_boss, @roam_radius)
  `);

  const sync = db.transaction(() => {
    // Clear existing spawn data
    db.prepare("DELETE FROM spawn_group_monsters").run();
    db.prepare("DELETE FROM spawn_groups").run();

    let groupCount  = 0;
    let memberCount = 0;

    for (const g of groups) {
      insertGroup.run({
        id:              g.id,
        world_id:        g.world_id,
        name:            g.name,
        kind:            g.kind            ?? "static",
        respawn_seconds: g.respawn_seconds ?? null,
        enabled:         g.enabled ? 1 : 0
      });
      groupCount++;
    }

    for (const m of members) {
      // Skip if monster_id not in our local monsters table
      const monsterExists = db.prepare(
        "SELECT 1 FROM monsters WHERE id = ?"
      ).get(m.monster_id);

      if (!monsterExists) {
        console.warn(`[Sync] Skipping unknown monster_id: ${m.monster_id}`);
        continue;
      }

      insertMember.run({
        id:             m.id,
        spawn_group_id: m.spawn_group_id,
        monster_id:     m.monster_id,
        x:              m.x,
        y:              m.y,
        is_boss:        m.is_boss ? 1 : 0,
        roam_radius:    m.roam_radius ?? null
      });
      memberCount++;
    }

    console.log(`[Sync] Inserted ${groupCount} spawn groups, ${memberCount} monsters`);
  });

  sync();

  // ── Summary by world ─────────────────────────────────────────────────────
  const worlds = db.prepare(`
    SELECT sg.world_id, COUNT(DISTINCT sg.id) as groups, COUNT(sgm.id) as monsters
    FROM spawn_groups sg
    LEFT JOIN spawn_group_monsters sgm ON sgm.spawn_group_id = sg.id
    GROUP BY sg.world_id
  `).all();

  console.log("\n[Sync] Spawn data by world:");
  for (const w of worlds) {
    console.log(`  ${w.world_id}: ${w.groups} groups, ${w.monsters} monsters`);
  }

  db.close();
  console.log("\n[Sync] Done — local DB is up to date");
}

main().catch(e => {
  console.error("[Sync] Failed:", e.message);
  process.exit(1);
});