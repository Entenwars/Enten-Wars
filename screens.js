// FrontWars Web – Hauptmenü, Lobby, Karteneditor, Waffen-Editor
'use strict';

function text_box(gfx, id, rect, text, active, size = 27, maxlen = 64, placeholder = '') {
  draw.rect([30, 35, 48], rect, 0, 10);
  draw.rect(active ? GOLD : [70, 78, 100], rect, active ? 2 : 1, 10);
  const v = App.field(id, rect, text, active, maxlen, size);
  if (!App.fieldShown(id)) {
    let shown = v || placeholder; const f = gfx.font(size);
    while (shown && f.size(shown + '|')[0] > rect.w - 28) shown = shown.slice(1);
    if (shown !== (v || placeholder)) shown = '…' + shown.slice(1);
    const t = gfx.txt(shown, size, v ? TEXT : DIM); blit(t, [rect.x + 14, rect.y + trunc((rect.h - f.get_height()) / 2)]);
  }
  return v;
}
function big_button(gfx, rect, label, col, mx, my, size = 29) {
  draw.rect(rect.collidepoint(mx, my) ? lerp_col(col, [255, 255, 255], 0.14) : col, rect, 0, 12);
  const t = gfx.txt(label, size, [255, 255, 255], true); blit(t, t.get_rect({ center: rect.center }));
}
function handle_common(ev) { if (ev.type === 'key' && ev.key === 'F11') { App.toggleFull(); return true; } return false; }

// ---------------------------------------------------------------------------
// Hauptmenü
// ---------------------------------------------------------------------------
class MenuScreen {
  constructor(gfx, cfg) { this.gfx = gfx; this.cfg = cfg; this.focus = App.isTouch ? '' : 'name'; this.need = [560, 740]; }
  frame(evs) {
    const gfx = this.gfx, cfg = this.cfg, sw = App.sw, sh = App.sh, cx = sw >> 1, y0 = Math.max(200, (sh >> 1) - 170);
    const r_name = R(cx - 220, y0 + 22, 440, 46), r_host = R(cx - 220, y0 + 90, 440, 58), r_blob = R(cx - 220, y0 + 156, 440, 46);
    const r_code = R(cx - 220, y0 + 244, 290, 46), r_join = R(cx + 80, y0 + 244, 140, 46);
    const r_edit = R(cx - 220, y0 + 318, 144, 46), r_weap = R(cx - 72, y0 + 318, 144, 46), r_bed = R(cx + 76, y0 + 318, 144, 46);
    const r_arena = R(cx - 220, y0 + 372, 292, 46), r_full = R(cx + 80, y0 + 372, 140, 46);
    const mx = App.mx, my = App.my; let go = null;
    cfg.name = App.live('name', cfg.name); cfg.code = App.live('code', cfg.code);
    for (const ev of evs) {
      if (handle_common(ev)) continue;
      if (ev.type === 'down' && ev.button === 1) {
        if (r_name.collidepoint(ev.pos)) this.focus = 'name';
        else if (r_code.collidepoint(ev.pos)) this.focus = 'code';
        else if (r_host.collidepoint(ev.pos)) go = 'host';
        else if (r_blob.collidepoint(ev.pos)) go = 'blobworld';
        else if (r_arena.collidepoint(ev.pos)) return 'blob';
        else if (r_bed.collidepoint(ev.pos)) return 'blobeditor';
        else if (r_join.collidepoint(ev.pos)) go = 'join';
        else if (r_edit.collidepoint(ev.pos)) return 'editor';
        else if (r_weap.collidepoint(ev.pos)) return 'weapons';
        else if (r_full.collidepoint(ev.pos)) { if (!App.toggleFull()) cfg.error = 'Vollbild geht hier nicht – leg die Seite auf den Home-Bildschirm.'; }
        else this.focus = '';
      }
      if (ev.type === 'key') {
        if (ev.key === 'Tab') this.focus = this.focus === 'name' ? 'code' : 'name';
        else if (ev.key === 'Enter') go = (this.focus === 'code' && cfg.code.trim()) ? 'join' : 'host';
      }
    }
    if (go) {
      if (!cfg.name.trim()) cfg.error = 'Bitte einen Namen eingeben.';
      else if (go === 'join' && !cfg.code.trim()) cfg.error = 'Bitte den Spiel-Code vom Host eingeben.';
      else { cfg.error = ''; store.set('name', cfg.name.trim()); return go; }
    }
    draw_background(gfx, sw, sh);
    gfx.panel(R(cx - 260, y0 - 130, 520, 600), 200, 18);
    let t = gfx.txt('FrontWars', 80, GOLD, true); blit(t, t.get_rect({ center: [cx, y0 - 76] }));
    t = gfx.txt('Erobere die Welt', 24, DIM); blit(t, t.get_rect({ center: [cx, y0 - 32] }));
    blit(gfx.txt('Dein Name', 21, DIM), [cx - 220, y0]);
    cfg.name = text_box(gfx, 'name', r_name, cfg.name, this.focus === 'name', 27, 16);
    big_button(gfx, r_host, 'Spiel hosten', [60, 160, 96], mx, my, 32);
    big_button(gfx, r_blob, 'Blob-Welt (3D-Weltkarte mit Blobs)', [150, 80, 200], mx, my, 25);
    blit(gfx.txt('Freunden beitreten - Spiel-Code eingeben', 21, DIM), [cx - 220, y0 + 222]);
    cfg.code = text_box(gfx, 'code', r_code, cfg.code, this.focus === 'code', 27, 64, this.focus === 'code' ? '' : 'z.B. ON-1ABCDEF');
    big_button(gfx, r_join, 'Beitreten', [66, 104, 176], mx, my, 27);
    gfx.button(r_edit, 'Karteneditor', { size: 21, hover: r_edit.collidepoint(mx, my) });
    gfx.button(r_weap, 'Waffen-Editor', { size: 21, hover: r_weap.collidepoint(mx, my) });
    gfx.button(r_bed, 'Blob-Editor', { size: 21, hover: r_bed.collidepoint(mx, my) });
    gfx.button(r_arena, 'Blob-Arena (Shooter)', { size: 21, hover: r_arena.collidepoint(mx, my) });
    gfx.button(r_full, App.isFull() ? 'Fenster' : 'Vollbild', { size: 21, hover: r_full.collidepoint(mx, my) });
    t = gfx.txt('Online-Codes (ON-...) klappen überall – auch mit der PC-Version', 18, DIM); blit(t, t.get_rect({ center: [cx, y0 + 440] }));
    if (cfg.error) {
      t = gfx.txt(cfg.error, 22, [255, 130, 120], true); const rr = t.get_rect({ center: [cx, y0 + 492] }).inflate(24, 12);
      gfx.panel(rr, 230, 8); blit(t, t.get_rect({ center: rr.center }));
    }
    if (!App.isTouch) blit(gfx.txt('F11 = Vollbild', 20, DIM), [14, sh - 28]);
  }
}

