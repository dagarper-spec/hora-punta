'use strict';
/* HORA PUNTA · game-combat.js: clientes, daño y armas (se añade a la clase Game) */
Object.assign(Game.prototype, {

  /* ---------- clientes ---------- */
  updateEnemies(dt, frozen) {
    const p = this.p, T0 = this.t;
    for (const e of this.E) {
      if (!e.active) continue;
      if (e.state === 1) { e.dt += dt; if (e.dt > CFG.LEAVE) { e.active = false; this.nE--; } continue; }
      if (frozen) continue;
      const T = ET[e.type]; e.age += dt;
      e.hit = Math.max(0, e.hit - dt); e.tw = Math.max(0, e.tw - dt); e.slowT = Math.max(0, e.slowT - dt);
      if (e.burnT > 0) { e.burnT -= dt; e.burnTk -= dt; if (e.burnTk <= 0) { e.burnTk = 0.5; this.hit(e, 3 * this.dmgMul(), 0, 0, true); if (e.state !== 0) continue; } }
      let dx = p.x - e.x, dz = p.z - e.z; const d = Math.hypot(dx, dz) || 0.001; dx /= d; dz /= d; e.fa = Math.atan2(dx, dz);
      let rage = 0;
      if (e.type === 4) { const q = e.hp / e.mh; rage = q < 0.33 ? 2 : q < 0.66 ? 1 : 0; if (rage > e.rg) { e.rg = rage; e.callT = Math.min(e.callT, 0.5); this.emit('bossPhase', { x: e.x, z: e.z, r: rage }); } }   // fases del jefe
      const sp = T.sp * (e.slowT > 0 ? 0.55 : 1) * Math.min(1, 0.4 + e.age * 3) * (1 + 0.22 * rage);
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
        if (e.callT <= 0) { e.callT = 6 - 1.2 * rage; const nc = 5 + rage * 2; for (let k = 0; k < nc; k++) { const a = k * 6.2832 / nc; this.spawnE(rage === 2 && this.day.tide && k % 3 === 0 ? 5 : 0, e.x + Math.cos(a) * 2.6, e.z + Math.sin(a) * 2.6); } this.emit('bossCall', { x: e.x, z: e.z }); }
      }
      if (d < T.r + CFG.PR) { this.hurt(T.dmg * (1 + T0 / 600) * this.day.dmg); e.kx -= dx * 5; e.kz -= dz * 5; if (this.state !== 'play') return; }
    }
  },
  hurt(dmg) {
    const p = this.p; if (p.iframes > 0) return;
    p.hp -= dmg; p.iframes = 0.6; this.emit('hurt', { dmg });
    if (p.hp <= 0) { p.hp = 0; this.state = 'dying'; p.deadT = 0; this.emit('die'); }
  },
  /* Daño a un cliente; devuelve true si lo mata ("atiende" y se marcha feliz) */
  hit(e, dmg, kx, kz, quiet) {
    if (!e.active || e.state !== 0) return false;
    const crit = Math.random() < 0.1; if (crit) dmg *= 2; dmg *= ET[e.type].ar || 1;
    e.hp -= dmg; e.hit = 0.1; const k = ET[e.type].kb; e.kx += kx * k; e.kz += kz * k;
    const dead = e.hp <= 0;
    if (!quiet || dead) this.emit('hit', { x: e.x, z: e.z, dmg, crit, quiet: !!quiet });
    if (dead) this.serve(e);
    return dead;
  },
  serve(e) {
    e.state = 1; e.dt = 0; this.served++;
    const T = ET[e.type];
    if (e.type === 4) {
      for (let k = 0; k < 10; k++) this.spawnBean(e.x + (Math.random() - 0.5) * 3, e.z + (Math.random() - 0.5) * 3, T.bean, 0);
      this.boss = null; this.bossKilled = true; this.emit('bossDown', { x: e.x, z: e.z });
    } else {
      const v = T.bean === 1 && Math.random() < 0.06 ? 2 : T.bean;   // a veces paga con billete
      this.spawnBean(e.x, e.z, v, 0);
      if (Math.random() < 0.025) this.spawnBean(e.x + 0.6, e.z, 1, 1);
    }
    this.emit('serve', { x: e.x, z: e.z, type: e.type });
  },
  explode(x, z, r, dmg) {
    const n = this.query(x, z, r + 1, this.q2);
    for (let k = 0; k < n; k++) {
      const e = this.E[this.q2[k]]; if (e.state !== 0) continue;
      const dx = e.x - x, dz = e.z - z, d = Math.hypot(dx, dz); if (d > r + e.r) continue;
      this.hit(e, dmg, dx / (d || 1) * 4, dz / (d || 1) * 4, true);
    }
    this.emit('explode', { x, z, r });
  },

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
  },
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
  },
  pickRandomE(maxd) {
    const p = this.p;
    for (let k = 0; k < 8; k++) { const e = this.E[(Math.random() * CFG.CAP_E) | 0]; if (e.active && e.state === 0 && Math.hypot(e.x - p.x, e.z - p.z) < maxd) return e; }
    return null;
  },
});
// FIN DE ARCHIVO
