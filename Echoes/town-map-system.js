/**
 * REALM OF ECHOES — Town Map System
 * Towns now load as JSON maps on the game canvas, just like dungeons.
 * Services (inn, shop etc.) are triggered by walking onto special tiles.
 *
 * TILE CONSTANTS (town-specific):
 *   20 = TOWN_FLOOR     (stone/cobble, walkable)
 *   21 = TOWN_WALL      (building wall, impassable)
 *   22 = TOWN_INN       (walkable, triggers inn)
 *   23 = TOWN_SHOP      (walkable, triggers shop)
 *   24 = TOWN_TEMPLE    (walkable, triggers temple)
 *   25 = TOWN_TAVERN    (walkable, triggers tavern)
 *   26 = TOWN_VENDOR    (walkable, triggers vendor/fence)
 *   27 = TOWN_CRAFT     (walkable, triggers alchemist)
 *   28 = TOWN_EXIT      (walkable, triggers return to world)
 *   29 = TOWN_DECO      (fountain/statue, impassable)
 *
 * ADD THIS FILE: <script src="./Echoes/town-map-system.js"></script>
 * Load order: after patch-v3.js, equipment-system.js, paperdoll-fix.js
 */

(function installTownMapSystem() {

  // ══════════════════════════════════════════════════════════════
  // TILE CONSTANTS
  // ══════════════════════════════════════════════════════════════

  const T = {
    FLOOR:  20, WALL:   21, INN:    22, SHOP:   23,
    TEMPLE: 24, TAVERN: 25, VENDOR: 26, CRAFT:  27,
    EXIT:   28, DECO:   29,
  };
  window.TOWN_TILES = T;

  // Passable town tiles
  const TOWN_PASSABLE = new Set([T.FLOOR, T.INN, T.SHOP, T.TEMPLE, T.TAVERN, T.VENDOR, T.CRAFT, T.EXIT]);

  // Service tile → service type string
  const TILE_SERVICE = {
    [T.INN]:    'inn',
    [T.SHOP]:   'shop',
    [T.TEMPLE]: 'temple',
    [T.TAVERN]: 'tavern',
    [T.VENDOR]: 'vendor',
    [T.CRAFT]:  'craft',
  };

  // Service display config
  const SERVICE_CFG = {
    inn:    { icon:'🏨', label:'Inn',        color:'#c8824a' },
    shop:   { icon:'⚒',  label:'Shop',       color:'#4a9eff' },
    temple: { icon:'✝',  label:'Temple',     color:'#c090ff' },
    tavern: { icon:'🍺', label:'Tavern',     color:'#c8a84a' },
    vendor: { icon:'💰', label:'Fence',      color:'#60c070' },
    craft:  { icon:'⚗',  label:'Alchemist',  color:'#60c0c0' },
    exit:   { icon:'🌍', label:'Leave Town', color:'#60c060' },
  };

  // Town tile render colors (used by renderer patch below)
  window.TOWN_TILE_COLORS = {
    [T.FLOOR]:  '#6a6058',
    [T.WALL]:   '#2a2018',
    [T.INN]:    '#7a5030',
    [T.SHOP]:   '#2a4a6a',
    [T.TEMPLE]: '#5a3a7a',
    [T.TAVERN]: '#4a3010',
    [T.VENDOR]: '#2a4a2a',
    [T.CRAFT]:  '#1a4a4a',
    [T.EXIT]:   '#2a5a2a',
    [T.DECO]:   '#303030',
  };


  // ══════════════════════════════════════════════════════════════
  // PROCEDURAL TOWN GENERATOR
  // Builds a 40×40 town map when no Supabase map exists.
  // Layout: surrounded by walls, cobble floor, buildings around edges,
  //         services placed at fixed spots, exit at south center.
  // ══════════════════════════════════════════════════════════════

  function generateTownMap(town) {
    const W = 40, H = 40;
    const tiles = new Array(W * H).fill(T.FLOOR);

    const set = (x, y, t) => { if (x>=0&&x<W&&y>=0&&y<H) tiles[y*W+x] = t; };
    const fill = (x1,y1,x2,y2,t) => {
      for (let y=y1; y<=y2; y++) for (let x=x1; x<=x2; x++) set(x,y,t);
    };

    // Border walls
    for (let i=0; i<W; i++) { set(i,0,T.WALL); set(i,H-1,T.WALL); }
    for (let i=0; i<H; i++) { set(0,i,T.WALL); set(W-1,i,T.WALL); }

    // Exit (gap in south wall, center)
    set(19,H-1,T.EXIT); set(20,H-1,T.EXIT); set(21,H-1,T.EXIT);

    // ── Service buildings ──────────────────────────────────────
    // Each building: outer wall box, inner service tile, sign tile

    // INN — top-left area
    fill(2,2,10,9,T.WALL);
    fill(3,3,9,8,T.FLOOR);
    fill(5,4,8,7,T.INN);
    set(6,9,T.INN); set(7,9,T.INN); // doorway

    // SHOP — top-right area
    fill(29,2,37,9,T.WALL);
    fill(30,3,36,8,T.FLOOR);
    fill(31,4,35,7,T.SHOP);
    set(32,9,T.SHOP); set(33,9,T.SHOP); // doorway

    // TEMPLE — top-center
    fill(16,2,23,10,T.WALL);
    fill(17,3,22,9,T.FLOOR);
    fill(18,4,21,8,T.TEMPLE);
    set(19,10,T.TEMPLE); set(20,10,T.TEMPLE); // doorway

    // TAVERN — mid-left
    fill(2,15,10,23,T.WALL);
    fill(3,16,9,22,T.FLOOR);
    fill(4,17,8,21,T.TAVERN);
    set(6,23,T.TAVERN); set(7,23,T.TAVERN);

    // VENDOR / FENCE — mid-right
    fill(29,15,37,23,T.WALL);
    fill(30,16,36,22,T.FLOOR);
    fill(31,17,35,21,T.VENDOR);
    set(32,23,T.VENDOR); set(33,23,T.VENDOR);

    // CRAFT / ALCHEMIST — bottom-left
    fill(2,28,12,36,T.WALL);
    fill(3,29,11,35,T.FLOOR);
    fill(4,30,10,34,T.CRAFT);
    set(7,36,T.CRAFT); set(8,36,T.CRAFT);

    // Fountain / decoration — center
    fill(17,17,22,22,T.DECO);
    // Surrounding floor
    fill(15,15,24,24,T.FLOOR);
    fill(17,17,22,22,T.DECO);

    // Town tier affects services available
    const tier = window.getTownTier?.(town) ?? 0;
    // Higher tier towns get a second shop
    if (tier >= 2) {
      fill(27,28,37,36,T.WALL);
      fill(28,29,36,35,T.FLOOR);
      fill(29,30,35,34,T.SHOP);
      set(31,36,T.SHOP); set(32,36,T.SHOP);
    }

    // Entry path from south (clear corridor)
    for (let y=H-3; y<H-1; y++) {
      set(19,y,T.FLOOR); set(20,y,T.FLOOR); set(21,y,T.FLOOR);
    }

    return {
      id:       town.id || town.name?.toLowerCase().replace(/\s+/g,'_') || 'town',
      name:     town.name || 'Town',
      type:     'town',
      width:    W,
      height:   H,
      tiles,
      entry:    { x:20, y:H-2 },
      exit:     { x:20, y:H-1 },
      services: buildServiceList(tiles, W, H, town),
      generated: true,
      getTile(x,y) {
        if (x<0||y<0||x>=this.width||y>=this.height) return T.WALL;
        return this.tiles[y*this.width+x] ?? T.WALL;
      }
    };
  }

  function buildServiceList(tiles, W, H, town) {
    const services = [];
    const seen = new Set();
    for (let y=0; y<H; y++) {
      for (let x=0; x<W; x++) {
        const t = tiles[y*W+x];
        const svc = TILE_SERVICE[t];
        if (svc && !seen.has(svc)) {
          seen.add(svc);
          services.push({ type:svc, x, y });
        }
      }
    }
    return services;
  }


  // ══════════════════════════════════════════════════════════════
  // ENTER TOWN MAP
  // ══════════════════════════════════════════════════════════════

  window.enterTownMap = async function enterTownMap(town) {
    const GS = window.GameState;
    const G  = window.G;
    if (!GS || !G) return;

    // Close old HTML overlay if open
    document.getElementById('ov-town')?.classList.remove('active');

    // Save world return point
    GS.returnMap  = GS.activeMap;
    GS.returnX    = G.x;
    GS.returnY    = G.y;
    GS.mode       = 'town';
    GS.currentTown = town;
    G.inTown      = false; // allow movement inside town
    G.inCombat    = false;

    // Close any open floating service panel
    closeTownServicePanel();

    window.toast?.(`Entering ${town.name}…`);

    let townMap = null;

    // Try loading from Supabase first
    const supabase = window.supabaseClient;
    const townId   = town.id || town.name?.toLowerCase().replace(/\s+/g,'_');

    if (supabase && townId) {
      try {
        const { data, error } = await supabase
          .from('maps')
          .select('json')
          .eq('id', townId)
          .eq('type', 'town')   // only fetch town-type maps
          .maybeSingle();

        if (!error && data?.json) {
          const raw = typeof data.json === 'string' ? JSON.parse(data.json) : data.json;
          const tiles = Array.isArray(raw.tiles) ? raw.tiles : Array.from(raw.tiles||[]);
          townMap = {
            ...raw, tiles,
            getTile(x,y) {
              if (x<0||y<0||x>=this.width||y>=this.height) return T.WALL;
              return this.tiles[y*this.width+x] ?? T.WALL;
            }
          };
          console.log('[enterTownMap] Loaded from Supabase:', townId);
        }
      } catch(e) {
        console.warn('[enterTownMap] Supabase load failed, using generated map:', e.message);
      }
    }

    // Fall back to procedural generation
    if (!townMap) {
      townMap = generateTownMap(town);
      console.log('[enterTownMap] Using generated map for:', town.name);
    }

    GS.activeMap = townMap;
    window.MAP_W = townMap.width;
    window.MAP_H = townMap.height;

    // Spawn at entry
    const ex = townMap.entry?.x ?? Math.floor(townMap.width  / 2);
    const ey = townMap.entry?.y ?? townMap.height - 2;
    G.x = ex; G.y = ey; G.prevX = ex; G.prevY = ey;
    GS.player = G;

    // Reset fog for town (towns are fully visible)
    window._visitedTiles = new Set();
    for (let y=0; y<townMap.height; y++) {
      for (let x=0; x<townMap.width; x++) {
        window._visitedTiles.add(`${x},${y}`);
      }
    }

    // Set up town-specific shop inventory based on town tier
    window.currentTown = town;
    if (typeof window.buildShop === 'function') window.buildShop();

    window.updateMinimapMode?.();
    window.addLog?.(`You enter ${town.name}.`, 'disc');
    window.playSound?.('town');
    window.updateHUD?.();
    window.render?.();

    // Show the town name briefly as a floating label
    showTownNameBanner(town.name);
  };


  // ══════════════════════════════════════════════════════════════
  // LEAVE TOWN MAP
  // ══════════════════════════════════════════════════════════════

  window.leaveTownMap = function leaveTownMap() {
    const GS = window.GameState;
    const G  = window.G;
    if (!GS || !G) return;

    closeTownServicePanel();

    if (GS.returnMap) {
      GS.activeMap = GS.returnMap;
      GS.returnMap = null;
    }

    G.x = GS.returnX ?? G.x;
    G.y = GS.returnY ?? G.y;
    G.prevX = G.x;
    G.prevY = G.y;
    GS.player = G;
    GS.mode   = 'world';
    GS.currentTown = null;
    window.currentTown = null;

    window.MAP_W = GS.activeMap.width;
    window.MAP_H = GS.activeMap.height;

    // Restore world fog
    window._visitedTiles = window._worldVisitedTiles || new Set();

    window.updateMinimapMode?.();
    window.addLog?.('You step back into the world.', 'disc');
    window.updateHUD?.();
    window.render?.();

    // Give a brief encounter cooldown so player isn't immediately attacked
    if (window.G) window.G.encounterCooldown = 15;
  };

  // Keep old leaveTown working too
  window.leaveTown = function leaveTown() {
    if (window.GameState?.mode === 'town') {
      window.leaveTownMap();
    } else {
      // Legacy HTML overlay close
      document.getElementById('ov-town')?.classList.remove('active');
      if (window.G) { window.G.inTown = false; window.G.inCombat = false; }
      window.addLog?.('You step back into the world.');
      window.render?.(); window.updateHUD?.();
    }
  };


  // ══════════════════════════════════════════════════════════════
  // TOWN TILE INTERACTION — called from tryMove
  // ══════════════════════════════════════════════════════════════

  window.handleTownTile = function handleTownTile(tileType, x, y) {
    if (tileType === T.EXIT) {
      // Show confirm prompt near exit
      showExitPrompt();
      return;
    }

    const svcType = TILE_SERVICE[tileType];
    if (svcType) {
      const town = window.GameState?.currentTown || window.currentTown;
      showTownServicePanel(svcType, town);
    }
  };

  // Patch tryMove to handle town tiles
  const _origTryMove = window.tryMove;
  window.tryMove = function tryMove(dx, dy) {
    const G  = window.G;
    const GS = window.GameState;
    if (!G) return;

    // ── INSIDE a town map ─────────────────────────────────────
    if (GS?.mode === 'town') {
      const map = GS.activeMap;
      if (!map) return;

      const nx = G.x + dx, ny = G.y + dy;
      if (nx<0||nx>=map.width||ny<0||ny>=map.height) return;

      const tileType = map.getTile(nx, ny);
      if (!TOWN_PASSABLE.has(tileType)) return;

      G.prevX = G.x; G.prevY = G.y;
      G.x = nx; G.y = ny;
      GS.player = G;

      window.handleTownTile(tileType, nx, ny);

      if (!G._stepCount) G._stepCount = 0; G._stepCount++;
      if (G._stepCount % 4 === 0) window.playSound?.('step');
      window.render?.();
      window.updateHUD?.();
      return;
    }

    // ── WORLD mode: intercept tile 5 (TOWN) before closure tryMove ──
    // index.html's tryMove calls `enterTown(town)` which is a closure
    // reference and ignores window.enterTown overrides. We intercept here.
    if (GS?.mode === 'world' || !GS?.mode) {
      const map = GS?.activeMap;
      if (map) {
        const nx = G.x + dx, ny = G.y + dy;
        const tileType = map.getTile?.(nx, ny);
        if (tileType === 5) { // TOWN tile
          // Find which town this is
          const towns = map.towns || window.TOWNS || [];
          const town  = towns.find(t => Math.abs(t.x - nx) <= 1 && Math.abs(t.y - ny) <= 1);
          if (town && !G.inCombat) {
            // Move player onto the tile first
            G.prevX = G.x; G.prevY = G.y;
            G.x = nx; G.y = ny;
            GS.player = G;
            enterTownMap(town);
            return;
          }
        }
      }
    }

    // All other movement — pass to original (patch-v3 → index.html closure)
    _origTryMove?.(dx, dy);
  };

  // Also override window.enterTown as a fallback for any direct calls
  window.enterTown = function enterTown(town) {
    if (!town) return;
    enterTownMap(town);
  };


  // ══════════════════════════════════════════════════════════════
  // FLOATING SERVICE PANEL
  // Appears over the canvas when player walks onto a service tile.
  // Much cleaner than the old full-screen overlay.
  // ══════════════════════════════════════════════════════════════

  let _servicePanelOpen = null;

  function showTownServicePanel(svcType, town) {
    // Don't re-open same panel
    if (_servicePanelOpen === svcType) return;
    closeTownServicePanel();
    _servicePanelOpen = svcType;

    const cfg   = SERVICE_CFG[svcType] || { icon:'🏠', label:svcType, color:'#888' };
    const panel = document.createElement('div');
    panel.id    = 'town-service-panel';
    panel.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 200;
      background: linear-gradient(160deg,#0e0a06,#06030a);
      border: 1px solid ${cfg.color}88;
      border-radius: 6px;
      padding: 16px 20px;
      min-width: 320px;
      max-width: 480px;
      max-height: 60vh;
      overflow-y: auto;
      font-family: 'Cinzel',serif;
      box-shadow: 0 4px 30px rgba(0,0,0,.7), 0 0 20px ${cfg.color}22;
    `;

    // Build inner content based on service type
    const content = buildServiceContent(svcType, town);
    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;border-bottom:1px solid ${cfg.color}44;padding-bottom:10px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:1.4rem;">${cfg.icon}</span>
          <div>
            <div style="font-size:.8rem;color:${cfg.color};letter-spacing:2px;">${cfg.label}</div>
            <div style="font-size:.6rem;color:var(--parch-dk);">${town?.name || 'Town'}</div>
          </div>
        </div>
        <button id="tsp-close" style="background:transparent;border:1px solid rgba(74,46,16,.5);color:var(--parch-dk);
          font-family:'Cinzel',serif;font-size:.6rem;padding:4px 10px;cursor:pointer;border-radius:2px;">✕ Close</button>
      </div>
      <div id="tsp-body">${content}</div>
    `;

    document.body.appendChild(panel);
    document.getElementById('tsp-close').onclick = closeTownServicePanel;

    // Auto-close when player moves away (distance check)
    window._tspCheckInterval = setInterval(() => {
      const G   = window.G;
      const GS  = window.GameState;
      if (!G || GS?.mode !== 'town' || !GS?.activeMap) {
        closeTownServicePanel(); return;
      }
      const currentTile = GS.activeMap.getTile(G.x, G.y);
      const currentSvc  = TILE_SERVICE[currentTile];
      if (currentSvc !== svcType) closeTownServicePanel();
    }, 500);
  }

  function closeTownServicePanel() {
    clearInterval(window._tspCheckInterval);
    document.getElementById('town-service-panel')?.remove();
    _servicePanelOpen = null;
  }
  window.closeTownServicePanel = closeTownServicePanel;

  function buildServiceContent(svcType, town) {
    const G    = window.G;
    const gold = G?.gold ?? 0;
    const tier = window.getTownTier?.(town) ?? 0;

    switch(svcType) {

      case 'inn': {
        const shortCost = 5  + tier * 3;
        const longCost  = 15 + tier * 8;
        return `
          <div style="font-size:.68rem;color:var(--parch-dk);margin-bottom:10px;">
            Rest your weary bones. <span style="color:var(--gold)">💰 ${gold} gp</span>
          </div>
          <div class="tsp-option" onclick="doTownRest('short',${shortCost})">
            <div>
              <div class="tsp-opt-title">Short Rest</div>
              <div class="tsp-opt-desc">Recover 25% HP &amp; MP</div>
            </div>
            <button class="tsp-btn ${gold>=shortCost?'':'disabled'}">${shortCost} gp</button>
          </div>
          <div class="tsp-option" onclick="doTownRest('long',${longCost})">
            <div>
              <div class="tsp-opt-title">Long Rest</div>
              <div class="tsp-opt-desc">Full HP &amp; MP recovery</div>
            </div>
            <button class="tsp-btn ${gold>=longCost?'':'disabled'}">${longCost} gp</button>
          </div>`;
      }

      case 'shop': {
        // Build shop items for this town tier
        const shopItems = window.buildShopForTown?.(town) || [];
        window._townShopItems = shopItems;
        if (!shopItems.length) return '<div style="color:var(--parch-dk);font-size:.7rem;">Nothing in stock.</div>';
        return shopItems.map((item, i) => {
          const canAfford = gold >= item.price;
          const tc = {common:'#aaa',uncommon:'#4a9eff',rare:'#c060ff',legendary:'#ffd700'}[item.tier]||'#aaa';
          return `<div class="tsp-option" style="border-left:2px solid ${tc}40;">
            <div style="flex:1;">
              <div class="tsp-opt-title" style="color:${tc};">${item.icon} ${item.name}</div>
              <div class="tsp-opt-desc">${item.desc}</div>
            </div>
            <button class="tsp-btn${canAfford?'':' disabled'}" onclick="buyTownItem(${i})">${item.price}gp</button>
          </div>`;
        }).join('');
      }

      case 'temple': {
        const healCost   = 10 + tier * 5;
        const reviveCost = 50 + tier * 20;
        return `
          <div class="tsp-option" onclick="doTownTemple('heal',${healCost})">
            <div>
              <div class="tsp-opt-title">Blessing of Healing</div>
              <div class="tsp-opt-desc">Restore 50% HP</div>
            </div>
            <button class="tsp-btn ${gold>=healCost?'':'disabled'}">${healCost} gp</button>
          </div>
          <div class="tsp-option" onclick="doTownTemple('revive',${reviveCost})">
            <div>
              <div class="tsp-opt-title">Resurrection Rite</div>
              <div class="tsp-opt-desc">Revive from near death (1 HP)</div>
            </div>
            <button class="tsp-btn ${gold>=reviveCost?'':'disabled'}">${reviveCost} gp</button>
          </div>`;
      }

      case 'tavern': {
        const rumours = (town?.rumours || [
          'Strange lights have been seen near the old ruins to the north.',
          'A merchant offered a fortune for goblin ears. Something big is coming.',
          'The old dungeon sealed itself years ago. Now the door is open again.',
          'They say the world bosses stir when the moons align.',
          'Bring enough gold and the fence asks no questions.',
        ]).slice(0,4);
        return `
          <div style="font-size:.65rem;color:var(--parch-dk);margin-bottom:10px;font-style:italic;">
            You pull up a stool. The barkeep leans in…
          </div>
          ${rumours.map(r=>`
            <div style="padding:8px 0;border-bottom:1px solid rgba(74,46,16,.3);font-size:.72rem;color:var(--parch-dk);font-style:italic;">
              "…${r}"
            </div>`).join('')}`;
      }

      case 'vendor': {
        const sellable = (window.G?.inventory||[]).filter(i=>i&&i.type==='misc');
        if (!sellable.length) return `<div style="color:var(--parch-dk);font-size:.7rem;font-style:italic;">
          "You got nothin' I want. Come back when you've been somewhere interesting."
        </div>`;
        return `
          <div style="font-size:.65rem;color:var(--parch-dk);margin-bottom:8px;font-style:italic;">
            "I don't ask questions. You get 40% of market value."
          </div>
          ${sellable.map((item,i)=>{
            const idx  = window.G.inventory.indexOf(item);
            const val  = window.sellValue?.(item) ?? Math.floor((item.price||10)*0.4);
            return `<div class="tsp-option">
              <div class="tsp-opt-title">${item.icon||'📦'} ${item.name}${(item.qty||1)>1?' x'+item.qty:''}</div>
              <button class="tsp-btn" onclick="sellTownItem(${idx})">${val}gp</button>
            </div>`;
          }).join('')}
          <div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(74,46,16,.3);display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:.65rem;color:var(--parch-dk);">Sell all misc loot:</span>
            <button class="tsp-btn" onclick="sellAllTownItems()">Sell All</button>
          </div>`;
      }

      case 'craft': {
        const CRAFT = window.CRAFT_RECIPES || [];
        if (!CRAFT.length) return '<div style="color:var(--parch-dk);font-size:.7rem;">No recipes available.</div>';
        return CRAFT.map((recipe,ri)=>{
          const needed={};
          recipe.ingredients.forEach(ing=>needed[ing]=(needed[ing]||0)+1);
          const have={};
          (window.G?.inventory||[]).filter(i=>i).forEach(i=>have[i.name]=(have[i.name]||0)+(i.qty||1));
          const canCraft=Object.entries(needed).every(([n,c])=>(have[n]||0)>=c);
          const ingList=Object.entries(needed).map(([n,c])=>
            `<span style="color:${(have[n]||0)>=c?'#7bc47b':'#c47b7b'};font-size:.6rem;">${c>1?c+'× ':''}${n}</span>`
          ).join(' + ');
          return `<div class="tsp-option" style="flex-direction:column;align-items:flex-start;gap:4px;">
            <div style="display:flex;justify-content:space-between;width:100%;align-items:center;">
              <div class="tsp-opt-title">${recipe.icon||'⚗'} ${recipe.name}</div>
              <button class="tsp-btn${canCraft?'':' disabled'}" onclick="doCraft(${ri})">${canCraft?'Craft':'Missing'}</button>
            </div>
            <div>${ingList}</div>
            <div class="tsp-opt-desc">→ ${recipe.result?.desc||''}</div>
          </div>`;
        }).join('');
      }

      default:
        return `<div style="color:var(--parch-dk);font-size:.7rem;">Service not available.</div>`;
    }
  }

  // ── Service action handlers ──────────────────────────────────

  window.doTownRest = function doTownRest(type, cost) {
    const G = window.G;
    if (!G) return;
    if (G.gold < cost) { window.toast?.('Not enough gold!','err'); return; }
    G.gold -= cost;
    if (type === 'short') {
      G.hp = Math.min(G.hpMax, G.hp + Math.floor(G.hpMax * 0.25));
      G.mp = Math.min(G.mpMax, G.mp + Math.floor(G.mpMax * 0.25));
      window.addLog?.('Short rest — recovered 25% HP & MP.','sys');
      window.toast?.('Short rest complete.');
    } else {
      G.hp = G.hpMax; G.mp = G.mpMax;
      window.addLog?.('Long rest — fully recovered!','sys');
      window.toast?.('Fully healed!');
    }
    window.updateHUD?.(); window.saveGame?.();
    // Refresh panel
    closeTownServicePanel();
    setTimeout(() => showTownServicePanel('inn', window.GameState?.currentTown), 100);
  };

  window.buyTownItem = function buyTownItem(idx) {
    const G    = window.G;
    const item = window._townShopItems?.[idx];
    if (!G || !item) return;
    if (G.gold < item.price) { window.toast?.('Not enough gold!','err'); return; }
    if (!window.addToInventory?.({ ...item })) return;
    G.gold -= item.price;
    window.addLog?.(`Bought ${item.name} for ${item.price} gp.`,'sys');
    window.toast?.(`Purchased: ${item.name}`);
    window.playSound?.('buy');
    window.updateHUD?.(); window.saveGame?.();
    // Refresh panel
    closeTownServicePanel();
    setTimeout(() => showTownServicePanel('shop', window.GameState?.currentTown), 100);
  };

  window.doTownTemple = function doTownTemple(type, cost) {
    const G = window.G;
    if (!G) return;
    if (G.gold < cost) { window.toast?.('Not enough gold!','err'); return; }
    G.gold -= cost;
    if (type === 'heal') {
      G.hp = Math.min(G.hpMax, G.hp + Math.floor(G.hpMax * 0.5));
      window.addLog?.('Temple blessing — 50% HP restored.','sys');
      window.toast?.('Blessings received!');
    } else {
      G.hp = 1;
      window.addLog?.('Resurrection rite complete.','sys');
      window.toast?.("Returned from death's door!");
    }
    window.updateHUD?.(); window.saveGame?.();
    closeTownServicePanel();
    setTimeout(() => showTownServicePanel('temple', window.GameState?.currentTown), 100);
  };

  window.sellTownItem = function sellTownItem(idx) {
    const G = window.G;
    if (!G) return;
    const item = G.inventory[idx];
    if (!item) return;
    const val = window.sellValue?.(item) ?? Math.floor((item.price||10)*0.4);
    G.gold += val * (item.qty||1);
    G.inventory.splice(idx,1);
    window.addLog?.(`Sold ${item.name} for ${val*(item.qty||1)} gp.`,'loot');
    window.toast?.(`+${val*(item.qty||1)} gp`);
    window.updateHUD?.(); window.saveGame?.();
    closeTownServicePanel();
    setTimeout(() => showTownServicePanel('vendor', window.GameState?.currentTown), 100);
  };

  window.sellAllTownItems = function sellAllTownItems() {
    const G = window.G;
    if (!G) return;
    const sellable = G.inventory.filter(i=>i&&i.type==='misc');
    if (!sellable.length) { window.toast?.('Nothing to sell!','err'); return; }
    let total = 0;
    sellable.forEach(item => {
      total += (window.sellValue?.(item) ?? Math.floor((item.price||10)*0.4)) * (item.qty||1);
      G.inventory.splice(G.inventory.indexOf(item), 1);
    });
    G.gold += total;
    window.addLog?.(`Sold all loot for ${total} gp.`,'loot');
    window.toast?.(`+${total} gp — sold everything!`);
    window.updateHUD?.(); window.saveGame?.();
    closeTownServicePanel();
    setTimeout(() => showTownServicePanel('vendor', window.GameState?.currentTown), 100);
  };

  // ── Exit prompt ───────────────────────────────────────────────

  function showExitPrompt() {
    if (document.getElementById('town-exit-prompt')) return;
    const d = document.createElement('div');
    d.id = 'town-exit-prompt';
    d.style.cssText = `position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
      z-index:201;background:linear-gradient(160deg,#0a0806,#060308);
      border:1px solid rgba(74,160,74,.5);border-radius:6px;
      padding:14px 20px;font-family:'Cinzel',serif;
      box-shadow:0 4px 20px rgba(0,0,0,.7);text-align:center;`;
    d.innerHTML = `
      <div style="font-size:.75rem;color:var(--parch-lt);margin-bottom:10px;">Leave town and return to the world?</div>
      <div style="display:flex;gap:8px;justify-content:center;">
        <button onclick="leaveTownMap();document.getElementById('town-exit-prompt')?.remove();"
          style="font-family:'Cinzel',serif;font-size:.65rem;padding:6px 16px;
          border:1px solid #60c060;color:#60c060;background:rgba(40,80,40,.2);cursor:pointer;border-radius:2px;">
          🌍 Leave Town
        </button>
        <button onclick="document.getElementById('town-exit-prompt')?.remove();"
          style="font-family:'Cinzel',serif;font-size:.65rem;padding:6px 16px;
          border:1px solid rgba(74,46,16,.5);color:var(--parch-dk);background:transparent;cursor:pointer;border-radius:2px;">
          Stay
        </button>
      </div>`;
    document.body.appendChild(d);
    setTimeout(() => d?.remove(), 8000);
  }


  // ══════════════════════════════════════════════════════════════
  // TOWN NAME BANNER
  // ══════════════════════════════════════════════════════════════

  function showTownNameBanner(name) {
    const el = document.getElementById('town-name-banner') || (() => {
      const d = document.createElement('div');
      d.id = 'town-name-banner';
      d.style.cssText = `position:fixed;top:80px;left:50%;transform:translateX(-50%);
        z-index:150;font-family:'Cinzel Decorative',serif;font-size:1.1rem;
        color:var(--gold-b);letter-spacing:4px;text-transform:uppercase;
        text-shadow:0 0 20px rgba(201,162,39,.6);pointer-events:none;
        opacity:0;transition:opacity .4s;`;
      document.body.appendChild(d);
      return d;
    })();
    el.textContent  = name;
    el.style.opacity = '1';
    setTimeout(() => { el.style.opacity = '0'; }, 2500);
  }


  // ══════════════════════════════════════════════════════════════
  // RENDERER PATCH — add to main.js TOWN_TILE_COLORS
  // The engine in main.js needs to know how to render town tiles.
  // We expose the colors and patch the tile render lookup.
  // ══════════════════════════════════════════════════════════════

  // Expose for main.js renderer
  window.TOWN_TILE_COLORS = {
    20: '#6a6058',  // floor - stone
    21: '#1e1810',  // wall  - dark
    22: '#7a5030',  // inn   - warm brown
    23: '#1a3a5a',  // shop  - blue
    24: '#4a2a6a',  // temple - purple
    25: '#3a2808',  // tavern - dark wood
    26: '#1a3a1a',  // vendor - dark green
    27: '#102a2a',  // craft  - teal
    28: '#1a4a1a',  // exit   - green
    29: '#252015',  // deco   - stone grey
  };

  // Service icons for rendering on canvas (shown on service tiles)
  window.TOWN_TILE_ICONS = {
    22: '🏨', 23: '⚒', 24: '✝', 25: '🍺', 26: '💰', 27: '⚗', 28: '🌍'
  };

  // Town tile passability for BFS pathfinding click-to-move
  window.TOWN_PASSABLE_SET = TOWN_PASSABLE;


  // ══════════════════════════════════════════════════════════════
  // CSS for floating service panel
  // ══════════════════════════════════════════════════════════════

  const css = `
#town-service-panel { scrollbar-width: thin; scrollbar-color: rgba(74,46,16,.5) transparent; }
.tsp-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 8px;
  border-bottom: 1px solid rgba(74,46,16,.3);
  gap: 12px;
  cursor: default;
}
.tsp-option:last-child { border-bottom: none; }
.tsp-opt-title { font-size:.72rem; color:var(--parch-lt); margin-bottom:2px; }
.tsp-opt-desc  { font-size:.6rem;  color:var(--parch-dk); }
.tsp-btn {
  font-family: 'Cinzel',serif;
  font-size: .6rem;
  padding: 5px 12px;
  border: 1px solid var(--gold-b);
  color: var(--gold-b);
  background: rgba(201,162,39,.1);
  cursor: pointer;
  border-radius: 2px;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background .15s;
}
.tsp-btn:hover { background: rgba(201,162,39,.2); }
.tsp-btn.disabled { opacity:.4; cursor:not-allowed; pointer-events:none; }
#town-name-banner { font-family:'Cinzel Decorative',serif; }
  `;

  const style = document.createElement('style');
  style.id = 'town-map-system-css';
  style.textContent = css;
  document.head.appendChild(style);


  // ══════════════════════════════════════════════════════════════
  // MAIN.JS RENDERER PATCH NOTE
  // In your Echoes/main.js, find where tile colors are defined
  // (something like TILE_COLORS or a switch/object mapping tile
  //  numbers to hex colors) and add these entries:
  //
  //   ...Object.entries(window.TOWN_TILE_COLORS).reduce((acc,[k,v]) => {
  //     acc[k] = v; return acc;
  //   }, {}),
  //
  // OR if it's a switch statement, add cases 20-29.
  //
  // Also in the tile render loop, after drawing the tile color,
  // add this to draw service icons:
  //
  //   const svcIcon = window.TOWN_TILE_ICONS?.[tileType];
  //   if (svcIcon) {
  //     ctx.font = `${tileSize * 0.6}px serif`;
  //     ctx.textAlign = 'center';
  //     ctx.textBaseline = 'middle';
  //     ctx.fillText(svcIcon, screenX + tileSize/2, screenY + tileSize/2);
  //   }
  // ══════════════════════════════════════════════════════════════

  console.log('[Town Map System] ✅ Loaded — towns now render on canvas');
  console.log('[Town Map System] 📝 Add town tile colors to main.js renderer (see MAIN.JS RENDERER PATCH NOTE)');

})();
