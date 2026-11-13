'use strict';
/* =====================================================================
   HORA PUNTA · save.js
   Datos guardados (localStorage), mejoras de tienda y precios.
   ===================================================================== */
const SAVE_KEY = 'horapunta.save.v1';
const save = { best: 0, coins: 0, muted: false, meta: { hp: 0, speed: 0, dmg: 0, magnet: 0 }, owned: { espresso: 1 }, startW: 'espresso', won: [0, 0, 0, 0, 0], cart: 'clasico', map: 'plaza' };
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'); Object.assign(save, s); save.meta = Object.assign({ hp: 0, speed: 0, dmg: 0, magnet: 0 }, s.meta || {}); save.owned = Object.assign({ espresso: 1 }, s.owned || {}); } catch (e) {}
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} };
const META = [
  { k: 'hp', i: '🛒', n: 'Carrito Reforzado', d: '+10 de vida inicial por nivel', cost: [80, 150, 240, 360, 500] },
  { k: 'speed', i: '🛞', n: 'Ruedas Engrasadas', d: '+4% de velocidad por nivel', cost: [80, 150, 240, 360, 500] },
  { k: 'dmg', i: '☕', n: 'Café Premium', d: '+5% de daño por nivel', cost: [100, 180, 280, 400, 560] },
  { k: 'magnet', i: '🧲', n: 'Imán Dorado', d: '+15% radio de recogida por nivel', cost: [60, 110, 180, 270, 380] }
];
const W_COST = { espresso: 0, croissant: 200, canela: 250, tostada: 300, zumo: 350, colacao: 400 };
// FIN DE ARCHIVO
