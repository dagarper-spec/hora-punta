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

  /* ---------- clientes ---------- */
  updateEnemies(dt, frozen) {
    const p = this.p, T0 = this.t;
    for (const e of this.E) {
      if (!e.active) continue;
      if (e.state === 1) { e.dt += dt; if (e.dt > 0.6) { e.active = false; this.nE--; } continue; }
      if (frozen) continue;
      const T = ET[e.type]; e.age += dt;
      e.hit = Math.max(0, e.hit - dt); e.tw = Math.max(0, e.tw - dt); e.slowT = Math.max(0, e.slowT - dt);
      if (e.burnT > 0) { e.burnT -= dt; e.burnTk -= dt; if (e.burnTk <= 0) { e.burnTk = 0.5; this.hit(e, 3 * this.dmgMul(), 0, 0, true); if (e.state !== 0) continue; } }
      let dx = p.x - e.x, dz = p.z - e.z; const d = Math.hypot(dx, dz) || 0.001; dx /= d; dz /= d; e.fa = Math.atan2(dx, dz);
      const sp = T.sp * (e.slowT > 0 ? 0.55 : 1) * Math.min(1, 0.4 + e.age * 3);
      let vx = dx * sp + e.kx, vz = dz * sp + e.kz; const kd = Math.exp(-8 * dt); e.kx *= kd; e.kz *= kd;
      const n = this.query(e.x, e.z, T.r * 2.2);
      for (let k = 0; k < n; k++) {
        const o = this.E[this.q[k]]; if (o === e) continue;
        const ox = e.x - o.x, oz = e.z - o.z, od = Math.hypot(ox, oz), m = T.r + ET[o.type].r;
        if (od < m && od > 0.0001) { const f = (m - od) / m * 6; vx += ox / od * f; vz += oz / od * f; }
      }
      e.x = clamp(e.x + vx * dt, -A - 5, A + 5); e.z = clamp(e.z + vz * dt, -A - 5, A + 5);
      for (const o of OBST) {
        const ox = e.x - o.x, oz = e.z - o.z, od = Math.hypot(ox, oz), m = o.r + T.r;
        if (od < m && od > 0.0001) { e.x = o.x + ox / od * m; e.z = o.z + oz / od * m; }
      }
      if (e.type === 4) {                              // el jefe convoca refuerzos
        e.callT -= dt;
        if (e.callT <= 0) { e.callT = 6; for (let k = 0; k < 5; k++) { const a = k * 1.2566; this.spawnE(0, e.x + Math.cos(a) * 2.6, e.z + Math.sin(a) * 2.6); } this.emit('bossCall', { x: e.x, z: e.z }); }
      }
      if (d < T.r + CFG.PR) { this.hurt(T.dmg * (1 + T0 / 600)); e.kx -= dx * 5; e.kz -= dz * 5; if (this.state !== 'play') return; }
    }
  }
  hurt(dmg) {
    const p = this.p; if (p.iframes > 0) return;
    p.hp -= dmg; p.iframes = 0.6; this.emit('hurt', { dmg });
    if (p.hp <= 0) { p.hp = 0; this.state = 'dying'; p.deadT = 0; this.emit('die'); }
  }
  /* Daño a un cliente; devuelve true si lo mata ("atiende" y se marcha feliz) */
  hit(e, dmg, kx, kz, quiet) {
    if (!e.active || e.state !== 0) return false;
    const crit = Math.random() < 0.1; if (crit) dmg *= 2;
    e.hp -= dmg; e.hit = 0.1; const k = ET[e.type].kb; e.kx += kx * k; e.kz += kz * k;
    const dead = e.hp <= 0;
    if (!quiet || dead) this.emit('hit', { x: e.x, z: e.z, dmg, crit, quiet: !!quiet });
    if (dead) this.serve(e);
    return dead;
  }
  serve(e) {
    e.state = 1; e.dt = 0; this.served++;
    const T = ET[e.type];
    if (e.type === 4) {
      for (let k = 0; k < 10; k++) this.spawnBean(e.x + (Math.random() - 0.5) * 3, e.z + (Math.random() - 0.5) * 3, T.bean, 0);
      this.boss = null; this.bossKilled = true; this.emit('bossDown', { x: e.x, z: e.z });
    } else {
      this.spawnBean(e.x, e.z, T.bean, 0);
      if (Math.random() < 0.025) this.spawnBean(e.x + 0.6, e.z, 1, 1);
    }
    this.emit('serve', { x: e.x, z: e.z, type: e.type });
  }
  explode(x, z, r, dmg) {
    const n = this.query(x, z, r + 1, this.q2);
    for (let k = 0; k < n; k++) {
      const e = this.E[this.q2[k]]; if (e.state !== 0) continue;
      const dx = e.x - x, dz = e.z - z, d = Math.hypot(dx, dz); if (d > r + e.r) continue;
      this.hit(e, dmg, dx / (d || 1) * 4, dz / (d || 1) * 4, true);
    }
    this.emit('explode', { x, z, r });
  }

  /* ---------- armas ---------- */
  /* Estadísticas de un arma según su nivel, pasivas y promoción */
  wst(w) {
    const L = w.lv - 1, dm = this.dmgMul(), cm = 1 / (1 + 0.12 * this.pas('cd')), am = 1 + 0.12 * this.pas('area'), ev = w.evo;
    switch (w.id) {
      case 'espresso': return { cd: [.4, .36, .33, .3, .27][L] * cm * (ev ? 0.8 : 1), dmg: [9, 10, 11, 12, 14][L] * dm * (ev ? 1.6 : 1), n: [1, 1, 2, 2, 3][L], pierce: ev ? 3 : 0, burn: ev };
      case 'croissant': return { cd: [1.4, 1.3, 1.2, 1.1, 1.0][L] * cm, dmg: [12, 14, 16, 18, 22][L] * dm, bounce: [2, 3, 3, 4, 5][L], n: [1, 1, 2, 2, 3][L], boom: ev };
      case 'canela': return { tick: 0.5 * cm, dmg: [4, 5, 6, 7, 9][L] * dm * (ev ? 1.5 : 1), r: [2.2, 2.5, 2.8, 3.1, 3.5][L] * am * (ev ? 1.4 : 1), slow: ev };
      case 'tostada': return { cd: [2, 1.8, 1.6, 1.5, 1.4][L] * cm, dmg: [14, 16, 18, 20, 24][L] * dm, n: [1, 1, 2, 2, 3][L] + (ev ? 2 : 0), big: ev };
      case 'zumo': return { cd: [2.6, 2.4, 2.2, 2.0, 1.8][L] * cm, dmg: [16, 19, 22, 26, 30][L] * dm, r: [1.8, 2.0, 2.2, 2.4, 2.7][L] * am * (ev ? 1.4 : 1), n: [1, 1, 1, 2, 2][L], pdur: ev ? 5 : 2, ptk: (ev ? 6 : 2) * dm, evo: ev };
      default: return { cd: [1.2, 1.1, 1.0, .9, .8][L] * cm, dmg: [6, 6, 7, 8, 9][L] * dm * (ev ? 1.5 : 1), n: [3, 4, 5, 6, 7][L] + (ev ? 4 : 0), pierce: ev ? 2 : 0, life: ev ? 0.6 : 0.45, evo: ev };
    }
  }
  fireWeapons(dt) {
    const p = this.p; this.auraR = 0;
    for (const w of this.W) {
      const s = this.wst(w);
      if (w.id === 'canela') {
        this.auraR = s.r; this.auraEvo = w.evo; w.cd -= dt;
        if (w.cd <= 0) {
          w.cd = s.tick; const n = this.query(p.x, p.z, s.r + 1, this.q2);
          for (let k = 0; k < n; k++) {
            const e = this.E[this.q2[k]]; if (e.state !== 0) continue;
            const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz); if (d > s.r + e.r) continue;
            this.hit(e, s.dmg, dx / (d || 1) * 1.2, dz / (d || 1) * 1.2, true); if (s.slow) e.slowT = 0.8;
          }
        }
        continue;
      }
      w.cd -= dt; if (w.cd > 0) continue;
      if (w.id === 'espresso') {
        const t = this.nearestE(p.x, p.z, 16); if (!t) continue;
        const base = Math.atan2(t.x - p.x, t.z - p.z);
        for (let k = 0; k < s.n; k++) {
          const a = base + (k - (s.n - 1) / 2) * 0.14, pr = this.spawnP(0, p.x, p.z, Math.sin(a) * 24, Math.cos(a) * 24, s.dmg, 0.8, 0.4);
          if (pr) { pr.pierce = s.pierce; pr.evo = s.burn; }
        }
        w.cd = s.cd; this.emit('shoot', { k: 0 });
      } else if (w.id === 'croissant') {
        const t = this.nearestE(p.x, p.z, 14); if (!t) continue;
        const base = Math.atan2(t.x - p.x, t.z - p.z);
        for (let k = 0; k < s.n; k++) {
          const a = base + (k - (s.n - 1) / 2) * 0.5, pr = this.spawnP(1, p.x, p.z, Math.sin(a) * 15, Math.cos(a) * 15, s.dmg, 3, 0.55);
          if (pr) { pr.bounce = s.bounce; pr.evo = s.boom; }
        }
        w.cd = s.cd; this.emit('shoot', { k: 1 });
      } else if (w.id === 'tostada') {
        const t = this.nearestE(p.x, p.z, 16);
        const base = t ? Math.atan2(t.x - p.x, t.z - p.z) : Math.atan2(p.fx, p.fz);
        for (let k = 0; k < s.n; k++) {
          const a = base + (k - (s.n - 1) / 2) * (s.n > 3 ? 0.9 : 1.1), pr = this.spawnP(2, p.x, p.z, 0, 0, s.dmg, 6, s.big ? 1.1 : 0.7);
          if (pr) { pr.dx = Math.sin(a); pr.dz = Math.cos(a); pr.phase = 0; pr.evo = s.big; }
        }
        w.cd = s.cd; this.emit('shoot', { k: 2 });
      } else if (w.id === 'zumo') {
        for (let k = 0; k < s.n; k++) {
          let t = this.pickRandomE(14) || this.nearestE(p.x, p.z, 16), tx, tz;
          if (t) { tx = t.x; tz = t.z; } else { tx = p.x + p.fx * 6; tz = p.z + p.fz * 6; }
          const pr = this.spawnP(3, p.x, p.z, 0, 0, s.dmg, 0.75, 0.3);
          if (pr) { pr.ox = p.x; pr.oz = p.z; pr.tx = tx; pr.tz = tz; pr.ml = 0.75; pr.a = s.r; pr.b = s.pdur; pr.c = s.ptk; pr.evo = s.evo; }
        }
        w.cd = s.cd; this.emit('shoot', { k: 3 });
      } else {
        const t = this.nearestE(p.x, p.z, 11); if (!t) continue;
        const base = Math.atan2(t.x - p.x, t.z - p.z);
        for (let k = 0; k < s.n; k++) {
          const a = base + (Math.random() - 0.5) * 0.7, sp = 17 + Math.random() * 4, pr = this.spawnP(4, p.x, p.z, Math.sin(a) * sp, Math.cos(a) * sp, s.dmg, s.life, 0.3);
          if (pr) { pr.pierce = s.pierce; pr.evo = s.evo; }
        }
        w.cd = s.cd; this.emit('shoot', { k: 4 });
      }
    }
  }
  pickRandomE(maxd) {
    const p = this.p;
    for (let k = 0; k < 8; k++) { const e = this.E[(Math.random() * CFG.CAP_E) | 0]; if (e.active && e.state === 0 && Math.hypot(e.x - p.x, e.z - p.z) < maxd) return e; }
    return null;
  }
  /* Object pooling de proyectiles */
  spawnP(kind, x, z, vx, vz, dmg, life, r) {
    let pr = null;
    for (let k = 0; k < CFG.CAP_P; k++) { const c = this.P[(this.pCur + k) % CFG.CAP_P]; if (!c.active) { pr = c; this.pCur = (c.i + 1) % CFG.CAP_P; break; } }
    if (!pr) return null;
    pr.active = true; pr.kind = kind; pr.x = x; pr.z = z; pr.vx = vx; pr.vz = vz; pr.dmg = dmg; pr.life = life; pr.ml = life; pr.r = r;
    pr.pierce = 0; pr.bounce = 0; pr.evo = false; pr.age = 0; pr.phase = 0; pr.idn = 0; pr.ids.fill(0); return pr;
  }
  updateProj(dt) {
    const p = this.p;
    for (const pr of this.P) {
      if (!pr.active) continue;
      pr.age += dt;
      if (pr.kind === 3) {                              // botella en parábola
        const u = Math.min(1, pr.age / pr.ml);
        pr.x = pr.ox + (pr.tx - pr.ox) * u; pr.z = pr.oz + (pr.tz - pr.oz) * u;
        if (u >= 1) { pr.active = false; this.explode(pr.x, pr.z, pr.a, pr.dmg); this.spawnPuddle(pr.x, pr.z, pr.a * 0.9, pr.b, pr.c, pr.evo); }
        continue;
      }
      if (pr.kind === 2) {                              // bumerán: sale, frena y vuelve a ti
        if (pr.phase === 0) { const f = Math.max(0, 1 - pr.age / 0.7), sp = 18 * f; pr.x += pr.dx * sp * dt; pr.z += pr.dz * sp * dt; if (pr.age >= 0.7) pr.phase = 1; }
        else {
          const dx = p.x - pr.x, dz = p.z - pr.z, d = Math.hypot(dx, dz) || 0.001, sp = Math.min(28, 10 + (pr.age - 0.7) * 30);
          pr.x += dx / d * sp * dt; pr.z += dz / d * sp * dt; if (d < 0.9) { pr.active = false; continue; }
        }
        if (pr.age > 5) { pr.active = false; continue; }
        const n = this.query(pr.x, pr.z, pr.r + 1, this.q2);
        for (let k = 0; k < n; k++) {
          const e = this.E[this.q2[k]]; if (e.state !== 0 || e.tw > 0) continue;
          if (Math.hypot(e.x - pr.x, e.z - pr.z) > pr.r + e.r) continue;
          e.tw = 0.35; this.hit(e, pr.dmg, pr.dx * 2, pr.dz * 2);
        }
        continue;
      }
      pr.life -= dt; if (pr.life <= 0) { pr.active = false; continue; }
      const sp = Math.hypot(pr.vx, pr.vz), n = Math.max(1, Math.ceil(sp * dt / 0.5)), h = dt / n;
      for (let s = 0; s < n && pr.active; s++) { pr.x += pr.vx * h; pr.z += pr.vz * h; this.projHit(pr); }
      if (Math.abs(pr.x) > A + 12 || Math.abs(pr.z) > A + 12) pr.active = false;
    }
  }
  projHit(pr) {
    const n = this.query(pr.x, pr.z, pr.r + 1.2);
    for (let k = 0; k < n; k++) {
      const e = this.E[this.q[k]]; if (e.state !== 0 || this.hasId(pr, e.id)) continue;
      const dx = e.x - pr.x, dz = e.z - pr.z, d = Math.hypot(dx, dz); if (d > pr.r + e.r) continue;
      const sp = Math.hypot(pr.vx, pr.vz) || 1;
      this.addId(pr, e.id);
      if (pr.kind === 0 && pr.evo) e.burnT = 2.5;
      this.hit(e, pr.dmg, pr.vx / sp * 3, pr.vz / sp * 3);
      if (pr.kind === 1) {                              // croissant: rebota hacia el siguiente cliente
        if (pr.evo) this.explode(pr.x, pr.z, 2.0, pr.dmg * 0.7);
        pr.bounce--; const t = pr.bounce >= 0 ? this.nearestE(pr.x, pr.z, 10, pr) : null;
        if (!t) { pr.active = false; return; }
        const a = Math.atan2(t.x - pr.x, t.z - pr.z); pr.vx = Math.sin(a) * 15; pr.vz = Math.cos(a) * 15; pr.life = 3; return;
      }
      pr.pierce--; if (pr.pierce < 0) { pr.active = false; return; }
    }
  }
  spawnPuddle(x, z, r, t, dmg, evo) {
    let u = null;
    for (let k = 0; k < CFG.CAP_U; k++) { const c = this.U[(this.uCur + k) % CFG.CAP_U]; if (!c.active) { u = c; this.uCur = (c.i + 1) % CFG.CAP_U; break; } }
    if (!u) u = this.U[this.uCur++ % CFG.CAP_U];
    u.active = true; u.x = x; u.z = z; u.r = r; u.t = t; u.tk = 0.2; u.dmg = dmg; u.evo = evo;
  }
  updatePuddles(dt) {
    for (const u of this.U) {
      if (!u.active) continue;
      u.t -= dt; if (u.t <= 0) { u.active = false; continue; }
      u.tk -= dt; if (u.tk > 0) continue; u.tk = 0.4;
      const n = this.query(u.x, u.z, u.r + 1, this.q2);
      for (let k = 0; k < n; k++) {
        const e = this.E[this.q2[k]]; if (e.state !== 0 || Math.hypot(e.x - u.x, e.z - u.z) > u.r + e.r) continue;
        e.slowT = 0.6; if (u.evo) e.burnT = Math.max(e.burnT, 1.5); this.hit(e, u.dmg, 0, 0, true);
      }
    }
  }

  /* ---------- granos de café (experiencia) y bollos de vida ---------- */
  spawnBean(x, z, v, kind) {
    let b = null;
    for (let k = 0; k < CFG.CAP_B; k++) { const c = this.B[(this.bCur + k) % CFG.CAP_B]; if (!c.active) { b = c; this.bCur = (c.i + 1) % CFG.CAP_B; break; } }
    if (!b) {                                           // pool lleno: fusiona con el grano más cercano
      let bd = 1e9; for (const c of this.B) { if (c.kind !== kind) continue; const d = Math.hypot(c.x - x, c.z - z); if (d < bd) { bd = d; b = c; } }
      if (b) b.v += v; return;
    }
    b.active = true; b.x = x; b.z = z; b.v = v; b.kind = kind; b.age = 0; b.mag = false;
  }
  updateBeans(dt) {
    const p = this.p, mr = 3.2 * (1 + 0.25 * this.pas('magnet') + 0.15 * this.meta.magnet);
    for (const b of this.B) {
      if (!b.active) continue;
      b.age += dt; const dx = p.x - b.x, dz = p.z - b.z, d = Math.hypot(dx, dz);
      if (!b.mag && d < mr) b.mag = true;
      if (b.mag) { const sp = 11 + (b.age > 0 ? 8 : 0) + Math.max(0, (mr - d)) * 2; b.x += dx / (d || 1) * sp * dt; b.z += dz / (d || 1) * sp * dt; }
      if (d < 0.95) {
        b.active = false;
        if (b.kind === 1) { p.hp = Math.min(p.maxhp, p.hp + 15); this.emit('heal', { x: p.x, z: p.z }); }
        else { this.chain++; this.chainT = 0.5; this.beans += b.v; this.addXp(b.v); this.emit('bean', { chain: this.chain, x: b.x, z: b.z }); }
      }
    }
  }
  addXp(v) {
    this.xp += v;
    while (this.xp >= xpNeed(this.level)) { this.xp -= xpNeed(this.level); this.level++; this.lvQ++; }
  }

  /* ---------- subida de nivel: 3 opciones al azar (las promociones tienen prioridad) ---------- */
  genOptions() {
    const opts = [], ws = this.W, pool = [];
    for (const w of ws) { const D = WEAP[w.id]; if (!w.evo && w.lv >= 5 && ws.some(o => o.id === D.evo.need)) opts.push({ k: 'evo', id: w.id, n: D.evo.n, i: D.evo.i, d: D.evo.d, tag: '¡PROMOCIÓN!' }); }
    for (const w of ws) if (w.lv < 5) pool.push({ k: 'wup', id: w.id, n: WEAP[w.id].n, i: WEAP[w.id].i, d: WEAP[w.id].up[w.lv - 1], tag: 'NIVEL ' + (w.lv + 1) });
    if (ws.length < 4) for (const id in WEAP) if (!ws.some(w => w.id === id)) pool.push({ k: 'wnew', id, n: WEAP[id].n, i: WEAP[id].i, d: WEAP[id].d, tag: 'NUEVA ARMA' });
    const pn = Object.keys(this.pasv).length;
    for (const id in PAS) { const l = this.pas(id); if (l >= 5 || (l === 0 && pn >= 5)) continue; pool.push({ k: 'p', id, n: PAS[id].n, i: PAS[id].i, d: PAS[id].d, tag: l ? 'NIVEL ' + (l + 1) : 'MEJORA' }); }
    for (let i = pool.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    while (opts.length < 3 && pool.length) opts.push(pool.pop());
    if (!opts.length) opts.push({ k: 'heal', id: '', n: 'Café gratis', i: '🎁', d: 'Recuperas 40 de vida', tag: 'EXTRA' });
    return opts;
  }
  choose(i) {
    const o = this.options[i], p = this.p; if (!o || this.state !== 'levelup') return;
    if (o.k === 'evo') this.W.find(w => w.id === o.id).evo = true;
    else if (o.k === 'wup') this.W.find(w => w.id === o.id).lv++;
    else if (o.k === 'wnew') this.W.push({ id: o.id, lv: 1, cd: 0.2, evo: false });
    else if (o.k === 'p') { this.pasv[o.id] = this.pas(o.id) + 1; if (o.id === 'hp') { p.maxhp += 20; p.hp = Math.min(p.maxhp, p.hp + 20); } }
    else p.hp = Math.min(p.maxhp, p.hp + 40);
    this.emit('pick', { o }); this.lvQ--;
    if (this.lvQ > 0) this.options = this.genOptions(); else { this.state = 'play'; p.iframes = 1; }
  }
}

// FIN DE ARCHIVO
