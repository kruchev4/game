export class GameEventHandler {
  constructor(engine) {
    this.engine = engine;
  }

  // ─────────────────────────────────────────────
  // COMBAT EVENTS
  // ─────────────────────────────────────────────
  handleCombatEvent(event) {
    const { player, multiplayerSystem, effectSystem, animSystem, combatLog } = this.engine;

    // Forward hit events to multiplayer server
    if (event.type === "hit" && event.target?.type === "npc") {
      multiplayerSystem?.sendAttack({
        npcId:    event.target.id,
        damage:   event.damage,
        abilityId: event.abilityId
      });
      multiplayerSystem?.broadcastState();
    }

    // Apply onHit effects from ability
    if (event.type === "hit" && event.ability?.onHit) {
      const fx = event.ability.onHit;
      effectSystem?.apply(event.target, fx.effect, event.attacker.id, {
        duration:  fx.duration,
        magnitude: fx.magnitude
      });
    }

    // Apply selfEffect from ability (buffs on the caster)
    if ((event.type === "hit" || event.type === "self_effect") && event.ability?.selfEffect) {
      const fx = event.ability.selfEffect;
      effectSystem?.apply(player, fx.effect, "player", {
        duration:  fx.duration,
        magnitude: fx.magnitude
      });
    }

    // Handle special abilities
    if (event.type === "hit" && event.ability?.special) {
      this._resolveSpecialAbility(event);
    }

    // Trigger animations
    if (event.type === "hit") {
      const abilityType = event.ability?.type ?? "melee";
      if (abilityType === "melee" && event.attacker && event.target) {
        const dx  = event.target.x - event.attacker.x;
        const dy  = event.target.y - event.attacker.y;
        const len = Math.sqrt(dx*dx + dy*dy) || 1;
        animSystem?.playAttack(event.attacker.id, dx/len, dy/len);
      }
      animSystem?.playHit(event.target?.id);
      if (abilityType === "ranged" && event.attacker && event.target) {
        if (event.attacker.classId === "ranger") {
          animSystem?.spawnArrow(event.attacker.x, event.attacker.y, event.target.x, event.target.y);
        } else if (event.attacker.classId === "paladin") {
          animSystem?.spawnHolyBolt(event.attacker.x, event.attacker.y, event.target.x, event.target.y);
        } else {
          animSystem?.spawnSpellBolt(event.attacker.x, event.attacker.y, event.target.x, event.target.y);
        }
      }
    }

    if (event.type === "heal") animSystem?.playHeal(event.target?.id ?? "player");

    if (event.type === "aoe") {
      animSystem?.spawnAOE({
        x:      player.x,
        y:      player.y,
        radius: event.ability?.aoe?.radius ?? 3,
        color:  event.ability?.id?.includes("holy") || event.ability?.id?.includes("consec")
          ? "rgba(255,220,50,0.4)" : "rgba(255,100,0,0.4)"
      });
      if (multiplayerSystem?._connected) multiplayerSystem.broadcastState();
    }

    if (event.type === "buff" && event.ability?.id === "divine_shield") {
      player.invulnerable      = true;
      player.invulnerableTimer = event.ability.effect?.duration ?? 120;
      combatLog?.push({ text: "Divine Shield activated!", type: "system" });
      animSystem?.playHeal("player");
    }

    if (event.type === "taunt") {
      combatLog?.push({ text: "You taunt nearby enemies!", type: "system" });
      multiplayerSystem?.sendTaunt(event.ability?.range ?? 6);
    }

    if (event.type === "rez") combatLog?.push({ text: "Resurrection — targeting fallen allies.", type: "system" });

    const log = combatLog;
    switch (event.type) {
      case "engage":
        log?.push({ text: `${event.entity.id === "player" ? "You" : this._npcLabel(event.entity)} entered combat`, type: "system" });
        break;
      case "disengage":
        log?.push({ text: `${event.entity.id === "player" ? "You" : this._npcLabel(event.entity)} left combat`, type: "system" });
        break;
      case "hit": {
        if (event.attacker?.type === "npc" && event.target?.id === "player" && !this.engine._currentTarget) {
          this.engine.actionManager.setTarget(event.attacker);
        }
        const isPlayer = event.attacker.id === "player";
        if (isPlayer) {
          log?.push({ text: `${event.ability.name} hits ${this._npcLabel(event.target)} for ${event.damage}`, type: "damage_out" });
          const def = player.resourceDef;
          if (def?.type === "rage" && def.buildOnHitDealt) {
            player.resource = Math.min(player.maxResource, player.resource + def.buildOnHitDealt);
          }
        } else {
          log?.push({ text: `${this._npcLabel(event.attacker)} hits you for ${event.damage}`, type: "damage_in" });
          const def = player.resourceDef;
          if (def?.type === "rage" && def.buildOnHitTaken) {
            player.resource = Math.min(player.maxResource, player.resource + def.buildOnHitTaken);
          }
        }
        break;
      }
      case "out_of_range":
        log?.push({ text: `${event.ability.name} — out of range or LoS blocked`, type: "miss" });
        break;
      case "on_cooldown":
        log?.push({ text: `${event.ability.name} is not ready yet`, type: "miss" });
        break;
      case "kill": {
        const killer = event.attacker.id === "player" ? "You" : this._npcLabel(event.attacker);
        const victim = this._npcLabel(event.target);
        log?.push({ text: `${killer} killed ${victim}!`, type: "kill" });

        // Cache the Ghost
        this.engine._deadNPCGhosts = this.engine._deadNPCGhosts || {};
        this.engine._deadNPCGhosts[event.target.id] = {
          id: event.target.id, x: event.target.x, y: event.target.y, classId: event.target.classId
        };

        if (!multiplayerSystem?._connected) {
          this.engine.entities = this.engine.entities.filter(e => e.id !== event.target.id);
          this.engine.npcs     = this.engine.npcs.filter(n => n.id !== event.target.id);
          if (this.engine._currentTarget?.id === event.target.id) this.engine.actionManager.setTarget(null);

          if (event.attacker.id === "player") {
            this.engine.xpSystem?.awardKillXP(event.target);
            this.engine.lootSystem?.onNPCKilled(event.target);
          }
          this.engine.spawnSystem?.onNPCDied(event.target);
        } else {
          event.target.dead = true;
          event.target.hp = 0;
          if (this.engine._currentTarget?.id === event.target.id) this.engine.actionManager.setTarget(null);
        }
        break;
      }
      case "player_death":
        const killerName = this._npcLabel(event.attacker);
        log?.push({ text: `You were slain by ${killerName}!`, type: "damage_in" });
        this.engine._onPlayerDeath(killerName);
        break;
      case "combat_end":
        log?.push({ text: "All enemies defeated.", type: "system" });
        break;
      case "heal":
        log?.push({ text: `${event.ability?.name} restores ${event.amount} HP to ${event.target?.id === "player" ? "yourself" : (event.target?.name ?? "ally")}!`, type: "heal" });
        break;
      case "aoe":
        log?.push({ text: `${event.ability?.name} hits ${event.hitCount} target${event.hitCount !== 1 ? "s" : ""}!`, type: "damage_out" });
        break;
      case "buff":
        log?.push({ text: `${event.ability?.name} activated!`, type: "system" });
        break;
      case "effect_applied":
        log?.push({ text: `${event.effect.type} applied to ${event.entity.id === "player" ? "you" : this._npcLabel(event.entity)}`, type: "effect" });
        break;
      case "effect_expired":
        log?.push({ text: `${event.effect.type} wore off`, type: "effect" });
        break;
    }
  }
_showLevelUpNotification(level) {
  document.getElementById("levelup-badge")?.remove();

  const badge = document.createElement("div");
  badge.id = "levelup-badge";
  badge.innerHTML = `⬆ Level ${level} — Click to choose abilities & stats`;
  badge.style.cssText = `
    position: fixed; top: 70px; left: 50%;
    transform: translateX(-50%); z-index: 130;
    background: linear-gradient(90deg, #1a1006, #2a1a08);
    border: 1px solid #e8c84a; color: #e8c84a;
    font-family: 'Cinzel', serif; font-size: 0.75rem;
    letter-spacing: 2px; padding: 10px 22px; cursor: pointer;
    box-shadow: 0 0 20px rgba(232,200,74,0.4);
    animation: levelup-pulse 1.5s ease-in-out infinite;
  `;

  if (!document.getElementById("levelup-badge-style")) {
    const style = document.createElement("style");
    style.id = "levelup-badge-style";
    style.textContent = `
      @keyframes levelup-pulse {
        0%, 100% { box-shadow: 0 0 20px rgba(232,200,74,0.4); }
        50%       { box-shadow: 0 0 36px rgba(232,200,74,0.8); border-color: #fff8c0; }
      }
    `;
    document.head.appendChild(style);
  }

  badge.addEventListener("click", () => {
    this._openLevelUpWindow(level);
    badge.remove();
  });

  document.body.appendChild(badge);
}

_openLevelUpWindow(level) {
  const engine     = this.engine;
  const uiManager  = engine.uiManager;
  const xpSystem   = engine.xpSystem;
  const classId    = engine._playerClassId;
  const classDef   = engine._classes?.[classId];
  if (!classDef) return;

  const abilityDefs = engine._abilities ?? {};

  // abilities[0] is always the basic attack — exclude it from the pool
  const basicId  = classDef.abilities?.[0];
  const poolIds  = (classDef.abilities ?? []).filter(id => id !== basicId);

  const classSkills = poolIds
    .map(id => abilityDefs[id])
    .filter(Boolean)
    .map(ab => ({
      id:          ab.id,
      name:        ab.name,
      icon:        ab.icon ?? "⚔️",
      description: ab.description ?? "",
      rankDescriptions: ab.ranks
        ? Object.entries(ab.ranks)
            .sort(([a],[b]) => Number(a) - Number(b))
            .map(([,v]) => v.description ?? "")
        : [],
      baseDamage:  ab.damage ? { base: ab.damage.base, variance: ab.damage.variance } : null,
      rankScaling: ab.scaling ?? null,
    }));

  const win = uiManager.levelUpWindow;
  if (!win) { console.warn("[GameEventHandler] No levelUpWindow"); return; }

  // Inject fresh classSkills and wire confirm
  win.classSkills = classSkills;
  win.onConfirm = (skillId, replaceId, statDist) => {
    if (skillId) xpSystem.applySkillPick(skillId, replaceId);
    if (statDist) xpSystem.applyStatPoints(statDist);
    engine._pendingLevelUp = null;
    uiManager.syncAbilityBar();
    engine.combatLog?.push({ text: `Level ${level} choices applied.`, type: "kill" });
  };

  win.show(level);
}handleDungeonEvent(event) {
  const { combatLog, animSystem } = this.engine;
  switch (event.type) {
    case "chest_open": {
      const { chest, loot } = event;
      const goldStr = loot.gold > 0 ? ` +${loot.gold}g` : "";
      const itemDef = loot.itemId ? this.engine._itemDefs?.[loot.itemId] : null;
      const itemStr = itemDef ? ` [${itemDef.icon} ${itemDef.name}]` : "";
      combatLog?.push({ text: `📦 Chest opened!${goldStr}${itemStr}`, type: "reward" });
      this.engine.uiManager.inventoryWindow?.refresh();
      break;
    }
    case "room_enter": {
      const { room } = event;
      combatLog?.push({
        text: room.isBossRoom ? `⚠ You enter ${room.label}. Danger ahead!` : `You enter ${room.label}.`,
        type: room.isBossRoom ? "damage" : "system"
      });
      break;
    }
    case "boss_killed": {
      const { boss } = event;
      combatLog?.push({ text: `☠ ${boss.name ?? boss.classId} has been slain!`, type: "kill" });
      animSystem?.spawnAOE({ x: boss.x, y: boss.y, radius: 3, color: "rgba(255,220,50,0.5)" });
      break;
    }
    case "dungeon_cleared": {
      combatLog?.push({ text: `✦ Dungeon cleared! All enemies defeated.`, type: "kill" });
      animSystem?.spawnAOE({ x: this.engine.player.x, y: this.engine.player.y, radius: 8, color: "rgba(255,215,0,0.3)" });
      break;
    }
  }
}

  // ─────────────────────────────────────────────
  // LOOT EVENTS
  // ─────────────────────────────────────────────
  handleLootEvent(event) {
    const log = this.engine.combatLog;
    switch (event.type) {
      case "loot_gold":
        log?.push({ text: `You loot ${event.amount} gold.`, type: "system" });
        break;
      case "item_used":
        if (event.healed)   log?.push({ text: `${event.item.name}: restored ${event.healed} HP.`, type: "system" });
        if (event.restored) log?.push({ text: `${event.item.name}: restored ${event.restored} resource.`, type: "system" });
        this.engine.uiManager._inventoryWindow?.refresh();
        break;
      case "item_equipped":
        log?.push({ text: `Equipped: ${event.item.name}`, type: "system" });
        this.engine.uiManager._inventoryWindow?.refresh();
        break;
      case "item_unequipped":
        log?.push({ text: `Unequipped ${event.slot}.`, type: "system" });
        this.engine.uiManager._inventoryWindow?.refresh();
        break;
      case "bag_full":
        log?.push({ text: "Bag is full!", type: "miss" });
        break;
    }
  }

  // ─────────────────────────────────────────────
  // XP EVENTS
  // ─────────────────────────────────────────────
  handleXPEvent(event) {
  const log = this.engine.combatLog;
  switch (event.type) {
 
    case "xp_gained":
      log?.push({ text: `+${event.amount} XP`, type: "system" });
      break;
 
    case "level_up": {
      this.engine.animSystem?.playLevelUp("player");
      log?.push({ text: `⬆ Level ${event.level}! HP restored.`, type: "kill" });
 
      if (event.isSpecial) {
        // Store pending level so the player can open the window when ready
        this.engine._pendingLevelUp = event.level;
        this._showLevelUpNotification(event.level);
      }
      break;
    }
 
    case "skill_learned":
      log?.push({ text: `Learned: ${event.skillId}`, type: "system" });
      this.engine.uiManager.syncAbilityBar(); // fixed: was _syncAbilityBar
      break;
 
    case "skill_upgraded":
      log?.push({ text: `${event.skillId} upgraded to Rank ${event.rank}!`, type: "system" });
      this.engine.uiManager.syncAbilityBar();
      break;
 
    case "stats_updated":
      // Renderer reads player.stats directly — no action needed
      break;
  }
}

  // ─────────────────────────────────────────────
  // EFFECT EVENTS
  // ─────────────────────────────────────────────
  handleEffectEvent(event) {
    const log = this.engine.combatLog;
    switch (event.type) {
      case "dot_tick": {
        const name = event.entity.id === "player" ? "You" : this._npcLabel(event.entity);
        log?.push({ text: `${name} takes ${event.damage} ${event.effect.name} damage`, type: "damage" });
        this.engine.animSystem?.playHit(event.entity.id);
        break;
      }
      case "hot_tick": {
        log?.push({ text: `+${event.heal} HP (${event.effect.name})`, type: "heal" });
        this.engine.animSystem?.playHeal(event.entity.id);
        break;
      }
      case "effect_applied": {
        const name = event.entity.id === "player" ? "You" : this._npcLabel(event.entity);
        log?.push({ text: `${name}: ${event.effect.name}`, type: "effect" });
        break;
      }
      case "effect_expired":
        break;
      case "kill":
        this.handleCombatEvent(event);
        this.engine.dungeonSystem?.onNPCKilled(event.target);
        break;
      case "player_death":
        this.engine._onPlayerDeath();
        break;
    }
  }

  // ─────────────────────────────────────────────
  // UTILS & SPECIALS
  // ─────────────────────────────────────────────
  _resolveSpecialAbility(event) {
    const { ability, attacker, target } = event;
    const { player, multiplayerSystem, combatLog, animSystem, npcs } = this.engine;

    switch (ability.special) {
      case "charge":
        if (attacker.id === "player" && target) {
          player.x = target.x + (target.x > player.x ? -1 : 1);
          player.y = target.y;
        }
        break;
      case "execute":
        if (target && target.hp <= target.maxHp * 0.25) {
          const bonus = event.damage;
          target.hp   = Math.max(0, target.hp - bonus);
          combatLog?.push({ text: `Execute! +${bonus} bonus damage`, type: "damage" });
        }
        break;
      case "taunt":
        multiplayerSystem?.sendTaunt(6);
        for (const npc of npcs) {
          if (npc.dead) continue;
          const dx = npc.x - player.x;
          const dy = npc.y - player.y;
          if (Math.sqrt(dx*dx + dy*dy) <= 6) npc.state = "alert";
        }
        combatLog?.push({ text: "All nearby enemies focus on you!", type: "system" });
        break;
      case "second_wind": {
        const heal = Math.floor(player.maxHp * 0.20);
        player.hp = Math.min(player.maxHp, player.hp + heal);
        animSystem?.playHeal("player");
        combatLog?.push({ text: `Second Wind: +${heal} HP`, type: "heal" });
        break;
      }
      case "shadow_step":
        if (attacker.id === "player" && target) {
          const dx = player.x - target.x;
          const dy = player.y - target.y;
          const len = Math.sqrt(dx*dx + dy*dy) || 1;
          player.x = Math.round(target.x + dx/len);
          player.y = Math.round(target.y + dy/len);
        }
        break;
    }
  }

  _npcLabel(entity) {
    return (entity.classId ?? entity.id).replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim().replace(/\b\w/g, c => c.toUpperCase());
  }
}
