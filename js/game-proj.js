'use strict';
/* HORA PUNTA · game-proj.js: proyectiles, granos y niveles (se añade a la clase Game) */
Object.assign(Game.prototype, {
  /* Object pooling de proyectiles */
  spawnP(kind, x, z, vx, vz, dmg, life, r) {
    let pr = null;
    for (let k = 0; k < CFG.CAP_P; k++) { const c = this.P[(this.pCur + k) % CFG.CAP_P]; if (!c.active) { pr = c; this.pCur = (c.i + 1) % CFG.CAP_P; break; } }
    if (!pr) return null;
    pr.active = true; pr.kind = kind; pr.x = x; pr.z = z; pr.vx = vx; pr.vz = vz; pr.dmg = dmg; pr.life = life; pr.ml = life; pr.r = r;
    pr.pierce = 0; pr.bounce = 0; pr.evo = false; pr.age = 0; pr.phase = 0; pr.idn = 0; pr.ids.fill(0); return pr;
  },
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
  },
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
  },
  spawnPuddle(x, z, r, t, dmg, evo) {
    let u = null;
    for (let k = 0; k < CFG.CAP_U; k++) { const c = this.U[(this.uCur + k) % CFG.CAP_U]; if (!c.active) { u = c; this.uCur = (c.i + 1) % CFG.CAP_U; break; } }
    if (!u) u = this.U[this.uCur++ % CFG.CAP_U];
    u.active = true; u.x = x; u.z = z; u.r = r; u.t = t; u.tk = 0.2; u.dmg = dmg; u.evo = evo;
  },
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
  },

  /* ---------- granos de café (experiencia) y bollos de vida ---------- */
  spawnBean(x, z, v, kind) {
    let b = null;
    for (let k = 0; k < CFG.CAP_B; k++) { const c = this.B[(this.bCur + k) % CFG.CAP_B]; if (!c.active) { b = c; this.bCur = (c.i + 1) % CFG.CAP_B; break; } }
    if (!b) {                                           // pool lleno: fusiona con el grano más cercano
      let bd = 1e9; for (const c of this.B) { if (c.kind !== kind) continue; const d = Math.hypot(c.x - x, c.z - z); if (d < bd) { bd = d; b = c; } }
      if (b) b.v += v; return;
    }
    b.active = true; b.x = x; b.z = z; b.v = v; b.kind = kind; b.age = 0; b.mag = false;
  },
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
  },
  addXp(v) {
    this.xp += v;
    while (this.xp >= xpNeed(this.level)) { this.xp -= xpNeed(this.level); this.level++; this.lvQ++; }
  },

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
  },
  choose(i) {
    const o = this.options[i], p = this.p; if (!o || this.state !== 'levelup') return;
    if (o.k === 'evo') this.W.find(w => w.id === o.id).evo = true;
    else if (o.k === 'wup') this.W.find(w => w.id === o.id).lv++;
    else if (o.k === 'wnew') this.W.push({ id: o.id, lv: 1, cd: 0.2, evo: false });
    else if (o.k === 'p') { this.pasv[o.id] = this.pas(o.id) + 1; if (o.id === 'hp') { p.maxhp += 20; p.hp = Math.min(p.maxhp, p.hp + 20); } }
    else p.hp = Math.min(p.maxhp, p.hp + 40);
    this.emit('pick', { o }); this.lvQ--;
    if (this.lvQ > 0) this.options = this.genOptions(); else { this.state = 'play'; p.iframes = 1; }
  },
});
// FIN DE ARCHIVO
    
