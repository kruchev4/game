// ui/characterSheet.js

let charSheetOpen = false;

export function openCharSheet() {
  if (window.G?.inCombat) return;
  charSheetOpen = true;
  populateCharSheet();
  document.getElementById('ov-charsheet')?.classList.add('active');
}

export function closeCharSheet() {
  charSheetOpen = false;
  document.getElementById('ov-charsheet')?.classList.remove('active');
}

export function populateCharSheet() {
  const G = window.G;
  if (!G) return;

  const cls  = G.cls;
  const race = G.race;
  if (!cls || !race) return;

  // ---- paste the rest of the function body EXACTLY as-is ----
}
