'use strict';
/* =====================================================================
   HORA PUNTA · ui-shop.js
   Pantalla de la tienda.
   ===================================================================== */
/* Tienda: mejoras permanentes del carrito y desbloqueo del arma inicial */
function renderShop() {
  $('sCoins').textContent = fmt(save.coins); const box = $('shopList'); box.innerHTML = '';
  const h = t => { const d = document.createElement('div'); d.className = 'shop-h'; d.textContent = t; box.appendChild(d); };
  const row = (ic, n, d, pips, btn, lock) => { const r = document.createElement('div'); r.className = 'srow' + (lock ? ' lock' : ''); r.innerHTML = '<span class="ic"></span><span class="tx"><span class="nm"></span><span class="ds"></span><span class="pips"></span></span>'; r.querySelector('.ic').textContent = ic; r.querySelector('.nm').textContent = n; r.querySelector('.ds').textContent = d; r.querySelector('.pips').textContent = pips; r.appendChild(btn); box.appendChild(r); };
  const mkBtn = (txt, dis, cls, fn) => { const b = document.createElement('button'); b.className = 'buy' + (cls ? ' ' + cls : ''); b.textContent = txt; b.disabled = dis; b.addEventListener('click', () => { SND.init(); SND.click(); fn(); persist(); renderShop(); }); return b; };
  h('Carritos');
  for (const id in CARTS) {
    const C = CARTS[id], open = isOpen('cart', id, save.won), eq = save.cart === id;
    row(C.i, C.n, open ? C.d : lockHint('cart', id), '', mkBtn(!open ? '🔒' : eq ? 'EQUIPADO' : 'ELEGIR', !open || eq, eq ? 'eq' : '', () => { save.cart = id; }), !open);
  }
  h('Mejoras del carrito');
  for (const m of META) {
    const l = save.meta[m.k], lim = metaMax(save.won), max = l >= 5, c = m.cost[l], open = isOpen('meta', m.k, save.won), cap = l >= lim && !max;
    const d = !open ? lockHint('meta', m.k) : cap ? 'Siguiente nivel: supera el ' + DAYS[lim === 3 ? 2 : 3].name : m.d;
    row(m.i, m.n, d, '●'.repeat(l) + '○'.repeat(Math.max(0, lim - l)) + '·'.repeat(5 - Math.max(l, lim)), mkBtn(!open || cap ? '🔒' : max ? 'MÁX' : fmt(c) + ' 🪙', !open || cap || max || save.coins < c, '', () => { save.coins -= c; save.meta[m.k]++; }), !open || cap);
  }
  h('Arma inicial');
  for (const id in WEAP) {
    const own = !!save.owned[id], eq = save.startW === id, c = W_COST[id], open = own || isOpen('weap', id, save.won);
    row(WEAP[id].i, WEAP[id].n, open ? WEAP[id].d : lockHint('weap', id), '', mkBtn(!open ? '🔒' : eq ? 'EQUIPADA' : own ? 'ELEGIR' : fmt(c) + ' 🪙', !open || eq || (!own && save.coins < c), eq ? 'eq' : '', () => { if (!own) { save.coins -= c; save.owned[id] = 1; } save.startW = id; }), !open);
  }
}
// FIN DE ARCHIVO