class ConnectScreen {
  // Wartet, bis die Online-Verbindung steht (im Python-Spiel blockiert das Fenster so lange)
  constructor(gfx, net) { this.gfx = gfx; this.net = net; this.need = [560, 400]; this.result = undefined; net.open().then(() => { this.result = 'ok'; }, e => { this.result = 'fail'; this.err = e.message; }); }
  frame(evs) {
    for (const ev of evs) handle_common(ev);
    draw_background(this.gfx, App.sw, App.sh);
    const t = this.gfx.txt('Verbinde über den Online-Server ...', 36, TEXT, true); blit(t, t.get_rect({ center: [App.sw >> 1, App.sh >> 1] }));
    return this.result;
  }
}

// ---------------------------------------------------------------------------
// Lobby
// ---------------------------------------------------------------------------
function map_choices() { return PRESETS.map(([k, n]) => [['preset', k], k === 'welt' ? 'Weltkarte' : 'Zufall: ' + n]).concat(list_saved_maps().map(n => [['file', n], 'Eigene: ' + n])); }
function lobby_rows(settings) {
  const rows = [['Modus', 'mode', 'cycle', MODE_ORDER.map(m => [m, MODES[m].name + ' - ' + MODES[m].info])], ['Karte', 'map', 'cycle', map_choices()],
    (settings.map || ['preset'])[0] === 'preset' ? ['Kartengröße', 'size', 'cycle', MAP_SIZES.map(([k, lab]) => [k, lab])] : ['Kartengröße', 'map_label', 'cycle', [[settings.map_label, 'wie in der Kartendatei']]],
    ['Bots', 'bots', 'num', [5, 0, 110]], ['Bot-Stärke', 'diff', 'cycle', DIFF_ORDER.map(d => [d, DIFFS[d].name])]];
  if (settings.mode !== 'endless') rows.push(['Sieg bei', 'win', 'cycle', [[50, '50 % Land'], [72, '72 % Land'], [90, '90 % Land'], [0, 'Nie']]]);
  else rows.push(['Gespeicherte Welt', 'resume', 'cycle', [[true, 'fortsetzen'], [false, 'neue Welt']]]);
  rows.push(['Startgold', 'start_gold', 'cycle', [[0, '0'], [500000, '500.000'], [5000000, '5 Mio'], [50000000, '50 Mio']]],
    ['Kleine Bombe', 'small', 'toggle', null], ['Große Bombe', 'big', 'toggle', null], ['MIRV', 'mirv', 'toggle', null], ['Kampfjets / Flughafen', 'planes', 'toggle', null],
    ['Kriegsschiffe', 'ships', 'toggle', null], ['SAM-Abwehr', 'sam', 'toggle', null], ['Bündnisse', 'alliances', 'toggle', null],
    ['Blob-Welt (3D mit Blobs)', 'blobs', 'toggle', null]);
  return rows;
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

class LobbyScreen {
  constructor(gfx, net, lobby) { this.gfx = gfx; this.net = net; this.lobby = lobby; this.host = !!lobby; this.copied_at = 0; this.copied_code = ''; this.need = [1120, 760]; }
  frame(evs) {
    const gfx = this.gfx, net = this.net, lobby = this.lobby, host = this.host, sw = App.sw, sh = App.sh, mx = App.mx, my = App.my;
    const info = net.lobby, settings = host ? lobby.settings : (info || {}).settings, names = (info || {}).players || [];
    if (!host && net.has_state) return 'start';
    if (!net.connected) return 'lost';
    const pw = Math.min(640, sw - 470), left = R(Math.max(20, (sw >> 1) - ((pw + 420) >> 1)), 110, pw, sh - 150), right = R(left.right + 20, 110, 400, sh - 150);
    const rows = settings ? lobby_rows(settings) : [], rh_ = Math.max(28, Math.min(38, trunc((left.h - 66) / Math.max(1, rows.length)))), row_rects = rows.map((row, n) => [R(left.x + 16, left.y + 56 + n * rh_, left.w - 32, rh_ - 4), row]);
    const r_start = R(right.x + 20, right.bottom - 136, right.w - 40, 60), r_back = R(right.x + 20, right.bottom - 66, right.w - 40, 46);
    let codes = (host ? lobby.codes : (info || {}).codes) || [['Netzwerk', (info || {}).code || '', '']]; codes = codes.slice(0, 3);
    const copy_rects = codes.map((c, n) => [R(right.right - 120, right.y + 52 + n * 72, 100, 32), c[1]]);
    for (const ev of evs) {
      if (handle_common(ev)) continue;
      if (ev.type === 'key' && ev.key === 'Escape') return 'back';
      if (ev.type === 'down' && ev.button === 1) {
        if (r_back.collidepoint(ev.pos)) return 'back';
        for (const [r, c] of copy_rects) if (r.collidepoint(ev.pos) && c) { this.copied_code = c; this.copied_at = -Date.now() / 1000; App.copy(c).then(ok => { this.copied_at = (ok ? 1 : -1) * Date.now() / 1000; }); }
        if (host && r_start.collidepoint(ev.pos)) { lobby.start(); return 'start'; }
        if (host) for (const [r, [, key, typ, opt]] of row_rects) {
          const vr = R(r.x + r.w * 0.42, r.y, r.w * 0.58, r.h); if (!vr.collidepoint(ev.pos)) continue;
          if (typ === 'toggle') settings[key] = !settings[key];
          else if (typ === 'num') { const [step, lo, hi] = opt, d = ev.pos[0] < vr.centerx ? -step : step; settings[key] = Math.max(lo, Math.min(hi, settings[key] + d)); }
          else { const i = opt.findIndex(o => same(o[0], settings[key])), [v, lb] = opt[(i + 1) % opt.length]; settings[key] = v; if (key === 'map') settings.map_label = lb; }
        }
      }
    }
    draw_background(gfx, sw, sh);
    let t = gfx.txt('Lobby', 54, GOLD, true); blit(t, t.get_rect({ center: [sw >> 1, 58] }));
    gfx.panel(left, 215, 16); blit(gfx.txt('Einstellungen', 28, TEXT, true), [left.x + 18, left.y + 14]);
    if (!host) { t = gfx.txt('nur der Host kann ändern', 18, DIM); blit(t, [left.right - 18 - t.get_width(), left.y + 22]); }
    if (!settings) blit(gfx.txt('Verbinde ...', 26, DIM), [left.x + 18, left.y + 70]);
    for (const [r, [lab, key, typ, opt]] of row_rects) {
      { const tl = gfx.txt(lab, 21, TEXT); blit(tl, [r.x + 4, r.y + ((r.h - tl.h) >> 1)]); }
      const vr = R(r.x + r.w * 0.42, r.y, r.w * 0.58, r.h), hov = host && vr.collidepoint(mx, my), val = settings[key];
      if (typ === 'toggle') { let col = val ? [58, 140, 86] : [120, 60, 56]; if (hov) col = lerp_col(col, [255, 255, 255], 0.12); draw.rect(col, vr, 0, 8); t = gfx.txt(val ? 'An' : 'Aus', 21, [255, 255, 255], true); }
      else if (typ === 'num') { draw.rect(hov ? [40, 46, 62] : [32, 37, 50], vr, 0, 8); t = gfx.txt(host ? `-     ${val}     +` : String(val), 22, TEXT, true); }
      else {
        draw.rect(hov ? [40, 46, 62] : [32, 37, 50], vr, 0, 8);
        const o = opt.find(o => same(o[0], val)); const label = o ? o[1] : (settings.map_label || String(val));
        t = gfx.txt(label, 20, TEXT); if (t.get_width() > vr.w - 16) t = gfx.txt(label.split(' - ')[0], 20, TEXT);
      }
      draw.rect([70, 78, 100], vr, 1, 8); blit(t, t.get_rect({ center: vr.center }));
    }
    gfx.panel(right, 215, 16);
    blit(gfx.txt(codes.length === 1 ? 'Spiel-Code' : 'Spiel-Codes', 24, DIM, true), [right.x + 20, right.y + 16]);
    codes.forEach(([lab, c, ip], n) => {
      const yy = right.y + 44 + n * 72, sub = lab + (ip ? `  ·  IP ${ip}` : ''), lc = (lab === 'Online' || lab === 'Internet') ? GREEN : (lab !== 'WLAN / LAN' ? [150, 200, 255] : DIM);
      blit(gfx.txt(sub, 18, lc, true), [right.x + 20, yy]); blit(gfx.txt(c || '...', 40, GOLD, true), [right.x + 20, yy + 20]);
    });
    const now = Date.now() / 1000;
    for (const [r, c] of copy_rects) {
      gfx.button(r, 'Kopieren', { size: 19, hover: r.collidepoint(mx, my) });
      if (c && c === this.copied_code && Math.abs(now - Math.abs(this.copied_at)) < 2.5) { t = gfx.txt(this.copied_at > 0 ? 'Kopiert!' : 'Bitte abschreiben', 18, this.copied_at > 0 ? GREEN : ACCENT, true); blit(t, [r.centerx - (t.get_width() >> 1), r.bottom + 2]); }
    }
    let hint;
    if (host) {
      const rel = lobby.relay, dots = rel.state === 'busy' ? '.'.repeat(trunc(now * 2) % 4) : '';
      hint = [rel.status + dots];
      if (rel.state === 'ok') hint.push('Den Online-Code an Freunde schicken - klappt überall, auch mit der PC-Version.', 'Läuft über einen kostenlosen öffentlichen Server: nichts Privates in den Chat schreiben.');
      else if (rel.state === 'fail') hint.push('Ohne Online-Server kannst du hier nur allein gegen Bots spielen. Online geht, wenn die Seite von deiner eigenen Adresse läuft (z. B. GitHub Pages).');
    } else hint = ['Warte, bis der Host das Spiel startet.'];
    const hy = right.y + 50 + codes.length * 72, wrapped = [];
    hint.forEach((line, n) => {
      const first = n === 0 && host, f = gfx.font(17, first); let cur = '';
      for (const w_ of line.split(' ')) { const test = (cur + ' ' + w_).trim(); if (f.size(test)[0] > right.w - 40 && cur) { wrapped.push([cur, first]); cur = w_; } else cur = test; }
      wrapped.push([cur, first]);
    });
    wrapped.forEach(([line, first], n) => { let c_ = DIM; if (first) c_ = { ok: GREEN, fail: [240, 170, 90] }[lobby.relay.state] || [150, 200, 255]; blit(gfx.txt(line, 17, c_, first), [right.x + 20, hy + n * 19]); });
    let y = hy + wrapped.length * 19 + 14;
    blit(gfx.txt(`Spieler (${names.length})`, 24, TEXT, true), [right.x + 20, y]); y += 34;
    names.slice(0, 12).forEach((nm, n) => { draw.circle(player_color(n + 1), [right.x + 30, y + 11], 6); blit(gfx.txt(nm + (n === 0 ? '  (Host)' : ''), 21, TEXT), [right.x + 46, y]); y += 28; });
    if (host) big_button(gfx, r_start, 'Starten', [60, 160, 96], mx, my, 34);
    else { t = gfx.txt('Warte auf den Host' + '.'.repeat(trunc(now * 2) % 4), 26, TEXT, true); blit(t, t.get_rect({ center: r_start.center })); }
    gfx.button(r_back, 'Zurück zum Menü', { size: 22, hover: r_back.collidepoint(mx, my) });
  }
}

// ---------------------------------------------------------------------------
// Karteneditor
// ---------------------------------------------------------------------------
class EditorScreen {
  constructor(gfx) {
    this.gfx = gfx; this.need = [1000, 680];
    this.terrain = gen_map(randrange(1 << 30), 'welt'); this.cam = new Camera(); this.fitted = false;
    this.tool = 'land'; this.brush = 5; this.undo = []; this.name = 'meine_karte'; this.name_focus = false;
    this.status = 'Willkommen im Karteneditor! Wähle rechts ein Werkzeug oder eine Vorlage.'; this.load_idx = 0;
    this.painting = null; this.panning = false; this.last_paint = null; this.dirty = true; this.surf = null; this.SIDE = 330;
  }
  push_undo() { this.undo.push(Uint8Array.from(this.terrain)); if (this.undo.length > 30) this.undo.shift(); }
  paint(tx, ty, val) {
    const r = this.brush, t = this.terrain;
    for (let yy = trunc(ty) - r; yy < trunc(ty) + r + 1; yy++) for (let xx = trunc(tx) - r; xx < trunc(tx) + r + 1; xx++)
      if (xx >= 0 && xx < W && yy >= 0 && yy < H && (xx - tx + 0.5) ** 2 + (yy - ty + 0.5) ** 2 <= r * r + r) t[yy * W + xx] = val;
  }
  paint_line(a, b, val) { const [x0, y0] = a, [x1, y1] = b, steps = Math.max(1, trunc(Math.hypot(x1 - x0, y1 - y0) / Math.max(1, this.brush * 0.5))); for (let k = 0; k <= steps; k++) { const f = k / steps; this.paint(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, val); } }
  flood(tx, ty) {
    const t = this.terrain, i0 = trunc(ty) * W + trunc(tx), src = t[i0], dst = src !== WATER ? WATER : NEUTRAL, q = [i0]; t[i0] = dst;
    for (let k = 0; k < q.length; k++) { const i = q[k]; for (let m = 0; m < 4; m++) { const j = NEIGH[i * 4 + m]; if (j >= 0 && t[j] === src) { t[j] = dst; q.push(j); } } }
    return q.length;
  }
  stamp(tx, ty) {
    const r = this.brush * 2.5 + 4, harm = [0, 1, 2, 3].map(() => [uniform(0.1, 0.3), 2 + randrange(5), uniform(0, 6.3)]);
    for (let yy = trunc(ty - r * 1.5); yy <= trunc(ty + r * 1.5); yy++) for (let xx = trunc(tx - r * 1.5); xx <= trunc(tx + r * 1.5); xx++) {
      if (!(xx >= 0 && xx < W && yy >= 0 && yy < H)) continue;
      const dx = xx - tx, dy = yy - ty, ang = Math.atan2(dy, dx), rr = r * (1 + harm.reduce((s, [a, f, p]) => s + a * Math.sin(f * ang + p), 0));
      if (dx * dx + dy * dy <= rr * rr) this.terrain[yy * W + xx] = NEUTRAL;
    }
  }
  smooth() {
    const old = Uint8Array.from(this.terrain), t = this.terrain;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; let land = 0; for (const j of [i - W - 1, i - W, i - W + 1, i - 1, i, i + 1, i + W - 1, i + W, i + W + 1]) if (old[j] !== WATER) land++; t[i] = land >= 5 ? NEUTRAL : WATER; }
  }
  mirror_lr() { const t = this.terrain; for (let y = 0; y < H; y++) { const row = y * W; for (let x = W >> 1; x < W; x++) t[row + x] = t[row + (W - 1 - x)]; } }
  mirror_tb() { const t = this.terrain; for (let y = H >> 1; y < H; y++) t.set(t.subarray((H - 1 - y) * W, (H - y) * W), y * W); }
  border() { const t = this.terrain; for (let i = 0; i < W * H; i++) { const x = i % W, y = trunc(i / W); if (x < 3 || y < 3 || x >= W - 3 || y >= H - 3) t[i] = WATER; } }
  land_share() { let n = 0; for (const v of this.terrain) if (v === WATER) n++; return 100 * (W * H - n) / (W * H); }
  frame(evs, dt) {
    const gfx = this.gfx, SIDE = this.SIDE, sw = App.sw, sh = App.sh, vw = sw - SIDE, vh = sh - 54;
    this.cam.set_view(vw, vh); if (!this.fitted) { this.cam.fit(); this.fitted = true; } this.cam.update(dt);
    const mx = App.mx, my = App.my, in_map = mx < vw && my < vh; let [tx, ty] = this.cam.to_tile(mx, my); const space = App.keys.has('Space');
    const x0 = vw + 14, bw = SIDE - 28, half = (bw - 6) >> 1, buttons = [], labels = [];
    const size_lab = (MAP_SIZES.find(([, , w_, h_]) => w_ === W && h_ === H) || [0, `${W} x ${H}`])[1];
    buttons.push([R(x0, 72, bw, 28), 'Größe: ' + size_lab, ['size', null], false]);
    let y = 128; labels.push(['Werkzeuge', y - 18]);
    for (const [key, lab] of [['land', 'Land malen'], ['water', 'Wasser malen'], ['fill', 'Füllen (Fläche umdrehen)'], ['island', 'Insel-Stempel']]) { buttons.push([R(x0, y, bw, 30), lab, ['tool', key], this.tool === key]); y += 34; }
    y += 26; labels.push(['Vorlagen', y - 18]);
    [['welt', 'Weltkarte'], ['kontinente', 'Kontinente'], ['inseln', 'Inseln'], ['pangaea', 'Pangäa'], ['archipel', 'Archipel'], ['wasser', 'Alles Wasser'], ['land', 'Alles Land']].forEach(([key, lab], k) => buttons.push([R(x0 + (k % 2) * (half + 6), y + (k >> 1) * 34, half, 30), lab, ['preset', key], false]));
    y += 4 * 34 + 26; labels.push(['Hilfen', y - 18]);
    [['Glätten', 'smooth'], ['Wasser-Rand', 'border'], ['Spiegeln L > R', 'mlr'], ['Spiegeln O > U', 'mtb'], ['Rückgängig', 'undo'], ['Pinsel -', 'bminus'], ['Pinsel +', 'bplus']].forEach(([lab, key], k) => buttons.push([R(x0 + (k % 2) * (half + 6), y + (k >> 1) * 34, half, 30), lab, ['help', key], false]));
    y += 4 * 34 + 22; const r_name = R(x0, y, bw, 32); labels.push(['Name der Karte', y - 18]); y += 40;
    this.name = App.live('mapname', this.name);
    buttons.push([R(x0, y, half, 34), 'Speichern', ['save', null], false]);
    const saved = list_saved_maps(), load_lab = saved.length ? 'Laden: ' + saved[this.load_idx % saved.length] : 'Laden (keine)';
    buttons.push([R(x0 + half + 6, y, half, 34), load_lab.slice(0, 18), ['load', null], false]); y += 40;
    buttons.push([R(x0, y, bw, 34), 'Zurück zum Menü', ['back', null], false]);

    for (const ev of evs) {
      if (handle_common(ev)) continue;
      if (ev.type === 'wheel' && in_map) this.cam.zoom_at(mx, my, 1.2 ** ev.y);
      else if (ev.type === 'pan') this.cam.pan(...ev.rel);
      else if (ev.type === 'down') {
        if (ev.button === 1 && !in_map) {
          this.name_focus = r_name.collidepoint(ev.pos);
          for (const [r, lab, [kind, key]] of buttons) {
            if (!r.collidepoint(ev.pos)) continue;
            if (kind === 'tool') { this.tool = key; this.status = { land: 'Linke Maus malt Land, rechte Maus Wasser.', water: 'Linke Maus malt Wasser, rechte Maus Land.', fill: 'Klicke auf eine Fläche: Land wird Wasser und umgekehrt.', island: 'Klicke ins Meer, um eine zufällige Insel zu setzen.' }[key] + (App.isTouch ? ' (Lange drücken = Gegenteil, zwei Finger = verschieben)' : ''); }
            else if (kind === 'size') {
              const keys_ = MAP_SIZES.map(s => s[0]), nk = keys_[(keys_.indexOf(size_key()) + 1) % keys_.length];
              set_map_size(...SIZE_BY_KEY[nk]); this.terrain = gen_map(randrange(1 << 30), 'welt'); this.undo = []; this.cam = new Camera(); this.fitted = false;
              this.status = `Kartengröße: ${W} x ${H}. Mehr Felder = feinere Pixel. (Rückgängig geleert)`;
            } else if (kind === 'preset') { this.push_undo(); this.terrain = gen_map(randrange(1 << 30), key); this.status = `Vorlage '${lab}' geladen. Klick nochmal für eine andere Variante.`; }
            else if (kind === 'help') {
              if (key === 'undo') { if (this.undo.length) { this.terrain = this.undo.pop(); this.status = 'Rückgängig gemacht.'; } }
              else if (key === 'bminus') this.brush = Math.max(1, this.brush - 1);
              else if (key === 'bplus') this.brush = Math.min(25, this.brush + 1);
              else { this.push_undo(); ({ smooth: () => this.smooth(), border: () => this.border(), mlr: () => this.mirror_lr(), mtb: () => this.mirror_tb() })[key](); this.status = { smooth: 'Küsten geglättet.', border: 'Wasser-Rand gesetzt.', mlr: 'Linke Hälfte nach rechts gespiegelt (faire Karte!).', mtb: 'Obere Hälfte nach unten gespiegelt.' }[key]; }
            } else if (kind === 'save') {
              const clean = [...this.name].filter(c => /[\p{L}\p{N}_-]/u.test(c)).join('').trim() || 'karte';
              if (this.land_share() < 5) this.status = 'Zu wenig Land! Mindestens 5 % brauchst du.';
              else this.status = save_map_file(clean, this.terrain) ? `Gespeichert als '${clean}'. In der Lobby unter Karte auswählbar.` : 'Speichern fehlgeschlagen: Browser-Speicher ist voll.';
            } else if (kind === 'load') {
              if (saved.length) {
                const nm = saved[this.load_idx % saved.length];
                try { this.push_undo(); const old = [W, H]; this.terrain = load_map_file(nm); if (old[0] !== W || old[1] !== H) { this.undo = []; this.cam = new Camera(); this.fitted = false; } this.name = nm; this.status = `'${nm}' geladen. Nochmal klicken = nächste Karte.`; }
                catch (e) { this.status = `Fehler beim Laden: ${e.message}`; }
                this.load_idx++;
              }
            } else if (kind === 'back') return 'menu';
            this.dirty = true;
          }
        } else if (in_map && (ev.button === 2 || (ev.button === 1 && space))) this.panning = true;
        else if (in_map && (ev.button === 1 || ev.button === 3)) {
          this.name_focus = false;
          if (this.tool === 'land' || this.tool === 'water') {
            this.push_undo(); const base = this.tool === 'land' ? NEUTRAL : WATER;
            this.painting = ev.button === 1 ? base : (base === NEUTRAL ? WATER : NEUTRAL); this.paint(tx, ty, this.painting); this.last_paint = [tx, ty];
          } else if (tx >= 0 && tx < W && ty >= 0 && ty < H) { this.push_undo(); if (this.tool === 'fill') this.status = `${this.flood(tx, ty)} Felder umgedreht.`; else this.stamp(tx, ty); }
          this.dirty = true;
        }
      } else if (ev.type === 'up') { this.painting = null; this.panning = false; }
      else if (ev.type === 'move') {
        if (this.panning) this.cam.pan(...ev.rel);
        else if (this.painting !== null) { this.paint_line(this.last_paint, [tx, ty], this.painting); this.last_paint = [tx, ty]; this.dirty = true; }
      } else if (ev.type === 'key') {
        if (this.name_focus) { if (ev.key === 'Enter') this.name_focus = false; continue; }
        if (ev.key === 'z' && ev.ctrl) { if (this.undo.length) { this.terrain = this.undo.pop(); this.dirty = true; } }
        else if (ev.key === '[' || ev.key === '-') this.brush = Math.max(1, this.brush - 1);
        else if (ev.key === ']' || ev.key === '+') this.brush = Math.min(25, this.brush + 1);
        else if (ev.key === 'Escape') return 'menu';
      }
    }
    if (!this.name_focus) { const k = App.keys, step = 900 * dt; this.cam.pan(((k.has('ArrowLeft') ? 1 : 0) - (k.has('ArrowRight') ? 1 : 0)) * step, ((k.has('ArrowUp') ? 1 : 0) - (k.has('ArrowDown') ? 1 : 0)) * step); }
    if (this.dirty || !this.surf || this.surf.width !== W) {
      if (!this.surf || this.surf.width !== W || this.surf.height !== H) { this.surf = mkCanvas(W, H); this.sc = this.surf.getContext('2d'); this.simg = this.sc.createImageData(W, H); }
      const d = this.simg.data, t = this.terrain;
      for (let i = 0; i < W * H; i++) { const c = t[i] === WATER ? WATER_SHALLOW : EDIT_LAND; d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255; }
      this.sc.putImageData(this.simg, 0, 0); this.dirty = false; this.ver = (this.ver || 0) + 1;
    }
    const cam = this.cam;
    draw.rect([12, 18, 30], R(0, 0, sw, sh));
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, vw, vh); ctx.clip();
    const [sx0, sy0] = cam.to_screen(0, 0), [sx1, sy1] = cam.to_screen(W, H);
    if (SMOOTH_MAP && cam.z >= 1.2) { if (this.dirtyS !== this.ver + ':' + upscale_steps(W, cam.z, sx1 - sx0)) { const d32 = new Uint32Array(this.simg.data.buffer.slice(0)); this.scv = smooth_canvas(d32, W, 0, 0, W, H, cam.z, sx1 - sx0); this.dirtyS = this.ver + ':' + upscale_steps(W, cam.z, sx1 - sx0); } ctx.imageSmoothingEnabled = this.scv.width > (sx1 - sx0) * 1.2; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(this.scv, sx0, sy0, sx1 - sx0, sy1 - sy0); }
    else { ctx.imageSmoothingEnabled = false; ctx.drawImage(this.surf, sx0, sy0, sx1 - sx0, sy1 - sy0); }
    draw.rect([200, 205, 225], R(sx0, sy0, sx1 - sx0, sy1 - sy0), 1);
    if (in_map && !space) {
      if (this.tool === 'land' || this.tool === 'water') draw.circle([255, 255, 255], [mx, my], Math.max(2, this.brush * cam.z), 1);
      else if (this.tool === 'island') draw.circle([255, 255, 160], [mx, my], Math.max(3, (this.brush * 2.5 + 4) * cam.z), 1);
    }
    ctx.restore();
    draw.rect([20, 23, 32], R(vw, 0, SIDE, sh));
    blit(gfx.txt('Karteneditor', 34, GOLD, true), [x0, 12]);
    blit(gfx.txt(`Land: ${Math.round(this.land_share())} %    Pinsel: ${this.brush}    ${W} x ${H}`, 22), [x0, 46]);
    for (const [lab, ly] of labels) blit(gfx.txt(lab, 19, DIM), [x0, ly]);
    for (const [r, lab, , active] of buttons) gfx.button(r, lab, { active, size: 20, hover: r.collidepoint(mx, my) });
    this.name = text_box(gfx, 'mapname', r_name, this.name, this.name_focus, 24, 24);
    draw.rect([16, 18, 26], R(0, vh, vw, 54));
    blit(gfx.txt(this.status, 21, [225, 230, 240]), [12, vh + 6]);
    blit(gfx.txt(App.isTouch ? 'Finger: Werkzeug   Lange drücken: Gegenteil   Zwei Finger: zoomen und verschieben' : 'Linke Maus: Werkzeug   Rechte Maus: Gegenteil   Mausrad: Zoom   Leertaste+Ziehen / Pfeile: verschieben   Strg+Z: zurück   +/-: Pinsel   F11: Vollbild', 19, DIM), [12, vh + 30]);
  }
}

