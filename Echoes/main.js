/* ===============================
  ENGINE BOOTSTRAP (MODULE)
  =============================== */

import { RACES }   from "./engine/data/races.js";
import { CLASSES } from "./engine/data/classes.js";
window.RACES   = RACES;
window.CLASSES = CLASSES;

import { STAT_DEFS }                        from "./engine/data/stats.js";
import { MONSTERS }                         from "./engine/data/monsters.js";
import { LEGENDARY_ITEMS, RARE_ITEMS, UNCOMMON_ITEMS } from "./engine/data/loot.js";
import { CLASS_ABILITIES }                  from "./engine/data/abilities/classAbilities.js";
import { TOWNS }                            from "./engine/data/world/towns.js";
import { CRAFT_RECIPES }                    from "./engine/data/crafting/recipes.js";

import { GameState }    from "./engine/state/GameState.js";
import { loadMap }      from "./engine/supabase/mapLoader.js";
import { loadWorld } from "./engine/supabase/worldLoader.js";

window.loadWorld = loadWorld;
window.loadMap   = loadMap;

import { supabase }    from "./engine/supabase/client.js";
import { renderMap }    from "./engine/render/renderer.js";
import { updateCamera } from "./engine/camera/camera.js";
import { playSound, toggleSound } from "./engine/audio/SoundEngine.js";

import { MultiEngine } from "./engine/multi/MultiEngine.js";
import { MSG }         from "./engine/multi/syncProtocol.js";

import { openCharSheet, closeCharSheet, populateCharSheet } from "./ui/characterSheet.js";
import {
  openGameMenu, closeGameMenu, menuResume, menuSave,
  menuShowSyncInfo, menuPauseCampaign, menuExitCampaign,
  menuReturnToWorld, menuNewChar
} from "./ui/gameMenu.js";
import "../tools/world/overworldGenerator.js";
import "../tools/campaign/persistence/saveWorld.js";
/* ===============================
  GLOBAL BRIDGES
  =============================== */

Object.assign(window, {
  openGameMenu, closeGameMenu, menuResume, menuSave,
  menuShowSyncInfo, menuPauseCampaign, menuExitCampaign,
  menuReturnToWorld, menuNewChar,
  openCharSheet, closeCharSheet, populateCharSheet,
  playSound, toggleSound,
});

Object.assign(window, {
  RACES, CLASSES, STAT_DEFS, MONSTERS, CLASS_ABILITIES,
  TOWNS, CRAFT_RECIPES,
  LEGENDARY_ITEMS, RARE_ITEMS,
  UNCOMMON_LOOT: UNCOMMON_ITEMS,
});

window.worldMap = { width: 0, height: 0, getTile() { return null; } };

// Expose loadMap and supabase so echo.html can load dungeons on the same canvas
window.loadMapById    = loadMap;
window.supabaseClient = supabase;

/* ===============================
  MULTIPLAYER
  =============================== */

const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY", authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT", storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID", appId: "YOUR_APP_ID",
};

const multi = new MultiEngine(FIREBASE_CONFIG, window.G || {});
window.multi = multi;

multi.onPartyUpdate = () => {};
multi.onData = (type, data) => {
  switch(type) {
    case MSG.WELCOME:
      if(data.worldState?.hostX && window.G){ window.G.x=data.worldState.hostX; window.G.y=data.worldState.hostY; } break;
    case MSG.COMBAT_START: if(typeof startCombat==='function') startCombat(data.enemies); break;
    case MSG.CHAT: if(typeof addLog==='function') addLog(`${data.name}: ${data.text}`,'chat'); break;
    case MSG.START_CAMPAIGN: window.location.href=data.url; break;
  }
};
multi.onStatusChange = (r,l,h) => { if(typeof setCoopStatus==='function') setCoopStatus(r,l,h); };
multi.onLog = (t,tag) => { if(typeof addLog==='function') addLog(t,tag); };

window.multiOnPlayerMoved = (x,y) => { if(multi.active) multi.broadcast({type:MSG.PLAYER_MOVE,partyIdx:multi.myPartyIdx,x,y}); };
window.multiOnStatChanged = () => { if(!multi.active||!window.G) return; multi.broadcast({type:MSG.PLAYER_STAT,partyIdx:multi.myPartyIdx,hp:window.G.hp,hpMax:window.G.hpMax,mp:window.G.mp,mpMax:window.G.mpMax}); };
window.multiStartCampaign = (url) => { if(multi.active&&multi.isHost) multi.broadcast({type:MSG.START_CAMPAIGN,url}); window.location.href=url; };
window.multiStartCombat   = (enemies) => { if(multi.active&&multi.isHost) multi.broadcast({type:MSG.COMBAT_START,enemies}); if(typeof startCombat==='function') startCombat(enemies); };

