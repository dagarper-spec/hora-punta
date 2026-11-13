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

/* Modelo de cliente por tipo: cuerpo, brazos a los lados, cara y complemento propio */
function buildCustomer(type) {
  const skin = 0xf0c9a0, dark = 0x2a1d14, P = [];
  const shirt = [0x4d78b8, 0x2b3f7a, 0x20e0b0, 0x9a6bf0, 0x24242e, 0x555b66, 0xc9a227, 0x2fae60, 0xf08a3a][type], pants = [0x2b3a55, 0x5a6070, 0x1a1a2a, 0x44444c, 0x14141a, 0x2a2d36, 0x1c1c22, 0x2a2a35, 0xd8cfa8][type];
  const sx = type === 2 ? 0.85 : 1;
  P.push(part(CYL(0.32 * sx, 0.38 * sx, 0.8, 8), shirt, 0, 0.6, 0));
  for (const s of [-1, 1]) {
    P.push(part(BOX(0.16, 0.4, 0.18), type === 2 ? skin : pants, s * 0.13, 0.2, 0));                     // piernas
    P.push(part(BOX(0.11, 0.46, 0.13), shirt, s * 0.4 * sx, 0.78, 0.02, [0, 0, s * 0.08]));              // brazos caídos a los lados
    P.push(part(SPH(0.07, 6), skin, s * 0.43 * sx, 0.5, 0.02));
    P.push(part(BOX(0.09, 0.03, 0.04), dark, s * 0.1, 1.31, 0.25));                                       // ojos medio cerrados
  }
  P.push(part(SPH(0.27), skin, 0, 1.27, 0));
  P.push(part(BOX(0.12, 0.09, 0.04), 0x5a2a20, 0, 1.17, 0.25));                                          // boca abierta pidiendo café
  if (type === 0) {
    P.push(part(BOX(0.07, 0.4, 0.03), 0xd9332f, 0, 0.72, 0.33));                                         // corbata
    P.push(part(BOX(0.12, 0.28, 0.4), 0x8a5a2b, 0.5, 0.62, 0.35));                                       // maletín
    P.push(part(SPH(0.28), 0x3a2a20, 0, 1.36, -0.02, null, [1, 0.6, 1]));
  } else if (type === 1) {
    P.push(part(BOX(0.42, 0.5, 0.22), 0x2f6fd6, 0, 0.72, -0.36));                                        // mochila azul
    P.push(part(SPH(0.28), 0x6a3a20, 0, 1.35, -0.02, null, [1, 0.6, 1]));
    P.push(part(BOX(0.1, 0.5, 0.03), 0xf2f2f2, 0, 0.78, 0.33));                                          // camisa blanca de uniforme
    P.push(part(BOX(0.06, 0.34, 0.03), 0xb5313a, 0, 0.8, 0.345));                                        // corbata de uniforme
  } else if (type === 2) {
    P.push(part(new THREE.TorusGeometry(0.28, 0.045, 5, 12), 0xff3b8a, 0, 1.38, 0, [Math.PI / 2, 0, 0]));  // cinta
    P.push(part(BOX(0.08, 0.2, 0.05), 0x20e0b0, 0.3, 0.7, -0.3));
  } else if (type === 3) {
    P.push(part(new THREE.ConeGeometry(0.3, 0.34, 8), 0x2a2a33, 0, 1.58, 0));                            // gorro
    for (const s of [-1, 1]) P.push(part(BOX(0.1, 0.04, 0.03), 0x6a4a7a, s * 0.1, 1.24, 0.26));          // ojeras
  } else if (type === 5) {                                                                               // ejecutivo con escudo
    P.push(part(BOX(0.07, 0.4, 0.03), 0x9a1f2a, 0, 0.72, 0.33)); P.push(part(SPH(0.28), 0x2a2a30, 0, 1.36, -0.02, null, [1, 0.6, 1]));
    P.push(part(BOX(0.78, 0.86, 0.07), 0x8fa8c4, 0, 0.8, 0.5)); P.push(part(BOX(0.6, 0.68, 0.04), 0xc9dcef, 0, 0.8, 0.54));
  } else if (type === 6) {                                                                               // cliente VIP
    P.push(part(CYL(0.2, 0.22, 0.34, 8), 0x1c1c22, 0, 1.62, 0)); P.push(part(CYL(0.3, 0.3, 0.05, 8), 0x1c1c22, 0, 1.46, 0)); P.push(part(CYL(0.22, 0.22, 0.07, 8), 0xffcf3d, 0, 1.52, 0));
    for (const s of [-1, 1]) P.push(part(BOX(0.12, 0.06, 0.03), 0x111111, s * 0.1, 1.31, 0.27));        // gafas oscuras
    P.push(part(BOX(0.08, 0.42, 0.03), 0xffffff, 0, 0.78, 0.33));
  } else if (type === 7) {                                                                               // repartidor en patinete
    P.push(part(BOX(0.3, 0.06, 1.0), 0x9aa0a8, 0, 0.1, 0.1)); P.push(part(BOX(0.04, 0.8, 0.04), 0x9aa0a8, 0, 0.5, 0.58));
    P.push(part(BOX(0.46, 0.46, 0.4), 0xff8a3d, 0, 0.8, -0.36)); P.push(part(SPH(0.29), 0xff8a3d, 0, 1.4, -0.02, null, [1, 0.55, 1]));
  } else if (type === 8) {                                                                               // turista con maleta
    P.push(part(CYL(0.52, 0.52, 0.05, 10), 0xe8d28a, 0, 1.5, 0)); P.push(part(CYL(0.24, 0.26, 0.2, 8), 0xe8d28a, 0, 1.58, 0));
    P.push(part(BOX(0.34, 0.56, 0.24), 0xc2372f, 0.55, 0.42, 0.1)); P.push(part(BOX(0.04, 0.3, 0.04), 0x333333, 0.55, 0.85, 0.1));
    P.push(part(BOX(0.2, 0.12, 0.05), 0x222222, 0, 0.9, 0.35));                                          // cámara de fotos
  } else {
    P.push(part(BOX(0.07, 0.5, 0.03), 0xffcf3d, 0, 0.75, 0.33));                                         // corbata dorada
    P.push(part(BOX(0.16, 0.34, 0.5), 0x5a3a20, 0.58, 0.62, 0.4));
    for (let k = -1; k <= 1; k++) P.push(part(new THREE.ConeGeometry(0.07, 0.18, 4), 0xffcf3d, k * 0.12, 1.65, 0));   // coronita
    P.push(part(SPH(0.28), 0x1c1c22, 0, 1.37, -0.02, null, [1, 0.55, 1]));
  }
  return merge(P);
}
/* Carrito de desayunos con el dueño empujándolo desde atrás (el frente es +z) */
function buildCart(v) {
  const P = [], cream = v === 'churros' ? 0xf3a93b : 0xe9d5b3, brown = 0x6b3f2a, wood = 0x9a6a3a, metal = 0xc9ccd1;
  P.push(part(BOX(1.4, 0.7, 1.7), cream, 0, 0.75, 0)); P.push(part(BOX(1.5, 0.14, 1.8), brown, 0, 0.42, 0)); P.push(part(BOX(1.5, 0.08, 1.8), wood, 0, 1.14, 0));
  for (let k = 0; k < 7; k++) { const x = -0.78 + k * 0.26; P.push(part(BOX(0.25, 0.06, 2.0), k % 2 ? (v === 'churros' ? 0xfff2c0 : 0xffffff) : (v === 'churros' ? 0x7a3b1c : 0xe0453a), x, 2.05 - Math.abs(x) * 0.12, 0, [0, 0, -x * 0.12])); }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.push(part(CYL(0.035, 0.035, 0.95, 6), metal, sx * 0.72, 1.62, sz * 0.9));
  P.push(part(BOX(1.0, 0.3, 0.05), v === 'churros' ? 0xb83a2a : 0x2f7a4a, 0, 1.75, 0.93));
  if (v === 'churros') {                                                                                 // freidora, chimenea y churros
    P.push(part(CYL(0.09, 0.11, 0.9, 8), 0x4a4a52, 0.55, 1.75, -0.5)); P.push(part(BOX(0.7, 0.14, 0.5), 0x2a2a30, 0.2, 1.26, -0.2));
    for (let k = 0; k < 5; k++) P.push(part(CYL(0.035, 0.035, 0.5, 6), 0xd9a05b, -0.45 + k * 0.1, 1.3, 0.45, [Math.PI / 2, 0, 0.15 * (k - 2)]));
    P.push(part(BOX(0.12, 0.5, 0.05), 0xffd23d, -0.65, 1.55, 0.95));
  }
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

// FIN DE ARCHIVO
