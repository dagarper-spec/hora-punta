'use strict';
/* =====================================================================
   HORA PUNTA · audio.js
   AUDIO sintetizado con WebAudio (sin archivos): efectos con límite de
   frecuencia y música por capas que se intensifica con la acción.
   ===================================================================== */
const SND = (() => {
  let ac = null, master, sfx, mus, noiseBuf, muted = false, intensity = 0.2, step = 0, nextT = 0; const L = {}, last = {};
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12), CH = [[60, 64, 67], [67, 71, 74], [69, 72, 76], [65, 69, 72]], PENT = [72, 74, 76, 79, 81, 84];
  /* Crea el contexto de audio (debe llamarse tras un toque del usuario) */
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.85; const comp = ac.createDynamicsCompressor(); master.connect(comp); comp.connect(ac.destination);
    sfx = ac.createGain(); sfx.gain.value = 0.9; sfx.connect(master); mus = ac.createGain(); mus.gain.value = 0.45; mus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    for (const k of ['pad', 'bass', 'arp', 'drums', 'lead']) { L[k] = ac.createGain(); L[k].gain.value = 0; L[k].connect(mus); }
    nextT = ac.currentTime + 0.1; setInterval(scheduler, 25);
  }
  function tone(f, t, dur, type, vol, dest, o) {
    o = o || {}; const os = ac.createOscillator(), g = ac.createGain(); os.type = type; os.frequency.setValueAtTime(f, t); if (o.to) os.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + (o.a || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); os.connect(g); g.connect(dest || sfx); os.start(t); os.stop(t + dur + 0.05);
  }
  function noise(t, dur, freq, vol, type, to) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf; const f = ac.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.setValueAtTime(freq, t); if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(sfx); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  /* Secuenciador con lookahead: las capas entran según la intensidad (más clientes = música más viva) */
  function scheduler() {
    if (!ac || ac.state !== 'running') { if (ac) nextT = Math.max(nextT, ac.currentTime); return; }
    const sd = 60 / (110 + intensity * 30) / 4;
    while (nextT < ac.currentTime + 0.12) { playStep(step, nextT, sd); step = (step + 1) % 64; nextT += sd; }
    const n = ac.currentTime, g = (k, lo) => L[k].gain.setTargetAtTime(intensity >= lo ? 1 : 0, n, 0.4);
    L.pad.gain.setTargetAtTime(0.9, n, 0.5); g('bass', 0); g('arp', 0.2); g('drums', 0.4); g('lead', 0.75);
  }
  function playStep(s, t, sd) {
    const ch = CH[(s >> 4) & 3], st = s & 15;
    if (st === 0) for (const n of ch) tone(mtof(n), t, sd * 15, 'sine', 0.06, L.pad, { a: 0.3 });
    if (st % 4 === 0 || st === 10) tone(mtof(ch[0] - 24), t, sd * 2.4, 'triangle', 0.22, L.bass);
    if (st % 2 === 0) tone(mtof(ch[(st >> 1) % 3] + 12), t, sd * 1.5, 'triangle', 0.08, L.arp, { a: 0.004 });
    if (st % 4 === 0) tone(120, t, 0.14, 'sine', 0.45, L.drums, { to: 40 });
    if (st === 4 || st === 12) tone(230, t, 0.1, 'triangle', 0.18, L.drums, { to: 130 });
    if (st % 2 === 1) { const nb = ac.createBufferSource(); nb.buffer = noiseBuf; const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7500; const g = ac.createGain(); g.gain.setValueAtTime(0.07, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04); nb.connect(f); f.connect(g); g.connect(L.drums); nb.start(t, Math.random()); nb.stop(t + 0.06); }
    if (st % 2 === 1 && Math.random() < 0.4) tone(mtof(PENT[(Math.random() * 6) | 0]), t, sd * 2, 'square', 0.035, L.lead);
  }
  /* Limita la frecuencia de cada efecto para que no se sature con cientos de golpes */
  const ok = (k, gap) => { if (!ac || muted || ac.state !== 'running') return false; const t = ac.currentTime; if (gap && t - (last[k] || 0) < gap) return false; last[k] = t; return true; };
  return {
    init, get muted() { return muted; }, setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.85, ac.currentTime, 0.05); },
    suspend() { if (ac) ac.suspend(); }, resume() { if (ac) ac.resume(); }, setIntensity(v) { intensity = clamp(v, 0, 1); },
    shoot(k) { if (!ok('s' + k, 0.07)) return; const t = ac.currentTime; if (k === 0) tone(520, t, 0.06, 'square', 0.04, sfx, { to: 300 }); else if (k === 1) tone(400, t, 0.12, 'triangle', 0.08, sfx, { to: 700 }); else if (k === 2) noise(t, 0.2, 900, 0.1, 'bandpass', 2500); else if (k === 3) tone(300, t, 0.2, 'sine', 0.1, sfx, { to: 600 }); else noise(t, 0.08, 1500, 0.07); },
    hit() { if (ok('hit', 0.05)) tone(180, ac.currentTime, 0.05, 'square', 0.04, sfx, { to: 100 }); },
    serve() { if (!ok('srv', 0.06)) return; const t = ac.currentTime, b = 76 + ((Math.random() * 3) | 0) * 2; tone(mtof(b), t, 0.1, 'triangle', 0.07, sfx); tone(mtof(b + 4), t + 0.06, 0.12, 'triangle', 0.07, sfx); },
    bean(c, v) {   // moneda: "ching" que sube por la escala pentatónica con la racha; billete: frufrú + nota grave
      if (!ok('bean', 0.035)) return; const t = ac.currentTime, s = Math.min(c, 7), n = 74 + [0, 2, 4, 7, 9][s % 5] + 12 * Math.floor(s / 5);
      if (v >= 2) { noise(t, 0.14, 2500, 0.1, 'bandpass', 5000); tone(mtof(n - 12), t + 0.02, 0.18, 'triangle', 0.1, sfx); }
      else { tone(mtof(n), t, 0.14, 'triangle', 0.08, sfx); tone(mtof(n + 12), t + 0.045, 0.12, 'sine', 0.05, sfx); }
    },
    explode() { if (ok('exp', 0.1)) { const t = ac.currentTime; noise(t, 0.3, 700, 0.3, 'lowpass', 120); tone(90, t, 0.25, 'sine', 0.3, sfx, { to: 40 }); } },
    hurt() { if (!ok('hurt', 0.1)) return; const t = ac.currentTime; noise(t, 0.2, 500, 0.4, 'lowpass', 120); tone(140, t, 0.2, 'sawtooth', 0.2, sfx, { to: 60 }); },
    level() { if (!ok('lv')) return; const t = ac.currentTime; [0, 4, 7, 12, 16].forEach((n, i) => tone(mtof(72 + n), t + i * 0.07, 0.25, 'triangle', 0.14, sfx)); noise(t + 0.25, 0.6, 6500, 0.04, 'highpass'); },
    pick() { if (ok('pick')) { const t = ac.currentTime; tone(mtof(79), t, 0.12, 'square', 0.08, sfx); tone(mtof(86), t + 0.08, 0.2, 'square', 0.08, sfx); } },
    bell() { if (!ok('bell')) return; const t = ac.currentTime; tone(880, t, 0.6, 'sine', 0.2, sfx); tone(1318, t, 0.5, 'sine', 0.1, sfx); tone(659, t + 0.4, 0.8, 'sine', 0.2, sfx); },
    boss() { if (!ok('boss')) return; const t = ac.currentTime; tone(90, t, 1, 'sawtooth', 0.3, sfx, { to: 40 }); noise(t, 0.9, 600, 0.3, 'lowpass', 100); },
    heal() { if (ok('heal')) { const t = ac.currentTime; [0, 4, 7].forEach((n, i) => tone(mtof(76 + n), t + i * 0.06, 0.2, 'sine', 0.12, sfx)); } },
    win() { if (!ok('win')) return; const t = ac.currentTime; [0, 4, 7, 12, 7, 12, 16].forEach((n, i) => tone(mtof(72 + n), t + i * 0.12, 0.3, 'triangle', 0.16, sfx)); },
    lose() { if (!ok('lose')) return; const t = ac.currentTime; [67, 64, 62, 55].forEach((n, i) => tone(mtof(n), t + i * 0.2, 0.4, 'triangle', 0.16, sfx)); },
    click() { if (ok('clk')) tone(520, ac.currentTime, 0.07, 'square', 0.07, sfx); }
  };
})();

// FIN DE ARCHIVO
