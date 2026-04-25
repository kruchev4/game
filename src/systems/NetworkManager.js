import { NPC }                 from "../entities/NPC.js";
import { MultiplayerSystem }   from "./MultiplayerSystem.js";
import { getRankedAbility }    from "./ActionManager.js";

export class NetworkManager {
  constructor(engine) {
    this.engine = engine;
  }

  init() {
    const { engine } = this;
    engine.multiplayerSystem?.leave();

    const token     = localStorage.getItem("roe2_player_token") ?? engine.player.id;
    const serverUrl = engine.serverUrl ?? null;

    console.log(`[NetworkManager] init — serverUrl: ${serverUrl}`);

    if (!serverUrl) {
      console.log("[NetworkManager] No server URL — multiplayer disabled");
      return;
    }

    engine.multiplayerSystem = new MultiplayerSystem({
      serverUrl,
      player:      engine.player,
      worldId:     engine._currentWorldId,
      playerToken: token,

      onPlayerJoin: (remote) => {
        if (!engine.entities.find(e => e.id === remote.id)) {
          engine.entities.push(remote);
        }
        engine.combatLog?.push({ text: `${remote.name} joined the world.`, type: "system" });
      },

      onPlayerLeave: (token) => {
        const id = `remote_${token}`;
        const remote = engine.entities.find(e => e.id === id);
        if (remote) {
          engine.entities = engine.entities.filter(e => e.id !== id);
          engine.combatLog?.push({ text: `${remote.name} left the world.`, type: "system" });
        }
      },

      onPlayerUpdate: (remote) => {
        // Entity updated in-place — no action needed
      },

      onNPCState: (serverNPCs) => {
        if (serverNPCs.length === 0) return;

        const serverIds = new Set(serverNPCs.map(n => n.id));

        if (engine._currentTarget?.type === "npc" && !serverIds.has(engine._currentTarget.id)) {
          engine.actionManager.setTarget(null);
        }

        engine.npcs     = engine.npcs.filter(n => serverIds.has(n.id));
        engine.entities = engine.entities.filter(e => e.type !== "npc" || serverIds.has(e.id));

        for (const sNPC of serverNPCs) {
          const existing = engine.npcs.find(n => n.id === sNPC.id);
          if (existing) {
            existing.x     = sNPC.x;
            existing.y     = sNPC.y;
            existing.hp    = sNPC.hp;
            existing.maxHp = sNPC.maxHp;
            existing.state = sNPC.state;
          } else {
            const classDef = engine._classes[sNPC.classId] ?? {};
            const npc = new NPC({
              id:         sNPC.id,
              classId:    sNPC.classId,
              classDef:   { ...classDef, icon: sNPC.icon },
              x:          sNPC.x,
              y:          sNPC.y,
              roamCenter: { x: sNPC.x, y: sNPC.y },
              roamRadius: 0
            });
            npc.hp     = sNPC.hp;
            npc.maxHp  = sNPC.maxHp;
            npc.state  = sNPC.state;
            npc.isBoss = sNPC.isBoss;
            if (sNPC.name) npc.name = sNPC.name;
            engine.npcs.push(npc);
            engine.entities.push(npc);
          }
        }

        if (engine.combatSystem)        engine.combatSystem.npcs        = engine.npcs;
        if (engine.clickToMoveSystem)   engine.clickToMoveSystem.npcs   = engine.npcs;
        if (engine.npcPerceptionSystem) engine.npcPerceptionSystem.npcs = engine.npcs;
        if (engine.npcMovementSystem)   engine.npcMovementSystem.npcs   = engine.npcs;
        if (engine.npcAISystem)         engine.npcAISystem.npcs         = engine.npcs;
      },

      onNPCAttackPlayer: ({ npcId, damage, blocked }) => {
        if (engine._playerDead) return;
        if (blocked) {
          engine.combatLog?.push({ text: "Attack blocked by Divine Shield!", type: "system" });
          return;
        }
        const npc = engine.npcs.find(n => n.id === npcId);
        if (npc && !engine._currentTarget) {
          engine.actionManager.setTarget(npc);
        }
        if (engine.player.classId === "fighter") {
          engine.player.resource = Math.min(engine.player.maxResource ?? 100, (engine.player.resource ?? 0) + 5);
        }
        if (damage > 0) {
          engine.combatLog?.push({
            text: `${npc?.name ?? npc?.classId ?? "Monster"} hits you for ${damage}!`,
            type: "damage"
          });
          engine.animSystem?.playHit("player");
        }
      },

      onNPCDamaged: ({ npcId, hp, damage, attackerName }) => {
        const npc = engine.npcs.find(n => n.id === npcId);
        if (npc) {
          npc.hp = hp;
          engine.combatLog?.push({
            text: `${attackerName} hit ${npc.id} for ${damage}!`,
            type: "damage"
          });
        }
      },

      onNPCKilled: ({ npcId, killerName, xpShare, loot }) => {
        const npc = engine.npcs.find(n => n.id === npcId) || engine._deadNPCGhosts?.[npcId];
        engine.dungeonSystem?.onNPCKilled(npc);

        if (npc && !npc.dead) {
          npc.hp   = 0;
          npc.dead = true;
          engine.entities = engine.entities.filter(e => e.id !== npcId);
          engine.npcs     = engine.npcs.filter(n => n.id !== npcId);
          if (engine._currentTarget?.id === npcId) engine.actionManager.setTarget(null);
        }
        engine.animSystem?.playDying(npcId);

        if (npc) {
          const safeLoot = loot ?? { gold: 0, items: [] };
          engine.lootSystem?.onNPCKilled(npc, safeLoot);
        }

        const isKiller  = killerName === engine.player.name;
        const npcLabel  = npc ? (npc.name ?? engine.gameEventHandler._npcLabel(npc)) : npcId.replace(/_/g, " ");
        const goldStr   = loot?.gold > 0 ? ` +${loot.gold}g` : "";
        const xpStr     = xpShare > 0 ? ` +${xpShare} XP` : "";
        const itemDef   = loot?.itemId ? engine._itemDefs?.[loot.itemId] : null;
        const itemStr   = itemDef ? ` [${itemDef.name}]` : "";

        engine.combatLog?.push({
          text: isKiller ? `You killed ${npcLabel}!${xpStr}${goldStr}${itemStr}` : `${killerName} killed ${npcLabel}!${xpStr}${goldStr} (shared)`,
          type: "reward"
        });
      }
    });

    engine.multiplayerSystem.onRageUpdate = (rage) => {
      engine.player.resource = rage;
    };

    engine.multiplayerSystem.onVolleyZone = ({ wx, wy, radius, duration }) => {
      engine.renderer.volleyZones.push({ wx, wy, radius, startedAt: Date.now(), expiresAt: Date.now() + duration, duration });
    };

    engine.multiplayerSystem.onCharge = ({ x, y, targetId }) => {
      engine.player.x = x;
      engine.player.y = y;
      engine.animSystem?.playAttack("player", 0, 0);
    };

    engine.multiplayerSystem.onCastStart = ({ abilityId, castTime }) => {
      engine.renderer.castBar = { abilityId, startedAt: Date.now(), duration: castTime };
      const ab = engine._abilities?.[abilityId];
      engine.combatLog?.push({ text: `🎯 Casting ${ab?.name ?? abilityId}... (${(castTime/1000).toFixed(1)}s)`, type: "system" });
      setTimeout(() => {
        if (engine.renderer.castBar?.abilityId === abilityId) engine.renderer.castBar = null;
      }, castTime + 300);
    };

    engine.multiplayerSystem.onNPCEffect = ({ npcId, effect, duration }) => {
      const npc = engine.npcs.find(n => n.id === npcId);
      if (!npc) return;
      if (effect === "stun") {
        npc._stunned = true;
        npc._stunnedUntil = Date.now() + duration;
        setTimeout(() => { npc._stunned = false; npc._slowed = true;
          setTimeout(() => { npc._slowed = false; }, duration);
        }, duration);
        engine.combatLog?.push({ text: `${npc.name ?? npc.classId} is stunned!`, type: "system" });
      }
      if (effect === "slow") { npc._slowed = true; setTimeout(() => { npc._slowed = false; }, duration / 60 * 1000); }
    };

    engine.multiplayerSystem.onStatUpdate = ({ hp, maxHp, xp, gold, rage }) => {
      if (hp      !== undefined) engine.player.hp    = hp;
      if (maxHp   !== undefined) engine.player.maxHp = maxHp;
      if (xp      !== undefined) engine.player.xp    = xp;
      if (gold    !== undefined) engine.player.gold   = gold;
      if (rage    !== undefined && engine.player.classId === "fighter") engine.player.resource = rage;

      if (hp <= 0 && !engine._playerDead && !engine.player.invulnerable) {
        engine._playerDead = true;
        const killer = engine.npcs.find(n => n.state === "alert")?.name ?? "a monster";
        engine.uiManager.showDeathScreen(killer, 0, 0);
      }
      if (xp !== undefined) {
        engine.xpSystem?._checkLevelUp?.();
      }
    };

    engine.multiplayerSystem.onAbilityResult = (msg) => {
      const { abilityId, damage, targetId, outOfRange, aoe, targetsHit, heal } = msg;
      if (outOfRange) {
        engine.combatLog?.push({ text: "Out of range.", type: "system" });
        return;
      }

      if (msg.special === "charge") {
        engine.player.x = msg.x;
        engine.player.y = msg.y;
        engine.animSystem?.playAttack("player", 0, 0);
        engine.combatLog?.push({ text: `Charge! ${msg.damage} damage!`, type: "damage_out" });
      }

      if (msg.execute) {
        engine.combatLog?.push({ text: `EXECUTE! ${msg.damage} damage!`, type: "kill" });
      }

      if (abilityId === "whirlwind") {
        const ab = engine._abilities?.["whirlwind"];
        const rank = engine.player.learnedSkills?.["whirlwind"] ?? 1;
        const ranked = getRankedAbility(ab, rank);
        const radius = ranked?.aoe?.radius ?? 2;
        engine.renderer.spawnWhirlwind?.(engine.player.x, engine.player.y, radius);
      }

      if (msg.special === "disengage" && engine._currentTarget) {
        const target = engine._currentTarget;
        const dx  = engine.player.x - target.x;
        const dy  = engine.player.y - target.y;
        const len = Math.sqrt(dx*dx + dy*dy) || 1;
        const mag = msg.magnitude ?? 3;
        let landed = false;
        for (let dist = mag; dist >= 1; dist--) {
          const nx = Math.round(engine.player.x + (dx/len) * dist);
          const ny = Math.round(engine.player.y + (dy/len) * dist);
          if (nx < 0 || ny < 0 || nx >= engine.world.width || ny >= engine.world.height) continue;
          if (engine.movementSystem?._canEnter(nx, ny) ?? true) {
            engine.player.x = nx;
            engine.player.y = ny;
            landed = true;
            break;
          }
        }
        if (!landed) { engine.combatLog?.push({ text: "Nowhere to disengage!", type: "system" }); }
        else { engine.combatLog?.push({ text: "Disengaged!", type: "system" }); }
      }

      if (msg.buffType === "elemental_charge") {
        engine.renderer.elementalCharge = msg.element;
        setTimeout(() => { engine.renderer.elementalCharge = null; }, msg.duration ?? 10000);
      }
      if (msg.buffType === "battle_cry") {
        engine.renderer.battleCry = { expiresAt: Date.now() + (msg.duration ?? 8000), magnitude: msg.magnitude };
        if (msg.rage !== undefined) engine.player.resource = msg.rage;
        engine.combatLog?.push({ text: `⚔️ Battle Cry! Attack speed +${Math.round((1-msg.magnitude)*100)}%`, type: "system" });
      }
      if (msg.buffType === "fortify") {
        engine.renderer.fortify = { expiresAt: Date.now() + (msg.duration ?? 3000) };
        engine.combatLog?.push({ text: `🏰 Fortify! Damage reduced by ${Math.round((1-msg.magnitude)*100)}%`, type: "system" });
      }
      if (msg.buffType === "eagles_eye") {
        engine.renderer.eaglesEye = { expiresAt: Date.now() + (msg.duration ?? 6000), rangeBonus: msg.rangeBonus ?? 4 };
        engine.combatLog?.push({ text: `🦅 Eagle's Eye! +${msg.rangeBonus ?? 4} range for ${Math.round((msg.duration ?? 6000)/1000)}s`, type: "system" });
      }

      const ability = engine._abilities[abilityId];
      const type    = ability?.type ?? "melee";
      const target  = engine.npcs.find(n => n.id === targetId);

      if (type === "melee" && target) {
        const dx  = target.x - engine.player.x;
        const dy  = target.y - engine.player.y;
        const len = Math.sqrt(dx*dx + dy*dy) || 1;
        engine.animSystem?.playAttack("player", dx/len, dy/len);
        engine.animSystem?.playHit(targetId);
      }

      if (type === "ranged" && target) {
        if (engine.player.classId === "ranger") {
          engine.animSystem?.spawnArrow(engine.player.x, engine.player.y, target.x, target.y);
        } else if (engine.player.classId === "paladin") {
          engine.animSystem?.spawnHolyBolt(engine.player.x, engine.player.y, target.x, target.y);
        }
        engine.animSystem?.playHit(targetId);
      }

      if (aoe) {
        const isMultishot = abilityId === "multishot" || abilityId === "volley";
        if (isMultishot && engine.player.classId === "ranger") {
          const nearbyNPCs = engine.npcs.filter(n => !n.dead).slice(0, targetsHit ?? 3);
          for (const n of nearbyNPCs) {
            engine.animSystem?.spawnArrow(engine.player.x, engine.player.y, n.x, n.y);
            engine.animSystem?.playHit(n.id);
          }
        } else {
          engine.animSystem?.spawnAOE({
            x: engine.player.x, y: engine.player.y,
            radius: ability?.range ?? 3,
            color:  abilityId.includes("holy") || abilityId.includes("consec") || abilityId.includes("divine")
              ? "rgba(255,220,50,0.4)" : "rgba(255,100,0,0.4)"
          });
        }
        engine.combatLog?.push({ text: `${ability?.name ?? abilityId} hit ${targetsHit ?? 0} target${targetsHit !== 1 ? "s" : ""}!`, type: "damage_out" });
        return;
      }

      if (heal > 0) {
        engine.animSystem?.playHeal(targetId === "self" ? "player" : targetId);
        return;
      }

      if (damage > 0) {
        const npc = engine.npcs.find(n => n.id === targetId);
        engine.combatLog?.push({ text: `${ability?.name ?? abilityId} hits ${npc?.name ?? npc?.classId ?? targetId} for ${damage}!`, type: "damage_out" });
      }
    };

    engine.multiplayerSystem.onPlayerHealed = ({ healerToken, targetToken, amount }) => {
      const isSelf = targetToken === engine.multiplayerSystem.playerToken;
      if (isSelf) {
        engine.animSystem?.playHeal("player");
        engine.combatLog?.push({ text: `Healed for ${amount} HP!`, type: "heal" });
      } else {
        engine.animSystem?.playHeal(`remote_${targetToken}`);
      }
    };

    engine.multiplayerSystem.onBuffApplied = ({ abilityId, duration }) => {
      if (abilityId === "divine_shield") {
        engine.player.invulnerable      = true;
        engine.player.invulnerableTimer = Math.floor(duration / 50); // ms to ticks
        engine.combatLog?.push({ text: "Divine Shield activated!", type: "system" });
        engine.animSystem?.playHeal("player");
      }
    };

    try {
      engine.multiplayerSystem.join();
    } catch (e) {
      console.warn("[NetworkManager] Multiplayer join failed:", e.message);
    }
  }
}
