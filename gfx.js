// FrontWars Web – Grafik: ein kleiner pygame-Nachbau auf Canvas, damit alles aussieht wie im Original
'use strict';

const BG = [14, 17, 24], TEXT = [236, 239, 245], DIM = [150, 158, 175], GOLD = [246, 196, 72], ACCENT = [235, 96, 70], GREEN = [110, 214, 130], BLUE = [110, 175, 255];
const WATER_DEEP = [24, 58, 104], WATER_SHALLOW = [78, 140, 190], SAND = [222, 208, 160], GRASS_L = [168, 196, 122], GRASS_D = [118, 158, 94], HILL = [170, 160, 122], EDIT_LAND = [140, 180, 104];
const FONT_STACK = '"Segoe UI","Helvetica Neue",Helvetica,Arial,"DejaVu Sans","Liberation Sans",sans-serif';

function lerp_col(a, b, t) { t = t < 0 ? 0 : (t > 1 ? 1 : t); return [0, 1, 2].map(k => Math.max(0, Math.min(255, trunc(a[k] + (b[k] - a[k]) * t)))); }
function dark(c, f = 0.6) { return [0, 1, 2].map(k => Math.max(0, Math.min(255, trunc(c[k] * f)))); }
function css(c) { if (typeof c === 'string') return c; return c.length === 4 ? `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${(c[3] / 255).toFixed(3)})` : `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`; }

class Rect {
  constructor(x, y, w, h) { this.x = Math.round(x); this.y = Math.round(y); this.w = Math.round(w); this.h = Math.round(h); }
  get right() { return this.x + this.w; } get bottom() { return this.y + this.h; }
  get centerx() { return this.x + (this.w >> 1); } get centery() { return this.y + (this.h >> 1); }
  get center() { return [this.centerx, this.centery]; } get topleft() { return [this.x, this.y]; } get bottomright() { return [this.right, this.bottom]; }
  set center(p) { this.x = Math.round(p[0] - this.w / 2); this.y = Math.round(p[1] - this.h / 2); }
  set midtop(p) { this.x = Math.round(p[0] - this.w / 2); this.y = Math.round(p[1]); }
  collidepoint(x, y) { if (Array.isArray(x)) [x, y] = x; return x >= this.x && x < this.x + this.w && y >= this.y && y < this.y + this.h; }
  inflate(dx, dy) { return new Rect(this.x - Math.trunc(dx / 2), this.y - Math.trunc(dy / 2), this.w + dx, this.h + dy); }
  move(dx, dy) { return new Rect(this.x + dx, this.y + dy, this.w, this.h); }
}
const R = (x, y, w, h) => new Rect(x, y, w, h);
function anchorRect(w, h, o) {
  const r = new Rect(0, 0, w, h);
  if (o.center) { r.x = Math.round(o.center[0] - w / 2); r.y = Math.round(o.center[1] - h / 2); }
  else if (o.topleft) { r.x = Math.round(o.topleft[0]); r.y = Math.round(o.topleft[1]); }
  else if (o.midbottom) { r.x = Math.round(o.midbottom[0] - w / 2); r.y = Math.round(o.midbottom[1] - h); }
  else if (o.midtop) { r.x = Math.round(o.midtop[0] - w / 2); r.y = Math.round(o.midtop[1]); }
  return r;
}

// aktueller Zeichen-Kontext (vom Hauptprogramm gesetzt)
let ctx = null;
const measureCtx = document.createElement('canvas').getContext('2d');
const draw = {
  path(r, radius) { ctx.beginPath(); if (radius > 0 && ctx.roundRect) ctx.roundRect(r.x, r.y, r.w, r.h, Math.min(radius, r.w / 2, r.h / 2)); else ctx.rect(r.x, r.y, r.w, r.h); },
  rect(c, r, width = 0, radius = 0) {
    if (Array.isArray(r)) r = R(...r);
    if (r.w <= 0 || r.h <= 0) return;
    if (!width) { ctx.fillStyle = css(c); draw.path(r, radius); ctx.fill(); }
    else { ctx.strokeStyle = css(c); ctx.lineWidth = width; const h = width / 2; draw.path(new Rect(r.x + h, r.y + h, r.w - width, r.h - width), Math.max(0, radius - h)); ctx.stroke(); }
  },
  circle(c, p, rad, width = 0) {
    if (rad <= 0) return; ctx.beginPath();
    if (!width) { ctx.arc(p[0], p[1], rad, 0, Math.PI * 2); ctx.fillStyle = css(c); ctx.fill(); }
    else { ctx.arc(p[0], p[1], Math.max(0.5, rad - width / 2), 0, Math.PI * 2); ctx.strokeStyle = css(c); ctx.lineWidth = width; ctx.stroke(); }
  },
  line(c, a, b, width = 1) { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.strokeStyle = css(c); ctx.lineWidth = Math.max(1, width); ctx.lineCap = 'butt'; ctx.stroke(); },
  polygon(c, pts, width = 0) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]); ctx.closePath();
    if (!width) { ctx.fillStyle = css(c); ctx.fill(); } else { ctx.strokeStyle = css(c); ctx.lineWidth = width; ctx.lineJoin = 'miter'; ctx.stroke(); }
  },
  ellipse(c, r) { ctx.beginPath(); ctx.ellipse(r[0] + r[2] / 2, r[1] + r[3] / 2, r[2] / 2, r[3] / 2, 0, 0, Math.PI * 2); ctx.fillStyle = css(c); ctx.fill(); },
};

