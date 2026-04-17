/**
 * db/seed.js
 * 
 * Creates the local SQLite database and seeds it with all game data.
 * Run once: node db/seed.js
 * Re-run anytime to reset to clean state.
 */

const Database = require("better-sqlite3");
const fs       = require("fs");
const path     = require("path");

const DB_PATH     = path.join(__dirname, "roe_server.db");
const SCHEMA_PATH = path.join(__dirname, "schema.sql");

// ── Create DB ─────────────────────────────────────────────────────────────
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Apply schema
const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
db.exec(schema);

console.log("[Seed] Schema applied");

// ── Clear existing data ───────────────────────────────────────────────────
db.exec(`
  DELETE FROM monster_loot;
  DELETE FROM loot_entries;
  DELETE FROM loot_tables;
  DELETE FROM spawn_group_monsters;
  DELETE FROM spawn_groups;
  DELETE FROM monsters;
  DELETE FROM abilities;
`);

// ── Monsters ──────────────────────────────────────────────────────────────
const insertMonster = db.prepare(`
  INSERT INTO monsters (id, name, icon, hp, damage_min, damage_max, speed, perception, roam_radius, attack_range, xp_value, is_boss)
  VALUES (@id, @name, @icon, @hp, @damage_min, @damage_max, @speed, @perception, @roam_radius, @attack_range, @xp_value, @is_boss)
`);

const monsters = [
  { id:"goblinMelee",  name:"Goblin Warrior", icon:"👺", hp:30,  damage_min:4,  damage_max:9,  speed:3, perception:7,  roam_radius:4, attack_range:1, xp_value:25,  is_boss:0 },
  { id:"goblinArcher", name:"Goblin Archer",  icon:"🏹", hp:22,  damage_min:5,  damage_max:10, speed:2, perception:8,  roam_radius:4, attack_range:6, xp_value:28,  is_boss:0 },
  { id:"zombie",       name:"Zombie",         icon:"🧟", hp:35,  damage_min:5,  damage_max:10, speed:2, perception:5,  roam_radius:3, attack_range:1, xp_value:30,  is_boss:0 },
  { id:"skeleton",     name:"Skeleton",       icon:"💀", hp:25,  damage_min:4,  damage_max:9,  speed:3, perception:7,  roam_radius:4, attack_range:1, xp_value:28,  is_boss:0 },
  { id:"wraith",       name:"Wraith",         icon:"👻", hp:28,  damage_min:6,  damage_max:12, speed:4, perception:8,  roam_radius:4, attack_range:4, xp_value:40,  is_boss:0 },
  { id:"necromancer",  name:"Necromancer",    icon:"🧙", hp:22,  damage_min:8,  damage_max:16, speed:2, perception:9,  roam_radius:3, attack_range:6, xp_value:60,  is_boss:0 },
  { id:"lich",         name:"Lich",           icon:"💀", hp:200, damage_min:18, damage_max:28, speed:2, perception:10, roam_radius:2, attack_range:5, xp_value:300, is_boss:1 },
];

const seedMonsters = db.transaction(() => {
  for (const m of monsters) insertMonster.run(m);
});
seedMonsters();
console.log(`[Seed] ${monsters.length} monsters inserted`);

// ── Abilities ─────────────────────────────────────────────────────────────
const insertAbility = db.prepare(`
  INSERT INTO abilities (id, name, class_id, type, damage_min, damage_max, range, cooldown, targets, heal_min, heal_max, description)
  VALUES (@id, @name, @class_id, @type, @damage_min, @damage_max, @range, @cooldown, @targets, @heal_min, @heal_max, @description)
`);

