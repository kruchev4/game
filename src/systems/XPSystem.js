/**
 * XPSystem.js
 *
 * Manages player XP, level progression, and special level detection.
 *
 * Rules:
 *   - XP gained on kill, scaled by level difference
 *   - Every level: +5 HP, +1 primary stat auto-applied
 *   - Every 3rd level (3,6,9,12,15,18): special level — skill pick + 5 stat points
 *   - Skill upgrade formula:
 *       effectiveDamage = baseDamage * (1 + 0.5 * rank) + statBonus * (0.1 * rank)
 */

const SPECIAL_LEVELS = new Set([3, 6, 9, 12, 15, 18, 21, 24, 27, 30]);
const MAX_SKILL_SLOTS = 6;
const STAT_POINTS_PER_SPECIAL = 5;

// XP required to reach each level (index = level)
// Level 1 = 0 XP, Level 2 = 100 XP, etc.
function xpForLevel(level) {
  // Classic curve: 100 * level^1.5
  return Math.floor(100 * Math.pow(level, 1.5));
}

// Primary stat per class — used for auto stat bump on level up
const PRIMARY_STAT = {
  fighter: "STR",
  ranger:  "DEX",
};

export class XPSystem {
  /**
   * @param {object}   opts
   * @param {object}   opts.player     - player entity
   * @param {object}   opts.skills     - parsed skills.json { fighter: [...], ranger: [...] }
   * @param {Function} opts.onEvent    - event callback
   */
  constructor({ player, skills, onEvent = () => {} }) {
    this.player   = player;
    this.skills   = skills;
    this.onEvent  = onEvent;
  }

  // ─────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────

  /**
   * Award XP for killing an NPC.
   * @param {object} npc - killed NPC with .xpValue and .level
   */
  awardKillXP(npc) {
    const p          = this.player;
    const npcLevel   = npc.level ?? 1;
    const levelDiff  = (p.level ?? 1) - npcLevel;

    // Diminishing returns: -10% per level above NPC, min 10%
    const multiplier = Math.max(0.1, 1 - levelDiff * 0.1);
    const baseXP     = npc.xpValue ?? 20;
    const xpGained   = Math.max(1, Math.round(baseXP * multiplier));

    p.xp = (p.xp ?? 0) + xpGained;
    this.onEvent({ type: "xp_gained", amount: xpGained, npc });

    // Check for level up(s)
    this._checkLevelUp();
  }

  /**
   * Get XP needed for next level.
   */
  xpForNextLevel() {
    return xpForLevel(this.player.level ?? 1);
  }

  /**
   * XP progress toward next level (0–1).
   */
  xpProgress() {
    const p       = this.player;
    const current = p.xp ?? 0;
    const needed  = this.xpForNextLevel();
    return Math.min(1, current / needed);
  }

  /**
   * Apply a skill pick at a special level.
   * If player already has the skill, increment its rank.
   * If player has < MAX_SKILL_SLOTS skills, add it.
   * @param {string} skillId
   * @param {string} replaceSkillId - if provided, replace this skill with the new one
   */
  applySkillPick(skillId, replaceSkillId = null) {
    const p = this.player;
    if (!p.learnedSkills) p.learnedSkills = {};

    // Already have it — upgrade rank
    if (p.learnedSkills[skillId] !== undefined) {
      p.learnedSkills[skillId] = (p.learnedSkills[skillId] ?? 1) + 1;
      this.onEvent({ type: "skill_upgraded", skillId, rank: p.learnedSkills[skillId] });
      this._rebuildAbilityBar();
      return;
    }

    // Replacing an existing skill
    if (replaceSkillId) {
      delete p.learnedSkills[replaceSkillId];
      p.learnedSkills[skillId] = 1;
      // Remove from ability bar
      const idx = (p.abilities ?? []).indexOf(replaceSkillId);
      if (idx >= 0) p.abilities[idx] = skillId;
      this.onEvent({ type: "skill_learned", skillId, replaced: replaceSkillId });
      this._rebuildAbilityBar();
      return;
    }

    // New skill, have slots
    const slotCount = Object.keys(p.learnedSkills).length;
    if (slotCount < MAX_SKILL_SLOTS) {
      p.learnedSkills[skillId] = 1;
      if (!p.abilities) p.abilities = [];
      if (!p.abilities.includes(skillId)) p.abilities.push(skillId);
      this.onEvent({ type: "skill_learned", skillId });
      this._rebuildAbilityBar();
      return;
    }

    // No slots — caller should have prompted replacement
    console.warn("[XPSystem] applySkillPick: no slot available, replaceSkillId required");
  }

