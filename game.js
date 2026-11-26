// FrontWars Web – Spiel-Client (Port von run_game aus FrontWars.py)
'use strict';

class GameScreen {
  constructor(gfx, net, host_info) {
    this.gfx = gfx; this.net = net; this.host_info = host_info; this.need = [1200, 600];
    Object.assign(this, { cam: new Camera(), view: null, seq: null, resync_at: 0, st: null, fitted: false, ratio: 0.3, terrain_view: false, show_help: false,
      chat_active: false, chat_text: '', action: null, menu: null, drag: null, units: new Map(), anims: [], ev_cache: [-1, []],
      players: new Map(), allies: new Set(), me: null, confirm_leave: false, skins: {}, via: 'auto', lost_at: 0, zoomed_me: false, lost_since: 0,
      view3d: null, gold_pops: [], gold_seen: new WeakSet(), rend3: new BlobRenderer('hd', 0.5), rend3b: new BlobRenderer('hd', 1.0) });
  }
  // ---------- Hilfen wie im Original ----------
  interp(uid, x, y, now) {
    const u = this.units.get(uid); if (!u) { this.units.set(uid, [x, y, x, y, now, 0.0]); return; }
    const [cx, cy] = this.upos(u, now); if (Math.abs(x - u[2]) + Math.abs(y - u[3]) > 0.001) u[5] = Math.atan2(y - cy, x - cx) * 180 / Math.PI;
    u[0] = cx; u[1] = cy; u[2] = x; u[3] = y; u[4] = now;
  }
  upos(u, now) { const f = Math.min(1.0, (now - u[4]) / TICK); return [u[0] + (u[2] - u[0]) * f, u[1] + (u[3] - u[1]) * f]; }
  spawn_ok(tile) {
    const own = this.view.owner; if (own[tile] !== NEUTRAL) return false;
    const x = tile % W, y = trunc(tile / W);
    for (let yy = Math.max(0, y - SPAWN_GAP); yy < Math.min(H, y + SPAWN_GAP + 1); yy++) for (let xx = Math.max(0, x - SPAWN_GAP); xx < Math.min(W, x + SPAWN_GAP + 1); xx++) { const o = own[yy * W + xx]; if (o !== NEUTRAL && o !== WATER && o !== this.me) return false; }
    return true;
  }
  bld_at(tile, dist = 1) { const x = tile % W, y = trunc(tile / W); for (const b of this.st.bld) if (Math.abs(b[0] % W - x) <= dist && Math.abs(trunc(b[0] / W) - y) <= dist) return b; return null; }
  my_count(kind) { if (kind === 'S') return this.st.ships.filter(s => s[1] === this.me).length; let n = 0; for (const [t, k, l] of this.st.bld) if (k === kind && this.view.owner[t] === this.me) n += l; return n; }
  cost(kind) { return BOMBS[kind] ? BOMBS[kind].cost : build_cost(kind, this.my_count(kind)); }
  on(kind) { const k = OPT_OF_KIND[kind], o = (this.st && this.st.opts) || DEFAULT_OPTS; return k === undefined || !!(o[k] === undefined ? true : o[k]); }
  kname(kind) { return BOMBS[kind] ? BOMBS[kind].name : BTYPES[kind].name; }
  check(kind, tile) {
    const owner = this.view.owner, mp = this.players.get(this.me), me = this.me;
    if (tile === null || !mp || !mp.a) return [false, '', false];
    const x = tile % W, y = trunc(tile / W);
    if (BOMBS[kind]) {
      const o = owner[tile];
      if (o === me || this.allies.has(o)) return [false, 'Eigenes/verbündetes Land', false];
      if (!this.my_count('M')) return [false, 'Raketensilo (M) nötig', false];
      if (mp.sr <= 0) return [false, 'Silo lädt nach ...', false];
    } else if (kind === 'S') {
      if (!this.st.bld.some(([t, k]) => k === 'P' && owner[t] === me && Math.hypot(t % W - x, trunc(t / W) - y) <= 15)) return [false, 'Kein eigener Hafen in der Nähe', false];
    } else {
      const same = this.st.bld.some(([t, k]) => k === kind && owner[t] === me && Math.max(Math.abs(t % W - x), Math.abs(trunc(t / W) - y)) <= 2);
      if (!same) {
        if (owner[tile] !== me) return [false, 'Nur auf eigenem Land', false];
        if (this.bld_at(tile, 2)) return [false, 'Zu nah an anderem Gebäude', false];
        if (kind === 'P') { let c = false; for (let k = 0; k < 4; k++) { const j = NEIGH[tile * 4 + k]; if (j >= 0 && owner[j] === WATER) c = true; } if (!c) return [false, 'Hafen muss an die Küste', false]; }
      }
      if (mp.g < this.cost(kind)) return [false, `Zu wenig Gold (${fmt(this.cost(kind))})`, same];
      return [true, '', same];
    }
    if (mp.g < this.cost(kind)) return [false, `Zu wenig Gold (${fmt(this.cost(kind))})`, false];
    return [true, '', false];
  }
  open_menu(pos, tile) {
    const o = this.view.owner[tile], items = [], mp = this.players.get(this.me), pct = trunc(this.ratio * 100), st = this.st; let title;
    if (o === this.me) {
      const b = this.bld_at(tile, 2);
      title = b && this.view.owner[b[0]] === this.me ? `${BTYPES[b[1]].name} · Stufe ${b[2]}` : 'Dein Land';
      for (const k of BUILD_ORDER) { if (!this.on(k)) continue; const [ok, , up] = this.check(k, tile); items.push([up ? `${BTYPES[k].name} verbessern` : `${BTYPES[k].name} bauen`, fmt(this.cost(k)), ok, { t: 'build', i: tile, k }]); }
      items.push(['Gold in Truppen (50 %)', 'K', !!(mp && mp.a && mp.g > 0), { t: 'buy' }]);
    } else if (o === WATER) {
      title = 'Wasser';
      if (this.on('S')) { const [ok] = this.check('S', tile); items.push(['Kriegsschiff bauen', fmt(this.cost('S')), ok, { t: 'build', i: tile, k: 'S' }]); }
    } else {
      const p = this.players.get(o); title = o === NEUTRAL ? 'Wildnis' : (p ? p.n : '?');
      if (o === NEUTRAL || !this.allies.has(o)) for (const v of VIAS) {
        if (v === 'plane' && !this.on('L')) continue;
        items.push([v === 'auto' ? 'Angreifen' : `  ... mit ${VIA_NAMES[v]}`, v === 'auto' ? `${pct} %` : (v === 'plane' ? fmt(PLANE_COST) : ''), !!(mp && mp.a) && (v !== 'plane' || mp.g >= PLANE_COST), { t: 'attack', i: tile, r: this.ratio, v }]);
      }
      if (o !== NEUTRAL && ((st.opts || DEFAULT_OPTS).alliances !== false)) {
        if (!this.allies.has(o)) { const req = st.rq.some(([a, b]) => a === o && b === this.me); items.push([req ? 'Bündnis annehmen' : 'Bündnis anfragen', '', true, { t: 'ally', p: o }]); }
        else { items.push(['Truppen schicken', `${pct} %`, true, { t: 'send', p: o, k: 'troops', r: this.ratio }]); items.push(['Gold schicken', `${pct} %`, true, { t: 'send', p: o, k: 'gold', r: this.ratio }]); items.push(['Bündnis brechen (Verrat!)', '', true, { t: 'break', p: o }]); }
      }
      if (o === NEUTRAL || !this.allies.has(o)) for (const k of BOMB_ORDER) { if (!this.on(k)) continue; const [ok] = this.check(k, tile); items.push([BOMBS[k].name, fmt(BOMBS[k].cost), ok, { t: 'build', i: tile, k }]); }
    }
    return { pos, title, items };
  }
  menu_layout(sw, sh) {
    const mw_ = 290, ih = 30, n = this.menu.items.length, mxp = Math.min(this.menu.pos[0] + 6, sw - mw_ - 6), myp = Math.max(6, Math.min(this.menu.pos[1] + 6, sh - ih * n - 50));
    return [R(mxp, myp, mw_, ih * n + 44), this.menu.items.map((it, k) => [R(mxp + 6, myp + 38 + ih * k, mw_ - 12, ih - 3), it])];
  }

