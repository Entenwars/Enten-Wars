// FrontWars Web – Spiellogik (Port von FrontWars.py, Version 3)
'use strict';

// ---------------------------------------------------------------------------
// Einstellungen
// ---------------------------------------------------------------------------
let W = 720, H = 288, NEIGH = null;
const NEUTRAL = 0, WATER = 255, MAX_ID = 126, TICK = 0.1, WIN_SHARE = 0.72, TRAITOR_TICKS = 600;
const START_TROOPS = 500, SPAWN_PHASE = 150, SPAWN_GAP = 6;

const BTYPES = {
  H: { name: 'Stadt', cost: 100000, key: 'H', info: '+3.000 max. Truppen je Stufe, schnelleres Wachstum' },
  F: { name: 'Fabrik', cost: 150000, key: 'F', info: 'Gold je Stufe. Mit Bahnhof verbunden: viel mehr Gold' },
  B: { name: 'Bahnhof', cost: 120000, key: 'N', info: 'Verbindet Städte, Fabriken und Bahnhöfe: Gold pro Zug' },
  P: { name: 'Hafen', cost: 150000, key: 'P', info: 'An der Küste. Boote über Wasser, Kriegsschiffe' },
  L: { name: 'Flughafen', cost: 300000, key: 'L', info: 'Kampfjets bringen Truppen weit weg (100.000 Gold pro Start)' },
  M: { name: 'Raketensilo', cost: 500000, key: 'M', info: 'Nötig für Bomben. Mehr Stufen = schneller nachladen' },
  V: { name: 'SAM', cost: 300000, key: 'V', info: 'Schießt feindliche Raketen und Kampfjets ab' },
  S: { name: 'Kriegsschiff', cost: 250000, key: 'S', info: 'Beim Hafen. Versenkt feindliche Boote' },
};
const BUILD_ORDER = ['H', 'F', 'B', 'P', 'L', 'M', 'V', 'S'];
const BOMBS = {
  small: { name: 'Kleine Bombe', cost: 750000, r: 6, key: 'Q', info: 'Kleiner Radius. Braucht ein Raketensilo' },
  big: { name: 'Große Bombe', cost: 3000000, r: 14, key: 'W', info: 'Großer Radius. Braucht ein Raketensilo' },
  mirv: { name: 'MIRV', cost: 15000000, r: 40, key: 'E', info: 'Teilt sich in 14 Sprengköpfe: riesiger Radius' },
};
const BOMB_ORDER = ['small', 'big', 'mirv'];
const HEAD_R = 7, MIRV_HEADS = 14, RAIL_RANGE = 15, SHIPS_PER_PORT = 3, GOLD_SCALE = 100;

const MODES = {
  normal: { name: 'Normal', conquer: 1.0, gold: 1.0, grow: 1.0, units: 1.0, win: true, info: 'mittleres Tempo, Sieg bei 72 %' },
  endless: { name: 'Endlos', conquer: 0.3, gold: 0.3, grow: 0.4, units: 0.7, win: false, info: 'sehr langsam, wird gespeichert' },
  speed: { name: 'Speed', conquer: 3.0, gold: 3.0, grow: 3.0, units: 1.8, win: true, info: 'super schnell, Sieg bei 72 %' },
  fasteco: { name: 'Schnelle Wirtschaft', conquer: 1.0, gold: 5.0, grow: 1.0, units: 1.0, win: true, info: 'normales Tempo, 5x Gold' },
};
const MODE_ORDER = ['normal', 'fasteco', 'endless', 'speed'];
const VIAS = ['auto', 'land', 'boat', 'plane'];
const VIA_NAMES = { auto: 'Automatisch', land: 'Panzer', boat: 'Schiff', plane: 'Kampfjet' };
const PLANE_COST = 100000, TRAIN_SPEED = 0.5, TRAIN_PAUSE = 15;

const DIFFS = {
  easy: { name: 'Leicht', think: 26, th: [0.70, 0.95], ratio: [0.10, 0.25], grow: 0.65, build: 0.25, human: 0.12, bomb: 0.0 },
  medium: { name: 'Mittel', think: 18, th: [0.55, 0.85], ratio: [0.15, 0.35], grow: 0.8, build: 0.35, human: 0.4, bomb: 0.003 },
  hard: { name: 'Schwer', think: 12, th: [0.30, 0.60], ratio: [0.25, 0.55], grow: 1.0, build: 0.5, human: 1.0, bomb: 0.012 },
};
const DIFF_ORDER = ['easy', 'medium', 'hard'];
const DEFAULT_OPTS = { small: true, big: true, mirv: true, planes: true, ships: true, sam: true, alliances: true, start_gold: 0, win: 72, blobs: false };
const OPT_OF_KIND = { small: 'small', big: 'big', mirv: 'mirv', L: 'planes', S: 'ships', V: 'sam' };

// ---------------------------------------------------------------------------
// Eigene Waffen
// ---------------------------------------------------------------------------
const SPRITE_N = 16, STAT_BUDGET = 8, STAT_MIN = 1, STAT_MAX = 7;

