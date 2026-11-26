// FrontWars Web – Netzwerk. Gleiches Protokoll wie FrontWars.py (Online-Codes ON-...),
// nur über MQTT-WebSockets statt TCP. Dadurch spielen Browser und Python-Version zusammen.
'use strict';

// Gleiche Reihenfolge wie RELAY_BROKERS in FrontWars.py (die Ziffer im Code zeigt den Server an)
const RELAY_BROKERS_WS = window.FW_TEST_BROKERS || ['wss://broker.hivemq.com:8884/mqtt', 'wss://broker.emqx.io:8084/mqtt', 'wss://test.mosquitto.org:8081/mqtt'];
const RELAY_PREFIX = 'frontwars-py-2/';
const _rand_id = n => { let s = ''; for (let i = 0; i < n; i++) s += CODE_ALPHA[randrange(CODE_ALPHA.length)]; return s; };
const _enc = new TextEncoder(), _dec = new TextDecoder();
const _pack_msg = obj => pako.deflate(_enc.encode(JSON.stringify(obj)), { level: 6 });
const _unpack_msg = payload => JSON.parse(_dec.decode(pako.inflate(payload)));

class MQTTWS {
  // Sehr kleiner MQTT-3.1.1-Client (nur QoS 0) über WebSocket
  constructor(url, on_message, keepalive = 30) {
    this.url = url; this.on_message = on_message; this.on_close = null; this.keepalive = keepalive;
    this.alive = false; this.pid = 0; this.buf = new Uint8Array(0);
  }
  static str(s) { const b = typeof s === 'string' ? _enc.encode(s) : s, o = new Uint8Array(2 + b.length); o[0] = b.length >> 8; o[1] = b.length & 255; o.set(b, 2); return o; }
  static varlen(n) { const out = []; do { let d = n % 128; n = Math.floor(n / 128); if (n) d |= 0x80; out.push(d); } while (n); return out; }
  packet(header, ...parts) {
    const len = parts.reduce((s, p) => s + p.length, 0), vl = MQTTWS.varlen(len), out = new Uint8Array(1 + vl.length + len);
    out[0] = header; out.set(vl, 1); let o = 1 + vl.length; for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }
  send_packet(header, ...parts) { if (this.ws && this.ws.readyState === 1) this.ws.send(this.packet(header, ...parts)); }
  connect(timeout = 6000) {
    return new Promise((resolve, reject) => {
      let done = false; const fail = e => { if (!done) { done = true; try { this.ws.close(); } catch (x) {} reject(e); } };
      try { this.ws = new WebSocket(this.url, ['mqtt']); } catch (e) { reject(e); return; }
      this.ws.binaryType = 'arraybuffer';
      const timer = setTimeout(() => fail(new Error('Zeitüberschreitung')), timeout);
      this.ws.onopen = () => {
        const cid = 'fwweb' + _rand_id(12);
        const varh = new Uint8Array([...MQTTWS.str('MQTT'), 4, 0x02, this.keepalive >> 8, this.keepalive & 255]);
        this.send_packet(0x10, varh, MQTTWS.str(cid));
      };
      this.ws.onmessage = ev => {
        const chunk = new Uint8Array(ev.data), nb = new Uint8Array(this.buf.length + chunk.length);
        nb.set(this.buf); nb.set(chunk, this.buf.length); this.buf = nb;
        while (true) {
          if (this.buf.length < 2) break;
          let mult = 1, len = 0, k = 1, ok = false;
          while (k < this.buf.length && k < 5) { const d = this.buf[k++]; len += (d & 127) * mult; mult *= 128; if (!(d & 128)) { ok = true; break; } }
          if (!ok || this.buf.length < k + len) break;
          const h = this.buf[0], body = this.buf.subarray(k, k + len); this.buf = this.buf.slice(k + len);
          const type = h >> 4;
          if (type === 2) {
            clearTimeout(timer);
            if (body.length < 2 || body[1] !== 0) { fail(new Error('MQTT-Server hat die Verbindung abgelehnt')); return; }
            done = true; this.alive = true;
            this.pinger = setInterval(() => this.send_packet(0xC0), this.keepalive * 500);
            resolve(this);
          } else if (type === 3) {
            const qos = (h >> 1) & 3, tl = (body[0] << 8) | body[1], topic = _dec.decode(body.subarray(2, 2 + tl)), pos = 2 + tl + (qos ? 2 : 0);
            try { this.on_message(topic, body.slice(pos)); } catch (e) { /* kaputte Nachricht */ }
          }
        }
      };
      this.ws.onerror = () => fail(new Error('WebSocket-Fehler'));
      this.ws.onclose = () => { clearTimeout(timer); clearInterval(this.pinger); const was = this.alive; this.alive = false; if (!done) fail(new Error('Verbindung getrennt')); else if (was && this.on_close) this.on_close(); };
    });
  }
  subscribe(topic) { this.pid = this.pid % 65000 + 1; this.send_packet(0x82, new Uint8Array([this.pid >> 8, this.pid & 255]), MQTTWS.str(topic), new Uint8Array([0])); }
  publish(topic, payload) { this.send_packet(0x30, MQTTWS.str(topic), payload); }
  get backlog() { return this.ws ? this.ws.bufferedAmount : 0; }
  close() { if (!this.alive) return; this.alive = false; try { this.send_packet(0xE0); } catch (e) {} clearInterval(this.pinger); try { this.ws.close(); } catch (e) {} }
}

