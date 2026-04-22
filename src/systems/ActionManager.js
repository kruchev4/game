export function getRankedAbility(ability, rank) {
  if (!ability || !rank || rank <= 1) return ability;
  const override = ability.ranks?.[String(rank)];
  if (!override) return ability;
  return { ...ability, ...override };
}

export class ActionManager {
  constructor(engine) {
    this.engine = engine;
  }

  // ─────────────────────────────────────────────
  // TARGETING
  // ─────────────────────────────────────────────

  cycleTarget() {
    const { engine } = this;
    const alive = engine.npcs
      .filter(n => !n.dead)
      .map(n => ({
        npc: n,
        dist: Math.sqrt(
          (n.x - engine.player.x) ** 2 +
          (n.y - engine.player.y) ** 2
        )
      }))
      .sort((a, b) => a.dist - b.dist)
      .map(e => e.npc);

    if (!alive.length) return;

    // Find index of current target in sorted list, advance to next (wraps)
    const currentIdx = alive.findIndex(n => n.id === engine._currentTarget?.id);
    const nextIdx = (currentIdx + 1) % alive.length;
    this.setTarget(alive[nextIdx]);
  }

  setTarget(entity) {
    const { engine } = this;
    engine._currentTarget = entity;
    engine.renderer.currentTarget = entity;

    if (entity) {
      const label = entity.id === "player" ? "yourself"
        : entity.isRemote ? (entity.name ?? "ally")
        : entity.id;
      console.log(`[Target] ${label}`);
    } else {
      console.log("[Target] cleared");
    }
  }

  // ─────────────────────────────────────────────
  // ABILITY FIRING
  // ─────────────────────────────────────────────

  useAbilitySlot(slotIndex) {
    const { engine } = this;
    const classDef = engine._classes[engine._playerClassId];
    if (!classDef) return;

    // Use player.abilities (customised bar) — falls back to class defaults
    const abilityBar = engine.player.abilities?.length
      ? engine.player.abilities
      : classDef.abilities ?? [];

    const abilityId = abilityBar[slotIndex];
    if (!abilityId) return;

    const baseAbility = engine._abilities[abilityId];
    if (!baseAbility) return;

    // Apply rank override
    const rank    = engine.player.learnedSkills?.[abilityId] ?? 1;
    const ability = getRankedAbility(baseAbility, rank);

    // ── Client-side cooldown check (UI only — server also enforces) ──
    const cd = engine.combatSystem?.getCooldown?.("player", abilityId);
    if (cd?.remaining > 0) {
      engine.combatLog?.push({ text: `${ability.name} is on cooldown.`, type: "system" });
      return;
    }

    // ── Mana/resource cost check ──
    const manaCost = ability.cost?.mana ?? 0;
    if (manaCost > 0) {
      const def = engine.player.resourceDef;
      if (def?.type === "mana" || def?.type === "energy") {
        if ((engine.player.resource ?? 0) < manaCost) {
          engine.combatLog?.push({ text: `Not enough ${def.label ?? "mana"}!`, type: "system" });
          return;
        }
        engine.player.resource = Math.max(0, engine.player.resource - manaCost);
      }
    }

    const target = engine._currentTarget;
    const type   = ability.type ?? "melee";

    // Ground-targeted abilities (Volley) — enter targeting mode
    if (abilityId === "volley") {
      engine._groundTargeting = {
        abilityId,
        rank,
        range:  ability.range ?? 6,
        radius: ability.aoe?.radius ?? 2,
        onPlace: (wx, wy) => {
          engine.multiplayerSystem?.sendVolley({ abilityId, wx, wy, rank });
          engine.combatSystem?._startCooldown?.("player", abilityId);
          engine.renderer.groundTargeting = null;
          engine._groundTargeting = null;
        }
      };
      engine.renderer.groundTargeting = engine._groundTargeting;

      const canvas = engine.renderer.canvas;
      engine.renderer.groundTargetingMouse = {
        px: canvas.width / 2,
        py: canvas.height / 2
      };
      engine.combatLog?.push({ text: "🌧️ Click to place Volley...", type: "system" });
      return;
    }

    // Apply elemental charge visual immediately on client for responsiveness
    const selfFx = ability.selfEffect;
    if (type === "self" && selfFx?.effect === "eagles_eye") {
      const durationMs = (selfFx.duration ?? 360) / 60 * 1000;
      engine.renderer.eaglesEye = {
        expiresAt:  Date.now() + durationMs,
        rangeBonus: selfFx.magnitude ?? 4
      };
    }

    if (type === "self" && selfFx?.effect === "elemental_charge") {
      engine.renderer.elementalCharge = selfFx.element;
      engine.player._elementalCharge = {
        element:     selfFx.element,
        bonusDamage: selfFx.bonusDamage ?? 6,
        onHitEffect: selfFx.onHitEffect ?? null,
        expiresAt:   Date.now() + 10000
      };
      setTimeout(() => {
        engine.renderer.elementalCharge = null;
        if (engine.player._elementalCharge?.element === selfFx.element) {
          engine.player._elementalCharge = null;
        }
      }, 10000);
      engine.combatLog?.push({
        text: `${selfFx.element === "frost" ? "❄️" : "🔥"} Next shot charged with ${selfFx.element}!`,
        type: "system"
      });
    }

    // ── Multiplayer — ALL abilities go to server ──
    if (engine.multiplayerSystem?._connected) {
      let targetId   = null;
      let targetType = null;

      if (["buff", "taunt", "self"].includes(type) || ability.aoe?.centeredOnSelf) {
        targetId = "self";
      } else if (type === "aoe") {
        targetId = "aoe";
      } else if (type === "heal") {
        targetId   = target?.isRemote ? target.playerToken : "self";
        targetType = "player";
      } else if (target) {
        targetId   = target.id;
        targetType = target.type;
      } else {
        engine.combatLog?.push({ text: "No target.", type: "system" });
        return;
      }

      if (type === "ranged" && engine.player._elementalCharge) {
        engine.player._elementalCharge = null;
        engine.renderer.elementalCharge = null;
      }

      engine.combatSystem?._startCooldown?.("player", abilityId);
      engine.multiplayerSystem.sendAbility({ abilityId, targetId, targetType, rank });
      return;
    }

    // ── Single player — queue through local combat system ──
    const selfTargeted = ["buff", "taunt", "self"].includes(type)
      || ability.aoe?.centeredOnSelf
      || (type === "aoe" && !target)
      || (type === "heal" && (!target || target.type === "player"));

    if (selfTargeted) {
      engine.combatSystem.queuePlayerAction(abilityId, "player");
      return;
    }

    if (!target || target.dead) {
      engine.combatLog?.push({ text: "No target.", type: "system" });
      return;
    }

    engine.combatSystem.queuePlayerAction(abilityId, target.id);
  }
}
