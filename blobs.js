// FrontWars Web – Blobs: Figuren (Editor, Blob-Welt), Blob-Arena (3D-Shooter) – Port aus FrontWars.py
'use strict';

// ---------- weich schattierte Formen (wie soft_ellipse / soft_capsule) ----------
function soft_ellipse(c, col, rect, layers = 14, light = 0.35, shade = 0.62, hx = 0.32, hy = 0.25, lmul = 1) {
  const [x, y, w, h] = rect; layers = trunc(layers * lmul);
  for (let k = 0; k < layers; k++) {
    const f = k / Math.max(1, layers - 1), cc = lerp_col(dark(col, shade), lerp_col(col, [255, 255, 255], light), f);
    const ww = w * (1 - 0.72 * f), hh = h * (1 - 0.72 * f), cx_ = x + w / 2 + (hx - 0.5) * w * f * 0.9, cy_ = y + h / 2 + (hy - 0.5) * h * f * 0.9;
    if (ww <= 0 || hh <= 0) continue;
    c.fillStyle = css(cc); c.beginPath(); c.ellipse(cx_, cy_, ww / 2, hh / 2, 0, 0, Math.PI * 2); c.fill();
  }
}
function soft_capsule(c, col, p0, p1, r, layers = 6, lmul = 1) {
  layers = trunc(layers * lmul); c.lineCap = 'round';
  for (let k = 0; k < layers; k++) {
    const f = k / Math.max(1, layers - 1), cc = lerp_col(dark(col, 0.65), lerp_col(col, [255, 255, 255], 0.3), f), rr = Math.max(1, r * (1 - 0.6 * f)), o = r * 0.35 * f;
    c.strokeStyle = css(cc); c.lineWidth = Math.max(1, trunc(rr * 2)); c.beginPath(); c.moveTo(p0[0] - o, p0[1]); c.lineTo(p1[0] - o, p1[1]); c.stroke();
  }
  c.lineCap = 'butt';
}

