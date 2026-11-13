'use strict';
/* =====================================================================
   HORA PUNTA · maps.js
   Plazas jugables (datos): nidos, obstáculos y estilo visual. setMap() cambia el mapa activo
   modificando NESTS y OBST en el sitio, así la lógica y la vista no necesitan saber cuál es.
   ===================================================================== */
let MAPID = 'plaza';
const nestFix = n => { n.sx = clamp(n.x, -A + 1.5, A - 1.5); n.sz = clamp(n.z, -A + 1.5, A - 1.5); return n; };
/* Obstáculos: elemento central + maceteros + árboles repartidos con semilla fija */
function genObst(center, planters, seed) {
  const out = [center]; planters.forEach(p => out.push({ x: p[0], z: p[1], r: 1.5, t: 'planter' }));
  let s = seed; const rn = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let tries = 0; out.length < 21 && tries < 500; tries++) {
    const a = rn() * 6.283, d = 8 + rn() * 26, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.abs(x) > A - 3 || Math.abs(z) > A - 3 || Math.hypot(x, z - 8) < 5 || out.some(o => Math.hypot(o.x - x, o.z - z) < o.r + 4)) continue;
    out.push({ x, z, r: 0.55, t: 'tree' });
  }
  return out;
}
const MAPS = {
  plaza: { name: 'Plaza Mayor', theme: { tile0: '#3d3a42', dt: [0, -2, 8], out: 0x6f9a5a, canopy: 0x3f8a45, center: 'fountain' },
    nests: NESTS.map(n => Object.assign({}, n)), obst: OBST.map(o => Object.assign({}, o)) },
  estacion: { name: 'La Estación', theme: { tile0: '#5a4f45', dt: [26, 12, -2], out: 0x8a9078, canopy: 0x5f8f3a, center: 'clock' },
    nests: [
      { id: 'estacion', name: 'ESTACIÓN',   icon: '🚉', x: A + 8, z: -6,  w: 11, h: 11, d: 9,  at: 0,   col: 0xcdbba0, mix: [[0, 1]], bell: '¡Llega el tren de cercanías!' },
      { id: 'buses',    name: 'AUTOBUSES',  icon: '🚌', x: 14,    z: -A - 8, w: 12, h: 8, d: 9, at: 0,   col: 0x8fb0d6, mix: [[1, 1]], bell: '¡Descarga el autobús escolar!' },
      { id: 'bicis',    name: 'BICIS',      icon: '🚲', x: -12,   z: A + 8,  w: 12, h: 6, d: 8, at: 35,  col: 0xa6d49a, mix: [[2, 1]], bell: '¡Pelotón de ciclistas!' },
      { id: 'hotel',    name: 'HOTEL',      icon: '🏨', x: -16,   z: -A - 8, w: 12, h: 9, d: 9, at: 75,  col: 0xe6b48a, mix: [[1, 0.6], [2, 0.4]], bell: '¡Salen los huéspedes!' },
      { id: 'congreso', name: 'CONGRESO',   icon: '🎤', x: -A - 9, z: 8,    w: 11, h: 10, d: 10, at: 125, col: 0xc59bd6, mix: [[3, 1]], bell: '¡Termina el congreso!' },
      { id: 'aeropuerto', name: 'AEROPUERTO', icon: '✈️', x: -A - 9, z: -20, w: 10, h: 7, d: 9, at: 185, col: 0x9ec4d9, mix: [[0, 0.3], [1, 0.3], [2, 0.2], [3, 0.2]], bell: '¡Aterriza un vuelo lleno!' }
    ].map(nestFix),
    obst: genObst({ x: 0, z: 0, r: 2.0, t: 'fountain' }, [[-20, -4], [20, -4], [-20, 22], [20, 22]], 11) }
};
function setMap(id) {
  if (!MAPS[id]) id = 'plaza'; if (id === MAPID && NESTS.length) return; MAPID = id;
  NESTS.length = 0; MAPS[id].nests.forEach(n => NESTS.push(n)); OBST.length = 0; MAPS[id].obst.forEach(o => OBST.push(o));
}
// FIN DE ARCHIVO