class Txt {
  constructor(s, size, col, bold) {
    this.s = s; this.px = Math.max(8, trunc(size * 0.72)); this.font = `${bold ? 700 : 400} ${this.px}px ${FONT_STACK}`; this.col = col; this.alpha = 1;
    measureCtx.font = this.font; this.w = Math.ceil(measureCtx.measureText(s).width); this.h = Math.ceil(this.px * 1.32);
  }
  get_width() { return this.w; } get_height() { return this.h; }
  get_rect(o) { return anchorRect(this.w, this.h, o || { topleft: [0, 0] }); }
  copy() { const t = Object.create(Txt.prototype); Object.assign(t, this); return t; }
  set_alpha(a) { this.alpha = a / 255; }
  blit(x, y) { ctx.globalAlpha = this.alpha; ctx.font = this.font; ctx.fillStyle = css(this.col); ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillText(this.s, x, y + this.h / 2 + 0.5); ctx.globalAlpha = 1; }
}
// blit(Fläche, Position oder Rect)
function blit(s, pos) { const [x, y] = pos instanceof Rect ? [pos.x, pos.y] : pos; if (s instanceof Txt) s.blit(x, y); else { ctx.globalAlpha = s.alpha === undefined ? 1 : s.alpha; ctx.drawImage(s.cv || s, x, y); ctx.globalAlpha = 1; } }

function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
// gedrehtes Modell zentriert zeichnen (wie pygame.transform.rotate(s, -ang) + get_rect(center=...))
function blitRot(m, cx, cy, ang, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(cx, cy); ctx.rotate(ang * Math.PI / 180);
  ctx.imageSmoothingEnabled = !m.pixel; ctx.drawImage(m.cv, -m.w / 2, -m.h / 2, m.w, m.h); ctx.restore();
}

class Gfx {
  constructor() { this.cache = new Map(); this.models = new Map(); }
  font(size, bold = false) { const px = Math.max(8, trunc(size * 0.72)); return { size: s => { measureCtx.font = `${bold ? 700 : 400} ${px}px ${FONT_STACK}`; return [Math.ceil(measureCtx.measureText(s).width), Math.ceil(px * 1.32)]; }, get_height: () => Math.ceil(px * 1.32) }; }
  txt(s, size = 22, col = TEXT, bold = false) {
    const key = s + '|' + size + '|' + col + '|' + bold; let t = this.cache.get(key);
    if (!t) { if (this.cache.size > 5000) this.cache.clear(); t = new Txt(s, size, col, bold); this.cache.set(key, t); }
    return t;
  }
  panel(rect, alpha = 205, radius = 12) {
    draw.rect([16, 19, 27, alpha], rect, 0, radius);
    draw.rect([255, 255, 255, 30], rect, 1, radius);
  }
  button(rect, label, { active = false, enabled = true, size = 22, sub = null, hover = false } = {}) {
    const fill = active ? [58, 96, 74] : (hover && enabled ? [52, 58, 76] : (enabled ? [38, 43, 58] : [30, 32, 40]));
    draw.rect(fill, rect, 0, 9);
    draw.rect(active ? GOLD : [70, 76, 96], rect, active ? 2 : 1, 9);
    const col = enabled ? TEXT : [105, 108, 120];
    if (sub) {
      let t = this.txt(label, size, col, true); blit(t, t.get_rect({ center: [rect.centerx, rect.y + rect.h * 0.36] }));
      t = this.txt(sub, size - 4, enabled ? GOLD : [105, 108, 120]); blit(t, t.get_rect({ center: [rect.centerx, rect.y + rect.h * 0.72] }));
    } else { const t = this.txt(label, size, col); blit(t, t.get_rect({ center: rect.center })); }
  }
  icon_troops(x, y, s, col = BLUE) {
    draw.circle(col, [x + s * 0.5, y + s * 0.28], Math.max(2, trunc(s * 0.2)));
    ctx.fillStyle = css(col); ctx.beginPath(); const r = trunc(s * 0.3);
    if (ctx.roundRect) ctx.roundRect(x + s * 0.2, y + s * 0.5, s * 0.6, s * 0.45, [r, r, 0, 0]); else ctx.rect(x + s * 0.2, y + s * 0.5, s * 0.6, s * 0.45); ctx.fill();
  }
  icon_gold(x, y, s) {
    const c = [x + s / 2, y + s / 2];
    draw.circle([196, 140, 30], c, s * 0.48); draw.circle(GOLD, c, s * 0.40); draw.circle([255, 232, 150], [c[0] - s * 0.12, c[1] - s * 0.12], Math.max(1, s * 0.1));
  }

