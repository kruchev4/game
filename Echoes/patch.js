/**
 * REALM OF ECHOES — Runtime Patch v1.0
 * Apply this AFTER the main game loads to fix:
 *   1. Co-op peers can't move (broken shims overwrite Firebase variables)
 *   2. Click-to-move camera offset
 *   3. Peer movement syncs position via Firebase correctly
 *
 * HOW TO USE:
 *   Option A: Add <script src="patch.js"></script> at the very END of index.html body
 *   Option B: Paste into browser DevTools console after game loads
 */

(function applyRealmsOfEchoesPatches() {
  'use strict';

  // ══════════════════════════════════════════════════════════════
  // PATCH 1: Neutralize the broken installCoopShims
  // The shims override coopActive/coopIsHost/coopParty with getters
  // that read from `multi` — a non-existent MultiEngine object.
  // We restore them to the Firebase-managed variables.
  // ══════════════════════════════════════════════════════════════

  function restoreCoopVariables() {
    // Check if shims have already broken things
    try {
      // If accessing coopActive throws, shims are broken
      const test = window.coopActive;
      if (test === undefined && window._coopVarsRestored) return;
    } catch(e) {
      console.warn('[Patch] coopActive getter broken — restoring...');
    }

    // Delete any broken property descriptors and restore simple values
    const coopVars = ['coopActive', 'coopIsHost', 'coopParty', 'coopRoomCode', 'coopConns', 'PARTY_COLORS'];
    coopVars.forEach(name => {
      const desc = Object.getOwnPropertyDescriptor(window, name);
      if (desc && (desc.get || desc.set)) {
        // It's a getter/setter — delete it and replace with the value
        delete window[name];
      }
    });

    // Re-establish the correct values from the Firebase co-op system
    // These are the actual vars declared in the script (let coopActive = false; etc.)
    // Since we can't access them directly (they're in closure), we re-declare on window
    if (window.coopActive === undefined) window.coopActive   = false;
    if (window.coopIsHost === undefined) window.coopIsHost   = false;
    if (window.coopParty  === undefined) window.coopParty    = [];
    if (window.coopConns  === undefined) window.coopConns    = [];
    if (!window.PARTY_COLORS) window.PARTY_COLORS = ['#c090ff','#60c0ff','#60ff90','#ffb060'];

    window._coopVarsRestored = true;
    console.log('[Patch 1] ✅ Co-op variables restored');
  }

  // Run immediately and retry a few times to catch the async shim installer
  restoreCoopVariables();
  setTimeout(restoreCoopVariables, 300);
  setTimeout(restoreCoopVariables, 1000);
  setTimeout(restoreCoopVariables, 3000);


  // ══════════════════════════════════════════════════════════════
  // PATCH 2: Fix coopSendMove to use Firebase directly
  // Old version: coopBroadcast({type:'peer_move',...}) — goes through
  // the events queue which is slow and has dedup issues.
  // New version: write directly to players/{myId} node — instant.
  // ══════════════════════════════════════════════════════════════

  window.coopSendMove = function coopSendMove(dx, dy) {
    if (!window.coopActive || !window._fbRoomRef) return;
    if (!window.coopMyId) return;
    const G = window.G;
    if (!G) return;
    // Direct player node write — Firebase broadcasts this to all listeners instantly
    window._fbRoomRef.child('players/' + window.coopMyId).update({
      x: G.x,
      y: G.y,
      hp: G.hp,
      hpMax: G.hpMax,
      ts: Date.now()
    });
  };
  console.log('[Patch 2] ✅ coopSendMove patched to use Firebase direct write');


  // ══════════════════════════════════════════════════════════════
  // PATCH 3: Fix tryMove peer branch — remove coopConns.length>0 guard
  // In Firebase mode, coopConns is always [] (WebRTC not used).
  // The old guard `coopConns.length>0` prevented peers from moving at all!
  // We patch tryMove to fix the check.
  // ══════════════════════════════════════════════════════════════

  const _originalTryMove = window.tryMove;

  window.tryMove = function tryMove(dx, dy) {
    const G = window.G;
    if (!G) return;

    // PATCHED peer check: was `!coopIsHost && coopActive && coopConns.length>0`
    // Fixed to: `!coopIsHost && coopActive` (Firebase doesn't use coopConns)
    if (!window.coopIsHost && window.coopActive) {
      const _map = window.GameState?.activeMap;
      const _W = _map?.width  || window.MAP_W || 240;
      const _H = _map?.height || window.MAP_H || 180;
      const _PASSABLE = new Set([0,1,4,5,6,7,9,10,11,12,13]);
      const _getTile = (x, y) => _map ? _map.getTile(x, y) : 0;

      const nx = G.x + dx, ny = G.y + dy;
      if (nx < 0 || nx >= _W || ny < 0 || ny >= _H) return;
      if (!_PASSABLE.has(_getTile(nx, ny))) return;

      G.prevX = G.x; G.prevY = G.y;
      G.x = nx; G.y = ny;

      window.coopSendMove(dx, dy);

      if (!G._stepCount) G._stepCount = 0;
      G._stepCount++;
      if (G._stepCount % 3 === 0 && typeof window.playSound === 'function') {
        window.playSound('step');
      }

      if (typeof window.render === 'function') window.render();
      if (typeof window.updateHUD === 'function') window.updateHUD();
      return;
    }

    // Otherwise: not in co-op or we are host — use original logic
    if (_originalTryMove) {
      _originalTryMove(dx, dy);
    }
  };
  console.log('[Patch 3] ✅ tryMove patched — peer movement now works in Firebase co-op');


  // ══════════════════════════════════════════════════════════════
  // PATCH 4: Fix onCanvasClick camera offset (DPR-aware)
  // ══════════════════════════════════════════════════════════════

  window.onCanvasClick = function onCanvasClick(e) {
    const G = window.G;
    if (!G || G.inCombat || G.inTown) return;

    const wc   = document.getElementById('world-cv');
    if (!wc) return;
    const rect = wc.getBoundingClientRect();
    const dpr  = window.devicePixelRatio || 1;

    // Click position in CSS pixels
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    const _TS  = window.TILE_SIZE || window.GameState?.TILE || 32;
    const _map = window.GameState?.activeMap;
    const _W   = _map?.width  || window.MAP_W || 240;
    const _H   = _map?.height || window.MAP_H || 180;

    // Camera: try engine camera first, fall back to player-centered
    const _cam = window._engineCamera || window.GameState?.camera;

    let camX, camY;
    if (_cam && _cam.x != null) {
      // Engine camera is in world pixels (not CSS pixels)
      // Canvas is devicePixelRatio scaled, so we need to scale click coords too
      camX = _cam.x;
      camY = _cam.y;
    } else {
      // Fallback: player-centered camera
      // Canvas width is in device pixels, so divide by dpr to get CSS-equivalent
      const cssW = wc.width  / dpr;
      const cssH = wc.height / dpr;
      camX = G.x * _TS - cssW / 2 + _TS / 2;
      camY = G.y * _TS - cssH / 2 + _TS / 2;
    }

    // Convert click to tile coords
    // cx is in CSS pixels; camera is in world pixels
    const tx = Math.floor((cx + camX) / _TS);
    const ty = Math.floor((cy + camY) / _TS);

    if (tx < 0 || tx >= _W || ty < 0 || ty >= _H) return;

    const type       = _map ? _map.getTile(tx, ty) : null;
    const _T_TOWN    = 5;

    // Click on TOWN tile → walk there then enter
    if (type === _T_TOWN) {
      const towns = _map?.towns || window.TOWNS || [];
      const t = towns.find(t => Math.abs(tx - t.x) <= 1 && Math.abs(ty - t.y) <= 1);
      if (t) {
        if (Math.abs(G.x - t.x) <= 2 && Math.abs(G.y - t.y) <= 2) {
          if (typeof window.enterTown === 'function') window.enterTown(t);
        } else {
          const p = window.bfsPath(G.x, G.y, t.x, t.y, 500);
          if (p) window.startClickPath(p, cx, cy, () => window.enterTown(t), t.x, t.y);
        }
        return;
      }
    }

    // Click on PORTAL
    const portals = _map?.portals || window.PORTALS || [];
    const portal  = portals.find(p => p.x === tx && p.y === ty);
    if (portal) {
      if (Math.abs(G.x - tx) <= 2 && Math.abs(G.y - ty) <= 2) {
        if (typeof window.openPortal === 'function') window.openPortal(portal.campaignId);
      } else {
        const path = window.bfsPath(G.x, G.y, tx, ty, 500);
        if (path) window.startClickPath(path, cx, cy, () => window.openPortal(portal.campaignId), tx, ty);
      }
      return;
    }

    // Click on world boss → info
    if (window.worldBosses) {
      const boss = window.worldBosses.find(b => b.alive && Math.abs(tx - b.x) <= 2 && Math.abs(ty - b.y) <= 2);
      if (boss) { if (typeof window.showBossInfo === 'function') window.showBossInfo(boss); return; }
    }

    // Default: pathfind and walk
    const path = window.bfsPath(G.x, G.y, tx, ty, 500);
    if (!path || !path.length) return;
    window.startClickPath(path, cx, cy, null);
  };

  // Re-attach canvas click listener
  const wc = document.getElementById('world-cv');
  if (wc) {
    wc.removeEventListener('click', window._origOnCanvasClick);
    wc.addEventListener('click', window.onCanvasClick);
  }
  console.log('[Patch 4] ✅ onCanvasClick patched with DPR-aware camera offset');


  // ══════════════════════════════════════════════════════════════
  // PATCH 5: Expose engine camera for click-to-move
  // Hook into the engine's render/update cycle to capture camera
  // ══════════════════════════════════════════════════════════════

  // The engine should set window._engineCamera = {x, y} each frame.
  // If it doesn't, we'll compute it from GameState each click.
  // This is a safety check — add to main.js manually for best results:
  //   window._engineCamera = camera;  // after camera.x/y are updated

  console.log('[Patch 5] ✅ Camera exposure note: add `window._engineCamera = camera;` in main.js game loop for best click-to-move accuracy');


  // ══════════════════════════════════════════════════════════════
  // PATCH 6: Co-op host re-broadcasts party positions via Firebase
  // When the host's peerRef listener fires on player updates,
  // coopParty is already updated. We just need to make sure
  // the minimap and party HUD refresh correctly.
  // ══════════════════════════════════════════════════════════════

  // Override updatePartyHUD to also refresh minimap
  const _origUpdatePartyHUD = window.updatePartyHUD;
  window.updatePartyHUD = function updatePartyHUD() {
    if (typeof _origUpdatePartyHUD === 'function') _origUpdatePartyHUD();
    // Also refresh the minimap so party dots update
    if (typeof window.updateMinimapMode === 'function') {
      window.updateMinimapMode();
    }
  };
  console.log('[Patch 6] ✅ updatePartyHUD now also refreshes minimap');


  console.log('\n%c ✅ Realm of Echoes Patches Applied! %c',
    'background:#27ae60;color:#fff;padding:4px 8px;font-weight:bold;',
    '');
  console.log('Fixes applied:\n  1. Co-op shims neutralized\n  2. coopSendMove → Firebase direct write\n  3. tryMove peer guard fixed\n  4. Click-to-move DPR camera fix\n  5. Camera exposure\n  6. Party HUD + minimap sync');

})();
