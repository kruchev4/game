/**
 * REALM OF ECHOES — Movement & Town Fix
 * 
 * Replaces ALL tryMove patches with ONE clean unified version.
 * Load this LAST — after all other patches.
 * 
 * Also fixes: fillCharSheet crash from null inventory items.
 */

(function installCleanTryMove() {

  // ══════════════════════════════════════════════════════════════
  // FIX 1: fillCharSheet null inventory crash
  // ══════════════════════════════════════════════════════════════

  const _origFillCharSheet = window.fillCharSheet;
  window.fillCharSheet = function fillCharSheet() {
    const G = window.G;
    if (G?.inventory) G.inventory = G.inventory.filter(Boolean);
    _origFillCharSheet?.();
  };

  // Prevent nulls getting into inventory in the first place
  const _origAddToInventory = window.addToInventory;
  window.addToInventory = function addToInventory(itemDef) {
    if (!itemDef?.name) return false;
    return _origAddToInventory?.(itemDef) ?? false;
  };

  console.log('[Fix 1] ✅ fillCharSheet null crash fixed');


  // ══════════════════════════════════════════════════════════════
  // FIX 2: Single clean tryMove — replaces ALL patch layers
  // ══════════════════════════════════════════════════════════════

  window.tryMove = function tryMove(dx, dy) {
    const G  = window.G;
    const GS = window.GameState;
    if (!G) return;
    if (G.inCombat) return;

    const _map      = GS?.activeMap;
    const _W        = _map?.width  || window.MAP_W || 240;
    const _H        = _map?.height || window.MAP_H || 180;
    const _getTile  = (x, y) => _map?.getTile?.(x, y) ?? 0;
    const _PASSABLE = new Set([0,1,4,5,6,7,9,10,11,12,13,20,22,23,24,25,26,27,28]);
    const _TOWN_P   = new Set([20,22,23,24,25,26,27,28]);

    // ── INSIDE TOWN MAP ─────────────────────────────────────────
    if (GS?.mode === 'town') {
      const nx = G.x+dx, ny = G.y+dy;
      if (nx<0||nx>=_W||ny<0||ny>=_H) return;
      const t = _getTile(nx, ny);
      if (!_TOWN_P.has(t)) return;
      G.prevX=G.x; G.prevY=G.y; G.x=nx; G.y=ny;
      if (GS) GS.player = G;
      window.handleTownTile?.(t, nx, ny);
      if (!G._stepCount) G._stepCount=0; G._stepCount++;
      if (G._stepCount%4===0) window.playSound?.('step');
      window.render?.(); window.updateHUD?.();
      return;
    }

    // ── CO-OP PEER ──────────────────────────────────────────────
    if (!window.coopIsHost && window.coopActive) {
      const nx = G.x+dx, ny = G.y+dy;
      if (nx<0||nx>=_W||ny<0||ny>=_H) return;
      if (!_PASSABLE.has(_getTile(nx,ny))) return;
      G.prevX=G.x; G.prevY=G.y; G.x=nx; G.y=ny;
      window.coopSendMove?.(dx, dy);
      if (!G._stepCount) G._stepCount=0; G._stepCount++;
      if (G._stepCount%3===0) window.playSound?.('step');
      window.render?.(); window.updateHUD?.();
      return;
    }

    // ── WORLD / DUNGEON ─────────────────────────────────────────
    const nx = G.x+dx, ny = G.y+dy;
    if (nx<0||nx>=_W||ny<0||ny>=_H) return;
    const type = _getTile(nx, ny);
    if (!_PASSABLE.has(type)) return;

    G.prevX=G.x; G.prevY=G.y; G.x=nx; G.y=ny;
    if (GS) GS.player = G;

    // Town entry
    if (type === 5) {
      const sources = [_map?.towns, window.TOWNS].filter(Boolean);
      let town = null;
      for (const src of sources) {
        town = src.find(t => Math.abs(t.x-nx)<=1 && Math.abs(t.y-ny)<=1);
        if (town) break;
      }
      if (!town) town = { x:nx, y:ny, name:'Town', id:`town_${nx}_${ny}`,
        type:'Town', services:['Inn','Shop','Temple','Tavern','Vendor'], desc:'', rumours:[] };
      if (window.enterTownMap) { window.enterTownMap(town); return; }
      G.inTown = true; window.enterTown?.(town); return;
    }

    // Dungeon exit stairs
    if (type === 13 && GS?.mode === 'dungeon') {
      if (confirm('Exit the dungeon and return to the world?')) window.exitDungeon?.();
      else { G.x=G.prevX; G.y=G.prevY; }
      return;
    }

    // Portal
    if (typeof window.checkPortal==='function' && window.checkPortal(nx,ny)) return;

    // World boss
    if (window.worldBosses) {
      const boss = window.worldBosses.find(b=>b.alive&&Math.abs(nx-b.x)<=1&&Math.abs(ny-b.y)<=1);
      if (boss) { window.triggerBossCombat?.(boss); return; }
    }

    // Dungeon boss
    if (GS?.mode==='dungeon') {
      const boss = (window._dungeonMonsters||[]).find(m=>m.alive&&m.isBoss&&Math.abs(nx-m.x)<=2&&Math.abs(ny-m.y)<=2);
      if (boss) { boss.alive=false; window.triggerDungeonBoss?.(boss); return; }
    }

    // Encounters
    if ((G.encounterCooldown||0) <= 0) {
      let chance = 0;
      const inDng = GS?.mode==='dungeon';
      if (inDng) { if(type===9) chance=0.15; else if(type===10) chance=0.08; }
      else { if(type===6)chance=.30; else if(type===1)chance=.12; else if(type===2)chance=.10; else if(type===0)chance=.04; else if(type===7)chance=.06; }
      if (chance>0 && Math.random()<chance && !window.checkEncounterAvoid?.()) {
        if (inDng) { window.triggerDungeonEncounter?.(); return; }
        else { window.triggerCombat?.(type); return; }
      }
    }
    G.encounterCooldown = Math.max(0, (G.encounterCooldown||0)-1);

    // Zone hint
    const zl = Math.min(15, Math.floor(Math.sqrt((G.x-120)**2+(G.y-90)**2)/15));
    if (G._lastZone !== zl) {
      G._lastZone = zl;
      if (zl>0) {
        const zn=['','Borderlands','Contested Wilds','Dark Reaches','Shadow Lands','Cursed Wastes',
          'Blighted Fields','The Howling Deep','Riftlands','Void Marches','Desolation',
          'The Screaming Dark','Oblivion Edge','The Shattered Realm',"World's End",'Boss Territory'];
        window.toast?.(`${zn[zl]} — Zone ${zl}`);
      }
    }

    // Biome log
    const prevType = _getTile(G.prevX, G.prevY);
    if (type !== prevType) {
      const msgs = {1:'You enter a dense, shadowed forest.',2:'The path grows steep and rocky.',
        6:'⚠ A chill runs through you. Something lurks here.',7:'Hot sand crunches underfoot.',
        0:'You emerge onto open grassland.',4:'You wade through shallow waters.'};
      if (msgs[type]) window.addLog?.(msgs[type]);
    }

    // Steps / save / sync / fog
    if (!G._stepCount) G._stepCount=0; G._stepCount++;
    if (G._stepCount%3===0) window.playSound?.('step');
    if (G._stepCount%20===0) window.saveGame?.();
    if (window.coopActive && window.coopMyId && window._fbRoomRef) {
      window._fbRoomRef.child('players/'+window.coopMyId).update({x:G.x,y:G.y,hp:G.hp,ts:Date.now()});
    }
    window.markVisited?.(G.x, G.y, GS?.mode==='dungeon'?4:6);
    if (G._stepCount%3===0) window.updateMinimapMode?.();

    window.render?.();
    window.updateHUD?.();
  };

  // Keep window.tryMove in sync so main.js input handler always finds it
  window.tryMove._isPatched = true;
  console.log('[Fix 2] ✅ tryMove unified — movement + town + co-op + dungeons all working');

})();