// ---------------------------------------------------------------------------
// Waffen-Werkstatt (Stil wie der Einheiten-Editor in TABS)
// ---------------------------------------------------------------------------
class WeaponsScreen {
  constructor(gfx) {
    this.gfx = gfx; this.need = [1180, 800]; this.designs = load_designs();
    Object.assign(this, { kind: 'tank', color: 'T', tool: 'pen', mirror: true, view: 'edit', preview_team: 0, undo: [], painting: null, name_focus: false, t_start: performance.now() / 1000,
      status: 'Wähle links eine Waffe, male sie in der Mitte und verteile rechts die Punkte.' });
    this.team_cols = [[214, 62, 52], [70, 130, 230], [70, 170, 96], [240, 184, 46]];
    this.PAL_ORDER = ['T', 't', 'k', 'g', 'G', 'w', 'r', 'o', 'y', 'e', 'b', 'c', 'n', '.']; this.PAL_NAMES = { T: 'Teamfarbe hell', t: 'Teamfarbe dunkel', '.': 'Radierer' };
    this.GROUPS = [['Fahrzeuge', ['tank', 'jet', 'ship']], ['Bomben', ['small', 'big', 'mirv']]];
  }
  grid() { return this.designs[this.kind].sprite.map(r => [...r]); }
  set_grid(g) { this.designs[this.kind].sprite = g.map(r => r.join('')); }
  push() { this.undo.push([this.kind, this.designs[this.kind].sprite.slice()]); if (this.undo.length > 40) this.undo.shift(); }
  paint(cx, cy, ch) { const g = this.grid(); g[cy][cx] = ch; if (this.mirror) g[SPRITE_N - 1 - cy][cx] = ch; this.set_grid(g); }
  fill(cx, cy, ch) { const g = this.grid(), src = g[cy][cx]; if (src === ch) return; const q = [[cx, cy]]; while (q.length) { const [x, y] = q.pop(); if (x >= 0 && x < SPRITE_N && y >= 0 && y < SPRITE_N && g[y][x] === src) { g[y][x] = ch; q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); } } this.set_grid(g); }
  points_left(k) { return STAT_BUDGET - Object.values(this.designs[k || this.kind].stats).reduce((a, b) => a + b, 0); }
  layout(sw, sh) {
    const L = {}, kind = this.kind; L.left = R(20, 90, 240, sh - 110); const cards = []; let y = L.left.y + 14;
    for (const [gname, kinds] of this.GROUPS) { cards.push(['head', gname, y]); y += 30; for (const k of kinds) { cards.push(['card', k, R(L.left.x + 12, y, L.left.w - 24, 66)]); y += 72; } y += 6; }
    L.cards = cards; const right_w = Math.max(380, Math.min(480, sw - 840)); L.right = R(sw - right_w - 20, 90, right_w, sh - 110);
    const c = L.center = R(L.left.right + 20, 90, L.right.x - L.left.right - 40, sh - 110);
    L.tab_edit = R(c.x + 16, c.y + 14, 170, 38); L.tab_prev = R(c.x + 194, c.y + 14, 170, 38);
    const cell = Math.max(12, Math.min(32, trunc(Math.min(c.w - 80, c.h - 150) / SPRITE_N))); L.cell = cell;
    L.grid = R(c.centerx - trunc(cell * SPRITE_N / 2), c.y + 76, cell * SPRITE_N, cell * SPRITE_N);
    L.teams = this.team_cols.map((_, n) => R(c.x + 16 + n * 46, c.bottom - 54, 38, 38));
    const r = L.right, x0 = r.x + 18, w0 = r.w - 36; L.name = R(x0, r.y + 40, w0, 38); const sw_ = 30;
    L.pal = this.PAL_ORDER.map((ch, n) => [ch, R(x0 + (n % 7) * (sw_ + 8), r.y + 112 + trunc(n / 7) * (sw_ + 8), sw_, sw_)]);
    y = r.y + 112 + 2 * (sw_ + 8) + 10; const third = trunc((w0 - 16) / 3);
    L.tools = ['pen', 'fill', 'mirror'].map((name, n) => [name, R(x0 + n * (third + 8), y, third, 30)]); y += 38;
    L.acts = ['tpl', 'clear', 'undo'].map((name, n) => [name, R(x0 + n * (third + 8), y, third, 30)]); y += 56;
    L.stats_y = y; L.stats = DESIGN_STATS[kind].map(([key, lab, info], n) => { const yy = y + 28 + n * 62; return [key, lab, info, R(r.right - 18 - 80, yy, 36, 32), R(r.right - 18 - 38, yy, 36, 32), yy]; });
    y += 28 + DESIGN_STATS[kind].length * 62 + 8; L.use = R(x0, y, w0, 34); const half = trunc((w0 - 8) / 2);
    L.save = R(x0, r.bottom - 62, half, 46); L.back = R(x0 + half + 8, r.bottom - 62, half, 46); L.kind = kind;
    return L;
  }
  frame(evs) {
    const gfx = this.gfx, sw = App.sw, sh = App.sh, mx = App.mx, my = App.my, designs = this.designs;
    const L = this.layout(sw, sh), cell = L.cell, G = L.grid;
    const cell_at = p => (this.view !== 'edit' || !G.collidepoint(p)) ? null : [trunc((p[0] - G.x) / cell), trunc((p[1] - G.y) / cell)];
    designs[this.kind].name = App.live('wname', designs[this.kind].name);
    for (const ev of evs) {
      if (handle_common(ev)) continue;
      if (ev.type === 'key') {
        if (this.name_focus) { if (ev.key === 'Enter') this.name_focus = false; continue; }
        if (ev.key === 'Escape') { save_designs(designs); return 'menu'; }
        if (ev.key === 'z' && ev.ctrl && this.undo.length) { const [k_, spr] = this.undo.pop(); designs[k_].sprite = spr; }
        if (ev.key === 'Tab') this.view = this.view === 'edit' ? 'preview' : 'edit';
      } else if (ev.type === 'down') {
        if (ev.button === 1) this.name_focus = L.name.collidepoint(ev.pos);
        const c = cell_at(ev.pos);
        if (c && (ev.button === 1 || ev.button === 3)) {
          this.push(); const ch = ev.button === 1 ? this.color : '.';
          if (this.tool === 'fill' && ev.button === 1) this.fill(c[0], c[1], ch); else { this.paint(c[0], c[1], ch); this.painting = ch; }
          continue;
        }
        if (ev.button !== 1) continue;
        for (const item of L.cards) if (item[0] === 'card' && item[2].collidepoint(ev.pos)) { this.kind = item[1]; this.status = `${DESIGN_NAMES[this.kind]}: schaut nach rechts (vorne).`; }
        if (L.tab_edit.collidepoint(ev.pos)) this.view = 'edit'; else if (L.tab_prev.collidepoint(ev.pos)) this.view = 'preview';
        L.teams.forEach((r, n) => { if (r.collidepoint(ev.pos)) this.preview_team = n; });
        for (const [ch, r] of L.pal) if (r.collidepoint(ev.pos)) { this.color = ch; this.view = 'edit'; }
        for (const [name, r] of L.tools) if (r.collidepoint(ev.pos)) { if (name === 'mirror') this.mirror = !this.mirror; else this.tool = name; }
        for (const [name, r] of L.acts) {
          if (!r.collidepoint(ev.pos)) continue;
          if (name === 'tpl') { this.push(); designs[this.kind].sprite = DEFAULT_SPRITES[this.kind].slice(); this.status = 'Vorlage geladen.'; }
          else if (name === 'clear') { this.push(); designs[this.kind].sprite = Array(SPRITE_N).fill('.'.repeat(SPRITE_N)); this.status = 'Alles gelöscht - jetzt neu malen!'; }
          else if (name === 'undo' && this.undo.length) { const [k_, spr] = this.undo.pop(); designs[k_].sprite = spr; }
        }
        if (L.use.collidepoint(ev.pos)) designs[this.kind].use = !designs[this.kind].use;
        else if (L.save.collidepoint(ev.pos)) { save_designs(designs); this.status = 'Gespeichert! Beim nächsten Spiel sind deine Waffen dabei.'; }
        else if (L.back.collidepoint(ev.pos)) { save_designs(designs); return 'menu'; }
        if (L.kind === this.kind) for (const [key, , , rm, rp] of L.stats) {
          const st_ = designs[this.kind].stats;
          if (rm.collidepoint(ev.pos) && st_[key] > STAT_MIN) st_[key]--;
          else if (rp.collidepoint(ev.pos)) { if (st_[key] >= STAT_MAX) this.status = `Höchstens ${STAT_MAX} Punkte pro Wert.`; else if (this.points_left() <= 0) this.status = 'Keine Punkte mehr übrig - erst woanders einen Punkt wegnehmen.'; else st_[key]++; }
        }
      } else if (ev.type === 'up') this.painting = null;
      else if (ev.type === 'move' && this.painting !== null) { const c = cell_at(ev.pos); if (c) this.paint(c[0], c[1], this.painting); }
    }
    if (L.kind !== this.kind) return;
    const kind = this.kind, tc = this.team_cols[this.preview_team], now = performance.now() / 1000;
    draw_background(gfx, sw, sh, 200);
    blit(gfx.txt('WAFFEN-WERKSTATT', 44, GOLD, true), [24, 26]); blit(gfx.txt('Baue eigene Fahrzeuge und Bomben - alle Mitspieler sehen sie so!', 20, DIM), [440, 44]);
    gfx.panel(L.left, 225, 16);
    for (const item of L.cards) {
      if (item[0] === 'head') { blit(gfx.txt(item[1].toUpperCase(), 18, DIM, true), [L.left.x + 16, item[2] + 4]); continue; }
      const k = item[1], r = item[2], sel = k === kind, hov = r.collidepoint(mx, my);
      draw.rect(sel ? [66, 74, 104] : (hov ? [46, 52, 72] : [34, 39, 54]), r, 0, 12); draw.rect(sel ? GOLD : [60, 66, 88], r, sel ? 3 : 1, 12);
      draw.circle([24, 28, 40], [r.x + 36, r.centery], 28); blitRot(gfx.skin_model(designs[k].sprite.join(''), 52, tc), r.x + 36, r.centery, 0);
      blit(gfx.txt(designs[k].name.slice(0, 14), 19, TEXT, true), [r.x + 74, r.y + 12]);
      blit(gfx.txt(DESIGN_STATS[k].map(([key, lab]) => `${lab.slice(0, 5)} ${designs[k].stats[key]}`).join('  '), 15, DIM), [r.x + 74, r.y + 36]);
      if (!designs[k].use) blit(gfx.txt('aus', 14, ACCENT, true), [r.right - 32, r.y + 8]);
    }
    const c = L.center; gfx.panel(c, 215, 16);
    for (const [key_, lab, r] of [['edit', 'Bearbeiten', L.tab_edit], ['preview', '3D-Vorschau', L.tab_prev]]) gfx.button(r, lab, { active: this.view === key_, size: 22, hover: r.collidepoint(mx, my) });
    if (!App.isTouch) { const t = gfx.txt('Tab = umschalten', 16, DIM); blit(t, [c.right - t.w - 16, c.y + 26]); }
    const spr = designs[kind].sprite.join('');
    if (this.view === 'edit') {
      draw.rect([20, 22, 30], G.inflate(10, 10), 0, 6); const g = this.grid();
      for (let yy = 0; yy < SPRITE_N; yy++) for (let xx = 0; xx < SPRITE_N; xx++) {
        const ch = g[yy][xx]; const col_ = ch === '.' ? ((xx + yy) % 2 ? [58, 62, 74] : [48, 52, 64]) : (ch === 'T' ? tc : (ch === 't' ? dark(tc, 0.62) : SPRITE_PAL[ch]));
        draw.rect(col_, R(G.x + xx * cell, G.y + yy * cell, cell, cell));
      }
      for (let k = 0; k <= SPRITE_N; k++) { const col_ = k % 4 ? [86, 92, 108] : [128, 134, 154]; draw.line(col_, [G.x + k * cell + .5, G.y], [G.x + k * cell + .5, G.bottom]); draw.line(col_, [G.x, G.y + k * cell + .5], [G.right, G.y + k * cell + .5]); }
      if (this.mirror) draw.line(GOLD, [G.x - 8, G.y + 8 * cell], [G.right + 8, G.y + 8 * cell], 2);
      const cc = cell_at([mx, my]); if (cc) draw.rect([255, 255, 255], R(G.x + cc[0] * cell, G.y + cc[1] * cell, cell, cell), 2);
      blit(gfx.txt('vorne >', 20, GOLD, true), [G.right + 12, G.centery - 10]);
    } else {
      // Podest mit sich drehender Waffe (wie in TABS)
      const pcx = c.centerx, pcy = c.y + c.h * 0.62;
      [[0.62, [40, 44, 58]], [0.56, [70, 76, 96]], [0.5, [96, 104, 128]]].forEach(([rw_, col_], k) => { const w_ = trunc(c.w * rw_); draw.ellipse(col_, [pcx - (w_ >> 1), pcy - w_ * 0.12 + k * 4, w_, trunc(w_ * 0.26)]); });
      const ang = (now - this.t_start) * 45, size = trunc(Math.min(c.w * 0.5, c.h * 0.5)), bob = Math.sin(now * 2) * 6;
      blitRot(gfx.skin_model(spr, size, [0, 0, 0], true), pcx + 8, pcy + 4, ang, 70 / 255);
      blitRot(gfx.skin_model(spr, size, tc), pcx, pcy - size * 0.28 + bob, ang);
      let t = gfx.txt(designs[kind].name, 34, TEXT, true); blit(t, t.get_rect({ center: [c.centerx, c.y + 90] }));
      t = gfx.txt(DESIGN_NAMES[kind], 20, DIM); blit(t, t.get_rect({ center: [c.centerx, c.y + 122] }));
    }
    blit(gfx.txt('Teamfarbe:', 16, DIM), [c.x + 16, L.teams[0].y - 20]);
    L.teams.forEach((r, n) => { draw.rect(this.team_cols[n], r, 0, 8); draw.rect(n === this.preview_team ? [255, 255, 255] : [20, 20, 26], r, n === this.preview_team ? 3 : 1, 8); });
    blit(gfx.txt(this.status, 18, [225, 230, 240]), [L.teams[L.teams.length - 1].right + 20, L.teams[0].y + 10]);
    const r = L.right, x0 = r.x + 18; gfx.panel(r, 225, 16);
    blit(gfx.txt('NAME', 16, DIM, true), [x0, r.y + 18]); designs[kind].name = text_box(gfx, 'wname', L.name, designs[kind].name, this.name_focus, 23, 16);
    blit(gfx.txt('FARBEN', 16, DIM, true), [x0, r.y + 90]);
    for (const [ch, rr] of L.pal) {
      if (ch === '.') { draw.rect([60, 64, 76], rr, 0, 6); draw.line([230, 80, 70], [rr.x + 4, rr.y + 4], [rr.right - 4, rr.bottom - 4], 3); }
      else if (ch === 'T' || ch === 't') { draw.rect(ch === 'T' ? tc : dark(tc, 0.62), rr, 0, 6); const tt = gfx.txt('T', 16, [255, 255, 255], true); blit(tt, tt.get_rect({ center: rr.center })); }
      else draw.rect(SPRITE_PAL[ch], rr, 0, 6);
      draw.rect(ch === this.color ? GOLD : [24, 24, 30], rr, ch === this.color ? 3 : 1, 6);
    }
    const hov = (L.pal.find(([, rr]) => rr.collidepoint(mx, my)) || [null])[0];
    if (hov in this.PAL_NAMES) { const t = gfx.txt(this.PAL_NAMES[hov], 16, TEXT); blit(t, [r.right - 18 - t.w, r.y + 90]); }
    const names = { pen: 'Pinsel', fill: 'Füllen', mirror: 'Spiegeln', tpl: 'Vorlage', clear: 'Leeren', undo: 'Zurück' };
    for (const [name, rr] of L.tools) gfx.button(rr, names[name], { active: name !== 'mirror' ? this.tool === name : this.mirror, size: 19, hover: rr.collidepoint(mx, my) });
    for (const [name, rr] of L.acts) gfx.button(rr, names[name], { size: 19, hover: rr.collidepoint(mx, my) });
    const left = this.points_left(); blit(gfx.txt('WERTE', 16, DIM, true), [x0, L.stats_y]);
    let t = gfx.txt(`Punkte übrig: ${left}`, 18, left > 0 ? GREEN : DIM, true); blit(t, [r.right - 18 - t.w, L.stats_y]);
    for (const [key, lab, info, rm, rp, yy] of L.stats) {
      const v = designs[kind].stats[key]; blit(gfx.txt(lab, 21, TEXT, true), [x0, yy]);
      for (let k = 0; k < STAT_MAX; k++) draw.rect(k < v ? lerp_col(GOLD, ACCENT, k / 6) : [48, 52, 66], R(x0 + 130 + k * 20, yy + 5, 16, 16), 0, 4);
      blit(gfx.txt(info, 15, DIM), [x0, yy + 30]); gfx.button(rm, '-', { size: 24, hover: rm.collidepoint(mx, my) }); gfx.button(rp, '+', { size: 24, hover: rp.collidepoint(mx, my) });
    }
    const use = designs[kind].use;
    gfx.button(L.use, 'Im Spiel verwenden: ' + (use ? 'Ja' : 'Nein (Standard)'), { active: use, size: 19, hover: L.use.collidepoint(mx, my) });
    big_button(gfx, L.save, 'Speichern', [60, 160, 96], mx, my, 24); gfx.button(L.back, 'Zurück zum Menü', { size: 20, hover: L.back.collidepoint(mx, my) });
  }
}
