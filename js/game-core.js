'use strict';
/* =====================================================================
   HORA PUNTA · game.js
   LÓGICA pura (sin THREE ni DOM): se puede simular sin pantalla.
   Usa Object Pooling para clientes, proyectiles, granos y charcos,
   y una rejilla espacial para colisiones entre cientos de clientes.
   ===================================================================== */
class Game {
  constructor() {
    this.E = []; for (let i = 0; i < CFG.CAP_E; i++) this.E.push({ i, active: false, type: 0, x: 0, z: 0, kx: 0, kz: 0, hp: 0, mh: 0, state: 0, dt: 0, hit: 0, slowT: 0, burnT: 0, burnTk: 0, tw: 0, fa: 0, age: 0, ph: 0, callT: 0, id: 0 });
    this.P = []; for (let i = 0; i < CFG.CAP_P; i++) this.P.push({ i, active: false, kind: 0, x: 0, z: 0, vx: 0, vz: 0, ox: 0, oz: 0, tx: 0, tz: 0, dx: 0, dz: 0, dmg: 0, life: 0, ml: 1, pierce: 0, bounce: 0, r: 0.3, evo: false, age: 0, phase: 0, a: 0, b: 0, c: 0, ids: new Int32Array(4), idn: 0 });
    this.B = []; for (let i = 0; i < CFG.CAP_B; i++) this.B.push({ i, active: false, x: 0, z: 0, v: 1, kind: 0, age: 0, mag: false });
    this.U = []; for (let i = 0; i < CFG.CAP_U; i++) this.U.push({ i, active: false, x: 0, z: 0, r: 1, t: 0, tk: 0, dmg: 0, evo: false });
    this.head = new Int32Array(CFG.GN * CFG.GN); this.next = new Int32Array(CFG.CAP_E);
    this.q = new Int32Array(CFG.CAP_E); this.q2 = new Int32Array(CFG.CAP_E);
    this.events = []; this.inp = { x: 0, z: 0 }; this.state = 'title'; this.meta = { hp: 0, speed: 0, dmg: 0, magnet: 0 };
    this.reset();
  }
  reset() {
    this.t = 0; this.serial = 0; this.eCur = this.pCur = this.bCur = this.uCur = 0; this.nE = 0;
    for (const e of this.E) e.active = false; for (const p of this.P) p.active = false;
    for (const b of this.B) b.active = false; for (const u of this.U) u.active = false;
    this.p = { x: 0, z: 8, vx: 0, vz: 0, fx: 0, fz: -1, hp: 100, maxhp: 100, iframes: 0, deadT: 0 };
    this.W = []; this.pasv = {}; this.xp = 0; this.level = 1; this.lvQ = 0; this.options = [];
    this.served = 0; this.beans = 0; this.spB = 0; this.nextWave = 30; this.waveQ = [];
    this.boss = null; this.bossSpawned = false; this.bossKilled = false; this.nestOpen = NESTS.map(() => false); this.openN = [];
    this.chain = 0; this.chainT = 0; this.auraR = 0; this.auraEvo = false; this.events.length = 0;
  }
  start(meta, startW) {
    this.reset(); this.meta = Object.assign({ hp: 0, speed: 0, dmg: 0, magnet: 0 }, meta || {});
    this.p.maxhp = CFG.BASE_HP + 10 * this.meta.hp; this.p.hp = this.p.maxhp;
    this.W = [{ id: startW || 'espresso', lv: 1, cd: 0.2, evo: false }];
    this.state = 'play'; this.emit('start');
  }
  /* Escena de portada: clientes quietos rodeando el carrito (no se simula) */
  demo() {
    this.reset(); this.state = 'title';
    for (let k = 0; k < 34; k++) {
      const a = k * 2.399, d = 5 + (k % 7) * 1.5 + Math.random() * 1.2, e = this.spawnE(k % 4, Math.cos(a) * d, 8 + Math.sin(a) * d);
      if (e) { e.age = 1; e.fa = Math.atan2(-Math.cos(a), -Math.sin(a)); }
    }
  }
  emit(t, o) { if (this.events.length > 500) return; o = o || {}; o.t = t; this.events.push(o); }
  pas(id) { return this.pasv[id] || 0; }
  dmgMul() { return 1 + 0.15 * this.pas('dmg') + 0.05 * this.meta.dmg; }

