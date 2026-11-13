'use strict';
/* =====================================================================
   HORA PUNTA · view-hud.js
   HUD del jefe: barra de vida y flecha que apunta a él cuando está fuera de pantalla.
   ===================================================================== */
const _bv = window.THREE ? new THREE.Vector3() : null;
function bossUi(view) {
  const b = game.boss, bar = $('bossBar'), ar = $('bossArrow');
  if (!b || !b.active || b.state !== 0 || game.state === 'title') { bar.hidden = true; ar.hidden = true; return; }
  bar.hidden = false; $('bossFill').style.width = (clamp(b.hp / b.mh, 0, 1) * 100).toFixed(1) + '%';
  if (!view || !_bv) { ar.hidden = true; return; }
  try {
    _bv.set(b.x, 1.5, b.z).project(view.camera);
    let x = _bv.x, y = _bv.y; const behind = _bv.z > 1; if (behind) { x = -x; y = -y; }
    if (!behind && Math.abs(x) < 0.9 && Math.abs(y) < 0.85) { ar.hidden = true; return; }
    const m = Math.max(Math.abs(x) / 0.82, Math.abs(y) / 0.72, 0.0001), W = $('app').clientWidth, H = $('app').clientHeight;
    ar.hidden = false; ar.style.left = ((x / m) * 0.5 + 0.5) * W + 'px'; ar.style.top = (-(y / m) * 0.5 + 0.5) * H + 'px';
    ar.style.transform = 'translate(-50%,-50%) rotate(' + (Math.atan2(-y, x) * 57.2958).toFixed(1) + 'deg)';
  } catch (e) { ar.hidden = true; }
}
// FIN DE ARCHIVO