/* ===============================
  ENGINE LOOP
  =============================== */

let canvas, ctx, engineRunning=false, lastFrame=0;

function resizeCanvasToDisplaySize(c) {
  const dpr=window.devicePixelRatio||1;
  const w=Math.floor(c.getBoundingClientRect().width*dpr);
  const h=Math.floor(c.getBoundingClientRect().height*dpr);
  if(c.width!==w||c.height!==h){c.width=w;c.height=h;}
}

function gameLoop(ts) {
  
  resizeCanvasToDisplaySize(canvas);
  GameState.camera.w = canvas.width;
  GameState.camera.h = canvas.height;
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,canvas.width,canvas.height);
  lastFrame = ts;
  updateCamera();
  if(GameState.activeMap && GameState.camera && GameState.player){
    const entities = [{x:GameState.player.x, y:GameState.player.y, cls:GameState.player.cls}];

    // Co-op party members
    if(window.coopActive && Array.isArray(window.coopParty)){
      window.coopParty.forEach(p=>{
        if(!p || p.id===window.coopMyId) return;
        if(p.x==null||p.y==null) return;
        entities.push({x:p.x, y:p.y, cls:(p.cls||'fighter').toLowerCase(),
          isPartyMember:true, color:p.color||'#c090ff', name:p.name});
      });
    }

    // World bosses
    if(Array.isArray(window.worldBosses)){
      for(const b of window.worldBosses)
        if(b.alive) entities.push({x:b.x,y:b.y,cls:'boss',icon:b.icon,name:b.name,isBoss:true});
    }
    renderMap(ctx, GameState.activeMap, GameState.camera, entities);

    // Dungeon: torch FOV darkness overlay
    if(GameState.mode === 'dungeon'){
      const cx = canvas.width/2, cy = canvas.height/2;
      const t = Date.now()/1800;
      const TORCH = canvas.height * 0.45 * (1 + Math.sin(t)*0.02);
      const fog = ctx.createRadialGradient(cx,cy,TORCH*0.25,cx,cy,TORCH*1.6);
      fog.addColorStop(0,'rgba(0,0,0,0)');fog.addColorStop(0.55,'rgba(0,0,0,0.2)');
      fog.addColorStop(0.8,'rgba(0,0,0,0.82)');fog.addColorStop(1,'rgba(0,0,0,0.98)');
      ctx.fillStyle=fog; ctx.fillRect(0,0,canvas.width,canvas.height);
      const warm = ctx.createRadialGradient(cx,cy,0,cx,cy,TORCH*0.5);
      warm.addColorStop(0,`rgba(180,100,20,${0.06+Math.sin(t*1.3)*0.02})`);
      warm.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=warm; ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle='rgba(180,120,60,0.7)';ctx.font="11px 'Cinzel',serif";
      ctx.textAlign='left';ctx.textBaseline='top';
      ctx.fillText('⚔ The Goblin Warrens',12,8);
    }
  }
  requestAnimationFrame(gameLoop);
}

/* ===============================
  STARTUP
  =============================== */

async function startEngine() {
  // Always sync player
  if(window.G && window.G.name) GameState.player = window.G;
  if(window.multi) window.multi.G = window.G || GameState.player;

  if(engineRunning){ console.log("[engine] already running, player synced"); return; }
  engineRunning = true;

  canvas = document.getElementById("world-cv");
  ctx    = canvas.getContext("2d");
  window._engineCtx = ctx;

  GameState.camera.w = canvas.width;
  GameState.camera.h = canvas.height;

  try {
  GameState.activeMap = await loadWorld("overworld_C");
  GameState.currentWorldId = "overworld_C";

  // Spawn player near center
  GameState.player.x = Math.floor(GameState.activeMap.width / 2);
  GameState.player.y = Math.floor(GameState.activeMap.height / 2);

} catch (e) {
  console.error("[engine] map load failed:", e.message);
}

if (GameState.activeMap) {
  window.MAP_W = GameState.activeMap.width;
  window.MAP_H = GameState.activeMap.height;
  window.worldMap.width  = GameState.activeMap.width;
  window.worldMap.height = GameState.activeMap.height;
}

setupInput();
window.engineReady = true;
console.log("✅ Engine ready");
requestAnimationFrame(gameLoop);
}

function setupInput() {
  // WASD movement is handled by onKey() in echo.html via registerInput()
  // Nothing needed here — kept as hook for future engine input
}

window.startEngine = startEngine;
window.dispatchEvent(new Event('module-ready'));
