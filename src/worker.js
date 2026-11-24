// Nodes – Cloudflare Worker: liefert die App aus und verwaltet Räume (Durable Objects)
// Duell: 2 Plätze. Multiplayer: Die erste Aktion ist «init» (3 oder 4 Plätze), Plätze stehen im Spielstand.
import { apply, replay, seatOf, isBot } from '../public/engine.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/api\/room\/([A-Z0-9]{4})$/);
    if (m) {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('WebSocket erwartet', { status: 426 });
      const stub = env.ROOMS.get(env.ROOMS.idFromName(m[1]));
      return stub.fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};

const DAY2 = 2 * 24 * 3600 * 1000;

export class Room {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.loaded = false;
  }

  async load() {
    if (this.loaded) return;
    this.log = (await this.ctx.storage.get('log')) || [];
    this.seats = (await this.ctx.storage.get('seats')) || {};
    try { this.state = replay(this.log); } catch { this.log = []; this.state = replay([]); }
    this.loaded = true;
  }

  get multi() { return !!this.state.seated || (this.log[0] && this.log[0].t === 'init'); }

  async fetch() {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    // Räume nach 2 Tagen ohne Aktivität aufräumen
    await this.ctx.storage.setAlarm(Date.now() + DAY2);
    return new Response(null, { status: 101, webSocket: client });
  }

  send(ws, msg) { try { ws.send(JSON.stringify(msg)); } catch {} }
  broadcast(msg) { for (const ws of this.ctx.getWebSockets()) this.send(ws, msg); }
  seatFor(token) {
    if (this.state.seated) return seatOf(this.state, token);
    const s = this.seats[token];
    return s === undefined ? -1 : s;
  }
  // Nach jeder Aktion: Plätze der verbundenen Geräte neu bestimmen (Multiplayer: Platzwechsel, Beitritt)
  refreshSeats() {
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment();
      if (!a || !a.token) continue;
      const seat = this.seatFor(a.token);
      if (seat !== a.seat) ws.serializeAttachment({ ...a, seat });
    }
  }
  presence(exclude) {
    const seats = new Set();
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === exclude) continue;
      const a = ws.deserializeAttachment();
      if (a && a.seat >= 0) seats.add(a.seat);
    }
    this.broadcast({ type: 'presence', seats: [...seats] });
  }

  async webSocketMessage(ws, raw) {
    await this.load();
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (m.type === 'hello' && typeof m.token === 'string' && m.token.length < 100) {
      let seat = this.seatFor(m.token);
      if (seat < 0 && !this.multi) {
        // Duell (oder noch leerer Raum): Plätze 0 und 1 der Reihe nach
        const taken = new Set(Object.values(this.seats));
        const free = [0, 1].find(x => !taken.has(x));
        if (free !== undefined) { seat = free; this.seats[m.token] = seat; await this.ctx.storage.put('seats', this.seats); }
      }
      ws.serializeAttachment({ seat, token: m.token });
      this.send(ws, { type: 'welcome', seat, log: this.log });
      this.presence();
      return;
    }
    if (m.type === 'act' && m.action && typeof m.action === 'object') {
      const att = ws.deserializeAttachment();
      if (!att || !att.token) return;
      const a = { ...m.action };
      if (a.t === 'init') {
        // Nur in einem leeren Raum, vom Gerät auf Platz 0
        if (this.log.length || att.seat !== 0) return this.send(ws, { type: 'error', msg: 'Der Raum ist schon belegt' });
        a.id = att.token; a.p = 0;
      } else if (a.t === 'sit') {
        a.id = att.token; a.p = -1;
      } else {
        if (att.seat < 0) return this.send(ws, { type: 'error', msg: 'Du bist Zuschauer' });
        // Der Gastgeber (Platz 0) spielt für die Computer-Plätze
        const forBot = att.seat === 0 && Number.isInteger(a.p) && isBot(this.state, a.p);
        if (!forBot) a.p = att.seat;
      }
      // Uhr: Der Server misst selbst. Bis 4 Sekunden pro Aktion gelten als Animation und zählen nicht.
      const now = Date.now();
      if (this.state.clock && this.state.phase === 'play') {
        const elapsed = now - (this.lastTs || now);
        a.spent = Math.max(0, Math.min(Number(a.spent) || 0, elapsed), elapsed - 4000);
      }
      try {
        this.state = apply(this.state, a);
      } catch (e) {
        return this.send(ws, { type: 'error', msg: e.message || 'Ungültiger Zug' });
      }
      this.lastTs = now;
      this.log.push(a);
      await this.ctx.storage.put('log', this.log);
      await this.ctx.storage.setAlarm(Date.now() + DAY2);
      if (this.state.seated) { this.refreshSeats(); }
      this.broadcast({ type: 'log', log: this.log });
      if (this.state.seated) this.presence();
    }
  }

  async webSocketClose(ws) { this.presence(ws); }
  async webSocketError(ws) { this.presence(ws); }
  async alarm() { await this.ctx.storage.deleteAll(); this.loaded = false; }
}