  // ---------- Gebäude als 3D-Pixel-Icons (isometrisch, 32x32, scharf vergrößert) ----------
  model(kind, size, col) {
    size = trunc(size); if (size >= 48) size = Math.round(size / 8.0) * 8; size = Math.max(16, size);
    return icon_model(this._iso_icon(kind, col), size);
  }
  _iso_icon(kind, col) {
    const key = 'iso' + kind + col; let s = this.models.get(key); if (s) return s;
    const N = Gfx.ICON_RES; s = mkCanvas(N, N); const c = s.getContext('2d'); const GX = 16, GY = Gfx.ICON_GROUND_Y;
    const P = (x, y, z = 0) => [GX + (x - y), GY + (x + y) * 0.5 - z];
    const poly = (pts, cc) => { c.fillStyle = css(cc); c.beginPath(); pts.forEach((p, i) => { const q = P(...p); i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.closePath(); c.fill(); };
    const line = (a, b, cc, w = 1) => { const p = P(...a), q = P(...b); c.strokeStyle = css(cc); c.lineWidth = w; c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.stroke(); };
    const px = (x, y, z, cc) => { const q = P(x, y, z); if (q[0] >= 0 && q[0] < N && q[1] >= 0 && q[1] < N) { c.fillStyle = css(cc); c.fillRect(Math.floor(q[0]), Math.floor(q[1]), 1, 1); } };
    const box = (x0, y0, w, d, h, cc, z0 = 0.0, top = null, win = null) => {
      const x1 = x0 + w, y1 = y0 + d, z1 = z0 + h;
      poly([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], dark(cc, 0.84));
      poly([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], dark(cc, 0.64));
      poly([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], top || lerp_col(cc, [255, 255, 255], 0.2));
      if (win) for (let zz = z0 + 2; zz < z1 - 1; zz += 2) { for (let xx = x0 + 1; xx < x1 - 0.5; xx += 2) px(xx, y1, zz, win); for (let yy = y0 + 1; yy < y1 - 0.5; yy += 2) px(x1, yy, zz, dark(win, 0.75)); }
    };
    const plate = lerp_col(col, [255, 255, 255], 0.45); box(-6.5, -6.5, 13, 13, 1.5, col, 0, plate);
    const Z = 1.5, win = [178, 214, 240];
    if (kind === 'H') {
      box(-5.5, -5.5, 4.5, 4.5, 15, [206, 208, 214], Z, col, win); box(0.5, -5.5, 4.5, 4.5, 9, [226, 214, 190], Z, dark(col, 0.85), win);
      box(-5.5, 0.5, 4.5, 4.5, 7, [196, 186, 170], Z, dark(col, 0.85), win); box(0.8, 0.8, 4.7, 4.7, 11, [232, 230, 224], Z, col, win);
    } else if (kind === 'F') {
      box(3.0, -6.0, 2.2, 2.2, 13, [168, 72, 58], Z, [60, 50, 48]);
      for (const k of [5, 9]) { px(3.0, -3.8, k, [235, 235, 235]); px(4.0, -3.8, k, [235, 235, 235]); }
      box(-6.0, -3.0, 10.5, 9, 5, [166, 170, 178], Z, [150, 154, 162], [110, 140, 170]);
      for (let k = 0; k < 3; k++) box(-6.0 + k * 3.5, -3.0, 2.6, 9, 2.2, col, Z + 5);
    } else if (kind === 'B') {
      box(-4.5, -6.0, 9, 4.5, 6, [236, 226, 204], Z, col, win); px(0, -1.5, Z + 4.5, [255, 255, 255]);
      box(-6.0, -1.0, 12, 3, 1, [198, 194, 186], Z);
      for (const xx of [-5.5, 5.0]) box(xx, 0.0, 0.6, 0.6, 3.5, [80, 80, 88], Z + 1);
      box(-6.2, -1.5, 12.4, 3.8, 0.8, col, Z + 4.5);
      for (const yy of [3.6, 5.4]) line([-6.5, yy, Z], [6.5, yy, Z], [70, 70, 78]);
      for (let xx = -6; xx < 7; xx += 2) line([xx, 3.0, Z], [xx, 6.0, Z], [110, 80, 54]);
    } else if (kind === 'P') {
      poly([[-6.5, 1.0, Z], [6.5, 1.0, Z], [6.5, 6.5, Z], [-6.5, 6.5, Z]], [70, 132, 192]);
      for (const q of [[-4, 3], [1, 4.5], [4, 2.5], [-1, 5.5]]) px(q[0], q[1], Z, [150, 200, 235]);
      box(-1.5, -1.0, 3, 7.5, 0.8, [142, 100, 62], Z); box(-6.0, -6.0, 5, 5, 4.5, [206, 196, 176], Z, col);
      box(1.5, -6.0, 3, 2.2, 2.2, [230, 120, 50], Z); box(1.5, -3.5, 3, 2.2, 2.2, [70, 120, 200], Z); box(1.5, -6.0, 3, 2.2, 2.2, col, Z + 2.2);
      box(-1.0, -1.0, 1, 1, 12, [236, 190, 40], Z); box(-1.0, -1.0, 1, 7.5, 1, [236, 190, 40], Z + 12);
      line([-0.5, 5.5, Z + 12], [-0.5, 5.5, Z + 6], [50, 50, 50]);
    } else if (kind === 'L') {
      poly([[-6.5, 1.8, Z], [6.5, 1.8, Z], [6.5, 5.8, Z], [-6.5, 5.8, Z]], [70, 72, 80]);
      for (let xx = -6; xx < 7; xx += 3) line([xx, 3.8, Z], [xx + 1.4, 3.8, Z], [240, 240, 240]);
      box(-6.0, -6.0, 7, 4.5, 4, [220, 226, 235], Z, [176, 186, 198], [110, 170, 230]);
      box(2.6, -5.6, 1.6, 1.6, 10, [205, 205, 212], Z); box(2.1, -6.1, 2.6, 2.6, 1.8, [110, 170, 230], Z + 10, col);
      line([-3.5, 3.8, Z + 1], [2.5, 3.8, Z + 1], [248, 248, 250], 2); line([-0.5, 2.0, Z + 1], [-0.5, 5.6, Z + 1], col, 1); line([-3.2, 3.0, Z + 1], [-3.2, 4.6, Z + 1], col, 1);
    } else if (kind === 'M') {
      box(-5.5, -5.5, 11, 11, 2, [150, 150, 148], Z, [172, 172, 170]);
      for (let k = -5; k < 6; k++) { const cc = k % 2 === 0 ? [238, 196, 50] : [30, 30, 30]; px(k, -5.5, Z + 2, cc); px(5.5, k, Z + 2, cc); px(k, 5.5, Z + 2, cc); px(-5.5, k, Z + 2, cc); }
      poly([[-3, -3, Z + 2], [3, -3, Z + 2], [3, 3, Z + 2], [-3, 3, Z + 2]], [40, 40, 46]);
      box(-1.0, -1.0, 2, 2, 10, [238, 238, 242], Z + 2); box(-0.7, -0.7, 1.4, 1.4, 2.5, col, Z + 12);
      box(-1.6, -0.3, 0.6, 0.6, 2.5, col, Z + 2); box(1.0, -0.3, 0.6, 0.6, 2.5, col, Z + 2);
    } else if (kind === 'V') {
      box(-5.0, -2.0, 10, 5, 1, [40, 40, 40], Z); box(-5.0, -2.0, 10, 5, 2.5, [98, 110, 74], Z + 1, [112, 124, 86]);
      box(3.0, -2.0, 2.5, 5, 3.5, [88, 100, 66], Z + 1, [104, 116, 80]);
      for (const yy of [-1.0, 0.5, 2.0]) { line([-3.5, yy, Z + 4], [2.0, yy - 3.0, Z + 11], [240, 240, 244], 2); px(2.0, yy - 3.0, Z + 11, col); }
      line([4.2, 0.5, Z + 4.5], [4.2, 0.5, Z + 8], [70, 70, 70]);
      const q = P(3.0, 0.5, Z + 9.5); c.fillStyle = css([215, 215, 222]); c.beginPath(); c.ellipse(q[0] + 2.5, q[1] + 1.5, 2.5, 1.5, 0, 0, 7); c.fill();
    }
    this.models.set(key, s); return s;
  }
  _cached(key, w, h, paint, pixel = false) {
    let m = this.models.get(key);
    if (!m) { if (this.models.size > 900) this.models.clear(); const cv = mkCanvas(w, h); paint(cv.getContext('2d'), w, h); m = { cv, w, h, pixel }; this.models.set(key, m); }
    return m;
  }
  car_model(size, col) {
    size = Math.max(6, trunc(size / 2) * 2); const L = trunc(size * 2.1), Wd = size;
    return this._cached('tank' + size + col, L, Wd, (c) => {
      const body_l = L * 0.7, fr = (cc, x, y, w, h, r) => { c.fillStyle = css(cc); c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); c.fill(); };
      for (const yy of [0.0, 0.74]) { fr([38, 38, 40], 0, Wd * yy, body_l, Wd * 0.26, Math.max(1, Wd >> 3)); c.strokeStyle = css([80, 80, 84]); c.lineWidth = 1; for (let k = 0; k < 5; k++) { const xx = body_l * (0.1 + k * 0.2); c.beginPath(); c.moveTo(xx, Wd * yy); c.lineTo(xx, Wd * (yy + 0.26)); c.stroke(); } }
      fr(dark(col, 0.8), body_l * 0.06, Wd * 0.18, body_l * 0.9, Wd * 0.64, Math.max(1, trunc(Wd / 6)));
      c.strokeStyle = css([25, 25, 30]); c.strokeRect(body_l * 0.06 + .5, Wd * 0.18 + .5, body_l * 0.9 - 1, Wd * 0.64 - 1);
      c.strokeStyle = css([50, 52, 56]); c.lineWidth = Math.max(2, trunc(Wd / 6)); c.beginPath(); c.moveTo(body_l * 0.5, Wd * 0.5); c.lineTo(L - 1, Wd * 0.5); c.stroke();
      c.fillStyle = css(col); c.beginPath(); c.arc(body_l * 0.45, Wd * 0.5, Math.max(2, Wd * 0.3), 0, 7); c.fill();
      c.strokeStyle = css([25, 25, 30]); c.lineWidth = 1; c.stroke();
      c.fillStyle = css(dark(col, 0.6)); c.beginPath(); c.arc(body_l * 0.38, Wd * 0.42, Math.max(1, Wd * 0.08), 0, 7); c.fill();
    });
  }
  plane_model(size, col) {
    size = Math.max(10, trunc(size / 2) * 2); const L = size * 2;
    return this._cached('jet' + size + col, L, L, (c) => {
      const cc = L / 2, body = [190, 196, 206], poly = (pts, k, stroke) => { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); if (stroke) { c.strokeStyle = css(k); c.lineWidth = 1; c.stroke(); } else { c.fillStyle = css(k); c.fill(); } };
      poly([[L * .62, cc], [L * .22, L * .08], [L * .14, L * .1], [L * .3, cc], [L * .14, L * .9], [L * .22, L * .92]], col);
      poly([[L * .14, cc], [L * .02, L * .3], [0, L * .32], [L * .06, cc], [0, L * .68], [L * .02, L * .7]], dark(col, 0.7));
      const fus = [[L, cc], [L * .78, cc - L * .07], [L * .05, cc - L * .06], [L * .05, cc + L * .06], [L * .78, cc + L * .07]];
      poly(fus, body); poly(fus, [30, 32, 40], true);
      c.fillStyle = css([40, 80, 130]); c.beginPath(); c.ellipse(L * .71, cc, L * .09, L * .04, 0, 0, 7); c.fill();
      c.fillStyle = css([255, 170, 60]); c.beginPath(); c.arc(L * .05, cc, Math.max(1, L * .045), 0, 7); c.fill();
    });
  }
  sprite_surface(sprite, col, shadow = false) {
    return this._cached('sp' + sprite + col + shadow, SPRITE_N, SPRITE_N, (c) => {
      for (let i = 0; i < Math.min(sprite.length, SPRITE_N * SPRITE_N); i++) {
        const ch = sprite[i]; if (ch === '.' || !(ch in SPRITE_PAL)) continue;
        const k = shadow ? [0, 0, 0] : (ch === 'T' ? col : (ch === 't' ? dark(col, 0.62) : SPRITE_PAL[ch]));
        c.fillStyle = css(k); c.fillRect(i % SPRITE_N, trunc(i / SPRITE_N), 1, 1);
      }
    }, true);
  }
  skin_model(sprite, size, col, shadow = false) { size = Math.max(8, trunc(size / 2) * 2); const m = icon_model(this.sprite_surface(sprite, col, shadow).cv, size); m.pixel = m.pixel; return m; }
  ship_model(size, col) {
    size = Math.max(10, trunc(size / 2) * 2); const L = size * 2, Wd = size;
    return this._cached('ship' + size + col, L, Wd, (c) => {
      const poly = (pts, k, stroke) => { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); if (stroke) { c.strokeStyle = css(k); c.lineWidth = 1; c.stroke(); } else { c.fillStyle = css(k); c.fill(); } };
      const hull = [[0, Wd * .5], [L * .18, Wd * .1], [L * .85, Wd * .14], [L, Wd * .5], [L * .85, Wd * .86], [L * .18, Wd * .9]];
      poly(hull, [96, 104, 118]); poly([[L * .2, Wd * .25], [L * .8, Wd * .27], [L * .8, Wd * .73], [L * .2, Wd * .75]], [150, 158, 170]);
      c.fillStyle = css(col); c.fillRect(L * .42, Wd * .3, L * .18, Wd * .4);
      for (const xx of [.3, .72]) { c.fillStyle = css([70, 76, 88]); c.beginPath(); c.arc(L * xx, Wd * .5, Math.max(2, Wd * .14), 0, 7); c.fill(); c.strokeStyle = css([50, 54, 62]); c.lineWidth = Math.max(1, trunc(Wd * .08)); c.beginPath(); c.moveTo(L * xx, Wd * .5); c.lineTo(L * xx + L * .1, Wd * .5); c.stroke(); }
      poly(hull, [30, 32, 38], true);
    });
  }
  boat_model(size, col) {
    size = Math.max(8, trunc(size / 2) * 2); const L = trunc(size * 1.6), Wd = size;
    return this._cached('boat' + size + col, L, Wd, (c) => {
      const hull = [[0, Wd * .5], [L * .25, Wd * .2], [L, Wd * .35], [L, Wd * .65], [L * .25, Wd * .8]];
      c.beginPath(); hull.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fillStyle = css([140, 96, 60]); c.fill(); c.strokeStyle = css([60, 40, 24]); c.lineWidth = 1; c.stroke();
      c.beginPath(); c.arc(L * .55, Wd * .5, Math.max(2, Wd * .26), 0, 7); c.fillStyle = css(col); c.fill(); c.strokeStyle = '#fff'; c.stroke();
    });
  }
}
Gfx.ICON_RES = 32; Gfx.ICON_GROUND_Y = 23;