  /**
   * Apply free stat points from a special level.
   * @param {{ STR, DEX, INT, CON, WIS, CHA }} distribution - points to add per stat
   */
  applyStatPoints(distribution) {
    const stats = this.player.stats ?? {};
    for (const [stat, pts] of Object.entries(distribution)) {
      if (pts > 0) stats[stat] = (stats[stat] ?? 10) + pts;
    }
    this.player.stats = stats;
    this.onEvent({ type: "stats_updated" });
  }

  /**
   * Get the effective damage for a skill accounting for rank scaling.
   * @param {object} skillDef  - from skills.json
   * @param {number} rank      - player's rank in this skill (1+)
   * @returns {{ base: number, variance: number }}
   */
  getEffectiveDamage(skillDef, rank = 1) {
    if (!skillDef.baseDamage) return { base: 0, variance: 0 };

    const scaling   = skillDef.rankScaling ?? {};
    const statKey   = (scaling.statBonus ?? "str").toUpperCase();
    const statValue = this.player.stats?.[statKey] ?? 10;
    const statMod   = Math.floor((statValue - 10) / 2);

    const basePct   = scaling.basePct  ?? 0.5;
    const statPct   = scaling.statPct  ?? 0.1;
    const rankBonus = (rank - 1); // rank 1 = no bonus, rank 2 = 1x bonus, etc.

    const base = Math.round(
      skillDef.baseDamage.base * (1 + basePct * rankBonus) +
      statMod * statPct * rankBonus
    );
    const variance = Math.round(
      skillDef.baseDamage.variance * (1 + basePct * rankBonus * 0.5)
    );

    return { base: Math.max(1, base), variance: Math.max(0, variance) };
  }

  // ─────────────────────────────────────────────
  // LEVEL UP
  // ─────────────────────────────────────────────

  _checkLevelUp() {
    const p = this.player;
    let leveled = false;

    while ((p.xp ?? 0) >= this.xpForNextLevel()) {
      p.xp   -= this.xpForNextLevel();
      p.level = (p.level ?? 1) + 1;
      leveled = true;
      this._applyLevelBonuses(p.level);
    }

    if (leveled) {
      const isSpecial = SPECIAL_LEVELS.has(p.level);
      this.onEvent({
        type:      "level_up",
        level:     p.level,
        isSpecial,
        statPoints: isSpecial ? STAT_POINTS_PER_SPECIAL : 0
      });
    }
  }

  _applyLevelBonuses(level) {
    const p          = this.player;
    const primaryStat = PRIMARY_STAT[p.classId] ?? "STR";

    // +5 max HP, restore to full
    p.maxHp = (p.maxHp ?? 80) + 5;
    p.hp    = p.maxHp;

    // +1 primary stat
    if (p.stats) {
      p.stats[primaryStat] = (p.stats[primaryStat] ?? 10) + 1;
    }

    // +2 max resource every other level
    if (level % 2 === 0) {
      p.maxResource = (p.maxResource ?? 0) + 2;
      p.resource    = p.maxResource;
    }
  }

  _rebuildAbilityBar() {
    // Ensure abilities array matches learnedSkills keys, max 6
    const p = this.player;
    const learned = Object.keys(p.learnedSkills ?? {});
    // Preserve order — add new ones to end, remove deleted ones
    p.abilities = (p.abilities ?? [])
      .filter(id => learned.includes(id))
      .concat(learned.filter(id => !(p.abilities ?? []).includes(id)))
      .slice(0, MAX_SKILL_SLOTS);
  }

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────

  static isSpecialLevel(level) {
    return SPECIAL_LEVELS.has(level);
  }

  static xpForLevel(level) {
    return xpForLevel(level);
  }

  static maxSkillSlots() {
    return MAX_SKILL_SLOTS;
  }
}
