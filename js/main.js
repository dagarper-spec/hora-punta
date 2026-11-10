'use strict';
/* =====================================================================
   HORA PUNTA · main.js
   Guardado, tienda, entrada (joystick/teclado), UI y bucle principal.
   Conecta la lógica (Game), la vista (View) y el audio (SND).
   ===================================================================== */
const SAVE_KEY = 'horapunta.save.v1';
const save = { best: 0, coins: 0, muted: false, meta: { hp: 0, speed: 0, dmg: 0, magnet: 0 }, owned: { espresso: 1 }, startW: 'espresso' };
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'); Object.assign(save, s); save.meta = Object.assign({ hp: 0, speed: 0, dmg: 0, magnet: 0 }, s.meta || {}); save.owned = Object.assign({ espresso: 1 }, s.owned || {}); } catch (e) {}
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} };
const META = [
  { k: 'hp', i: '🛒', n: 'Carrito Reforzado', d: '+10 de vida inicial por nivel', cost: [80, 150, 240, 360, 500] },
  { k: 'speed', i: '🛞', n: 'Ruedas Engrasadas', d: '+4% de velocidad por nivel', cost: [80, 150, 240, 360, 500] },
  { k: 'dmg', i: '☕', n: 'Café Premium', d: '+5% de daño por nivel', cost: [100, 180, 280, 400, 560] },
  { k: 'magnet', i: '🧲', n: 'Imán Dorado', d: '+15% radio de recogida por nivel', cost: [60, 110, 180, 270, 380] }
];
const W_COST = { espresso: 0, croissant: 200, canela: 250, tostada: 300, zumo: 350, colacao: 400 };

const showErr = m => { const b = $('errBox'); if (b) { b.hidden = false; b.textContent = 'Error: ' + m; } };
window.addEventListener('error', e => showErr(e.message));
window.addEventListener('unhandledrejection', e => showErr(String(e.reason && e.reason.message || e.reason)));

const game = new Game();
let view = null, paused = false;
if (!window.THREE) showErr('No se pudo cargar three.js (¿sin conexión?)');
else { try { view = new View($('gl'), game); } catch (e) { showErr('No se pudo iniciar WebGL (' + e.message + ')'); } }

/* ----- entrada: joystick flotante en cualquier parte + teclado ----- */
const Input = {
  id: null, ox: 0, oy: 0, R: 56, keys: {},
  down(e) {
    if (game.state !== 'play' || paused || this.id !== null) return;
    this.id = e.pointerId; this.ox = e.clientX; this.oy = e.clientY;
    const j = $('joy'); j.style.left = e.clientX + 'px'; j.style.top = e.clientY + 'px'; j.classList.add('on'); j.firstElementChild.style.transform = 'translate(0,0)';
    try { $('app').setPointerCapture(e.pointerId); } catch (x) {}
  },
  move(e) {
    if (e.pointerId !== this.id) return;
    let dx = e.clientX - this.ox, dy = e.clientY - this.oy; const d = Math.hypot(dx, dy);
    if (d > this.R) { dx *= this.R / d; dy *= this.R / d; }
    $('joy').firstElementChild.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    this.vx = dx / this.R; this.vz = dy / this.R;
  },
  up(e) { if (e.pointerId !== this.id) return; this.id = null; this.vx = this.vz = 0; $('joy').classList.remove('on'); },
  vx: 0, vz: 0,
  tick() {
    const k = this.keys; let x = (k.ArrowRight || k.KeyD ? 1 : 0) - (k.ArrowLeft || k.KeyA ? 1 : 0), z = (k.ArrowDown || k.KeyS ? 1 : 0) - (k.ArrowUp || k.KeyW ? 1 : 0);
    if (x || z) { const l = Math.hypot(x, z); x /= l; z /= l; } else { x = this.vx; z = this.vz; }
    game.inp.x = x; game.inp.z = z;
  }
};
const app = $('app');
app.addEventListener('pointerdown', e => { if (!e.target.closest('button')) Input.down(e); });
app.addEventListener('pointermove', e => Input.move(e));
app.addEventListener('pointerup', e => Input.up(e)); app.addEventListener('pointercancel', e => Input.up(e));
window.addEventListener('keydown', e => { if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault(); Input.keys[e.code] = true; if (e.code === 'Escape') setPaused(!paused); });
window.addEventListener('keyup', e => { Input.keys[e.code] = false; });

