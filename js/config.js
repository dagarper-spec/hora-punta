'use strict';
/* =====================================================================
   HORA PUNTA · config.js
   Constantes, utilidades y datos del juego (nidos, obstáculos, armas, pasivas).
   Sin lógica ni renderizado. Mundo: x derecha, z hacia el jugador, y arriba.
   ===================================================================== */
const CFG = {
  ARENA: 36, CAP_E: 240, CAP_P: 360, CAP_B: 320, CAP_U: 24,
  DURATION: 300, BOSS_AT: 200, PR: 0.7, BASE_SPEED: 6.2, BASE_HP: 100,
  GN: 48, GO: 48, CELL: 2
};
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));   // suavizado independiente de FPS
const A = CFG.ARENA;

/* Tipos de cliente: hp base, velocidad, radio, daño de contacto, valor de grano, empuje, escala visual */
const ET = [
  { n: 'Oficinista',    hp: 14,   sp: 2.5, r: 0.45, dmg: 5,  bean: 1, kb: 1,    sc: 1 },
  { n: 'Estudiante',    hp: 8,    sp: 3.4, r: 0.38, dmg: 4,  bean: 1, kb: 1.2,  sc: 0.95 },
  { n: 'Corredor',      hp: 6,    sp: 4.8, r: 0.38, dmg: 6,  bean: 1, kb: 1.3,  sc: 0.9 },
  { n: 'Universitario', hp: 34,   sp: 2.0, r: 0.58, dmg: 8, bean: 2, kb: 0.6,  sc: 1.2 },
  { n: 'Jefe',          hp: 1600, sp: 2.0, r: 1.7,  dmg: 24, bean: 6, kb: 0.05, sc: 2.3 }
];
/* Nidos: de dónde salen los clientes. 'at' = segundo en que abren; 'mix' = [tipo, peso] */
const NESTS = [
  { id: 'oficinas',    name: 'OFICINAS',     icon: '🏢', x: -A - 8, z: -6,  w: 11, h: 11, d: 9,  at: 0,   col: 0xb7c4d6, mix: [[0, 1]], bell: '¡Entran las oficinas!' },
  { id: 'colegio',     name: 'COLEGIO',      icon: '🏫', x: -14,    z: -A - 8, w: 12, h: 8, d: 9, at: 0,   col: 0xe6a08a, mix: [[1, 1]], bell: '¡Suena el timbre del colegio!' },
  { id: 'parque',      name: 'PARQUE',       icon: '🏃', x: 12,     z: A + 8,  w: 12, h: 6, d: 8, at: 35,  col: 0x9cc79a, mix: [[2, 1]], bell: '¡Llegan los corredores!' },
  { id: 'instituto',   name: 'INSTITUTO',    icon: '🎒', x: 16,     z: -A - 8, w: 12, h: 9, d: 9, at: 75,  col: 0xe8c26f, mix: [[1, 0.6], [2, 0.4]], bell: '¡Salen los del instituto!' },
  { id: 'universidad', name: 'UNIVERSIDAD',  icon: '🎓', x: A + 9,  z: 8,      w: 11, h: 10, d: 10, at: 125, col: 0xb59bd6, mix: [[3, 1]], bell: '¡Madrugón universitario!' },
  { id: 'metro',       name: 'METRO',        icon: '🚇', x: A + 9,  z: -20,    w: 10, h: 7, d: 9, at: 185, col: 0x8fb4c9, mix: [[0, 0.3], [1, 0.3], [2, 0.2], [3, 0.2]], bell: '¡Llega el metro lleno!' }
];
NESTS.forEach(n => { n.sx = clamp(n.x, -A + 1.5, A - 1.5); n.sz = clamp(n.z, -A + 1.5, A - 1.5); });