  /* ---------- rejilla espacial para colisiones entre cientos de clientes ---------- */
  gi(v) { return clamp(Math.floor((v + CFG.GO) / CFG.CELL), 0, CFG.GN - 1); }
  buildGrid() {
    this.head.fill(-1);
    for (const e of this.E) {
      if (!e.active || e.state !== 0) continue;
      const c = this.gi(e.z) * CFG.GN + this.gi(e.x); this.next[e.i] = this.head[c]; this.head[c] = e.i;
    }
  }
  query(x, z, r, buf) {
    buf = buf || this.q; let n = 0;
    const x0 = this.gi(x - r), x1 = this.gi(x + r), z0 = this.gi(z - r), z1 = this.gi(z + r);
    for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) {
      let j = this.head[cz * CFG.GN + cx]; while (j >= 0) { buf[n++] = j; j = this.next[j]; }
    }
    return n;
  }
  nearestE(x, z, maxd, pr) {
    let best = null, bd = maxd * maxd;
    for (const e of this.E) {
      if (!e.active || e.state !== 0) continue;
      if (pr && this.hasId(pr, e.id)) continue;
      const dx = e.x - x, dz = e.z - z, d = dx * dx + dz * dz; if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  hasId(pr, id) { for (let k = 0; k < pr.idn && k < 4; k++) if (pr.ids[k] === id) return true; return false; }
  addId(pr, id) { pr.ids[pr.idn & 3] = id; pr.idn++; }

  /* ---------- ciclo principal (dt en segundos) ---------- */
  update(dt) {
    if (this.state === 'play') this.updatePlay(dt);
    else if (this.state === 'dying') {
      this.p.deadT += dt; this.updateEnemies(dt * 0.0, true);
      if (this.p.deadT > 1.1) { this.state = 'over'; this.emit('over'); }
    }
  }
  updatePlay(dt) {
    this.t += dt;
    this.movePlayer(dt);
    this.director(dt);
    this.buildGrid();
    this.updateEnemies(dt, false);
    if (this.state !== 'play') return;
    this.fireWeapons(dt);
    this.updateProj(dt);
    this.updatePuddles(dt);
    this.updateBeans(dt);
    this.chainT -= dt; if (this.chainT <= 0) this.chain = 0;
    if (this.lvQ > 0 && this.state === 'play') { this.state = 'levelup'; this.options = this.genOptions(); this.emit('level'); return; }
    if (this.t >= CFG.DURATION) { this.state = 'win'; this.emit('win'); }
  }
  movePlayer(dt) {
    const p = this.p, i = this.inp, sp = CFG.BASE_SPEED * (1 + 0.1 * this.pas('speed') + 0.04 * this.meta.speed);
    p.vx = damp(p.vx, i.x * sp, 14, dt); p.vz = damp(p.vz, i.z * sp, 14, dt);
    p.x += p.vx * dt; p.z += p.vz * dt;
    const v = Math.hypot(p.vx, p.vz); if (v > 0.5) { p.fx = p.vx / v; p.fz = p.vz / v; }
    p.x = clamp(p.x, -A + 1, A - 1); p.z = clamp(p.z, -A + 1, A - 1);
    for (const o of OBST) {
      const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), m = o.r + CFG.PR;
      if (d < m && d > 0.0001) { p.x = o.x + dx / d * m; p.z = o.z + dz / d * m; }
    }
    p.iframes = Math.max(0, p.iframes - dt);
  }

  /* ---------- director: nidos que abren, goteo constante, oleadas y jefe ---------- */
  director(dt) {
    const t = this.t;
    NESTS.forEach((n, i) => { if (!this.nestOpen[i] && t >= n.at) { this.nestOpen[i] = true; this.openN.push(i); if (n.at > 0) this.emit('nest', { i }); } });
    this.spB += (1.0 + t * 0.028) * dt;
    while (this.spB >= 1) { this.spB -= 1; this.spawnNest(this.openN[(Math.random() * this.openN.length) | 0]); }
    if (t >= this.nextWave) {
      const ni = this.openN[(Math.random() * this.openN.length) | 0];
      this.waveQ.push({ ni, left: Math.min(38, 10 + Math.floor(t / 9)), tm: 0 }); this.nextWave += 38; this.emit('bell', { i: ni });
    }
    for (let k = this.waveQ.length - 1; k >= 0; k--) {
      const w = this.waveQ[k]; w.tm -= dt;
      while (w.tm <= 0 && w.left > 0) { this.spawnNest(w.ni); w.left--; w.tm += 0.07; }
      if (w.left <= 0) this.waveQ.splice(k, 1);
    }
    if (!this.bossSpawned && t >= CFG.BOSS_AT) {
      this.bossSpawned = true; const n = NESTS[0], e = this.spawnE(4, n.sx, n.sz);
      if (e) { this.boss = e; e.callT = 4; this.emit('boss'); }
    }
  }
  spawnNest(ni) {
    const n = NESTS[ni]; let sum = 0; for (const m of n.mix) sum += m[1];
    let r = Math.random() * sum, ty = n.mix[0][0]; for (const m of n.mix) { r -= m[1]; if (r <= 0) { ty = m[0]; break; } }
    return this.spawnE(ty, clamp(n.sx + (Math.random() - 0.5) * 8, -A + 1, A - 1), clamp(n.sz + (Math.random() - 0.5) * 8, -A + 1, A - 1));
  }
  /* Object pooling: reutiliza fichas de cliente inactivas (cursor circular) */
  spawnE(type, x, z) {
    if (this.nE >= CFG.CAP_E) return null;
    let e = null;
    for (let k = 0; k < CFG.CAP_E; k++) { const c = this.E[(this.eCur + k) % CFG.CAP_E]; if (!c.active) { e = c; this.eCur = (c.i + 1) % CFG.CAP_E; break; } }
    if (!e) return null;
    const T = ET[type], mul = type === 4 ? 1 : 1 + this.t * 0.006;
    e.active = true; e.type = type; e.x = x; e.z = z; e.kx = e.kz = 0; e.hp = e.mh = T.hp * mul; e.state = 0; e.dt = 0; e.hit = 0;
    e.slowT = e.burnT = e.burnTk = e.tw = 0; e.age = 0; e.ph = Math.random() * 6.28; e.callT = 0; e.id = ++this.serial; e.fa = 0;
    this.nE++; return e;
  }
}
// FIN DE ARCHIVO
      
