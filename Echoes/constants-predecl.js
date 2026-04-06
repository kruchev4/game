/**
 * REALM OF ECHOES — Constants Pre-Declaration
 * 
 * This file MUST be loaded BEFORE main.js / constants.js
 * It pre-declares everything that constants.js expects to find on window.
 * 
 * Add as the FIRST script tag after Firebase SDKs:
 *   <script src="./Echoes/constants-predecl.js"></script>
 *   <script type="module" src="./Echoes/main.js"></script>
 */

// Town tile constants — needed by constants.js before town-map-system.js loads
window.TOWN_TILES = {
  FLOOR:  20, WALL:   21, INN:    22, SHOP:   23,
  TEMPLE: 24, TAVERN: 25, VENDOR: 26, CRAFT:  27,
  EXIT:   28, DECO:   29,
};

window.TOWN_PASSABLE = new Set([20, 22, 23, 24, 25, 26, 27, 28]);

window.TOWN_TILE_COLORS = {
  20: '#6a6058', 21: '#1e1810', 22: '#7a5030', 23: '#1a3a5a',
  24: '#4a2a6a', 25: '#3a2808', 26: '#1a3a1a', 27: '#102a2a',
  28: '#1a4a1a', 29: '#252015',
};

window.TOWN_TILE_ICONS = {
  22: '🏨', 23: '⚒', 24: '✝', 25: '🍺', 26: '💰', 27: '⚗', 28: '🌍'
};

console.log('[constants-predecl] ✅ Town constants pre-declared');
