'use strict';
/* =====================================================================
   HORA PUNTA · carts.js
   Carritos jugables: bonus de vida, velocidad e imán, y arma inicial propia.
   ===================================================================== */
const CARTS = {
  clasico: { n: 'Carrito Clásico',        i: '🛒', d: 'El de siempre: sin bonus.',                                  hp: 0,  spd: 0,    mg: 0,    startW: null },
  churros: { n: 'Churrería Ambulante',    i: '🥨', d: '+25 de vida, +8% velocidad, +10% imán. Empieza con Cola Cao.', hp: 25, spd: 0.08, mg: 0.10, startW: 'colacao' }
};
// FIN DE ARCHIVO