async function relay_connect(on_message, prefer = null) {
  let order = RELAY_BROKERS_WS.map((_, i) => i);
  if (prefer !== null && prefer >= 0 && prefer < order.length) order = [prefer];
  let last = null;
  for (const idx of order) {
    try { const mq = new MQTTWS(RELAY_BROKERS_WS[idx], on_message); await mq.connect(); return [mq, idx]; }
    catch (e) { last = e; }
  }
  throw new Error(`Online-Server nicht erreichbar (${last ? last.message : '?'})`);
}

function parse_online_code(code) {
  const c = code.trim().toUpperCase().replace(/ /g, '');
  if (!c.startsWith('ON-') || c.length !== 10 || !/[0-9]/.test(c[3])) throw new Error('Online-Codes sehen so aus: ON-1ABCDEF');
  const idx = parseInt(c[3], 10), room = c.slice(4);
  if (idx >= RELAY_BROKERS_WS.length || [...room].some(ch => !CODE_ALPHA.includes(ch))) throw new Error('Ungültiger Online-Code');
  return [idx, room];
}

// ---------- Host-Seite ----------
class Server { constructor(handler) { this.handler = handler; this.conns = new Set(); } }

class RelayConn {
  // Eine Online-Verbindung zu einem Spieler (sieht für das Spiel aus wie eine normale Verbindung)
  constructor(host, cid) { this.host = host; this.cid = cid; this.topic = `${RELAY_PREFIX}${host.room}/down/${cid}`; this.last = Date.now(); this.alive = true; }
  send(obj) {
    if (!this.alive || !this.host.mq || !this.host.mq.alive) return;
    if (this.host.mq.backlog > 4e6) return;  // wie die volle Warteschlange in Python: Client fordert die Karte neu an
    try { this.host.mq.publish(this.topic, _pack_msg(obj)); } catch (e) { this.alive = false; }
  }
  close() { if (!this.alive) return; try { this.host.mq.publish(this.topic, _pack_msg({ t: 'bye' })); } catch (e) {} this.alive = false; }
}

class RelayHost {
  constructor(server) { this.server = server; this.room = _rand_id(6); this.conns = new Map(); this.state = 'busy'; this.status = 'Online: verbinde mit dem Online-Server ...'; this.code = null; this.mq = null; }
  start() { this._run(); return this; }
  async _run() {
    let idx;
    try { [this.mq, idx] = await relay_connect((t, p) => this._on_message(t, p)); }
    catch (e) { this.state = 'fail'; this.status = 'Online: kein Online-Server erreichbar (Internet aus?)'; return; }
    if (this.closed) { this.mq.close(); return; }
    this.mq.on_close = () => { if (this.state === 'ok') { this.state = 'fail'; this.status = 'Online: Verbindung zum Online-Server verloren'; } };
    this.mq.subscribe(`${RELAY_PREFIX}${this.room}/up/+`);
    this.code = `ON-${idx}${this.room}`; this.state = 'ok'; this.status = 'Online bereit: Online-Code klappt überall';
    this.watch = setInterval(() => { const now = Date.now(); for (const [cid, c] of [...this.conns]) if (now - c.last > 20000) this._leave(cid); }, 2000);
  }
  _on_message(topic, payload) {
    const cid = topic.slice(topic.lastIndexOf('/') + 1); let data;
    try { data = _unpack_msg(payload); } catch (e) { return; }
    let c = this.conns.get(cid);
    if (!c) {
      if (data.t === 'join') { c = new RelayConn(this, cid); this.conns.set(cid, c); this.server.conns.add(c); this.server.handler.cmds.push(['join', c, data]); }
      return;
    }
    c.last = Date.now();
    if (data.t === 'bye') this._leave(cid); else if (data.t !== 'ping') this.server.handler.cmds.push(['cmd', c, data]);
  }
  _leave(cid) { const c = this.conns.get(cid); if (c) { this.conns.delete(cid); c.alive = false; this.server.conns.delete(c); this.server.handler.cmds.push(['leave', c, null]); } }
  close() {
    this.closed = true; clearInterval(this.watch);
    for (const c of this.conns.values()) c.close();
    if (this.mq) { const mq = this.mq; setTimeout(() => mq.close(), 200); }
  }
}