class BlobRenderer {
  // Figuren in hoher Auflösung, weich skaliert; dazu der Raycaster der Blob-Arena
  constructor(quality = 'hd', k = 1.0) { this.k = k; this.lmul = k !== 1.0 ? Math.max(1.0, k * 0.9) : 1; this.cache = new Map(); this.set_quality(quality); }
  set_quality(q) { this.quality = BlobRenderer.QUALITY[q] ? q : 'hd'; this.div = BlobRenderer.QUALITY[this.quality]; this.size = null; }
  // ---------- Figuren ----------
  character(col, view, frame, flash, look) {
    const key = 'c' + col + view + frame + flash + (look ? look.join('|') : ''); let s = this.cache.get(key); if (s) return s;
    const [body_t, hat, pattern, paint] = look || ['rund', 'kein', 'keins', [255, 255, 255]];
    const [tw, hr, hip_f] = { schlank: [48, 30, 0.62], breit: [80, 34, 0.68], mini: [56, 39, 0.71] }[body_t] || [62, 33, 0.66];
    const W_ = BlobRenderer.CHAR_W, H_ = BlobRenderer.CHAR_H, k = this.k, lm = this.lmul;
    s = mkCanvas(W_ * k, H_ * k); const c = s.getContext('2d'); c.scale(k, k);
    const body = flash ? [252, 252, 252] : col, ph = frame / 8 * 2 * Math.PI, sw_ = Math.sin(ph), up_a = Math.max(0, Math.cos(ph)) * 6, up_b = Math.max(0, -Math.cos(ph)) * 6;
    const cx = W_ / 2, oy = BlobRenderer.CHAR_TOP, Hb = H_ - oy, hip_y = oy + Hb * hip_f, foot_y = H_ - 9, sh_y = oy + Hb * 0.43, far = dark(body, 0.8), lr = body_t !== 'breit' ? 12 : 14;
    let torso;
    if (view === 'front' || view === 'back') {
      const leg_dx = tw * 0.24;
      for (const [dx, up] of [[-leg_dx, up_a], [leg_dx, up_b]]) soft_capsule(c, dark(body, 0.9), [cx + dx, hip_y], [cx + dx * 1.15, foot_y - up], lr, 6, lm);
      const arm_dx = tw / 2 - 3;
      for (const [dx, kk] of [[-1, 1], [1, -1]]) soft_capsule(c, dark(body, 0.92), [cx + dx * arm_dx, sh_y + 4], [cx + dx * (arm_dx + 12), sh_y + 46 + kk * sw_ * 4], 10, 6, lm);
      torso = [cx - tw / 2, sh_y - 8, tw, hip_y - sh_y + 26]; soft_ellipse(c, body, torso, 14, 0.35, 0.62, 0.32, 0.25, lm);
    } else {
      const d = view === 'left' ? -1 : 1, sw2 = sw_ * 18;
      soft_capsule(c, far, [cx - 4, hip_y], [cx - d * sw2, foot_y - up_b], lr, 6, lm);
      soft_capsule(c, far, [cx, sh_y + 4], [cx + d * sw2 * 0.9, sh_y + 44], 10, 6, lm);
      const tw2 = tw * 0.78; torso = [cx - tw2 / 2, sh_y - 8, tw2, hip_y - sh_y + 26]; soft_ellipse(c, body, torso, 14, 0.35, 0.62, 0.5 + d * 0.15, 0.25, lm);
    }
    const hy0 = sh_y - 2 * hr + 6, head = [cx - hr, hy0, 2 * hr, 2 * hr], hx = view !== 'right' ? 0.32 : 0.5;
    if (hat === 'ohren') for (const dx of [-0.45, 0.45]) soft_ellipse(c, body, [cx + dx * hr - 8, hy0 - 26, 16, 44], 8, 0.3, 0.62, 0.32, 0.25, lm);
    soft_ellipse(c, body, head, 18, 0.45, 0.62, hx, 0.22, lm);
    if (pattern !== 'keins' && !flash) this._paint(c, pattern, paint, view, torso, head);
    if (view !== 'front' && view !== 'back') {
      const d = view === 'left' ? -1 : 1;
      soft_capsule(c, dark(body, 0.94), [cx + 4, hip_y], [cx + d * sw_ * 18, foot_y - up_a], lr, 6, lm);
      soft_capsule(c, dark(body, 0.96), [cx, sh_y + 4], [cx - d * sw_ * 18 * 0.9, sh_y + 44], 10, 6, lm);
    }
    this._hat(c, hat, paint, cx, hy0, hr, lm);
    if (this.cache.size > 700) this.cache.clear();
    this.cache.set(key, s); return s;
  }
  _paint(c, pattern, paint, view, torso, head) {
    // Bemalung nur auf dem Körper: Muster mit dem Körper maskieren (source-atop)
    const W_ = BlobRenderer.CHAR_W, H_ = BlobRenderer.CHAR_H, [tx, ty, tw, th] = torso, [hx, hy, hw, hh] = head;
    c.save(); c.globalCompositeOperation = 'source-atop'; c.fillStyle = `rgba(${paint[0]},${paint[1]},${paint[2]},${(215 / 255).toFixed(3)})`;
    const ell = (x, y, w, h) => { c.beginPath(); c.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); c.fill(); };
    const circ = (x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };
    if (pattern === 'bauch' && view !== 'back') ell(tx + tw * 0.22, ty + th * 0.22, tw * 0.56, th * 0.62);
    else if (pattern === 'streifen') for (let k = 0; k < 4; k++) c.fillRect(0, trunc(ty + th * (0.12 + k * 0.22)), W_, Math.max(3, trunc(th * 0.09)));
    else if (pattern === 'punkte') { for (const [fx_, fy_, r] of [[0.3, 0.3, 0.12], [0.68, 0.45, 0.1], [0.4, 0.7, 0.11], [0.25, 0.25, 0.0]]) circ(trunc(tx + tw * fx_), trunc(ty + th * fy_), Math.max(2, trunc(tw * r))); circ(trunc(hx + hw * 0.65), trunc(hy + hh * 0.3), Math.max(2, trunc(hw * 0.12))); }
    else if (pattern === 'halb') c.fillRect(trunc(W_ / 2), 0, W_, H_);
    else if (pattern === 'maske' && view !== 'back') c.fillRect(0, trunc(hy + hh * 0.38), W_, Math.max(4, trunc(hh * 0.2)));
    c.restore();
  }
  _hat(c, hat, paint, cx, hy0, hr, lm) {
    const poly = (pts, col) => { c.fillStyle = css(col); c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fill(); };
    const rr = (x, y, w, h, r, col) => { c.fillStyle = css(col); c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); c.fill(); };
    if (hat === 'helm') { soft_ellipse(c, [70, 96, 60], [cx - hr - 4, hy0 - 4, 2 * hr + 8, hr * 1.15], 10, 0.3, 0.62, 0.32, 0.25, lm); rr(trunc(cx - hr - 6), trunc(hy0 + hr * 0.42), trunc(2 * hr + 12), 6, 3, [52, 72, 44]); }
    else if (hat === 'krone') {
      const g = [246, 200, 60], gd = [196, 140, 30], y1 = hy0 + 8, y0 = hy0 - 12, pts = [[cx - 22, y1], [cx - 24, y0], [cx - 12, y0 + 9], [cx, y0 - 3], [cx + 12, y0 + 9], [cx + 24, y0], [cx + 22, y1]];
      poly(pts.map(([x, y]) => [x + 1, y + 2]), gd); poly(pts, g);
      for (const x of [cx - 12, cx, cx + 12]) { c.fillStyle = css([220, 50, 60]); c.beginPath(); c.arc(trunc(x), trunc(y1 - 6), 3, 0, Math.PI * 2); c.fill(); }
    } else if (hat === 'zylinder') {
      c.fillStyle = css([20, 20, 24]); c.beginPath(); c.ellipse(cx, hy0 + 9, 30, 7, 0, 0, Math.PI * 2); c.fill();
      rr(trunc(cx - 18), trunc(hy0 - 18), 36, 26, 4, [30, 30, 36]); c.fillStyle = css(paint); c.fillRect(trunc(cx - 18), trunc(hy0 + 1), 36, 5); rr(trunc(cx - 14), trunc(hy0 - 16), 6, 20, 3, [70, 70, 80]);
    } else if (hat === 'antenne') {
      c.strokeStyle = css([60, 60, 70]); c.lineWidth = 3; c.beginPath(); c.moveTo(cx + 6, hy0 + 6); c.lineTo(cx + 14, hy0 - 14); c.stroke();
      soft_ellipse(c, paint, [cx + 7, hy0 - 22, 15, 15], 6, 0.5, 0.62, 0.32, 0.25, lm);
    } else if (hat === 'horn') { poly([[cx - 7, hy0 + 8], [cx + 7, hy0 + 8], [cx + 2, hy0 - 18]], [226, 214, 180]); poly([[cx + 1, hy0 + 8], [cx + 7, hy0 + 8], [cx + 2, hy0 - 18]], [190, 176, 140]); }
  }
  glow(col) {
    const key = 'g' + col; let base = this.cache.get(key);
    if (!base) {
      base = mkCanvas(64, 64); const c = base.getContext('2d');
      for (let k = 0; k < 16; k++) { const f = k / 15, cc = lerp_col(col, [255, 255, 255], f * 0.8); c.fillStyle = `rgba(${cc[0]},${cc[1]},${cc[2]},${((60 + 195 * f) / 255).toFixed(3)})`; c.beginPath(); c.arc(32, 32, trunc(31 * (1 - f * 0.7)), 0, Math.PI * 2); c.fill(); }
      this.cache.set(key, base);
    }
    return base;
  }
  shadow() {
    let base = this.cache.get('shadow');
    if (!base) {
      base = mkCanvas(64, 20); const c = base.getContext('2d');
      for (let k = 0; k < 8; k++) { const f = k / 7; c.fillStyle = `rgba(0,0,0,${((18 + 22 * f) / 255).toFixed(3)})`; c.beginPath(); c.ellipse(32, 10, 32 * (1 - f * 0.6), 10 * (1 - f * 0.6), 0, 0, Math.PI * 2); c.fill(); }
      this.cache.set('shadow', base);
    }
    return base;
  }
  // Bild zentriert/positioniert zeichnen (weich skaliert)
  static put(img, x, y, w, h, alpha = 1) { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; if (alpha !== 1) ctx.globalAlpha = alpha; ctx.drawImage(img, x, y, w, h); ctx.globalAlpha = 1; }

  // ---------- Bild der Blob-Arena (Raycaster wie in FrontWars.py) ----------
  setup(sw, sh) {
    if (this.size && this.size[0] === sw && this.size[1] === sh) return;
    this.size = [sw, sh]; this.RW = Math.max(80, trunc(sw / this.div)); this.RH = Math.max(45, trunc(sh / this.div));
    this.low = mkCanvas(this.RW, this.RH); this.lc = this.low.getContext('2d'); this.zbuf = new Float64Array(this.RW).fill(1e9);
    this.bg = mkCanvas(this.RW, this.RH); const c = this.bg.getContext('2d'), half = trunc(this.RH / 2);
    for (let y = 0; y < this.RH; y++) { let cc; if (y < half) cc = lerp_col([70, 132, 214], [190, 222, 246], (y / half) ** 1.4); else cc = lerp_col([150, 182, 150], [70, 128, 66], ((y - half) / half) ** 0.7); c.fillStyle = css(cc); c.fillRect(0, y, this.RW, 1); }
  }
  render(game, cx, cy, ca, hide, sw, sh) {
    this.setup(sw, sh);
    const RW = this.RW, RH = this.RH, div = sw / RW, low = this.lc, g = game.arena.g, n = game.arena.n, zbuf = this.zbuf;
    low.drawImage(this.bg, 0, 0);
    const dirx = Math.cos(ca), diry = Math.sin(ca), FOV = BlobRenderer.FOV_PLANE, plx = -diry * FOV, ply = dirx * FOV, fogc = [190, 220, 244], floor_dark = [52, 92, 50];
    const vline = (col, x, y0, y1) => { if (y1 < y0) return; low.fillStyle = css(col); low.fillRect(x, y0, 1, y1 - y0 + 1); };
    for (let x = 0; x < RW; x++) {
      const camx = 2 * x / RW - 1, rdx = dirx + plx * camx, rdy = diry + ply * camx;
      let mapx = trunc(cx), mapy = trunc(cy); const ddx = rdx ? Math.abs(1 / rdx) : 1e30, ddy = rdy ? Math.abs(1 / rdy) : 1e30;
      let stepx, sdx, stepy, sdy;
      if (rdx < 0) { stepx = -1; sdx = (cx - mapx) * ddx; } else { stepx = 1; sdx = (mapx + 1 - cx) * ddx; }
      if (rdy < 0) { stepy = -1; sdy = (cy - mapy) * ddy; } else { stepy = 1; sdy = (mapy + 1 - cy) * ddy; }
      let side = 0, t = 0;
      for (let k = 0; k < 90; k++) {
        if (sdx < sdy) { sdx += ddx; mapx += stepx; side = 0; } else { sdy += ddy; mapy += stepy; side = 1; }
        if (mapx < 0 || mapy < 0 || mapx >= n || mapy >= n) { t = 1; break; }
        t = g[mapy][mapx]; if (t) break;
      }
      const dist = Math.max(0.05, side === 0 ? sdx - ddx : sdy - ddy); zbuf[x] = dist;
      const h = RH / dist, top = RH / 2 - h / 2, bot = top + h;
      let wx = side === 0 ? cy + dist * rdy : cx + dist * rdx; wx -= Math.floor(wx);
      const base = t === 2 ? ((wx < 0.08 || wx > 0.92) ? [120, 78, 40] : [196, 140, 80]) : [216, 208, 194];
      const e_ = Math.min(wx, 1 - wx), light = (side ? 0.8 : 1.0) * (0.86 + 0.14 * Math.min(1.0, e_ * 9)), fog = Math.min(1.0, dist / 26) ** 1.3;
      const col = lerp_col(dark(base, light), fogc, fog * 0.85), y0 = Math.max(0, trunc(top)), y1 = Math.min(RH - 1, trunc(bot));
      vline(col, x, y0, y1);
      if (h > 6) {
        vline(lerp_col(col, [255, 255, 255], 0.25), x, y0, Math.min(y1, y0 + Math.max(1, trunc(h * 0.04))));
        vline(dark(col, 0.82), x, Math.max(y0, trunc(bot - h * 0.18)), y1);
        if (t === 2 && h > 30) { const yy = trunc(top + h * 0.5); if (yy >= 0 && yy < RH) vline(dark(col, 0.7), x, yy, Math.min(RH - 1, yy + Math.max(1, trunc(h * 0.03)))); }
      }
      const ao = trunc(h * 0.12); if (ao > 0 && y1 < RH - 1) vline(lerp_col(floor_dark, fogc, fog * 0.6), x, y1 + 1, Math.min(RH - 1, y1 + ao));
    }
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(this.low, 0, 0, sw, sh);
    // Sonne
    const rel0 = ((-2.3 - ca + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    if (Math.abs(rel0) < 0.9) { const sx_ = sw / 2 + Math.tan(rel0) / FOV * sw / 2, s_ = sh * 0.32; BlobRenderer.put(this.glow([255, 236, 170]), sx_ - s_ / 2, sh * 0.16 - s_ / 2, s_, s_); }
    // Figuren, Schüsse, Kleckse
    const inv = 1.0 / (plx * diry - dirx * ply), items = [];
    for (const b of game.blobs) if (b.alive && b !== hide) items.push(['blob', b.x, b.y, b]);
    for (const s of game.shots) items.push(['shot', s.x, s.y, s]);
    for (const sp of game.splats) if (game.time - sp[3] < 0.4) items.push(['splat', sp[0], sp[1], sp]);
    const proj = [];
    for (const [kind, x, y, obj] of items) { const sx = x - cx, sy = y - cy, tx = inv * (diry * sx - dirx * sy), ty = inv * (-ply * sx + plx * sy); if (ty > 0.2) proj.push([ty, tx, kind, obj]); }
    proj.sort((a, b) => b[0] - a[0]);
    const tags = [];
    for (const [ty, tx, kind, obj] of proj) {
      const scr_x = sw / 2 * (1 + tx / ty), full = sh / ty, floor_y = sh / 2 + full / 2;
      let img, w, h, left, top;
      if (kind === 'blob') {
        const b = obj; h = full * 0.78 * BlobRenderer.CHAR_H / (BlobRenderer.CHAR_H - BlobRenderer.CHAR_TOP); w = h * BlobRenderer.CHAR_W / BlobRenderer.CHAR_H;
        const to_cam = Math.atan2(cy - b.y, cx - b.x), rel = (((to_cam - b.a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) - Math.PI, s_ = Math.sin(rel);
        const view = Math.abs(s_) >= 0.6 ? (s_ > 0 ? 'left' : 'right') : (Math.abs(rel) < Math.PI / 2 ? 'front' : 'back');
        const frame = b.moving ? trunc(b.walk * 1.4) % 8 : 0;
        img = this.character(game.colors[b.team], view, frame, b.hit_t > 0, game.looks ? game.looks.get(b) : null);
        left = trunc(scr_x - w / 2); top = trunc(floor_y - h);
        const lc = trunc(scr_x / div);
        if (lc >= 0 && lc < RW && zbuf[lc] > ty) { const shw = w * 0.9; BlobRenderer.put(this.shadow(), scr_x - shw / 2, floor_y - shw * 0.3 * 0.7, shw, shw * 0.3); if (ty < 14) tags.push([b, trunc(scr_x), top, ty]); }
      } else if (kind === 'shot') { const size = Math.max(4, full * 0.16); img = this.glow(game.colors[obj.team]); w = h = size; left = trunc(scr_x - w / 2); top = trunc(sh / 2 + full * 0.12 - h / 2); }
      else { const size = Math.max(6, full * 0.45); img = this.glow(obj[2]); w = h = size; left = trunc(scr_x - w / 2); top = trunc(sh / 2 + full * 0.1 - h / 2); }
      const c0 = Math.max(0, trunc(left / div)), c1 = Math.min(RW - 1, trunc((left + w - 1) / div)); if (c1 < c0) continue;
      let all = true; for (let c = c0; c <= c1; c++) if (zbuf[c] <= ty) { all = false; break; }
      ctx.imageSmoothingEnabled = true;
      if (all) ctx.drawImage(img, left, top, w, h);
      else for (let c = c0; c <= c1; c++) if (zbuf[c] > ty) {
        const sx0 = Math.max(left, c * div), sx1 = Math.min(left + w, (c + 1) * div); if (sx1 <= sx0) continue;
        const k = img.width / w; ctx.drawImage(img, (sx0 - left) * k, 0, (sx1 - sx0) * k, img.height, sx0, top, sx1 - sx0, h);
      }
    }
    return tags;
  }
}
BlobRenderer.FOV_PLANE = 0.66; BlobRenderer.QUALITY = { schnell: 3, hd: 2, ultra: 1 };
BlobRenderer.CHAR_W = 132; BlobRenderer.CHAR_H = 200; BlobRenderer.CHAR_TOP = 24;
const blob_look_tuple = b => [b.body, b.hat, b.pattern, BLOB_PAINTS[b.paint][1]];

// ---------------------------------------------------------------------------
// BLOB-SCHLACHT: Du bist ein Blob und kämpfst mit deinem Team
// ---------------------------------------------------------------------------
class BlobArena {
  // Arena als Raster: 0 = Boden, 1 = Mauer, 2 = Kiste
  constructor(n = 34, seed = null) {
    const rng = seed === null ? Math.random : seeded(seed), rr = k => Math.floor(rng() * k), rch = a => a[rr(a.length)];
    this.n = n; const g = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) g[0][i] = g[n - 1][i] = g[i][0] = g[i][n - 1] = 1;
    this.bases = [[4.5, 4.5], [n - 4.5, n - 4.5]];
    const near_base = (x, y) => this.bases.some(([bx, by]) => Math.abs(x - bx) < 5 && Math.abs(y - by) < 5);
    for (let q = 0; q < trunc(n * n / 26); q++) {
      const [w, h] = rch([[1, 1], [2, 2], [1, 3], [3, 1], [2, 1], [1, 2]]), x = 2 + rr(n - 4 - w), y = 2 + rr(n - 4 - h);
      let bad = false; for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < h; dy++) if (near_base(x + dx, y + dy)) bad = true;
      if (bad) continue; const t = rch([1, 2, 2]); for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < h; dy++) g[y + dy][x + dx] = t;
    }
    for (let q = 0; q < 4; q++) {
      const horiz = rng() < 0.5, L = 6 + rr(6), x = 4 + rr(n - 8 - (horiz ? L : 0)), y = 4 + rr(n - 8 - (horiz ? 0 : L)), gap = 1 + rr(L - 2);
      for (let k = 0; k < L; k++) { if (Math.abs(k - gap) <= 1) continue; const [xx, yy] = horiz ? [x + k, y] : [x, y + k]; if (!near_base(xx, yy)) g[yy][xx] = 1; }
    }
    this.g = g;
  }
  wall(x, y) { const ix = Math.floor(x), iy = Math.floor(y); if (ix < 0 || iy < 0 || ix >= this.n || iy >= this.n) return true; return this.g[iy][ix] !== 0; }
  free(x, y, r = 0.28) { return !(this.wall(x - r, y - r) || this.wall(x + r, y - r) || this.wall(x - r, y + r) || this.wall(x + r, y + r)); }
  los(x0, y0, x1, y1) { const d = Math.hypot(x1 - x0, y1 - y0), steps = trunc(d / 0.25) + 1; for (let k = 1; k < steps; k++) { const f = k / steps; if (this.wall(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f)) return false; } return true; }
}
class Blob {
  constructor(team, name, bot = true) {
    Object.assign(this, { team, name, bot, x: 0, y: 0, a: 0, hp: 100, alive: false, respawn: 0, cd: 0, kills: 0, deaths: 0, hit_t: 0, walk: 0, moving: false, _lw: 0, strafe: 1, strafe_t: 0, avoid_t: 0, avoid_dir: 1, think_t: 0, target: null, goal: null });
  }
}
class BlobGame {
  constructor({ team_size = 4, diff = 'medium', colors = [[222, 62, 56], [62, 122, 232]], target = 15, player_name = 'Du', seed = null, with_player = true, player_look = null } = {}) {
    this.arena = new BlobArena(34, seed); this.D = BLOB_DIFF[diff] || BLOB_DIFF.medium; this.colors = colors.slice(); this.target = target;
    this.scores = [0, 0]; this.blobs = []; this.shots = []; this.splats = []; this.feed = []; this.time = 0; this.winner = null; this.looks = new Map();
    const names = BLOB_BOT_NAMES.slice(); for (let i = names.length - 1; i > 0; i--) { const j = randrange(i + 1); [names[i], names[j]] = [names[j], names[i]]; }
    this.player = null;
    for (const team of [0, 1]) for (let k = 0; k < team_size; k++) {
      let b;
      if (team === 0 && k === 0 && with_player) { b = this.player = new Blob(0, player_name, false); if (player_look) this.looks.set(b, player_look); }
      else b = new Blob(team, names.length ? names.pop() : `Blob${k}`);
      this.blobs.push(b); this.spawn(b);
    }
  }
  spawn(b) {
    const [bx, by] = this.arena.bases[b.team]; let x = bx, y = by;
    for (let k = 0; k < 100; k++) { x = bx + uniform(-2.5, 2.5); y = by + uniform(-2.5, 2.5); if (this.arena.free(x, y)) break; }
    b.x = x; b.y = y; const [ex, ey] = this.arena.bases[1 - b.team]; b.a = Math.atan2(ey - y, ex - x); b.hp = 100; b.alive = true; b.cd = 0.5;
  }
  move(b, dx, dy) { if (this.arena.free(b.x + dx, b.y)) b.x += dx; if (this.arena.free(b.x, b.y + dy)) b.y += dy; }
  shoot(b, spread = 0) { const a = b.a + uniform(-spread, spread); this.shots.push({ x: b.x + Math.cos(a) * 0.4, y: b.y + Math.sin(a) * 0.4, dx: Math.cos(a) * BlobGame.SHOT_SPEED, dy: Math.sin(a) * BlobGame.SHOT_SPEED, team: b.team, owner: b, life: 1.6 }); }
  control_player(dt, fwd, side, turn, fire, sprint) {
    const b = this.player; if (!b || !b.alive || this.winner !== null) return;
    b.a += turn; const sp = (sprint ? 5.2 : 3.4) * dt, ca = Math.cos(b.a), sa = Math.sin(b.a), mx_ = ca * fwd - sa * side, my_ = sa * fwd + ca * side, ln = Math.hypot(mx_, my_);
    if (ln > 0) { this.move(b, mx_ / ln * sp * Math.min(1, ln), my_ / ln * sp * Math.min(1, ln)); b.walk += dt * (sprint ? 9 : 6); }
    if (fire && b.cd <= 0) { this.shoot(b); b.cd = 0.38; }
  }
  turn_to(b, ang, dt) { const diff = (((ang - b.a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) - Math.PI, step = this.D.turn * dt; b.a += Math.max(-step, Math.min(step, diff)); return Math.abs(diff); }
  bot_step(b, dt) {
    const D = this.D; b.think_t -= dt;
    if (b.think_t <= 0) {
      b.think_t = 0.25; let best = null, bd = D.view;
      for (const o of this.blobs) if (o.alive && o.team !== b.team) { const d = Math.hypot(o.x - b.x, o.y - b.y); if (d < bd && this.arena.los(b.x, b.y, o.x, o.y)) { best = o; bd = d; } }
      b.target = best;
      if (best === null) {
        const mate = (this.player && this.player.team === b.team && this.player.alive) ? this.player : null;
        if (mate && Math.hypot(mate.x - b.x, mate.y - b.y) > 5) b.goal = [mate.x, mate.y];
        else if (b.goal === null || Math.hypot(b.goal[0] - b.x, b.goal[1] - b.y) < 1.5 || rnd() < 0.05) { const [ex, ey] = this.arena.bases[1 - b.team], n = this.arena.n; b.goal = rnd() < 0.5 ? [ex, ey] : [uniform(3, n - 3), uniform(3, n - 3)]; }
      }
    }
    const sp = 3.0 * dt, ca = Math.cos(b.a), sa = Math.sin(b.a);
    if (b.target && b.target.alive) {
      const t = b.target, d = Math.hypot(t.x - b.x, t.y - b.y), err = this.turn_to(b, Math.atan2(t.y - b.y, t.x - b.x), dt);
      b.strafe_t -= dt; if (b.strafe_t <= 0) { b.strafe = choice([-1, 1]); b.strafe_t = uniform(0.6, 1.6); }
      const fwd = d > 6 ? 1 : (d < 3 ? -1 : 0), mx_ = ca * fwd - sa * b.strafe * 0.8, my_ = sa * fwd + ca * b.strafe * 0.8, ln = Math.hypot(mx_, my_);
      if (ln) { const ox = b.x, oy = b.y; this.move(b, mx_ / ln * sp, my_ / ln * sp); if (b.x === ox && b.y === oy) b.strafe = -b.strafe; b.walk += dt * 6; }
      if (b.cd <= 0 && err < 0.12 + D.err && this.arena.los(b.x, b.y, t.x, t.y)) { this.shoot(b, D.err); b.cd = D.cd * uniform(0.8, 1.3); }
    } else if (b.goal) {
      let ang = Math.atan2(b.goal[1] - b.y, b.goal[0] - b.x); if (b.avoid_t > 0) { b.avoid_t -= dt; ang += b.avoid_dir * 1.5; }
      this.turn_to(b, ang, dt); const ox = b.x, oy = b.y; this.move(b, Math.cos(b.a) * sp, Math.sin(b.a) * sp); b.walk += dt * 6;
      if (Math.hypot(b.x - ox, b.y - oy) < sp * 0.3 && b.avoid_t <= 0) { b.avoid_t = uniform(0.4, 0.9); b.avoid_dir = choice([-1, 1]); }
    }
  }
  step(dt) {
    if (this.winner !== null) return; this.time += dt;
    for (const b of this.blobs) {
      b.cd -= dt; b.hit_t = Math.max(0, b.hit_t - dt); b.moving = b.walk !== b._lw; b._lw = b.walk;
      if (!b.alive) { b.respawn -= dt; if (b.respawn <= 0) this.spawn(b); continue; }
      if (b.bot) this.bot_step(b, dt);
    }
    for (const s of this.shots) {
      s.life -= dt; const nx = s.x + s.dx * dt, ny = s.y + s.dy * dt;
      if (this.arena.wall(nx, ny)) { s.life = 0; this.splats.push([s.x, s.y, this.colors[s.team], this.time]); continue; }
      s.x = nx; s.y = ny;
      for (const b of this.blobs) if (b.alive && b.team !== s.team && Math.hypot(b.x - s.x, b.y - s.y) < 0.42) {
        s.life = 0; b.hp -= BlobGame.DAMAGE; b.hit_t = 0.25; this.splats.push([s.x, s.y, this.colors[s.team], this.time]);
        if (b.hp <= 0) {
          b.alive = false; b.respawn = BlobGame.RESPAWN; b.deaths++; s.owner.kills++; this.scores[s.team]++;
          this.feed.push([`${s.owner.name} hat ${b.name} erwischt!`, this.time, s.team]);
          if (this.scores[s.team] >= this.target) this.winner = s.team;
        }
        break;
      }
    }
    this.shots = this.shots.filter(s => s.life > 0); this.splats = this.splats.filter(sp => this.time - sp[3] < 6).slice(-120); this.feed = this.feed.slice(-6);
  }
}
BlobGame.SHOT_SPEED = 14.0; BlobGame.DAMAGE = 34; BlobGame.RESPAWN = 3.0;

// ---------------------------------------------------------------------------
// Blob-Editor im TABS-Stil: links deine Blob-Typen, Mitte Podest mit Vorschau, rechts Aussehen + Werte
// ---------------------------------------------------------------------------
class BlobEditorScreen {
  constructor(gfx) {
    this.gfx = gfx; this.need = [1180, 820]; this.data = load_blobs(); this.sel = this.data.active;
    this.rend = new BlobRenderer('hd', 0.5); this.big = new BlobRenderer('hd', 2.5);
    this.team_cols = [[214, 62, 52], [70, 130, 230], [70, 170, 96], [240, 184, 46], [162, 84, 212]];
    Object.assign(this, { team: 0, name_focus: false, walking: true, turn: true, view_i: 0, t0: performance.now() / 1000, status: 'Baue deinen eigenen Blob! Er läuft in der Blob-Welt für dich über die Karte.' });
  }
  cur() { return this.data.types[this.sel]; }
  layout(sw, sh) {
    const L = {}, n = this.data.types.length; L.left = R(20, 90, 260, sh - 110);
    const ch = Math.max(54, Math.min(74, trunc((L.left.h - 120) / Math.max(1, n))));
    L.cards = []; for (let k = 0; k < n; k++) L.cards.push(R(L.left.x + 12, L.left.y + 44 + k * (ch + 6), L.left.w - 24, ch));
    L.new = R(L.left.x + 12, L.left.y + 44 + n * (ch + 6) + 4, L.left.w - 24, 40);
    const right_w = Math.max(400, Math.min(480, sw - 860)), r = L.right = R(sw - right_w - 20, 90, right_w, sh - 110);
    const c = L.center = R(L.left.right + 20, 90, r.x - L.left.right - 40, sh - 110);
    L.teams = this.team_cols.map((_, k) => R(c.x + 16 + k * 46, c.bottom - 54, 38, 38));
    L.walk = R(c.right - 296, c.bottom - 54, 136, 38); L.turn = R(c.right - 152, c.bottom - 54, 136, 38);
    L.rotl = R(c.x + 16, c.y + c.h * 0.45, 44, 54); L.rotr = R(c.right - 60, c.y + c.h * 0.45, 44, 54);
    const x0 = r.x + 18, w0 = r.w - 36; let y = r.y + 14; L.name_y = y; L.name = R(x0, y + 22, w0, 36); y += 68;
    const row = (key, opts, per_row, bh = 32) => {
      L[key + '_y'] = y; y += 22; const bw = trunc((w0 - (per_row - 1) * 6) / per_row);
      L[key] = opts.map(([val, lab], k) => [val, lab, R(x0 + (k % per_row) * (bw + 6), y + trunc(k / per_row) * (bh + 6), bw, bh)]);
      y += Math.ceil(opts.length / per_row) * (bh + 6) + 6;
    };
    row('body', BLOB_BODIES, 4); row('hat', BLOB_HATS, 4); row('pattern', BLOB_PATTERNS, 3);
    L.paint_y = y; y += 22; const sz = Math.min(36, trunc((w0 - 7 * 6) / 8)); L.paint = BLOB_PAINTS.map((_, k) => [k, R(x0 + k * (sz + 6), y, sz, sz)]); y += sz + 14;
    L.stats_y = y; L.stats = BLOB_STATS.map(([key, lab, info], k) => { const yy = y + 24 + k * 54; return [key, lab, info, R(r.right - 18 - 80, yy, 36, 30), R(r.right - 18 - 38, yy, 36, 30), yy]; });
    y += 24 + BLOB_STATS.length * 54; const half = trunc((w0 - 8) / 2);
    L.use = R(x0, y, half, 34); L.del = R(x0 + half + 8, y, half, 34); L.save = R(x0, r.bottom - 58, half, 44); L.back = R(x0 + half + 8, r.bottom - 58, half, 44);
    return L;
  }
  points_left() { return STAT_BUDGET - Object.values(this.cur().stats).reduce((a, b) => a + b, 0); }
  leave(r) { this.data.active = Math.max(0, Math.min(this.data.types.length - 1, this.data.active)); save_blobs(this.data); return r; }
  frame(evs) {
    const gfx = this.gfx, sw = App.sw, sh = App.sh, mx = App.mx, my = App.my, VIEWS = ['front', 'right', 'back', 'left'], data = this.data;
    let L = this.layout(sw, sh);
    this.cur().name = App.live('bname', this.cur().name);
    for (const ev of evs) {
      if (handle_common(ev)) continue;
      if (ev.type === 'key') {
        if (this.name_focus) { if (ev.key === 'Enter' || ev.key === 'Escape') this.name_focus = false; continue; }
        if (ev.key === 'Escape') return this.leave('menu');
        if (ev.key === 'ArrowLeft') { this.view_i = (this.view_i + 3) % 4; this.turn = false; } else if (ev.key === 'ArrowRight') { this.view_i = (this.view_i + 1) % 4; this.turn = false; }
      }
      if (ev.type !== 'down' || ev.button !== 1) continue;
      const p = ev.pos; this.name_focus = L.name.collidepoint(p);
      L.cards.forEach((r, k) => { if (r.collidepoint(p)) this.sel = k; });
      if (L.new.collidepoint(p) && data.types.length < BLOB_MAX_TYPES) { data.types.push(default_blob(data.types.length)); data.types[data.types.length - 1].name = `Blob ${data.types.length}`; this.sel = data.types.length - 1; this.status = 'Neuer Blob! Gib ihm rechts einen Namen und ein Aussehen.'; }
      for (const key of ['body', 'hat', 'pattern']) for (const [val, , r] of L[key]) if (r.collidepoint(p)) this.cur()[key] = val;
      for (const [k, r] of L.paint) if (r.collidepoint(p)) this.cur().paint = k;
      for (const [key, , , rm, rp] of L.stats) {
        const st_ = this.cur().stats;
        if (rm.collidepoint(p) && st_[key] > STAT_MIN) st_[key]--;
        else if (rp.collidepoint(p)) { if (st_[key] >= STAT_MAX) this.status = 'Mehr geht nicht - das ist schon das Maximum.'; else if (this.points_left() <= 0) this.status = 'Keine Punkte mehr übrig! Nimm erst woanders einen weg.'; else st_[key]++; }
      }
      L.teams.forEach((r, k) => { if (r.collidepoint(p)) this.team = k; });
      if (L.walk.collidepoint(p)) this.walking = !this.walking;
      if (L.turn.collidepoint(p)) this.turn = !this.turn;
      if (L.rotl.collidepoint(p)) { this.view_i = (this.view_i + 3) % 4; this.turn = false; }
      if (L.rotr.collidepoint(p)) { this.view_i = (this.view_i + 1) % 4; this.turn = false; }
      if (L.use.collidepoint(p)) { data.active = this.sel; this.status = `${this.cur().name} läuft jetzt in der Blob-Welt für dich!`; }
      if (L.del.collidepoint(p)) {
        if (data.types.length > 1) { data.types.splice(this.sel, 1); if (data.active >= this.sel && data.active > 0) data.active--; this.sel = Math.max(0, this.sel - 1); this.status = 'Blob gelöscht.'; }
        else this.status = 'Einen Blob brauchst du mindestens.';
      }
      if (L.save.collidepoint(p)) this.status = save_blobs(data) ? 'Gespeichert! (im Browser)' : 'Speichern ging nicht: Browser-Speicher voll?';
      if (L.back.collidepoint(p)) return this.leave('menu');
    }
    this.sel = Math.max(0, Math.min(this.sel, data.types.length - 1)); L = this.layout(sw, sh);
    const now = performance.now() / 1000, tc = this.team_cols[this.team], b = this.cur(), look = blob_look_tuple(b), CW = BlobRenderer.CHAR_W, CH = BlobRenderer.CHAR_H;
    draw_background(gfx, sw, sh, 200);
    blit(gfx.txt('BLOB-EDITOR', 44, GOLD, true), [24, 26]);
    blit(gfx.txt('Körper, Hut und Bemalung aussuchen - alle Mitspieler sehen deinen Blob so!', 20, DIM), [330, 44]);
    gfx.panel(L.left, 225, 16); blit(gfx.txt('DEINE BLOBS', 18, DIM, true), [L.left.x + 16, L.left.y + 14]);
    L.cards.forEach((r, k) => {
      const bt = data.types[k], on_ = k === this.sel, hov = r.collidepoint(mx, my);
      draw.rect(on_ ? [66, 74, 104] : (hov ? [46, 52, 72] : [34, 39, 54]), r, 0, 12); draw.rect(on_ ? GOLD : [60, 66, 88], r, on_ ? 3 : 1, 12);
      const hh = r.h - 8; BlobRenderer.put(this.rend.character(tc, 'front', 0, false, blob_look_tuple(bt)), r.x + 8, r.y + 4, hh * CW / CH, hh);
      blit(gfx.txt(bt.name.slice(0, 14), 19, TEXT, true), [r.x + 62, r.y + 8]);
      blit(gfx.txt(BLOB_STATS.map(([key, lab]) => `${lab.slice(0, 6)} ${bt.stats[key]}`).join('  '), 15, DIM), [r.x + 62, r.y + 32]);
      if (k === data.active) { const t = gfx.txt('IM SPIEL', 13, [30, 30, 30], true), rr = anchorRect(t.w, t.h, { topleft: [r.right - 8 - t.w, r.y + 7] }).inflate(10, 4); draw.rect(GOLD, rr, 0, rr.h >> 1); blit(t, t.get_rect({ center: rr.center })); }
    });
    if (data.types.length < BLOB_MAX_TYPES) gfx.button(L.new, '+ Neuer Blob', { size: 21, hover: L.new.collidepoint(mx, my) });
    const c = L.center; gfx.panel(c, 215, 16);
    let t = gfx.txt(b.name, 36, TEXT, true); blit(t, t.get_rect({ center: [c.centerx, c.y + 40] }));
    const nm = (arr, k) => (arr.find(o => o[0] === k) || [0, k])[1];
    t = gfx.txt(`${nm(BLOB_BODIES, b.body)} · ${nm(BLOB_HATS, b.hat)} · ${nm(BLOB_PATTERNS, b.pattern)} (${BLOB_PAINTS[b.paint][0]})`, 19, DIM); blit(t, t.get_rect({ center: [c.centerx, c.y + 74] }));
    const pcx = c.centerx, pcy = c.y + c.h * 0.74;
    [[0.66, [40, 44, 58]], [0.6, [70, 76, 96]], [0.54, [96, 104, 128]]].forEach(([rw_, col_], k) => { const w_ = trunc(Math.min(c.w * rw_, c.h * rw_ * 1.3)); draw.ellipse(col_, [pcx - (w_ >> 1), pcy - w_ * 0.12 + k * 4, w_, trunc(w_ * 0.26)]); });
    if (this.turn) this.view_i = trunc((now - this.t0) * 1.1) % 4;
    const frame = this.walking ? trunc((now - this.t0) * 9) % 8 : 0, hgt = Math.min(c.h * 0.56, 2.5 * CH), wid = hgt * CW / CH;
    const shw = wid * 0.9; BlobRenderer.put(this.rend.shadow(), pcx - shw / 2, pcy - shw * 0.15, shw, shw * 0.3);
    const bob = this.walking ? Math.abs(Math.sin((now - this.t0) * 4.5)) * 5 : 0;
    BlobRenderer.put(this.big.character(tc, VIEWS[this.view_i], frame, false, look), trunc(pcx - wid / 2), trunc(pcy - hgt - bob + hgt * 0.03), wid, hgt);
    for (const [r, lab] of [[L.rotl, '<'], [L.rotr, '>']]) gfx.button(r, lab, { size: 30, hover: r.collidepoint(mx, my) });
    blit(gfx.txt('Teamfarbe:', 16, DIM), [c.x + 16, L.teams[0].y - 20]);
    L.teams.forEach((r, k) => { draw.rect(this.team_cols[k], r, 0, 8); draw.rect(k === this.team ? [255, 255, 255] : [20, 20, 26], r, k === this.team ? 3 : 1, 8); });
    gfx.button(L.walk, this.walking ? 'Laufen' : 'Stehen', { active: this.walking, size: 19, hover: L.walk.collidepoint(mx, my) });
    gfx.button(L.turn, 'Drehen', { active: this.turn, size: 19, hover: L.turn.collidepoint(mx, my) });
    t = gfx.txt(this.status, 18, [225, 230, 240]); blit(t, t.get_rect({ center: [c.centerx, L.teams[0].y - 34] }));
    const r = L.right, x0 = r.x + 18; gfx.panel(r, 225, 16);
    blit(gfx.txt('NAME', 16, DIM, true), [x0, L.name_y]); b.name = text_box(gfx, 'bname', L.name, b.name, this.name_focus, 23, 16);
    for (const [key, head] of [['body', 'KÖRPER'], ['hat', 'HUT'], ['pattern', 'BEMALUNG']]) { blit(gfx.txt(head, 16, DIM, true), [x0, L[key + '_y']]); for (const [val, lab, rr] of L[key]) gfx.button(rr, lab, { active: b[key] === val, size: 17, hover: rr.collidepoint(mx, my) }); }
    blit(gfx.txt('FARBE DER BEMALUNG', 16, DIM, true), [x0, L.paint_y]);
    for (const [k, rr] of L.paint) { draw.rect(BLOB_PAINTS[k][1], rr, 0, 7); draw.rect(k === b.paint ? GOLD : [20, 20, 26], rr, k === b.paint ? 3 : 1, 7); }
    const left = this.points_left(); blit(gfx.txt('WERTE', 16, DIM, true), [x0, L.stats_y]);
    t = gfx.txt(`Punkte übrig: ${left}`, 18, left > 0 ? GREEN : DIM, true); blit(t, [r.right - 18 - t.w, L.stats_y]);
    for (const [key, lab, info, rm, rp, yy] of L.stats) {
      const v = b.stats[key]; blit(gfx.txt(lab, 21, TEXT, true), [x0, yy]);
      for (let k = 0; k < STAT_MAX; k++) draw.rect(k < v ? lerp_col(GOLD, ACCENT, k / 6) : [48, 52, 66], R(x0 + 110 + k * 20, yy + 5, 16, 16), 0, 4);
      blit(gfx.txt(info, 15, DIM), [x0, yy + 28]); gfx.button(rm, '-', { size: 24, hover: rm.collidepoint(mx, my) }); gfx.button(rp, '+', { size: 24, hover: rp.collidepoint(mx, my) });
    }
    const is_on = data.active === this.sel;
    gfx.button(L.use, is_on ? 'Im Spiel: Ja' : 'Im Spiel benutzen', { active: is_on, size: 18, hover: L.use.collidepoint(mx, my) });
    gfx.button(L.del, 'Löschen', { size: 18, hover: L.del.collidepoint(mx, my), enabled: data.types.length > 1 });
    big_button(gfx, L.save, 'Speichern', [60, 160, 96], mx, my, 24); gfx.button(L.back, 'Zurück zum Menü', { size: 20, hover: L.back.collidepoint(mx, my) });
  }
}

// ---------------------------------------------------------------------------
// Blob-Schlacht: Einstellungen und Spiel
// ---------------------------------------------------------------------------
class BlobSetupScreen {
  constructor(gfx, cfg) { this.gfx = gfx; this.cfg = cfg; this.need = [600, 640]; if (!cfg.blob) cfg.blob = store.get('blobcfg', { size: 4, diff: 'medium', color: 0, enemy: 1, target: 15 }); }
  frame(evs) {
    const gfx = this.gfx, bc = this.cfg.blob, sw = App.sw, sh = App.sh, cx = sw >> 1, mx = App.mx, my = App.my, y0 = Math.max(150, (sh >> 1) - 250);
    const rows = [['Teamgröße', 'size'], ['Bot-Stärke', 'diff'], ['Deine Teamfarbe', 'color'], ['Gegnerfarbe', 'enemy'], ['Punkte zum Sieg', 'target']];
    const rects = rows.map(([, key], n) => [key, R(cx + 10, y0 + 70 + n * 56, 230, 42)]), r_start = R(cx - 240, y0 + 380, 230, 56), r_back = R(cx + 10, y0 + 380, 230, 56);
    for (const ev of evs) {
      if (handle_common(ev)) continue;
      if (ev.type === 'key' && ev.key === 'Escape') return 'menu';
      if (ev.type === 'key' && ev.key === 'Enter') { store.set('blobcfg', bc); return 'start'; }
      if (ev.type === 'down' && ev.button === 1) {
        if (r_start.collidepoint(ev.pos)) { store.set('blobcfg', bc); return 'start'; }
        if (r_back.collidepoint(ev.pos)) return 'menu';
        for (const [key, r] of rects) {
          if (!r.collidepoint(ev.pos)) continue;
          if (key === 'size') bc.size = bc.size % 8 + 1;
          else if (key === 'diff') bc.diff = DIFF_ORDER[(DIFF_ORDER.indexOf(bc.diff) + 1) % 3];
          else if (key === 'target') bc.target = { 10: 15, 15: 25, 25: 50, 50: 10 }[bc.target] || 15;
          else { let v = (bc[key] + 1) % BLOB_COLORS.length; const other = key === 'color' ? 'enemy' : 'color'; if (v === bc[other]) v = (v + 1) % BLOB_COLORS.length; bc[key] = v; }
        }
      }
    }
    draw_background(gfx, sw, sh); gfx.panel(R(cx - 280, y0 - 90, 560, 560), 215, 18);
    let t = gfx.txt('Blob-Schlacht', 64, GOLD, true); blit(t, t.get_rect({ center: [cx, y0 - 40] }));
    t = gfx.txt('Du bist ein Blob - kämpfe mit deinem Team!', 22, DIM); blit(t, t.get_rect({ center: [cx, y0 + 10] }));
    rows.forEach(([lab], n) => blit(gfx.txt(lab, 24, TEXT), [cx - 240, y0 + 80 + n * 56]));
    for (const [key, r] of rects) {
      const hov = r.collidepoint(mx, my);
      if (key === 'color' || key === 'enemy') { const [name, col] = BLOB_COLORS[bc[key]]; draw.rect(hov ? lerp_col(col, [255, 255, 255], 0.12) : col, r, 0, 10); t = gfx.txt(name, 24, [255, 255, 255], true); }
      else { draw.rect(hov ? [46, 52, 70] : [34, 39, 54], r, 0, 10); draw.rect([70, 78, 100], r, 1, 10); t = gfx.txt({ size: `${bc.size} gegen ${bc.size}`, diff: BLOB_DIFF[bc.diff].name, target: `${bc.target} Punkte` }[key], 24, TEXT, true); }
      blit(t, t.get_rect({ center: r.center }));
    }
    big_button(gfx, r_start, "Los geht's!", [60, 160, 96], mx, my, 30); gfx.button(r_back, 'Zurück', { size: 26, hover: r_back.collidepoint(mx, my) });
    t = gfx.txt(App.isTouch ? 'Links: Joystick laufen · Rechts wischen: umsehen · Rund-Knopf: schießen' : 'WASD laufen · Maus umsehen · Klick schießen · V Ego/Außen · Shift rennen · Esc Pause', 19, DIM);
    blit(t, t.get_rect({ center: [cx, y0 + 460] }));
  }
}

class BlobBattleScreen {
  constructor(gfx, game) {
    this.gfx = gfx; this.game = game; this.need = [1000, 560]; this.rend = new BlobRenderer(App.isTouch ? 'schnell' : 'hd');
    Object.assign(this, { view: 'third', paused: false, turn_acc: 0, recoil: 0, mini: null, rawTouch: App.isTouch, wantLock: !App.isTouch, joy: null, look: null, fireT: null, mouseHeld: false });
  }
  leave(r) { this.wantLock = false; App.unlockPointer(); return r; }
  frame(evs, dt) {
    const gfx = this.gfx, game = this.game, me = game.player, sw = App.sw, sh = App.sh, mx = App.mx, my = App.my, txt = (s, z, c, b) => gfx.txt(s, z, c, b);
    dt = Math.min(0.05, dt); let fire = false;
    const r_cont = R((sw >> 1) - 150, (sh >> 1) - 10, 300, 54), r_quit = R((sw >> 1) - 150, (sh >> 1) + 56, 300, 54);
    // Touch-Knöpfe
    const fireR = Math.min(70, sh * 0.13), fireC = [sw - fireR - 40, sh - fireR - 50], r_view = R(sw - 230, 76, 100, 44), r_pause = R(sw - 120, 76, 100, 44);
    this.wantLock = !App.isTouch && !this.paused && game.winner === null;
    if (!App.isTouch && this.wantLock && !App.pointerLocked() && !this.paused && this.hadLock) { this.paused = true; }   // Esc löst die Maus: Pause
    if (App.pointerLocked()) this.hadLock = true;
    for (const ev of evs) {
      if (handle_common(ev)) continue;
      if (ev.type === 'key') {
        if (ev.key === 'Escape') { if (game.winner !== null) return this.leave('menu'); this.paused = true; }
        else if (ev.key === 'v') this.view = this.view === 'third' ? 'ego' : 'third';
        else if (ev.key === 'g') { const order = ['schnell', 'hd', 'ultra']; this.rend.set_quality(order[(order.indexOf(this.rend.quality) + 1) % 3]); }
        else if (ev.key === 'Enter' && game.winner !== null) return this.leave('menu');
      } else if (ev.type === 'move' && !this.paused && ev.mrel) this.turn_acc += ev.mrel[0] * 0.0032;
      else if (ev.type === 'down' && ev.button === 1) {
        if (this.paused) { if (r_cont.collidepoint(ev.pos)) { this.paused = false; this.hadLock = false; } else if (r_quit.collidepoint(ev.pos)) return this.leave('menu'); }
        else if (game.winner !== null) return this.leave('menu');
        else { fire = true; this.mouseHeld = true; }
      } else if (ev.type === 'up' && ev.button === 1) this.mouseHeld = false;
      // ---------- Touch ----------
      else if (ev.type === 'tstart') {
        const p = ev.pos;
        if (this.paused) { if (r_cont.collidepoint(p)) this.paused = false; else if (r_quit.collidepoint(p)) return this.leave('menu'); continue; }
        if (game.winner !== null) return this.leave('menu');
        if (r_pause.collidepoint(p)) { this.paused = true; continue; }
        if (r_view.collidepoint(p)) { this.view = this.view === 'third' ? 'ego' : 'third'; continue; }
        if (Math.hypot(p[0] - fireC[0], p[1] - fireC[1]) < fireR * 1.25) { this.fireT = ev.id; fire = true; continue; }
        if (p[0] < sw * 0.45 && !this.joy) this.joy = { id: ev.id, ox: p[0], oy: p[1], x: p[0], y: p[1] };
        else if (!this.look) this.look = { id: ev.id, lx: p[0] };
      } else if (ev.type === 'tmove') {
        if (this.joy && ev.id === this.joy.id) { this.joy.x = ev.pos[0]; this.joy.y = ev.pos[1]; }
        else if (this.look && ev.id === this.look.id) { this.turn_acc += (ev.pos[0] - this.look.lx) * 0.009; this.look.lx = ev.pos[0]; }
      } else if (ev.type === 'tend') {
        if (this.joy && ev.id === this.joy.id) this.joy = null; else if (this.look && ev.id === this.look.id) this.look = null; else if (ev.id === this.fireT) this.fireT = null;
      }
    }
    const k = App.keys;
    if (!this.paused) {
      let fwd = ((k.has('w') || k.has('ArrowUp')) ? 1 : 0) - ((k.has('s') || k.has('ArrowDown')) ? 1 : 0), side = (k.has('d') ? 1 : 0) - (k.has('a') ? 1 : 0), sprint = k.has('Shift');
      if (this.joy) { const JR = Math.min(90, sh * 0.16), dx = (this.joy.x - this.joy.ox) / JR, dy = (this.joy.y - this.joy.oy) / JR, l = Math.hypot(dx, dy); fwd = -dy / Math.max(1, l); side = dx / Math.max(1, l); sprint = l > 1.15; }
      const turn = this.turn_acc + ((k.has('ArrowRight') ? 1 : 0) - (k.has('ArrowLeft') ? 1 : 0)) * 2.6 * dt;
      const shoot = fire || this.mouseHeld || k.has('Space') || this.fireT !== null;
      if (shoot && me.alive && me.cd <= 0) this.recoil = 1.0;
      game.control_player(dt, fwd, side, turn, shoot, sprint); game.step(dt);
    }
    this.turn_acc = 0; this.recoil = Math.max(0, this.recoil - dt * 6);
    // Kamera
    let cam_x, cam_y, cam_a, hide;
    if (this.view === 'ego' || !me.alive) { cam_x = me.x; cam_y = me.y; cam_a = me.a; hide = me; }
    else {
      const ca_ = Math.cos(me.a), sa_ = Math.sin(me.a); let back = 2.5, side_ = 0.55;
      while (back > 0.4 && (game.arena.wall(me.x - ca_ * back - sa_ * side_, me.y - sa_ * back + ca_ * side_) || !game.arena.los(me.x, me.y, me.x - ca_ * back - sa_ * side_, me.y - sa_ * back + ca_ * side_))) { back -= 0.2; side_ *= 0.85; }
      cam_x = me.x - ca_ * back - sa_ * side_; cam_y = me.y - sa_ * back + ca_ * side_; cam_a = me.a; hide = null;
    }
    const tags = this.rend.render(game, cam_x, cam_y, cam_a, hide, sw, sh);
    for (const [b, sx, top, dist] of tags) {
      if (b === me) continue;
      const px = sx, py = top - 8, col = game.colors[b.team], t = txt(b.name, dist > 5 ? 18 : 22, [255, 255, 255], true), r_ = t.get_rect({ midbottom: [px, py - 6] });
      draw.rect([0, 0, 0], r_.inflate(10, 2), 0, 6); blit(t, r_); draw.rect([30, 30, 30], R(px - 22, py - 4, 44, 5)); draw.rect(col, R(px - 22, py - 4, trunc(44 * Math.max(0, b.hp) / 100), 5));
    }
    if (this.view === 'ego' && me.alive) {
      const bob = Math.sin(me.walk * 2) * sh * 0.012, k_ = sh / 720, gx = trunc(sw * 0.74), gy = trunc(sh * 0.9 + bob + this.recoil * 28 * k_), col = game.colors[me.team];
      soft_ellipse(ctx, col, [gx - 40 * k_, gy - 10 * k_, 150 * k_, 190 * k_], 16, 0.4); soft_ellipse(ctx, [70, 74, 86], [gx - 70 * k_, gy - 70 * k_, 120 * k_, 90 * k_], 12, 0.35);
      soft_ellipse(ctx, lerp_col(col, [255, 255, 255], 0.15), [gx - 92 * k_, gy - 92 * k_, 56 * k_, 56 * k_], 10, 0.5); soft_ellipse(ctx, col, [gx - 30 * k_, gy - 40 * k_, 70 * k_, 70 * k_], 12, 0.45);
      if (this.recoil > 0.4) { const s_ = trunc(110 * k_ * this.recoil); BlobRenderer.put(this.rend.glow(col), gx - 64 * k_ - s_ / 2, gy - 66 * k_ - s_ / 2, s_, s_); }
    }
    if (!App.isTouch) blit(txt(`Grafik: ${this.rend.quality.toUpperCase()}  (G)`, 16, DIM), [12, sh - 26]);
    const cxh = sw >> 1, cyh = sh >> 1;
    for (const [dx, dy] of [[-14, 0], [6, 0], [0, -14], [0, 6]]) draw.rect([255, 255, 255], R(cxh + dx, cyh + dy, dy === 0 ? 8 : 2, dx === 0 ? 8 : 2));
    draw.circle([255, 255, 255], [cxh, cyh], 2);
    if (me.hit_t > 0) draw.rect([230, 40, 40, Math.min(255, trunc(500 * me.hit_t))], R(0, 0, sw, sh), 26);
    const [c0, c1] = game.colors, sc = R((sw >> 1) - 150, 12, 300, 54); gfx.panel(sc, 200);
    let t = txt(String(game.scores[0]), 38, c0, true); blit(t, t.get_rect({ center: [sc.x + 70, sc.centery] }));
    t = txt(String(game.scores[1]), 38, c1, true); blit(t, t.get_rect({ center: [sc.right - 70, sc.centery] }));
    t = txt(`bis ${game.target}`, 18, DIM); blit(t, t.get_rect({ center: sc.center }));
    game.feed.slice(-5).forEach(([msg, , team], n) => { const tt = txt(msg, 19, [255, 255, 255]), x_ = sw - 16 - tt.w; gfx.panel(R(x_ - 10, 12 + n * 28, tt.w + 20, 26), 170, 8); draw.rect(game.colors[team], R(x_ - 10, 12 + n * 28, 5, 26)); blit(tt, [x_, 15 + n * 28]); });
    // Minikarte
    const n_ = game.arena.n, ms = 5;
    if (!this.mini) { this.mini = mkCanvas(n_ * ms, n_ * ms); const mc = this.mini.getContext('2d'); mc.fillStyle = css([40, 52, 40]); mc.fillRect(0, 0, n_ * ms, n_ * ms); for (let yy = 0; yy < n_; yy++) for (let xx = 0; xx < n_; xx++) { const v = game.arena.g[yy][xx]; if (v) { mc.fillStyle = css(v === 1 ? [150, 156, 170] : [150, 108, 64]); mc.fillRect(xx * ms, yy * ms, ms, ms); } } }
    const mr = R(14, 14, n_ * ms, n_ * ms); ctx.imageSmoothingEnabled = false; ctx.drawImage(this.mini, mr.x, mr.y); draw.rect([255, 255, 255], mr, 2);
    for (const b of game.blobs) {
      if (!b.alive) continue; if (b.team !== me.team && !(me.alive && game.arena.los(me.x, me.y, b.x, b.y))) continue;
      const p_ = [trunc(mr.x + b.x * ms), trunc(mr.y + b.y * ms)]; draw.circle(game.colors[b.team], p_, b === me ? 5 : 3);
      if (b === me) { draw.circle([255, 255, 255], p_, 6, 2); draw.line([255, 255, 255], p_, [p_[0] + trunc(Math.cos(b.a) * 10), p_[1] + trunc(Math.sin(b.a) * 10)], 2); }
    }
    const hb = R(20, sh - 56, 280, 34); gfx.panel(hb.inflate(12, 12), 200); draw.rect([40, 20, 20], hb, 0, 8); draw.rect(game.colors[me.team], R(hb.x, hb.y, trunc(hb.w * Math.max(0, me.hp) / 100), hb.h), 0, 8);
    t = txt(`${Math.max(0, trunc(me.hp))} Leben`, 22, [255, 255, 255], true); blit(t, t.get_rect({ center: hb.center }));
    t = txt(`${this.view === 'ego' ? 'Ego' : 'Außen'}-Ansicht${App.isTouch ? '' : ' (V)'}   ·   ${me.kills} Treffer / ${me.deaths} erwischt`, 18, DIM); blit(t, [hb.right + 24, hb.centery - 9]);
    // Touch-Steuerung zeichnen
    if (App.isTouch && game.winner === null && !this.paused) {
      const JR = Math.min(90, sh * 0.16);
      if (this.joy) { draw.circle([255, 255, 255, 50], [this.joy.ox, this.joy.oy], JR); draw.circle([255, 255, 255, 120], [this.joy.ox, this.joy.oy], JR, 3); const dx = this.joy.x - this.joy.ox, dy = this.joy.y - this.joy.oy, l = Math.hypot(dx, dy), f = l > JR ? JR / l : 1; draw.circle([255, 255, 255, 170], [this.joy.ox + dx * f, this.joy.oy + dy * f], JR * 0.42); }
      else { const t2 = txt('Hier ziehen = laufen', 18, [255, 255, 255, 170]); blit(t2, [40, sh - 120]); }
      draw.circle([...game.colors[me.team], this.fireT !== null ? 230 : 150], fireC, fireR); draw.circle([255, 255, 255, 200], fireC, fireR, 4);
      t = txt('FEUER', 22, [255, 255, 255], true); blit(t, t.get_rect({ center: fireC }));
      for (const [r, lab] of [[r_view, this.view === 'ego' ? 'Außen' : 'Ego'], [r_pause, 'Pause']]) { gfx.panel(r, 190, 10); t = txt(lab, 20, [255, 255, 255], true); blit(t, t.get_rect({ center: r.center })); }
    }
    if (!me.alive && game.winner === null) { t = txt(`Du wurdest erwischt!  Zurück in ${Math.max(0, Math.round(me.respawn))} s`, 40, [255, 255, 255], true); const r_ = t.get_rect({ center: [sw >> 1, (sh >> 1) + 90] }).inflate(40, 24); gfx.panel(r_, 220); blit(t, t.get_rect({ center: r_.center })); }
    if (game.winner !== null) {
      const win = game.winner === me.team, t1 = txt(win ? 'SIEG!' : 'Verloren!', 90, win ? GOLD : [255, 120, 120], true);
      const cname = (BLOB_COLORS.find(([, c]) => same(c, game.colors[game.winner])) || ['?'])[0];
      const t2 = txt(`Team ${cname} gewinnt ${game.scores[game.winner]} : ${game.scores[1 - game.winner]}`, 30, TEXT), t3 = txt(App.isTouch ? 'Tippen: zurück' : 'Klick oder Enter: zurück', 22, DIM);
      const r_ = R(0, 0, Math.max(t1.w, t2.w) + 80, 230); r_.center = [sw >> 1, sh >> 1]; gfx.panel(r_, 235, 20);
      blit(t1, t1.get_rect({ center: [sw >> 1, r_.y + 70] })); blit(t2, t2.get_rect({ center: [sw >> 1, r_.y + 140] })); blit(t3, t3.get_rect({ center: [sw >> 1, r_.y + 190] }));
    }
    if (this.paused) {
      draw.rect([0, 0, 0, 140], R(0, 0, sw, sh)); t = txt('Pause', 64, TEXT, true); blit(t, t.get_rect({ center: [sw >> 1, (sh >> 1) - 70] }));
      big_button(gfx, r_cont, 'Weiterspielen', [60, 160, 96], mx, my, 26); gfx.button(r_quit, 'Zurück zum Menü', { size: 24, hover: r_quit.collidepoint(mx, my) });
    } else if (!App.isTouch) {
      t = txt(App.pointerLocked() ? 'WASD laufen · Maus umsehen · Klick schießen · V Ansicht · Shift rennen · Esc Pause' : 'Klick ins Bild: Maus fangen (zum Umsehen)', 17, [235, 235, 240]); blit(t, [sw - t.w - 16, sh - 30]);
    }
  }
}
