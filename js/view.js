'use strict';
/* =====================================================================
   HORA PUNTA · view.js
   RENDERIZADO (THREE) · solo lee el estado de Game, nunca lo modifica.
   InstancedMesh para clientes, proyectiles, granos y sombras.
   Postproceso con EffectComposer: Render → Bloom → viñeta/daño → FXAA.
   ===================================================================== */
const $ = id => document.getElementById(id);
const fmt = n => Math.floor(n).toLocaleString('es-ES');
const lerp = (a, b, t) => a + (b - a) * t;
const dummy = new THREE.Object3D(), _v = new THREE.Vector3();
const ph = (c, o) => new THREE.MeshPhongMaterial(Object.assign({ color: c, flatShading: true, shininess: 6, specular: 0x111111 }, o || {}));
const bas = (c, o) => new THREE.MeshBasicMaterial(Object.assign({ color: c }, o || {}));

/* Fusiona piezas (geometría, color, posición, rotación, escala) en una sola geometría con colores por vértice */
function part(g, c, x, y, z, r, s) { return { g, c, x: x || 0, y: y || 0, z: z || 0, rx: r ? r[0] : 0, ry: r ? r[1] : 0, rz: r ? r[2] : 0, sx: s ? s[0] : 1, sy: s ? s[1] : 1, sz: s ? s[2] : 1 }; }
function merge(parts) {
  const pos = [], nor = [], col = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
  for (const p of parts) {
    const g = p.g.index ? p.g.toNonIndexed() : p.g.clone();
    e.set(p.rx, p.ry, p.rz); q.setFromEuler(e); m.compose(v.set(p.x, p.y, p.z), q, s.set(p.sx, p.sy, p.sz)); g.applyMatrix4(m); c.set(p.c);
    const a = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < a.count; i++) { pos.push(a.getX(i), a.getY(i), a.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); col.push(c.r, c.g, c.b); }
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  out.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nor), 3));
  out.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
  return out;
}
const BOX = (w, h, d) => new THREE.BoxGeometry(w, h, d), CYL = (a, b, h, n) => new THREE.CylinderGeometry(a, b, h, n || 8), SPH = (r, n) => new THREE.SphereGeometry(r, n || 10, 8);

