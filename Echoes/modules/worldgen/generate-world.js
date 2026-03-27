// ╔══════════════════════════════════════════════════════╗
// ║                  WORLD MAP                          ║
// ╚══════════════════════════════════════════════════════╝
const TILE=32, MAP_W=240, MAP_H=180;
const T={GRASS:0,FOREST:1,MOUNTAIN:2,DEEP_WATER:3,SHALLOW:4,TOWN:5,DANGER:6,SAND:7,PORTAL:8};
const PASSABLE=new Set([T.GRASS,T.FOREST,T.MOUNTAIN,T.TOWN,T.DANGER,T.SAND,T.PORTAL]);
const TILE_COLORS={
  [T.GRASS]:    ['#3a6b30','#4a7a38','#355e2a','#3d7032'],
  [T.FOREST]:   ['#1e4a1a','#163a14','#1a4218','#244e1e'],
  [T.MOUNTAIN]: ['#5a4e3a','#6a5c46','#504438','#5e5040'],
  [T.DEEP_WATER]:['#1a3f6b','#153560','#1e4878','#163a6a'],
  [T.SHALLOW]:  ['#2a6080','#236878','#206070','#2a6a88'],
  [T.TOWN]:     ['#8b7355','#9a8060','#7d6448','#a08a68'],
  [T.DANGER]:   ['#4a1515','#5a1c1c','#3e1010','#521818'],
  [T.SAND]:     ['#c4a96a','#b89a58','#cdb278','#c0a464'],
  [T.PORTAL]:   ['#1a0a2e','#1a0a2e','#1a0a2e','#1a0a2e'],
};