const abilities = [
  // Fighter
  { id:"slash",        name:"Slash",         class_id:"fighter", type:"melee",  damage_min:8,  damage_max:14, range:1, cooldown:40,  targets:1, heal_min:0, heal_max:0,  description:"A quick melee strike." },
  { id:"shieldBash",   name:"Shield Bash",   class_id:"fighter", type:"melee",  damage_min:6,  damage_max:10, range:1, cooldown:80,  targets:1, heal_min:0, heal_max:0,  description:"Stuns the target briefly." },
  { id:"whirlwind",    name:"Whirlwind",     class_id:"fighter", type:"aoe",    damage_min:10, damage_max:16, range:1, cooldown:120, targets:4, heal_min:0, heal_max:0,  description:"Hits all adjacent enemies." },
  { id:"taunt",        name:"Taunt",         class_id:"fighter", type:"taunt",  damage_min:0,  damage_max:0,  range:6, cooldown:180, targets:0, heal_min:0, heal_max:0,  description:"Forces all nearby enemies to target you." },
  // Ranger
  { id:"shoot",        name:"Shoot",         class_id:"ranger",  type:"ranged", damage_min:7,  damage_max:12, range:8, cooldown:35,  targets:1, heal_min:0, heal_max:0,  description:"A precise arrow shot." },
  { id:"multishot",    name:"Multishot",     class_id:"ranger",  type:"ranged", damage_min:5,  damage_max:9,  range:8, cooldown:100, targets:3, heal_min:0, heal_max:0,  description:"Fires 3 arrows hitting up to 3 targets." },
  { id:"aimedShot",    name:"Aimed Shot",    class_id:"ranger",  type:"ranged", damage_min:18, damage_max:28, range:10,cooldown:160, targets:1, heal_min:0, heal_max:0,  description:"High damage single target shot." },
  { id:"volley",       name:"Volley",        class_id:"ranger",  type:"aoe",    damage_min:4,  damage_max:7,  range:8, cooldown:200, targets:6, heal_min:0, heal_max:0,  description:"Rains arrows on all enemies in range." },
  // Paladin
  { id:"holyStrike",   name:"Holy Strike",   class_id:"paladin", type:"melee",  damage_min:9,  damage_max:15, range:1, cooldown:45,  targets:1, heal_min:0, heal_max:0,  description:"A melee strike infused with holy light." },
  { id:"heal",         name:"Heal",          class_id:"paladin", type:"heal",   damage_min:0,  damage_max:0,  range:5, cooldown:80,  targets:1, heal_min:20,heal_max:35, description:"Heals a nearby ally." },
  { id:"divineShield", name:"Divine Shield", class_id:"paladin", type:"buff",   damage_min:0,  damage_max:0,  range:0, cooldown:300, targets:1, heal_min:0, heal_max:0,  description:"Grants brief invulnerability." },
  { id:"consecrate",   name:"Consecrate",    class_id:"paladin", type:"aoe",    damage_min:5,  damage_max:10, range:3, cooldown:150, targets:8, heal_min:0, heal_max:0,  description:"Damages all enemies in a holy circle around you." },
  { id:"resurrection", name:"Resurrection",  class_id:"paladin", type:"rez",    damage_min:0,  damage_max:0,  range:5, cooldown:600, targets:1, heal_min:50,heal_max:50, description:"Brings a fallen ally back to life." },
];

const seedAbilities = db.transaction(() => {
  for (const a of abilities) insertAbility.run(a);
});
seedAbilities();
console.log(`[Seed] ${abilities.length} abilities inserted`);

// ── Loot tables ───────────────────────────────────────────────────────────
const insertLootTable = db.prepare(`INSERT INTO loot_tables (id, name) VALUES (@id, @name)`);
const insertLootEntry = db.prepare(`
  INSERT INTO loot_entries (id, loot_table_id, item_id, weight, qty_min, qty_max, gold_min, gold_max)
  VALUES (@id, @loot_table_id, @item_id, @weight, @qty_min, @qty_max, @gold_min, @gold_max)
`);
const insertMonsterLoot = db.prepare(`
  INSERT INTO monster_loot (monster_id, loot_table_id) VALUES (@monster_id, @loot_table_id)
`);

const lootTables = [
  { id: "loot_goblin",      name: "Goblin Loot" },
  { id: "loot_undead",      name: "Undead Loot" },
  { id: "loot_boss_undead", name: "Boss Undead Loot" },
];

const lootEntries = [
  // Goblin loot
  { id:"le_001", loot_table_id:"loot_goblin",      item_id:"gold",          weight:5, qty_min:1, qty_max:1,  gold_min:3,  gold_max:12 },
  { id:"le_002", loot_table_id:"loot_goblin",      item_id:"health_potion", weight:2, qty_min:1, qty_max:1,  gold_min:0,  gold_max:0  },
  { id:"le_003", loot_table_id:"loot_goblin",      item_id:"nothing",       weight:3, qty_min:0, qty_max:0,  gold_min:0,  gold_max:0  },
  // Undead loot
  { id:"le_004", loot_table_id:"loot_undead",      item_id:"gold",          weight:4, qty_min:1, qty_max:1,  gold_min:5,  gold_max:20 },
  { id:"le_005", loot_table_id:"loot_undead",      item_id:"health_potion", weight:2, qty_min:1, qty_max:2,  gold_min:0,  gold_max:0  },
  { id:"le_006", loot_table_id:"loot_undead",      item_id:"nothing",       weight:4, qty_min:0, qty_max:0,  gold_min:0,  gold_max:0  },
  // Boss loot
  { id:"le_007", loot_table_id:"loot_boss_undead", item_id:"gold",          weight:1, qty_min:1, qty_max:1,  gold_min:50, gold_max:150 },
  { id:"le_008", loot_table_id:"loot_boss_undead", item_id:"health_potion", weight:1, qty_min:2, qty_max:4,  gold_min:0,  gold_max:0   },
];

