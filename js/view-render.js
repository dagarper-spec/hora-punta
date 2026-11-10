'use strict';
/* HORA PUNTA · view-render.js: dibujado de cada frame (se añade a la clase View) */
Object.assign(View.prototype, {

  /* ---------- frame ---------- */
  render(dt, clock) {
    const g = this.g, p = g.p, t = this.time = clock, calm = g.state === 'win';
    // amanecer: del naranja al azul de media mañana
    const k = g.state === 'title' ? 0.2 : Math.min(1, g.t / CFG.DURATION);
    if (!this.cA) { this.cA = new THREE.Color(0xffc79a); this.cB = new THREE.Color(0xbfe6ff); this.cT = new THREE.Color(); }
    this.cT.copy(this.cA).lerp(this.cB, Math.sqrt(k)); this.scene.background.copy(this.cT); this.scene.fog.color.copy(this.cT);
    this.hemi.intensity = lerp(0.7, 1.0, k); this.sun.color.setHex(k < 0.4 ? 0xffd7a6 : 0xfff3e0); this.sun.intensity = lerp(0.8, 1.15, k);
    this.water.material.color.setHSL(0.55, 0.8, 0.6 + 0.04 * Math.sin(t * 2));

    // carrito del jugador
    const face = Math.atan2(p.fx, p.fz), mv = Math.hypot(p.vx, p.vz), pl = this.player;
    pl.position.set(p.x, Math.abs(Math.sin(t * 12)) * 0.05 * Math.min(1, mv / 3), p.z);
    let dy = face - pl.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); pl.rotation.y += dy * (1 - Math.exp(-12 * dt));
    pl.rotation.z = Math.sin(t * 12) * 0.02 * Math.min(1, mv / 3);
    pl.visible = g.state !== 'dying' || Math.floor(t * 20) % 2 === 0;
    const blink = p.iframes > 0 && g.state === 'play' && Math.floor(t * 24) % 2 === 0;
    this.playerMat.emissive.setRGB(blink ? 0.6 : 0, blink ? 0.1 : 0, blink ? 0.1 : 0);
    if (g.state === 'play' && Math.random() < dt * 8) this.emitP(p.x - p.fx * 1.4 - 0.4, 2.0, p.z - p.fz * 1.4, (Math.random() - 0.5) * 0.4, 1.4, (Math.random() - 0.5) * 0.4, [0.9, 0.9, 0.9], 0.8, -0.5);   // vapor de la cafetera
    this.aura.visible = g.auraR > 0; if (g.auraR > 0) { this.aura.position.set(p.x, 0, p.z); this.aura.scale.setScalar(g.auraR); this.auraRing.rotation.z = t; const c = g.auraEvo ? 0xffa030 : 0xc9782f; this.aura.children[0].material.color.setHex(c); }

    // nidos
    this.nests.forEach((n, i) => { const o = g.nestOpen[i] || g.state === 'title'; if (g.state === 'title') { n.mf.color.setHex(0xffffff); n.door.material.color.setHex(0xffe08a); } this.nestPulse[i] = Math.max(0, this.nestPulse[i] - dt * 1.4); n.grp.scale.setScalar(1 + this.nestPulse[i] * 0.05 * Math.sin(this.nestPulse[i] * 20)); if (!o) n.door.material.color.setHex(0x6a4a30); });

    this.renderCrowd(dt, calm); this.renderProj(); this.renderPickups();

    // cámara cenital inclinada que sigue al jugador (más alta en vertical)
    const asp = this.w / this.h, hgt = asp < 0.8 ? 30 : asp < 1.2 ? 26 : 22, back = hgt * 0.62;
    const tx = p.x, tz = p.z + back;
    if (!this.camInit) { this.camPos.set(tx, hgt, tz); this.camInit = true; }
    this.camPos.x += (tx - this.camPos.x) * (1 - Math.exp(-6 * dt)); this.camPos.z += (tz - this.camPos.z) * (1 - Math.exp(-6 * dt)); this.camPos.y += (hgt - this.camPos.y) * (1 - Math.exp(-3 * dt));
    this.shake = Math.max(0, this.shake - dt * 2.5);
    this.camera.position.set(this.camPos.x + (Math.random() - 0.5) * this.shake, this.camPos.y + (Math.random() - 0.5) * this.shake, this.camPos.z);
    this.camera.lookAt(this.camPos.x, 0, this.camPos.z - back);

    this.updateFX(dt); this.hurtF = Math.max(0, this.hurtF - dt * 2.5); this.flash = Math.max(0, this.flash - dt * 2);
    if (this.composer) {
      const low = (g.state === 'play' && p.hp < p.maxhp * 0.3) ? 0.35 : 0;
      const u = this.fxPass.uniforms; u.uHurt.value = this.hurtF * 0.8; u.uFlash.value = this.flash * 0.5; u.uLow.value = low; u.uTime.value = t;
      this.composer.render(dt);
    } else this.renderer.render(this.scene, this.camera);
    this.adapt(dt);
  },
  renderCrowd(dt, calm) {
    const g = this.g, t = this.time, cnt = [0, 0, 0, 0]; let si = 0, boss = null;
    for (const e of g.E) {
      if (!e.active) continue;
      const T = ET[e.type];
      if (e.type === 4) boss = e;
      const dying = e.state === 1, u = dying ? Math.min(1, e.dt / 0.6) : 0;
      let s = T.sc * Math.min(1, 0.3 + e.age * 3.5), y = 0, ry = e.fa, f = 1 + e.hit * 12;
      const hop = !dying ? Math.abs(Math.sin(t * (e.type === 2 ? 14 : e.type === 3 ? 5 : 8) + e.ph)) * (e.type === 2 ? 0.2 : 0.15) : 0;
      y = hop;
      if (dying) { y = Math.sin(Math.min(u * 1.6, 1) * Math.PI) * 1.2; s *= 1 - u * u; ry += u * 6; f = 1; }
      if (calm && !dying) { y = hop * 0.5; }
      if (e.type !== 4) {
        const m = this.cm[e.type], k = cnt[e.type]++;
        dummy.position.set(e.x, y, e.z); dummy.rotation.set(!dying && e.type === 2 ? 0.25 : 0.1, ry, 0); dummy.scale.set(s, s, s); dummy.updateMatrix();
        m.setMatrixAt(k, dummy.matrix); const a = m.instanceColor.array; a[k * 3] = a[k * 3 + 1] = a[k * 3 + 2] = f;
      }
      dummy.position.set(e.x, 0.04, e.z); dummy.rotation.set(0, 0, 0); const sh = T.r * 2.4 * (dying ? 1 - u : Math.min(1, e.age * 4)); dummy.scale.set(sh, 1, sh); dummy.updateMatrix(); this.shadow.setMatrixAt(si++, dummy.matrix);
    }
    for (let ty = 0; ty < 4; ty++) { const m = this.cm[ty]; m.count = cnt[ty]; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
    // sombra del jugador
    dummy.position.set(g.p.x, 0.04, g.p.z); dummy.scale.set(2.2, 1, 3); dummy.rotation.set(0, this.player.rotation.y, 0); dummy.updateMatrix(); this.shadow.setMatrixAt(si++, dummy.matrix);
    this.shadow.count = si; this.shadow.instanceMatrix.needsUpdate = true;
    const bm = this.bossMesh;
    if (boss) {
      const dying = boss.state === 1, u = dying ? Math.min(1, boss.dt / 0.6) : 0, s = ET[4].sc * (1 - u * u);
      bm.visible = true; bm.position.set(boss.x, dying ? Math.sin(Math.min(u * 1.6, 1) * Math.PI) * 2 : Math.abs(Math.sin(t * 4)) * 0.25, boss.z); bm.rotation.set(0.05, boss.fa + u * 6, 0); bm.scale.setScalar(s);
      bm.material.emissive.setRGB(boss.hit > 0 ? 0.5 : 0, boss.hit > 0 ? 0.5 : 0, boss.hit > 0 ? 0.5 : 0);
    } else bm.visible = false;
  },
  renderProj() {
    const g = this.g, c = [0, 0, 0, 0, 0];
    for (const pr of g.P) {
      if (!pr.active) continue;
      const k = pr.kind; if (c[k] >= this.pmMax[k]) continue; const m = this.pm[k], i = c[k]++;
      let y = 0.9, s = 1, ry = Math.atan2(pr.vx, pr.vz), rz = 0;
      if (k === 1) { ry = this.time * 14 + pr.i; } else if (k === 2) { ry = this.time * 16 + pr.i; s = pr.evo ? 1.7 : 1.1; } else if (k === 3) { const u = Math.min(1, pr.age / pr.ml); y = 0.4 + 4 * u * (1 - u) * 3.2; ry = this.time * 8; rz = u * 4; } else if (k === 4 && pr.evo) { s = 1.3; }
      dummy.position.set(pr.x, y, pr.z); dummy.rotation.set(0, ry, rz); dummy.scale.set(s, s, k === 4 && pr.evo ? s * 3 : s); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix);
    }
    for (let k = 0; k < 5; k++) { this.pm[k].count = c[k]; this.pm[k].instanceMatrix.needsUpdate = true; }
    let n = 0; const a = this.puddle.instanceColor.array;
    for (const u of g.U) {
      if (!u.active) continue; const fade = Math.min(1, u.t / 0.6);
      dummy.position.set(u.x, 0.05, u.z); dummy.rotation.set(0, 0, 0); dummy.scale.set(u.r * fade, 1, u.r * fade); dummy.updateMatrix(); this.puddle.setMatrixAt(n, dummy.matrix);
      a[n * 3] = 1; a[n * 3 + 1] = u.evo ? 0.35 : 0.65; a[n * 3 + 2] = u.evo ? 0.3 : 0.2; n++;
    }
    this.puddle.count = n; this.puddle.instanceMatrix.needsUpdate = true; this.puddle.instanceColor.needsUpdate = true;
  },
  renderPickups() {
    const g = this.g, t = this.time; let nb = 0, nd = 0;
    for (const b of g.B) {
      if (!b.active) continue;
      const pop = Math.min(1, b.age * 5), sc = (0.95 + Math.min(b.v, 6) * 0.12) * pop, y = 0.35 + Math.abs(Math.sin(t * 3 + b.i)) * 0.12 + (1 - pop) * 0.6;
      dummy.position.set(b.x, y, b.z); dummy.rotation.set(0, t * 3 + b.i, 0); dummy.scale.set(sc, sc, sc); dummy.updateMatrix();
      if (b.kind === 1) { if (nd < 24) this.donut.setMatrixAt(nd++, dummy.matrix); } else { this.beanM.setMatrixAt(nb, dummy.matrix); dummy.position.set(b.x, 0.05, b.z); dummy.rotation.set(0, 0, 0); dummy.scale.set(sc * 1.1, 1, sc * 1.1); dummy.updateMatrix(); this.beanSh.setMatrixAt(nb++, dummy.matrix); }
    }
    this.beanM.count = this.beanSh.count = nb; this.donut.count = nd; this.beanSh.instanceMatrix.needsUpdate = true; this.beanM.instanceMatrix.needsUpdate = true; this.donut.instanceMatrix.needsUpdate = true;
  },
});
// FIN DE ARCHIVO