/* ----- UI ----- */
const show = (id, on) => { $(id).hidden = !on; };
const clockStr = t => { const m = 420 + Math.floor(t * 0.4); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
function setSoundUi() { $('btnSnd').textContent = 'Sonido: ' + (SND.muted ? 'no' : 'sí'); }
function refreshTitle() { $('tBest').textContent = fmt(save.best); $('tCoins').textContent = fmt(save.coins); }
function banner(text, sub) { const b = $('banner'); b.innerHTML = ''; const w = document.createElement('div'); w.className = 'bn'; const h = document.createElement('b'); h.textContent = text; w.appendChild(h); if (sub) { const s = document.createElement('small'); s.textContent = sub; w.appendChild(s); } b.appendChild(w); b.classList.remove('go'); void b.offsetWidth; b.classList.add('go'); }
function toTitle() {
  paused = false; game.demo(); game.state = 'title';
  show('scTitle', true); show('scOver', false); show('scPause', false); show('scLevel', false); show('scShop', false); show('hud', false); refreshTitle();
  SND.setIntensity(0.15);
}
function startRun() {
  SND.init(); SND.click(); setSoundUi(); hudSig = '';
  show('scTitle', false); show('scOver', false); show('scPause', false); show('scLevel', false); show('scShop', false); show('hud', true);
  game.start(save.meta, save.startW); $('banner').classList.remove('go');
  banner('¡HORA PUNTA!', 'Aguanta hasta las 09:00');
}
function setPaused(p) { if (game.state !== 'play') return; paused = p; show('scPause', p); if (p) SND.suspend(); else SND.resume(); }
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
function showOver(win) {
  const sc = game.served, rec = sc > save.best, coins = Math.floor(sc / 8) + Math.floor(game.t / 30) * 5 + (win ? 100 : 0) + (game.bossKilled ? 50 : 0);
  if (rec) save.best = sc; save.coins += coins; persist();
  $('oTitle').textContent = win ? '¡SOBREVIVISTE A LA HORA PUNTA!' : '¡TE ARROLLARON!';
  $('oRecord').hidden = !rec; $('oTime').textContent = clockStr(game.t); $('oLvl').textContent = game.level; $('oCoins').textContent = '+' + fmt(coins);
  show('hud', false); show('scOver', true);
  const t0 = performance.now(), el = $('oScore'); (function count(now) { const k = clamp((now - t0) / 700, 0, 1); el.textContent = fmt(sc * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(count); })(t0);
  SND.setIntensity(0.15); win ? SND.win() : SND.lose();
}
/* Tienda: mejoras permanentes del carrito y desbloqueo del arma inicial */
function renderShop() {
  $('sCoins').textContent = fmt(save.coins); const box = $('shopList'); box.innerHTML = '';
  const h = t => { const d = document.createElement('div'); d.className = 'shop-h'; d.textContent = t; box.appendChild(d); };
  const row = (ic, n, d, pips, btn) => { const r = document.createElement('div'); r.className = 'srow'; r.innerHTML = '<span class="ic"></span><span class="tx"><span class="nm"></span><span class="ds"></span><span class="pips"></span></span>'; r.querySelector('.ic').textContent = ic; r.querySelector('.nm').textContent = n; r.querySelector('.ds').textContent = d; r.querySelector('.pips').textContent = pips; r.appendChild(btn); box.appendChild(r); };
  const mkBtn = (txt, dis, cls, fn) => { const b = document.createElement('button'); b.className = 'buy' + (cls ? ' ' + cls : ''); b.textContent = txt; b.disabled = dis; b.addEventListener('click', () => { SND.init(); SND.click(); fn(); persist(); renderShop(); }); return b; };
  h('Mejoras del carrito');
  for (const m of META) {
    const l = save.meta[m.k], max = l >= 5, c = m.cost[l];
    row(m.i, m.n, m.d, '●'.repeat(l) + '○'.repeat(5 - l), mkBtn(max ? 'MÁX' : fmt(c) + ' 🪙', max || save.coins < c, '', () => { save.coins -= c; save.meta[m.k]++; }));
  }
  h('Arma inicial');
  for (const id in WEAP) {
    const own = !!save.owned[id], eq = save.startW === id, c = W_COST[id];
    row(WEAP[id].i, WEAP[id].n, WEAP[id].d, '', mkBtn(eq ? 'EQUIPADA' : own ? 'ELEGIR' : fmt(c) + ' 🪙', eq || (!own && save.coins < c), eq ? 'eq' : '', () => { if (!own) { save.coins -= c; save.owned[id] = 1; } save.startW = id; }));
  }
}
$('btnPlay').addEventListener('click', startRun); $('btnAgain').addEventListener('click', startRun);
$('btnHome').addEventListener('click', () => { SND.click(); toTitle(); });
$('btnShop').addEventListener('click', () => { SND.init(); SND.click(); show('scTitle', false); show('scShop', true); renderShop(); });
$('btnShopBack').addEventListener('click', () => { SND.click(); show('scShop', false); show('scTitle', true); refreshTitle(); });
$('btnPause').addEventListener('click', () => setPaused(true)); $('btnResume').addEventListener('click', () => setPaused(false));
$('btnQuit').addEventListener('click', () => { paused = false; SND.resume(); toTitle(); });
$('btnSnd').addEventListener('click', () => { SND.init(); SND.setMuted(!SND.muted); save.muted = SND.muted; persist(); setSoundUi(); });
let resetT = 0;
$('btnReset').addEventListener('click', () => {            // doble toque, sin confirm()
  if (!resetT) { $('btnReset').textContent = '¿Seguro? Toca otra vez'; resetT = setTimeout(() => { resetT = 0; $('btnReset').textContent = 'Reiniciar progreso'; }, 3000); return; }
  clearTimeout(resetT); resetT = 0; $('btnReset').textContent = 'Reiniciar progreso';
  Object.assign(save, { best: 0, coins: 0, meta: { hp: 0, speed: 0, dmg: 0, magnet: 0 }, owned: { espresso: 1 }, startW: 'espresso' }); persist(); refreshTitle();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => view && view.resize()).observe(app); else window.addEventListener('resize', () => view && view.resize());

/* Despacho de eventos de la lógica hacia vista, audio y HUD */
function handleEvents() {
  for (const e of game.events) {
    if (view) view.onEvent(e);
    switch (e.t) {
      case 'shoot': SND.shoot(e.k); break;
      case 'hit': SND.hit(); break;
      case 'serve': SND.serve(); break;
      case 'bean': SND.bean(e.chain); break;
      case 'explode': SND.explode(); break;
      case 'hurt': SND.hurt(); break;
      case 'heal': SND.heal(); break;
      case 'level': SND.level(); showLevel(); break;
      case 'pick': if (game.state === 'levelup') showLevel(); else show('scLevel', false); break;
      case 'nest': SND.bell(); banner(NESTS[e.i].icon + ' ¡Abre ' + NESTS[e.i].name.toLowerCase() + '!', 'Nuevos clientes'); break;
      case 'bell': SND.bell(); banner(NESTS[e.i].bell, 'Oleada de clientes'); break;
      case 'boss': SND.boss(); banner('¡EL JEFE DE LA REUNIÓN!', 'Viene a por su café'); break;
      case 'bossCall': banner('¡Reunión urgente!', 'Convoca refuerzos'); break;
      case 'bossDown': SND.win(); banner('¡Jefe atendido!', 'Soltó un montón de granos'); break;
      case 'win': showOver(true); break;
      case 'over': showOver(false); break;
    }
  }
  game.events.length = 0;
}
let hudSig = '';
function updateHUD() {
  const p = game.p;
  $('hHp').textContent = Math.ceil(p.hp); $('hHpBar').style.width = (clamp(p.hp / p.maxhp, 0, 1) * 100).toFixed(1) + '%';
  $('xpFill').style.width = (clamp(game.xp / xpNeed(game.level), 0, 1) * 100).toFixed(1) + '%';
  $('hLvl').textContent = game.level; $('hClock').textContent = clockStr(game.t); $('hServed').textContent = fmt(game.served);
  const sig = game.W.map(w => w.id + w.lv + (w.evo ? 'e' : '')).join() + '|' + JSON.stringify(game.pasv);
  if (sig !== hudSig) {
    hudSig = sig; const box = $('weps'); box.innerHTML = '';
    for (const w of game.W) { const d = document.createElement('div'); d.className = 'wi' + (w.evo ? ' evo' : ''); d.innerHTML = '<span></span><small></small>'; d.firstChild.textContent = w.evo ? WEAP[w.id].evo.i : WEAP[w.id].i; d.lastChild.textContent = w.evo ? 'MAX' : 'Nv' + w.lv; box.appendChild(d); }
    for (const id in game.pasv) { const d = document.createElement('div'); d.className = 'wi p'; d.innerHTML = '<span></span><small></small>'; d.firstChild.textContent = PAS[id].i; d.lastChild.textContent = 'Nv' + game.pasv[id]; box.appendChild(d); }
  }
}
/* Bucle principal con Delta Time: dt acotado + subpasos si hay tirones (la simulación no depende de los FPS) */
let last = 0, clock = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  let dt = (ts - last) / 1000; last = ts; if (!(dt > 0)) dt = 1 / 60; dt = Math.min(dt, 0.05);
  if (paused) return;
  clock += dt; Input.tick();
  if (game.state === 'play' || game.state === 'dying') { const sub = dt > 1 / 40 ? 2 : 1; for (let i = 0; i < sub; i++) game.update(dt / sub); }
  handleEvents();
  if (game.state === 'play' || game.state === 'dying' || game.state === 'levelup') {
    updateHUD();
    SND.setIntensity(clamp(game.t / CFG.DURATION * 0.6 + game.nE / CFG.CAP_E * 0.5, 0, 1));
  }
  if (view) view.render(dt, clock);
}
SND.setMuted(!!save.muted); setSoundUi(); toTitle();
requestAnimationFrame(frame);
      