function buildWorld(){
  const m=new Uint8Array(MAP_W*MAP_H).fill(T.GRASS);
  const SX=120,SY=90; // spawn centre
  function s(x,y,t){if(x>=0&&x<MAP_W&&y>=0&&y<MAP_H)m[y*MAP_W+x]=t;}
  function fill(x1,y1,x2,y2,t){for(let y=y1;y<=y2;y++)for(let x=x1;x<=x2;x++)s(x,y,t);}
  function blob(cx,cy,r,t,ir=0.45){
    for(let y=cy-r-2;y<=cy+r+2;y++)for(let x=cx-r-2;x<=cx+r+2;x++){
      const d=Math.sqrt((x-cx)**2+(y-cy)**2);
      const n=(Math.sin(x*.7+y*.5)*.5+Math.cos(x*.3-y*.8)*.5)*ir;
      if(d<=r+n*r)s(x,y,t);
    }
  }

  // ── Water borders ──
  fill(0,0,8,MAP_H-1,T.DEEP_WATER);   fill(9,0,14,MAP_H-1,T.SHALLOW);
  fill(MAP_W-9,0,MAP_W-1,MAP_H-1,T.DEEP_WATER); fill(MAP_W-14,0,MAP_W-10,MAP_H-1,T.SHALLOW);
  fill(0,0,MAP_W-1,8,T.DEEP_WATER);   fill(0,9,MAP_W-1,14,T.SHALLOW);
  fill(0,MAP_H-9,MAP_W-1,MAP_H-1,T.DEEP_WATER); fill(0,MAP_H-14,MAP_W-1,MAP_H-10,T.SHALLOW);

  // ── Interior lakes and rivers ──
  blob(60,60,10,T.DEEP_WATER,.4);  blob(60,60,13,T.SHALLOW,.4);
  blob(175,55,8,T.DEEP_WATER,.4);  blob(175,55,11,T.SHALLOW,.4);
  blob(55,130,9,T.DEEP_WATER,.4);  blob(55,130,12,T.SHALLOW,.4);
  blob(185,135,10,T.DEEP_WATER,.4);blob(185,135,13,T.SHALLOW,.4);
  // Rivers — horizontal snaking from lakes
  for(let x=70;x<120;x++) s(x,62+(Math.sin(x*.15)*4|0),T.SHALLOW);
  for(let y=70;y<90;y++)  s(60+(Math.sin(y*.2)*3|0),y,T.SHALLOW);

  // ── Forests — denser near edges ──
  // Central safe forests
  blob(90,70,10,T.FOREST,.5); blob(148,72,9,T.FOREST,.5);
  blob(95,108,8,T.FOREST,.45); blob(142,105,10,T.FOREST,.5);
  // Mid-range forests
  blob(50,55,12,T.FOREST,.5); blob(170,50,11,T.FOREST,.5);
  blob(48,118,10,T.FOREST,.5); blob(178,122,12,T.FOREST,.5);
  blob(110,40,8,T.FOREST,.45); blob(128,140,9,T.FOREST,.45);
  // Deep edge forests
  blob(25,50,14,T.FOREST,.55); blob(210,48,13,T.FOREST,.55);
  blob(22,130,14,T.FOREST,.5); blob(212,132,14,T.FOREST,.5);
  blob(80,20,10,T.FOREST,.5);  blob(160,20,10,T.FOREST,.5);
  blob(75,160,10,T.FOREST,.5); blob(160,158,10,T.FOREST,.5);

  // ── Mountains — ring around edges, heavy in corners ──
  blob(30,25,15,T.MOUNTAIN,.35);  blob(205,22,15,T.MOUNTAIN,.35);
  blob(28,155,15,T.MOUNTAIN,.35); blob(207,158,14,T.MOUNTAIN,.35);
  blob(90,18,8,T.MOUNTAIN,.3);    blob(150,18,8,T.MOUNTAIN,.3);
  blob(90,162,8,T.MOUNTAIN,.3);   blob(148,160,8,T.MOUNTAIN,.3);
  blob(18,88,8,T.MOUNTAIN,.3);    blob(222,90,8,T.MOUNTAIN,.3);

  // ── Sand — southern basin ──
  for(let y=130;y<MAP_H-15;y++)for(let x=80;x<165;x++)
    if(m[y*MAP_W+x]===T.GRASS) s(x,y,T.SAND);
  blob(120,155,20,T.SAND,.3);

  // ── Danger zones — scaled by distance from spawn ──
  // Close danger (lv 1-3): small blobs ~25-40 tiles from spawn
  blob(88,62,5,T.DANGER,.6);   blob(152,64,5,T.DANGER,.6);
  blob(86,116,5,T.DANGER,.6);  blob(154,118,5,T.DANGER,.6);
  blob(108,68,4,T.DANGER,.5);  blob(130,68,4,T.DANGER,.5);
  // Mid danger (lv 4-7): ~50-80 tiles from spawn
  blob(60,48,7,T.DANGER,.55);  blob(178,45,7,T.DANGER,.55);
  blob(58,132,7,T.DANGER,.55); blob(180,134,7,T.DANGER,.55);
  blob(42,88,6,T.DANGER,.5);   blob(198,90,6,T.DANGER,.5);
  blob(118,38,6,T.DANGER,.5);  blob(120,142,6,T.DANGER,.5);
  // Deep danger (lv 8-12): ~90-110 tiles from spawn
  blob(35,35,8,T.DANGER,.6);   blob(205,32,8,T.DANGER,.6);
  blob(32,145,8,T.DANGER,.6);  blob(208,148,8,T.DANGER,.6);
  blob(70,22,6,T.DANGER,.55);  blob(172,20,6,T.DANGER,.55);
  blob(68,158,6,T.DANGER,.55); blob(168,160,6,T.DANGER,.55);
  // Boss zones (lv 12+): corner areas ~110+ tiles from spawn
  blob(18,18,10,T.DANGER,.7);  blob(218,16,10,T.DANGER,.7);
  blob(16,162,10,T.DANGER,.7); blob(220,163,10,T.DANGER,.7);

  // ── Carve safe corridors to towns ──
  function road(x1,y1,x2,y2){
    let x=x1,y=y1;
    while(x!==x2||y!==y2){
      s(x,y,T.GRASS);
      if(x!==x2)x+=x<x2?1:-1; else y+=y<y2?1:-1;
    }
  }
  // Roads from Crossroads (120,88) to each town
  road(120,88,48,40);   // to Ashford
  road(120,88,180,32);  // to Duskhollow
  road(120,88,40,128);  // to Ironhaven
  road(120,88,192,140); // to Saltmere
  road(120,88,60,75);   // to Thornwall
  road(120,88,155,95);  // to Emberglass
  // Long roads to far towns
  road(48,40,35,35);    // Ashford → Frostpeak
  road(192,140,205,145);// Saltmere → Tidesmere

  // ── Towns (3×3 blocks) ──
  for(const t of TOWNS)
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)s(t.x+dx,t.y+dy,T.TOWN);

  // ── Portals ──
  for(const p of PORTALS) s(p.x,p.y,T.PORTAL);

  return m;
}
const worldMap=buildWorld();
const tileVariant=new Uint8Array(MAP_W*MAP_H);
for(let i=0;i<tileVariant.length;i++)tileVariant[i]=i%4;