  frame(evs, dt) {
    const gfx = this.gfx, net = this.net, txt = (s, z, c, b) => gfx.txt(s, z, c, b), now = performance.now() / 1000, sw = App.sw, sh = App.sh;
    // ---------- Netzwerk ----------
    for (const m of net.take()) {
      if (m.map) {
        if ((m.w || W) !== W || (m.h || H) !== H) { set_map_size(m.w, m.h); this.view = null; this.cam = new Camera(); this.fitted = this.zoomed_me = false; }
        if (!this.view) this.view = new MapView(gfx, unpack(m.map)); else this.view.full(unpack(m.map));
        this.seq = m.seq;
      } else if (this.view && this.seq !== null && m.seq === this.seq + 1) { this.view.apply(m.chg); this.seq = m.seq; }
      else { if (this.view && now > this.resync_at) { net.send({ t: 'resync' }); this.resync_at = now + 3; } this.seq = null; continue; }
      this.st = m; const ids = new Set();
      for (const lst of [m.boats, m.ships, m.planes]) for (const e of lst) { this.interp(e[0], e[2], e[3], now); ids.add(e[0]); }
      for (const e of m.mis) { this.interp(e[0], e[7], 0.0, now); ids.add(e[0]); }
      for (const e of (m.trains || [])) { this.interp(e[0], e[4], 0.0, now); ids.add(e[0]); }
      for (const uid of [...this.units.keys()]) if (!ids.has(uid)) this.units.delete(uid);
      for (const f of (m.fx || [])) this.anims.push([f, now]);
      for (const [pid_, sk_] of Object.entries(m.skins || {})) this.skins[parseInt(pid_, 10)] = sk_;
    }
    const st = this.st, view = this.view;
    if (!st || !view) {
      for (const ev of evs) handle_common(ev);
      draw_background(gfx, sw, sh);
      const t = txt(net.error || (net.connected ? 'Verbinde ...' : 'Verbindung fehlgeschlagen.'), 40, TEXT, true); blit(t, t.get_rect({ center: [sw >> 1, sh >> 1] }));
      if (!net.connected) { this.lost_since = this.lost_since || now; if (now - this.lost_since > 2) return 'menu'; }
      return;
    }
    const me = this.me = st.you; this.players = new Map(st.players.map(p => [p.id, p])); const players = this.players;
    const allies = this.allies = new Set(); for (const [a, b] of st.al) { if (a === me) allies.add(b); else if (b === me) allies.add(a); }
    const owner = view.owner, centers = view.centers(), mp = players.get(me), mode = MODES[st.mode] || MODES.normal, phase = st.phase || 0;
    const pending = !!(mp && mp.sp !== null && mp.sp !== undefined), choosing = pending || (phase > 0 && mp && mp.a);
    const cam = this.cam;
    cam.set_view(sw, sh);
    if (!this.fitted) { cam.fit(); if (centers.has(me) && !choosing) { const [cx, cy] = centers.get(me); cam.center_on(cx, cy, cam.minz * 4); this.zoomed_me = true; } this.fitted = true; }
    if (!this.zoomed_me && centers.has(me) && phase === 0 && !pending) { const c = centers.get(me); cam.fly_to(c[0], c[1]); cam.zoom_at(sw / 2, sh / 2, 3.0); this.zoomed_me = true; }
    cam.update(dt);

    // ---------- Oberflächen-Bereiche ----------
    const r_stats = R(14, 14, 370, 150), alive_n = st.players.filter(p => p.a).length, lb_rows = Math.min(10, alive_n);
    const r_lb = R(sw - 300, 14, 286, 44 + lb_rows * 24);
    const r_leave = App.isTouch ? R(sw - 224, r_lb.bottom + 8, 110, 34) : R(sw - 300, r_lb.bottom + 8, 186, 34);
    const r_3d = R(sw - 108, r_lb.bottom + 8, 94, 34);
    const r_chatb = App.isTouch ? R(sw - 300, r_lb.bottom + 8, 70, 34) : null;
    const opts_ = st.opts || DEFAULT_OPTS;
    if (this.view3d === null) this.view3d = !!opts_.blobs;
    cam.p3d = this.view3d; const blobs_on = !!opts_.blobs || this.view3d;
    const r_dlg = R(0, 0, 460, 190); r_dlg.center = [sw >> 1, sh >> 1];
    const r_yes = R(r_dlg.x + 24, r_dlg.bottom - 70, 200, 48), r_no = R(r_dlg.right - 224, r_dlg.bottom - 70, 200, 48);
    const kinds = BUILD_ORDER.concat(BOMB_ORDER).filter(k => this.on(k));
    const bw = Math.max(78, Math.min(116, trunc((sw - 60) / kinds.length) - 6)), bar_w = kinds.length * (bw + 6) + 22, bar_x = Math.max(6, (sw - bar_w) >> 1);
    const r_bar = R(bar_x, sh - 124, bar_w, 116), seg_w = 38, via_list = VIAS.filter(v => v !== 'plane' || this.on('L')), via_w = 96;
    const row_w = 70 + 10 * seg_w + 16 + via_list.length * (via_w + 4), seg_x = bar_x + Math.max(70, ((bar_w - row_w) >> 1) + 70);
    const seg_rects = []; for (let k = 0; k < 10; k++) seg_rects.push(R(seg_x + k * seg_w, sh - 118, seg_w - 4, 34));
    const via_x = seg_x + 10 * seg_w + 16, via_rects = via_list.map((v, n) => [v, R(via_x + n * (via_w + 4), sh - 118, via_w, 34)]);
    const build_rects = kinds.map((k, n) => [k, R(bar_x + 11 + n * (bw + 6) + (BOMBS[k] ? 8 : 0), sh - 76, bw - (BOMBS[k] ? 2 : 0), 62)]);
    if (this.ev_cache[0] !== net.events_no) {
      const lines = [], f = gfx.font(19);
      for (const e of net.events.slice(-7)) { let cur = ''; for (const w_ of e.split(' ')) { const test = (cur + ' ' + w_).trim(); if (f.size(test)[0] > 400) { lines.push(cur); cur = w_; } else cur = test; } lines.push(cur); }
      this.ev_cache = [net.events_no, lines.slice(-8)];
    }
    const ev_lines = this.ev_cache[1], r_ev = R(14, r_bar.y - 12 - (ev_lines.length * 20 + 16), 430, ev_lines.length * 20 + 16);
    const ui_rects = [r_stats, r_lb, r_bar, r_leave, r_3d].concat(r_chatb ? [r_chatb] : [], ev_lines.length ? [r_ev] : [], this.confirm_leave ? [r_dlg] : []);
    let menu_box = null, menu_rects = [];
    if (this.menu) { [menu_box, menu_rects] = this.menu_layout(sw, sh); ui_rects.push(menu_box); }
    const ranking = st.players.filter(p => p.a).sort((a, b) => b.ti - a.ti), lb_click = ranking.slice(0, lb_rows).map((p, n_) => [R(r_lb.x + 6, r_lb.y + 40 + n_ * 24, r_lb.w - 12, 23), p.id]);
    // Zeilen unter den Werten (werden vorab berechnet, damit sie antippbar sind)
    const rows = [];
    for (const e of st.atk) { const [a, t_, tr] = e; if (a === me) rows.push([`Angriff auf ${players.has(t_) ? players.get(t_).n : 'Wildnis'}  ${fmt(tr)}`, [255, 190, 150], null]); else if (t_ === me) rows.push([`${players.has(a) ? players.get(a).n : '?'} greift an  ${fmt(tr)}`, [255, 120, 120], null]); }
    const nb = st.boats.filter(b => b[1] === me).length, npl = st.planes.filter(b => b[1] === me).length, nm = st.mis.filter(b => b[1] === me).length;
    if (nb || npl || nm) rows.push([`Unterwegs: ${nb} Boote · ${npl} Kampfjets · ${nm} Raketen`, BLUE, null]);
    const reqs = st.rq.filter(([a, b]) => b === me && players.has(a)).map(r => r[0]);
    if (reqs.length) rows.push([`${App.isTouch ? 'Tippen' : 'Y'} = Bündnis mit ${players.get(reqs[reqs.length - 1]).n} annehmen`, [140, 220, 255], { t: 'accept' }]);
    const r_rows = rows.length ? R(14, r_stats.bottom + 8, 370, Math.min(6, rows.length) * 22 + 12) : null; if (r_rows) ui_rects.push(r_rows);
    const r_help = R((sw >> 1) - 50, 2, 100, 30), r_dead = R((sw >> 1) - 160, 76, 320, 34);
    if (!this.action && !this.show_help) ui_rects.push(r_help);

    const mx = App.mx, my = App.my, over_ui = ui_rects.some(r => r.collidepoint(mx, my));
    let hover_tile = null;
    if (!over_ui) { const [ftx, fty] = cam.to_tile(mx, my); if (ftx >= 0 && ftx < W && fty >= 0 && fty < H) hover_tile = trunc(fty) * W + trunc(ftx); }
    const hover_owner = hover_tile !== null ? owner[hover_tile] : null, hp = (hover_owner !== null && hover_owner !== NEUTRAL && hover_owner !== WATER) ? players.get(hover_owner) : null;

    // ---------- Eingaben ----------
    this.chat_text = App.live('chat', this.chat_text);
    for (const ev of evs) {
      if (handle_common(ev)) continue;
      if (this.confirm_leave) {
        if (ev.type === 'down' && ev.button === 1) { if (r_yes.collidepoint(ev.pos)) return 'menu'; if (r_no.collidepoint(ev.pos)) this.confirm_leave = false; }
        else if (ev.type === 'key') { if (ev.key === 'Escape') this.confirm_leave = false; else if (ev.key === 'Enter') return 'menu'; }
        continue;
      }
      if (ev.type === 'down' && ev.button === 1 && r_3d.collidepoint(ev.pos) && !this.menu) { this.view3d = !this.view3d; continue; }
      if (ev.type === 'key' && ev.key === 'F3' && !this.chat_active) { this.view3d = !this.view3d; continue; }
      if (ev.type === 'down' && ev.button === 1 && r_leave.collidepoint(ev.pos) && !this.menu) { this.confirm_leave = true; continue; }
      if (ev.type === 'down' && ev.button === 1 && r_chatb && r_chatb.collidepoint(ev.pos) && !this.menu) { this.chat_active = !this.chat_active; if (!this.chat_active) this.chat_text = ''; continue; }
      if (ev.type === 'wheel') { if (!over_ui) cam.zoom_at(mx, my, 1.25 ** ev.y); }
      else if (ev.type === 'pan') cam.pan(...ev.rel);
      else if (ev.type === 'down') {
        if (this.menu) {
          if (ev.button === 1) for (const [r, [, , ok, act]] of menu_rects) if (r.collidepoint(ev.pos) && ok && act) net.send(act);
          this.menu = null; continue;
        }
        if (ev.button === 1) {
          if (over_ui) {
            seg_rects.forEach((r, k) => { if (r.collidepoint(ev.pos)) this.ratio = (k + 1) / 10; });
            for (const [v, r] of via_rects) if (r.collidepoint(ev.pos)) this.via = v;
            for (const [k, r] of build_rects) if (r.collidepoint(ev.pos)) this.action = this.action === k ? null : k;
            for (const [r, pid] of lb_click) if (r.collidepoint(ev.pos) && centers.has(pid)) { const c = centers.get(pid); cam.fly_to(c[0], c[1]); }
            if (r_rows && r_rows.collidepoint(ev.pos)) rows.slice(0, 6).forEach((row, n_) => { if (row[2] && ev.pos[1] >= r_rows.y + 7 + n_ * 22 - 3 && ev.pos[1] < r_rows.y + 7 + (n_ + 1) * 22 - 3) net.send(row[2]); });
            if (r_help.collidepoint(ev.pos) && !this.action) this.show_help = !this.show_help;
          } else if (mp && !mp.a && !pending && st.respawn && r_dead.collidepoint(ev.pos)) net.send({ t: 'respawn' });
          else this.drag = [ev.pos, false];
        } else if (ev.button === 2) this.drag = [ev.pos, true];
        else if (ev.button === 3) { if (this.action) this.action = null; else if (hover_tile !== null) this.menu = this.open_menu(ev.pos, hover_tile); }
      } else if (ev.type === 'move' && this.drag) {
        if (!this.drag[1] && Math.hypot(ev.pos[0] - this.drag[0][0], ev.pos[1] - this.drag[0][1]) > 6) this.drag[1] = true;
        if (this.drag[1]) cam.pan(...ev.rel);
      } else if (ev.type === 'up' && (ev.button === 1 || ev.button === 2)) {
        if (this.drag && !this.drag[1] && ev.button === 1 && hover_tile !== null) {
          if (this.action) { net.send({ t: 'build', i: hover_tile, k: this.action }); if (!ev.shift) this.action = null; }
          else if (choosing) net.send({ t: 'spawn', i: hover_tile });
          else net.send({ t: 'attack', i: hover_tile, r: this.ratio, v: this.via });
        }
        this.drag = null;
      } else if (ev.type === 'key') {
        if (this.chat_active) {
          if (ev.key === 'Enter') { if (this.chat_text.trim()) net.send({ t: 'chat', m: this.chat_text }); this.chat_active = false; this.chat_text = ''; }
          else if (ev.key === 'Escape') { this.chat_active = false; this.chat_text = ''; }
          else if (ev.ch && !ev.ctrl && this.chat_text.length < 120) this.chat_text += ev.ch;   // Tasten direkt nach Enter
          continue;
        }
        const keymap = { h: 'H', f: 'F', n: 'B', p: 'P', l: 'L', m: 'M', v: 'V', s: 'S', q: 'small', w: 'big', e: 'mirv' }, key = ev.key;
        if (key === 'Escape') { if (this.action || this.menu || this.show_help) { this.action = null; this.menu = null; this.show_help = false; } else this.confirm_leave = true; }
        else if (key === 'Enter') this.chat_active = true;
        else if (key === 'F1') this.show_help = !this.show_help;
        else if (key === 'Tab') { const vs = VIAS.filter(v => v !== 'plane' || this.on('L')); this.via = vs.includes(this.via) ? vs[(vs.indexOf(this.via) + 1) % vs.length] : 'auto'; }
        else if (/^[0-9]$/.test(key)) { const n_ = +key; this.ratio = (n_ || 10) / 10; }
        else if (key === 'Space') this.terrain_view = !this.terrain_view;
        else if (key === 'y') net.send({ t: 'accept' });
        else if (key === 'k') net.send({ t: 'buy' });
        else if (key === 'r') net.send({ t: 'respawn' });
        else if (keymap[key]) { const k = keymap[key]; if (this.on(k)) this.action = this.action === k ? null : k; }
        else if (hp && hp.id !== me) {
          if (key === 'a') net.send({ t: 'ally', p: hp.id }); else if (key === 'b') net.send({ t: 'break', p: hp.id });
          else if (key === 't') net.send({ t: 'send', p: hp.id, k: 'troops', r: this.ratio }); else if (key === 'g') net.send({ t: 'send', p: hp.id, k: 'gold', r: this.ratio });
        }
      }
    }
    if (!this.chat_active) { const k = App.keys, step = 900 * dt, dx = (k.has('ArrowLeft') ? 1 : 0) - (k.has('ArrowRight') ? 1 : 0), dy = (k.has('ArrowUp') ? 1 : 0) - (k.has('ArrowDown') ? 1 : 0); if (dx || dy) cam.pan(dx * step, dy * step); }

    // ---------- Karte ----------
    cam.p3d = this.view3d;
    draw.rect([14, 30, 58], R(0, 0, sw, sh));
    if (cam.p3d) view.draw3d(cam, this.terrain_view); else view.draw(cam, this.terrain_view);
    const z = cam.z, S = (tx, ty) => { const [sx, sy] = cam.to_screen(tx, ty); return [trunc(sx), trunc(sy)]; };
    const on_screen = (px, py, m = 60) => -m < px && px < sw + m && -m < py && py < sh + m;
    const pcol = o => (o !== NEUTRAL && o !== WATER && o !== null && o !== undefined) ? view.player_cols(o)[0] : [200, 200, 200];
    const me_ = me, units = this.units, sprites3 = [], CW = BlobRenderer.CHAR_W, CH = BlobRenderer.CHAR_H;
    const blob_look_of = pid => parse_blob_look((this.skins[pid] || {}).blob) || [BLOB_BODIES[pid % BLOB_BODIES.length][0], BLOB_HATS[(pid * 3) % BLOB_HATS.length][0], BLOB_PATTERNS[(pid * 5) % BLOB_PATTERNS.length][0], BLOB_PAINTS[(pid * 7) % BLOB_PAINTS.length][1]];
    const add_blob = (tx, ty, pid, dirx, diry, frame) => {
      const [px, py] = cam.to_screen(tx, ty); if (!on_screen(px, py, 80)) return;
      const hpx = Math.max(10.0, Math.min(sh * 0.4, cam.scale_at(ty) * 2.2));
      const vw_ = Math.abs(dirx) > Math.abs(diry) ? (dirx > 0 ? 'right' : 'left') : (diry < 0 ? 'back' : 'front'), col = pcol(pid), look = blob_look_of(pid);
      sprites3.push([ty, () => {
        const wpx = hpx * CW / CH, rend = hpx > 90 ? this.rend3b : this.rend3, shw = wpx * 0.9;
        BlobRenderer.put(rend.shadow(), px - shw / 2, py - shw * 0.15, shw, shw * 0.3);
        BlobRenderer.put(rend.character(col, vw_, frame, false, look), trunc(px - wpx / 2), trunc(py - hpx + hpx * 0.03), wpx, hpx);
      }]);
    };
    if (!this.terrain_view) {
      // Gleise mit Schotter, Schwellen, Schienen - und Brücken über Wasser
      for (const [a, b] of st.rails) {
        const ax_ = a % W + 0.5, ay_ = trunc(a / W) + 0.5, bx_ = b % W + 0.5, by_ = trunc(b / W) + 0.5, pa = S(ax_, ay_), pb = S(bx_, by_);
        if (!(on_screen(...pa, 400) || on_screen(...pb, 400))) continue;
        const dist_t = Math.max(1.0, Math.hypot(bx_ - ax_, by_ - ay_)), n_s = trunc(dist_t * 2) + 1, segs = []; let cur_w = null, f0 = 0.0;
        for (let k = 0; k <= n_s; k++) {
          const f = k / n_s, wx = Math.min(W - 1, trunc(ax_ + (bx_ - ax_) * f)), wy = Math.min(H - 1, trunc(ay_ + (by_ - ay_) * f)), w_ = owner[wy * W + wx] === WATER;
          if (cur_w === null) cur_w = w_; else if (w_ !== cur_w) { segs.push([f0, f, cur_w]); f0 = f; cur_w = w_; }
        }
        segs.push([f0, 1.0, cur_w]);
        const ddx = pb[0] - pa[0], ddy = pb[1] - pa[1], ln = Math.max(1.0, Math.hypot(ddx, ddy)), nx_ = -ddy / ln, ny_ = ddx / ln;
        const P = (f, off = 0.0) => [pa[0] + ddx * f + nx_ * off, pa[1] + ddy * f + ny_ * off];
        if (z >= 4) {
          for (const [f0_, f1_, wat] of segs) {
            if (wat) {
              const sh_ = z * 0.5, q0 = P(f0_), q1 = P(f1_);
              draw.line([22, 44, 76], [q0[0] + sh_, q0[1] + sh_], [q1[0] + sh_, q1[1] + sh_], Math.max(2, trunc(z * 1.2)));
              const npil = Math.max(1, trunc((f1_ - f0_) * ln / (z * 2.5)));
              for (let k = 0; k <= npil; k++) { const q = P(f0_ + (f1_ - f0_) * k / npil); draw.circle([78, 80, 90], [q[0] + sh_ * 0.6, q[1] + sh_ * 0.6], Math.max(2, trunc(z * 0.34))); }
              draw.line([132, 104, 76], q0, q1, Math.max(2, trunc(z * 1.15)));
              for (const sg of [-1, 1]) draw.line([64, 66, 74], P(f0_, sg * z * 0.6), P(f1_, sg * z * 0.6), Math.max(1, trunc(z * 0.16)));
            } else draw.line([134, 124, 108], P(f0_), P(f1_), Math.max(2, trunc(z * 0.95)));
          }
          const nsl = trunc(ln / Math.max(3, z * 0.55));
          for (let k = 0; k <= nsl; k++) { const f = k / Math.max(1, nsl); draw.line([98, 70, 46], P(f, -z * 0.42), P(f, z * 0.42), Math.max(1, trunc(z * 0.17))); }
          for (const sg of [-1, 1]) draw.line([205, 205, 215], P(0, sg * z * 0.2), P(1, sg * z * 0.2), Math.max(1, trunc(z * 0.09)));
        } else for (const [f0_, f1_, wat] of segs) {
          if (wat) { draw.line([40, 40, 48], P(f0_), P(f1_), Math.max(3, trunc(z * 0.9) + 2)); draw.line([175, 175, 185], P(f0_), P(f1_), Math.max(1, trunc(z * 0.6))); }
          else draw.line([74, 62, 52], P(f0_), P(f1_), Math.max(1, trunc(z / 2)));
        }
      }
      // Züge: Lok + 3 Waggons
      if (z >= 1.5) for (const [uid, o, a, b] of (st.trains || [])) {
        const u = units.get(uid); if (!u) continue;
        const prog = this.upos(u, now)[0], pa = S(a % W + 0.5, trunc(a / W) + 0.5), pb = S(b % W + 0.5, trunc(b / W) + 0.5);
        const ddx = pb[0] - pa[0], ddy = pb[1] - pa[1], ln = Math.max(1.0, Math.hypot(ddx, ddy)), ux = ddx / ln, uy = ddy / ln, nx_ = -uy, ny_ = ux, head = [pa[0] + ddx * prog, pa[1] + ddy * prog];
        if (!on_screen(...head)) continue;
        const Lc = Math.max(5, z * 1.5), Wc = Math.max(3, z * 0.72), gap = Math.max(1, z * 0.22);
        for (let k = 3; k >= 0; k--) {
          const back = Lc / 2 + k * (Lc + gap); if (prog * ln - back < -Lc * 0.2) continue;
          const cx_ = head[0] - ux * back, cy_ = head[1] - uy * back, corner = (fl, fw) => [cx_ + ux * Lc / 2 * fl + nx_ * Wc / 2 * fw, cy_ + uy * Lc / 2 * fl + ny_ * Wc / 2 * fw];
          const body = [corner(1, 1), corner(1, -1), corner(-1, -1), corner(-1, 1)];
          if (k === 0) {
            const col = pcol(o); draw.polygon(col, body);
            draw.polygon(dark(col, 0.55), [corner(-0.1, 0.8), corner(-0.1, -0.8), corner(-0.9, -0.8), corner(-0.9, 0.8)]);
            draw.polygon([40, 40, 44], [corner(1, 0.9), corner(1, -0.9), corner(0.6, -0.9), corner(0.6, 0.9)]);
            draw.circle([255, 240, 150], corner(1.05, 0), Math.max(1, trunc(z * 0.16)));
            if (z >= 4) for (let j = 0; j < 3; j++) { const ph = (now * 1.5 + j / 3) % 1.0, sp = corner(0.2 - ph * 1.6, 0), c_ = trunc(170 + 60 * ph); draw.circle([c_, c_, c_], [sp[0] - ph * z * 0.4, sp[1] - ph * z * 1.2], Math.max(1, trunc(z * (0.18 + 0.25 * ph)))); }
          } else { const col = k % 2 ? [150, 104, 68] : [122, 128, 140]; draw.polygon(col, body); draw.line(lerp_col(col, [255, 255, 255], 0.25), corner(0.85, 0), corner(-0.85, 0), Math.max(1, trunc(Wc * 0.25))); }
          draw.polygon([25, 25, 30], body, 1);
        }
      }
      // Gebäude
      const bsize = Math.max(16, z * 3.0);
      for (const [t, k, lvl] of st.bld) {
        const [cx, cy] = S(t % W + 0.5, trunc(t / W) + 0.5); if (!on_screen(cx, cy)) continue;
        const bs_ = cam.p3d ? Math.max(8, Math.min(sh * 0.5, cam.scale_at(trunc(t / W) + 0.5) * 3.0)) : bsize;
        const size_k = bs_ * (1 + 0.08 * Math.min(lvl - 1, 5)), m_ = gfx.model(k, size_k, pcol(owner[t]));
        const rx = cx - (m_.w >> 1), ry = cy - trunc(m_.h * Gfx.ICON_GROUND_Y / Gfx.ICON_RES);
        ctx.imageSmoothingEnabled = !m_.pixel; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(m_.cv, rx, ry, m_.w, m_.h);
        if (lvl > 1 && size_k >= 14) {
          const bt = txt(String(lvl), Math.max(14, trunc(size_k * 0.42)), [255, 255, 255], true), br = bt.get_rect({ center: [rx + m_.w - 2, ry + 3] }).inflate(8, 2);
          draw.rect([200, 60, 50], br, 0, br.h >> 1); draw.rect([255, 255, 255], br, 1, br.h >> 1); blit(bt, bt.get_rect({ center: br.center }));
        }
        if (k === 'F' && m_.w >= 24) { const u_ = m_.w / Gfx.ICON_RES; for (let j = 0; j < 3; j++) { const ph = (now * 0.5 + j / 3 + (t % 7) / 7) % 1.0, rr = trunc(m_.w * (0.04 + 0.08 * ph)), c_ = trunc(200 + 40 * ph); draw.circle([c_, c_, c_], [rx + 25 * u_ + m_.w * 0.1 * ph, ry + 5 * u_ - m_.w * 0.35 * ph], Math.max(1, rr)); } }
      }
      // Neu eroberte Felder blitzen auf
      if (cam.p3d) view.flash = [];
      if (view.flash.length) {
        view.flash = view.flash.filter(f => now - f[1] < 0.7); const zz = Math.max(1, Math.ceil(z));
        for (const [i, t0, o] of view.flash) {
          const [px, py] = S(i % W, trunc(i / W)); if (!on_screen(px, py, 10)) continue;
          const k_ = Math.max(0.0, (now - t0) / 0.7), base = (o !== me_ && st.atk.some(e => e[0] === o && e[1] === me_)) ? [255, 90, 80] : pcol(o);
          draw.rect(lerp_col([255, 255, 235], base, Math.min(1.0, k_ * 1.6)), R(px, py, zz, zz));
        }
      }
      // Leuchtende Front + Pfeile mit Truppenzahl
      const pulse = 0.5 + 0.5 * Math.sin(now * 7);
      for (const e of st.atk) {
        const [a, t_, tr] = e, pts = e.slice(3); if (!pts.length || !centers.has(a)) continue;
        const mine = a === me_, vs_me = t_ === me_; if (!(mine || vs_me) && z < 3) continue;
        const col = vs_me ? [255, 70, 60] : (mine ? [255, 170, 60] : pcol(a)), glow = Math.max(3, trunc(z * (0.9 + 0.6 * pulse)));
        let fxs = 0, fys = 0;
        for (const f_ of pts) { const fx_ = f_ % W + 0.5, fy_ = trunc(f_ / W) + 0.5; fxs += fx_; fys += fy_; const [px, py] = S(fx_, fy_); if (on_screen(px, py)) draw.circle(col, [px, py], glow, Math.max(1, trunc(glow / 3))); }
        fxs /= pts.length; fys /= pts.length;
        const [cxa, cya] = centers.get(a), ang = Math.atan2(fys - cya, fxs - cxa), L = Math.max(20, Math.min(60, z * 3.5));
        let tip = S(fxs, fys); tip = [tip[0] + Math.cos(ang) * L * 0.25, tip[1] + Math.sin(ang) * L * 0.25];
        const tail = [tip[0] - Math.cos(ang) * L, tip[1] - Math.sin(ang) * L]; if (!on_screen(...tip, 100)) continue;
        const wd = Math.max(3, trunc(L * 0.13)), nx_ = -Math.sin(ang), ny_ = Math.cos(ang), head = L * 0.38, base_ = [tip[0] - Math.cos(ang) * head, tip[1] - Math.sin(ang) * head];
        const poly = [[tail[0] + nx_ * wd / 2, tail[1] + ny_ * wd / 2], [base_[0] + nx_ * wd / 2, base_[1] + ny_ * wd / 2], [base_[0] + nx_ * wd * 1.4, base_[1] + ny_ * wd * 1.4], tip, [base_[0] - nx_ * wd * 1.4, base_[1] - ny_ * wd * 1.4], [base_[0] - nx_ * wd / 2, base_[1] - ny_ * wd / 2], [tail[0] - nx_ * wd / 2, tail[1] - ny_ * wd / 2]];
        draw.polygon([20, 20, 24], poly.map(([x, y]) => [x + 2, y + 2])); draw.polygon(col, poly); draw.polygon([255, 255, 255], poly, 1);
        const lab = txt(fmt(tr), Math.max(14, Math.min(20, trunc(z * 1.6))), [255, 255, 255], true), lr = lab.get_rect({ center: [trunc(tail[0]), trunc(tail[1])] }).inflate(12, 4);
        draw.rect([20, 20, 24], lr, 0, lr.h >> 1); draw.rect(col, lr, 2, lr.h >> 1); blit(lab, lab.get_rect({ center: lr.center }));
      }
      // Blobs: marschieren an der Front und laufen im eigenen Land herum
      if (blobs_on) {
        for (const e of st.atk) {
          const a = e[0]; if (!centers.has(a)) continue; const [cxa, cya] = centers.get(a);
          e.slice(3, 9).forEach((f_, j) => {
            const fx_ = f_ % W + 0.5, fy_ = trunc(f_ / W) + 0.5, ang = Math.atan2(fy_ - cya, fx_ - cxa), wob = (now * 0.8 + j * 0.37) % 1.0;
            add_blob(fx_ - Math.cos(ang) * (2.2 - wob * 1.6), fy_ - Math.sin(ang) * (2.2 - wob * 1.6), a, Math.cos(ang), Math.sin(ang), trunc(now * 10 + j * 3) % 8);
          });
        }
        for (const [pid, [cx, cy, n]] of centers) {
          const p = players.get(pid); if (!p || n < 6) continue;
          const cnt = Math.max(1, Math.min(9, trunc(Math.log10(Math.max(1.0, p.tr)) * 2) - 3)), rad = Math.min(6.0, 1.2 + Math.sqrt(n) * 0.12);
          for (let j = 0; j < cnt; j++) {
            const a_ = j * 2.39996 + now * 0.18 * (j % 2 ? 1 : -1), r_ = rad * (0.45 + 0.55 * ((j * 0.618) % 1.0)), bx_ = cx + 0.5 + Math.cos(a_) * r_, by_ = cy + 0.5 + Math.sin(a_) * r_;
            const ix = trunc(bx_), iy = trunc(by_); if (!(ix >= 0 && ix < W && iy >= 0 && iy < H) || owner[iy * W + ix] !== pid) continue;
            const sgn = j % 2 ? 1 : -1; add_blob(bx_, by_, pid, -Math.sin(a_) * sgn, Math.cos(a_) * sgn, trunc(now * 9 + j) % 8);
          }
        }
        sprites3.sort((p, q) => p[0] - q[0]); for (const [, fn] of sprites3) fn();
      }
      // Panzer an der Front
      if (z >= 1.6 && !blobs_on) for (const e of st.atk) {
        const a = e[0]; if (!centers.has(a)) continue; const [cxa, cya] = centers.get(a);
        for (const f_ of e.slice(3, 6)) {
          const fx_ = f_ % W + 0.5, fy_ = trunc(f_ / W) + 0.5, ang = Math.atan2(fy_ - cya, fx_ - cxa) * 180 / Math.PI, wob = Math.sin(now * 3 + f_) * 0.6, rad = ang * Math.PI / 180;
          const [px, py] = S(fx_ - Math.cos(rad) * (1.2 + wob), fy_ - Math.sin(rad) * (1.2 + wob));
          if (on_screen(px, py)) { const sk = (this.skins[a] || {}).tank; blitRot(sk ? gfx.skin_model(sk, Math.max(12, z * 2.6), pcol(a)) : gfx.car_model(Math.max(7, z * 1.4), pcol(a)), px, py, Math.round(ang / 15) * 15); }
        }
      }
      // Boote
      for (const [uid, o, , , tr] of st.boats) {
        const u = units.get(uid); if (!u) continue; const [px, py] = S(...this.upos(u, now)); if (!on_screen(px, py)) continue;
        blitRot(gfx.boat_model(Math.max(8, z * 1.6), pcol(o)), px, py, Math.round(u[5] / 15) * 15);
        const t2 = txt(fmt(tr), Math.max(16, trunc(Math.min(30, z * 2))), [255, 255, 255], true), r2_ = t2.get_rect({ midbottom: [px, py - z] });
        draw.rect([0, 0, 0], r2_.inflate(8, 2), 0, 6); blit(t2, r2_);
      }
      // Kriegsschiffe
      for (const [uid, o, , , shp_] of st.ships) {
        const u = units.get(uid); if (!u) continue; const [px, py] = S(...this.upos(u, now)); if (!on_screen(px, py)) continue;
        const sk = (this.skins[o] || {}).ship;
        blitRot(sk ? gfx.skin_model(sk, Math.max(20, z * 3.6), pcol(o)) : gfx.ship_model(Math.max(10, z * 1.8), pcol(o)), px, py, Math.round(u[5] / 15) * 15);
        if (shp_ < 100) { const shp = Math.max(0, shp_), s_ = Math.max(10, trunc(z * 1.8)); draw.rect([40, 0, 0], R(px - s_, py + s_ * 0.7, s_ * 2, 4)); draw.rect(GREEN, R(px - s_, py + s_ * 0.7, trunc(s_ * 2 * shp / 100), 4)); }
      }
      // Namen
      for (const [pid, [cx, cy, n]] of centers) {
        const p = players.get(pid); if (!p || n < 15) continue;
        const size = trunc(Math.min(64, (Math.sqrt(n) * 0.9 + 4) * z / 3)); if (size < 13) continue;
        const [px, py] = S(cx + 0.5, cy + 0.5); if (!on_screen(px, py, 200)) continue;
        const name = p.n + (allies.has(pid) ? '  [Bund]' : '') + (p.tr8 ? '  !' : '');
        const sh_ = txt(name, size, [0, 0, 0], true); blit(sh_, sh_.get_rect({ center: [px + 1, py - (size >> 2) + 2] }));
        const t1 = txt(name, size, [255, 255, 255], true); blit(t1, t1.get_rect({ center: [px, py - (size >> 2)] }));
        const t2 = txt(fmt(p.tr), Math.max(12, size - 6), [255, 236, 190]); blit(t2, t2.get_rect({ center: [px, py + trunc(size / 3)] }));
      }
    }
    // Kampfjets (über allem)
    for (const [uid, o, , , tr] of st.planes) {
      const u = units.get(uid); if (!u) continue; const [px, py] = S(...this.upos(u, now)); if (!on_screen(px, py)) continue;
      const s_ = Math.max(12, z * 1.9), sk = (this.skins[o] || {}).jet, ang = Math.round(u[5] / 10) * 10;
      blitRot(sk ? gfx.skin_model(sk, s_ * 2, [0, 0, 0], true) : gfx.plane_model(s_, [0, 0, 0]), px + s_ * 0.6, py + s_ * 0.8, ang, 60 / 255);
      blitRot(sk ? gfx.skin_model(sk, s_ * 2, pcol(o)) : gfx.plane_model(s_, pcol(o)), px, py, ang);
      const t2 = txt(fmt(tr), Math.max(15, trunc(Math.min(28, z * 1.8))), [255, 255, 255], true), r2_ = t2.get_rect({ midbottom: [px, py - s_] });
      draw.rect([0, 0, 0], r2_.inflate(8, 2), 0, 6); blit(t2, r2_);
    }
    // Raketen im Bogen
    for (const e of st.mis) {
      const [uid, o, kind, sx0, sy0, tx0, ty0] = e, u = units.get(uid), prog = u ? this.upos(u, now)[0] : e[7], dist = Math.hypot(tx0 - sx0, ty0 - sy0);
      const arc = pr => { const gx = sx0 + (tx0 - sx0) * pr, gy = sy0 + (ty0 - sy0) * pr, hgt = Math.sin(Math.PI * pr) * (dist * 0.25 + 4); return S(gx, gy - hgt); };
      for (let j = 0; j < 8; j++) { const pr = prog - j * 0.02; if (pr <= 0) break; const c_ = 230 - j * 18; draw.circle([c_, c_, c_], arc(pr), Math.max(1, trunc((3 + j * 0.6) * Math.min(1.5, z / 3)))); }
      const p0 = arc(Math.max(0, prog - 0.01)), p1 = arc(prog), ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]), ln = Math.max(6, z * (kind === 'mirv' ? 2.2 : kind === 'big' ? 1.5 : 1.1));
      const tip = [p1[0] + Math.cos(ang) * ln * 0.5, p1[1] + Math.sin(ang) * ln * 0.5], tail = [p1[0] - Math.cos(ang) * ln * 0.5, p1[1] - Math.sin(ang) * ln * 0.5];
      const skm = (this.skins[o] || {})[kind === 'head' ? 'mirv' : kind];
      if (skm) blitRot(gfx.skin_model(skm, Math.max(12, ln * 1.6), pcol(o)), p1[0], p1[1], Math.round(ang * 180 / Math.PI / 15) * 15);
      else { draw.line([240, 240, 245], tail, tip, Math.max(2, trunc(ln * 0.3))); draw.circle(pcol(o), tip, Math.max(2, trunc(ln * 0.18))); draw.circle([255, 170, 60], tail, Math.max(2, trunc(ln * 0.16))); }
      if (owner[trunc(ty0) * W + trunc(tx0)] === me_) { const r_ = (BOMBS[kind] && kind !== 'mirv') ? BOMBS[kind].r : HEAD_R, pulse = 0.6 + 0.4 * Math.sin(now * 8); draw.circle([255, 60, 60], S(tx0, ty0), Math.max(4, trunc(r_ * z * pulse)), 2); }
    }
    // Explosionen und SAM-Schüsse
    const keep = [];
    for (const [f, t0] of this.anims) {
      const age = now - t0;
      if (f[0] === 'boom') {
        const life = 1.6; if (age > life) continue; keep.push([f, t0]);
        const [px, py] = S(f[1], f[2]); if (!on_screen(px, py, 600)) continue;
        const r_ = Math.max(4, f[3] * z), k_ = age / life, ease = 1 - (1 - Math.min(1.0, k_ * 2.5)) ** 3, rad = trunc(r_ * (0.3 + 0.9 * ease)) + 2, a1 = trunc(220 * (1 - k_));
        draw.circle([255, 120, 40, a1], [px, py], rad); draw.circle([255, 230, 150, trunc(a1 * 0.9)], [px, py], trunc(rad * 0.6 * (1 - k_ * 0.6)));
        draw.circle([255, 255, 255, trunc(255 * Math.max(0.0, 1 - k_ * 4))], [px, py], trunc(rad * 0.35)); draw.circle([80, 70, 70, trunc(120 * (1 - k_))], [px, py], rad, Math.max(1, trunc(rad / 8)));
      } else if (f[0] === 'gold') {
        const big_ = f.length > 5, life = big_ ? 3.2 : 1.8;
        if (f[4] !== me_ || age > life) continue; keep.push([f, t0]);
        if (!this.gold_seen.has(f)) { this.gold_seen.add(f); this.gold_pops.push([f[3], now, big_]); }
        const [px, py] = S(f[1], f[2]); if (!on_screen(px, py)) continue;
        const alpha = age < life - 0.6 ? 255 : trunc(255 * (1 - (age - life + 0.6) / 0.6)), lab = '+' + fmt(f[3]), fs_ = big_ ? 36 : 22, t1 = txt(lab, fs_, GOLD, true).copy(), t2 = txt(lab, fs_, [0, 0, 0], true).copy();
        t1.set_alpha(alpha); t2.set_alpha(alpha); const yy = py - 18 - age * 30, r1_ = t1.get_rect({ center: [px + 8, trunc(yy)] });
        blit(t2, r1_.move(1, 2)); blit(t1, r1_); ctx.globalAlpha = alpha / 255; gfx.icon_gold(r1_.x - 18, r1_.y + 2, 15); ctx.globalAlpha = 1;
      } else {
        if (age > 0.6) continue; keep.push([f, t0]);
        const p0 = S(f[1], f[2]), p1 = S(f[3], f[4]); draw.line([255, 255, 200], p0, p1, 2); draw.circle([255, 220, 120], p1, Math.max(3, trunc(z * (1 + age * 3))));
      }
    }
    this.anims = keep;

    // Reichweiten-Kreise
    const RANGE_COL = { B: [240, 200, 90], V: [240, 90, 90], L: [110, 175, 255], P: [90, 210, 230] };
    const draw_range = (tx, ty, r, col, alpha = 38) => { const [px, py] = S(tx, ty), rad = trunc(r * z); if (rad < 4) return; if (rad <= 700) draw.circle([...col, alpha], [px, py], rad); draw.circle([...col, 230], [px, py], rad, 2); };
    if (hover_tile !== null && !this.menu && !this.terrain_view) {
      const hx_t = hover_tile % W, hy_t = trunc(hover_tile / W), action = this.action;
      if (action && BTYPES[action]) {
        if (action === 'H' || action === 'F' || action === 'B') for (const [t, k, l] of st.bld) if (k === 'B' && owner[t] === me_ && (action !== 'B' || Math.max(Math.abs(t % W - hx_t), Math.abs(trunc(t / W) - hy_t)) > 2)) draw_range(t % W + 0.5, trunc(t / W) + 0.5, building_range('B', l), RANGE_COL.B, 22);
        if (building_range(action) > 0) {
          let sm = null; for (const [t, k, l] of st.bld) if (k === action && owner[t] === me_ && Math.max(Math.abs(t % W - hx_t), Math.abs(trunc(t / W) - hy_t)) <= 2) { sm = [t, l]; break; }
          if (sm) draw_range(sm[0] % W + 0.5, trunc(sm[0] / W) + 0.5, building_range(action, sm[1] + 1), RANGE_COL[action] || [255, 255, 255]);
          else if (action !== 'S') draw_range(hx_t + 0.5, hy_t + 0.5, building_range(action), RANGE_COL[action] || [255, 255, 255]);
        }
      } else if (!action) { const b = this.bld_at(hover_tile, 1); if (b && building_range(b[1], b[2]) > 0) draw_range(b[0] % W + 0.5, trunc(b[0] / W) + 0.5, building_range(b[1], b[2]), RANGE_COL[b[1]] || [255, 255, 255]); }
    }
    // Hover / Bau-Vorschau
    if (hover_tile !== null && !this.menu) {
      const [hx, hy] = S(hover_tile % W, trunc(hover_tile / W)), zz = Math.max(2, Math.ceil(z));
      if (this.action) {
        const [ok, why, up] = this.check(this.action, hover_tile), col = ok ? GREEN : [240, 90, 90];
        if (BOMBS[this.action]) {
          const r_ = BOMBS[this.action].r + (this.action === 'mirv' ? HEAD_R : 0), [cxp, cyp] = S(hover_tile % W + 0.5, trunc(hover_tile / W) + 0.5), rad = Math.max(4, trunc(r_ * z));
          draw.circle([255, 60, 40, 60], [cxp, cyp], rad); draw.circle(ok ? [255, 80, 60, 220] : [160, 160, 160, 200], [cxp, cyp], rad, 2);
          draw.line([255, 255, 255], [cxp - 8, cyp], [cxp + 8, cyp], 1); draw.line([255, 255, 255], [cxp, cyp - 8], [cxp, cyp + 8], 1);
        } else {
          const m_ = gfx.model(this.action !== 'S' ? this.action : 'P', Math.max(9, z * 2.4), [200, 200, 200]);
          if (ok && !up) { ctx.imageSmoothingEnabled = false; ctx.drawImage(m_.cv, hx + (zz >> 1) - (m_.w >> 1), hy + (zz >> 1) - (m_.h >> 1), m_.w, m_.h); }
          draw.rect(col, R(hx - zz, hy - zz, zz * 3, zz * 3), 2, 3);
        }
        const tip = why || (up ? 'Stufe erhöhen' : '');
        if (tip) { const t = txt(tip, 20, col, true); gfx.panel(t.get_rect({ topleft: [mx + 18, my + 10] }).inflate(14, 8), 205, 6); blit(t, [mx + 18, my + 10]); }
      } else {
        draw.rect([255, 255, 255], R(hx - 1, hy - 1, zz + 2, zz + 2), 1);
        const b = this.bld_at(hover_tile, 1);
        if ((hp || b) && !this.drag && !App.isTouch) {
          let t1, t2, chip;
          if (b) {
            const bo = players.get(owner[b[0]]), rng_ = building_range(b[1], b[2]);
            t1 = txt(`${BTYPES[b[1]].name}  ·  Stufe ${b[2]}`, 22, TEXT, true);
            t2 = txt(`gehört ${bo ? bo.n : '-'}` + (rng_ ? `  ·  Reichweite ${rng_} Felder` : '') + `  ·  ${BTYPES[b[1]].info}`, 18, DIM); chip = bo ? bo.c : [200, 200, 200];
          } else {
            let rel = hp.id === me_ ? 'Du' : (allies.has(hp.id) ? 'Verbündet' : (hp.b ? 'Bot' : (hp.on ? 'Spieler' : 'offline'))); if (hp.tr8) rel += ' · Verräter';
            t1 = txt(hp.n, 22, TEXT, true); t2 = txt(`${rel} · ${fmt(hp.tr)} Truppen · ${(100 * hp.ti / Math.max(1, st.land)).toFixed(1)} %`, 18, DIM); chip = hp.c;
          }
          const wtt = Math.max(t1.get_width(), t2.get_width()) + 34, tx0 = Math.min(mx + 18, sw - wtt - 6), rr = R(tx0, my + 14, wtt, 48);
          gfx.panel(rr, 205, 8); draw.circle(chip, [rr.x + 13, rr.y + 15], 6); blit(t1, [rr.x + 24, rr.y + 5]); blit(t2, [rr.x + 10, rr.y + 27]);
        }
      }
    }
    // ---------- Startpunkt wählen ----------
    if (choosing) {
      if (hover_tile !== null && !this.menu && !this.confirm_leave) {
        const ok = this.spawn_ok(hover_tile), [cxp, cyp] = S(hover_tile % W + 0.5, trunc(hover_tile / W) + 0.5), rad = Math.max(6, trunc(3.3 * z)), col = ok ? [90, 230, 120] : [240, 80, 80];
        draw.circle([...col, 90], [cxp, cyp], rad); draw.circle(col, [cxp, cyp], rad, 2);
        if (!ok) { const t = txt('Hier geht es nicht', 19, col, true); gfx.panel(t.get_rect({ topleft: [mx + 18, my + 10] }).inflate(14, 8), 205, 6); blit(t, [mx + 18, my + 10]); }
      }
      let l1, l2;
      if (pending) { const secs = phase > 0 ? phase : mp.sp; l1 = 'Wähle deinen Startpunkt!'; l2 = `${App.isTouch ? 'Tippe' : 'Klicke'} auf freies Land  ·  noch ${secs} s, sonst wird automatisch gewählt`; }
      else { l1 = `Startphase: noch ${phase} s`; l2 = `${App.isTouch ? 'Tippe' : 'Klicke'} woanders hin, um deinen Startpunkt zu ändern`; }
      const t1 = txt(l1, 34, GOLD, true), t2 = txt(l2, 20, TEXT), rr = R(0, 0, Math.max(t1.get_width(), t2.get_width()) + 50, 86); rr.midtop = [sw >> 1, 40];
      gfx.panel(rr, 230, 14); blit(t1, t1.get_rect({ center: [rr.centerx, rr.y + 28] })); blit(t2, t2.get_rect({ center: [rr.centerx, rr.y + 62] }));
    } else if (phase > 0) { const t = txt(`Startphase: noch ${phase} s`, 28, GOLD, true), rr = t.get_rect({ midtop: [sw >> 1, 40] }).inflate(30, 14); gfx.panel(rr, 230, 12); blit(t, t.get_rect({ center: rr.center })); }
    // ---------- Roter Rand bei Angriff ----------
    let danger = st.atk.some(e => e[1] === me_ && e[0] !== me_);
    if (!danger) for (const e of st.mis) if (owner[trunc(e[6]) * W + trunc(e[5])] === me_ && e[1] !== me_) { danger = true; break; }
    if (danger && mp && mp.a) {
      const strength = 0.55 + 0.45 * Math.sin(now * 5);
      for (let k = 0; k < 18; k++) draw.rect([230, 30, 30, trunc(150 * (1 - k / 18) ** 2 * strength)], R(k * 2, k * 2, sw - k * 4, sh - k * 4), 2);
      const t = txt('Du wirst angegriffen!', 24, [255, 255, 255], true), rr = t.get_rect({ midtop: [sw >> 1, 46] }).inflate(26, 10);
      draw.rect([190, 40, 40], rr, 0, 10); blit(t, t.get_rect({ center: rr.center }));
    }
    // ---------- Oberfläche ----------
    gfx.panel(r_stats); const x0 = r_stats.x + 14; let y = r_stats.y + 10;
    if (mp) {
      draw.circle(mp.c, [x0 + 7, y + 11], 7); blit(txt(mp.n, 26, TEXT, true), [x0 + 22, y]);
      if (mp.tr8) blit(txt('Verräter!', 20, ACCENT, true), [r_stats.right - 100, y + 4]);
      y += 32; gfx.icon_troops(x0, y + 1, 22);
      let t = txt(fmt(mp.tr), 30, TEXT, true); blit(t, [x0 + 30, y - 2]); blit(txt(`/ ${fmt(mp.mx)}`, 20, DIM), [x0 + 36 + t.get_width(), y + 5]);
      t = txt(`+${fmt(mp.trr)}/s`, 20, GREEN, true); blit(t, [r_stats.right - 14 - t.get_width(), y + 4]);
      y += 28; const bar = Math.min(1.0, mp.tr / Math.max(1, mp.mx));
      draw.rect([40, 46, 62], R(x0, y, r_stats.w - 28, 6), 0, 3); draw.rect(BLUE, R(x0, y, Math.max(4, trunc((r_stats.w - 28) * bar)), 6), 0, 3);
      y += 14; gfx.icon_gold(x0, y + 1, 22); const tg_ = txt(fmt(mp.g), 30, GOLD, true); blit(tg_, [x0 + 30, y - 2]);
      // "+100" direkt neben dem Gold, wenn Geld reinkommt (Zug oder Eroberung)
      this.gold_pops = this.gold_pops.filter(gp => now - gp[1] < 2.0).slice(-4);
      this.gold_pops.slice().reverse().forEach(([amt_, tt_, big_], k_) => {
        const a_ = now - tt_, al_ = a_ < 1.4 ? 255 : trunc(255 * (1 - (a_ - 1.4) / 0.6)), tp_ = txt('+' + fmt(amt_), big_ ? 24 : 20, big_ ? [255, 236, 120] : GOLD, true).copy();
        tp_.set_alpha(Math.max(0, al_)); blit(tp_, [x0 + 40 + tg_.get_width(), y + 2 - a_ * 14 - k_ * 20]);
      });
      if (!this.gold_pops.some(gp => gp[2])) { t = txt(`+${fmt(mp.gr)}/s`, 20, GOLD, true); blit(t, [r_stats.right - 14 - t.get_width(), y + 4]); }
      y += 32; const share = 100 * mp.ti / Math.max(1, st.land), secs = fdiv(st.tick, 10), tm = st.mode === 'endless' ? `Tag ${fdiv(secs, 60) + 1}` : `${fdiv(secs, 60)}:${String(secs % 60).padStart(2, '0')}`;
      blit(txt(`Land ${share.toFixed(1)} %   ·   ${mode.name}   ·   ${tm}`, 19, DIM), [x0, y]);
      if (!mp.a && !pending) { const tt = txt(st.respawn ? (App.isTouch ? 'Besiegt!  Hier tippen = neu starten' : 'Besiegt!  R = neu starten') : 'Besiegt!', 24, ACCENT, true); blit(tt, tt.get_rect({ center: [sw >> 1, 92] })); }
    }
    if (r_rows) { gfx.panel(r_rows, 170); rows.slice(0, 6).forEach(([s_, c_], n_) => blit(txt(s_, 19, c_), [28, r_rows.y + 7 + n_ * 22])); }
    // Rangliste
    gfx.panel(r_lb); blit(txt('Rangliste', 24, GOLD, true), [r_lb.x + 14, r_lb.y + 10]);
    if (this.host_info) { const t = txt(`Code: ${this.host_info}`, 16, DIM); blit(t, [r_lb.right - 12 - t.get_width(), r_lb.y + 15]); }
    lb_click.forEach(([r, pid], n_) => {
      const p = players.get(pid);
      if (pid === me_) draw.rect([60, 56, 30], r, 0, 6); else if (r.collidepoint(mx, my)) draw.rect([40, 45, 60], r, 0, 6);
      const col = pid === me_ ? GOLD : TEXT; blit(txt(`${n_ + 1}`, 19, DIM), [r.x + 6, r.y + 3]); draw.circle(p.c, [r.x + 34, r.y + 12], 6);
      blit(txt(p.n + (allies.has(pid) ? ' · Bund' : ''), 19, col, pid === me_), [r.x + 46, r.y + 3]);
      const t = txt(`${(100 * p.ti / Math.max(1, st.land)).toFixed(1)} %`, 19, col); blit(t, [r.right - 8 - t.get_width(), r.y + 3]);
    });
    // Ereignisse
    if (ev_lines.length) { gfx.panel(r_ev, 165); ev_lines.forEach((line, n_) => { const age = ev_lines.length - n_; blit(txt(line, 19, lerp_col([230, 234, 242], [130, 136, 150], Math.min(1.0, (age - 1) / 7))), [r_ev.x + 12, r_ev.y + 8 + n_ * 20]); }); }
    // Leiste unten
    gfx.panel(r_bar, 218, 16);
    if (this.chat_active) {
      const cr = R(r_bar.x, r_bar.y - 54, r_bar.w, 44); gfx.panel(cr, 230); const lab = txt('Chat: ', 24, TEXT); blit(lab, [r_bar.x + 16, r_bar.y - 44]);
      this.chat_text = App.field('chat', R(cr.x + 16 + lab.get_width(), cr.y + 4, cr.w - 32 - lab.get_width(), cr.h - 8), this.chat_text, true, 120, 24, true);
      if (!App.fieldShown('chat')) blit(txt(this.chat_text + (now % 1 < 0.5 ? '|' : ''), 24, TEXT), [r_bar.x + 16 + lab.get_width(), r_bar.y - 44]);
    }
    let t = txt('Angriff', 18, DIM, true); blit(t, [seg_rects[0].x - t.get_width() - 12, seg_rects[0].centery - (t.get_height() >> 1)]);
    seg_rects.forEach((r, k) => {
      const val = (k + 1) / 10, active = Math.abs(this.ratio - val) < 0.001;
      draw.rect(active ? ACCENT : (val <= this.ratio ? lerp_col([60, 40, 40], ACCENT, 0.45) : [38, 43, 58]), r, 0, 7);
      if (r.collidepoint(mx, my) && !active) draw.rect([120, 126, 150], r, 1, 7);
      let tt = txt(String((k + 1) % 10), 20, [255, 255, 255], true); blit(tt, tt.get_rect({ center: [r.centerx, r.y + 11] }));
      tt = txt(`${(k + 1) * 10}%`, 14, [235, 235, 240]); blit(tt, tt.get_rect({ center: [r.centerx, r.y + 25] }));
    });
    const mycol = pcol(me_);
    for (const [v, r] of via_rects) {
      const act = this.via === v;
      draw.rect(act ? [52, 96, 150] : (r.collidepoint(mx, my) ? [44, 50, 68] : [34, 39, 54]), r, 0, 7); draw.rect(act ? [140, 190, 255] : [64, 70, 92], r, act ? 2 : 1, 7);
      const cxv = r.x + 16, cyv = r.centery;
      if (v === 'land') blitRot(gfx.car_model(10, mycol), cxv, cyv, 0);
      else if (v === 'boat') blitRot(gfx.boat_model(12, mycol), cxv, cyv, 0);
      else if (v === 'plane') blitRot(gfx.plane_model(12, mycol), cxv, cyv, -90);
      else { draw.circle([200, 205, 220], [cxv, cyv], 7, 2); draw.circle([200, 205, 220], [cxv, cyv], 2); }
      const tt = txt(VIA_NAMES[v], 17, TEXT, act); blit(tt, [r.x + 30, r.centery - (tt.get_height() >> 1)]);
    }
    if (via_rects.length && !App.isTouch) { const tt = txt('Tab', 13, DIM); const lr = via_rects[via_rects.length - 1][1]; blit(tt, [lr.right - tt.get_width() - 3, lr.y - 13]); }
    const gold = mp ? mp.g : 0; let hover_b = null;
    for (const [k, r] of build_rects) {
      const c = this.cost(k), ok = gold >= c && (!BOMBS[k] || (mp && mp.sr > 0)), hov = r.collidepoint(mx, my), is_bomb = !!BOMBS[k];
      if (hov && !App.isTouch) hover_b = [k, r];
      const base_fill = is_bomb ? [60, 34, 34] : [34, 39, 54];
      draw.rect(this.action === k ? [58, 96, 74] : (hov ? lerp_col(base_fill, [255, 255, 255], 0.08) : base_fill), r, 0, 10);
      draw.rect(this.action === k ? GOLD : (is_bomb ? [120, 60, 60] : [64, 70, 92]), r, this.action === k ? 2 : 1, 10);
      if (k === 'S') blitRot(gfx.ship_model(14, mycol), r.centerx, r.y + 18, 0);
      else if (is_bomb) {
        const cx_ = r.centerx, cy_ = r.y + 18, ln = { small: 8, big: 11, mirv: 14 }[k];
        draw.line([235, 235, 240], [cx_ - ln, cy_ + (ln >> 1)], [cx_ + ln, cy_ - (ln >> 1)], 5); draw.circle([230, 70, 60], [cx_ + ln, cy_ - (ln >> 1)], 4);
        if (k === 'mirv') for (const d_ of [-6, 6]) draw.circle([230, 70, 60], [cx_ + ln - 4, cy_ - (ln >> 1) + d_], 3);
      } else { const m_ = gfx.model(k, 32, ok ? mycol : [120, 120, 120]); ctx.imageSmoothingEnabled = false; ctx.drawImage(m_.cv, r.centerx - 16, r.y + 2, 32, 32); }
      let tt = txt(this.kname(k), 17, ok ? TEXT : [115, 118, 130], true); if (tt.get_width() > r.w - 6) tt = txt(this.kname(k).split(' ').pop(), 17, ok ? TEXT : [115, 118, 130], true);
      blit(tt, tt.get_rect({ center: [r.centerx, r.y + 39] }));
      tt = txt(fmt(c), 15, gold >= c ? GOLD : [115, 118, 130]); blit(tt, tt.get_rect({ center: [r.centerx, r.y + 53] }));
      if (!App.isTouch) { tt = txt(BTYPES[k] ? BTYPES[k].key : BOMBS[k].key, 13, DIM); blit(tt, [r.right - 6 - tt.get_width(), r.y + 3]); }
    }
    if (hover_b) {
      const [k, r] = hover_b; let info = BTYPES[k] ? BTYPES[k].info : BOMBS[k].info;
      if (BOMBS[k] && mp) info += `  ·  Silos bereit: ${mp.sr}`; else if (BTYPES[k] && k !== 'S') info += '  ·  Nochmal bauen = Stufe erhöhen';
      const tt = txt(info, 19, TEXT), rr = tt.get_rect({ midbottom: [r.centerx, r_bar.y - 8] }).inflate(18, 10); rr.x = Math.max(6, Math.min(rr.x, sw - rr.w - 6));
      gfx.panel(rr, 230, 8); blit(tt, tt.get_rect({ center: rr.center }));
    }
    if (this.action) {
      const what = BOMBS[this.action] ? 'Ziel wählen' : 'platzieren';
      const tt = txt(App.isTouch ? `${this.kname(this.action)} ${what}  ·  Tippen  ·  Lange drücken bricht ab` : `${this.kname(this.action)} ${what}  ·  Linksklick (Shift = mehrere)  ·  Rechtsklick/Esc bricht ab`, 20, TEXT), rr = tt.get_rect({ midtop: [sw >> 1, 12] }).inflate(24, 12);
      gfx.panel(rr, 220, 10); blit(tt, tt.get_rect({ center: rr.center }));
    } else if (!this.show_help) { const tt = txt(App.isTouch ? 'Hilfe' : 'F1 Hilfe', 17, DIM); blit(tt, [(sw >> 1) - (tt.get_width() >> 1), 8]); }
    if (this.terrain_view) { const tt = txt('Geländeansicht (Leertaste)', 20, TEXT, true), rr = tt.get_rect({ midtop: [sw >> 1, 84] }).inflate(20, 10); gfx.panel(rr, 205, 8); blit(tt, tt.get_rect({ center: rr.center })); }
    if (this.menu) {
      [menu_box, menu_rects] = this.menu_layout(sw, sh); gfx.panel(menu_box, 235);
      blit(txt(this.menu.title, 22, GOLD, true), [menu_box.x + 14, menu_box.y + 9]);
      for (const [r, [lab, c_, ok]] of menu_rects) {
        if (ok && r.collidepoint(mx, my)) draw.rect([58, 66, 92], r, 0, 7);
        blit(txt(lab, 20, ok ? TEXT : [110, 114, 128]), [r.x + 10, r.y + 5]);
        if (c_) { const tt = txt(c_, 18, ok ? GOLD : [110, 114, 128]); blit(tt, [r.right - 10 - tt.get_width(), r.y + 6]); }
      }
    }
    if (this.show_help) {
      const lines = App.isTouch
        ? [['Steuerung', null], ['Tippen', 'angreifen (Boot/Kampfjet wenn nötig)'], ['Ziehen', 'Karte verschieben'], ['Zwei Finger', 'zoomen'], ['Leiste: Panzer/Schiff/Jet', 'Angriff mit ... wählen'], ['Lange drücken', 'Menü: bauen, Bomben, Bündnis'], ['Leiste: 10 ... 100 %', 'Angriffsstärke'], ['Leiste: Gebäude', 'antippen, dann aufs Land tippen'], ['Nochmal bauen', 'auf gleichem Gebäude = Stufe +1'], ['Lange drücken auf Reich', 'Bündnis, Truppen/Gold schicken'], ['Lange drücken auf dein Land', 'Gold in Truppen tauschen'], ['Chat', 'Knopf oben rechts (/a = nur Bund)'], ['Rangliste antippen', 'Kamera fliegt hin'], ['Hilfe antippen', 'Hilfe schließen']]
        : [['Steuerung', null], ['Linksklick', 'angreifen (Boot/Kampfjet wenn nötig)'], ['Ziehen / Pfeiltasten', 'Karte verschieben'], ['Mausrad', 'zoomen'], ['Tab', 'Angriff mit: Automatisch / Panzer / Schiff / Kampfjet'], ['Rechtsklick', 'Menü: bauen, Bomben, Bündnis'], ['1 ... 9, 0', 'Angriffsstärke 10 ... 100 %'], ['H F N P', 'Stadt, Fabrik, Bahnhof, Hafen'], ['L M V S', 'Flughafen, Silo, SAM, Kriegsschiff'], ['Q W E', 'Kleine Bombe, Große Bombe, MIRV'], ['Nochmal bauen', 'auf gleichem Gebäude = Stufe +1'], ['A / B (Maus auf Reich)', 'Bündnis anfragen / brechen'], ['T / G (Maus auf Reich)', 'Truppen / Gold an Verbündete'], ['Y  /  K  /  R', 'Bündnis annehmen / Gold->Truppen / Neustart'], ['Enter', 'Chat  (/a = nur Bund)'], ['Leertaste', 'Geländeansicht'], ['F3', '3D-Ansicht an/aus'], ['Klick auf Rangliste', 'Kamera fliegt hin'], ['F11', 'Vollbild'], ['Esc', 'Spiel verlassen / abbrechen']];
      const rr = R(0, 0, 660, lines.length * 28 + 30); rr.center = [sw >> 1, sh >> 1]; gfx.panel(rr, 240, 16);
      lines.forEach(([a, b], n_) => { const yy = rr.y + 16 + n_ * 28; if (b === null) blit(txt(a, 28, GOLD, true), [rr.x + 24, yy]); else { blit(txt(a, 21, TEXT, true), [rr.x + 24, yy + 4]); blit(txt(b, 21, DIM), [rr.x + 290, yy + 4]); } });
      if (App.isTouch) for (const ev of evs) if (ev.type === 'down' && rr.collidepoint(ev.pos)) this.show_help = false;
    }
    if (st.win) {
      t = txt(`${st.win} hat gewonnen!`, 70, GOLD, true); const rr = t.get_rect({ center: [sw >> 1, (sh >> 1) - 20] }).inflate(60, 90);
      gfx.panel(rr, 230, 20); blit(t, t.get_rect({ center: [sw >> 1, (sh >> 1) - 30] }));
      if (st.reset !== null && st.reset !== undefined) { t = txt(`Neue Runde in ${st.reset} s`, 28, TEXT); blit(t, t.get_rect({ center: [sw >> 1, (sh >> 1) + 22] })); }
    }
    if (r_chatb) { draw.rect(this.chat_active ? [52, 96, 150] : [44, 50, 68], r_chatb, 0, 9); t = txt('Chat', 19, [255, 255, 255], true); blit(t, t.get_rect({ center: r_chatb.center })); }
    draw.rect(r_leave.collidepoint(mx, my) ? [150, 52, 48] : [110, 40, 38], r_leave, 0, 9);
    t = txt(App.isTouch ? 'Verlassen' : 'Verlassen (Esc)', 19, [255, 255, 255], true); blit(t, t.get_rect({ center: r_leave.center }));
    draw.rect(r_3d.collidepoint(mx, my) ? [96, 66, 160] : [70, 48, 120], r_3d, 0, 9);
    t = txt(this.view3d ? (App.isTouch ? '2D' : '2D (F3)') : (App.isTouch ? '3D' : '3D (F3)'), 19, [255, 255, 255], true); blit(t, t.get_rect({ center: r_3d.center }));
    if (this.confirm_leave) {
      draw.rect([0, 0, 0, 120], R(0, 0, sw, sh)); gfx.panel(r_dlg, 245, 16);
      t = txt('Spiel wirklich verlassen?', 30, TEXT, true); blit(t, t.get_rect({ center: [r_dlg.centerx, r_dlg.y + 40] }));
      const sub = this.host_info ? (st.mode !== 'endless' ? 'Du bist Host: das Spiel endet für alle.' : 'Du bist Host: die Welt wird gespeichert, das Spiel endet für alle.') : 'Du kannst später mit dem Code wieder beitreten.';
      t = txt(sub, 19, DIM); blit(t, t.get_rect({ center: [r_dlg.centerx, r_dlg.y + 78] }));
      big_button(gfx, r_yes, 'Ja, verlassen', [170, 60, 52], mx, my, 24); big_button(gfx, r_no, 'Weiterspielen', [60, 160, 96], mx, my, 24);
    }
    if (!net.connected) {
      this.lost_at = this.lost_at || now;
      t = txt('Verbindung zum Host verloren - zurück zum Menü ...', 34, [255, 120, 120], true); const rr = t.get_rect({ center: [sw >> 1, sh >> 1] }).inflate(40, 30);
      gfx.panel(rr, 240); blit(t, t.get_rect({ center: rr.center }));
      if (now - this.lost_at > 3) return 'menu';
    }
  }
}
