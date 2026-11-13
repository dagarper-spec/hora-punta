'use strict';
/* =====================================================================
   HORA PUNTA · days.js
   Los 5 días de la semana: duración, dureza, jefe y nidos disponibles.
   ===================================================================== */
/* dur = segundos del turno; nests = cuántos nidos hay abiertos ese día; rate/ramp = goteo de clientes;
   hp/dmg = multiplicadores de dureza; bossAt = segundo en que llega el jefe; boss = vida del jefe */
const DAYS = [
  { name: 'Lunes',     rew: 'Canela · Cafeína Extra · Imán Dorado',   sub: 'Prueba de iniciación', dur: 180, nests: 3, rate: 1.0, ramp: 0.030, hp: 0.9, dmg: 0.90, waveN: 8,  waveMax: 24, bossAt: 100, boss: 1100, extra: null, xr: 0 },
  { name: 'Martes',    rew: 'Tostada · Barista Veloz · Café Premium', sub: 'Llegan los repartidores', dur: 180, nests: 4, rate: 1.2, ramp: 0.035, hp: 1.1, dmg: 1.00, waveN: 10, waveMax: 30, bossAt: 100, boss: 1600, extra: [[7, 1]], xr: 0.10 },
  { name: 'Miércoles', rew: 'Zumo · Aroma Intenso · Tienda nivel 4',  sub: 'Ejecutivos con escudo', dur: 180, nests: 5, rate: 1.4, ramp: 0.040, hp: 1.3, dmg: 1.10, waveN: 11, waveMax: 34, bossAt: 100, boss: 2200, extra: [[7, 1], [5, 1.3]], xr: 0.16 },
  { name: 'Jueves',    rew: 'Cola Cao · Tienda nivel 5',              sub: 'VIP y turistas', dur: 180, nests: 6, rate: 1.6, ramp: 0.045, hp: 1.5, dmg: 1.25, waveN: 12, waveMax: 38, bossAt: 95,  boss: 3000, extra: [[5, 1], [6, 0.5], [7, 1], [8, 1]], xr: 0.22 },
  { name: 'Viernes',   rew: 'Carrito nuevo · Plaza nueva',            sub: 'Gran final y marea', dur: 180, nests: 6, rate: 1.8, ramp: 0.050, hp: 1.7, dmg: 1.40, waveN: 14, waveMax: 40, bossAt: 90,  boss: 4000, extra: [[5, 1], [6, 0.5], [7, 1], [8, 1]], xr: 0.28, tide: 45 }
];
const clockStr = (t, dur) => { const m = 420 + Math.floor(120 * Math.min(1, t / dur)); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };   // 07:00 → 09:00
const mmss = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
/* Desbloqueos: número del día (0 = Lunes) cuya victoria abre cada cosa; -1 = disponible desde el inicio */
const UNLOCK = {
  weap: { espresso: -1, croissant: -1, canela: 0, tostada: 1, zumo: 2, colacao: 3 },
  pas:  { speed: -1, magnet: -1, hp: -1, dmg: 0, cd: 1, area: 2 },
  meta: { hp: -1, speed: -1, magnet: 0, dmg: 1 },
  cart: { clasico: -1, churros: 4 },
  map: { plaza: -1, estacion: 4 }
};
const isOpen = (kind, id, won) => { const d = UNLOCK[kind][id]; return d < 0 || !!(won && won[d]); };
const lockHint = (kind, id) => 'Supera el ' + DAYS[UNLOCK[kind][id]].name;
const metaMax = won => won && won[3] ? 5 : won && won[2] ? 4 : 3;      // nivel máximo de mejoras de la tienda
// FIN DE ARCHIVO