/* Obstáculos circulares: fuente, maceteros y árboles (generados con semilla fija) */
const OBST = [{ x: 0, z: 0, r: 3.4, t: 'fountain' }];
[[-16, -14], [16, -14], [-16, 14], [16, 14]].forEach(p => OBST.push({ x: p[0], z: p[1], r: 1.5, t: 'planter' }));
{
  let s = 7; const rn = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let tries = 0; OBST.length < 21 && tries < 500; tries++) {
    const a = rn() * 6.283, d = 8 + rn() * 26, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.abs(x) > A - 3 || Math.abs(z) > A - 3) continue;
    if (Math.hypot(x, z - 8) < 5) continue;
    if (OBST.some(o => Math.hypot(o.x - x, o.z - z) < o.r + 4)) continue;
    OBST.push({ x, z, r: 0.55, t: 'tree' });
  }
}

/* Armas: stats por nivel (arrays de 5), mejoras (up[lv-2]) y promoción (evo) que exige otra arma */
const WEAP = {
  espresso: { n: 'Cafetera Espresso', i: '☕', d: 'Chorros de café a presión contra el cliente más cercano.',
    up: ['Más cadencia y daño', '+1 chorro', 'Más cadencia y daño', 'Ráfaga triple'],
    evo: { n: 'Cortado Flambeado', i: '🔥', need: 'canela', d: 'Chorros que atraviesan y queman a los clientes.' } },
  croissant: { n: 'Lanzador de Croissants', i: '🥐', d: 'Medias lunas que rebotan de cliente en cliente.',
    up: ['Más daño y rebotes', '+1 croissant', 'Más rebotes', 'Lluvia de croissants'],
    evo: { n: 'Napolitana Bomba', i: '💥', need: 'tostada', d: 'Los croissants explotan en cada rebote.' } },
  canela: { n: 'Aura de Canela', i: '🌀', d: 'Aroma humeante que daña a quien se acerca demasiado.',
    up: ['Más radio', 'Más daño', 'Más radio', 'Aroma abrasador'],
    evo: { n: 'Canela y Naranja', i: '🍊', need: 'zumo', d: 'Aura enorme que además ralentiza.' } },
  tostada: { n: 'Tostadas Voladoras', i: '🍞', d: 'Bumeranes que atraviesan a todos y vuelven a ti.',
    up: ['Más daño', '+1 tostada', 'Más cadencia', 'Triple bumerán'],
    evo: { n: 'Tostada con Tomate', i: '🍅', need: 'croissant', d: 'Tostadas gigantes y más numerosas.' } },
  zumo: { n: 'Zumo de Naranja', i: '🧃', d: 'Botella que explota y deja un charco que ralentiza.',
    up: ['Más daño y radio', 'Más cadencia', 'Dos botellas', 'Charcos enormes'],
    evo: { n: 'Zumo con Pan y Tomate', i: '🥖', need: 'tostada', d: 'Charcos que duran y queman a los clientes.' } },
  colacao: { n: 'Cola Cao Exprés', i: '🍫', d: 'Perdigones de chocolate en abanico.',
    up: ['+1 perdigón', 'Más daño', '+1 perdigón', 'Tormenta de chocolate'],
    evo: { n: 'Cola Cao con Porra', i: '🥨', need: 'espresso', d: 'Churros perforantes en abanico.' } }
};
const PAS = {
  speed:  { n: 'Zapatillas de Reparto', i: '👟', d: '+10% velocidad de movimiento' },
  magnet: { n: 'Imán de Granos',        i: '🧲', d: '+25% radio de recogida' },
  dmg:    { n: 'Cafeína Extra',         i: '⚡', d: '+15% de daño' },
  cd:     { n: 'Barista Veloz',         i: '⏱️', d: '+12% de cadencia' },
  hp:     { n: 'Delantal Reforzado',    i: '🧵', d: '+20 vida máxima y cura 20' },
  area:   { n: 'Aroma Intenso',         i: '🌫️', d: '+12% de área' }
};
const xpNeed = lv => 4 + 4 * (lv - 1) + Math.floor(0.15 * lv * lv);   // experiencia para subir de nivel
