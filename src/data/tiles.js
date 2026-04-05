export const TILES = {
  0:  { name:"Grass",         color:"#4caf50", walkable:true  },
  1:  { name:"Forest",        color:"#2e7d32", walkable:true  },
  2:  { name:"Mountain",      color:"#7b7b7b", walkable:false },
  3:  { name:"Deep Water",    color:"#0b3d91", walkable:false },
  4:  { name:"Shallow",       color:"#2aa7d6", walkable:false },
  5:  { name:"Town",          color:"#c9a227", walkable:true  },
  6:  { name:"Sand",          color:"#d9c27e", walkable:true  },
  7:  { name:"Danger",        color:"#b71c1c", walkable:true  },
  8:  { name:"Blight",        color:"#2b2626", walkable:true  },
  9:  { name:"Volcano",       color:"#5d1a1a", walkable:false },

  20: { name:"Town Floor",    color:"#6d4c41", walkable:true  },
  21: { name:"Town Wall",     color:"#2a1d1a", walkable:false },
  22: { name:"Smithy",        color:"#aa3333", walkable:true  },
  23: { name:"Alchemist",     color:"#33aa33", walkable:true  },
  24: { name:"Library",       color:"#3333aa", walkable:true  },
  25: { name:"Town Exit",     color:"#c090ff", walkable:true  },
  26: { name:"Town Deco",     color:"#6a1b9a", walkable:true  },

  27: { name:"Road Dirt",     color:"#8b6a44", walkable:true  },
  28: { name:"Road Stone",    color:"#7c7f86", walkable:true  },
  29: { name:"Road Obsidian", color:"#1b1b22", walkable:true  },
  30: { name:"Road Blight",   color:"#3a2f2f", walkable:true  },
  31: { name:"Road Runic",    color:"#0f0f18", walkable:true  },

  32: { name:"Blight Ground",   color:"#2a2626", walkable:true  },
  33: { name:"Blight Thicket",  color:"#1f1c1c", walkable:false },
  34: { name:"Blight Mountain", color:"#3a3434", walkable:false },
  35: { name:"Blight Shallow",  color:"#16312d", walkable:false },
  36: { name:"Blight Deep",     color:"#050707", walkable:false },
};



export function getTileDef(id) {
  return TILES[id] ?? { name: "Unknown", color: "#ff00ff", walkable: false };
}