class Lobby {
  // Warteraum vor dem Spiel: sammelt Spieler, verteilt Einstellungen, startet auf Befehl des Hosts
  constructor(settings) {
    this.settings = settings; this.cmds = []; this.members = new Map(); this.member_data = new Map();
    this.game = null; this.running = true; this.server = null; this.relay = null; this.code = '';
    this.timer = setInterval(() => this.run(), 50); this.last = 0;
  }
  get codes() {
    const rel = this.relay;
    if (rel && rel.state === 'ok') return [['Online', rel.code, '']];
    return [['Online', '', '']];
  }
  run() {
    if (!this.running || this.game) { clearInterval(this.timer); return; }
    const cmds = this.cmds; this.cmds = [];
    for (const [kind, conn, data] of cmds) {
      if (kind === 'join') {
        let name = String(data.name === undefined ? 'Spieler' : data.name).trim().slice(0, 16) || 'Spieler';
        const names = new Set(this.members.values()), base = name; let k = 2;
        while (names.has(name)) { name = `${base}${k}`; k++; }
        this.members.set(conn, name); this.member_data.set(conn, data);
      } else if (kind === 'leave') { this.members.delete(conn); this.member_data.delete(conn); }
    }
    const now = Date.now();
    if (now - this.last > 250) {
      this.last = now;
      const codes = this.codes, msg = { t: 'lobby', players: [...this.members.values()], settings: this.settings, code: codes[0][1], codes };
      this.code = codes[0][1];
      for (const c of [...this.members.keys()]) c.send(msg);
    }
  }
  start() {
    const st = this.settings, opts = {}; for (const k of Object.keys(DEFAULT_OPTS)) opts[k] = st[k];
    if (st.map[0] === 'preset') set_map_size(...(SIZE_BY_KEY[st.size || 'normal'] || [720, 288]));
    const game = new Game(st.mode, st.bots, st.map.slice(), st.resume, st.diff, opts);
    for (const [conn, name] of this.members) { const d = this.member_data.get(conn) || {}; game.cmds.push(['join', conn, { name, designs: d.designs }]); }
    this.server.handler = game;
    for (const c of this.cmds) game.cmds.push(c); this.cmds = [];
    this.game = game; clearInterval(this.timer);
    game.start_loop();
    return game;
  }
}

// ---------- Client-Seite ----------
class NetBase {
  constructor() { this.inbox = []; this.events = []; this.events_no = 0; this.lobby = null; this.has_state = false; this.error = null; this.connected = true; }
  take() { const m = this.inbox; this.inbox = []; return m; }
  _handle(data) {
    const t = data.t;
    if (t === 'state') {
      if (data.ev && data.ev.length) { this.events.push(...data.ev); if (this.events.length > 60) this.events.splice(0, this.events.length - 60); this.events_no += data.ev.length; }
      this.inbox.push(data); this.has_state = true;
    } else if (t === 'lobby') this.lobby = data;
    else if (t === 'error') this.error = data.msg;
    else if (t === 'bye') { this.error = this.error || 'Der Host hat das Spiel beendet.'; this.connected = false; }
  }
}

class LocalNet extends NetBase {
  // Der Host spielt selbst mit: Verbindung direkt im Browser, ohne Umweg über das Internet
  constructor(server, name, designs) {
    super(); this.server = server; const self = this;
    this.conn = { alive: true, send(obj) { if (this.alive) self._handle(obj); }, close() { this.alive = false; } };
    server.conns.add(this.conn);
    server.handler.cmds.push(['join', this.conn, { t: 'join', name, designs: designs || {} }]);
  }
  send(msg) { if (this.connected) this.server.handler.cmds.push(['cmd', this.conn, msg]); }
  close() { if (!this.connected) return; this.connected = false; this.conn.alive = false; this.server.handler.cmds.push(['leave', this.conn, null]); }
}

class RelayNetClient extends NetBase {
  // Beitreten über einen Online-Code (ON-...): klappt bei Python- und Browser-Hosts
  constructor(code, name, designs) {
    super(); this.code = code; this.name = name; this.designs = designs || {}; this.cid = _rand_id(10); this.mq = null; this.ready = false;
  }
  async open() {
    const [idx, room] = parse_online_code(this.code);
    this.up = `${RELAY_PREFIX}${room}/up/${this.cid}`;
    [this.mq] = await relay_connect((t, p) => { try { this._handle(_unpack_msg(p)); } catch (e) {} }, idx);
    this.mq.on_close = () => { if (this.connected && !this.error) this.error = 'Verbindung zum Online-Server verloren.'; this.connected = false; };
    this.mq.subscribe(`${RELAY_PREFIX}${room}/down/${this.cid}`);
    await new Promise(r => setTimeout(r, 300));
    this.send({ t: 'join', name: this.name, designs: this.designs });
    this.ready = true;
    const start = Date.now();
    this.keep = setInterval(() => {
      if (!this.connected) { clearInterval(this.keep); return; }
      if (this.lobby === null && !this.has_state && Date.now() - start > 10000) { this.error = 'Unter diesem Online-Code ist kein Spiel offen.'; this.connected = false; clearInterval(this.keep); return; }
      this.send({ t: 'ping' });
    }, 3000);
    return this;
  }
  send(msg) { try { if (this.mq && this.mq.alive) this.mq.publish(this.up, _pack_msg(msg)); else this.connected = false; } catch (e) { this.connected = false; } }
  close() {
    clearInterval(this.keep);
    if (this.mq && this.mq.alive) { this.send({ t: 'bye' }); const mq = this.mq; setTimeout(() => mq.close(), 100); }
    this.connected = false;
  }
}
