/**
 * REALM OF ECHOES — Paperdoll Fix
 * Fixes three bugs:
 *   1. Default icon/label not hidden when item equipped (stacked display)
 *   2. Old equipItem() / openItemModal() bypasses new buildPaperDoll()
 *   3. buildInventoryUI (old) doesn't call new buildPaperDoll()
 *
 * Add AFTER equipment-system.js in your script tags.
 */

(function fixPaperdoll() {

  // G and PD_SLOTS are closure vars in index.html — access via window
  const getG       = () => window.G;
  const getPDSlots = () => window.PD_SLOTS || [];

  // ══════════════════════════════════════════════════════════════
  // FIX 1: buildPaperDoll — hide default icon/label when slot filled
  // ══════════════════════════════════════════════════════════════

  window.buildPaperDoll = function buildPaperDoll() {
    const G = getG();
    if (!G) return;
    if (!G.equipped) G.equipped = {};

    getPDSlots().forEach(slot => {
      const el = document.getElementById('pd-' + slot.id);
      if (!el) return;

      const item = G.equipped[slot.id];
      const tierColors = {
        common:    'rgba(255,255,255,.15)',
        uncommon:  'rgba(74,158,255,.4)',
        rare:      'rgba(192,96,255,.4)',
        legendary: 'rgba(255,215,0,.5)'
      };
      const tierGlow = {
        uncommon:  '0 0 8px rgba(74,158,255,.3)',
        rare:      '0 0 10px rgba(192,96,255,.35)',
        legendary: '0 0 14px rgba(255,215,0,.4)'
      };

      // Reset classes
      el.classList.toggle('filled',     !!item);
      el.classList.toggle('rare',       item?.tier === 'rare');
      el.classList.toggle('legendary',  item?.tier === 'legendary');
      el.style.borderColor = item ? (tierColors[item.tier] || tierColors.common) : '';
      el.style.boxShadow   = item ? (tierGlow[item.tier]   || '') : '';

      // Remove any previously injected item display nodes
      el.querySelectorAll('.pd-item-icon, .pd-item-name, .pd-equip-stats').forEach(e => e.remove());

      // Default slot icon/label — show when EMPTY, hide when FILLED
      const di = el.querySelector('.pd-icon');
      const dl = el.querySelector('.pd-lbl');

      if (item) {
        // Hide the default placeholder
        if (di) di.style.display = 'none';
        if (dl) dl.style.display = 'none';

        // Inject item display
        const ic = document.createElement('div');
        ic.className = 'pd-item-icon';
        ic.textContent = item.icon || '📦';
        ic.style.cssText = 'font-size:1.2rem;line-height:1;';

        const nm = document.createElement('div');
        nm.className = 'pd-item-name';
        nm.textContent = item.name;
        nm.style.cssText = 'font-size:.4rem;color:var(--parch-lt);text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:54px;margin-top:2px;';

        // Key stat line
        const eff = item.effect || {};
        const statParts = [
          eff.atk  ? `+${eff.atk}A`  : '',
          eff.ac   ? `+${eff.ac}AC`  : '',
          eff.hp   ? `+${eff.hp}HP`  : '',
          eff.mp   ? `+${eff.mp}MP`  : '',
        ].filter(Boolean);

        if (statParts.length) {
          const st = document.createElement('div');
          st.className = 'pd-equip-stats';
          st.textContent = statParts.join(' ');
          st.style.cssText = 'font-size:.36rem;color:var(--gold-b);margin-top:1px;';
          el.appendChild(ic);
          el.appendChild(nm);
          el.appendChild(st);
        } else {
          el.appendChild(ic);
          el.appendChild(nm);
        }

        // Tooltip
        el.title = `${item.name}\n${item.desc || ''}`;

      } else {
        // Show the default placeholder again
        if (di) di.style.display = '';
        if (dl) dl.style.display = '';
        el.title = `${slot.label} — empty`;
      }
    });

    buildInvStatsBox();
  };


  // ══════════════════════════════════════════════════════════════
  // FIX 2: Replace equipItem (old) so it uses new slot resolution
  // and calls buildPaperDoll correctly.
  // This is what openItemModal's "Equip" button calls.
  // ══════════════════════════════════════════════════════════════

  window.equipItem = function equipItem(idx) {
    const G = getG(); if (!G) return;
    if (!G.equipped) G.equipped = {};
    const item = G.inventory[idx];
    if (!item) return;

    // Use new slot resolver
    const slot = window.getEquipSlotForItem
      ? window.getEquipSlotForItem(item)
      : (SLOT_FOR_TYPE[item.type] || null);

    if (!slot) { toast("Can't equip that!", 'err'); return; }

    // Swap old item back into carry
    const old = G.equipped[slot];
    G.equipped[slot] = item;

    // Replace carry slot with old item (or remove if none)
    if (old) {
      G.inventory[idx] = old;
    } else {
      G.inventory.splice(idx, 1);
    }

    playSound('equip');
    addLog(`Equipped: ${item.name}.`, 'sys');
    if (item.tier === 'legendary') {
      addLog(`⭐ ${item.name} — "${item.flavour || 'a legendary item'}"`, 'legendary');
      toast(`⭐ Legendary: ${item.name}!`);
    } else {
      toast(`Equipped ${item.name}!`);
    }

    recalcStats();
    buildInventoryUI();  // rebuilds both paperdoll + carry grid
    updateHUD();
    saveGame();

    // Close the item modal if open
    closeItemModal?.();
  };


  // ══════════════════════════════════════════════════════════════
  // FIX 3: Replace unequipItem (old) to call new buildPaperDoll
  // ══════════════════════════════════════════════════════════════

  window.unequipItem = function unequipItem(slot) {
    const G = getG(); if (!G) return;
    if (!G.equipped?.[slot]) return;
    if (G.inventory.filter(Boolean).length >= 20) {
      toast('Inventory full!', 'err');
      return;
    }
    const item = G.equipped[slot];
    G.equipped[slot] = null;
    G.inventory.push({ ...item });
    addLog(`Unequipped: ${item.name}.`, 'sys');
    recalcStats();
    buildInventoryUI();
    updateHUD();
    saveGame();
    toast(`Unequipped ${item.name}.`);
  };


  // ══════════════════════════════════════════════════════════════
  // FIX 4: buildInventoryUI — make sure it always calls buildPaperDoll
  // This is called from many places throughout the codebase.
  // ══════════════════════════════════════════════════════════════

  window.buildInventoryUI = function buildInventoryUI() {
    const G = getG(); if (!G) return;
    buildLeftPanelActiveSlots();
    // If inventory overlay is open, do full rebuild
    if (document.getElementById('ov-inventory')?.classList.contains('active')) {
      buildFullInventoryUI();
    } else {
      // Even when closed, keep paperdoll data fresh for next open
      buildPaperDoll();
    }
  };


  // ══════════════════════════════════════════════════════════════
  // FIX 5: pdSlotClick — reads G.equipped correctly and shows
  // either unequip options or "click a carry item to equip here"
  // ══════════════════════════════════════════════════════════════

  window.pdSlotClick = function pdSlotClick(slotId) {
    const G = getG(); if (!G) return;
    const item = G.equipped?.[slotId] || null;

    // Highlight the clicked slot
    document.querySelectorAll('.pd-slot').forEach(e => e.classList.remove('selected'));
    const el = document.getElementById('pd-' + slotId);
    if (el) el.classList.add('selected');

    const panel = document.getElementById('inv-action-panel');
    if (!panel) return;
    panel.style.display = 'flex';

    const iconEl = document.getElementById('iap-icon');
    const nameEl = document.getElementById('iap-name');
    const metaEl = document.getElementById('iap-meta');
    const btnsEl = document.getElementById('iap-btns');
    if (!iconEl || !nameEl || !metaEl || !btnsEl) return;

    const slotDef = getPDSlots().find(s => s.id === slotId);
    const slotLabel = slotDef?.label || slotId;

    if (!item) {
      iconEl.textContent = slotDef?.icon || '—';
      iconEl.style.filter = '';
      nameEl.textContent = `${slotLabel} — Empty`;
      nameEl.style.color = 'var(--parch-dk)';
      metaEl.innerHTML = `<span style="color:var(--parch-dk);font-style:italic;font-size:.65rem;">
        Select an item from your inventory bag on the right, then click Equip.
      </span>`;
      btnsEl.innerHTML = '';
      return;
    }

    // Item is equipped — show its details + unequip button
    const tierColors = { common:'#aaa', uncommon:'#4a9eff', rare:'#c060ff', legendary:'#ffd700' };
    iconEl.textContent  = item.icon || '📦';
    iconEl.style.filter = item.tier === 'legendary' ? 'drop-shadow(0 0 6px gold)' : '';
    nameEl.textContent  = item.name;
    nameEl.style.color  = tierColors[item.tier] || '#aaa';

    const eff = item.effect || {};
    const statLines = [
      eff.atk   ? `<span style="color:var(--gold-b)">+${eff.atk} Attack</span>`    : '',
      eff.ac    ? `<span style="color:#60c0ff">+${eff.ac} Armour Class</span>`      : '',
      eff.hp    ? `<span style="color:#c0392b">+${eff.hp} HP</span>`               : '',
      eff.mp    ? `<span style="color:#2980b9">+${eff.mp} MP</span>`               : '',
      eff.str   ? `<span style="color:var(--parch-lt)">+${eff.str} STR</span>`     : '',
      eff.dex   ? `<span style="color:var(--parch-lt)">+${eff.dex} DEX</span>`     : '',
      eff.con   ? `<span style="color:var(--parch-lt)">+${eff.con} CON</span>`     : '',
      eff.int   ? `<span style="color:var(--parch-lt)">+${eff.int} INT</span>`     : '',
      eff.wis   ? `<span style="color:var(--parch-lt)">+${eff.wis} WIS</span>`     : '',
      eff.speed ? `<span style="color:#60ff90">+${eff.speed} Speed</span>`         : '',
      eff.magic ? `<span style="color:#c090ff">✦ Magical damage</span>`            : '',
    ].filter(Boolean);

    metaEl.innerHTML = [
      `<div style="margin-bottom:4px;color:var(--parch-dk);">${item.desc || ''}</div>`,
      statLines.join('  '),
      item.flavour ? `<div style="color:var(--parch-dk);font-style:italic;font-size:.6rem;margin-top:4px;">"${item.flavour}"</div>` : '',
    ].join('');

    btnsEl.innerHTML = '';
    const mk = (label, cls, fn) => {
      const b = document.createElement('button');
      b.className = 'iap-btn ' + cls;
      b.textContent = label;
      b.onclick = fn;
      btnsEl.appendChild(b);
    };

    mk('↩ Unequip', 'unequip', () => {
      unequipItem(slotId);
      panel.style.display = 'none';
      document.querySelectorAll('.pd-slot').forEach(e => e.classList.remove('selected'));
    });
  };


  // ══════════════════════════════════════════════════════════════
  // FIX 6: selectCarrySlot — when clicking a carry item while a
  // pd-slot is selected, offer to equip into that slot directly
  // ══════════════════════════════════════════════════════════════

  window.selectCarrySlot = function selectCarrySlot(idx) {
    const G = getG(); if (!G) return;
    const item = G.inventory[idx] || null;

    // Deselect old carry selection
    document.querySelectorAll('#inv-carry-grid .inv-slot-cell').forEach((c, i) => {
      c.classList.toggle('selected', i === idx);
    });

    const panel   = document.getElementById('inv-action-panel');
    const iconEl  = document.getElementById('iap-icon');
    const nameEl  = document.getElementById('iap-name');
    const metaEl  = document.getElementById('iap-meta');
    const btnsEl  = document.getElementById('iap-btns');
    if (!panel || !iconEl || !nameEl || !metaEl || !btnsEl) return;

    panel.style.display = 'flex';

    if (!item) {
      iconEl.textContent = '—';
      iconEl.style.filter = '';
      nameEl.textContent = 'Empty slot';
      nameEl.style.color = 'var(--parch-dk)';
      metaEl.innerHTML = '';
      btnsEl.innerHTML = '';
      return;
    }

    const tierColors = { common:'#aaa', uncommon:'#4a9eff', rare:'#c060ff', legendary:'#ffd700' };
    iconEl.textContent  = item.icon || '📦';
    iconEl.style.filter = item.tier === 'legendary' ? 'drop-shadow(0 0 6px gold)' : '';
    nameEl.textContent  = item.name;
    nameEl.style.color  = tierColors[item.tier] || '#aaa';

    const eff = item.effect || {};
    const statLines = [
      eff.atk   ? `+${eff.atk} ATK`    : '',
      eff.ac    ? `+${eff.ac} AC`      : '',
      eff.hp    ? `+${eff.hp} HP`      : '',
      eff.mp    ? `+${eff.mp} MP`      : '',
      eff.str   ? `+${eff.str} STR`    : '',
      eff.dex   ? `+${eff.dex} DEX`    : '',
      eff.con   ? `+${eff.con} CON`    : '',
      eff.speed ? `+${eff.speed} SPD`  : '',
    ].filter(Boolean).join('  ');

    metaEl.innerHTML = [
      `<span style="color:var(--parch-dk);font-size:.62rem;">${item.desc || ''}</span>`,
      statLines ? `<br><span style="color:var(--gold-b);font-size:.62rem;">${statLines}</span>` : '',
      item.flavour ? `<br><span style="color:var(--parch-dk);font-style:italic;font-size:.58rem;">"${item.flavour}"</span>` : '',
      item.price ? `<br><span style="color:var(--gold);font-size:.58rem;">Sells for ${sellValue(item)}gp</span>` : '',
    ].join('');

    btnsEl.innerHTML = '';
    const mk = (label, cls, fn) => {
      const b = document.createElement('button');
      b.className = 'iap-btn ' + cls;
      b.textContent = label;
      b.onclick = fn;
      btnsEl.appendChild(b);
    };

    const equipSlot = window.getEquipSlotForItem
      ? window.getEquipSlotForItem(item)
      : (SLOT_FOR_TYPE?.[item.type] || null);

    if (equipSlot) {
      const currentlyEquipped = G.equipped?.[equipSlot];
      if (currentlyEquipped) {
        mk(`⚔ Swap (replace ${currentlyEquipped.name})`, 'equip', () => { equipItem(idx); });
      } else {
        mk('⚔ Equip', 'equip', () => { equipItem(idx); });
      }
    }

    if (item.type === 'potion' || item.effect?.hp || item.effect?.mp) {
      mk('💊 Use', 'use', () => {
        useCarryItem(idx);
        buildCarryGrid();
        updateHUD();
        panel.style.display = 'none';
      });
    }

    if (item.type === 'potion') {
      mk('⚗ Quick Slot', 'active', () => {
        moveToActiveSlot(idx);
        buildCarryGrid();
        buildActiveGrid();
      });
    }

    if (!equipSlot || item.type === 'misc') {
      mk(`Sell (${sellValue(item)}gp)`, 'sell', () => {
        sellItem(idx);
        buildFullInventoryUI();
      });
    }
  };


  // ══════════════════════════════════════════════════════════════
  // Rebuild paperdoll immediately if inventory is already open
  // ══════════════════════════════════════════════════════════════

  if (document.getElementById('ov-inventory')?.classList.contains('active')) {
    buildFullInventoryUI();
  }
  // Always refresh paperdoll state in background
  if (typeof buildPaperDoll === 'function') buildPaperDoll();

  console.log('[Paperdoll Fix] ✅ All 6 fixes applied');

})();