class Camera {
  // Kamera mit weichem Zoom und Kamerafahrt (+ 3D-Ansicht schräg von oben, mit Horizont)
  constructor() { this.z = this.tz = 2.0; this.x = this.y = 0.0; this.vw = this.vh = 0; this.minz = 1.0; this.anchor = null; this.fly = null; this.p3d = false; }
  focus() { return [this.x + this.vw / this.z / 2, this.y + this.vh / this.z / 2]; }
  persp() { const [fx, fy] = this.focus(), f = this.vh * 1.15, hor = this.vh * 0.17, hcam = (this.vh * 0.6 - hor) / this.z; return [fx, fy, f, hor, hcam, fy + f / this.z]; }
  scale_at(ty) { if (!this.p3d) return this.z; const [, , f, , , cyc] = this.persp(); return f / Math.max(f / this.z * 0.06, cyc - ty); }
  set_view(vw, vh) {
    if (vw === this.vw && vh === this.vh) return;
    let cx, cy; if (this.vw) { cx = this.x + this.vw / this.z / 2; cy = this.y + this.vh / this.z / 2; } else { cx = W / 2; cy = H / 2; }
    this.vw = vw; this.vh = vh; this.minz = Math.min(vw / W, vh / H) * 0.9;
    this.z = Math.max(this.z, this.minz); this.tz = Math.max(this.tz, this.minz);
    this.x = cx - vw / this.z / 2; this.y = cy - vh / this.z / 2; this.clamp();
  }
  fit() { this.z = this.tz = this.minz / 0.9; this.x = (W - this.vw / this.z) / 2; this.y = (H - this.vh / this.z) / 2; }
  center_on(tx, ty, zoom) { if (zoom) this.z = this.tz = Math.max(this.minz, Math.min(48.0, zoom)); this.x = tx - this.vw / this.z / 2; this.y = ty - this.vh / this.z / 2; this.clamp(); }
  fly_to(tx, ty) { this.fly = [tx, ty]; }
  to_tile(sx, sy) {
    if (this.p3d) { const [fx, , f, hor, hcam, cyc] = this.persp(); if (sy <= hor + 2) return [-1e6, -1e6]; const d = hcam * f / (sy - hor); return [fx + (sx - this.vw / 2) * d / f, cyc - d]; }
    return [this.x + sx / this.z, this.y + sy / this.z];
  }
  to_screen(tx, ty) {
    if (this.p3d) { const [fx, , f, hor, hcam, cyc] = this.persp(), d = cyc - ty; if (d < f / this.z * 0.06) return [-99999.0, -99999.0]; const k = f / d; return [this.vw / 2 + (tx - fx) * k, hor + hcam * k]; }
    return [(tx - this.x) * this.z, (ty - this.y) * this.z];
  }
  zoom_at(sx, sy, factor) { this.tz = Math.min(48.0, Math.max(this.minz, this.tz * factor)); this.anchor = this.p3d ? null : [sx, sy]; }
  update(dt) {
    let moved = false;
    if (this.fly) {
      let cx = this.x + this.vw / this.z / 2, cy = this.y + this.vh / this.z / 2; const [fx, fy] = this.fly, f = Math.min(1.0, dt * 6);
      cx += (fx - cx) * f; cy += (fy - cy) * f; this.x = cx - this.vw / this.z / 2; this.y = cy - this.vh / this.z / 2;
      if (Math.hypot(fx - cx, fy - cy) < 0.3) this.fly = null; moved = true;
    }
    if (Math.abs(this.tz - this.z) > 1e-3 && this.p3d) {
      const [fx, fy] = this.focus(); this.z += (this.tz - this.z) * Math.min(1.0, dt * 14); if (Math.abs(this.tz - this.z) < 1e-3) this.z = this.tz;
      this.x = fx - this.vw / this.z / 2; this.y = fy - this.vh / this.z / 2; moved = true;
    } else if (Math.abs(this.tz - this.z) > 1e-3) {
      const [ax, ay] = this.anchor || [this.vw / 2, this.vh / 2], [tx, ty] = this.to_tile(ax, ay);
      this.z += (this.tz - this.z) * Math.min(1.0, dt * 14); if (Math.abs(this.tz - this.z) < 1e-3) this.z = this.tz;
      this.x = tx - ax / this.z; this.y = ty - ay / this.z; moved = true;
    }
    if (moved) this.clamp();
  }
  pan(dx, dy) { this.fly = null; this.x -= dx / this.z; this.y -= dy / this.z; this.clamp(); }
  clamp() { const hw = this.vw / this.z / 2, hh = this.vh / this.z / 2; this.x = Math.min(Math.max(this.x, -hw), W - hw); this.y = Math.min(Math.max(this.y, -hh), H - hh); }
}

