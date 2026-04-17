-- roe_server.db schema and seed data
-- Run: node db/seed.js

-- ── Monsters ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS monsters (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  icon         TEXT NOT NULL DEFAULT '👾',
  hp           INTEGER NOT NULL,
  damage_min   INTEGER NOT NULL,
  damage_max   INTEGER NOT NULL,
  speed        INTEGER NOT NULL DEFAULT 2,
  perception   INTEGER NOT NULL DEFAULT 5,
  roam_radius  INTEGER NOT NULL DEFAULT 4,
  attack_range INTEGER NOT NULL DEFAULT 1,
  xp_value     INTEGER NOT NULL DEFAULT 0,
  is_boss      INTEGER NOT NULL DEFAULT 0  -- SQLite uses 0/1 for bool
);

-- ── Spawn groups ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS spawn_groups (
  id              TEXT PRIMARY KEY,
  world_id        TEXT NOT NULL,
  name            TEXT NOT NULL,
  kind            TEXT NOT NULL DEFAULT 'static',
  respawn_seconds INTEGER,
  enabled         INTEGER NOT NULL DEFAULT 1
);

-- ── Spawn group monsters ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS spawn_group_monsters (
  id              TEXT PRIMARY KEY,
  spawn_group_id  TEXT NOT NULL REFERENCES spawn_groups(id) ON DELETE CASCADE,
  monster_id      TEXT NOT NULL REFERENCES monsters(id),
  x               INTEGER NOT NULL,
  y               INTEGER NOT NULL,
  is_boss         INTEGER DEFAULT 0,
  roam_radius     INTEGER
);

-- ── Loot tables ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loot_tables (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS loot_entries (
  id           TEXT PRIMARY KEY,
  loot_table_id TEXT NOT NULL REFERENCES loot_tables(id),
  item_id      TEXT NOT NULL,
  weight       INTEGER NOT NULL DEFAULT 1,
  qty_min      INTEGER NOT NULL DEFAULT 1,
  qty_max      INTEGER NOT NULL DEFAULT 1,
  gold_min     INTEGER NOT NULL DEFAULT 0,
  gold_max     INTEGER NOT NULL DEFAULT 0
);

-- ── Monster loot links ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS monster_loot (
  monster_id    TEXT NOT NULL REFERENCES monsters(id),
  loot_table_id TEXT NOT NULL REFERENCES loot_tables(id),
  PRIMARY KEY (monster_id, loot_table_id)
);

-- ── Abilities ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS abilities (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  class_id    TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'melee',  -- melee | ranged | heal | aoe
  damage_min  INTEGER DEFAULT 0,
  damage_max  INTEGER DEFAULT 0,
  range       INTEGER DEFAULT 1,
  cooldown    INTEGER DEFAULT 60,
  targets     INTEGER DEFAULT 1,             -- for multishot etc
  heal_min    INTEGER DEFAULT 0,
  heal_max    INTEGER DEFAULT 0,
  description TEXT
);