const monsterLootLinks = [
  { monster_id:"goblinMelee",  loot_table_id:"loot_goblin"      },
  { monster_id:"goblinArcher", loot_table_id:"loot_goblin"      },
  { monster_id:"zombie",       loot_table_id:"loot_undead"      },
  { monster_id:"skeleton",     loot_table_id:"loot_undead"      },
  { monster_id:"wraith",       loot_table_id:"loot_undead"      },
  { monster_id:"necromancer",  loot_table_id:"loot_undead"      },
  { monster_id:"lich",         loot_table_id:"loot_boss_undead" },
];

const seedLoot = db.transaction(() => {
  for (const t of lootTables)      insertLootTable.run(t);
  for (const e of lootEntries)     insertLootEntry.run(e);
  for (const l of monsterLootLinks) insertMonsterLoot.run(l);
});
seedLoot();
console.log(`[Seed] ${lootTables.length} loot tables, ${lootEntries.length} entries, ${monsterLootLinks.length} monster links`);


// ── Spawn Groups ──────────────────────────────────────────────────────────
const insertSpawnGroup = db.prepare(`
  INSERT OR REPLACE INTO spawn_groups (id, world_id, name, kind, respawn_seconds, enabled)
  VALUES (@id, @world_id, @name, @kind, @respawn_seconds, @enabled)
`);

const insertSpawnMember = db.prepare(`
  INSERT OR REPLACE INTO spawn_group_monsters (id, spawn_group_id, monster_id, x, y, is_boss, roam_radius)
  VALUES (@id, @spawn_group_id, @monster_id, @x, @y, @is_boss, @roam_radius)
`);

// Deduplicated spawn groups — one of each camp
const spawnGroups = [
  { id:"6ebd8fe3-c4e8-4ffe-888d-1cbea5914712", world_id:"overworld_C", name:"Goblin Road Camp",  kind:"static", respawn_seconds:120, enabled:1 },
  { id:"269585b4-7703-49f7-b45b-cfef2bb7695b", world_id:"overworld_C", name:"Goblin Camp Ridge", kind:"static", respawn_seconds:120, enabled:1 },
  { id:"89a85e85-13a5-471a-9c87-f36e72fa6f11", world_id:"overworld_C", name:"Goblin Camp North", kind:"static", respawn_seconds:120, enabled:1 },
  { id:"ac51844f-d565-405f-95f2-266772c24458", world_id:"overworld_C", name:"Goblin Camp East",  kind:"static", respawn_seconds:120, enabled:1 },
  { id:"76e8a304-0810-4b4b-a95f-4f2b6fdc95c7", world_id:"overworld_C", name:"Goblin Camp South", kind:"static", respawn_seconds:120, enabled:1 },
  { id:"3c425f39-dd08-45c3-89d3-0d20fe498d74", world_id:"overworld_C", name:"Goblin Camp West",  kind:"static", respawn_seconds:120, enabled:1 },
  { id:"17377a68-a6a5-4229-bdde-ae65413f34c6", world_id:"overworld_C", name:"Goblin Camp Hills", kind:"static", respawn_seconds:120, enabled:1 },
];