// ---------- Weich vergrößern wie smooth_upscale(): erst Kanten glätten (scale2x), dann weich auf die Zielgröße ----------
const SMOOTH_MAP = true;
function scale2x(src, w, h) {
  // EPX/Scale2x auf 32-Bit-Pixeln
  const out = new Uint32Array(w * 2 * h * 2), W2 = w * 2;
  for (let y = 0; y < h; y++) {
    const yu = y > 0 ? y - 1 : y, yd = y < h - 1 ? y + 1 : y;
    for (let x = 0; x < w; x++) {
      const P = src[y * w + x], A = src[yu * w + x], D = src[yd * w + x], C = src[y * w + (x > 0 ? x - 1 : x)], B = src[y * w + (x < w - 1 ? x + 1 : x)];
      let e0 = P, e1 = P, e2 = P, e3 = P;
      if (A !== D && C !== B) { if (C === A) e0 = A; if (A === B) e1 = B; if (C === D) e2 = C; if (D === B) e3 = D; }
      const o = (y * 2) * W2 + x * 2; out[o] = e0; out[o + 1] = e1; out[o + W2] = e2; out[o + W2 + 1] = e3;
    }
  }
  return out;
}
// Ausschnitt (sx, sy, sw, sh) eines 32-Bit-Bildes geglättet als Canvas zurückgeben
function upscale_steps(w, z, target_w) { let n = 0; for (const need of [2.5, 5, 10]) if (z >= need && w * 2 ** (n + 1) <= target_w * 1.5) n++; return n; }
function smooth_canvas(u32, fullW, sx, sy, sw, sh, z, target_w) {
  let buf = new Uint32Array(sw * sh);
  for (let y = 0; y < sh; y++) buf.set(u32.subarray((sy + y) * fullW + sx, (sy + y) * fullW + sx + sw), y * sw);
  let w = sw, h = sh; const n = upscale_steps(sw, z, target_w === undefined ? sw * z : target_w);
  for (let k = 0; k < n; k++) { buf = scale2x(buf, w, h); w *= 2; h *= 2; }
  const cv = mkCanvas(w, h), c = cv.getContext('2d'), im = new ImageData(new Uint8ClampedArray(buf.buffer), w, h); c.putImageData(im, 0, 0);
  return cv;
}
// kleines Pixelbild (Gebäude, eigenes Fahrzeug) glatt vergrößern: zweimal scale2x, dann weich zeichnen
function smooth_icon(cv, size) {
  const w0 = cv.width, n = upscale_steps(w0, size / w0, size); cv._sm = cv._sm || {};
  if (!cv._sm[n]) {
    let buf = new Uint32Array(cv.getContext('2d').getImageData(0, 0, w0, cv.height).data.buffer.slice(0)), w = w0, h = cv.height;
    for (let k = 0; k < n; k++) { buf = scale2x(buf, w, h); w *= 2; h *= 2; }
    const out = mkCanvas(w, h); out.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(buf.buffer), w, h), 0, 0); cv._sm[n] = out;
  }
  return cv._sm[n];
}
// Modell zeichnen wie smooth_upscale: beim Verkleinern weich, beim Vergrößern scharf
function icon_model(cv, size) { const s = smooth_icon(cv, size); return { cv: s, w: size, h: size, pixel: !(s.width > size * 1.2) }; }

