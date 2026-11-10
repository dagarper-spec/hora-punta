'use strict';
/* HORA PUNTA · view-fx.js: partículas, postproceso y resolución (se añade a la clase View) */
Object.assign(View.prototype, {
  /* partículas en pool circular + anillos de onda */
  buildFX() {
    this.NP = 420; this.pp = new Float32Array(this.NP * 3); this.pc = new Float32Array(this.NP * 3); this.pv = new Float32Array(this.NP * 3); this.pl = new Float32Array(this.NP); this.pl0 = new Float32Array(this.NP); this.pcol = new Float32Array(this.NP * 3); this.pg = new Float32Array(this.NP); this.pi = 0;
    for (let i = 0; i < this.NP; i++) this.pp[i * 3 + 1] = -500;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pp, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.pc, 3));
    const cv = document.createElement('canvas'); cv.width = cv.height = 32; const cx = cv.getContext('2d'), gr = cx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, '#fff'); gr.addColorStop(0.5, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); cx.fillStyle = gr; cx.fillRect(0, 0, 32, 32);
    this.parts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.55, map: new THREE.CanvasTexture(cv), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.parts.frustumCulled = false; this.scene.add(this.parts);
    this.rings = []; for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 32).rotateX(-Math.PI / 2), bas(0xffffff, { transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); m.visible = false; m.userData = { t: 0, d: 0.6, r: 1 }; this.scene.add(m); this.rings.push(m); }
    this.ringI = 0;
  },
  emitP(x, y, z, vx, vy, vz, col, life, grav) {
    const i = this.pi; this.pi = (this.pi + 1) % this.NP;
    this.pp[i * 3] = x; this.pp[i * 3 + 1] = y; this.pp[i * 3 + 2] = z; this.pv[i * 3] = vx; this.pv[i * 3 + 1] = vy; this.pv[i * 3 + 2] = vz;
    this.pcol[i * 3] = col[0]; this.pcol[i * 3 + 1] = col[1]; this.pcol[i * 3 + 2] = col[2]; this.pl[i] = this.pl0[i] = life; this.pg[i] = grav === undefined ? 9 : grav;
  },
  burst(x, y, z, n, spd, col, life, up, grav) { for (let i = 0; i < n; i++) this.emitP(x, y, z, (Math.random() - 0.5) * spd, Math.random() * spd * (up || 0.6), (Math.random() - 0.5) * spd, col, life * (0.6 + Math.random() * 0.6), grav); },
  updateFX(dt) {
    for (let i = 0; i < this.NP; i++) {
      if (this.pl[i] > 0) {
        this.pl[i] -= dt; const f = Math.max(this.pl[i] / this.pl0[i], 0);
        this.pv[i * 3 + 1] -= this.pg[i] * dt; this.pp[i * 3] += this.pv[i * 3] * dt; this.pp[i * 3 + 1] += this.pv[i * 3 + 1] * dt; this.pp[i * 3 + 2] += this.pv[i * 3 + 2] * dt;
        this.pc[i * 3] = this.pcol[i * 3] * f; this.pc[i * 3 + 1] = this.pcol[i * 3 + 1] * f; this.pc[i * 3 + 2] = this.pcol[i * 3 + 2] * f;
      } else this.pp[i * 3 + 1] = -500;
    }
    this.parts.geometry.attributes.position.needsUpdate = true; this.parts.geometry.attributes.color.needsUpdate = true;
    for (const m of this.rings) { if (!m.visible) continue; const u = m.userData; u.t += dt; const k = u.t / u.d; if (k >= 1) { m.visible = false; continue; } m.scale.setScalar(u.r * (0.2 + 0.8 * k)); m.material.opacity = 1 - k; }
  },
  ring(x, z, r, col, d) { const m = this.rings[this.ringI++ % this.rings.length]; m.visible = true; m.position.set(x, 0.1, z); m.material.color.setHex(col); m.userData.t = 0; m.userData.d = d || 0.6; m.userData.r = r; },
  /* Número de daño flotante (elementos DOM reutilizados en pool) */
  num(x, z, txt, crit) {
    _v.set(x, 1.8, z).project(this.camera); if (_v.z > 1) return;
    const el = this.numEls[this.numI++ % this.numEls.length];
    el.textContent = txt; el.className = 'dn' + (crit ? ' crit' : ''); el.style.setProperty('--x', ((_v.x * 0.5 + 0.5) * this.w - 10 + (Math.random() - 0.5) * 18).toFixed(0) + 'px'); el.style.setProperty('--y', ((-_v.y * 0.5 + 0.5) * this.h).toFixed(0) + 'px');
    void el.offsetWidth; el.classList.add('go');
  },
  /* Efectos visuales disparados por los eventos de la lógica */
  onEvent(e) {
    const g = this.g;
    switch (e.t) {
      case 'hit': this.burst(e.x, 1, e.z, e.crit ? 8 : 4, 4, e.crit ? [1, 0.85, 0.3] : [0.85, 0.6, 0.35], 0.35, 1); if (!e.quiet) this.num(e.x, e.z, Math.round(e.dmg), e.crit); break;
      case 'serve': this.burst(e.x, 1.4, e.z, 7, 3, [1, 0.5, 0.7], 0.8, 1.4, -2); break;
      case 'explode': this.ring(e.x, e.z, e.r, 0xffb066, 0.45); this.burst(e.x, 0.6, e.z, 12, 5, [1, 0.7, 0.3], 0.5, 1); break;
      case 'bean': this.burst(g.p.x, 1.2, g.p.z, 2, 2, [1, 0.85, 0.3], 0.3, 1); break;
      case 'heal': this.ring(g.p.x, g.p.z, 2, 0xff8fb0, 0.6); this.burst(g.p.x, 1, g.p.z, 12, 3, [1, 0.5, 0.7], 0.7, 1.4, -1); break;
      case 'hurt': this.hurtF = 1; this.shake = Math.max(this.shake, 0.5); this.burst(g.p.x, 1.2, g.p.z, 12, 6, [1, 0.3, 0.3], 0.5, 1); break;
      case 'level': this.ring(g.p.x, g.p.z, 6, 0xffcf3d, 0.9); this.flash = 0.5; this.burst(g.p.x, 1, g.p.z, 30, 8, [1, 0.85, 0.3], 0.9, 1.2, 2); break;
      case 'nest': this.nestPulse[e.i] = 1; this.nests[e.i].mf.color.setHex(0xffffff); this.nests[e.i].door.material.color.setHex(0xffe08a); break;
      case 'bossDown': this.flash = 0.8; this.shake = 1; this.burst(e.x, 1.5, e.z, 60, 10, [1, 0.8, 0.3], 1.2, 1.2); this.ring(e.x, e.z, 10, 0xffcf3d, 1.1); break;
      case 'bossCall': this.ring(e.x, e.z, 4, 0xff5a5a, 0.6); break;
      case 'die': this.shake = 1; this.flash = 0.6; break;
      case 'start': this.camInit = false; for (let i = 0; i < NESTS.length; i++) if (NESTS[i].at > 0) { this.nests[i].mf.color.setHex(0x555555); this.nests[i].door.material.color.setHex(0x6a4a30); } else { this.nests[i].mf.color.setHex(0xffffff); this.nests[i].door.material.color.setHex(0xffe08a); } break;
    }
  },

  /* ---------- postproceso: Render → Bloom → viñeta/daño → FXAA ---------- */
  buildPost() {
    if (!this.hasFX) return;
    this.composer = new THREE.EffectComposer(this.renderer); this.composer.addPass(new THREE.RenderPass(this.scene, this.camera));
    this.bloom = new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.5, 0.82); this.composer.addPass(this.bloom);
    this.fxPass = new THREE.ShaderPass({
      uniforms: { tDiffuse: { value: null }, uHurt: { value: 0 }, uFlash: { value: 0 }, uLow: { value: 0 }, uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: ['uniform sampler2D tDiffuse; uniform float uHurt; uniform float uFlash; uniform float uLow; uniform float uTime; varying vec2 vUv;',
        'void main(){ vec2 d = vUv - 0.5; float r2 = dot(d,d); float ca = 0.0015 + uHurt*0.01;',
        '  vec3 col; col.r = texture2D(tDiffuse, 0.5 + d*(1.0-ca*3.0)).r; col.g = texture2D(tDiffuse, vUv).g; col.b = texture2D(tDiffuse, 0.5 + d*(1.0+ca*3.0)).b;',
        '  float vig = smoothstep(0.7, 0.15, r2*1.5); col *= mix(1.0, vig, 0.5);',
        '  col = mix(col, col*vec3(1.3,0.45,0.45), (uHurt + uLow*(0.5+0.5*sin(uTime*6.0)))*smoothstep(0.04,0.3,r2));',
        '  col += vec3(1.0,0.9,0.7)*uFlash; gl_FragColor = vec4(col,1.0); }'].join('\n')
    });
    this.composer.addPass(this.fxPass); this.fxaa = new THREE.ShaderPass(THREE.FXAAShader); this.composer.addPass(this.fxaa);
  },
  resize() {
    const app = this.canvas.parentElement, w = Math.max(1, app.clientWidth), h = Math.max(1, app.clientHeight);
    this.w = w; this.h = h; this.renderer.setPixelRatio(this.pr); this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    if (this.composer) { this.composer.setPixelRatio(this.pr); this.composer.setSize(w, h); this.fxaa.material.uniforms['resolution'].value.set(1 / (w * this.pr), 1 / (h * this.pr)); }
  },
  /* Resolución adaptable: si caen los FPS baja el pixel ratio y, en último extremo, apaga el bloom */
  adapt(dt) {
    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc > 1.2) {
      const avg = this.fpsAcc / this.fpsN; this.fpsAcc = 0; this.fpsN = 0;
      if (avg > 0.026 && this.pr > this.prMin) { this.pr = Math.max(this.prMin, this.pr - 0.2); this.resize(); }
      else if (avg > 0.034 && this.pr <= this.prMin + 0.01 && this.bloom && this.bloom.enabled) this.bloom.enabled = false;
    }
  },
});
// FIN DE ARCHIVO
