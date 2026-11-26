// FrontWars Web – Hauptprogramm: Fenster, Eingaben (Maus, Touch, Tastatur) und Ablauf wie main() in FrontWars.py
'use strict';

const App = {
  cv: null, sw: 1360, sh: 820, scale: 1, dpr: 1, mx: -9999, my: -9999, keys: new Set(), events: [], screen: null, onDone: null,
  isTouch: matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window,
  input: null, fieldId: null, fieldActive: null, fieldSeen: false,
  // ---------- Textfelder: echtes <input> über dem gezeichneten Kasten (Handy-Tastatur, Einfügen, ...) ----------
  fieldVals: {}, fieldDirty: {},
  field(id, rect, value, active, maxlen, size, autofocus) {
    this.fieldRects.push([id, rect, maxlen]);
    if (this.fieldId === id) value = this.input.value.slice(0, maxlen);            // gebunden: das Eingabefeld ist die Wahrheit
    else if (this.fieldDirty[id]) { value = this.fieldVals[id]; delete this.fieldDirty[id]; }  // zuletzt getippter Stand
    this.fieldVals[id] = value;
    if (!active) return value;
    this.fieldActive = { id, rect, maxlen, size, autofocus };
    if (this.fieldId !== id) { this.bindField(id, maxlen); this.wantFocus = !this.isTouch || autofocus; }
    return value;
  },
  bindField(id, maxlen) {
    if (this.fieldId !== null && this.fieldId !== id) { this.fieldVals[this.fieldId] = this.input.value; this.fieldDirty[this.fieldId] = true; }
    this.fieldId = id; this.input.value = this.fieldVals[id] || ''; if (maxlen) this.input.maxLength = maxlen;
  },
  // Klick/Tipp auf einen Textkasten: sofort umschalten, damit kein Buchstabe verloren geht
  hitField(p) {
    for (const [id, r, maxlen] of this.fieldRects) if (r.collidepoint(p)) {
      if (this.fieldId !== id) this.bindField(id, maxlen);
      this.input.style.display = 'block'; try { this.input.focus({ preventScroll: true }); } catch (e) { this.input.focus(); }
      return true;
    }
    return false;
  },
  // aktueller Text eines Feldes, auch wenn seit dem letzten Bild getippt wurde
  live(id, value) { return this.fieldId === id ? this.input.value : value; },
  fieldShown(id) { return this.fieldId === id && this.input.style.display !== 'none'; },
  placeInput() {
    const f = this.fieldActive, el = this.input;
    if (!f) {
      if (el.style.display !== 'none') { el.blur(); el.style.display = 'none'; }
      if (this.fieldId !== null) { this.fieldVals[this.fieldId] = el.value; this.fieldDirty[this.fieldId] = true; this.fieldId = null; }
      return;
    }
    const s = this.scale, r = f.rect, px = Math.max(8, Math.trunc(f.size * 0.72)) * s;
    Object.assign(el.style, { display: 'block', left: (r.x + 12) * s + 'px', top: r.y * s + 'px', width: (r.w - 24) * s + 'px', height: r.h * s + 'px', fontSize: px + 'px' });
    if (this.wantFocus) { this.wantFocus = false; try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } }
  },
  copy(text) { return (navigator.clipboard && navigator.clipboard.writeText) ? navigator.clipboard.writeText(text).then(() => true, () => false) : Promise.resolve(false); },
  isFull() { return !!(document.fullscreenElement || document.webkitFullscreenElement); },
  toggleFull() {
    const d = document, el = d.documentElement;
    if (this.isFull()) { (d.exitFullscreen || d.webkitExitFullscreen).call(d); return true; }
    const req = el.requestFullscreen || el.webkitRequestFullscreen; if (!req) return false;
    try { const p = req.call(el); if (p && p.catch) p.catch(() => {}); return true; } catch (e) { return false; }
  },
  pointerLocked() { return document.pointerLockElement === this.cv; },
  unlockPointer() { if (this.pointerLocked() && document.exitPointerLock) document.exitPointerLock(); },
  setScreen(screen, onDone) { this.screen = screen; this.onDone = onDone; this.events = []; this.fieldId = null; this.fieldActive = null; this.fieldVals = {}; this.fieldDirty = {}; this.input.blur(); this.input.style.display = 'none'; },
};

