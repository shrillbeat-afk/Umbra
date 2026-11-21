'use strict';
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var KEY = 'umbra.v1';
  var VERSION = '1.1';

  /* ---------- stocare locală ---------- */
  var defaults = { sessions: [], active: null, settings: { vibrate: true, autoMotion: true, autoEmf: true, autoWord: true, voice: true, palette: 0 } };
  var db = load();
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var d = JSON.parse(raw);
        d.settings = Object.assign({}, defaults.settings, d.settings || {});
        d.sessions = d.sessions || [];
        return d;
      }
    } catch (e) { /* ignorat */ }
    return JSON.parse(JSON.stringify(defaults));
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); return true; }
    catch (e) { toast('Memorie plină — șterge sesiuni vechi din Jurnal'); return false; }
  }

  /* ---------- utilitare ---------- */
  var toastTimer;
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtDur(ms) { var s = Math.max(0, Math.floor(ms / 1000)); return pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s % 3600 / 60)) + ':' + pad(s % 60); }
  function fmtDate(ts) { return new Date(ts).toLocaleString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  function fmtTime(ts) { return new Date(ts).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
  function buzz(p) { if (db.settings.vibrate && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) { /* ignorat */ } } }
  function activeSession() { for (var i = 0; i < db.sessions.length; i++) if (db.sessions[i].id === db.active) return db.sessions[i]; return null; }
  function addEvent(type, text, img) {
    var s = activeSession();
    if (!s) { s = startSession('Sesiune rapidă', ''); }
    s.events.push({ t: Date.now(), type: type, text: text, img: img || null });
    var ok = save();
    if (!ok && img) { s.events.pop(); save(); }
    renderPill(); if (cur === 'log') renderLog();
    return ok;
  }
  var TYPE_LABEL = { note: 'Notă', snap: 'Captură', emf: 'EMF', motion: 'Mișcare', word: 'Cutia spiritelor', system: 'Sesiune' };

  /* ---------- navigare + butonul „înapoi” ---------- */
  var cur = 'scanner';
  history.replaceState({ tab: 'scanner' }, '');
  function showTab(name, fromPop) {
    if (!fromPop && name !== cur) {
      if (name === 'scanner' && history.state && history.state.tab && history.state.tab !== 'scanner') { history.back(); return; }
      if (cur === 'scanner') history.pushState({ tab: name }, ''); else history.replaceState({ tab: name }, '');
    }
    cur = name;
    var tabs = document.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('active', tabs[i].id === 'tab-' + name);
    var navs = document.querySelectorAll('.nav-item');
    for (var j = 0; j < navs.length; j++) {
      var on = navs[j].getAttribute('data-tab') === name;
      navs[j].classList.toggle('active', on); navs[j].setAttribute('aria-selected', on ? 'true' : 'false');
    }
    if (name === 'log') renderLog();
    if (name === 'settings') renderSettings();
    window.scrollTo(0, 0);
  }
  window.addEventListener('popstate', function (e) {
    if (sheetOpen) closeSheet(true);
    showTab((e.state && e.state.tab) || 'scanner', true);
  });
  var navBtns = document.querySelectorAll('.nav-item');
  for (var nb = 0; nb < navBtns.length; nb++) navBtns[nb].addEventListener('click', function () { showTab(this.getAttribute('data-tab')); });
  $('sessPill').addEventListener('click', function () { showTab('log'); });

  /* ---------- foaie de jos (înlocuiește alert/confirm) ---------- */
  var sheetOpen = false;
  function openSheet(title, node) {
    $('sheetTitle').textContent = title;
    $('sheetBody').replaceChildren(node);
    $('overlay').classList.add('open');
    if (!sheetOpen) history.pushState({ tab: cur, sheet: 1 }, '');
    sheetOpen = true;
  }
  function closeSheet(fromPop) {
    if (!sheetOpen) return;
    sheetOpen = false;
    $('overlay').classList.remove('open');
    if (!fromPop) history.back();
  }
  $('closeSheet').addEventListener('click', function () { closeSheet(false); });
  $('overlay').addEventListener('click', function (e) { if (e.target === $('overlay')) closeSheet(false); });
  function confirmSheet(title, message, okLabel, onOk) {
    var box = el('div');
    box.appendChild(el('p', 'hint', message));
    var acts = el('div', 'sheet-actions');
    var ok = el('button', 'btn danger', okLabel);
    var no = el('button', 'btn ghost', 'Anulează');
    ok.addEventListener('click', function () { closeSheet(false); setTimeout(onOk, 0); });
    no.addEventListener('click', function () { closeSheet(false); });
    acts.appendChild(ok); acts.appendChild(no); box.appendChild(acts);
    openSheet(title, box);
  }

  /* ---------- introducere ---------- */
  try { if (!localStorage.getItem('umbra.intro')) $('intro').classList.add('open'); } catch (e) { $('intro').classList.add('open'); }
  $('introOk').addEventListener('click', function () {
    try { localStorage.setItem('umbra.intro', '1'); } catch (e) { /* ignorat */ }
    $('intro').classList.remove('open');
  });

  /* ---------- sesiuni ---------- */
  function startSession(name, place) {
    var s = { id: 's' + Date.now(), name: name || ('Investigație #' + (db.sessions.length + 1)), place: place || '', start: Date.now(), end: null, events: [] };
    s.events.push({ t: s.start, type: 'system', text: 'Sesiune începută' + (place ? ' · ' + place : ''), img: null });
    db.sessions.unshift(s); db.active = s.id; save(); renderPill();
    return s;
  }
  function endSession() {
    var s = activeSession(); if (!s) return;
    s.end = Date.now(); s.events.push({ t: s.end, type: 'system', text: 'Sesiune încheiată', img: null });
    db.active = null; save(); renderPill(); renderLog(); updateRec();
    toast('Sesiune salvată în Jurnal');
  }
  function renderPill() {
    var s = activeSession();
    $('sessPill').classList.toggle('on', !!s);
    $('sessText').textContent = s ? 'SESIUNE · ' + fmtDur(Date.now() - s.start) : 'FĂRĂ SESIUNE';
  }
  setInterval(function () {
    renderPill();
    var t = document.getElementById('liveTimer'), s = activeSession();
    if (t && s) t.textContent = fmtDur(Date.now() - s.start);
  }, 1000);

  /* ---------- cameră + efect termic (simulat) ---------- */
  var PALETTES = [
    { name: 'TERMIC', stops: [[0, [10, 5, 40]], [.25, [90, 20, 140]], [.5, [220, 40, 60]], [.75, [255, 170, 30]], [1, [255, 250, 205]]] },
    { name: 'NOAPTE', stops: [[0, [0, 8, 2]], [.5, [20, 130, 50]], [1, [190, 255, 190]]] },
    { name: 'ULTRAVIOLET', stops: [[0, [5, 0, 25]], [.4, [70, 25, 190]], [.75, [170, 95, 255]], [1, [255, 225, 255]]] },
    { name: 'ALB-NEGRU', stops: [[0, [0, 0, 0]], [1, [255, 255, 255]]] }
  ];
  function buildLut(stops) {
    var lut = new Uint8ClampedArray(256 * 3);
    for (var i = 0; i < 256; i++) {
      var p = i / 255, a = stops[0], b = stops[stops.length - 1];
      for (var k = 0; k < stops.length - 1; k++) if (p >= stops[k][0] && p <= stops[k + 1][0]) { a = stops[k]; b = stops[k + 1]; break; }
      var f = b[0] === a[0] ? 0 : (p - a[0]) / (b[0] - a[0]);
      for (var c = 0; c < 3; c++) lut[i * 3 + c] = a[1][c] + (b[1][c] - a[1][c]) * f;
    }
    return lut;
  }
  PALETTES.forEach(function (p) { p.lut = buildLut(p.stops); });
  var palIdx = Math.min(db.settings.palette | 0, PALETTES.length - 1);
  function applyPalette() {
    var p = PALETTES[palIdx];
    $('paletteStrip').style.background = 'linear-gradient(90deg,' + p.stops.map(function (s) { return 'rgb(' + s[1].join(',') + ') ' + Math.round(s[0] * 100) + '%'; }).join(',') + ')';
    $('hudPalette').textContent = p.name + ' · SIM';
  }
  applyPalette();

  var video = $('cameraVideo'), canvas = $('thermalCanvas'), cctx = canvas.getContext('2d', { willReadFrequently: true });
  var work = document.createElement('canvas'), wctx = work.getContext('2d', { willReadFrequently: true });
  var stream = null, rafId = 0, lastFrame = 0, prevLum = null, facing = 'environment', camBusy = false;
  var motionPct = 0, lastMotionLog = 0;

  function updateRec() {
    $('recStatus').textContent = stream ? (activeSession() ? 'REC' : 'LIVE') : 'STANDBY';
  }
  async function startCamera() {
    if (camBusy) return; camBusy = true;
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('nocam');
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      video.srcObject = stream; await video.play();
      $('thermalView').classList.add('active');
      $('scanBtn').textContent = '■  Oprește camera';
      prevLum = null; updateRec(); loop();
    } catch (err) {
      stream = null;
      toast(err && err.name === 'NotAllowedError' ? 'Permisiunea pentru cameră a fost refuzată' : 'Camera nu este disponibilă');
    }
    camBusy = false;
  }
  function stopCamera() {
    cancelAnimationFrame(rafId);
    if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
    stream = null; video.srcObject = null; prevLum = null; motionPct = 0;
    $('thermalView').classList.remove('active'); $('hudMotion').hidden = true;
    $('scanBtn').textContent = '◉  Pornește camera'; $('motionVal').textContent = 'MIȘC · 0%';
    updateRec();
  }
  function loop(ts) {
    rafId = requestAnimationFrame(loop);
    if (!stream || video.readyState < 2) return;
    if (ts && ts - lastFrame < 66) return; lastFrame = ts || 0;
    var W = 200, H = Math.max(2, Math.round(W * (video.videoHeight || 480) / (video.videoWidth || 640)));
    if (work.width !== W || work.height !== H) { work.width = W; work.height = H; canvas.width = W; canvas.height = H; prevLum = null; }
    wctx.drawImage(video, 0, 0, W, H);
    var img = wctx.getImageData(0, 0, W, H), d = img.data, n = W * H, lut = PALETTES[palIdx].lut;
    var lum = new Uint8Array(n), changed = 0, hasPrev = prevLum && prevLum.length === n;
    for (var i = 0, p = 0; i < n; i++, p += 4) {
      var l = (d[p] * 77 + d[p + 1] * 151 + d[p + 2] * 28) >> 8;
      lum[i] = l;
      if (hasPrev) { var df = l - prevLum[i]; if (df > 22 || df < -22) changed++; }
      var q = l * 3; d[p] = lut[q]; d[p + 1] = lut[q + 1]; d[p + 2] = lut[q + 2]; d[p + 3] = 255;
    }
    cctx.putImageData(img, 0, 0);
    prevLum = lum;
    if (hasPrev) {
      motionPct = motionPct * .6 + (changed / n * 100) * .4;
      var m = Math.round(motionPct);
      $('motionVal').textContent = 'MIȘC · ' + m + '%';
      var moving = motionPct > 4; $('hudMotion').hidden = !moving;
      if (moving && db.settings.autoMotion && activeSession() && Date.now() - lastMotionLog > 12000 && motionPct > 7) {
        lastMotionLog = Date.now(); buzz(40);
        addEvent('motion', 'Mișcare în imagine (' + m + '% din cadru). Poate fi o persoană, un animal, vânt sau schimbarea luminii.');
      }
    }
  }
  $('scanBtn').addEventListener('click', function () { stream ? stopCamera() : startCamera(); });
  $('flipBtn').addEventListener('click', function () { facing = facing === 'environment' ? 'user' : 'environment'; if (stream) { stopCamera(); startCamera(); } else toast('Camera: ' + (facing === 'user' ? 'frontală' : 'spate')); });
  $('paletteBtn').addEventListener('click', function () { palIdx = (palIdx + 1) % PALETTES.length; db.settings.palette = palIdx; save(); applyPalette(); toast('Paletă: ' + PALETTES[palIdx].name.toLowerCase()); });
  $('snapBtn').addEventListener('click', function () {
    if (!stream) { toast('Pornește mai întâi camera'); return; }
    var c = document.createElement('canvas'); c.width = 400; c.height = Math.round(400 * canvas.height / canvas.width);
    var x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.drawImage(canvas, 0, 0, c.width, c.height);
    buzz(25);
    if (addEvent('snap', 'Captură (' + PALETTES[palIdx].name.toLowerCase() + ', simulare)', c.toDataURL('image/jpeg', 0.72))) toast('Captură salvată în Jurnal');
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden && stream) stopCamera(); });

  /* ---------- EMF ---------- */
  var HAS_SENSOR = false;
  try { HAS_SENSOR = !!(window.UmbraNative && typeof window.UmbraNative.emf !== 'undefined' && window.UmbraNative.hasEmf()); } catch (e) { HAS_SENSOR = false; }
  var emfBase = null, emfSm = null, emfHist = [], emfWarm = [], demoVal = 46, lastEmfLog = 0, lastEmfDelta = 0, lastMag = 0;
  $('emfMode').textContent = HAS_SENSOR ? 'SENZOR REAL' : 'DEMO';
  if (!HAS_SENSOR) {
    $('emfMode').classList.add('warn');
    $('emfHint').textContent = 'Acest dispozitiv nu oferă un senzor magnetic aplicației. Valorile afișate sunt simulate, doar pentru demonstrație.';
  }
  function readEmf() {
    if (HAS_SENSOR) {
      try {
        var s = window.UmbraNative.emf(); if (!s) return null;
        var p = s.split(',').map(Number); if (p.some(isNaN)) return null;
        return Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]);
      } catch (e) { return null; }
    }
    demoVal += (46 - demoVal) * .05 + (Math.random() - .5) * 1.4;
    if (Math.random() < .004) demoVal += (Math.random() - .5) * 40;
    return demoVal;
  }
  var emfBusy = function () { return cur === 'tools' || !!activeSession(); };
  setInterval(function () {
    if (document.hidden || !emfBusy()) return;
    var v = readEmf(); if (v == null) return;
    emfSm = emfSm == null ? v : emfSm * .6 + v * .4;
    if (emfBase == null) { emfWarm.push(emfSm); if (emfWarm.length >= 8) { emfBase = emfWarm.reduce(function (a, b) { return a + b; }, 0) / emfWarm.length; } }
    var delta = emfBase == null ? 0 : emfSm - emfBase;
    lastMag = emfSm; lastEmfDelta = delta;
    emfHist.push(delta); if (emfHist.length > 90) emfHist.shift();
    if (cur === 'tools') drawEmf(emfSm, delta);
    if (HAS_SENSOR && db.settings.autoEmf && activeSession() && Math.abs(delta) >= 25 && Date.now() - lastEmfLog > 15000) {
      lastEmfLog = Date.now(); buzz([60, 40, 60]);
      addEvent('emf', 'Variație EMF ' + (delta > 0 ? '+' : '') + delta.toFixed(1) + ' µT (valoare ' + emfSm.toFixed(1) + ' µT). Cauze frecvente: metal, magneți, cabluri, aparate electrice.');
    }
  }, 200);
  function drawEmf(v, delta) {
    $('emfVal').textContent = v.toFixed(1);
    $('emfDelta').textContent = 'Δ ' + (delta >= 0 ? '+' : '') + delta.toFixed(1);
    var a = Math.abs(delta), lvl = a >= 40 ? 5 : a >= 20 ? 4 : a >= 10 ? 3 : a >= 4 ? 2 : a >= 1.5 ? 1 : 0;
    var leds = $('emfLeds').children; for (var i = 0; i < 5; i++) leds[i].classList.toggle('on', i < lvl);
    var c = $('emfGraph'), x = c.getContext('2d'), w = c.width, h = c.height;
    x.clearRect(0, 0, w, h);
    var mx = 10; emfHist.forEach(function (e) { mx = Math.max(mx, Math.abs(e)); });
    x.strokeStyle = '#242836'; x.lineWidth = 1; x.beginPath(); x.moveTo(0, h / 2); x.lineTo(w, h / 2); x.stroke();
    x.strokeStyle = '#9bf1d0'; x.lineWidth = 2; x.beginPath();
    emfHist.forEach(function (e, k) { var px = k / 89 * w, py = h / 2 - e / mx * (h / 2 - 6); if (k) x.lineTo(px, py); else x.moveTo(px, py); });
    x.stroke();
  }
  $('emfCal').addEventListener('click', function () { if (emfSm == null) { toast('Se așteaptă citirea senzorului'); return; } emfBase = emfSm; emfHist = []; toast('Calibrat la ' + emfSm.toFixed(1) + ' µT'); });
  $('emfLog').addEventListener('click', function () {
    if (emfSm == null) { toast('Nicio citire încă'); return; }
    if (addEvent('emf', 'Citire EMF manuală: ' + lastMag.toFixed(1) + ' µT (Δ ' + (lastEmfDelta >= 0 ? '+' : '') + lastEmfDelta.toFixed(1) + ')' + (HAS_SENSOR ? '' : ' [DEMO]'))) toast('Salvat în Jurnal');
  });

  /* ---------- cutia spiritelor (simulare, mod automat cu audio) ---------- */
  var WORDS = ['Aici', 'Plecați', 'Lumină', 'Frig', 'Umbră', 'Nume', 'Ajutor', 'Noapte', 'Ascultă', 'Casă', 'Vis', 'Copil', 'Ușă', 'Tăcere', 'Aproape', 'Sus', 'Jos', 'Vântul', 'Memorie', 'Ceas', 'Ecou', 'Foc', 'Apă', 'Drum'];
  var actx = null, drone = null;
  function getCtx() {
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    actx = actx || new AC(); if (actx.resume) actx.resume(); return actx;
  }
  var sb = { on: false, word: '', holdUntil: 0, sweepIv: 0, wordTo: 0, noise: null, history: [] };
  function sbRender() {
    var h = $('sbHistory'); h.replaceChildren();
    sb.history.slice(-6).forEach(function (w) { h.appendChild(el('span', 'chip', w)); });
  }
  function sbAudioStart() {
    var c = getCtx(); if (!c) { toast('Audio indisponibil'); return; }
    var len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    var src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    var f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 1.1;
    var g = c.createGain(); g.gain.value = 0; g.gain.linearRampToValueAtTime(.05, c.currentTime + .6);
    src.connect(f); f.connect(g); g.connect(c.destination); src.start();
    sb.noise = { src: src, f: f, g: g };
  }
  function sbAudioStop() {
    var n = sb.noise; sb.noise = null; if (!n) return;
    try { n.g.gain.cancelScheduledValues(actx.currentTime); n.g.gain.setTargetAtTime(0, actx.currentTime, .1); setTimeout(function () { try { n.src.stop(); } catch (e) { /* ignorat */ } }, 400); } catch (e) { /* ignorat */ }
  }
  function sbSpeak(word) {
    if (!db.settings.voice || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(word); u.lang = 'ro-RO'; u.rate = .75; u.pitch = .5; u.volume = .9;
      window.speechSynthesis.speak(u);
    } catch (e) { /* ignorat */ }
  }
  function sbWordEvent() {
    var w; do { w = WORDS[Math.floor(Math.random() * WORDS.length)]; } while (w === sb.word);
    sb.word = w; sb.history.push(w); sbRender();
    sb.holdUntil = Date.now() + 3800;
    $('sbWord').textContent = w.toUpperCase(); $('sbScreen').classList.remove('scan');
    buzz(30);
    if (sb.noise) { try { var t = actx.currentTime; sb.noise.g.gain.cancelScheduledValues(t); sb.noise.g.gain.setTargetAtTime(.012, t, .05); sb.noise.g.gain.setTargetAtTime(.05, t + 2.6, .3); } catch (e) { /* ignorat */ } }
    sbSpeak(w);
    if (db.settings.autoWord && activeSession()) addEvent('word', 'Cuvânt aleatoriu: „' + w + '” (simulare)');
    sb.wordTo = setTimeout(sbWordEvent, 6000 + Math.random() * 6000);
  }
  function sbStart() {
    if (sb.on) return; sb.on = true;
    $('sbBtn').textContent = '■ Oprește cutia'; $('sbBtn').classList.add('on');
    sbAudioStart();
    sb.holdUntil = 0; $('sbWord').textContent = '· · ·';
    sb.sweepIv = setInterval(function () {
      if (Date.now() < sb.holdUntil) return;
      $('sbScreen').classList.add('scan');
      var f = 87.5 + Math.random() * 20.5; $('sbWord').textContent = f.toFixed(1) + ' MHz';
      if (sb.noise) { try { var t = actx.currentTime; sb.noise.f.frequency.setTargetAtTime(300 + Math.random() * 2800, t, .03); sb.noise.g.gain.setTargetAtTime(.02 + Math.random() * .05, t, .03); } catch (e) { /* ignorat */ } }
    }, 140);
    sb.wordTo = setTimeout(sbWordEvent, 3500 + Math.random() * 3000);
  }
  function sbStop() {
    if (!sb.on) return; sb.on = false;
    clearInterval(sb.sweepIv); clearTimeout(sb.wordTo); sbAudioStop();
    try { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch (e) { /* ignorat */ }
    $('sbBtn').textContent = '▶ Pornește cutia'; $('sbBtn').classList.remove('on');
    $('sbScreen').classList.remove('scan'); if (!sb.word) $('sbWord').textContent = '· · ·'; else $('sbWord').textContent = sb.word.toUpperCase();
  }
  $('sbBtn').addEventListener('click', function () { sb.on ? sbStop() : sbStart(); });
  $('sbSave').addEventListener('click', function () {
    if (!sb.word) { toast('Pornește cutia și așteaptă un cuvânt'); return; }
    if (addEvent('word', 'Cuvânt aleatoriu: „' + sb.word + '” (simulare)')) toast('Salvat în Jurnal');
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden) sbStop(); });

  /* ---------- sunet ambiental ---------- */
  function setSound(on) {
    var b = $('soundBtn'); b.setAttribute('aria-checked', on ? 'true' : 'false');
    $('soundStatus').textContent = on ? 'Sunet activ. Ton grav generat de aplicație.' : 'Sunet dezactivat. Un ton grav generat de aplicație, fără microfon.';
    if (on) {
      try {
        if (!getCtx()) { toast('Audio indisponibil'); return; }
        var g = actx.createGain(); g.gain.value = 0; g.gain.linearRampToValueAtTime(.06, actx.currentTime + 1.5);
        var f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220;
        var o1 = actx.createOscillator(), o2 = actx.createOscillator(); o1.frequency.value = 55; o2.frequency.value = 57.3;
        o1.connect(f); o2.connect(f); f.connect(g); g.connect(actx.destination); o1.start(); o2.start();
        drone = { g: g, o: [o1, o2] };
      } catch (e) { toast('Audio indisponibil'); }
    } else if (drone) {
      var d = drone; drone = null;
      try { d.g.gain.linearRampToValueAtTime(0, actx.currentTime + .4); setTimeout(function () { d.o.forEach(function (o) { try { o.stop(); } catch (e) { /* ignorat */ } }); }, 500); } catch (e) { /* ignorat */ }
    }
  }
  $('soundBtn').addEventListener('click', function () { setSound(!drone); });
  document.addEventListener('visibilitychange', function () { if (document.hidden && drone) setSound(false); });

  /* ---------- jurnal ---------- */
  function sessionReport(s) {
    var lines = ['UMBRA · Raport de investigație', s.name + (s.place ? ' — ' + s.place : ''), fmtDate(s.start) + (s.end ? ' → ' + fmtDate(s.end) : ''), ''];
    s.events.forEach(function (e) { lines.push('[' + fmtTime(e.t) + '] ' + TYPE_LABEL[e.type] + ': ' + e.text + (e.img ? ' (cu captură)' : '')); });
    lines.push('', 'Generat cu Umbra, aplicație de divertisment. Efectele termice și cutia spiritelor sunt simulări; nu constituie dovezi.');
    return lines.join('\n');
  }
  function shareText(title, text) {
    try {
      if (window.UmbraNative && typeof window.UmbraNative.share !== 'undefined') { window.UmbraNative.share(title, text); return; }
      if (navigator.share) { navigator.share({ title: title, text: text }); return; }
      if (navigator.clipboard) { navigator.clipboard.writeText(text); toast('Raport copiat'); return; }
    } catch (e) { /* ignorat */ }
    toast('Distribuirea nu este disponibilă');
  }
  function timelineNode(s) {
    var tl = el('div', 'timeline');
    s.events.forEach(function (e) {
      var ev = el('div', 'ev');
      ev.appendChild(el('time', null, fmtTime(e.t) + ' · ' + TYPE_LABEL[e.type]));
      ev.appendChild(el('p', null, e.text));
      if (e.img) { var im = el('img'); im.alt = 'Captură'; im.src = e.img; ev.appendChild(im); }
      tl.appendChild(ev);
    });
    return tl;
  }
  function renderLog() {
    var root = $('logRoot'); root.replaceChildren();
    var s = activeSession();
    if (s) {
      var card = el('div', 'session-card');
      card.appendChild(el('div', 'eyebrow', 'Sesiune activă'));
      card.appendChild(el('h2', null, s.name));
      var tm = el('div', 'session-timer', fmtDur(Date.now() - s.start)); tm.id = 'liveTimer'; card.appendChild(tm);
      card.appendChild(el('div', 'small', (s.place ? s.place + ' · ' : '') + s.events.length + ' înregistrări'));
      var f = el('label', 'field', 'Notă nouă'); var ta = el('textarea'); ta.id = 'noteIn'; ta.placeholder = 'Ce observi? (ex.: zgomot în hol, senzație de frig)'; ta.maxLength = 500; f.appendChild(ta); card.appendChild(f);
      var row = el('div', 'row-btns');
      var add = el('button', 'btn primary', 'Adaugă notă'); var end = el('button', 'btn ghost', 'Încheie sesiunea');
      add.addEventListener('click', function () { var t = ta.value.trim(); if (!t) { toast('Scrie o notă'); return; } addEvent('note', t); });
      end.addEventListener('click', endSession);
      row.appendChild(add); row.appendChild(end); card.appendChild(row);
      root.appendChild(card);
      root.appendChild(el('div', 'list-title', 'Cronologie'));
      root.appendChild(timelineNode(s));
    } else {
      var c2 = el('div', 'card');
      c2.appendChild(el('div', 'eyebrow', 'Investigație nouă')); c2.appendChild(el('h2', null, 'Începe o sesiune'));
      var f1 = el('label', 'field', 'Nume'); var i1 = el('input'); i1.id = 'sName'; i1.maxLength = 60; i1.placeholder = 'Investigație #' + (db.sessions.length + 1); f1.appendChild(i1);
      var f2 = el('label', 'field', 'Locație (opțional)'); var i2 = el('input'); i2.id = 'sPlace'; i2.maxLength = 80; i2.placeholder = 'Ex.: pod, pivniță, conac'; f2.appendChild(i2);
      var go = el('button', 'btn primary big', 'Începe sesiunea');
      go.addEventListener('click', function () { startSession(i1.value.trim(), i2.value.trim()); updateRec(); renderLog(); });
      c2.appendChild(f1); c2.appendChild(f2); c2.appendChild(go);
      c2.appendChild(el('p', 'hint', 'În sesiune, capturile, citirile EMF, mișcările și notele se adaugă automat în cronologie.'));
      root.appendChild(c2);
    }
    var past = db.sessions.filter(function (x) { return x.id !== db.active; });
    root.appendChild(el('div', 'list-title', 'Sesiuni anterioare'));
    if (!past.length) { root.appendChild(el('div', 'empty', 'Nicio sesiune încheiată încă.')); }
    past.forEach(function (x) {
      var b = el('button', 's-item'); var l = el('div'); l.appendChild(el('b', null, x.name));
      l.appendChild(el('small', null, fmtDate(x.start) + (x.place ? ' · ' + x.place : '')));
      b.appendChild(l); b.appendChild(el('span', 's-count', x.events.length + ' înreg.'));
      b.addEventListener('click', function () { openSession(x); });
      root.appendChild(b);
    });
  }
  function openSession(x) {
    var box = el('div');
    box.appendChild(el('div', 'small', fmtDate(x.start) + (x.end ? ' · durată ' + fmtDur(x.end - x.start) : '') + (x.place ? ' · ' + x.place : '')));
    box.appendChild(timelineNode(x));
    var acts = el('div', 'sheet-actions');
    var sh = el('button', 'btn primary', 'Distribuie raportul'); var del = el('button', 'btn danger', 'Șterge sesiunea');
    sh.addEventListener('click', function () { shareText('Raport Umbra — ' + x.name, sessionReport(x)); });
    del.addEventListener('click', function () {
      confirmSheet('Ștergi sesiunea?', 'Sesiunea „' + x.name + '” și capturile ei vor fi șterse definitiv de pe telefon.', 'Șterge', function () {
        db.sessions = db.sessions.filter(function (y) { return y.id !== x.id; }); save(); renderLog(); toast('Sesiune ștearsă');
      });
    });
    acts.appendChild(sh); acts.appendChild(del); box.appendChild(acts);
    openSheet(x.name, box);
  }

  /* ---------- setări ---------- */
  function switchRow(title, desc, key) {
    var r = el('div', 'set-row'); var l = el('div'); l.appendChild(el('b', null, title)); l.appendChild(el('small', null, desc));
    var sw = el('button', 'switch'); sw.setAttribute('role', 'switch'); sw.setAttribute('aria-label', title); sw.setAttribute('aria-checked', db.settings[key] ? 'true' : 'false'); sw.appendChild(el('i'));
    sw.addEventListener('click', function () { db.settings[key] = !db.settings[key]; sw.setAttribute('aria-checked', db.settings[key] ? 'true' : 'false'); save(); if (key === 'vibrate') buzz(30); });
    r.appendChild(l); r.appendChild(sw); return r;
  }
  function renderSettings() {
    var root = $('settingsRoot'); root.replaceChildren();
    root.appendChild(el('div', 'list-title', 'Preferințe'));
    var g = el('div', 'set-group');
    g.appendChild(switchRow('Vibrații', 'La capturi și evenimente.', 'vibrate'));
    g.appendChild(switchRow('Note automate: mișcare', 'În sesiune, notează mișcarea din imagine.', 'autoMotion'));
    g.appendChild(switchRow('Note automate: EMF', 'În sesiune, notează variațiile mari ale câmpului magnetic.', 'autoEmf'));
    g.appendChild(switchRow('Cutia spiritelor: voce', 'Cuvântul este rostit cu vocea telefonului (sinteză vocală).', 'voice'));
    g.appendChild(switchRow('Note automate: cuvinte', 'În sesiune, notează cuvintele generate de cutie.', 'autoWord'));
    root.appendChild(g);
    root.appendChild(el('div', 'list-title', 'Date'));
    var g2 = el('div', 'set-group'); var r = el('div', 'set-row'); var l = el('div');
    l.appendChild(el('b', null, 'Șterge toate datele')); l.appendChild(el('small', null, 'Sesiuni, capturi și setări de pe acest telefon.')); r.appendChild(l);
    var b = el('button', 'btn danger', 'Șterge');
    b.addEventListener('click', function () {
      confirmSheet('Ștergi tot?', 'Toate sesiunile, capturile și setările vor fi șterse definitiv. Nu se poate anula.', 'Șterge tot', function () {
        try { localStorage.removeItem(KEY); } catch (e) { /* ignorat */ }
        db = JSON.parse(JSON.stringify(defaults)); palIdx = 0; applyPalette(); renderPill(); renderSettings(); updateRec(); toast('Datele au fost șterse');
      });
    });
    r.appendChild(b); g2.appendChild(r); root.appendChild(g2);
    root.appendChild(el('div', 'list-title', 'Despre'));
    var ab = el('div', 'set-group'); var p = el('div', 'about');
    [['Umbra', ' v' + VERSION + ' — aplicație de divertisment.'],
     ['Ce este real: ', 'câmpul magnetic (EMF) este citit de senzorul telefonului; detectarea mișcării compară cadrele camerei.'],
     ['Ce este simulat: ', 'efectul „termic” (colorare după luminozitate) și cutia spiritelor (cuvinte aleatorii).'],
     ['Confidențialitate: ', 'totul rămâne pe telefon. Aplicația nu are acces la internet și nu folosește microfonul.']
    ].forEach(function (t) { var d = el('div'); d.appendChild(el('b', null, t[0])); d.appendChild(document.createTextNode(t[1])); d.style.marginBottom = '8px'; p.appendChild(d); });
    ab.appendChild(p); root.appendChild(ab);
  }

  /* ---------- final ---------- */
  if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(function (rs) { rs.forEach(function (r) { r.unregister(); }); }).catch(function () { /* ignorat */ });
  renderPill(); updateRec();
})();