/* Modelo de cliente por tipo: cuerpo, brazos estirados (zombi de sueño), cara y complemento propio */
function buildCustomer(type) {
  const skin = 0xf0c9a0, dark = 0x2a1d14, P = [];
  const shirt = [0x4d78b8, 0xffb02e, 0x20e0b0, 0x9a6bf0, 0x24242e][type], pants = [0x2b3a55, 0x3a4a8a, 0x1a1a2a, 0x44444c, 0x14141a][type];
  const sx = type === 2 ? 0.85 : 1;
  P.push(part(CYL(0.32 * sx, 0.38 * sx, 0.8, 8), shirt, 0, 0.6, 0));
  for (const s of [-1, 1]) {
    P.push(part(BOX(0.16, 0.4, 0.18), type === 2 ? skin : pants, s * 0.13, 0.2, 0));                     // piernas
    P.push(part(BOX(0.12, 0.12, 0.52), shirt, s * 0.34 * sx, 0.95, 0.28, [-0.2, 0, 0]));                 // brazos hacia delante
    P.push(part(SPH(0.07, 6), skin, s * 0.34 * sx, 0.9, 0.56));
    P.push(part(BOX(0.09, 0.03, 0.04), dark, s * 0.1, 1.31, 0.25));                                       // ojos medio cerrados
  }
  P.push(part(SPH(0.27), skin, 0, 1.27, 0));
  P.push(part(BOX(0.12, 0.09, 0.04), 0x5a2a20, 0, 1.17, 0.25));                                          // boca abierta pidiendo café
  if (type === 0) {
    P.push(part(BOX(0.07, 0.4, 0.03), 0xd9332f, 0, 0.72, 0.33));                                         // corbata
    P.push(part(BOX(0.12, 0.28, 0.4), 0x8a5a2b, 0.5, 0.62, 0.35));                                       // maletín
    P.push(part(SPH(0.28), 0x3a2a20, 0, 1.36, -0.02, null, [1, 0.6, 1]));
  } else if (type === 1) {
    P.push(part(BOX(0.42, 0.5, 0.22), 0xe0453a, 0, 0.72, -0.36));                                        // mochila
    P.push(part(SPH(0.28), 0x6a3a20, 0, 1.35, -0.02, null, [1, 0.6, 1]));
  } else if (type === 2) {
    P.push(part(new THREE.TorusGeometry(0.28, 0.045, 5, 12), 0xff3b8a, 0, 1.38, 0, [Math.PI / 2, 0, 0]));  // cinta
    P.push(part(BOX(0.08, 0.2, 0.05), 0x20e0b0, 0.3, 0.7, -0.3));
  } else if (type === 3) {
    P.push(part(new THREE.ConeGeometry(0.3, 0.34, 8), 0x2a2a33, 0, 1.58, 0));                            // gorro
    for (const s of [-1, 1]) P.push(part(BOX(0.1, 0.04, 0.03), 0x6a4a7a, s * 0.1, 1.24, 0.26));          // ojeras
  } else {
    P.push(part(BOX(0.07, 0.5, 0.03), 0xffcf3d, 0, 0.75, 0.33));                                         // corbata dorada
    P.push(part(BOX(0.16, 0.34, 0.5), 0x5a3a20, 0.58, 0.62, 0.4));
    for (let k = -1; k <= 1; k++) P.push(part(new THREE.ConeGeometry(0.07, 0.18, 4), 0xffcf3d, k * 0.12, 1.65, 0));   // coronita
    P.push(part(SPH(0.28), 0x1c1c22, 0, 1.37, -0.02, null, [1, 0.55, 1]));
  }
  return merge(P);
}
/* Carrito de desayunos con el dueño empujándolo desde atrás (el frente es +z) */
function buildCart() {
  const P = [], cream = 0xfff0d8, brown = 0x6b3f2a, wood = 0x9a6a3a, metal = 0xc9ccd1;
  P.push(part(BOX(1.4, 0.7, 1.7), cream, 0, 0.75, 0)); P.push(part(BOX(1.5, 0.14, 1.8), brown, 0, 0.42, 0)); P.push(part(BOX(1.5, 0.08, 1.8), wood, 0, 1.14, 0));
  for (let k = 0; k < 7; k++) { const x = -0.78 + k * 0.26; P.push(part(BOX(0.25, 0.06, 2.0), k % 2 ? 0xffffff : 0xe0453a, x, 2.05 - Math.abs(x) * 0.12, 0, [0, 0, -x * 0.12])); }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.push(part(CYL(0.035, 0.035, 0.95, 6), metal, sx * 0.72, 1.62, sz * 0.9));
  P.push(part(BOX(1.0, 0.3, 0.05), 0x2f7a4a, 0, 1.75, 0.93));
  P.push(part(BOX(0.5, 0.45, 0.4), 0x2a2a30, -0.35, 1.4, 0.15)); P.push(part(BOX(0.38, 0.06, 0.3), metal, -0.35, 1.66, 0.15));
  P.push(part(CYL(0.09, 0.07, 0.14, 8), 0xffffff, 0.3, 1.25, 0.3)); P.push(part(CYL(0.09, 0.07, 0.14, 8), 0xffffff, 0.5, 1.25, 0.1));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.push(part(CYL(0.28, 0.28, 0.16, 10), 0x1a1a20, sx * 0.78, 0.28, sz * 0.6, [0, 0, Math.PI / 2]));
  P.push(part(BOX(1.2, 0.06, 0.06), metal, 0, 1.0, -1.05)); for (const s of [-1, 1]) P.push(part(BOX(0.05, 0.05, 0.4), metal, s * 0.6, 1.0, -0.88));
  // dueño: delantal, brazos al manillar, gorro de barista y bigote
  P.push(part(CYL(0.3, 0.34, 0.8, 8), 0xf4efe6, 0, 0.75, -1.55)); P.push(part(BOX(0.46, 0.5, 0.05), 0x6b3f2a, 0, 0.78, -1.3));
  for (const s of [-1, 1]) { P.push(part(BOX(0.13, 0.13, 0.55), 0x6b3f2a, s * 0.34, 1.05, -1.3, [0.5, 0, 0])); P.push(part(BOX(0.16, 0.4, 0.18), 0x3a3a48, s * 0.12, 0.2, -1.55)); }
  P.push(part(SPH(0.27), 0xe0a97c, 0, 1.45, -1.55)); P.push(part(CYL(0.22, 0.26, 0.2, 8), 0xffffff, 0, 1.78, -1.55)); P.push(part(BOX(0.22, 0.05, 0.05), 0x2a1d14, 0, 1.38, -1.3));
  for (const s of [-1, 1]) P.push(part(BOX(0.09, 0.03, 0.04), 0x2a1d14, s * 0.1, 1.5, -1.3));
  return merge(P);
}
/* Fachada de un nido con su rótulo (textura generada en un canvas) */
function facadeTex(n, w, h) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 384; const c = cv.getContext('2d');
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, 512, 384);
  const cols = 5, rows = 3;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    c.fillStyle = Math.random() < 0.6 ? '#ffe9a0' : '#5a6a85'; c.fillRect(34 + i * 94, 130 + j * 70, 60, 46);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(34 + i * 94, 130 + j * 70 + 21, 60, 4);
  }
  c.fillStyle = '#3a241a'; c.fillRect(0, 12, 512, 84);
  c.fillStyle = '#fff3dc'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '700 54px Lilita One, Arial Black, sans-serif';
  c.fillText(n.icon + ' ' + n.name, 256, 56);
  c.fillStyle = '#7a4a2a'; c.fillRect(216, 300, 80, 84);
  return new THREE.CanvasTexture(cv);
}

