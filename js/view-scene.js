'use strict';
/* HORA PUNTA · view-scene.js: clase View (escena 3D) */

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
}
// FIN DE ARCHIVO