class MapView {
  // Hält das Kartenbild und aktualisiert nur geänderte Felder
  constructor(gfx, owner) { this.gfx = gfx; this.mask = null; this.pcol = new Map(); this.flash = []; this.full(owner); }
  player_cols(o) { let c = this.pcol.get(o); if (!c) { const base = player_color(o); c = [base, dark(base, 0.62)]; this.pcol.set(o, c); } return c; }
  make_terrain() {
    const own = this.owner, n = W * H, dist = new Uint8Array(n).fill(255), q = [];
    for (let i = 0; i < n; i++) { const wi = own[i] === WATER; for (let k = 0; k < 4; k++) { const j = NEIGH[i * 4 + k]; if (j >= 0 && (own[j] === WATER) !== wi) { dist[i] = 1; q.push(i); break; } } }
    for (let k = 0; k < q.length; k++) { const i = q[k], d = dist[i]; if (d >= 12) continue; const wi = own[i] === WATER; for (let m = 0; m < 4; m++) { const j = NEIGH[i * 4 + m]; if (j >= 0 && dist[j] === 255 && (own[j] === WATER) === wi) { dist[j] = d + 1; q.push(j); } } }
    const tcol = new Uint8Array(n * 3), sin = Math.sin;
    for (let i = 0; i < n; i++) {
      const x = i % W, y = trunc(i / W), d = dist[i]; let c;
      if (own[i] === WATER) c = lerp_col(WATER_SHALLOW, WATER_DEEP, d !== 255 ? Math.min(1.0, (d - 1) / 10.0) : 1.0);
      else {
        let h = 0.5 + 0.25 * (sin(x * 0.071 + 1.7 * sin(y * 0.053)) + sin(y * 0.093 + 1.3 * sin(x * 0.041))); h += 0.08 * sin(x * 0.31 + y * 0.27);
        c = lerp_col(GRASS_L, GRASS_D, Math.max(0.0, Math.min(1.0, h)));
        if (h > 0.8) c = lerp_col(c, HILL, Math.min(1.0, (h - 0.8) * 4));
        if (d === 1) c = lerp_col(c, SAND, 0.75); else if (d === 2) c = lerp_col(c, SAND, 0.3);
        // Schnee und Eis an den Polen (Arktis / Antarktis)
        const lat_ = WORLD_LAT_TOP - (y + 0.5) / H * WORLD_LAT_SPAN + (h - 0.5) * 8, pol = Math.max((lat_ - 68) / 7, (-lat_ - 60) / 5);
        if (pol > 0) c = lerp_col(c, [238, 244, 250], Math.min(1.0, pol) * (0.85 + 0.15 * h));
      }
      tcol[i * 3] = c[0]; tcol[i * 3 + 1] = c[1]; tcol[i * 3 + 2] = c[2];
    }
    this.tcol = tcol;
    this.tsurf = mkCanvas(W, H); const tc = this.tsurf.getContext('2d'), im = tc.createImageData(W, H); this.timg = im; this.t32 = new Uint32Array(im.data.buffer);
    for (let i = 0; i < n; i++) { im.data[i * 4] = tcol[i * 3]; im.data[i * 4 + 1] = tcol[i * 3 + 1]; im.data[i * 4 + 2] = tcol[i * 3 + 2]; im.data[i * 4 + 3] = 255; }
    tc.putImageData(im, 0, 0);
  }
  color_into(i, d) {
    const o = this.owner[i], t = this.tcol, p = i * 4;
    if (o === WATER || o === NEUTRAL) { d[p] = t[i * 3]; d[p + 1] = t[i * 3 + 1]; d[p + 2] = t[i * 3 + 2]; d[p + 3] = 255; return; }
    const [fill, border] = this.player_cols(o);
    for (let k = 0; k < 4; k++) { const j = NEIGH[i * 4 + k]; if (j >= 0 && this.owner[j] !== o) { d[p] = border[0]; d[p + 1] = border[1]; d[p + 2] = border[2]; d[p + 3] = 255; return; } }
    d[p] = trunc((t[i * 3] * 2 + fill[0] * 3) / 5); d[p + 1] = trunc((t[i * 3 + 1] * 2 + fill[1] * 3) / 5); d[p + 2] = trunc((t[i * 3 + 2] * 2 + fill[2] * 3) / 5); d[p + 3] = 255;
  }
  full(owner) {
    this.owner = Uint8Array.from(owner);
    let same = this.mask && this.mask.length === owner.length; if (same) for (let i = 0; i < owner.length; i++) if ((owner[i] === WATER) !== this.mask[i]) { same = false; break; }
    if (!same) { this.mask = Array.from(owner, o => o === WATER); this.make_terrain(); }
    this.surf = mkCanvas(W, H); this.sctx = this.surf.getContext('2d'); this.img = this.sctx.createImageData(W, H);
    const d = this.img.data, sums = new Map();
    for (let i = 0; i < W * H; i++) {
      this.color_into(i, d); const o = owner[i];
      if (o !== NEUTRAL && o !== WATER) { let s = sums.get(o); if (!s) { s = [0, 0, 0]; sums.set(o, s); } s[0] += i % W; s[1] += trunc(i / W); s[2] += 1; }
    }
    this.sums = sums; this.sctx.putImageData(this.img, 0, 0); this.u32 = new Uint32Array(this.img.data.buffer); this.version = (this.version || 0) + 1;
  }
  apply(chg) {
    if (!chg || !chg.length) return;
    const own = this.owner, touched = new Set(), sums = this.sums, now = performance.now() / 1000, flash = this.flash;
    for (let k = 0; k < chg.length; k += 2) {
      const i = chg[k], o = chg[k + 1], old = own[i]; if (old === o) continue;
      const x = i % W, y = trunc(i / W);
      if (old !== NEUTRAL && old !== WATER && sums.has(old)) { const s = sums.get(old); s[0] -= x; s[1] -= y; s[2] -= 1; if (s[2] <= 0) sums.delete(old); }
      if (o !== NEUTRAL && o !== WATER) { let s = sums.get(o); if (!s) { s = [0, 0, 0]; sums.set(o, s); } s[0] += x; s[1] += y; s[2] += 1; }
      own[i] = o; if (o !== NEUTRAL && o !== WATER) flash.push([i, now, o]);
      touched.add(i); for (let m = 0; m < 4; m++) { const j = NEIGH[i * 4 + m]; if (j >= 0) touched.add(j); }
    }
    if (flash.length > 2500) flash.splice(0, flash.length - 2500);
    if (!touched.size) return;
    let x0 = W, y0 = H, x1 = -1, y1 = -1; const d = this.img.data;
    for (const i of touched) { this.color_into(i, d); const x = i % W, y = trunc(i / W); if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    this.sctx.putImageData(this.img, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1); this.version++;
  }
  centers() { const out = new Map(); for (const [o, s] of this.sums) if (s[2] > 0) out.set(o, [s[0] / s[2], s[1] / s[2], s[2]]); return out; }
  draw(cam, terrain_view) {
    const x0 = Math.max(0, trunc(cam.x)), y0 = Math.max(0, trunc(cam.y)), x1 = Math.min(W, trunc(cam.x + cam.vw / cam.z) + 2), y1 = Math.min(H, trunc(cam.y + cam.vh / cam.z) + 2);
    if (x1 <= x0 || y1 <= y0) return;
    const [sx, sy] = cam.to_screen(x0, y0), [ex, ey] = cam.to_screen(x1, y1), dx = Math.round(sx), dy = Math.round(sy), dw = Math.round(ex) - dx, dh = Math.round(ey) - dy;
    if (SMOOTH_MAP) {
      const band = upscale_steps(x1 - x0, cam.z, dw), key = [x0, y0, x1, y1, this.version, terrain_view, band].join();
      if (this.ckey !== key) { this.ccv = smooth_canvas(terrain_view ? this.t32 : this.u32, W, x0, y0, x1 - x0, y1 - y0, cam.z, dw); this.ckey = key; }
      ctx.imageSmoothingEnabled = this.ccv.width > dw * 1.2; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(this.ccv, dx, dy, dw, dh);
    } else { ctx.imageSmoothingEnabled = false; ctx.drawImage(terrain_view ? this.tsurf : this.surf, x0, y0, x1 - x0, y1 - y0, dx, dy, dw, dh); }
  }
  // ---------- 3D-Ansicht: Karte als schräge Fläche bis zum Horizont ----------
  draw3d(cam, terrain_view) {
    const sw = cam.vw, sh = cam.vh, [fx, fy, f, hor, hcam, cyc] = cam.persp(), dpr = App.dpr * App.scale;
    const key = [r3(fx), r3(fy), cam.z.toFixed(4), sw, sh, this.version, terrain_view].join();
    if (this.c3 && this.c3key === key) { ctx.drawImage(this.c3, 0, 0, sw, sh); return; }
    const mul = (cam.z >= 3.5 && W * H <= 400000 && !App.isTouch) ? 4 : 2, hk = [this.version, terrain_view, mul].join();
    if (this.hikey !== hk) {
      let buf = scale2x(terrain_view ? this.t32 : this.u32, W, H); if (mul === 4) buf = scale2x(buf, W * 2, H * 2);
      if (!this.hi || this.hi.width !== W * mul) this.hi = mkCanvas(W * mul, H * mul);
      this.hi.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(buf.buffer), W * mul, H * mul), 0, 0); this.hikey = hk;
    }
    const pw = Math.round(sw * dpr), ph = Math.round(sh * dpr);
    if (!this.c3 || this.c3.width !== pw || this.c3.height !== ph) this.c3 = mkCanvas(pw, ph);
    const o = this.c3.getContext('2d'); o.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Himmel und Boden-Grundfarbe
    let g = o.createLinearGradient(0, 0, 0, hor);
    for (let k = 0; k <= 8; k++) { const t = k / 8; g.addColorStop(t, css(lerp_col([52, 108, 196], [176, 210, 240], t ** 1.5))); }
    o.fillStyle = g; o.fillRect(0, 0, sw, hor + 1);
    g = o.createLinearGradient(0, hor, 0, hor + sh * 0.25); g.addColorStop(0, css([120, 160, 200])); g.addColorStop(1, css(WATER_DEEP));
    o.fillStyle = g; o.fillRect(0, hor, sw, sh - hor);
    o.imageSmoothingEnabled = true; o.imageSmoothingQuality = 'high';
    const step = 2, half = sw / 2;
    for (let sy = trunc(hor) + 1; sy < sh; sy += step) {
      const d = hcam * f / (sy + step / 2 - hor), ty = cyc - d;
      if (ty < 0 || ty >= H) continue;
      const k = f / d, a = Math.max(0.0, fx - half / k), b = Math.min(W, fx + half / k); if (b <= a) continue;
      const xa = trunc(half + (a - fx) * k), xb = trunc(half + (b - fx) * k); if (xb <= xa) continue;
      const ra = trunc(a * mul), rb = Math.max(ra + 1, Math.min(W * mul, trunc(b * mul)));
      o.drawImage(this.hi, ra, trunc(ty * mul), rb - ra, 1, xa, sy, xb - xa, step + 0.5);
    }
    // Dunst am Horizont
    const hh = sh * 0.22; g = o.createLinearGradient(0, hor, 0, hor + hh);
    for (let k = 0; k <= 8; k++) { const t = k / 8; g.addColorStop(t, `rgba(186,214,240,${(235 * (1 - t) ** 2.2 / 255).toFixed(3)})`); }
    o.fillStyle = g; o.fillRect(0, hor, sw, hh);
    this.c3key = key; ctx.drawImage(this.c3, 0, 0, sw, sh);
  }
}

// Weltkarte als langsam schwenkender Hintergrund
let BG_TERRAIN = null;
function draw_background(gfx, sw, sh, darken = 150) {
  if (!BG_TERRAIN) { const ow = W, oh = H; set_map_size(720, 288); BG_TERRAIN = new MapView(gfx, gen_map(20251125, 'welt')).tsurf; set_map_size(ow, oh); }
  let h = sh * 1.08, w = h * 720 / 288; if (w < sw * 1.2) { w = sw * 1.2; h = w * 288 / 720; }
  const t = performance.now() / 1000, ox = (w - sw) * (0.5 + 0.5 * Math.sin(t * 0.035)), oy = (h - sh) * (0.5 + 0.3 * Math.sin(t * 0.021));
  ctx.imageSmoothingEnabled = true; ctx.drawImage(BG_TERRAIN, -ox, -oy, w, h);
  ctx.fillStyle = css([8, 12, 22, darken]); ctx.fillRect(0, 0, sw, sh);
}