const SPRITE_PAL = { T: null, t: null, k: [26, 26, 30], g: [84, 88, 98], G: [168, 174, 186], w: [245, 245, 248], r: [210, 52, 46], o: [240, 140, 40], y: [246, 206, 60], e: [70, 160, 80], b: [60, 110, 200], c: [120, 200, 235], n: [132, 90, 54] };
const SPRITE_CHARS = '.' + Object.keys(SPRITE_PAL).join('');
const store = {
  get(k, d) { try { const v = localStorage.getItem('frontwars-' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('frontwars-' + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem('frontwars-' + k); } catch (e) {} },
};

function default_design(kind) {
  const stats = {}; for (const [k] of DESIGN_STATS[kind]) stats[k] = 4;
  return { name: DESIGN_NAMES[kind], sprite: DEFAULT_SPRITES[kind].slice(), use: true, stats };
}
function validate_design(kind, d) {
  if (!d || typeof d !== 'object' || !DESIGN_STATS[kind]) return null;
  const sprite = d.sprite;
  if (!Array.isArray(sprite) || sprite.length !== SPRITE_N || sprite.some(r => typeof r !== 'string' || r.length !== SPRITE_N || [...r].some(c => !SPRITE_CHARS.includes(c)))) return null;
  let stats = {}; const raw = (d.stats && typeof d.stats === 'object') ? d.stats : {};
  for (const [key] of DESIGN_STATS[kind]) { let v = parseInt(raw[key] === undefined ? 4 : raw[key], 10); if (isNaN(v)) v = 4; stats[key] = Math.max(STAT_MIN, Math.min(STAT_MAX, v)); }
  if (Object.values(stats).reduce((a, b) => a + b, 0) > STAT_BUDGET) { stats = {}; for (const [key] of DESIGN_STATS[kind]) stats[key] = 4; }
  const name = String(d.name === undefined ? DESIGN_NAMES[kind] : d.name).slice(0, 16).trim() || DESIGN_NAMES[kind];
  return { name, sprite: sprite.slice(), stats, use: d.use === undefined ? true : !!d.use };
}
function load_designs() {
  const d = {}; for (const k of DESIGN_KINDS) d[k] = default_design(k);
  const saved = store.get('waffen', null);
  if (saved) for (const k of DESIGN_KINDS) { const v = validate_design(k, saved[k]); if (v) d[k] = v; }
  return d;
}
function save_designs(designs) { store.set('waffen', designs); }
// ---------- Eigene Blob-Typen (Blob-Editor): Körper, Hut, Bemalung + Werte ----------
function default_blob(n = 0) {
  const presets = [['Krieger', 'rund', 'helm', 'keins', 0, 5, 3], ['König', 'breit', 'krone', 'bauch', 2, 4, 4], ['Flitzer', 'schlank', 'antenne', 'streifen', 7, 2, 6], ['Hase', 'mini', 'ohren', 'punkte', 0, 3, 5]];
  const [name, body, hat, pat, paint, st_, tp] = presets[n % presets.length];
  return { name, body, hat, pattern: pat, paint, stats: { staerke: st_, tempo: tp }, use: true };
}
function validate_blob(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  const out = default_blob();
  for (const [key, opts] of [['body', BLOB_BODIES], ['hat', BLOB_HATS], ['pattern', BLOB_PATTERNS]]) if (opts.some(o => o[0] === d[key])) out[key] = d[key];
  let pv = parseInt(d.paint === undefined ? 0 : d.paint, 10); if (isNaN(pv)) pv = 0; out.paint = Math.max(0, Math.min(BLOB_PAINTS.length - 1, pv));
  let stats = {}; const raw = (d.stats && typeof d.stats === 'object') ? d.stats : {};
  for (const [key] of BLOB_STATS) { let v = parseInt(raw[key] === undefined ? 4 : raw[key], 10); if (isNaN(v)) v = 4; stats[key] = Math.max(STAT_MIN, Math.min(STAT_MAX, v)); }
  if (Object.values(stats).reduce((a, b) => a + b, 0) > STAT_BUDGET) { stats = {}; for (const [key] of BLOB_STATS) stats[key] = 4; }
  out.stats = stats; out.name = String(d.name === undefined ? 'Blob' : d.name).slice(0, 16).trim() || 'Blob'; out.use = true;
  return out;
}
// Aussehen als kurzer Text (wird an alle Mitspieler geschickt) – gleiches Format wie FrontWars.py
const blob_look = d => `blob:${d.body}:${d.hat}:${d.pattern}:${d.paint | 0}`;
function parse_blob_look(txt_) {
  const p = String(txt_ || '').split(':'); if (p.length !== 5) return null;
  const [, body, hat, pat, paint_] = p, pi = parseInt(paint_, 10); if (isNaN(pi)) return null;
  const paint = BLOB_PAINTS[Math.max(0, Math.min(BLOB_PAINTS.length - 1, pi))][1];
  if (BLOB_BODIES.some(o => o[0] === body) && BLOB_HATS.some(o => o[0] === hat) && BLOB_PATTERNS.some(o => o[0] === pat)) return [body, hat, pat, paint];
  return null;
}
function load_blobs() {
  const data = { active: 0, types: [0, 1, 2, 3].map(k => default_blob(k)) }, saved = store.get('blobs', null);
  if (saved && Array.isArray(saved.types)) { const types = saved.types.slice(0, BLOB_MAX_TYPES).map(validate_blob).filter(Boolean); if (types.length) { data.types = types; data.active = Math.max(0, Math.min(types.length - 1, parseInt(saved.active, 10) || 0)); } }
  return data;
}
function save_blobs(data) { return store.set('blobs', data); }
function my_designs() {
  const out = {}; for (const [k, d] of Object.entries(load_designs())) if (d.use) out[k] = d;
  const b = load_blobs(); out.blob = b.types[b.active]; return out;
}
const stat_factor = (value, per_point) => 1.0 + per_point * (value - 4);

const CODE_ALPHA = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const PRESETS = [['welt', 'Weltkarte'], ['kontinente', 'Kontinente'], ['inseln', 'Inseln'], ['pangaea', 'Pangäa'], ['archipel', 'Archipel']];
const BOT_NAMES = ['Nordreich', 'Sonnenland', 'Eisenmark', 'Drachenfels', 'Silberküste', 'Wolfsheim', 'Rabenstein', 'Goldtal', 'Sturmwacht', 'Bernsteinbund', 'Falkenau', 'Nebelhain', 'Kupferberg', 'Löwenfurt', 'Ostmark', 'Westwind', 'Glutreich', 'Frostgard', 'Smaragdinsel', 'Dornwald', 'Hammerheim', 'Blauwasser', 'Kristallreich', 'Eichenbund', 'Schattental', 'Morgenrot', 'Steinwall', 'Feuerkrone', 'Seeburg', 'Wüstenfalke', 'Bärenklau', 'Sternenfeld', 'Donnerhall', 'Mondsee', 'Ährenland', 'Tannengrund', 'Rosenhain', 'Adlerhorst', 'Salzmarsch', 'Kaltenbrunn', 'Weidenfels', 'Lichtenau', 'Grauburg', 'Sandmeer', 'Wolkenreich', 'Ebenwald', 'Funkenstadt', 'Möwenkap'];
const MAP_SIZES = [['klein', 'Klein 480 x 192 (große Pixel)', 480, 192], ['normal', 'Normal 720 x 288', 720, 288], ['gross', 'Groß 960 x 384 (feinere Pixel)', 960, 384], ['riesig', 'Riesig 1200 x 480 (langsamer)', 1200, 480]];
const SIZE_BY_KEY = {}; for (const [k, , w, h] of MAP_SIZES) SIZE_BY_KEY[k] = [w, h];

// ---------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------
const rnd = Math.random;
const randrange = n => Math.floor(rnd() * n);
const uniform = (a, b) => a + (b - a) * rnd();
const choice = a => a[randrange(a.length)];
function sample(arr, k) { const a = Array.from(arr); k = Math.min(k, a.length); for (let i = 0; i < k; i++) { const j = i + randrange(a.length - i); const t = a[i]; a[i] = a[j]; a[j] = t; } a.length = k; return a; }
function choices(items, weights) { let t = weights.reduce((a, b) => a + b, 0) * rnd(); for (let i = 0; i < items.length; i++) { t -= weights[i]; if (t < 0) return items[i]; } return items[items.length - 1]; }
const trunc = Math.trunc;
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100, r3 = v => Math.round(v * 1000) / 1000;
const fdiv = (a, b) => Math.floor(a / b);
function fmt(n) { return String(trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
const pairKey = (a, b) => a < b ? a + ':' + b : b + ':' + a;

function build_neigh() {
  const n = new Int32Array(W * H * 4).fill(-1);
  for (let i = 0; i < W * H; i++) {
    const x = i % W, y = (i / W) | 0, b = i * 4;
    if (x > 0) n[b] = i - 1; if (x < W - 1) n[b + 1] = i + 1; if (y > 0) n[b + 2] = i - W; if (y < H - 1) n[b + 3] = i + W;
  }
  return n;
}
NEIGH = build_neigh();
function set_map_size(w, h) { w = parseInt(w, 10); h = parseInt(h, 10); if (w === W && h === H) return; W = w; H = h; NEIGH = build_neigh(); }
function size_key() { for (const [k, , w, h] of MAP_SIZES) if (w === W && h === H) return k; return 'normal'; }

function b64enc(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
function b64dec(str) { const s = atob(str), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
function pack(data) { return b64enc(pako.deflate(data instanceof Uint8Array ? data : Uint8Array.from(data), { level: 6 })); }
function unpack(text) { return pako.inflate(b64dec(text)); }

function hsv_to_rgb(h, s, v) {
  if (s === 0) return [v, v, v];
  let i = Math.floor(h * 6); const f = h * 6 - i, p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f)); i %= 6;
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}
function player_color(pid) {
  const h = (pid * 0.618033988749895) % 1.0, s = 0.55 + 0.25 * (pid % 2), v = 0.95 - 0.12 * (pid % 3);
  return hsv_to_rgb(h, s, v).map(c => trunc(c * 255));
}
function building_range(kind, lvl = 1) {
  lvl = Math.max(1, lvl);
  if (kind === 'B') return RAIL_RANGE + 3 * (lvl - 1);
  if (kind === 'V') return 30 + 6 * (lvl - 1);
  if (kind === 'L') return 120 + 30 * (lvl - 1);
  if (kind === 'P') return 15;
  return 0;
}
const build_cost = (kind, cnt) => trunc(BTYPES[kind].cost * (1 + cnt));

// ---------------------------------------------------------------------------
// Karten
// ---------------------------------------------------------------------------
const PRESET_PARAMS = {
  kontinente: [[[5, 1.0], [12, 0.5], [28, 0.22]], 0.47, 'edge'],
  inseln: [[[9, 1.0], [20, 0.6], [40, 0.25]], 0.53, 'edge'],
  pangaea: [[[4, 1.0], [10, 0.5], [26, 0.22]], 0.42, 'center'],
  archipel: [[[15, 1.0], [30, 0.5], [50, 0.2]], 0.56, 'edge'],
};

function seeded(a) { a = a >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function noise_field(seed, octs) {
  const rng = seeded(seed), grids = [];
  for (const [cells, amp] of octs) {
    const gw = cells + 2, gh = trunc(cells * H / W) + 3, g = [];
    for (let y = 0; y < gh; y++) { const row = new Float64Array(gw); for (let x = 0; x < gw; x++) row[x] = rng(); g.push(row); }
    grids.push([cells, amp, g]);
  }
  const total = grids.reduce((s, x) => s + x[1], 0), out = new Float64Array(W * H);
  for (const [cells, amp, g] of grids) {
    const a_ = amp / total, sc = cells / W;
    for (let y = 0; y < H; y++) {
      const fy = y * sc, iy = trunc(fy); let ty = fy - iy; ty = ty * ty * (3 - 2 * ty);
      const r0 = g[iy], rr1 = g[iy + 1], row = y * W;
      for (let x = 0; x < W; x++) {
        const fx = x * sc, ix = trunc(fx); let tx = fx - ix; tx = tx * tx * (3 - 2 * tx);
        const a = r0[ix], b = r0[ix + 1], c = rr1[ix], d = rr1[ix + 1];
        out[row + x] += a_ * (a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty);
      }
    }
  }
  return out;
}
const SPIRAL = (() => { const o = []; for (let dx = -40; dx <= 40; dx++) for (let dy = -40; dy <= 40; dy++) if (dx * dx + dy * dy <= 1600) o.push([dx, dy]); return o.sort((p, q) => (p[0] * p[0] + p[1] * p[1]) - (q[0] * q[0] + q[1] * q[1])); })();
function lonlat_to_xy(lon, lat, w, h) { w = w || W; h = h || H; return [(lon + 180) / 360 * w, (WORLD_LAT_TOP - lat) / WORLD_LAT_SPAN * h]; }
// Polygone in ein Gitter rastern (Scanline, gerade-ungerade-Regel)
function _fill_polys(grid, w, h, polys, val, ss = 1) {
  const pyround = v => { const f = Math.floor(v), d = v - f; return d > 0.5 ? f + 1 : d < 0.5 ? f : (f % 2 === 0 ? f : f + 1); };
  for (const poly of polys) {
    const pts = poly.map(([lo, la]) => lonlat_to_xy(lo, la, w, h)), ys = pts.map(p => p[1]);
    const y0 = Math.max(0, trunc(Math.min(...ys))), y1 = Math.min(h - 1, trunc(Math.max(...ys)) + 1), n = pts.length;
    for (let y = y0; y <= y1; y++) for (let sub = 0; sub < ss; sub++) {
      const yc = y + (sub + 0.5) / ss, xs = [];
      for (let k = 0; k < n; k++) { const [ax, ay] = pts[k], [bx, by] = pts[(k + 1) % n]; if ((ay <= yc) !== (by <= yc)) xs.push(ax + (yc - ay) / (by - ay) * (bx - ax)); }
      xs.sort((p, q) => p - q); const row = grid[y];
      for (let k = 0; k + 1 < xs.length; k += 2) { const a = Math.max(0, pyround(xs[k])), b = Math.min(w, pyround(xs[k + 1])); for (let x = a; x < b; x++) row[x] += val; }
    }
  }
}
// Echte Weltkarte aus Küstenlinien, mit leicht ausgefransten Küsten
function gen_world(seed) {
  const ss = 2, grid = Array.from({ length: H }, () => new Float64Array(W)), water = Array.from({ length: H }, () => new Float64Array(W));
  _fill_polys(grid, W, H, WORLD_LAND, 1.0 / ss, ss); _fill_polys(water, W, H, WORLD_WATER, 1.0 / ss, ss);
  const nz = noise_field(seed, [[fdiv(W, 6), 1.0], [fdiv(W, 2), 0.6]]), t = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    const g0 = grid[Math.max(0, y - 1)], g1 = grid[y], g2 = grid[Math.min(H - 1, y + 1)], wr = water[y];
    for (let x = 0; x < W; x++) {
      const xl = Math.max(0, x - 1), xr = Math.min(W - 1, x + 1);
      let v = g1[x] * 0.5 + (g1[xl] + g1[xr] + g0[x] + g2[x]) * 0.125;
      v = Math.min(1.0, v) - Math.min(1.0, wr[x]); v += (nz[y * W + x] - 0.5) * 0.35;
      t[y * W + x] = v > 0.5 ? NEUTRAL : WATER;
    }
  }
  return t;
}
function gen_map(seed, preset = 'kontinente') {
  if (preset === 'welt') return gen_world(seed);
  if (preset === 'wasser') return new Uint8Array(W * H).fill(WATER);
  if (preset === 'land') { const t = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) { const x = i % W, y = (i / W) | 0; if (x < 3 || y < 3 || x >= W - 3 || y >= H - 3) t[i] = WATER; } return t; }
  const [octs, thr, kind] = PRESET_PARAMS[preset] || PRESET_PARAMS.kontinente;
  const v = noise_field(seed, octs), terrain = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; let val = v[i];
    if (kind === 'edge') { const e = Math.max(Math.abs(x / W * 2 - 1), Math.abs(y / H * 2 - 1)); val -= Math.max(0.0, e - 0.7) * 1.4; }
    else { const dx = x / W * 2 - 1, dy = y / H * 2 - 1; val += 0.25 - Math.sqrt(dx * dx + dy * dy) * 0.45; }
    terrain[i] = val > thr ? NEUTRAL : WATER;
  }
  return terrain;
}
// eigene Karten liegen im Browser-Speicher
function list_saved_maps() { return Object.keys(store.get('maps', {})).sort(); }
function save_map_file(name, terrain) { const m = store.get('maps', {}); m[name] = { name, w: W, h: H, terrain: pack(terrain) }; return store.set('maps', m); }
function load_map_file(name) {
  const d = store.get('maps', {})[name]; if (!d) throw new Error('Karte nicht gefunden');
  const t = unpack(d.terrain); if (t.length !== (d.w | 0) * (d.h | 0)) throw new Error('Kartendatei ist beschädigt');
  set_map_size(d.w, d.h); return Uint8Array.from(t, v => v !== WATER ? NEUTRAL : WATER);
}

// ---------------------------------------------------------------------------
// Spiellogik (Host)
// ---------------------------------------------------------------------------
class Player {
  constructor(pid, name, bot = false) {
    Object.assign(this, { id: pid, name, bot, color: player_color(pid), troops: 0.0, gold: 0.0, troop_rate: 0.0, gold_rate: 0.0, tl: [], alive: false, online: false, conn: null, traitor_until: 0, spawn_deadline: null, designs: {}, events: [] });
  }
  get n() { return this.tl.length; }
  msg(text) { if (!this.bot) { this.events.push(text); if (this.events.length > 25) this.events.splice(0, this.events.length - 25); } }
}
class Boat {
  constructor(id, owner, troops, path, land) { Object.assign(this, { id, owner, troops, path, land, pos: 0.0, dead: false }); }
  xy() {
    const L = this.path.length, k = Math.min(trunc(this.pos), L - 1), k2 = Math.min(k + 1, L - 1), f = this.pos - trunc(this.pos), a = this.path[k], b = this.path[k2];
    return [a % W + (b % W - a % W) * f + 0.5, fdiv(a, W) + (fdiv(b, W) - fdiv(a, W)) * f + 0.5];
  }
}
class Ship { constructor(id, owner, x, y, home, maxhp = 100.0) { Object.assign(this, { id, owner, x, y, home, hp: maxhp, maxhp, tx: null, ty: null, dead: false }); } }
class Missile {
  constructor(id, owner, kind, sx, sy, tx, ty, step) { Object.assign(this, { id, owner, kind, sx, sy, tx, ty, prog: 0.0, step, dead: false }); }
  xy() { return [this.sx + (this.tx - this.sx) * this.prog, this.sy + (this.ty - this.sy) * this.prog]; }
}
class Train { constructor(id, owner, a, b, step, rate) { Object.assign(this, { id, owner, a, b, step, rate, prog: 0.0, ticks: 0, dead: false }); } }
class Plane { constructor(id, owner, troops, x, y, tile) { Object.assign(this, { id, owner, troops, x, y, tile, tx: tile % W + 0.5, ty: fdiv(tile, W) + 0.5, dead: false }); } }

class Game {
  constructor(mode = 'normal', bots = 40, mapspec = ['preset', 'welt'], resume = true, difficulty = 'easy', opts = null) {
    this.O = Object.assign({}, DEFAULT_OPTS, opts || {});
    this.mode = MODES[mode] ? mode : 'normal'; this.M = MODES[this.mode];
    this.D = DIFFS[difficulty] || DIFFS.easy; this.difficulty = difficulty;
    this.bots_target = bots; this.mapspec = mapspec;
    this.cmds = []; this.conn_pid = new Map(); this.need_full = new Set(); this.players = new Map();
    this.running = true; this.next_uid = 1; this.seq = 0;
    if (this.mode === 'endless' && resume && store.get('save', null) && this.load()) console.log('[Server] Gespeicherte Welt geladen.');
    else this.new_round();
  }
  uid() { return ++this.next_uid; }
  P(id) { return this.players.get(id); }

  // ---------- Welt ----------
  make_terrain() {
    let [kind, name] = this.mapspec;
    if (kind === 'file') { try { return load_map_file(name); } catch (e) { console.log('[Server] Karte konnte nicht geladen werden:', e.message); name = 'welt'; } }
    return gen_map(this.seed, name);
  }
  label_islands() {
    const n_ = W * H, isl = new Int32Array(n_).fill(-1), own = this.owner, q = new Int32Array(n_); let n = 0;
    for (let s = 0; s < n_; s++) {
      if (own[s] === WATER || isl[s] !== -1) continue;
      isl[s] = n; let h = 0, t = 0; q[t++] = s;
      while (h < t) { const i = q[h++]; for (let k = 0; k < 4; k++) { const j = NEIGH[i * 4 + k]; if (j >= 0 && isl[j] === -1 && own[j] !== WATER) { isl[j] = n; q[t++] = j; } } }
      n++;
    }
    this.island = isl;
  }
  reset_world() {
    this.alliances = new Set(); this.requests = [];
    this.attacks = []; this.boats = []; this.ships = []; this.missiles = []; this.planes = [];
    this.buildings = new Map(); this.rails = []; this.rail_gold = {}; this.rail_info = new Map(); this.rail_wait = new Map(); this.trains = [];
    this.bcount = {}; this.winner = null; this.reset_at = null; this.changes = []; this.fx = []; this.full_all = true;
    this.pos = new Int32Array(W * H).fill(-1);
  }
  new_round(seed) {
    const humans = [...this.players.values()].filter(p => !p.bot && p.online);
    this.seed = seed !== undefined ? seed : randrange(1 << 30);
    this.owner = this.make_terrain();
    this.land = 0; for (let i = 0; i < W * H; i++) if (this.owner[i] !== WATER) this.land++;
    this.label_islands();
    this.players = new Map(); this.reset_world();
    this.tick_no = 0; this.spawn_phase_end = this.mode === 'endless' ? 0 : SPAWN_PHASE;
    this.conn_pid = new Map();
    for (const hp of humans) {
      const np = this.add_player(hp.name, false);
      np.conn = hp.conn; np.online = true; np.designs = hp.designs; this.conn_pid.set(hp.conn, np.id);
      np.spawn_deadline = this.spawn_deadline_now();
      np.msg('Neue Runde! Klicke auf die Karte, um deinen Startpunkt zu wählen.');
    }
    for (let k = 0; k < this.bots_target; k++) this.spawn(this.add_bot());
  }
  save() {
    if (this.mode !== 'endless') return;
    const data = {
      version: 4, w: W, h: H, seed: this.seed, tick: this.tick_no, owner: pack(this.owner),
      alliances: [...this.alliances].map(k => k.split(':').map(Number)),
      buildings: Object.fromEntries([...this.buildings].map(([t, b]) => [String(t), [b[0], b[1]]])),
      ships: this.ships.map(s => [s.owner, s.x, s.y, s.home, s.hp]),
      players: [...this.players.values()].map(p => ({ id: p.id, name: p.name, bot: p.bot, troops: p.troops, gold: p.gold, traitor: Math.max(0, p.traitor_until - this.tick_no) })),
    };
    if (!store.set('save', data)) console.log('[Server] Speichern fehlgeschlagen (Browser-Speicher voll?)');
  }
  load() {
    try {
      const data = store.get('save', null), owner = unpack(data.owner);
      if ((data.version || 0) < 4 || owner.length !== (data.w || 0) * (data.h || 0)) throw new Error('alter Spielstand (andere Version)');
      set_map_size(data.w, data.h);
      this.seed = data.seed; this.tick_no = data.tick; this.spawn_phase_end = 0;
      this.owner = Uint8Array.from(owner);
      this.land = 0; for (let i = 0; i < W * H; i++) if (this.owner[i] !== WATER) this.land++;
      this.label_islands(); this.players = new Map(); this.reset_world();
      for (const d of data.players) { const p = new Player(d.id, d.name, d.bot); p.troops = d.troops; p.gold = d.gold; p.traitor_until = this.tick_no + (d.traitor || 0); this.players.set(p.id, p); }
      for (let i = 0; i < W * H; i++) { const o = this.owner[i]; if (o !== NEUTRAL && o !== WATER) { const p = this.players.get(o); if (p) { this.pos[i] = p.tl.length; p.tl.push(i); } else this.owner[i] = NEUTRAL; } }
      for (const p of this.players.values()) p.alive = p.tl.length > 0;
      this.alliances = new Set(data.alliances.filter(a => a.every(x => this.players.has(x))).map(a => pairKey(a[0], a[1])));
      for (const [t_, b] of Object.entries(data.buildings || {})) { const t = parseInt(t_, 10); if (this.owner[t] !== NEUTRAL && this.owner[t] !== WATER && BTYPES[b[0]]) this.buildings.set(t, [b[0], b[1] | 0, 0]); }
      for (const [o, x, y, home, hp] of (data.ships || [])) { const p = this.players.get(o); if (p && p.alive) { const s = new Ship(this.uid(), o, x, y, home); s.hp = hp; this.ships.push(s); } }
      this.update_counts(); this.update_rails();
      return true;
    } catch (e) { console.log('[Server] Speicherstand konnte nicht geladen werden:', e.message); this.players = new Map(); return false; }
  }

  // ---------- Spieler ----------
  add_player(name, bot = false) { for (let pid = 1; pid <= MAX_ID; pid++) if (!this.players.has(pid)) { const p = new Player(pid, name, bot); this.players.set(pid, p); return p; } return null; }
  add_bot() {
    const used = new Set([...this.players.values()].map(p => p.name));
    // Bots heißen wie echte Länder (große Länder zuerst, dann der Rest gemischt)
    const freeC = COUNTRIES.filter(c => !used.has(c[0]));
    if (freeC.length) {
      const c = freeC.length > COUNTRIES.length - 12 ? freeC[0] : choice(freeC.slice(0, 20));
      const p = this.add_player(c[0], true); if (p) p.home = [c[1], c[2]]; return p;
    }
    const free = BOT_NAMES.filter(n => !used.has(n));
    return this.add_player(free.length ? choice(free) : `Reich ${100 + randrange(900)}`, true);
  }
  // Auf der echten Weltkarte: Startfeld so nah wie möglich am echten Land
  home_spawn(p) {
    if (!p.home || this.mapspec[0] !== 'preset' || this.mapspec[1] !== 'welt') return null;
    let [hx, hy] = lonlat_to_xy(p.home[0], p.home[1]); hx = trunc(hx); hy = trunc(hy);
    for (const [dx, dy] of SPIRAL) { const x = hx + dx, y = hy + dy; if (x >= 0 && x < W && y >= 0 && y < H) { const i = y * W + x; if (this.owner[i] === NEUTRAL && this.spawn_blocked(p.id, i) === null) return i; } }
    return null;
  }
  spawn(p) {
    if (!p) return; let best = this.home_spawn(p); const own = this.owner;
    if (best !== null) { this.claim_start(p, best); return; }
    for (let t = 0; t < 600; t++) {
      const i = randrange(W * H); if (own[i] !== NEUTRAL) continue;
      const x = i % W, y = fdiv(i, W); let ok = true, land = 0;
      for (let yy = Math.max(0, y - 9); yy < Math.min(H, y + 10) && ok; yy++) for (let xx = Math.max(0, x - 9); xx < Math.min(W, x + 10); xx++) { const o = own[yy * W + xx]; if (o === NEUTRAL) land++; else if (o !== WATER) { ok = false; break; } }
      if (ok && land > 200) { best = i; break; }
      if (best === null) best = i;
    }
    if (best === null) return;
    this.claim_start(p, best);
  }
  claim_start(p, center) {
    const x0 = center % W, y0 = fdiv(center, W);
    for (let yy = y0 - 3; yy < y0 + 4; yy++) for (let xx = x0 - 3; xx < x0 + 4; xx++) if (xx >= 0 && xx < W && yy >= 0 && yy < H && (xx - x0) ** 2 + (yy - y0) ** 2 <= 10) { const j = yy * W + xx; if (this.owner[j] === NEUTRAL) this.set_owner(j, p.id); }
    p.alive = p.tl.length > 0; p.troops = START_TROOPS; p.gold = Math.max(p.gold, this.O.start_gold); p.spawn_deadline = null;
  }
  spawn_blocked(pid, tile) {
    if (!(tile >= 0 && tile < W * H) || this.owner[tile] !== NEUTRAL) return 'Wähle freies (graues/grünes) Land.';
    const x = tile % W, y = fdiv(tile, W);
    for (let yy = Math.max(0, y - SPAWN_GAP); yy < Math.min(H, y + SPAWN_GAP + 1); yy++) for (let xx = Math.max(0, x - SPAWN_GAP); xx < Math.min(W, x + SPAWN_GAP + 1); xx++) { const o = this.owner[yy * W + xx]; if (o !== NEUTRAL && o !== WATER && o !== pid) return 'Zu nah an einem anderen Reich.'; }
    return null;
  }
  spawn_deadline_now() { return this.tick_no < this.spawn_phase_end ? this.spawn_phase_end : this.tick_no + 300; }
  choose_spawn(p, tile) {
    const phase = this.tick_no < this.spawn_phase_end;
    if (p.spawn_deadline === null && !(phase && p.alive)) return;
    const why = this.spawn_blocked(p.id, tile); if (why) { p.msg(why); return; }
    if (p.alive) { for (const i of p.tl) { this.owner[i] = NEUTRAL; this.pos[i] = -1; this.changes.push(i, NEUTRAL); } p.tl = []; p.alive = false; }
    this.claim_start(p, tile);
    p.msg('Startpunkt gewählt!' + (phase ? ' Bis zum Start kannst du ihn noch ändern.' : ''));
  }
  count(pid, kind) { const c = this.bcount[pid]; return (c && c[kind]) || 0; }
  dstat(pid, kind, key) { const p = this.players.get(pid); if (p && kind === 'tank' && this.O.blobs && p.designs.blob) kind = 'blob'; const d = p ? p.designs[kind] : null; return d ? (d.stats[key] === undefined ? 4 : d.stats[key]) : 4; }
  enabled(kind) { const k = OPT_OF_KIND[kind]; return k === undefined || !!(this.O[k] === undefined ? true : this.O[k]); }
  max_troops(p) { return 1000 + p.tl.length * 12 + this.count(p.id, 'H') * 3000; }
  allied(a, b) { return this.alliances.has(pairKey(a, b)); }
  hostile(a, b) { return a !== b && !this.allied(a, b); }
  broadcast(text) { for (const p of this.players.values()) p.msg(text); }
  coastal(i) { for (let k = 0; k < 4; k++) { const j = NEIGH[i * 4 + k]; if (j >= 0 && this.owner[j] === WATER) return true; } return false; }
  can_respawn() { return this.mode === 'endless' || this.tick_no < this.spawn_phase_end + 600; }

  // ---------- Felder & Kampf ----------
  set_owner(i, nw) {
    const old = this.owner[i]; this.owner[i] = nw; this.changes.push(i, nw);
    if (old !== NEUTRAL && old !== WATER) {
      const op = this.players.get(old);
      if (op) {
        const k = this.pos[i];
        if (k >= 0 && op.tl[k] === i) { const last = op.tl.pop(); if (last !== i) { op.tl[k] = last; this.pos[last] = k; } this.pos[i] = -1; }
        if (!op.tl.length && op.alive) this.eliminate(op, nw, i);
      }
    }
    if (nw !== NEUTRAL && nw !== WATER) { const p = this.players.get(nw); this.pos[i] = p.tl.length; p.tl.push(i); }
  }
  eliminate(p, by, at = null) {
    p.alive = false; const killer = this.players.get(by);
    if (killer) {
      // Beute: das ganze Gold des Landes + Eroberungs-Bonus
      const loot = trunc(p.gold + CONQUEST_BONUS * this.M.gold); killer.gold += loot;
      if (at !== null) this.fx.push(['gold', at % W + 0.5, fdiv(at, W) + 0.5, loot, killer.id, 1]);
      killer.msg(`${p.name} erobert! +${fmt(loot)} Gold`);
      this.broadcast(`${p.name} wurde von ${killer.name} besiegt!`);
    }
    else this.broadcast(`${p.name} wurde ausgelöscht!`);
    p.troops = 0; p.gold = 0;
    p.msg(this.can_respawn() ? 'Du wurdest besiegt! Drücke R für einen Neustart.' : 'Du wurdest besiegt! Warte auf die nächste Runde.');
    for (const at of this.attacks) { if (at.done) continue; if (at.a === p.id) at.done = true; else if (at.t === p.id) { at.done = true; this.players.get(at.a).troops += at.troops; } }
    for (const lst of [this.boats, this.ships, this.planes, this.missiles]) for (const u of lst) if (u.owner === p.id) u.dead = true;
    for (const k of [...this.alliances]) { const [a, b] = k.split(':').map(Number); if (a === p.id || b === p.id) this.alliances.delete(k); }
    this.requests = this.requests.filter(r => r[0] !== p.id && r[1] !== p.id);
  }
  find_frontier(a, t, isl) {
    const own = this.owner, island = this.island, fr = new Set();
    for (const i of this.players.get(a).tl) { if (island[i] !== isl) continue; for (let k = 0; k < 4; k++) { const j = NEIGH[i * 4 + k]; if (j >= 0 && own[j] === t) fr.add(j); } }
    return fr;
  }
  add_attack(a, t, troops, isl) {
    const p = this.players.get(a);
    for (const at of this.attacks) if (!at.done && at.a === a && at.t === t && at.isl === isl) { at.troops += troops; return true; }
    const frontier = this.find_frontier(a, t, isl); if (!frontier.size) return false;
    for (const at of this.attacks) if (!at.done && at.a === t && at.t === a) { const m = Math.min(at.troops, troops); at.troops -= m; troops -= m; if (at.troops <= 1) at.done = true; }
    if (troops > 1) { this.attacks.push({ a, t, troops, frontier, done: false, isl }); if (t !== NEUTRAL) this.players.get(t).msg(`${p.name} greift dich an! (${fmt(troops)} Truppen)`); }
    return true;
  }
  start_attack(a, tile, ratio, via = 'auto') {
    const p = this.players.get(a);
    if (!p || !p.alive || !(tile >= 0 && tile < W * H) || this.winner) return;
    const t = this.owner[tile]; if (t === WATER || t === a) return;
    if (t !== NEUTRAL && this.allied(a, t)) { p.msg('Verbündete kann man nicht angreifen.'); return; }
    ratio = Math.min(1.0, Math.max(0.01, parseFloat(ratio) || 0.3));
    const troops = p.troops * ratio;
    if (troops < 5) { p.msg('Zu wenig Truppen!'); return; }
    p.troops -= troops;
    let mine = false; const it = this.island[tile]; for (const i of p.tl) if (this.island[i] === it) { mine = true; break; }
    if ((via === 'auto' || via === 'land') && mine && this.add_attack(a, t, troops, it)) return;
    if ((via === 'auto' || via === 'boat') && this.launch_boat(p, tile, troops)) return;
    if ((via === 'auto' || via === 'plane') && this.enabled('L') && this.launch_plane(p, tile, troops)) return;
    p.troops += troops;
    if (via === 'land') p.msg('Kein Landweg dorthin - wähle Schiff oder Kampfjet.');
    else if (via === 'plane') {
      if (!this.enabled('L')) p.msg('Kampfjets sind ausgeschaltet.');
      else if (this.airport_for(p, tile) !== null && p.gold < PLANE_COST) p.msg(`Zu wenig Gold: ein Kampfjet kostet ${fmt(PLANE_COST)}.`);
      else p.msg('Kein eigener Flughafen (L) in Reichweite.');
    } else if (via === 'boat') p.msg('Kein eigener Hafen (P) oder kein Seeweg zu diesem Ziel.');
    else if (this.count(a, 'P') || this.count(a, 'L')) p.msg('Ziel nicht erreichbar (zu weit für Kampfjets, kein Seeweg).');
    else p.msg('Kein Grenzkontakt. Baue einen Hafen (P) oder Flughafen (L)!');
  }
  tile_cost(dp) {
    if (!dp) return [1.2, 0.0];
    const dens = dp.troops / Math.max(1, dp.tl.length); let cost = 1.0 + dens * 0.6; const loss = dens * 0.45;
    if (dp.traitor_until > this.tick_no) cost *= 0.5;
    if (!dp.bot && !dp.online && this.mode === 'endless') cost *= 2.0;
    return [cost, loss];
  }
  run_attacks() {
    const own = this.owner, cm = this.M.conquer;
    for (const at of this.attacks) {
      if (at.done) continue;
      const ap = this.players.get(at.a), dp = at.t !== NEUTRAL ? this.players.get(at.t) : null;
      if (dp && (!dp.alive || this.allied(at.a, at.t))) { at.done = true; ap.troops += at.troops; continue; }
      let [cost, loss] = this.tile_cost(dp);
      cost *= stat_factor(this.dstat(at.a, 'tank', 'staerke'), -0.05);
      let speed = (1 + Math.sqrt(at.troops) / 12 + at.frontier.size * 0.015) * cm;
      speed *= stat_factor(this.dstat(at.a, 'tank', 'tempo'), 0.08);
      if (dp) speed *= 0.6;
      const n = Math.min(at.frontier.size, trunc(speed + rnd()));
      if (n <= 0) continue;
      const nb = i => { let c = 0; for (let k = 0; k < 4; k++) { const j = NEIGH[i * 4 + k]; if (j >= 0 && own[j] === at.a) c++; } return c; };
      const pool = sample(at.frontier, Math.min(at.frontier.size, n * 4)).map(i => [nb(i), i]).sort((x, y) => y[0] - x[0]);
      for (let q = 0; q < n && q < pool.length; q++) {
        const i = pool[q][1];
        if (at.troops < cost) break;
        at.frontier.delete(i);
        if (own[i] !== at.t) continue;
        if (!nb(i)) continue;
        at.troops -= cost;
        if (dp) dp.troops = Math.max(0.0, dp.troops - loss);
        this.set_owner(i, at.a);
        if (at.done) break;
        for (let k = 0; k < 4; k++) { const j = NEIGH[i * 4 + k]; if (j >= 0 && own[j] === at.t) at.frontier.add(j); }
      }
      if (!at.done && (!at.frontier.size || at.troops < cost)) { at.done = true; ap.troops += at.troops; }
    }
    this.attacks = this.attacks.filter(at => !at.done);
  }
  land_troops(pid, tile, troops, what) {
    const ap = this.players.get(pid); if (!ap || !ap.alive) return;
    const o = this.owner[tile];
    if (o === WATER || o === pid) { ap.troops += troops; return; }
    if (o !== NEUTRAL && this.allied(pid, o)) { ap.troops += troops; ap.msg(`${what} ist bei einem Verbündeten angekommen und kehrt um.`); return; }
    const [cost] = this.tile_cost(o !== NEUTRAL ? this.players.get(o) : null);
    if (troops < cost * 3) { ap.msg(`${what}: zu wenig Truppen zum Landen.`); return; }
    troops -= cost; this.set_owner(tile, pid);
    if (o === NEUTRAL || this.players.get(o).alive) { if (!this.add_attack(pid, o, troops, this.island[tile])) ap.troops += troops; }
    else ap.troops += troops;
  }

  // ---------- Boote ----------
  nearest_coast(tile, owner_id) {
    const own = this.owner, seen = new Set([tile]), q = [tile];
    for (let k = 0; k < q.length && k < 6000; k++) {
      const i = q[k]; if (this.coastal(i)) return i;
      for (let d = 0; d < 4; d++) { const j = NEIGH[i * 4 + d]; if (j >= 0 && !seen.has(j) && own[j] === owner_id) { seen.add(j); q.push(j); } }
    }
    return null;
  }
  water_path(starts, goals) {
    const own = this.owner, parent = new Int32Array(W * H).fill(-2), q = new Int32Array(W * H); let h = 0, t = 0;
    for (const s of starts) if (parent[s] === -2) { parent[s] = -1; q[t++] = s; }
    while (h < t) {
      let i = q[h++];
      if (goals.has(i)) { const path = []; while (i !== -1) { path.push(i); i = parent[i]; } return path.reverse(); }
      for (let k = 0; k < 4; k++) { const j = NEIGH[i * 4 + k]; if (j >= 0 && parent[j] === -2 && own[j] === WATER) { parent[j] = i; q[t++] = j; } }
    }
    return null;
  }
  launch_boat(p, tile, troops) {
    const ports = []; for (const [i, b] of this.buildings) if (b[0] === 'P' && this.owner[i] === p.id) ports.push(i);
    if (!ports.length) return false;
    const land = this.nearest_coast(tile, this.owner[tile]); if (land === null) return false;
    const goals = new Set(); for (let k = 0; k < 4; k++) { const j = NEIGH[land * 4 + k]; if (j >= 0 && this.owner[j] === WATER) goals.add(j); }
    const starts = []; for (const t of ports) for (let k = 0; k < 4; k++) { const j = NEIGH[t * 4 + k]; if (j >= 0 && this.owner[j] === WATER) starts.push(j); }
    const path = this.water_path(starts, goals); if (!path) return false;
    this.boats.push(new Boat(this.uid(), p.id, troops, path, land));
    p.msg(`Boot mit ${fmt(troops)} Truppen legt ab!`);
    const t = this.owner[land]; if (t !== NEUTRAL && t !== WATER) this.players.get(t).msg(`Ein Boot von ${p.name} kommt auf dich zu!`);
    return true;
  }
  run_boats() {
    const sp = 0.8 * this.M.units;
    for (const b of this.boats) { if (b.dead) continue; b.pos += sp; if (b.pos >= b.path.length - 1) { b.dead = true; this.land_troops(b.owner, b.land, b.troops, 'Boot'); } }
    this.boats = this.boats.filter(b => !b.dead);
  }

  // ---------- Kampfjets ----------
  airport_for(p, tile) {
    const x = tile % W, y = fdiv(tile, W); let best = null, bd = 1e9;
    for (const [t, b] of this.buildings) if (b[0] === 'L' && this.owner[t] === p.id) { const d = Math.hypot(t % W - x, fdiv(t, W) - y); if (d <= building_range('L', b[1]) && d < bd) { best = t; bd = d; } }
    return best;
  }
  launch_plane(p, tile, troops) {
    const best = this.airport_for(p, tile);
    if (best === null || this.owner[tile] === WATER || p.gold < PLANE_COST) return false;
    p.gold -= PLANE_COST;
    this.planes.push(new Plane(this.uid(), p.id, troops, best % W + 0.5, fdiv(best, W) + 0.5, tile));
    p.msg(`Kampfjet mit ${fmt(troops)} Truppen startet! (-${fmt(PLANE_COST)} Gold)`);
    const o = this.owner[tile]; if (o !== NEUTRAL && o !== WATER) this.players.get(o).msg(`Kampfjet von ${p.name} im Anflug!`);
    return true;
  }
  run_planes() {
    for (const pl of this.planes) {
      if (pl.dead) continue;
      const sp = 2.0 * this.M.units * stat_factor(this.dstat(pl.owner, 'jet', 'tempo'), 0.1);
      const dx = pl.tx - pl.x, dy = pl.ty - pl.y, d = Math.hypot(dx, dy);
      if (d <= sp) { pl.dead = true; this.land_troops(pl.owner, pl.tile, pl.troops, 'Kampfjet'); }
      else { pl.x += dx / d * sp; pl.y += dy / d * sp; }
    }
    this.planes = this.planes.filter(p => !p.dead);
  }

  // ---------- Kriegsschiffe ----------
  is_water(x, y) { const ix = trunc(x), iy = trunc(y); return ix >= 0 && ix < W && iy >= 0 && iy < H && x >= 0 && y >= 0 && this.owner[iy * W + ix] === WATER; }
  move_ship(s, tx, ty, speed) {
    const dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy); if (d < 0.05) return true;
    const st = Math.min(speed, d), nx = s.x + dx / d * st, ny = s.y + dy / d * st;
    if (this.is_water(nx, ny)) { s.x = nx; s.y = ny; return true; }
    return false;
  }
  run_ships() {
    const u = this.M.units;
    for (const s of this.ships) {
      if (s.dead) continue;
      let target = null, best = 7.0;
      for (const b of this.boats) { if (b.dead || !this.hostile(s.owner, b.owner)) continue; const [bx, by] = b.xy(), d = Math.hypot(bx - s.x, by - s.y); if (d < best) { best = d; target = b; } }
      if (target) {
        if (best < 1.6) {
          target.dead = true;
          this.players.get(target.owner).msg(`Dein Boot (${fmt(target.troops)} Truppen) wurde von ${this.players.get(s.owner).name} versenkt!`);
          this.players.get(s.owner).msg('Dein Kriegsschiff hat ein feindliches Boot versenkt!');
          this.fx.push(['boom', r1(s.x), r1(s.y), 1.5]);
        } else this.move_ship(s, ...target.xy(), 1.0 * u);
        continue;
      }
      let enemy = null; best = 5.0;
      for (const o of this.ships) { if (o === s || o.dead || !this.hostile(s.owner, o.owner)) continue; const d = Math.hypot(o.x - s.x, o.y - s.y); if (d < best) { best = d; enemy = o; } }
      if (enemy) {
        enemy.hp -= 1.5 * u * stat_factor(this.dstat(s.owner, 'ship', 'feuer'), 0.12);
        if (enemy.hp <= 0) {
          enemy.dead = true; this.fx.push(['boom', r1(enemy.x), r1(enemy.y), 2]);
          this.players.get(enemy.owner).msg('Ein Kriegsschiff von dir wurde zerstört!');
          this.players.get(s.owner).msg('Dein Kriegsschiff hat ein feindliches Schiff zerstört!');
        }
        continue;
      }
      if (s.tx === null || Math.hypot(s.tx - s.x, s.ty - s.y) < 0.5) {
        const hx = s.home % W, hy = fdiv(s.home, W);
        for (let k = 0; k < 20; k++) { const tx = hx + uniform(-12, 12), ty = hy + uniform(-12, 12); if (this.is_water(tx, ty)) { s.tx = tx; s.ty = ty; break; } }
      }
      if (s.tx !== null && !this.move_ship(s, s.tx, s.ty, 0.3 * u)) s.tx = null;
    }
    this.ships = this.ships.filter(s => !s.dead);
  }

  // ---------- Raketen, SAM ----------
  ready_silos(pid) { const r = []; for (const [t, b] of this.buildings) if (b[0] === 'M' && this.owner[t] === pid && b[2] <= this.tick_no) r.push(t); return r; }
  launch_bomb(pid, tile, kind) {
    const p = this.players.get(pid);
    if (!p || !p.alive || !BOMBS[kind] || !(tile >= 0 && tile < W * H) || this.winner) return;
    const info = BOMBS[kind];
    if (!this.enabled(kind)) { p.msg(`${info.name} ist in dieser Runde ausgeschaltet.`); return; }
    const o = this.owner[tile];
    if (o === pid || (o !== NEUTRAL && o !== WATER && this.allied(pid, o))) { p.msg('Ziel ist dein eigenes oder verbündetes Land!'); return; }
    const silos = this.ready_silos(pid);
    if (!silos.length) { p.msg(this.count(pid, 'M') ? 'Kein Raketensilo bereit.' : 'Baue zuerst ein Raketensilo (M)!'); return; }
    if (p.gold < info.cost) { p.msg(`Zu wenig Gold für ${info.name} (${fmt(info.cost)}).`); return; }
    const tx = tile % W + 0.5, ty = fdiv(tile, W) + 0.5;
    const silo = silos.reduce((a, b) => Math.hypot(a % W - tx, fdiv(a, W) - ty) <= Math.hypot(b % W - tx, fdiv(b, W) - ty) ? a : b);
    p.gold -= info.cost;
    const b = this.buildings.get(silo); b[2] = this.tick_no + trunc(150 / b[1] / this.M.units);
    const sx = silo % W + 0.5, sy = fdiv(silo, W) + 0.5, d = Math.hypot(tx - sx, ty - sy), ticks = (25 + d * 0.25) / this.M.units / stat_factor(this.dstat(pid, kind, 'tempo'), 0.1);
    this.missiles.push(new Missile(this.uid(), pid, kind, sx, sy, tx, ty, 1.0 / ticks));
    if (kind === 'small') p.msg('Bombe gestartet!'); else this.broadcast(`WARNUNG: ${p.name} hat eine ${info.name} gestartet!`);
    if (o !== NEUTRAL && o !== WATER) this.players.get(o).msg(`Rakete von ${p.name} im Anflug auf dich!`);
  }
  detonate(m) {
    let r = BOMBS[m.kind] ? BOMBS[m.kind].r : HEAD_R; const cx = m.tx, cy = m.ty;
    r *= stat_factor(this.dstat(m.owner, m.kind === 'head' ? 'mirv' : m.kind, 'kraft'), 0.06);
    this.fx.push(['boom', r1(cx), r1(cy), r]);
    const lost = new Map(), before = new Map(); for (const [pid, p] of this.players) before.set(pid, p.tl.length);
    const rr = r + 1;
    for (let yy = Math.max(0, trunc(cy - rr)); yy < Math.min(H, trunc(cy + rr) + 1); yy++) for (let xx = Math.max(0, trunc(cx - rr)); xx < Math.min(W, trunc(cx + rr) + 1); xx++) {
      const d = Math.hypot(xx + 0.5 - cx, yy + 0.5 - cy); if (d > r * (0.85 + 0.3 * rnd())) continue;
      const i = yy * W + xx, o = this.owner[i]; if (o === WATER || o === NEUTRAL) continue;
      lost.set(o, (lost.get(o) || 0) + 1); this.set_owner(i, NEUTRAL);
    }
    for (const t of [...this.buildings.keys()]) if (Math.hypot(t % W + 0.5 - cx, fdiv(t, W) + 0.5 - cy) <= r) this.buildings.delete(t);
    for (const lst of [this.ships, this.boats, this.planes]) for (const u of lst) { const [ux, uy] = u instanceof Boat ? u.xy() : [u.x, u.y]; if (Math.hypot(ux - cx, uy - cy) <= r) u.dead = true; }
    const attacker = this.players.get(m.owner);
    for (const [o, n] of lost) {
      const p = this.players.get(o); if (!p) continue;
      const frac = n / Math.max(1, before.has(o) ? before.get(o) : n);
      p.troops *= Math.max(0.1, 1 - Math.min(0.9, frac * 1.5));
      if (o !== m.owner) p.msg(`Einschlag! Du hast ${fmt(n)} Felder verloren` + (attacker ? ` (von ${attacker.name}).` : '.'));
    }
    if (attacker && m.kind !== 'head') { let total = 0; for (const [o, n] of lost) if (o !== m.owner) total += n; attacker.msg(`Treffer! ${fmt(total)} feindliche Felder zerstört.`); }
    this.update_counts();
  }
  run_missiles() {
    const nw = [];
    for (const m of this.missiles) {
      if (m.dead) continue;
      m.prog += m.step;
      if (m.kind === 'mirv' && m.prog >= 0.65) {
        m.dead = true; const [x, y] = m.xy(), rest = Math.max(4, trunc((1 - m.prog) / m.step)), spread = BOMBS.mirv.r;
        for (let k = 0; k < MIRV_HEADS; k++) {
          const a = uniform(0, 2 * Math.PI), rad = spread * Math.sqrt(rnd());
          const tx = Math.min(W - 1, Math.max(0, m.tx + Math.cos(a) * rad)), ty = Math.min(H - 1, Math.max(0, m.ty + Math.sin(a) * rad));
          nw.push(new Missile(this.uid(), m.owner, 'head', x, y, tx, ty, 1.0 / rest));
        }
        continue;
      }
      if (m.prog >= 1) { m.dead = true; this.detonate(m); }
    }
    this.missiles = this.missiles.filter(m => !m.dead).concat(nw);
    for (const [t, b] of this.buildings) {
      if (b[0] !== 'V' || b[2] > this.tick_no) continue;
      const o = this.owner[t]; if (o === NEUTRAL || o === WATER) continue;
      const sx = t % W + 0.5, sy = fdiv(t, W) + 0.5, rng = building_range('V', b[1]);
      let hit = null;
      for (const m of this.missiles) { if (m.dead || m.prog < 0.4 || !this.hostile(o, m.owner)) continue; const [mx, my] = m.xy(); if (Math.hypot(mx - sx, my - sy) <= rng) { hit = m; break; } }
      if (hit === null) for (const pl of this.planes) { const stealth = stat_factor(this.dstat(pl.owner, 'jet', 'tarnung'), -0.08); if (!pl.dead && this.hostile(o, pl.owner) && Math.hypot(pl.x - sx, pl.y - sy) <= rng * stealth) { hit = pl; break; } }
      if (hit === null) continue;
      hit.dead = true; b[2] = this.tick_no + trunc(50 / b[1] / this.M.units);
      const [hx, hy] = hit instanceof Missile ? hit.xy() : [hit.x, hit.y];
      this.fx.push(['sam', r1(sx), r1(sy), r1(hx), r1(hy)]);
      const owner_p = this.players.get(hit.owner);
      if (hit instanceof Missile) { this.players.get(o).msg('SAM hat eine feindliche Rakete abgeschossen!'); if (owner_p) owner_p.msg('Deine Rakete wurde von einer SAM abgefangen!'); }
      else { this.players.get(o).msg('SAM hat einen feindlichen Kampfjet abgeschossen!'); if (owner_p) owner_p.msg(`Dein Kampfjet (${fmt(hit.troops)} Truppen) wurde abgeschossen!`); }
    }
    this.missiles = this.missiles.filter(m => !m.dead);
    this.planes = this.planes.filter(p => !p.dead);
  }

  // ---------- Bauen ----------
  near_building(i, dist = 2) { const x = i % W, y = fdiv(i, W); for (const t of this.buildings.keys()) if (Math.abs(t % W - x) <= dist && Math.abs(fdiv(t, W) - y) <= dist) return t; return null; }
  own_building_near(pid, tile, kind, dist = 2) {
    const x = tile % W, y = fdiv(tile, W); let best = null, bd = 99;
    for (const [t, b] of this.buildings) if (b[0] === kind && this.owner[t] === pid) { const d = Math.max(Math.abs(t % W - x), Math.abs(fdiv(t, W) - y)); if (d <= dist && d < bd) { best = t; bd = d; } }
    return best;
  }
  nearest_own_port(pid, tile, maxd = 15) {
    const x = tile % W, y = fdiv(tile, W); let best = null, bd = maxd;
    for (const [t, b] of this.buildings) if (b[0] === 'P' && this.owner[t] === pid) { const d = Math.hypot(t % W - x, fdiv(t, W) - y); if (d <= bd) { best = t; bd = d; } }
    return best;
  }
  build(pid, tile, kind) {
    const p = this.players.get(pid); if (!p || !p.alive || !(tile >= 0 && tile < W * H)) return;
    if (BOMBS[kind]) { this.launch_bomb(pid, tile, kind); return; }
    if (!BTYPES[kind]) return;
    const name = BTYPES[kind].name;
    if (!this.enabled(kind)) { p.msg(`${name} ist in dieser Runde ausgeschaltet.`); return; }
    const cost = build_cost(kind, this.count(pid, kind));
    if (kind === 'S') {
      const port = this.nearest_own_port(pid, tile);
      if (port === null) { p.msg('Für Kriegsschiffe brauchst du einen eigenen Hafen in der Nähe.'); return; }
      if (this.ships.filter(s => s.home === port).length >= SHIPS_PER_PORT * this.buildings.get(port)[1]) { p.msg('Dieser Hafen hat schon genug Schiffe. Hafen verbessern (stapeln) erlaubt mehr.'); return; }
      let spot = null; for (let k = 0; k < 4; k++) { const j = NEIGH[port * 4 + k]; if (j >= 0 && this.owner[j] === WATER) { spot = j; break; } }
      if (spot === null) return;
      if (p.gold < cost) { p.msg(`Zu wenig Gold für ${name} (${fmt(cost)}).`); return; }
      p.gold -= cost;
      this.ships.push(new Ship(this.uid(), pid, spot % W + 0.5, fdiv(spot, W) + 0.5, port, 100.0 * stat_factor(this.dstat(pid, 'ship', 'panzer'), 0.15)));
      p.msg('Kriegsschiff gebaut!'); this.update_counts(); return;
    }
    if (p.gold < cost) { p.msg(`Zu wenig Gold für ${name} (${fmt(cost)}).`); return; }
    const same = this.own_building_near(pid, tile, kind);
    if (same !== null) { p.gold -= cost; this.buildings.get(same)[1] += 1; p.msg(`${name} auf Stufe ${this.buildings.get(same)[1]} verbessert!`); }
    else {
      if (this.owner[tile] !== pid) { p.msg('Du kannst nur auf deinem eigenen Land bauen.'); return; }
      if (this.near_building(tile) !== null) { p.msg('Zu nah an einem anderen Gebäude.'); return; }
      if (kind === 'P' && !this.coastal(tile)) { p.msg('Ein Hafen muss direkt an der Küste stehen.'); return; }
      p.gold -= cost; this.buildings.set(tile, [kind, 1, 0]); p.msg(`${name} gebaut!`);
    }
    this.update_counts(); this.update_rails();
  }
  run_trains() {
    const own = this.owner, active = new Set(this.trains.map(tr => tr.a + ',' + tr.b));
    for (const [key, rate] of this.rail_info) {
      if (active.has(key) || (this.rail_wait.get(key) || 0) > this.tick_no) continue;
      const [a, b] = key.split(',').map(Number), o = own[a];
      if (o === NEUTRAL || o === WATER || own[b] !== o) continue;
      const d = Math.max(1.0, Math.hypot(b % W - a % W, fdiv(b, W) - fdiv(a, W)));
      this.trains.push(new Train(this.uid(), o, a, b, TRAIN_SPEED * this.M.units / d, rate));
    }
    for (const tr of this.trains) {
      const key = tr.a + ',' + tr.b;
      if (!this.rail_info.has(key) || own[tr.a] !== tr.owner || own[tr.b] !== tr.owner) { tr.dead = true; continue; }
      tr.prog += tr.step; tr.ticks += 1;
      if (tr.prog >= 1) {
        tr.dead = true; const amount = tr.rate * (tr.ticks + TRAIN_PAUSE) * this.M.gold, p = this.players.get(tr.owner);
        if (p && p.alive) { p.gold += amount; this.fx.push(['gold', tr.b % W + 0.5, fdiv(tr.b, W) + 0.5, trunc(amount), tr.owner]); }
        this.rail_wait.set(key, this.tick_no + TRAIN_PAUSE);
      }
    }
    this.trains = this.trains.filter(tr => !tr.dead);
  }
  update_counts() {
    const cnt = {};
    for (const [t, b] of this.buildings) { const o = this.owner[t], d = cnt[o] || (cnt[o] = {}); d[b[0]] = (d[b[0]] || 0) + b[1]; }
    for (const s of this.ships) { const d = cnt[s.owner] || (cnt[s.owner] = {}); d.S = (d.S || 0) + 1; }
    this.bcount = cnt;
  }
  update_rails() {
    const rails = [], rg = {}, info = new Map(), items = [...this.buildings].filter(([, b]) => b[0] === 'H' || b[0] === 'F' || b[0] === 'B');
    for (const [t, b] of items) {
      if (b[0] !== 'B') continue;
      const o = this.owner[t], lvl = b[1], x = t % W, y = fdiv(t, W), rng = building_range('B', lvl), near = [];
      for (const [t2, b2] of items) { if (t2 === t || this.owner[t2] !== o || (b2[0] === 'B' && t2 < t)) continue; const d = Math.hypot(t2 % W - x, fdiv(t2, W) - y); if (d <= rng) near.push([d, t2, b2]); }
      near.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
      for (const [, t2, b2] of near.slice(0, 4 + 2 * (lvl - 1))) {
        rails.push([t, t2]); const bonus = b2[0] === 'F' ? 2.0 : 1.0, rate = 60 * bonus * (lvl + b2[1]) / 2;
        info.set(t + ',' + t2, rate); rg[o] = (rg[o] || 0) + rate;
      }
    }
    this.rails = rails; this.rail_gold = rg; this.rail_info = info;
  }

  // ---------- Diplomatie ----------
  has_request(a, b) { return this.requests.some(r => r[0] === a && r[1] === b); }
  drop_request(a, b) { this.requests = this.requests.filter(r => !(r[0] === a && r[1] === b)); }
  request_alliance(a, b) {
    const pa = this.players.get(a), pb = this.players.get(b);
    if (!pa || !pb || a === b || !pa.alive || !pb.alive || this.allied(a, b)) return;
    if (!this.O.alliances) { pa.msg('Bündnisse sind in dieser Runde ausgeschaltet.'); return; }
    if (this.has_request(b, a)) { this.form_alliance(a, b); return; }
    if (this.has_request(a, b)) { pa.msg(`Anfrage an ${pb.name} läuft schon.`); return; }
    if (pb.bot) {
      const strong = pa.tl.length > pb.tl.length * 0.8;
      if (pa.traitor_until <= this.tick_no && (strong || rnd() < 0.4)) this.form_alliance(a, b); else pa.msg(`${pb.name} lehnt dein Bündnis ab.`);
      return;
    }
    this.requests.push([a, b]);
    pa.msg(`Bündnisanfrage an ${pb.name} gesendet.`); pb.msg(`${pa.name} möchte ein Bündnis! (Y = annehmen)`);
  }
  form_alliance(a, b) {
    this.drop_request(a, b); this.drop_request(b, a); this.alliances.add(pairKey(a, b));
    for (const at of this.attacks) if (!at.done && ((at.a === a && at.t === b) || (at.a === b && at.t === a))) { at.done = true; this.players.get(at.a).troops += at.troops; }
    this.broadcast(`Bündnis: ${this.players.get(a).name} + ${this.players.get(b).name}`);
  }
  break_alliance(a, b) {
    if (!this.allied(a, b)) return;
    this.alliances.delete(pairKey(a, b)); const pa = this.players.get(a); pa.traitor_until = this.tick_no + TRAITOR_TICKS;
    this.broadcast(`VERRAT! ${pa.name} hat das Bündnis mit ${this.players.get(b).name} gebrochen.`);
  }
  send_resource(a, b, kind, ratio) {
    const pa = this.players.get(a), pb = this.players.get(b);
    if (!pa || !pb || !pb.alive || !this.allied(a, b)) { if (pa) pa.msg('Du kannst nur Verbündeten etwas schicken.'); return; }
    ratio = Math.min(1.0, Math.max(0.01, parseFloat(ratio) || 0.25));
    let amount, word;
    if (kind === 'troops') { amount = pa.troops * ratio; pa.troops -= amount; pb.troops += amount; word = 'Truppen'; }
    else { amount = pa.gold * ratio; pa.gold -= amount; pb.gold += amount; word = 'Gold'; }
    pa.msg(`${fmt(amount)} ${word} an ${pb.name} geschickt.`); pb.msg(`${pa.name} schickt dir ${fmt(amount)} ${word}!`);
  }

  // ---------- Bots ----------
  bot_build(p, smp) {
    const D = this.D; if (rnd() > D.build) return;
    if (this.count(p.id, 'P') && this.enabled('S') && rnd() < 0.1) {
      if (p.gold >= build_cost('S', this.count(p.id, 'S')) * 1.3) { let port = null; for (const [t, b] of this.buildings) if (b[0] === 'P' && this.owner[t] === p.id) { port = t; break; } if (port !== null) this.build(p.id, port, 'S'); }
      return;
    }
    const kinds = ['H', 'F', 'B', 'P', 'V', 'L'], weights = [0.3, 0.3, 0.17, 0.09, 0.08, 0.06];
    if (D.bomb > 0) { kinds.push('M'); weights.push(0.05); }
    const kind = choices(kinds, weights);
    if (!this.enabled(kind) || p.gold < build_cost(kind, this.count(p.id, kind)) * 1.2) return;
    if (rnd() < 0.35) { const own = []; for (const [t, b] of this.buildings) if (b[0] === kind && this.owner[t] === p.id) own.push(t); if (own.length) { this.build(p.id, choice(own), kind); return; } }
    for (const i of smp) { if (this.near_building(i) !== null) continue; if (kind === 'P' && !this.coastal(i)) continue; this.build(p.id, i, kind); return; }
  }
  bot_bomb(p, cands) {
    const enemies = [...cands.keys()].filter(o => o !== NEUTRAL && o !== WATER && !this.allied(p.id, o));
    if (!enemies.length || !this.ready_silos(p.id).length) return;
    const target = choice(enemies), kind = (p.gold > BOMBS.big.cost * 1.5 && rnd() < 0.3) ? 'big' : 'small';
    if (!this.enabled(kind) || p.gold < BOMBS[kind].cost * 1.2) return;
    const tiles = sample(this.players.get(target).tl, Math.min(20, this.players.get(target).tl.length));
    if (tiles.length) this.launch_bomb(p.id, choice(tiles), kind);
  }
  bot_think(p) {
    const D = this.D, smp = sample(p.tl, Math.min(50, p.tl.length));
    this.bot_build(p, smp);
    const maxt = this.max_troops(p);
    if (p.troops < maxt * uniform(...D.th)) return;
    if (this.attacks.some(at => at.a === p.id) && rnd() < 0.7) return;
    const cands = new Map();
    for (const i of smp) for (let k = 0; k < 4; k++) { const j = NEIGH[i * 4 + k]; if (j < 0) continue; const o = this.owner[j]; if (o !== p.id && o !== WATER && !cands.has(o)) cands.set(o, j); }
    if (D.bomb && rnd() < D.bomb * 10) this.bot_bomb(p, cands);
    const enemies = [...cands.keys()].filter(o => o !== NEUTRAL && !this.allied(p.id, o) && (this.players.get(o).bot || rnd() < D.human));
    if (!cands.has(NEUTRAL) && !enemies.length) {
      if (!this.boats.concat(this.planes).some(b => b.owner === p.id) && rnd() < 0.25) {
        for (let k = 0; k < 40; k++) {
          const i = randrange(W * H), o = this.owner[i];
          if (o !== WATER && o !== p.id && (o === NEUTRAL || (!this.allied(p.id, o) && this.players.get(o).bot))) {
            const tr = p.troops * uniform(...D.ratio); p.troops -= tr;
            if (!(this.launch_plane(p, i, tr) || this.launch_boat(p, i, tr))) p.troops += tr;
            break;
          }
        }
      }
      return;
    }
    let target = null;
    if (cands.has(NEUTRAL) && (!enemies.length || rnd() < 0.85)) target = NEUTRAL;
    else if (enemies.length) {
      const dens = o => { const q = this.players.get(o); let d = q.troops / Math.max(1, q.tl.length); if (q.traitor_until > this.tick_no) d *= 0.5; return d; };
      target = enemies.reduce((a, b) => dens(b) < dens(a) ? b : a);
      const mine = p.troops / Math.max(1, p.tl.length);
      if (dens(target) > mine * 1.2 && rnd() < 0.85) return;
      const other = this.players.get(target);
      if (!other.bot && this.O.alliances && rnd() < 0.03 && other.tl.length > p.tl.length) {
        if (!this.has_request(p.id, target)) this.requests.push([p.id, target]);
        other.msg(`${p.name} möchte ein Bündnis! (Y = annehmen)`); return;
      }
    }
    if (target !== null) this.start_attack(p.id, cands.get(target), uniform(...D.ratio));
  }

  // ---------- Hauptschritt ----------
  tick() {
    this.tick_no += 1; const M = this.M;
    for (const p of this.players.values()) if (p.spawn_deadline !== null && this.tick_no >= p.spawn_deadline) { this.spawn(p); p.msg('Startpunkt wurde automatisch gewählt.'); }
    if (this.tick_no < this.spawn_phase_end) return;
    if (this.tick_no % 20 === 0) { this.update_counts(); this.update_rails(); }
    for (const p of this.players.values()) {
      if (!p.alive) { p.troop_rate = p.gold_rate = 0; continue; }
      const n = p.tl.length, maxt = this.max_troops(p);
      let grow = (4 + n * 0.04 + this.count(p.id, 'H') * 2) * Math.max(0.0, 1 - p.troops / maxt) * M.grow;
      if (p.bot) grow *= this.D.grow;
      const gold = (GOLD_SCALE * (1 + n * 0.01) + this.count(p.id, 'F') * 150 + this.count(p.id, 'P') * 50) * M.gold;
      p.troops += grow; p.gold += gold; p.troop_rate = grow * 10; p.gold_rate = (gold + (this.rail_gold[p.id] || 0) * M.gold) * 10;
      if (p.bot && (this.tick_no + p.id) % this.D.think === 0) this.bot_think(p);
    }
    this.run_attacks(); this.run_boats(); this.run_planes(); this.run_missiles(); this.run_ships(); this.run_trains();
    if (M.win) {
      const share = this.O.win / 100.0;
      if (share > 0 && this.winner === null && this.tick_no % 10 === 0) for (const p of this.players.values()) if (p.alive && p.tl.length >= share * this.land) { this.winner = p.name; this.reset_at = this.tick_no + 200; this.broadcast(`${p.name} hat gewonnen! Neue Runde in 20 Sekunden.`); }
      if (this.reset_at && this.tick_no >= this.reset_at) this.new_round();
    } else {
      if (this.tick_no % 300 === 0) {
        const alive_bots = [...this.players.values()].filter(p => p.bot && p.alive).length;
        if (alive_bots < this.bots_target) { const dead = [...this.players.values()].filter(p => p.bot && !p.alive); this.spawn(dead.length ? dead[0] : this.add_bot()); }
      }
      if (this.tick_no % 600 === 0) this.save();
    }
  }

  // ---------- Befehle ----------
  handle(kind, conn, data) {
    if (kind === 'join') {
      let name = String(data.name === undefined ? 'Spieler' : data.name).trim().slice(0, 16) || 'Spieler', p = null, welcome;
      if (this.mode === 'endless') for (const q of this.players.values()) if (q.name === name && !q.bot && !q.online) { p = q; break; }
      if (p === null) {
        const names = new Set([...this.players.values()].map(q => q.name)); const base = name; let k = 2;
        while (names.has(name)) { name = `${base}${k}`; k++; }
        p = this.add_player(name); if (p === null) { conn.send({ t: 'error', msg: 'Server ist voll.' }); return; }
        p.spawn_deadline = this.spawn_deadline_now();
        welcome = `Willkommen, ${p.name}! Klicke auf die Karte, um deinen Startpunkt zu wählen.`;
      } else welcome = `Willkommen zurück, ${p.name}! Dein Reich hat auf dich gewartet.`;
      p.online = true; p.conn = conn; p.designs = {};
      const raw = (data.designs && typeof data.designs === 'object') ? data.designs : {};
      for (const k of DESIGN_KINDS) { const d = validate_design(k, raw[k]); if (d && d.use) p.designs[k] = d; }
      const bd = validate_blob(raw.blob); if (bd) p.designs.blob = bd;
      this.conn_pid.set(conn, p.id); this.need_full.add(conn);
      p.msg(welcome); this.broadcast(`${p.name} ist dem Spiel beigetreten.`);
      conn.send({ t: 'welcome', id: p.id, w: W, h: H, mode: this.mode });
      return;
    }
    if (kind === 'leave') {
      const pid = this.conn_pid.get(conn); this.conn_pid.delete(conn); this.need_full.delete(conn);
      const p = this.players.get(pid); if (p) { p.online = false; p.conn = null; this.broadcast(`${p.name} hat das Spiel verlassen.`); }
      return;
    }
    const pid = this.conn_pid.get(conn), p = this.players.get(pid); if (!p) return;
    const t = data.t, int = v => { const n = parseInt(v, 10); if (isNaN(n)) throw new Error('bad'); return n; };
    try {
      if (t === 'resync') this.need_full.add(conn);
      else if (t === 'attack') { const via = data.v || 'auto'; this.start_attack(pid, int(data.i), data.r === undefined ? 0.3 : data.r, VIAS.includes(via) ? via : 'auto'); }
      else if (t === 'build') this.build(pid, int(data.i), String(data.k));
      else if (t === 'ally') this.request_alliance(pid, int(data.p));
      else if (t === 'accept') { const reqs = this.requests.filter(r => r[1] === pid).map(r => r[0]); if (reqs.length) this.form_alliance(pid, reqs[reqs.length - 1]); else p.msg('Keine offene Bündnisanfrage.'); }
      else if (t === 'break') this.break_alliance(pid, int(data.p));
      else if (t === 'send') this.send_resource(pid, int(data.p), data.k, data.r === undefined ? 0.25 : data.r);
      else if (t === 'buy') { if (p.alive) { const gold = p.gold * 0.5; p.gold -= gold; p.troops += gold / GOLD_SCALE; p.msg(`${fmt(gold)} Gold in ${fmt(gold / GOLD_SCALE)} Truppen umgewandelt.`); } }
      else if (t === 'spawn') this.choose_spawn(p, int(data.i));
      else if (t === 'respawn') { if (!p.alive && p.spawn_deadline === null && this.can_respawn()) { p.spawn_deadline = this.tick_no + 300; p.msg('Wähle einen neuen Startpunkt: Klick auf freies Land.'); } }
      else if (t === 'chat') {
        const text = String(data.m === undefined ? '' : data.m).slice(0, 120).trim();
        if (text.startsWith('/a ')) { for (const q of this.players.values()) if (q.id === pid || this.allied(pid, q.id)) q.msg(`[Bund] ${p.name}: ${text.slice(3)}`); }
        else if (text) this.broadcast(`${p.name}: ${text}`);
      }
    } catch (e) { /* ungültiger Befehl */ }
  }
  send_states() {
    const chg = this.changes; this.changes = [];
    const fx = this.fx; this.fx = []; this.seq += 1;
    const ready = {}; for (const [t, b] of this.buildings) if (b[0] === 'M' && b[2] <= this.tick_no) { const o = this.owner[t]; ready[o] = (ready[o] || 0) + 1; }
    const atk = this.attacks.map(at => { const e = [at.a, at.t, trunc(at.troops)]; let k = 0; for (const i of at.frontier) { if (k++ >= 10) break; e.push(i); } return e; });
    const base = {
      t: 'state', seq: this.seq, tick: this.tick_no, mode: this.mode, land: this.land, chg, fx, opts: this.O,
      phase: Math.max(0, fdiv(this.spawn_phase_end - this.tick_no + 9, 10)),
      players: [...this.players.values()].map(p => ({ id: p.id, n: p.name, c: p.color, tr: trunc(p.troops), g: trunc(p.gold), ti: p.tl.length, a: p.alive, b: p.bot, on: p.online, tr8: p.traitor_until > this.tick_no, mx: this.max_troops(p), trr: Math.round(p.troop_rate), gr: Math.round(p.gold_rate), sr: ready[p.id] || 0, sp: p.spawn_deadline !== null ? Math.max(0, fdiv(p.spawn_deadline - this.tick_no, 10)) : null })),
      al: [...this.alliances].map(k => k.split(':').map(Number)),
      rq: this.requests.map(r => [r[0], r[1]]),
      atk,
      bld: [...this.buildings].map(([t, b]) => [t, b[0], b[1]]),
      rails: this.rails,
      trains: this.trains.map(tr => [tr.id, tr.owner, tr.a, tr.b, r3(tr.prog)]),
      boats: this.boats.map(b => { const [x, y] = b.xy(); return [b.id, b.owner, r2(x), r2(y), trunc(b.troops)]; }),
      planes: this.planes.map(pl => [pl.id, pl.owner, r2(pl.x), r2(pl.y), trunc(pl.troops)]),
      ships: this.ships.map(s => [s.id, s.owner, r2(s.x), r2(s.y), trunc(100 * s.hp / Math.max(1.0, s.maxhp))]),
      mis: this.missiles.map(m => [m.id, m.owner, m.kind, r1(m.sx), r1(m.sy), r1(m.tx), r1(m.ty), r3(m.prog)]),
      win: this.winner,
      reset: this.reset_at ? Math.max(0, fdiv(this.reset_at - this.tick_no, 10)) : null,
      respawn: this.can_respawn(),
    };
    if (this.seq % 30 === 1 || this.full_all || this.need_full.size) {
      const skins = {}; for (const p of this.players.values()) { const ks = Object.keys(p.designs); if (ks.length) { skins[p.id] = {}; for (const k of ks) skins[p.id][k] = p.designs[k].sprite ? p.designs[k].sprite.join('') : blob_look(p.designs[k]); } }
      base.skins = skins;
    }
    let full_map = null;
    for (const [conn, pid] of [...this.conn_pid]) {
      const p = this.players.get(pid); if (!p) continue;
      const msg = Object.assign({}, base);
      if (this.full_all || this.need_full.has(conn)) { if (full_map === null) full_map = pack(this.owner); msg.map = full_map; msg.w = W; msg.h = H; }
      msg.you = pid; msg.ev = p.events; p.events = [];
      conn.send(msg);
    }
    this.full_all = false; this.need_full.clear();
  }
  // Takt: 10 Schritte pro Sekunde, wie im Python-Server
  start_loop() {
    this.nxt = performance.now();
    this.timer = setInterval(() => this.pump(), 20);
  }
  pump() {
    if (!this.running) return;
    const now = performance.now(); let n = 0;
    while (now >= this.nxt && n < 20) {
      const cmds = this.cmds; this.cmds = [];
      for (const [kind, conn, data] of cmds) this.handle(kind, conn, data);
      this.tick(); this.send_states(); this.nxt += TICK * 1000; n++;
    }
    if (now - this.nxt > 1000) this.nxt = now;
  }
  stop() { if (!this.running) return; this.running = false; clearInterval(this.timer); this.save(); }
}

function default_settings() {
  return Object.assign({ mode: 'normal', map: ['preset', 'welt'], map_label: 'Weltkarte', bots: 40, diff: 'easy', resume: true, size: 'normal' }, DEFAULT_OPTS);
}