// Clean monsters per group — one set each, no duplicates
const spawnMembers = [
  // Goblin Road Camp
  { id:"sg001", spawn_group_id:"6ebd8fe3-c4e8-4ffe-888d-1cbea5914712", monster_id:"goblinMelee",  x:120, y:88,  is_boss:0, roam_radius:4 },
  { id:"sg002", spawn_group_id:"6ebd8fe3-c4e8-4ffe-888d-1cbea5914712", monster_id:"goblinArcher", x:124, y:90,  is_boss:0, roam_radius:4 },
  { id:"sg003", spawn_group_id:"6ebd8fe3-c4e8-4ffe-888d-1cbea5914712", monster_id:"goblinMelee",  x:122, y:92,  is_boss:0, roam_radius:4 },
  // Goblin Camp Ridge
  { id:"sg004", spawn_group_id:"269585b4-7703-49f7-b45b-cfef2bb7695b", monster_id:"goblinMelee",  x:145, y:102, is_boss:0, roam_radius:4 },
  { id:"sg005", spawn_group_id:"269585b4-7703-49f7-b45b-cfef2bb7695b", monster_id:"goblinArcher", x:146, y:103, is_boss:0, roam_radius:4 },
  { id:"sg006", spawn_group_id:"269585b4-7703-49f7-b45b-cfef2bb7695b", monster_id:"goblinArcher", x:148, y:101, is_boss:0, roam_radius:4 },
  // Goblin Camp North
  { id:"sg007", spawn_group_id:"89a85e85-13a5-471a-9c87-f36e72fa6f11", monster_id:"goblinMelee",  x:110, y:65,  is_boss:0, roam_radius:4 },
  { id:"sg008", spawn_group_id:"89a85e85-13a5-471a-9c87-f36e72fa6f11", monster_id:"goblinMelee",  x:111, y:66,  is_boss:0, roam_radius:4 },
  { id:"sg009", spawn_group_id:"89a85e85-13a5-471a-9c87-f36e72fa6f11", monster_id:"goblinMelee",  x:112, y:64,  is_boss:0, roam_radius:4 },
  { id:"sg010", spawn_group_id:"89a85e85-13a5-471a-9c87-f36e72fa6f11", monster_id:"goblinArcher", x:113, y:65,  is_boss:0, roam_radius:4 },
  { id:"sg011", spawn_group_id:"89a85e85-13a5-471a-9c87-f36e72fa6f11", monster_id:"goblinArcher", x:114, y:66,  is_boss:0, roam_radius:4 },
  { id:"sg012", spawn_group_id:"89a85e85-13a5-471a-9c87-f36e72fa6f11", monster_id:"goblinArcher", x:112, y:67,  is_boss:0, roam_radius:4 },
  { id:"sg013", spawn_group_id:"89a85e85-13a5-471a-9c87-f36e72fa6f11", monster_id:"goblinMelee",  x:115, y:65,  is_boss:0, roam_radius:4 },
  { id:"sg014", spawn_group_id:"89a85e85-13a5-471a-9c87-f36e72fa6f11", monster_id:"goblinMelee",  x:111, y:68,  is_boss:0, roam_radius:4 },
  // Goblin Camp East
  { id:"sg015", spawn_group_id:"ac51844f-d565-405f-95f2-266772c24458", monster_id:"goblinMelee",  x:160, y:80,  is_boss:0, roam_radius:4 },
  { id:"sg016", spawn_group_id:"ac51844f-d565-405f-95f2-266772c24458", monster_id:"goblinMelee",  x:162, y:82,  is_boss:0, roam_radius:4 },
  { id:"sg017", spawn_group_id:"ac51844f-d565-405f-95f2-266772c24458", monster_id:"goblinArcher", x:164, y:80,  is_boss:0, roam_radius:4 },
  // Goblin Camp South
  { id:"sg018", spawn_group_id:"76e8a304-0810-4b4b-a95f-4f2b6fdc95c7", monster_id:"goblinMelee",  x:130, y:120, is_boss:0, roam_radius:4 },
  { id:"sg019", spawn_group_id:"76e8a304-0810-4b4b-a95f-4f2b6fdc95c7", monster_id:"goblinMelee",  x:132, y:122, is_boss:0, roam_radius:4 },
  { id:"sg020", spawn_group_id:"76e8a304-0810-4b4b-a95f-4f2b6fdc95c7", monster_id:"goblinArcher", x:134, y:120, is_boss:0, roam_radius:4 },
  // Goblin Camp West
  { id:"sg021", spawn_group_id:"3c425f39-dd08-45c3-89d3-0d20fe498d74", monster_id:"goblinMelee",  x:90,  y:90,  is_boss:0, roam_radius:4 },
  { id:"sg022", spawn_group_id:"3c425f39-dd08-45c3-89d3-0d20fe498d74", monster_id:"goblinMelee",  x:92,  y:92,  is_boss:0, roam_radius:4 },
  { id:"sg023", spawn_group_id:"3c425f39-dd08-45c3-89d3-0d20fe498d74", monster_id:"goblinArcher", x:94,  y:90,  is_boss:0, roam_radius:4 },
  // Goblin Camp Hills
  { id:"sg024", spawn_group_id:"17377a68-a6a5-4229-bdde-ae65413f34c6", monster_id:"goblinMelee",  x:105, y:75,  is_boss:0, roam_radius:4 },
  { id:"sg025", spawn_group_id:"17377a68-a6a5-4229-bdde-ae65413f34c6", monster_id:"goblinMelee",  x:107, y:77,  is_boss:0, roam_radius:4 },
  { id:"sg026", spawn_group_id:"17377a68-a6a5-4229-bdde-ae65413f34c6", monster_id:"goblinArcher", x:109, y:75,  is_boss:0, roam_radius:4 },
  { id:"sg027", spawn_group_id:"17377a68-a6a5-4229-bdde-ae65413f34c6", monster_id:"goblinMelee",  x:106, y:79,  is_boss:0, roam_radius:4 },
];

const seedSpawns = db.transaction(() => {
  db.prepare("DELETE FROM spawn_group_monsters").run();
  db.prepare("DELETE FROM spawn_groups").run();
  for (const g of spawnGroups) insertSpawnGroup.run(g);
  for (const m of spawnMembers) insertSpawnMember.run(m);
});
seedSpawns();
console.log(`[Seed] ${spawnGroups.length} spawn groups, ${spawnMembers.length} monsters inserted`);

db.close();
console.log("[Seed] Database ready at", DB_PATH);