(function boot() {
  const cv = App.cv = document.getElementById('cv'), input = App.input = document.getElementById('txt');
  ctx = cv.getContext('2d');
  App.fieldRects = [];
  const gfx = new Gfx();
  const toLogical = (cx, cy) => [cx / App.scale, cy / App.scale];
  const push = ev => App.events.push(ev);

  function resize() {
    const vw = window.innerWidth, vh = window.innerHeight, need = (App.screen && App.screen.need) || [1000, 640];
    App.dpr = Math.min(2, window.devicePixelRatio || 1);
    App.scale = Math.min(1, vw / need[0], vh / need[1]);
    App.sw = Math.round(vw / App.scale); App.sh = Math.round(vh / App.scale);
    const pw = Math.round(vw * App.dpr), ph = Math.round(vh * App.dpr);
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
    App.vw = vw; App.vh = vh;
  }

  // ---------- Maus ----------
  const BTN = { 0: 1, 1: 2, 2: 3 };
  // ---------- Touch: Tippen = Linksklick, lange drücken = Rechtsklick, ziehen, zwei Finger = zoomen + verschieben ----------
  const touches = new Map(); let pend = null, pinch = null, lpTimer = 0, dragging = false;
  const tcenter = () => { const a = [...touches.values()]; return [(a[0].x + a[1].x) / 2, (a[0].y + a[1].y) / 2, Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y)]; };
  cv.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (e.pointerType === 'touch' && App.screen && App.screen.rawTouch) { cv.setPointerCapture(e.pointerId); push({ type: 'tstart', id: e.pointerId, pos: toLogical(e.clientX, e.clientY) }); return; }
    if (e.pointerType !== 'touch') {
      if (App.screen && App.screen.wantLock && !App.pointerLocked() && cv.requestPointerLock) { try { const r = cv.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (x) {} }
      cv.setPointerCapture(e.pointerId); if (!App.pointerLocked()) [App.mx, App.my] = toLogical(e.clientX, e.clientY);
      if (e.button === 0) App.hitField([App.mx, App.my]);
      push({ type: 'down', button: BTN[e.button] || 1, pos: [App.mx, App.my], shift: e.shiftKey }); return;
    }
    cv.setPointerCapture(e.pointerId); touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 1) {
      dragging = false; pend = { x: e.clientX, y: e.clientY, id: e.pointerId }; [App.mx, App.my] = toLogical(e.clientX, e.clientY);
      clearTimeout(lpTimer);
      lpTimer = setTimeout(() => { if (pend) { const p = toLogical(pend.x, pend.y); [App.mx, App.my] = p; push({ type: 'down', button: 3, pos: p }); push({ type: 'up', button: 3, pos: p }); pend = null; if (navigator.vibrate) try { navigator.vibrate(12); } catch (x) {} } }, 480);
    } else if (touches.size === 2) {
      clearTimeout(lpTimer); pend = null;
      if (dragging) { push({ type: 'up', button: 1, pos: [App.mx, App.my] }); dragging = false; }
      const [cx, cy, d] = tcenter(); pinch = { cx, cy, d };
    }
  });
  cv.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch' && App.screen && App.screen.rawTouch) { push({ type: 'tmove', id: e.pointerId, pos: toLogical(e.clientX, e.clientY) }); return; }
    if (e.pointerType !== 'touch') {
      if (App.pointerLocked()) { push({ type: 'move', pos: [App.mx, App.my], rel: [0, 0], mrel: [e.movementX || 0, e.movementY || 0] }); return; }
      const [x, y] = toLogical(e.clientX, e.clientY), rel = [x - App.mx, y - App.my]; App.mx = x; App.my = y;
      push({ type: 'move', pos: [x, y], rel, mrel: [e.movementX || 0, e.movementY || 0] }); return;
    }
    const t = touches.get(e.pointerId); if (!t) return; t.x = e.clientX; t.y = e.clientY;
    if (touches.size >= 2 && pinch) {
      const [cx, cy, d] = tcenter(), [lx, ly] = toLogical(cx, cy);
      App.mx = lx; App.my = ly;
      if (pinch.d > 10 && d > 10 && Math.abs(d - pinch.d) > 0.5) push({ type: 'wheel', y: Math.log(d / pinch.d) / Math.log(1.25), pos: [lx, ly] });
      push({ type: 'pan', rel: [(cx - pinch.cx) / App.scale, (cy - pinch.cy) / App.scale] });
      pinch = { cx, cy, d }; return;
    }
    if (pend && e.pointerId === pend.id && Math.hypot(e.clientX - pend.x, e.clientY - pend.y) > 8) {
      clearTimeout(lpTimer); const p0 = toLogical(pend.x, pend.y); App.mx = p0[0]; App.my = p0[1];
      push({ type: 'down', button: 1, pos: p0 }); pend = null; dragging = true;
    }
    if (dragging) { const [x, y] = toLogical(e.clientX, e.clientY), rel = [x - App.mx, y - App.my]; App.mx = x; App.my = y; push({ type: 'move', pos: [x, y], rel }); }
  });
  const pointerEnd = e => {
    if (e.pointerType === 'touch' && App.screen && App.screen.rawTouch) { push({ type: 'tend', id: e.pointerId }); touches.delete(e.pointerId); return; }
    if (e.pointerType !== 'touch') {
      if (App.pointerLocked()) { push({ type: 'up', button: BTN[e.button] || 1, pos: [App.mx, App.my] }); return; } const [x, y] = toLogical(e.clientX, e.clientY); push({ type: 'up', button: BTN[e.button] || 1, pos: [x, y], shift: e.shiftKey }); return; }
    if (!touches.has(e.pointerId)) return; touches.delete(e.pointerId); clearTimeout(lpTimer);
    if (pend && pend.id === e.pointerId && e.type === 'pointerup') {
      const p = toLogical(pend.x, pend.y); App.mx = p[0]; App.my = p[1];
      push({ type: 'down', button: 1, pos: p }); push({ type: 'up', button: 1, pos: p });
      // Textfeld angetippt? Sofort fokussieren (sonst öffnet iOS keine Tastatur)
      App.hitField(p);
    } else if (dragging && !touches.size) { push({ type: 'up', button: 1, pos: [App.mx, App.my] }); }
    pend = null;
    if (touches.size < 2) pinch = null;
    if (!touches.size) { dragging = false; setTimeout(() => { if (!touches.size) { App.mx = -9999; App.my = -9999; } }, 60); }
  };
  cv.addEventListener('pointerup', pointerEnd); cv.addEventListener('pointercancel', pointerEnd);
  cv.addEventListener('wheel', e => { e.preventDefault(); const [x, y] = toLogical(e.clientX, e.clientY); App.mx = x; App.my = y; const d = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY; push({ type: 'wheel', y: Math.max(-3, Math.min(3, -d / 100)), pos: [x, y] }); }, { passive: false });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('mouseleave', () => { App.mx = -9999; App.my = -9999; });

  // ---------- Tastatur ----------
  const keyName = e => e.key === ' ' ? 'Space' : (e.key.length === 1 ? e.key.toLowerCase() : e.key);
  window.addEventListener('keydown', e => {
    const k = keyName(e), inField = e.target === input;
    if (inField) {
      if (k === 'Enter' || k === 'Escape' || k === 'Tab') { e.preventDefault(); push({ type: 'key', key: k, ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey }); }
      return;
    }
    if (App.fieldActive && k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { input.style.display = 'block'; input.focus({ preventScroll: true }); return; }
    if (['Tab', 'F1', 'F11', 'Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Backspace'].includes(k)) e.preventDefault();
    App.keys.add(k);
    push({ type: 'key', key: k, ch: e.key.length === 1 ? e.key : '', ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey });
  });
  window.addEventListener('keyup', e => App.keys.delete(keyName(e)));
  window.addEventListener('blur', () => App.keys.clear());
  window.addEventListener('resize', resize);

  // ---------- Ablauf (wie main() in FrontWars.py) ----------
  const cfg = { name: store.get('name', 'Spieler'), code: '', error: '', settings: Object.assign(default_settings(), store.get('settings', {})) };
  if (!PRESETS.some(([k]) => k === cfg.settings.map[1]) && cfg.settings.map[0] === 'preset') cfg.settings.map = ['preset', 'welt'];
  function menu() { App.setScreen(new MenuScreen(gfx, cfg), choice => {
    if (choice === 'editor') App.setScreen(new EditorScreen(gfx), () => { set_map_size(720, 288); menu(); });
    else if (choice === 'weapons') App.setScreen(new WeaponsScreen(gfx), menu);
    else if (choice === 'blobeditor') App.setScreen(new BlobEditorScreen(gfx), menu);
    else if (choice === 'blob') arena();
    else if (choice === 'host' || choice === 'blobworld') {
      cfg.settings.blobs = choice === 'blobworld';
      if (choice === 'blobworld') { cfg.settings.map = ['preset', 'welt']; cfg.settings.map_label = 'Weltkarte'; }
      host();
    }
    else if (choice === 'join') join();
  }); }
  function host() {
    const lobby = new Lobby(cfg.settings), srv = new Server(lobby);
    lobby.server = srv; lobby.relay = new RelayHost(srv).start();
    const net = new LocalNet(srv, cfg.name.trim(), my_designs());
    const cleanup = () => { store.set('settings', cfg.settings); net.close(); lobby.running = false; if (lobby.game) lobby.game.stop(); lobby.relay.close(); set_map_size(720, 288); menu(); };
    App.setScreen(new LobbyScreen(gfx, net, lobby), r => {
      if (r === 'start') App.setScreen(new GameScreen(gfx, net, lobby.code || 'nur lokal'), cleanup);
      else cleanup();
    });
  }
  function arena() {
    App.setScreen(new BlobSetupScreen(gfx, cfg), r => {
      if (r !== 'start') { menu(); return; }
      const bc = cfg.blob, game = new BlobGame({ team_size: bc.size, diff: bc.diff, target: bc.target, colors: [BLOB_COLORS[bc.color][1], BLOB_COLORS[bc.enemy][1]], player_name: (cfg.name || 'Du').trim().slice(0, 16) || 'Du' });
      App.setScreen(new BlobBattleScreen(gfx, game), arena);
    });
  }
  function join() {
    const code = cfg.code.trim();
    if (!code.toUpperCase().startsWith('ON')) { cfg.error = 'Im Browser gehen nur Online-Codes (ON-...). Frag den Host danach.'; menu(); return; }
    try { parse_online_code(code); } catch (e) { cfg.error = e.message; menu(); return; }
    const net = new RelayNetClient(code, cfg.name.trim(), my_designs());
    App.setScreen(new ConnectScreen(gfx, net), r => {
      if (r !== 'ok') { cfg.error = 'Online-Server nicht erreichbar. Bist du mit dem Internet verbunden?'; menu(); return; }
      const done = () => { net.close(); set_map_size(720, 288); menu(); };
      App.setScreen(new LobbyScreen(gfx, net, null), r2 => {
        if (r2 === 'start') App.setScreen(new GameScreen(gfx, net, null), done);
        else { if (r2 === 'lost') cfg.error = net.error || 'Verbindung zum Host verloren.'; done(); }
      });
    });
  }

  // ---------- Bildschirm-Schleife ----------
  let last = performance.now();
  function frame(t) {
    const dt = Math.min(0.1, (t - last) / 1000); last = t;
    resize();
    ctx.setTransform(App.dpr * App.scale, 0, 0, App.dpr * App.scale, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const evs = App.events; App.events = []; App.fieldRects = []; App.fieldActive = null;
    let res;
    try { res = App.screen.frame(evs, dt); }
    catch (err) { console.error(err); ctx.setTransform(App.dpr, 0, 0, App.dpr, 0, 0); ctx.fillStyle = '#300'; ctx.fillRect(0, 0, 4000, 60); ctx.fillStyle = '#fff'; ctx.font = '16px sans-serif'; ctx.fillText('Fehler: ' + err.message, 12, 34); }
    App.fieldDirty = {};   // nicht abgeholte Zwischenstände verfallen nach einem Bild
    App.placeInput();
    // Hochformat auf dem Handy: bitte drehen
    if (App.isTouch && App.vh > App.vw && App.screen.need[0] > 700) {
      ctx.setTransform(App.dpr, 0, 0, App.dpr, 0, 0); ctx.fillStyle = 'rgba(8,12,22,0.86)'; ctx.fillRect(0, 0, App.vw, App.vh);
      ctx.fillStyle = '#f6c448'; ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT_STACK}`; ctx.fillText('Bitte Gerät quer halten', App.vw / 2, App.vh / 2 - 6);
      ctx.fillStyle = '#c7cfdd'; ctx.font = `400 15px ${FONT_STACK}`; ctx.fillText('FrontWars braucht das Querformat.', App.vw / 2, App.vh / 2 + 22); ctx.textAlign = 'left';
    }
    if (res !== undefined && App.onDone) { const cb = App.onDone; App.onDone = null; cb(res); }
    requestAnimationFrame(frame);
  }
  menu(); resize();
  requestAnimationFrame(t => { last = t; frame(t); });
})();
