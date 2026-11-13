'use strict';
/* =====================================================================
   HORA PUNTA · main.js
   Guardado, tienda, entrada (joystick/teclado), UI y bucle principal.
   Conecta la lógica (Game), la vista (View) y el audio (SND).
   ===================================================================== */

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
function setSoundUi() { $('btnSnd').textContent = 'Sonido: ' + (SND.muted ? 'no' : 'sí'); }
function refreshTitle() { $('tBest').textContent = fmt(save.best); $('tCoins').textContent = fmt(save.coins); }
function banner(text, sub) { const b = $('banner'); b.innerHTML = ''; const w = document.createElement('div'); w.className = 'bn'; const h = document.createElement('b'); h.textContent = text; w.appendChild(h); if (sub) { const s = document.createElement('small'); s.textContent = sub; w.appendChild(s); } b.appendChild(w); b.classList.remove('go'); void b.offsetWidth; b.classList.add('go'); }
function toTitle() {
  paused = false; setMap(save.map); game.demo(); game.state = 'title'; if (view) { view.setCart(save.cart); view.setMap(save.map); }
  show('scTitle', true); show('scDays', false); show('scOver', false); show('scPause', false); show('scLevel', false); show('scShop', false); show('hud', false); refreshTitle();
  SND.setIntensity(0.15);
}
function startRun() {
  SND.init(); SND.click(); setSoundUi(); hudSig = '';
  show('scTitle', false); show('scDays', false); show('scOver', false); show('scPause', false); show('scLevel', false); show('scShop', false); show('hud', true);
  setMap(save.map); if (view) { view.setCart(save.cart); view.setMap(save.map); } game.start(save.meta, save.startW, curDay, save.won, save.cart, save.map); hintI = 0; $('banner').classList.remove('go');
  banner('¡' + DAYS[curDay].name.toUpperCase() + '!', 'Derrota al jefe antes de que acabe el turno');
}
function setPaused(p) { if (game.state !== 'play') return; paused = p; show('scPause', p); if (p) SND.suspend(); else SND.resume(); }
$('btnPlay').addEventListener('click', () => { SND.init(); SND.click(); showDays(); });
$('btnMap').addEventListener('click', () => {
  const ids = Object.keys(MAPS), id = ids[(ids.indexOf(save.map) + 1) % ids.length];
  if (!isOpen('map', id, save.won)) { $('btnMap').textContent = '🔒 ' + lockHint('map', id); setTimeout(showDays, 1600); return; }
  SND.click(); save.map = id; persist(); setMap(id); if (view) view.setMap(id); showDays();
});
$('btnDaysBack').addEventListener('click', () => { SND.click(); toTitle(); });
$('btnNext').addEventListener('click', () => { curDay = Math.min(DAYS.length - 1, curDay + 1); startRun(); }); $('btnAgain').addEventListener('click', startRun);
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
  Object.assign(save, { best: 0, coins: 0, meta: { hp: 0, speed: 0, dmg: 0, magnet: 0 }, owned: { espresso: 1 }, startW: 'espresso', cart: 'clasico', map: 'plaza', won: [0, 0, 0, 0, 0] }); persist(); refreshTitle();
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
      case 'bean': SND.bean(e.chain, e.v); break;
      case 'explode': SND.explode(); break;
      case 'hurt': SND.hurt(); break;
      case 'heal': SND.heal(); break;
      case 'level': SND.level(); showLevel(); break;
      case 'pick': if (game.state === 'levelup') showLevel(); else show('scLevel', false); break;
      case 'nest': SND.bell(); banner(NESTS[e.i].icon + ' ¡Abre ' + NESTS[e.i].name.toLowerCase() + '!', 'Nuevos clientes'); break;
      case 'bell': SND.bell(); banner(NESTS[e.i].bell, 'Oleada de clientes'); break;
      case 'boss': SND.boss(); banner('¡EL JEFE DE LA REUNIÓN!', 'Derrótalo para ganar el día'); break;
      case 'warn': SND.bell(); banner('¡Quedan 30 segundos!', game.bossKilled ? '' : 'Derrota al jefe'); break;
      case 'bossPhase': SND.boss(); banner('¡El jefe se enfurece!', e.r === 2 ? 'Última fase' : 'Va más rápido'); break;
      case 'tide': SND.bell(); banner('¡LA MAREA FINAL!', 'Todos a la vez'); break;
      case 'bossCall': banner('¡Reunión urgente!', 'Convoca refuerzos'); break;
      case 'bossDown': SND.win(); banner('¡Jefe atendido!', 'Soltó un montón de billetes'); break;
      case 'win': showOver('win'); break;
      case 'timeout': showOver('time'); break;
      case 'over': showOver('dead'); break;
    }
  }
  game.events.length = 0;
}
let hudSig = '', hintI = 0;
/* Pistas del Lunes (solo hasta superarlo): una cada vez, en el momento justo */
function hintTick() {
  if (curDay !== 0 || save.won[0] || game.state !== 'play') return;
  const H = [[2, 'Arrastra el dedo', 'Así te mueves por la plaza'], [8, 'El carrito sirve solo', 'Atiende al cliente más cercano'], [14, 'Recoge monedas y billetes', 'Llena la barra y sube de nivel'], [game.day.bossAt - 12, 'Se acerca el jefe', 'Derrótalo antes de que acabe el turno']];
  if (hintI < H.length && game.t >= H[hintI][0]) { banner(H[hintI][1], H[hintI][2]); hintI++; }
}
function updateHUD() {
  const p = game.p;
  $('hHp').textContent = Math.ceil(p.hp); $('hHpBar').style.width = (clamp(p.hp / p.maxhp, 0, 1) * 100).toFixed(1) + '%';
  $('xpFill').style.width = (clamp(game.xp / xpNeed(game.level), 0, 1) * 100).toFixed(1) + '%';
  $('hLvl').textContent = game.level; $('hClock').textContent = clockStr(game.t, game.day.dur); $('hTimer').textContent = mmss(game.day.dur - game.t); bossUi(view); hintTick(); $('hServed').textContent = fmt(game.served);
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
    SND.setIntensity(clamp(game.t / game.day.dur * 0.6 + game.nE / CFG.CAP_E * 0.5, 0, 1));
  }
  if (view) view.render(dt, clock);
}
SND.setMuted(!!save.muted); setSoundUi(); toTitle();
requestAnimationFrame(frame);

// FIN DE ARCHIVO