class View {
  constructor(canvas, game) {
    this.g = game; this.canvas = canvas; this.time = 0; this.shake = 0; this.hurtF = 0; this.flash = 0; this.nestPulse = NESTS.map(() => 0);
    this.hasFX = !!(THREE.EffectComposer && THREE.RenderPass && THREE.ShaderPass && THREE.UnrealBloomPass && THREE.FXAAShader && THREE.CopyShader);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.hasFX, powerPreference: 'high-performance' });
    this.pr = Math.min(window.devicePixelRatio || 1, 1.75); this.prMin = 0.6;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0xffd9b0); this.scene.fog = new THREE.Fog(0xffd9b0, 70, 170);
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.5, 300); this.camPos = new THREE.Vector3(0, 24, 24); this.camInit = false;
    this.buildLights(); this.buildWorld(); this.buildNests(); this.buildPlayer(); this.buildCrowd(); this.buildProj(); this.buildPickups(); this.buildFX(); this.buildPost();
    this.numI = 0; this.numEls = []; for (let i = 0; i < 24; i++) { const d = document.createElement('div'); d.className = 'dn'; $('nums').appendChild(d); this.numEls.push(d); }
    this.fpsAcc = 0; this.fpsN = 0; this.resize();
  }
  buildLights() {
    this.hemi = new THREE.HemisphereLight(0xfff0dc, 0x5a6a48, 0.85); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffe2b8, 1.0); this.sun.position.set(-20, 40, 15); this.scene.add(this.sun);
  }
  buildWorld() {
    const A2 = CFG.ARENA + 3, cv = document.createElement('canvas'); cv.width = cv.height = 256; const c = cv.getContext('2d');
    c.fillStyle = '#3d3a42'; c.fillRect(0, 0, 256, 256);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const v = 78 + ((i * 7 + j * 13) % 5) * 5; c.fillStyle = 'rgb(' + v + ',' + (v - 2) + ',' + (v + 8) + ')'; c.fillRect(i * 64 + 2, j * 64 + 2, 60, 60); }
    const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(A2 * 2 / 8, A2 * 2 / 8); tex.anisotropy = 4;
    const plaza = new THREE.Mesh(new THREE.PlaneGeometry(A2 * 2, A2 * 2), new THREE.MeshPhongMaterial({ map: tex, shininess: 3, specular: 0x111111 })); plaza.rotation.x = -Math.PI / 2; this.scene.add(plaza);
    const out = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), ph(0x6f9a5a, { flatShading: false })); out.rotation.x = -Math.PI / 2; out.position.y = -0.06; this.scene.add(out);
    const curb = ph(0xb9a98f);
    for (const [x, z, w, d] of [[0, -A2, A2 * 2, 0.7], [0, A2, A2 * 2, 0.7], [-A2, 0, 0.7, A2 * 2], [A2, 0, 0.7, A2 * 2]]) { const m = new THREE.Mesh(BOX(w, 0.35, d), curb); m.position.set(x, 0.17, z); this.scene.add(m); }
    // árboles, maceteros y fuente (las posiciones salen de OBST, así coinciden con las colisiones)
    const trees = OBST.filter(o => o.t === 'tree'), planters = OBST.filter(o => o.t === 'planter');
    const trunk = new THREE.InstancedMesh(CYL(0.16, 0.24, 1.6, 6), ph(0x6a4630), trees.length), can = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.25, 0), ph(0x3f8a45), trees.length);
    trees.forEach((o, i) => { dummy.position.set(o.x, 0.8, o.z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); trunk.setMatrixAt(i, dummy.matrix); dummy.position.set(o.x, 2.4, o.z); dummy.scale.set(1, 1.1, 1); dummy.rotation.set(0, i, 0); dummy.updateMatrix(); can.setMatrixAt(i, dummy.matrix); });
    this.scene.add(trunk, can);
    for (const o of planters) { const b = new THREE.Mesh(BOX(2.6, 0.9, 2.6), ph(0xa8704a)); b.position.set(o.x, 0.45, o.z); const g = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 0), ph(0x4aa050)); g.position.set(o.x, 1.4, o.z); g.scale.set(1, 0.7, 1); this.scene.add(b, g); }
    const fo = OBST[0], basin = new THREE.Mesh(CYL(3.2, 3.4, 0.7, 20), ph(0xcfc6b4)); basin.position.set(fo.x, 0.35, fo.z); this.scene.add(basin);
    const water = new THREE.Mesh(new THREE.CircleGeometry(2.8, 20), bas(0x6ac8ff)); water.rotation.x = -Math.PI / 2; water.position.set(fo.x, 0.62, fo.z); this.scene.add(water); this.water = water;
    const col = new THREE.Mesh(CYL(0.25, 0.4, 2, 8), ph(0xcfc6b4)); col.position.set(fo.x, 1.3, fo.z); this.scene.add(col);
    // farolas con bombilla brillante (bloom)
    const lp = [], N = 10; for (let i = 0; i < N; i++) { const a = i / N * 6.283 + 0.3; lp.push([Math.cos(a) * 31, Math.sin(a) * 31]); }
    const pole = new THREE.InstancedMesh(CYL(0.07, 0.09, 4.2, 6), ph(0x2a2a30), N), bulb = new THREE.InstancedMesh(SPH(0.28, 8), bas(0xfff0b0), N);
    lp.forEach((p, i) => { dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.position.set(p[0], 2.1, p[1]); dummy.updateMatrix(); pole.setMatrixAt(i, dummy.matrix); dummy.position.set(p[0], 4.3, p[1]); dummy.updateMatrix(); bulb.setMatrixAt(i, dummy.matrix); });
    this.scene.add(pole, bulb);
  }
  buildNests() {
    this.nests = NESTS.map(n => {
      const grp = new THREE.Group(); grp.position.set(n.x, 0, n.z); grp.rotation.y = Math.atan2(-n.x, -n.z);
      const mf = new THREE.MeshPhongMaterial({ map: facadeTex(n, n.w, n.h), flatShading: true, shininess: 3, color: 0x555555 }), mo = ph(n.col);
      const b = new THREE.Mesh(BOX(n.w, n.h, n.d), [mo, mo, mo, mo, mf, mo]); b.position.y = n.h / 2; grp.add(b);
      const roof = new THREE.Mesh(BOX(n.w + 0.8, 0.6, n.d + 0.8), ph(0x5a3a2a)); roof.position.y = n.h + 0.3; grp.add(roof);
      const door = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.2), bas(0x6a4a30)); door.position.set(0, 1.6, n.d / 2 + 0.06); grp.add(door);
      this.scene.add(grp); return { grp, mf, door };
    });
  }
  buildPlayer() {
    this.player = new THREE.Group(); this.playerMat = ph(0xffffff, { vertexColors: true });
    this.cart = new THREE.Mesh(buildCart(), this.playerMat); this.player.add(this.cart); this.scene.add(this.player);
    this.aura = new THREE.Group(); const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 36), bas(0xc9782f, { transparent: true, opacity: 0.22, depthWrite: false })), ring = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 40), bas(0xffb066, { transparent: true, opacity: 0.8, depthWrite: false }));
    disc.rotation.x = ring.rotation.x = -Math.PI / 2; disc.position.y = 0.05; ring.position.y = 0.06; this.aura.add(disc, ring); this.aura.visible = false; this.scene.add(this.aura); this.auraRing = ring;
  }
  buildCrowd() {
    const N = CFG.CAP_E; this.cm = [];
    for (let t = 0; t < 4; t++) {
      const m = new THREE.InstancedMesh(buildCustomer(t), ph(0xffffff, { vertexColors: true }), N); m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.setColorAt(0, new THREE.Color(1, 1, 1)); m.instanceColor.setUsage(THREE.DynamicDrawUsage); this.scene.add(m); this.cm.push(m);
    }
    this.bossMesh = new THREE.Mesh(buildCustomer(4), ph(0xffffff, { vertexColors: true })); this.bossMesh.visible = false; this.scene.add(this.bossMesh);
    this.shadow = new THREE.InstancedMesh(new THREE.CircleGeometry(0.5, 10).rotateX(-Math.PI / 2), bas(0x000000, { transparent: true, opacity: 0.28, depthWrite: false }), N + 8);
    this.shadow.frustumCulled = false; this.shadow.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.scene.add(this.shadow);
  }
  buildProj() {
    const mk = (g, m, n) => { const x = new THREE.InstancedMesh(g, m, n); x.frustumCulled = false; x.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.scene.add(x); return x; };
    const cro = new THREE.TorusGeometry(0.3, 0.11, 5, 10, Math.PI * 1.25).rotateX(Math.PI / 2);
    this.pm = [
      mk(new THREE.SphereGeometry(0.16, 6, 5).scale(1, 1, 2.2), bas(0xfff0d0), 220),   // chorro de espresso (brilla)
      mk(cro, ph(0xe0a040), 48),
      mk(new THREE.BoxGeometry(0.62, 0.13, 0.62), ph(0xd9a05b), 32),
      mk(new THREE.CylinderGeometry(0.16, 0.2, 0.55, 8), ph(0xff9a1f), 16),
      mk(new THREE.SphereGeometry(0.14, 6, 5).scale(1, 1, 1), bas(0x8a5a38), 200)
    ];
    this.pmMax = [220, 48, 32, 16, 200];
    this.puddle = mk(new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), bas(0xffffff, { transparent: true, opacity: 0.45, depthWrite: false }), CFG.CAP_U);
    this.puddle.setColorAt(0, new THREE.Color(1, 1, 1));
  }
  buildPickups() {
    const N = CFG.CAP_B;
    this.beanM = new THREE.InstancedMesh(new THREE.SphereGeometry(0.26, 8, 6).scale(0.8, 0.6, 1.15), bas(0xffd633), N);
    this.beanSh = new THREE.InstancedMesh(new THREE.CircleGeometry(0.5, 10).rotateX(-Math.PI / 2), bas(0x000000, { transparent: true, opacity: 0.5, depthWrite: false }), N);
    this.donut = new THREE.InstancedMesh(new THREE.TorusGeometry(0.24, 0.11, 6, 10).rotateX(Math.PI / 2), ph(0xff8fb0), 24);
    for (const m of [this.beanSh, this.beanM, this.donut]) { m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.scene.add(m); }
  }
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
  }
  emitP(x, y, z, vx, vy, vz, col, life, grav) {
    const i = this.pi; this.pi = (this.pi + 1) % this.NP;
    this.pp[i * 3] = x; this.pp[i * 3 + 1] = y; this.pp[i * 3 + 2] = z; this.pv[i * 3] = vx; this.pv[i * 3 + 1] = vy; this.pv[i * 3 + 2] = vz;
    this.pcol[i * 3] = col[0]; this.pcol[i * 3 + 1] = col[1]; this.pcol[i * 3 + 2] = col[2]; this.pl[i] = this.pl0[i] = life; this.pg[i] = grav === undefined ? 9 : grav;
  }
  burst(x, y, z, n, spd, col, life, up, grav) { for (let i = 0; i < n; i++) this.emitP(x, y, z, (Math.random() - 0.5) * spd, Math.random() * spd * (up || 0.6), (Math.random() - 0.5) * spd, col, life * (0.6 + Math.random() * 0.6), grav); }
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
  }
  ring(x, z, r, col, d) { const m = this.rings[this.ringI++ % this.rings.length]; m.visible = true; m.position.set(x, 0.1, z); m.material.color.setHex(col); m.userData.t = 0; m.userData.d = d || 0.6; m.userData.r = r; }
  /* Número de daño flotante (elementos DOM reutilizados en pool) */
  num(x, z, txt, crit) {
    _v.set(x, 1.8, z).project(this.camera); if (_v.z > 1) return;
    const el = this.numEls[this.numI++ % this.numEls.length];
    el.textC
