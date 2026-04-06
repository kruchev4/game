/**
 * REALM OF ECHOES — Patch v3.0
 * Fixes:
 *   1. "Not connected to Firebase" — _db is a closure var, never on window
 *      Solution: grab DB directly from firebase global SDK
 *   2. Save game fully working (local + cloud)
 *   3. Dungeons wired to actual Supabase map IDs
 *   4. Co-op peer movement fixes
 */

(function applyPatchV3() {
  'use strict';

  // ══════════════════════════════════════════════════════════════
  // HELPER: Get Firebase DB from the global firebase SDK
  // _db is a closure variable inside the script — window._db is always null.
  // But firebase.app().database() gives us the same instance directly.
  // ══════════════════════════════════════════════════════════════

  function getFirebaseDB() {
    try {
      if (window.firebase?.apps?.length) {
        return window.firebase.app().database();
      }
    } catch(e) {}
    return null;
  }

  // Expose it so our patched functions can use it reliably
  Object.defineProperty(window, '_db', {
    get: () => getFirebaseDB(),
    configurable: true,
    enumerable: true
  });

  console.log('[Patch] Firebase DB getter installed — test:', !!getFirebaseDB());


  // ══════════════════════════════════════════════════════════════
  // PATCH A: SAVE GAME — uses firebase getter, not closure _db
  // ══════════════════════════════════════════════════════════════

  window.saveGame = function saveGame() {
    const G = window.G;
    if (!G || !G.name || !G.cls) return;

    // Keep GameState in sync
    if (window.GameState?.player) Object.assign(window.GameState.player, G);

    try {
      localStorage.setItem('realmSave', JSON.stringify({
        version: 3,
        G: G,
        savedAt: Date.now()
      }));
    } catch(e) {
      console.warn('[saveGame] localStorage failed:', e);
    }

    // Debounced cloud sync
    if (window._cloudSyncTimer) clearTimeout(window._cloudSyncTimer);
    window._cloudSyncTimer = setTimeout(() => {
      window._cloudSyncTimer = null;
      window.cloudSyncNow(true);
    }, 5000);
  };

  window.cloudSyncNow = async function cloudSyncNow(silent = false) {
    const G = window.G;
    if (!G?.name) return;

    if (location.protocol === 'file:') {
      if (!silent) window.toast?.('Local mode — cloud sync disabled');
      return;
    }

    const db = getFirebaseDB();
    if (!db) {
      if (!silent) window.toast?.('Firebase not ready — saved locally only', 'err');
      console.warn('[cloudSyncNow] Firebase DB not available');
      return;
    }

    try {
      const tok = window.getPlayerToken?.() || localStorage.getItem('realmPlayerToken');
      if (!tok) {
        console.warn('[cloudSyncNow] No player token');
        return;
      }

      await db.ref('saves/' + tok).set({
        token:     tok,
        charName:  G.name,
        data:      JSON.stringify(G),
        updatedAt: Date.now()
      });

      if (!silent) window.toast?.('✅ Saved to cloud');
      console.log('[cloudSyncNow] ✅ Saved:', G.name, 'Lv', G.level);

    } catch (e) {
      console.warn('[cloudSyncNow] Failed:', e.message);
      if (!silent) window.toast?.('Save failed: ' + e.message, 'err');
    }
  };

  // Fix beforeunload to use the getter too
  window.addEventListener('beforeunload', () => {
    const G   = window.G;
    const db  = getFirebaseDB();
    const tok = localStorage.getItem('realmPlayerToken');
    if (!G?.name || !db || !tok) return;
    try {
      db.ref('saves/' + tok).set({
        token: tok, charName: G.name,
        data: JSON.stringify(G), updatedAt: Date.now()
      });
    } catch(e) {}
  });

  console.log('[Patch A] ✅ saveGame + cloudSyncNow fixed');


  // ══════════════════════════════════════════════════════════════
  // PATCH B: Fix menu Save button
  // ══════════════════════════════════════════════════════════════

  window.menuSave = async function menuSave() {
    window.saveGame();
    await window.cloudSyncNow(false);
    const statusEl = document.getElementById('menu-status');
    if (statusEl) {
      statusEl.textContent = '✅ Saved at ' + new Date().toLocaleTimeString();
      statusEl.style.color = '#27ae60';
    }
  };

  // Also fix the menuShowSyncInfo to show Firebase status
  window.menuShowSyncInfo = function menuShowSyncInfo() {
    const tok = localStorage.getItem('realmPlayerToken') || '—';
    const db  = getFirebaseDB();
    const statusEl = document.getElementById('menu-status');
    if (statusEl) {
      statusEl.innerHTML =
        `<span style="font-size:.65rem;line-height:1.7;">` +
        `Firebase: <strong style="color:${db?'#27ae60':'#e74c3c'}">${db?'Connected':'Not connected'}</strong><br>` +
        `Player ID: <code style="font-size:.6rem;">${tok.slice(0,8)}…</code><br>` +
        `<button onclick="navigator.clipboard?.writeText('${tok}').then(()=>toast('Copied!'))" ` +
        `style="font-size:.6rem;margin-top:4px;padding:3px 8px;border:1px solid #4a3520;` +
        `background:transparent;color:var(--parch-dk);cursor:pointer;">Copy Full ID</button>` +
        `</span>`;
    }
  };

  console.log('[Patch B] ✅ menuSave + menuShowSyncInfo fixed');


  // ══════════════════════════════════════════════════════════════
  // PATCH C: Wire dungeons to Supabase map IDs
  // ══════════════════════════════════════════════════════════════

  window.DUNGEON_FILES = {
    // Campaign IDs → Supabase map IDs
    'goblin_warrens':  'goblin_warrens',
    'bandit_cave':     'mossy_hollows',
    'forest_glades':   'forest_glades',
    'echoing_cavern':  'echoing_cavern',
    'sunken_throne':   'sunken_ruins',
    'duskwood_siege':  'elders_grove',
    'glacial_tomb':    'frostbound_keep',
    'ashspire':        'magma_pit',
    'irondeep':        'crypt_of_bones',
    'drowned_citadel': 'sunken_ruins',
    // Direct Supabase IDs (pass-through)
    'crypt_of_bones':  'crypt_of_bones',
    'echoing_cavern':  'echoing_cavern',
    'elders_grove':    'elders_grove',
    'forest_glades':   'forest_glades',
    'frostbound_keep': 'frostbound_keep',
    'magma_pit':       'magma_pit',
    'mossy_hollows':   'mossy_hollows',
    'sunken_ruins':    'sunken_ruins',
  };

  window.CAMPAIGNS = {
    goblin_warrens:  { id:'goblin_warrens',  name:'The Goblin Warrens',   icon:'👺', type:'lair',     levelRange:[1,3],  players:[1,4], estTime:'1 Session',    desc:'A fetid network of tunnels beneath the farmlands. Goblins have been raiding local villages.',       longDesc:'' },
    bandit_cave:     { id:'bandit_cave',     name:"Bandit's Cave",         icon:'🗡️', type:'lair',     levelRange:[1,4],  players:[1,4], estTime:'1 Session',    desc:"A notorious hideout in the cliffs. The Ironmask bandits have stolen a merchant's cargo.",          longDesc:'' },
    forest_glades:   { id:'forest_glades',   name:'Forest Glades',         icon:'🌲', type:'lair',     levelRange:[2,5],  players:[1,4], estTime:'1 Session',    desc:'A haunted grove deep in the Ashenwood. Strange creatures stalk between the ancient trees.',         longDesc:'' },
    echoing_cavern:  { id:'echoing_cavern',  name:'The Echoing Cavern',    icon:'🦇', type:'lair',     levelRange:[3,6],  players:[1,4], estTime:'1-2 Sessions', desc:'An enormous cavern system. Something large lives within.',                                           longDesc:'' },
    sunken_throne:   { id:'sunken_throne',   name:'The Sunken Throne',     icon:'🌊', type:'campaign', levelRange:[4,7],  players:[2,4], estTime:'2-3 Sessions', desc:'An ancient palace, half-swallowed by the sea. Something stirs in the deep chambers.',               longDesc:'' },
    duskwood_siege:  { id:'duskwood_siege',  name:'Siege of Duskwood',     icon:'🌲', type:'campaign', levelRange:[4,8],  players:[2,4], estTime:'2-3 Sessions', desc:'The forest town of Duskwood is besieged by undead. Hold the walls until dawn.',                     longDesc:'' },
    glacial_tomb:    { id:'glacial_tomb',    name:'The Glacial Tomb',      icon:'❄️', type:'campaign', levelRange:[8,12], players:[3,4], estTime:'3-4 Sessions', desc:"A frost giant's burial vault, sealed for centuries. The seals are breaking.",                      longDesc:'' },
    ashspire:        { id:'ashspire',        name:'Ashspire',              icon:'🔥', type:'campaign', levelRange:[8,12], players:[3,4], estTime:'3-4 Sessions', desc:'A volcanic tower ruled by a fire cult. They seek to awaken something beneath the mountain.',         longDesc:'' },
    irondeep:        { id:'irondeep',        name:'Irondeep Mine',         icon:'⛏️', type:'campaign', levelRange:[8,12], players:[3,4], estTime:'3-4 Sessions', desc:'The deepest mine in the realm has gone silent. Only echoes come up from below.',                    longDesc:'' },
    drowned_citadel: { id:'drowned_citadel', name:'The Drowned Citadel',   icon:'💀', type:'campaign', levelRange:[10,15],players:[4,4], estTime:'4-5 Sessions', desc:'A legendary fortress sunk into a cursed lake. Only the most powerful dare descend.',               longDesc:'' },
    crypt_of_bones:  { id:'crypt_of_bones',  name:'Crypt of Bones',        icon:'💀', type:'lair',     levelRange:[5,9],  players:[1,4], estTime:'1-2 Sessions', desc:'Ancient burial chambers overrun with the restless dead.',                                           longDesc:'' },
    elders_grove:    { id:'elders_grove',    name:'Elder Grove',           icon:'🌳', type:'lair',     levelRange:[3,7],  players:[1,4], estTime:'1 Session',    desc:'A sacred grove corrupted by dark magic.',                                                           longDesc:'' },
    frostbound_keep: { id:'frostbound_keep', name:'Frostbound Keep',       icon:'❄️', type:'lair',     levelRange:[7,11], players:[2,4], estTime:'2 Sessions',   desc:'A fortress locked in eternal winter. The dead walk its frozen halls.',                             longDesc:'' },
    magma_pit:       { id:'magma_pit',       name:'The Magma Pit',         icon:'🌋', type:'lair',     levelRange:[6,10], players:[2,4], estTime:'1-2 Sessions', desc:'A volcanic pit teeming with fire elementals and lava creatures.',                                  longDesc:'' },
    mossy_hollows:   { id:'mossy_hollows',   name:'Mossy Hollows',         icon:'🍄', type:'lair',     levelRange:[2,5],  players:[1,4], estTime:'1 Session',    desc:'A damp labyrinth of caves and hollows, home to fungal horrors.',                                   longDesc:'' },
    sunken_ruins:    { id:'sunken_ruins',    name:'Sunken Ruins',          icon:'🌊', type:'lair',     levelRange:[4,8],  players:[1,4], estTime:'1-2 Sessions', desc:'Partially flooded ruins of an ancient civilization.',                                               longDesc:'' },
  };

  window.PORTALS = [
    { x:56,  y:48,  campaignId:'goblin_warrens'  },
    { x:128, y:100, campaignId:'bandit_cave'      },
    { x:100, y:70,  campaignId:'mossy_hollows'    },
    { x:140, y:75,  campaignId:'forest_glades'    },
    { x:112, y:44,  campaignId:'sunken_throne'    },
    { x:72,  y:96,  campaignId:'duskwood_siege'   },
    { x:95,  y:115, campaignId:'echoing_cavern'   },
    { x:155, y:50,  campaignId:'elders_grove'     },
    { x:160, y:110, campaignId:'sunken_ruins'     },
    { x:30,  y:30,  campaignId:'glacial_tomb'     },
    { x:32,  y:32,  campaignId:'frostbound_keep'  },
    { x:210, y:28,  campaignId:'ashspire'         },
    { x:212, y:30,  campaignId:'magma_pit'        },
    { x:28,  y:150, campaignId:'irondeep'         },
    { x:30,  y:152, campaignId:'crypt_of_bones'   },
    { x:208, y:152, campaignId:'drowned_citadel'  },
  ];

  console.log('[Patch C] ✅ Dungeons + portals wired to Supabase IDs');


  // ══════════════════════════════════════════════════════════════
  // PATCH D: enterDungeon — use correct Supabase ID
  // ══════════════════════════════════════════════════════════════

  window.enterDungeon = async function enterDungeon(campaignId) {
    const GS = window.GameState;
    const G  = window.G;
    if (!GS || !G) return;

    const supabaseMapId = window.DUNGEON_FILES[campaignId] || campaignId;

    GS.returnMap = GS.activeMap;
    GS.returnX   = G.x;
    GS.returnY   = G.y;
    GS.mode      = 'dungeon';
    G.inTown     = true;

    window.toast?.('Loading dungeon…');
    console.log('[enterDungeon]', campaignId, '→', supabaseMapId);

    try {
      const supabase = window.supabaseClient;
      if (!supabase) throw new Error('Supabase client not initialised');

      const { data, error } = await supabase
        .from('maps')
        .select('json')
        .eq('id', supabaseMapId)
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data)  throw new Error(`Map "${supabaseMapId}" not found`);

      const raw   = typeof data.json === 'string' ? JSON.parse(data.json) : data.json;
      const tiles = Array.isArray(raw.tiles) ? raw.tiles : Array.from(raw.tiles || []);

      const dungeonMap = {
        id:       raw.id || supabaseMapId,
        name:     raw.name || campaignId.replace(/_/g, ' '),
        type:     raw.type || 'dungeon',
        width:    raw.width,
        height:   raw.height,
        tiles,
        entry:    raw.entry,
        exit:     raw.exit,
        monsters: raw.monsters || [],
        rooms:    raw.rooms    || [],
        towns:    raw.towns    || [],
        portals:  raw.portals  || [],
        getTile(x, y) {
          if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 8;
          return this.tiles[y * this.width + x] ?? 8;
        }
      };

      GS.activeMap = dungeonMap;
      const ex = raw.entry?.x ?? Math.floor(raw.width  / 2);
      const ey = raw.entry?.y ?? Math.floor(raw.height / 2);
      G.x = ex; G.y = ey; G.prevX = ex; G.prevY = ey;
      GS.player = G;
      window.MAP_W = dungeonMap.width;
      window.MAP_H = dungeonMap.height;
      window._dungeonMonsters = (dungeonMap.monsters || []).map(m => ({ ...m, alive: true }));
      G.inTown   = false;
      G.inCombat = false;
      window._visitedTiles = new Set();
      window.markVisited?.(ex, ey, 4);
      window.updateMinimapMode?.();

      if (window.coopActive) {
        window.coopBroadcast?.({ type:'dungeon_invite', dungeonId:campaignId, dungeonName:dungeonMap.name, from:G.name });
      }

      window.addLog?.(`You descend into ${dungeonMap.name}. Watch your step.`, 'disc');
      window.toast?.(`⚔ ${dungeonMap.name} — find the exit to return.`);
      window.saveGame?.();

    } catch (e) {
      console.error('[enterDungeon] Failed:', e);
      window.addLog?.('The dungeon entrance crumbled — ' + e.message, 'err');
      window.toast?.('❌ ' + e.message, 'err');
      GS.mode      = 'world';
      GS.activeMap = GS.returnMap || GS.activeMap;
      GS.returnMap = null;
      G.inTown     = false;
    }
  };

  console.log('[Patch D] ✅ enterDungeon patched');


  // ══════════════════════════════════════════════════════════════
  // PATCH E: Co-op fixes (peer movement, shim neutralize)
  // ══════════════════════════════════════════════════════════════

  function restoreCoopVars() {
    ['coopActive','coopIsHost','coopParty','coopRoomCode','coopConns'].forEach(name => {
      const desc = Object.getOwnPropertyDescriptor(window, name);
      if (desc?.get) {
        const val = (() => { try { return window[name]; } catch(e) { return undefined; }})();
        //delete window[name];
        window[name] = val ?? (name.includes('Party') || name.includes('Conns') ? [] : false);
      }
    });
    if (!window.PARTY_COLORS) window.PARTY_COLORS = ['#c090ff','#60c0ff','#60ff90','#ffb060'];
  }
  restoreCoopVars();
  setTimeout(restoreCoopVars, 300);
  setTimeout(restoreCoopVars, 1200);
  setTimeout(restoreCoopVars, 3000);

  window.coopSendMove = function(dx, dy) {
    const ref = window._fbRoomRef;
    const id  = window.coopMyId;
    const G   = window.G;
    if (!window.coopActive || !ref || !id || !G) return;
    ref.child('players/' + id).update({ x:G.x, y:G.y, hp:G.hp, hpMax:G.hpMax, ts:Date.now() });
  };

  const _origTryMove = window.tryMove;
  window.tryMove = function tryMove(dx, dy) {
    const G = window.G;
    if (!G) return;
    if (!window.coopIsHost && window.coopActive) {
      const _map = window.GameState?.activeMap;
      const _W = _map?.width  || window.MAP_W || 240;
      const _H = _map?.height || window.MAP_H || 180;
      const _P = new Set([0,1,4,5,6,7,9,10,11,12,13]);
      const nx = G.x+dx, ny = G.y+dy;
      if (nx<0||nx>=_W||ny<0||ny>=_H) return;
      if (!_P.has(_map ? _map.getTile(nx,ny) : 0)) return;
      G.prevX=G.x; G.prevY=G.y; G.x=nx; G.y=ny;
      window.coopSendMove(dx, dy);
      if (!G._stepCount) G._stepCount=0; G._stepCount++;
      if (G._stepCount%3===0) window.playSound?.('step');
      window.render?.(); window.updateHUD?.();
      return;
    }
    _origTryMove?.(dx, dy);
  };

  console.log('[Patch E] ✅ Co-op peer movement fixed');


  // ══════════════════════════════════════════════════════════════
  // PATCH F: Portal shortcuts — deduplicated, all dungeons shown
  // ══════════════════════════════════════════════════════════════

  window.buildPortalShortcuts = function() {
    const box = document.getElementById('portal-shortcut-list');
    if (!box) return;
    const seen = new Set();
    box.innerHTML = (window.PORTALS || []).filter(p => {
      if (seen.has(p.campaignId)) return false;
      seen.add(p.campaignId); return true;
    }).map(p => {
      const c = window.CAMPAIGNS?.[p.campaignId];
      if (!c) return '';
      return `<button class="portal-shortcut" onclick="fastTravelToPortal(${p.x},${p.y})"
        title="${c.name} — Lv${c.levelRange[0]}-${c.levelRange[1]}">
        ${c.type==='lair'?'⚔':'🌟'} ${c.name}
        <span class="ps-level">Lv${c.levelRange[0]}-${c.levelRange[1]}</span>
      </button>`;
    }).join('');
  };

  if (document.getElementById('portal-shortcut-list')) window.buildPortalShortcuts();

  console.log('[Patch F] ✅ Portal shortcuts updated');


  // ══════════════════════════════════════════════════════════════
  // Debug helpers
  // ══════════════════════════════════════════════════════════════
  window.debugSave = {
    firebase: () => { const db = getFirebaseDB(); console.log('Firebase DB:', db ? '✅ connected' : '❌ null'); return !!db; },
    test:     () => window.cloudSyncNow(false),
    local:    () => { try { return JSON.parse(localStorage.getItem('realmSave')); } catch(e) { return null; } },
    token:    () => localStorage.getItem('realmPlayerToken'),
    dungeons: () => console.table(window.DUNGEON_FILES),
  };

  console.log('\n%c ✅ Realm of Echoes Patch v3 Applied %c',
    'background:#c9a227;color:#000;padding:4px 10px;font-weight:bold;border-radius:3px;', '');
  console.log('Run window.debugSave.firebase() to verify Firebase connection');

})();
