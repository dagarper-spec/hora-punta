'use strict';
/* =====================================================================
   HORA PUNTA · ui-screens.js
   Pantallas: subir de nivel, semana y final de turno.
   ===================================================================== */
let curDay = 0;            // día elegido en la semana
/* Pantalla de la semana: un día se abre al superar el anterior */
function showDays() {
  const box = $('dList'); box.innerHTML = '';
  DAYS.forEach((d, i) => {
    const open = i === 0 || !!save.won[i - 1], won = !!save.won[i];
    const b = document.createElement('button'); b.className = 'drow' + (won ? ' won' : '') + (open ? '' : ' lock'); b.disabled = !open;
    b.innerHTML = '<span class="dnum"></span><span class="tx"><span class="nm"></span><span class="ds"></span><span class="rw"></span></span><span class="st"></span>';
    b.querySelector('.dnum').textContent = i + 1; b.querySelector('.nm').textContent = d.name;
    b.querySelector('.ds').textContent = open ? d.sub + ' · ' + mmss(d.dur) + ' · Jefe' : 'Supera el ' + DAYS[i - 1].name;
    b.querySelector('.rw').textContent = '🎁 ' + d.rew; b.querySelector('.st').textContent = won ? '✓' : open ? '▶' : '🔒';
    b.addEventListener('click', () => { curDay = i; startRun(); });
    box.appendChild(b);
  });
  $('btnMap').textContent = '📍 ' + MAPS[save.map || 'plaza'].name + ' ▸';
  show('scTitle', false); show('scOver', false); show('scDays', true);
}
function showLevel() {
  $('lvTitle').textContent = 'Nivel ' + game.level; const box = $('lvOpts'); box.innerHTML = '';
  game.options.forEach((o, i) => {
    const b = document.createElement('button'); b.className = 'opt' + (o.k === 'evo' ? ' evo' : '');
    b.innerHTML = '<span class="ic">' + o.i + '</span><span class="tx"><span class="tg">' + o.tag + '</span><span class="nm"></span><span class="ds"></span></span>';
    b.querySelector('.nm').textContent = o.n; b.querySelector('.ds').textContent = o.d;
    b.addEventListener('click', () => { SND.pick(); game.choose(i); });
    box.appendChild(b);
  });
  show('scLevel', true);
}
function showOver(kind) {
  const win = kind === 'win', first = win && curDay === DAYS.length - 1 && !save.won[curDay]; if (win) save.won[curDay] = 1;
  const sc = game.served, rec = sc > save.best, coins = Math.floor(sc / 8) + Math.floor(game.t / 30) * 5 + (win ? 60 + curDay * 20 : 0) + (game.bossKilled ? 50 : 0);
  if (rec) save.best = sc; save.coins += coins; persist();
  $('oTitle').textContent = win ? (first ? '¡SEMANA SUPERADA!' : '¡DÍA SUPERADO!') : kind === 'time' ? '¡SE ACABÓ EL TURNO!' : '¡TE ARROLLARON!'; $('btnNext').hidden = !(win && curDay < DAYS.length - 1);
  $('oRecord').hidden = !(rec || first); $('oRecord').textContent = first ? '¡CARRITO NUEVO EN LA TIENDA!' : 'NUEVO RÉCORD'; $('oTime').textContent = clockStr(game.t, game.day.dur); $('oLvl').textContent = game.level; $('oCoins').textContent = '+' + fmt(coins);
  show('hud', false); show('scOver', true);
  const t0 = performance.now(), el = $('oScore'); (function count(now) { const k = clamp((now - t0) / 700, 0, 1); el.textContent = fmt(sc * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(count); })(t0);
  SND.setIntensity(0.15); win ? SND.win() : SND.lose();
}
// FIN DE ARCHIVO
