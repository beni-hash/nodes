// Nodes – Spiellogik (Sternbild-Welt)
// Läuft im Browser und im Cloudflare-Worker. Keine Zufälle: gleiche Aktionen ergeben gleiche Stellung.

export const HEROES = {
  titan: { name: 'Titan', abbr: 'Ti', role: 'Angriff',
    n: { name: 'Plasmaklinge', desc: 'Zerstört eine benachbarte gegnerische Figur.' },
    s: { name: 'Energieschild', cost: 1, desc: 'Der Titan und benachbarte eigene Figuren sind bis zu deinem nächsten Zug geschützt.' } },
  sniper: { name: 'Sniper', abbr: 'Sn', role: 'Angriff',
    passive: 'Nachladen: Schiesst höchstens einmal pro Zug.',
    n: { name: 'Laserschuss', desc: 'Zerstört eine gegnerische Figur bis 2 Felder entfernt, in gerader Linie und mit freier Sicht.' },
    s: { name: 'Orbitalschlag', desc: 'Zerstört eine gegnerische Figur bis 3 Felder entfernt, in gerader Linie, auch über Hindernisse.' } },
  interceptor: { name: 'Interceptor', abbr: 'In', role: 'Angriff',
    move: 'Fliegt bis 3 Felder, auch über Figuren.',
    n: { name: 'Rammangriff', desc: 'Fliegt auf einen gegnerischen Node, Pylon oder eine Drohne bis 2 Felder entfernt und zerstört das Ziel.' },
    s: { name: 'Nachbrenner', desc: 'Wie Rammangriff, aber bis 3 Felder.' } },
  phantom: { name: 'Phantom', abbr: 'Ph', role: 'Kontrolle',
    move: 'Springt auf ein beliebiges freies Feld.',
    n: { name: 'Phasensprung', desc: 'Eine eigene Figur springt auf ein beliebiges freies Feld.', steps: ['Wähle die eigene Figur.', 'Wähle das Zielfeld.'] },
    s: { name: 'EMP-Puls', desc: 'Ein gegnerischer Held bis 3 Felder entfernt kann im nächsten Zug weder ziehen noch Fähigkeiten nutzen.' } },
  hacker: { name: 'Hacker', abbr: 'Ha', role: 'Kontrolle',
    n: { name: 'Übernahme', desc: 'Ein gegnerischer Node oder Pylon bis 2 Felder entfernt wird deiner. Du bezahlst seine Nodes aus deinem Pot, der Gegner erhält sie zurück.' },
    s: { name: 'Systemhack', desc: 'Ein gegnerischer Held bis 2 Felder entfernt gehört dir für 2 Züge. Wird er in dieser Zeit zerstört, ist er für seinen Besitzer verloren.' } },
  ingenieur: { name: 'Ingenieur', abbr: 'Ig', role: 'Aufbau',
    n: { name: 'Fabrik', desc: 'Baut einen Pylon auf ein freies Feld bis 2 Felder entfernt (2 Nodes aus dem Pot).' },
    s: { name: 'Reparatur', cost: 1, desc: 'Setzt 1 oder 2 Nodes vom Stapel auf freie Felder bis 2 Felder entfernt.', steps: ['Wähle das Feld für den ersten Node.', 'Wähle das Feld für den zweiten Node oder tippe auf «Fertig».'] } },
  mimic: { name: 'Mimic', abbr: 'Mi', role: 'Trick',
    passive: 'Behält kopierte Fähigkeiten, bis er neu kopiert.',
    n: { name: 'Scan', desc: 'Kopiert die Fähigkeiten eines Helden bis 2 Felder entfernt, auch eines gegnerischen (keinen Mimic).' },
    s: { name: 'Transporter', cost: 1, desc: 'Tauscht den Platz mit einer Figur bis 2 Felder entfernt.' } },
  warden: { name: 'Warden', abbr: 'Wa', role: 'Verteidigung',
    passive: 'Schutzfeld: Benachbarte eigene Figuren sind immun gegen Fähigkeiten.',
    n: { name: 'Barriere', desc: 'Setzt eine Energiewand auf ein freies Feld bis 2 Felder entfernt. Sie blockiert bis zu deinem nächsten Zug.' },
    s: { name: 'Lockdown', cost: 1, desc: 'Gegnerische Helden bis 2 Felder entfernt können im nächsten Zug keine Fähigkeiten nutzen.' } },
  saboteur: { name: 'Saboteur', abbr: 'Sa', role: 'Fallen',
    n: { name: 'Mine', desc: 'Legt eine verdeckte Mine bis 2 Felder entfernt (max. 3). Eine gegnerische Figur, die darauf landet, wird zerstört.' },
    s: { name: 'Kettenreaktion', desc: 'Zerstört eine benachbarte gegnerische Figur und eine weitere, die an sie grenzt.', steps: ['Wähle die erste Figur.', 'Wähle die angrenzende Figur.'] } },
  schwarm: { name: 'Schwarm', abbr: 'Sw', role: 'Blockade',
    n: { name: 'Drohne', desc: 'Setzt eine Drohne auf ein freies Nachbarfeld (max. 2). Sie blockiert den Weg und kostet keinen Node.' },
    s: { name: 'Schwarmangriff', desc: 'Alle Drohnen explodieren und zerstören benachbarte gegnerische Figuren.' } },
};
export const HERO_IDS = Object.keys(HEROES);
// Spielstufen: 1 Grundspiel (die ersten 5 Helden), 2 Erweitert (alle 10), 3 Profi (alle 10 + Aura)
export const TIERS = { 1: 'Grundspiel', 2: 'Erweitert', 3: 'Profi' };
export const BASIC_HEROES = HERO_IDS.slice(0, 5);
const tierFrom = a => ([1, 2, 3].includes(a.tier) ? a.tier : a.adv ? 3 : 2);
export const tierOf = s => (s && s.tier) || (s && s.adv ? 3 : 2);
export const heroPool = s => (tierOf(s) === 1 ? BASIC_HEROES : HERO_IDS);

// Auren (Fortgeschrittenen-Modus): eine pro Spieler, wirkt die ganze Partie
export const AURAS = {
  nachschub: { name: 'Nachschub', desc: '18 statt 15 Nodes im Pot.' },
  recycling: { name: 'Recycling', desc: 'Zerstörte Nodes gehen direkt in den Pot zurück.' },
  panzerung: { name: 'Panzerung', desc: 'Einmal pro gegnerischem Zug: Ein Pylon oder Held neben einer eigenen Figur, der durch eine Fähigkeit zerstört würde, wird stattdessen zum Node.' },
  mobilitaet: { name: 'Mobilität', desc: 'Nodes ziehen bis 2 Felder.' },
  brueckenkopf: { name: 'Brückenkopf', desc: 'Einmal pro Zug darfst du einen Node 2 Felder von deinen Figuren entfernt legen.' },
  rufbereitschaft: { name: 'Rufbereitschaft', desc: 'Helden ab Runde 2 und ohne Wartezeit. Einmal pro Partie: Held direkt aus einem Node (1 Node aus dem Pot).' },
  heldenschutz: { name: 'Heldenschutz', desc: 'Neu gerufene Helden sind bis zu deinem nächsten Zug immun gegen Fähigkeiten.' },
};
export const AURA_IDS = Object.keys(AURAS);

export const START_NODES = 15;
export const HERO_ROUND = 3; // Aufbauphase (Runde 1–2): noch keine Helden und kein Einkreisen
export const MAX_SAME = 2;
export const ROUND_MIN = 10, ROUND_MAX = 50;
export const limitOf = s => (s && s.roundLimit) || ROUND_LIMIT;
const roundsFrom = v => { const r = Math.round(Number(v) || ROUND_LIMIT); if (r < ROUND_MIN || r > ROUND_MAX) fail('Ungültige Rundenzahl'); return r; };
export const ROUND_LIMIT = 30; // danach entscheidet die Punktzahl   // derselbe Held höchstens zweimal
export const MAX_MINES = 3, MAX_DRONES = 2, HACK_TURNS = 2;
export const UNIT_NAME = { node: 'Node', pylon: 'Pylon', hero: 'Held', wall: 'Energiewand', drone: 'Drohne' };

// ---------- Spielfeld: Sechseck aus Punkten, innen 6 Kanten, aussen 4 ----------
const DIRS = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
function makeBoard(R = 4, S = 38) {
  const inner = R - 2; // innen alle 6 Kanten, aussen weniger
  const ring = (q, r) => Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
  const pts = [];
  for (let r = -R; r <= R; r++) for (let q = -R; q <= R; q++) {
    if (ring(q, r) > R) continue;
    if (ring(q, r) === R && ((q * 7 + r * 3) % 5 + 5) % 5 === 0) continue; // ein paar Randpunkte fehlen
    pts.push({ q, r });
  }
  const key = (q, r) => q + ',' + r;
  const idx = new Map(pts.map((p, i) => [key(p.q, p.r), i]));
  const V = pts.length;
  const lat = pts.map(p => DIRS.map(([dq, dr]) => { const j = idx.get(key(p.q + dq, p.r + dr)); return j === undefined ? -1 : j; }));
  const adjSet = pts.map(() => new Set());
  pts.forEach((p, i) => {
    [0, 1, 2].forEach(d => {
      const j = lat[i][d]; if (j < 0) return;
      const m = Math.max(ring(p.q, p.r), ring(pts[j].q, pts[j].r));
      if (m <= inner || d !== 2) { adjSet[i].add(j); adjSet[j].add(i); }
    });
  });
  const adj = adjSet.map(s => [...s].sort((a, b) => a - b));
  const edges = [];
  adj.forEach((ns, i) => ns.forEach(j => { if (j > i) edges.push([i, j]); }));
  const points = pts.map((p, i) => ({
    q: p.q, r: p.r,
    x: +(S * (p.q + p.r / 2)).toFixed(2),
    y: +(S * p.r * Math.sqrt(3) / 2).toFixed(2),
    edge: lat[i].some(j => j < 0),
  }));
  // Fürs Einkreisen zählen alle Nachbarpunkte, auch ohne Verbindungslinie: Eine Kette muss wirklich lückenlos sein.
  const NB = lat.map(l => l.filter(j => j >= 0));
  return { R, V, points, adj, adjSet, lat, edges, NB };
}
// Duell: Radius 4 (55 Punkte) · Multiplayer: Radius 5
const BY_R = { 4: makeBoard(4), 5: makeBoard(5) };
const BY_V = {}; Object.values(BY_R).forEach(b => { BY_V[b.V] = b; });
export let BOARD = BY_R[4];
export let NB = BOARD.NB;
let V = BOARD.V;
export const boardOf = x => BY_V[Array.isArray(x) ? x.length : x && x.cells ? x.cells.length : 0] || BY_R[4];
// Stellt das Spielfeld passend zum Spielstand (oder zur Zellenliste) ein
export function useBoard(x) {
  const b = boardOf(x);
  if (b !== BOARD) { BOARD = b; NB = b.NB; V = b.V; }
  return b;
}
export const MULTI_NODES = { 3: 15, 4: 12 };

// ---------- Spielziele ----------
export const GOALS = { classic: 'Klassisch', bridge: 'Brücke', beacon: 'Leuchtfeuer', core: 'Kern' };
export const ENDPHASE = 5; // in den letzten 5 Runden kommt nichts mehr vom Stapel zurück
export const inEndphase = s => s.round > limitOf(s) - ENDPHASE;
const ptAt = (b, q, r) => {
  // Punkt (q, r) oder, falls er fehlt, der nächste Randpunkt
  const k = b.points.findIndex(p => p.q === q && p.r === r);
  if (k >= 0) return k;
  let best = -1, bd = 1e9;
  b.points.forEach((p, i) => { if (!p.edge) return; const d = Math.abs(p.q - q) + Math.abs(p.r - r) + Math.abs(-p.q - p.r + q + r); if (d < bd) { bd = d; best = i; } });
  return best;
};
// Brücke: Anfang und Ende je Team (gegenüberliegende Ecken)
function anchorsFor(b, n, teams) {
  const R = b.R;
  const axes = [[[-R, 0], [R, 0]], [[0, -R], [0, R]], [[R, -R], [-R, R]]];
  const out = {};
  teams.forEach((t, k) => { out[t] = axes[k % 3].map(([q, r]) => ptAt(b, q, r)); });
  return out;
}
// Leuchtfeuer: 3 Punkte (Duell) bzw. 4 mit der Mitte (Multiplayer)
function beaconsFor(b, n) {
  const ring = [[2, 0], [-2, 2], [0, -2]].map(([q, r]) => ptAt(b, q, r));
  return n > 2 ? [ptAt(b, 0, 0), ...ring] : ring;
}
export const BEACON_ROUND = 8; // Leuchtfeuer zählen ab Runde 8
export const beaconNeed = s => Math.floor(s.beacons.length / 2) + 1;
export const beaconsHeld = (s, t) => s.beacons.filter(i => { const c = s.cells[i]; return c && c.k !== 'wall' && teamOf(s, owner(c)) === t; }).length;
// Kürzeste Brücke: wie viele Punkte fehlen noch (über gezeichnete Linien, eigene Kettenfiguren kosten 0)
export function bridgeGap(s, t) {
  if (!s.anchors || !s.anchors[t]) return Infinity;
  useBoard(s);
  const [a, z] = s.anchors[t];
  const cost = i => { const c = s.cells[i]; if (!c) return 1; if (teamOf(s, c.p) === t && CHAIN[c.k]) return 0; return Infinity; };
  const d = Array(V).fill(Infinity);
  if (cost(a) === Infinity) return Infinity;
  d[a] = cost(a);
  const dq = [a];
  while (dq.length) {
    const i = dq.shift();
    for (const j of BOARD.adj[i]) {
      const w = cost(j); if (w === Infinity) continue;
      if (d[i] + w < d[j]) { d[j] = d[i] + w; if (w === 0) dq.unshift(j); else dq.push(j); }
    }
  }
  return d[z];
}
export const bridgeDone = (s, t) => bridgeGap(s, t) === 0;
// Brückenziele und ihre direkten Nachbarn sind für Gegner gesperrt (sonst wäre eine Ecke mit 2 Figuren dicht)
export const anchorZone = (s, t) => { const pts = s.anchors && s.anchors[t]; if (!pts) return []; useBoard(s); return [...new Set(pts.flatMap(i => [i, ...BOARD.adj[i]]))]; };
const anchorOfFoe = (s, p, i) => !!(s.anchors && Object.keys(s.anchors).some(t => +t !== teamOf(s, p) && anchorZone(s, +t).includes(i)));

// ---------- Hilfen ----------
const clone = s => JSON.parse(JSON.stringify(s));
class RuleError extends Error {}
const fail = msg => { throw new RuleError(msg); };
export const isRuleError = e => e instanceof RuleError;
const FIG = { node: 1, pylon: 1, hero: 1 };          // echte Figuren (zählen für Sieg, Punkte, Legen)
const CHAIN = { node: 1, pylon: 1 }; // bilden Ketten (Energiewände und Drohnen blockieren nur)
const value = c => (c.k === 'node' ? 1 : c.k === 'pylon' || c.k === 'hero' ? 2 : 0);
export const isFig = c => !!c && !!FIG[c.k];
export const owner = c => (c.orig ? c.orig.p : c.p);   // Besitzer (bei gehackten Helden der ursprüngliche)
export const auraOf = (s, p) => (s.auras ? s.auras[p] : null);

export const teamOf = (s, p) => (s.team ? s.team[p] : p);
export const foe = (s, a, b) => teamOf(s, a) !== teamOf(s, b);
export function newGame(players = 2, mode = 'ffa') {
  const b = players > 2 ? BY_R[5] : BY_R[4];
  const team = Array.from({ length: players }, (_, p) => (mode === 'team' ? p % 2 : p));
  const start = players > 2 ? MULTI_NODES[players] || START_NODES : START_NODES;
  return {
    v: 4, goal: 'classic', n: players, mode, team, phase: 'pick', picks: Array(players).fill(null), adv: false, auras: Array(players).fill(null),
    cur: 0, actions: 2, round: 1, turnNo: 0,
    cells: Array(b.V).fill(null), mines: [],
    pot: Array(players).fill(start),
    stapel: Array.from({ length: players }, () => []),
    hwait: Array.from({ length: players }, () => [0, 0, 0]),
    placed: Array(players).fill(false),
    alive: Array(players).fill(true),
    armor: Array(players).fill(-1), bridge: false, ruf: Array(players).fill(false),
    winner: null, last: '', seq: 0, fx: [], clock: null, endReason: null,
  };
}

export const heroType = c => (c && c.k === 'hero' ? c.h : null);
const abType = (c, copy) => (c && c.k === 'hero' ? (copy ? c.as || null : c.h) : null);
export const stapelCount = (s, p) => s.stapel[p].reduce((a, e) => a + e.n, 0);
export const onBoard = (s, p) => s.cells.reduce((a, c) => a + (isFig(c) && owner(c) === p ? 1 : 0), 0);
export const nodesOnBoard = (s, p) => s.cells.reduce((a, c) => a + (c && owner(c) === p ? value(c) : 0), 0);
export const minesOf = (s, p) => s.mines.filter(m => m.p === p);
const dronesOf = (s, p) => s.cells.filter(c => c && c.k === 'drone' && c.p === p).length;
const all = () => BOARD.points.map((_, i) => i);

// Breitensuche über den Graphen. pass(i) entscheidet, ob man ein Feld durchqueren darf.
function within(from, maxD, pass) {
  const dist = new Map([[from, 0]]);
  const q = [from];
  while (q.length) {
    const i = q.shift(); const d = dist.get(i);
    if (d === maxD) continue;
    for (const j of BOARD.adj[i]) {
      if (dist.has(j)) continue;
      dist.set(j, d + 1);
      if (pass(j)) q.push(j);
    }
  }
  dist.delete(from);
  return dist;
}
const near = (from, d) => [...within(from, d, () => true).keys()];

export const canRufNode = (s, p) => auraOf(s, p) === 'rufbereitschaft' && !(s.ruf && s.ruf[p]) && s.pot[p] > 0;
const heroRound = (s, p) => (auraOf(s, p) === 'rufbereitschaft' ? HERO_ROUND - 1 : HERO_ROUND);
// Heldenplätze: picks[p] hat 3 Einträge (Doppelte erlaubt). Gibt die Typen zurück, die jetzt gerufen werden können.
export function availableHeroes(s, p) {
  if (!s.picks[p] || s.round < heroRound(s, p)) return [];
  const out = [];
  s.picks[p].forEach((h, k) => {
    if (s.hwait[p][k] > 0) return;
    if (s.cells.some(c => c && c.k === 'hero' && owner(c) === p && c.slot === k)) return;
    if (!out.includes(h)) out.push(h);
  });
  return out;
}
function freeSlot(s, p, h) {
  return s.picks[p].findIndex((x, k) => x === h && !(s.hwait[p][k] > 0) && !s.cells.some(c => c && c.k === 'hero' && owner(c) === p && c.slot === k));
}

export function placeTargets(s, p) {
  useBoard(s);
  if (s.pot[p] <= 0) return [];
  const own = [];
  s.cells.forEach((c, i) => { if (isFig(c) && c.p === p) own.push(i); });
  if (own.length === 0) return all().filter(i => BOARD.points[i].edge && !s.cells[i] && !anchorOfFoe(s, p, i));
  const set = new Set();
  const far = auraOf(s, p) === 'brueckenkopf' && !s.bridge && s.cur === p;
  own.forEach(i => (far ? near(i, 2) : BOARD.adj[i]).forEach(j => { if (!s.cells[j] && !anchorOfFoe(s, p, j)) set.add(j); }));
  return [...set].sort((a, b) => a - b);
}
const adjacentToOwn = (s, p, at) => BOARD.adj[at].some(j => isFig(s.cells[j]) && s.cells[j].p === p);

// Schutzfeld des Wardens: eigene Figuren neben einem Warden
let NOGUARD = false;
const guarded = (s, i) => { if (NOGUARD) return false; return guardedRaw(s, i); };
export const isGuarded = (s, i) => (useBoard(s), guardedRaw(s, i));
const guardedRaw = (s, i) => { const c = s.cells[i]; return !!c && BOARD.adj[i].some(j => { const w = s.cells[j]; return w && w.k === 'hero' && w.h === 'warden' && w.p === c.p; }); };
const enemyAt = (s, p, i) => { const c = s.cells[i]; return c && foe(s, c.p, p) ? c : null; };
const hittable = (s, p, i) => { const c = enemyAt(s, p, i); return !!c && c.k !== 'wall' && !c.prot && !c.hprot && !guarded(s, i); };

// Ziele einer Figur. mode: 'move' | 'n' | 's'
export function targets(s, from, mode, copy = false) {
  return goalFilter(s, from, targetsRaw(s, from, mode, copy), mode, copy);
}
export function nextTargets(s, from, kind, copy, chosen) {
  return goalFilter(s, from, nextTargetsRaw(s, from, kind, copy, chosen), kind, copy, chosen.length);
}
// Spielziele: Der Kern wird nie Ziel und bewegt sich nicht; Brückenziele der Gegner sind gesperrt
// Fähigkeiten, bei denen eine eigene Figur auf das Zielfeld gelangt
const MOVERS = new Set(['interceptor:n', 'interceptor:s', 'mimic:s', 'hacker:n']);
function goalFilter(s, from, list, kind, copy, step = 0) {
  const c = s.cells[from];
  if (!c) return list;
  if (c.core) return [];
  const key = kind === 'n' || kind === 's' ? abType(c, copy) + ':' + kind : '';
  const into = MOVERS.has(key) || (key === 'phantom:n' && step === 1);
  return list.filter(j => { const d = s.cells[j]; if (d && d.core) return false; if ((!d || into) && anchorOfFoe(s, c.p, j)) return false; return true; });
}
function targetsRaw(s, from, mode, copy = false) {
  useBoard(s);
  const c = s.cells[from];
  if (!c) return [];
  const p = c.p;
  if (mode === 'move') {
    if (c.k === 'wall' || c.k === 'drone') return [];
    if (c.k === 'node') return auraOf(s, owner(c)) === 'mobilitaet' ? [...within(from, 2, j => !s.cells[j]).keys()].filter(j => !s.cells[j]) : BOARD.adj[from].filter(j => !s.cells[j]);
    if (c.k === 'pylon') return [...within(from, 3, j => !s.cells[j]).keys()].filter(j => !s.cells[j]);
    if (c.stun) return [];
    if (c.h === 'phantom') return all().filter(j => !s.cells[j]);
    if (c.h === 'interceptor') return near(from, 3).filter(j => !s.cells[j]);
    return BOARD.adj[from].filter(j => !s.cells[j]);
  }
  if (c.k !== 'hero' || c.stun || c.lock) return [];
  const t = abType(c, copy);
  const n = mode === 'n';
  switch (t) {
    case 'titan':
      return n ? BOARD.adj[from].filter(j => hittable(s, p, j)) : [];
    case 'sniper': {
      if (c.shot) return [];
      const out = [];
      for (let d = 0; d < 6; d++) {
        let cur = from;
        for (let step = 1; step <= (n ? 2 : 3); step++) {
          const nx = BOARD.lat[cur][d];
          if (nx < 0) break;
          if (n && !BOARD.adjSet[cur].has(nx)) break;
          cur = nx;
          if (s.cells[cur]) {
            if (hittable(s, p, cur)) out.push(cur);
            if (n) break;
          }
        }
      }
      return [...new Set(out)];
    }
    case 'interceptor': {
      const prey = j => hittable(s, p, j) && (s.cells[j].k === 'node' || s.cells[j].k === 'drone' || s.cells[j].k === 'pylon');
      return near(from, n ? 2 : 3).filter(prey);
    }
    case 'phantom':
      if (n) return s.cells.map((o, i) => (isFig(o) && o.p === p ? i : -1)).filter(i => i >= 0);
      return near(from, 3).filter(j => { const e = enemyAt(s, p, j); return e && e.k === 'hero'; });
    case 'hacker':
      if (n) return near(from, 2).filter(j => hittable(s, p, j) && (s.cells[j].k === 'node' || s.cells[j].k === 'pylon') && s.pot[p] >= value(s.cells[j]));
      return near(from, 2).filter(j => hittable(s, p, j) && s.cells[j].k === 'hero' && !s.cells[j].orig);
    case 'ingenieur':
      if (n) return s.pot[p] > 1 ? near(from, 2).filter(j => !s.cells[j]) : [];
      return stapelCount(s, p) > 0 ? near(from, 2).filter(j => !s.cells[j]) : [];
    case 'mimic':
      if (n) return near(from, 2).filter(j => { const o = s.cells[j]; return o && o.k === 'hero' && o.h !== 'mimic' && o.h !== c.as; });
      return near(from, 2).filter(j => { const o = s.cells[j]; return o && o.k !== 'wall' && (!foe(s, o.p, p) || (!o.prot && !o.hprot && !guarded(s, j))); });
    case 'warden':
      if (n) return near(from, 2).filter(j => !s.cells[j]);
      return [];
    case 'saboteur':
      if (n) return minesOf(s, p).length < MAX_MINES ? near(from, 2).filter(j => !s.cells[j] && !s.mines.some(m => m.at === j && m.p === p)) : [];
      return BOARD.adj[from].filter(j => hittable(s, p, j));
    case 'schwarm':
      if (n) return dronesOf(s, p) < MAX_DRONES ? BOARD.adj[from].filter(j => !s.cells[j]) : [];
      return [];
  }
  return [];
}

// Mehrstufige Fähigkeiten: weitere Ziele nach den bereits gewählten
function nextTargetsRaw(s, from, kind, copy, chosen) {
  useBoard(s);
  const c = s.cells[from];
  const t = abType(c, copy);
  if (chosen.length === 0) return targetsRaw(s, from, kind, copy);
  const key = t + ':' + kind;
  if (key === 'phantom:n' && chosen.length === 1) return all().filter(j => !s.cells[j]);
  if (key === 'ingenieur:s' && chosen.length === 1) return stapelCount(s, c.p) > 1 ? near(from, 2).filter(j => !s.cells[j] && j !== chosen[0]) : [];
  if (key === 'saboteur:s' && chosen.length === 1) return BOARD.adj[chosen[0]].filter(j => j !== from && hittable(s, c.p, j));
  return [];
}
// Darf man nach diesen Zielen schon auslösen? (zweites Ziel freiwillig)
export function canFinish(type, kind, chosen) {
  return (type === 'ingenieur' && kind === 's' && chosen.length >= 1) || (type === 'saboteur' && kind === 's' && chosen.length >= 1);
}
// Wie viele Ziele braucht eine Fähigkeit? (Kettenreaktion: 2. Ziel nur, wenn es eines gibt)
export function stepsNeeded(type, kind) {
  const k = type + ':' + kind;
  if (k === 'phantom:n' || k === 'saboteur:s') return 2;
  if (k === 'ingenieur:s') return 2;
  return needsTarget(type, kind) ? 1 : 0;
}

// Hätte die Fähigkeit ohne Schutzfeld des Warden ein Ziel? (für die Begründung in der Anzeige)
export function blockedByWarden(s, from, kind, copy = false) {
  useBoard(s);
  if (targets(s, from, kind, copy).length) return [];
  NOGUARD = true;
  try { return targets(s, from, kind, copy).filter(j => guardedRaw(s, j)); } finally { NOGUARD = false; }
}
export const abilityCost = (type, kind) => HEROES[type][kind].cost || (kind === 's' ? 2 : 1);

// Fähigkeiten ohne Ziel
export function needsTarget(type, kind) {
  return !((type === 'titan' && kind === 's') || (type === 'warden' && kind === 's') || (type === 'schwarm' && kind === 's'));
}
export function abilityUsable(s, from, kind, copy = false) {
  useBoard(s);
  const c = s.cells[from];
  if (!c || c.k !== 'hero' || c.stun || c.lock) return false;
  const t = abType(c, copy);
  if (!t) return false;
  if (abilityCost(t, kind) > s.actions) return false;
  if (t === 'warden' && kind === 's') return near(from, 2).some(j => { const e = enemyAt(s, c.p, j); return e && e.k === 'hero'; });
  if (t === 'schwarm' && kind === 's') return dronesOf(s, c.p) > 0;
  if (!needsTarget(t, kind)) return true;
  return targets(s, from, kind, copy).length > 0;
}

// ---------- Zerstören, Stapel, Minen ----------
function toStapel(s, p, n) {
  if (n <= 0) return;
  if (auraOf(s, p) === 'recycling' && !inEndphase(s)) s.pot[p] += n;
  else s.stapel[p].push({ n, w: 1 });
}
function heroDown(s, c) {
  const o = owner(c);
  if (auraOf(s, o) !== 'rufbereitschaft' && Number.isInteger(c.slot)) s.hwait[o][c.slot] = 2;
}
// Pylon oder Held wird zum Node (Einkreisen, Panzerung)
function downgrade(s, i, enc) { // enc: Spieler, der eingekreist hat (oder false)
  const c = s.cells[i], o = owner(c);
  if (c.k === 'hero') heroDown(s, c);
  toStapel(s, o, 1);
  s.cells[i] = enc !== false && enc !== undefined ? { p: o, k: 'node', enc: s.turnNo + 1, by: enc } : { p: o, k: 'node' };
}
// ab: durch eine Fähigkeit (oder Mine) – dann greift Panzerung
function destroy(s, i, quiet, ab = true, force = false) {
  const c = s.cells[i];
  if (!c) return;
  if (c.core && !force) return; // der Kern fällt nur durch Einkreisen
  if (c.k === 'wall' || c.k === 'drone') { if (!quiet) s.fx.push({ k: 'destroy', at: i, p: c.p, unit: c.k, h: null }); s.cells[i] = null; return; }
  const o = owner(c);
  if (ab && auraOf(s, o) === 'panzerung' && (c.k === 'pylon' || c.k === 'hero') && s.armor[o] !== s.turnNo && BOARD.adj[i].some(j => isFig(s.cells[j]) && owner(s.cells[j]) === o)) {
    s.armor[o] = s.turnNo;
    s.fx.push({ k: 'armor', at: i, p: o, unit: c.k, h: c.h || null });
    downgrade(s, i, false);
    s.last = (s.last ? s.last + ' · ' : '') + 'Panzerung hält';
    return;
  }
  if (!quiet) s.fx.push({ k: 'destroy', at: i, p: c.p, unit: c.k, h: c.h || null });
  toStapel(s, o, value(c));
  if (c.k === 'hero') heroDown(s, c);
  s.cells[i] = null;
}
// Eine Figur betritt ein Feld: gegnerische Mine?
function land(s, i) {
  const c = s.cells[i];
  if (!c) return;
  const k = s.mines.findIndex(m => m.at === i && foe(s, m.p, c.p));
  if (k < 0) return;
  const m = s.mines.splice(k, 1)[0];
  s.fx.push({ k: 'mine', at: i, p: m.p });
  destroy(s, i, true);
  s.last = (s.last ? s.last + ' · ' : '') + 'Mine!';
}
function fly(s, from, to) {
  if (s.cells[to]) destroy(s, to);
  if (s.cells[to]) return; // Panzerung: Ziel bleibt als Node stehen, der Interceptor bleibt, wo er ist
  s.cells[to] = s.cells[from];
  s.cells[from] = null;
  land(s, to);
}

function doAction(s, a) {
  const p = a.p;
  const cell = i => (Number.isInteger(i) && i >= 0 && i < V ? s.cells[i] : fail('Ungültiges Feld'));
  switch (a.t) {
    case 'place': {
      if (!placeTargets(s, p).includes(a.at)) fail(s.pot[p] <= 0 ? 'Dein Pot ist leer' : 'Hier darfst du keinen Node legen');
      if (s.cells.some(c => isFig(c) && c.p === p) && !adjacentToOwn(s, p, a.at)) s.bridge = true;
      const first = !s.placed[p];
      s.cells[a.at] = { p, k: 'node' }; s.pot[p]--; s.placed[p] = true;
      if (first && s.core) { s.cells[a.at].core = true; s.core[p] = a.at; }
      s.fx.push({ k: 'place', at: a.at }); s.last = first && s.core ? 'Kern gesetzt' : 'Node gelegt';
      land(s, a.at);
      return 1;
    }
    case 'stack': {
      const c = cell(a.at);
      if (!c || c.p !== p || c.k !== 'node') fail('Stapeln geht nur auf einen eigenen Node');
      if (c.core) fail('Auf den Kern kann nicht gestapelt werden');
      if (s.pot[p] <= 0) fail('Dein Pot ist leer');
      c.k = 'pylon'; delete c.enc; s.pot[p]--; s.fx.push({ k: 'place', at: a.at }); s.last = 'Pylon gebaut'; return 1;
    }
    case 'hero': {
      const c = cell(a.at);
      const fromNode = c && c.p === p && c.k === 'node' && canRufNode(s, p);
      if (!c || c.p !== p || (c.k !== 'pylon' && !fromNode)) fail('Nur ein eigener Pylon wird zum Helden');
      if (c.core) fail('Der Kern kann kein Held werden');
      if (s.round < heroRound(s, p)) fail(`Helden gibt es erst ab Runde ${heroRound(s, p)}`);
      const slot = HEROES[a.h] ? freeSlot(s, p, a.h) : -1;
      if (slot < 0) fail('Dieser Held ist nicht verfügbar');
      if (c.k === 'node') { s.pot[p]--; s.ruf[p] = true; }
      c.k = 'hero'; c.h = a.h; c.slot = slot; delete c.enc;
      if (auraOf(s, p) === 'heldenschutz') c.hprot = true;
      s.fx.push({ k: 'hero', at: a.at }); s.last = HEROES[a.h].name + ' erscheint'; return 1;
    }
    case 'move': {
      const c = cell(a.from);
      if (!c || c.p !== p) fail('Das ist nicht deine Figur');
      if (c.stun) fail('Dieser Held ist durch EMP gelähmt');
      if (!targets(s, a.from, 'move').includes(a.to)) fail('Dorthin kann diese Figur nicht ziehen');
      s.cells[a.to] = c; s.cells[a.from] = null; s.fx.push({ k: 'move', from: a.from, to: a.to }); s.last = UNIT_NAME[c.k] + ' zieht';
      land(s, a.to);
      return 1;
    }
    case 'ability': {
      const c = cell(a.from);
      if (!c || c.p !== p || c.k !== 'hero') fail('Nur Helden haben Fähigkeiten');
      if (c.stun) fail('Dieser Held ist durch EMP gelähmt');
      if (c.lock) fail('Dieser Held ist im Lockdown');
      const kind = a.kind === 's' ? 's' : 'n';
      const copy = !!a.copy;
      const t = abType(c, copy);
      if (!t) fail('Der Mimic hat noch nichts kopiert');
      const cost = abilityCost(t, kind);
      if (cost > s.actions) fail('Dafür brauchst du 2 Aktionen');
      if (!abilityUsable(s, a.from, kind, copy)) fail('Diese Fähigkeit geht gerade nicht');
      const ab = HEROES[t][kind];
      // Ziele prüfen (auch mehrstufige)
      const chosen = [a.target, a.target2, a.target3].filter(Number.isInteger);
      const need = stepsNeeded(t, kind);
      for (let k = 0; k < chosen.length; k++) if (!nextTargets(s, a.from, kind, copy, chosen.slice(0, k)).includes(chosen[k])) fail('Ungültiges Ziel');
      if (chosen.length < need) {
        const optional = (t === 'saboteur' && chosen.length === 1 && nextTargets(s, a.from, kind, copy, chosen).length === 0) || (t === 'ingenieur' && chosen.length === 1);
        if (!optional) fail('Es fehlt noch ein Ziel');
      }
      if (chosen.length > Math.max(need, 0)) fail('Zu viele Ziele');
      const tc = chosen.length ? s.cells[chosen[0]] : null;
      s.fx.push({ k: 'ability', h: t, kind, from: a.from, to: chosen.length ? chosen[0] : null, to2: chosen[1] ?? null, to3: chosen[2] ?? null, p });
      switch (t + ':' + kind) {
        case 'sniper:n': case 'sniper:s':
          c.shot = true;
          destroy(s, a.target); s.last = `${ab.name}: ${UNIT_NAME[tc.k]} getroffen`; break;
        case 'titan:n':
          destroy(s, a.target); s.last = `${ab.name}: ${UNIT_NAME[tc.k]} getroffen`; break;
        case 'titan:s':
          c.prot = true;
          BOARD.adj[a.from].forEach(j => { const o = s.cells[j]; if (o && o.p === p) o.prot = true; });
          s.last = 'Energieschild aktiv'; break;
        case 'interceptor:n': case 'interceptor:s':
          fly(s, a.from, a.target); s.last = `${ab.name}: ${UNIT_NAME[tc.k]} getroffen`; break;
        case 'phantom:n': {
          const u = s.cells[a.target];
          s.cells[a.target2] = u; s.cells[a.target] = null; s.last = 'Phasensprung';
          land(s, a.target2); break;
        }
        case 'phantom:s':
          tc.stun = true; s.last = `EMP-Puls: ${HEROES[tc.h].name} gelähmt`; break;
        case 'hacker:n': {
          const v = value(tc);
          s.pot[tc.p] += v; s.pot[p] -= v; s.cells[a.target] = { p, k: tc.k };
          s.last = `Übernahme: ${UNIT_NAME[tc.k]} gehört jetzt dir`; break;
        }
        case 'hacker:s':
          tc.orig = { p: tc.p }; tc.p = p; tc.hack = HACK_TURNS + 1; delete tc.stun; delete tc.lock;
          s.last = `Systemhack: ${HEROES[tc.h].name} gehört dir für ${HACK_TURNS} Züge`; break;
        case 'ingenieur:n':
          s.cells[a.target] = { p, k: 'pylon' }; s.pot[p] -= 2; s.placed[p] = true; s.last = 'Fabrik: Pylon gebaut';
          land(s, a.target); break;
        case 'ingenieur:s': {
          const spots = [a.target, a.target2].filter(Number.isInteger);
          for (const at of spots) {
            const e = s.stapel[p].find(x => x.n > 0);
            if (!e) fail('Dein Stapel ist leer');
            e.n--; if (e.n === 0) s.stapel[p].splice(s.stapel[p].indexOf(e), 1);
            s.cells[at] = { p, k: 'node' };
          }
          s.placed[p] = true;
          s.last = `Reparatur: ${spots.length} ${spots.length === 1 ? 'Node' : 'Nodes'} zurück auf dem Feld`;
          spots.forEach(at => land(s, at)); break;
        }
        case 'mimic:n':
          c.as = tc.h; s.last = `Scan: Mimic kopiert ${HEROES[tc.h].name}`; break;
        case 'mimic:s':
          s.cells[a.from] = tc; s.cells[a.target] = c; s.last = 'Transporter: Platz getauscht';
          land(s, a.from); land(s, a.target); break;
        case 'warden:n':
          s.cells[a.target] = { p, k: 'wall' }; s.last = 'Barriere errichtet';
          land(s, a.target); break;
        case 'warden:s': {
          let n = 0;
          near(a.from, 2).forEach(j => { const e = enemyAt(s, p, j); if (e && e.k === 'hero') { e.lock = true; n++; } });
          s.fx[s.fx.length - 1].hit = near(a.from, 2).filter(j => { const e = enemyAt(s, p, j); return e && e.k === 'hero'; });
          s.last = `Lockdown: ${n} ${n === 1 ? 'Held' : 'Helden'} blockiert`; break;
        }
        case 'saboteur:n':
          s.mines.push({ p, at: a.target }); s.last = 'Mine gelegt'; break;
        case 'saboteur:s':
          destroy(s, a.target);
          if (Number.isInteger(a.target2)) destroy(s, a.target2);
          s.last = 'Kettenreaktion'; break;
        case 'schwarm:s': {
          const drones = s.cells.map((o, i) => (o && o.k === 'drone' && o.p === p ? i : -1)).filter(i => i >= 0);
          s.fx[s.fx.length - 1].drones = drones;
          const hit = new Set();
          drones.forEach(d => BOARD.adj[d].forEach(j => { if (hittable(s, p, j)) hit.add(j); }));
          drones.forEach(d => { s.cells[d] = null; });
          hit.forEach(j => destroy(s, j));
          s.last = `Schwarmangriff: ${hit.size} getroffen`; break;
        }
        case 'schwarm:n':
          s.cells[a.target] = { p, k: 'drone' }; s.last = 'Drohne gestartet';
          land(s, a.target); break;
        default: fail('Unbekannte Fähigkeit');
      }
      return cost;
    }
  }
  fail('Unbekannte Aktion');
}

// Gebiete, die durch eine lückenlose Kette von X (Nodes, Pylone) und den Rand abgetrennt sind.
// Eingekreist ist ein Gebiet, wenn es kleiner ist als alle anderen Gebiete zusammen.
// Einkreisen als Graph: K = Punkte mit Kettenfiguren (Node, Pylon) von X
// (im 2 gegen 2: von X und Partner). Die Komponenten von G − K entstehen nur über gezeichnete Linien.
// Eine Komponente Z ist eingekreist, wenn sie höchstens ENC_MAX Punkte hat (Figuren und freie Punkte zusammen).
export const ENC_MAX = 10;
export const matesOf = (s, X) => (s && s.team ? s.team.map((t, q) => (t === s.team[X] ? q : -1)).filter(q => q >= 0) : [X]);
export function trappedAreas(cells, X, mates = null) {
  useBoard(cells);
  const own = mates || [X];
  const wall = i => { const c = cells[i]; return c && own.includes(c.p) && CHAIN[c.k]; };
  const seen = new Uint8Array(V);
  const comps = [];
  for (let i = 0; i < V; i++) {
    if (seen[i] || wall(i)) continue;
    const comp = [i]; seen[i] = 1;
    for (let h = 0; h < comp.length; h++) for (const j of BOARD.adj[comp[h]]) if (!seen[j] && !wall(j)) { seen[j] = 1; comp.push(j); }
    comps.push(comp);
  }
  // Eingekreist: höchstens ENC_MAX Punkte gross
  return comps.filter(c => c.length <= ENC_MAX);
}

// Nach jeder Aktion: Neu eingekreiste Figuren werden sofort getroffen.
// Node und Drohne: entfernt · Pylon und Held: werden zum Node. Energiewände sind immun.
// Was danach eingeschlossen bleibt, wird im nächsten Zug des Einkreisenden erneut getroffen.
function resolve(s, mover) {
  const order = [];
  for (let k = 0; k < s.n; k++) { const p = (mover + k) % s.n; if (s.alive[p]) order.push(p); }
  if (s.round < HERO_ROUND) return;
  let total = 0;
  for (const X of order) {
    for (const comp of trappedAreas(s.cells, X, matesOf(s, X))) {
      const got = [];
      for (const j of comp) {
        const c = s.cells[j];
        if (!c || !foe(s, c.p, X) || c.prot || c.k === 'wall') continue; // nur Gegner: eigene und befreundete Figuren bleiben
        if (c.enc && !(s.turnNo > c.enc - 1 && (!foe(s, s.cur, c.by) || !s.alive[c.by]))) continue; // schon getroffen: erst im nächsten Zug des Einkreisenden wieder
        const eff = c.k === 'node' || c.k === 'drone' ? 'remove' : 'downgrade';
        got.push({ at: j, p: c.p, unit: c.k, h: c.h || null, eff });
        if (c.core) { (s.coreLost = s.coreLost || []).push(c.p); }
        if (eff === 'remove') destroy(s, j, true, false, true);
        else downgrade(s, j, X);
      }
      if (got.length) { s.fx.push({ k: 'encircle', p: X, area: comp, got }); total += got.length; }
    }
  }
  const still = new Set();
  for (const X of order) for (const comp of trappedAreas(s.cells, X, matesOf(s, X))) comp.forEach(j => { const c = s.cells[j]; if (c && foe(s, c.p, X)) still.add(j); });
  s.cells.forEach((c, i) => { if (c && c.enc && !still.has(i)) delete c.enc; });
  if (total) s.last = (s.last ? s.last + ' · ' : '') + `${total} ${total === 1 ? 'Figur' : 'Figuren'} eingekreist`;
}

// Für den Computer: Welchen Wert an fremden Figuren würde X einkreisen, wenn X auf at einen Node legt?
export function captureGain(s, X, at) {
  useBoard(s);
  if (s.round < HERO_ROUND - 1) return 0;
  const cells = s.cells.slice();
  cells[at] = { p: X, k: 'node' };
  let gain = 0;
  for (const comp of trappedAreas(cells, X, matesOf(s, X))) for (const j of comp) { const c = cells[j]; if (c && c.p !== X && !c.prot && c.k !== 'wall') { const v = (c.core ? 20 : 0) + (c.k === 'node' ? 1 : c.k === 'drone' ? 0.8 : c.k === 'pylon' ? 1.4 : 3.2); if (foe(s, c.p, X)) gain += v; } }
  return gain;
}

// Punkte bei Zeitablauf: Node 1, Pylon 2, Held 3
export const score = (s, p) => s.cells.reduce((a, c) => a + (isFig(c) && owner(c) === p ? (c.k === 'node' ? 1 : c.k === 'pylon' ? 2 : 3) : 0), 0);
export const CLOCK_MAX = 20;

// Punkte eines Teams (bzw. eines Spielers, wenn jeder für sich spielt)
export const teamScore = (s, t) => { let a = 0; for (let p = 0; p < s.n; p++) if (s.alive[p] && teamOf(s, p) === t) a += score(s, p); return a; };
const liveTeams = s => [...new Set(s.alive.map((a, p) => (a ? teamOf(s, p) : -1)).filter(t => t >= 0))];

// Schachuhr: verbrauchte Zeit des Spielers am Zug abziehen. Bei Ablauf entscheidet die Punktzahl.
function tick(s, spent) {
  if (!s.clock) return false;
  const p = s.cur;
  s.clock.left[p] = Math.max(0, s.clock.left[p] - Math.max(0, Math.min(Number(spent) || 0, 3600000)));
  if (s.clock.left[p] > 0) return false;
  const tp = teamOf(s, p);
  const others = liveTeams(s).filter(t => t !== tp);
  const best = Math.max(-1, ...others.map(t => teamScore(s, t)));
  // Bei Gleichstand verliert, wessen Zeit abgelaufen ist
  s.phase = 'over'; s.endReason = 'time';
  s.winner = teamScore(s, tp) > best || !others.length ? tp : others.find(t => teamScore(s, t) === best);
  s.last = 'Zeit abgelaufen';
  return true;
}

function checkWin(s) {
  for (let p = 0; p < s.n; p++) if (s.alive[p] && s.placed[p] && onBoard(s, p) === 0) s.alive[p] = false;
  const teams = liveTeams(s);
  if (teams.length <= 1) { s.phase = 'over'; s.winner = teams.length ? teams[0] : null; }
}

// Nach jeder Aktion: Kern unverändert, Brückenziele frei von Gegnern
function checkGoalRules(s) {
  if (s.core) s.core.forEach((i, q) => {
    if (i < 0 || !s.alive[q]) return;
    const c = s.cells[i];
    if (!c || c.p !== q || c.k !== 'node' || !c.core) fail('Der Kern kann nicht bewegt, verändert oder zerstört werden');
  });
  if (s.anchors) s.cells.forEach((c, i) => { if (c && anchorOfFoe(s, owner(c), i)) fail('Dieser Punkt ist das Brückenziel eines Gegners'); });
}
function startTurn(s) {
  const p = s.cur;
  // Rennen (Brücke, Leuchtfeuer): Der Startspieler hat im allerersten Zug nur 1 Aktion
  s.actions = s.turnNo === 0 && (s.goal === 'bridge' || s.goal === 'beacon') ? 1 : 2;
  s.bridge = false;
  s.cells.forEach((c, i) => {
    if (!c || c.p !== p) return;
    delete c.prot; delete c.hprot;
    if (c.k === 'wall') s.cells[i] = null; // Energiewand verschwindet
  });
  const keep = [];
  // Endphase: Nichts kommt mehr vom Stapel zurück
  for (const e of s.stapel[p]) { if (inEndphase(s)) keep.push(e); else if (e.w <= 0) s.pot[p] += e.n; else { e.w--; keep.push(e); } }
  s.stapel[p] = keep;
  s.hwait[p] = s.hwait[p].map(w => Math.max(0, w - 1));
}
function endTurn(s) {
  const p = s.cur;
  // Einkreisen wirkt erst, wenn der Zug fertig ist (der Spieler am Zug zuerst, dann die anderen)
  if (s.alive[p]) resolve(s, p);
  // Kern eingekreist: Dieser Spieler scheidet aus, seine Figuren verschwinden
  if (s.coreLost && s.coreLost.length) {
    for (const q of new Set(s.coreLost)) {
      s.alive[q] = false;
      s.cells.forEach((c, i) => { if (c && owner(c) === q) s.cells[i] = null; });
      s.mines = s.mines.filter(m => m.p !== q);
      s.fx.push({ k: 'coreLost', p: q });
    }
    s.last = (s.last ? s.last + ' · ' : '') + 'Kern gefallen';
    delete s.coreLost;
    const teams = liveTeams(s);
    if (teams.length <= 1) { s.phase = 'over'; s.winner = teams.length ? teams[0] : null; s.endReason = 'core'; return; }
  }
  // Brücke: am Zugende prüfen (zuerst das Team am Zug)
  if (s.anchors) {
    const order = [teamOf(s, p), ...liveTeams(s).filter(t => t !== teamOf(s, p))];
    const t = order.find(t => liveTeams(s).includes(t) && bridgeDone(s, t));
    if (t !== undefined) { s.phase = 'over'; s.winner = t; s.endReason = 'bridge'; s.last = 'Brücke geschlagen'; return; }
  }
  s.cells.forEach(c => {
    if (!c || c.p !== p) return;
    delete c.stun; delete c.shot; delete c.lock;
    if (c.orig && --c.hack <= 0) { c.p = c.orig.p; delete c.orig; delete c.hack; s.fx.push({ k: 'unhack' }); }
  });
  s.turnNo++;
  let nx = p;
  do { nx = (nx + 1) % s.n; } while (!s.alive[nx] && nx !== p);
  if (nx <= p) s.round++;
  s.cur = nx;
  if (s.round > limitOf(s)) {
    // Rundenlimit: Wer mehr Punkte auf dem Feld hat, gewinnt (Node 1, Pylon 2, Held 3)
    const teams = liveTeams(s);
    const best = Math.max(...teams.map(t => teamScore(s, t)));
    const top = teams.filter(t => teamScore(s, t) === best);
    s.phase = 'over'; s.endReason = 'rounds'; s.round = limitOf(s);
    s.winner = top.length === 1 ? top[0] : null;
    s.last = 'Rundenlimit erreicht';
    return;
  }
  startTurn(s);
  // Leuchtfeuer: Wer zu Beginn seines Zuges die Mehrheit hält, gewinnt
  if (s.beacons && s.round >= BEACON_ROUND) {
    const t = teamOf(s, s.cur);
    if (beaconsHeld(s, t) >= beaconNeed(s)) { s.phase = 'over'; s.winner = t; s.endReason = 'beacon'; s.last = 'Leuchtfeuer gehalten'; }
  }
}

function setGoal(s, goal) {
  s.goal = goal in GOALS ? goal : 'classic';
  const b = boardOf(s);
  const teams = [...new Set(s.team || [0, 1])];
  delete s.anchors; delete s.beacons; delete s.core;
  if (s.goal === 'bridge') s.anchors = anchorsFor(b, s.n, teams);
  if (s.goal === 'beacon') s.beacons = beaconsFor(b, s.n);
  if (s.goal === 'core') s.core = Array(s.n).fill(-1);
}
const cleanName = (v, k) => String(v || '').replace(/[<>&"'`]/g, '').trim().slice(0, 14) || `Spieler ${k + 1}`;
const cleanId = v => String(v || '').slice(0, 64);
export const isBot = (s, p) => !!(s.seated && s.seated[p] === 'bot');
export const seatOf = (s, id) => (s.seated ? s.seated.indexOf(id) : -1);

export function apply(s0, a) {
  if (a && a.t === 'init') {
    // Multiplayer: 3 Spieler (alle gegen alle) oder 4 Spieler (2 gegen 2). Muss die erste Aktion sein.
    if (s0 && s0.seq) fail('Die Partie läuft schon');
    if (a.n !== 3 && a.n !== 4) fail('Ungültige Spielerzahl');
    const g = newGame(a.n, a.n === 4 ? 'team' : 'ffa');
    const m = Math.round(Number(a.clock) || 0);
    if (m < 0 || m > CLOCK_MAX) fail('Ungültige Bedenkzeit');
    g.clock = m ? { minutes: m, left: Array(g.n).fill(m * 60000), only: null } : null;
    g.tier = tierFrom(a); g.adv = g.tier === 3;
    setGoal(g, a.goal);
    g.roundLimit = roundsFrom(a.rounds);
    g.seated = Array(g.n).fill(null); g.names = Array(g.n).fill('');
    g.seated[0] = cleanId(a.id) || 'host'; g.names[0] = cleanName(a.name, 0);
    g.last = 'Raum eröffnet'; g.seq = 1;
    return g;
  }
  const s = clone(s0);
  useBoard(s);
  s.last = ''; s.fx = [];
  if (s.phase === 'over') fail('Die Partie ist beendet');
  if (a.t === 'sit' || a.t === 'bot' || a.t === 'unbot' || a.t === 'seat') {
    if (!s.seated) fail('Hier gibt es keine Plätze');
    if (s.phase !== 'pick') fail('Die Partie hat schon begonnen');
    const free = k => Number.isInteger(k) && k >= 0 && k < s.n && s.seated[k] === null;
    if (a.t === 'sit') {
      const id = cleanId(a.id);
      if (!id || id === 'bot') fail('Ungültiger Spieler');
      if (s.seated.includes(id)) fail('Du sitzt schon');
      const k = free(a.seat) ? a.seat : s.seated.indexOf(null);
      if (k < 0) fail('Der Raum ist voll');
      s.seated[k] = id; s.names[k] = cleanName(a.name, k); s.last = s.names[k] + ' ist dabei';
    } else if (a.t === 'bot') {
      if (a.p !== 0) fail('Nur der Gastgeber holt Computer dazu');
      const k = free(a.seat) ? a.seat : s.seated.indexOf(null);
      if (k < 0) fail('Der Raum ist voll');
      s.seated[k] = 'bot'; s.names[k] = 'Computer'; s.last = 'Computer ist dabei';
    } else if (a.t === 'unbot') {
      if (a.p !== 0) fail('Nur der Gastgeber entfernt Computer');
      if (!isBot(s, a.seat)) fail('Dort sitzt kein Computer');
      s.seated[a.seat] = null; s.names[a.seat] = ''; s.picks[a.seat] = null; s.auras[a.seat] = null; s.last = 'Computer entfernt';
    } else {
      // Platz wechseln (nur vor der Heldenwahl)
      if (!(a.p >= 0 && a.p < s.n) || !s.seated[a.p] || isBot(s, a.p)) fail('Du sitzt noch nicht');
      if (s.picks[a.p]) fail('Nach der Heldenwahl kannst du den Platz nicht mehr wechseln');
      if (!free(a.to)) fail('Dieser Platz ist besetzt');
      s.seated[a.to] = s.seated[a.p]; s.names[a.to] = s.names[a.p]; s.seated[a.p] = null; s.names[a.p] = '';
      s.last = 'Platz gewechselt';
    }
    s.seq++; return s;
  }
  if (a.t === 'setup') {
    if (s.phase !== 'pick' || a.p !== 0) fail('Nur der Gastgeber stellt die Partie ein');
    const m = Math.round(Number(a.clock) || 0);
    if (m < 0 || m > CLOCK_MAX) fail('Ungültige Bedenkzeit');
    s.clock = m ? { minutes: m, left: Array(s.n).fill(m * 60000), only: Number.isInteger(a.only) ? a.only : null } : null;
    s.tier = tierFrom(a); s.adv = s.tier === 3;
    setGoal(s, a.goal);
    s.roundLimit = roundsFrom(a.rounds);
    s.seq++; return s;
  }
  if (a.t === 'pick') {
    if (s.phase !== 'pick') fail('Die Heldenwahl ist vorbei');
    if (!(a.p >= 0 && a.p < s.n) || s.picks[a.p]) fail('Schon gewählt');
    if (s.seated && !s.seated[a.p]) fail('Dieser Platz ist noch frei');
    const hs = a.heroes;
    if (!Array.isArray(hs) || hs.length !== 3 || !hs.every(h => h in HEROES)) fail('Wähle genau 3 Helden');
    if (!hs.every(h => heroPool(s).includes(h))) fail('Dieser Held ist im Grundspiel nicht dabei');
    if (hs.some(h => hs.filter(x => x === h).length > MAX_SAME)) fail(`Derselbe Held höchstens ${MAX_SAME}-mal`);
    if (s.adv && !(a.aura in AURAS)) fail('Wähle eine Aura');
    s.picks[a.p] = hs.slice();
    s.auras[a.p] = s.adv ? a.aura : null;
    if (s.picks.every(Boolean)) {
      for (let p = 0; p < s.n; p++) if (auraOf(s, p) === 'nachschub') s.pot[p] += 3;
      for (let p = 1; p < s.n; p++) s.pot[p] += 1; // Ausgleich: Wer nicht beginnt, hat 1 Node mehr
      s.phase = 'play'; s.cur = 0; startTurn(s); s.last = 'Die Partie beginnt';
    }
    s.seq++; return s;
  }
  if (s.phase !== 'play') fail('Die Partie hat noch nicht begonnen');
  if (a.t === 'resign') {
    if (!(a.p >= 0 && a.p < s.n) || !s.alive[a.p]) fail('Du spielst nicht mehr mit');
    s.alive[a.p] = false; s.last = 'Aufgegeben'; checkWin(s);
    if (s.phase === 'play' && s.cur === a.p) endTurn(s);
    s.seq++; return s;
  }
  if (a.t === 'timeout') {
    if (!s.clock || (s.clock.only !== null && s.clock.only !== s.cur)) fail('Hier läuft keine Uhr');
    if (!tick(s, a.spent)) fail('Die Zeit ist noch nicht abgelaufen');
    s.seq++; return s;
  }
  if (a.p !== s.cur) fail('Du bist nicht am Zug');
  if (s.clock && (s.clock.only === null || s.clock.only === s.cur) && tick(s, a.spent)) { s.seq++; return s; }
  if (a.t === 'end') { endTurn(s); checkWin(s); if (!s.last) s.last = 'Zug beendet'; s.seq++; return s; }
  const cost = doAction(s, a);
  checkGoalRules(s);
  s.actions -= cost;
  checkWin(s);
  if (s.phase === 'play' && s.actions <= 0) { endTurn(s); checkWin(s); }
  s.seq++;
  return s;
}

// Alle Aktionen des Spielers am Zug (für den Computergegner). lite: weniger Varianten für die zweite Aktion.
export function legalActions(s, lite = false) {
  useBoard(s);
  if (s.phase !== 'play') return [];
  const p = s.cur, out = [];
  placeTargets(s, p).forEach(at => out.push({ t: 'place', p, at }));
  const heroes = availableHeroes(s, p);
  s.cells.forEach((c, i) => {
    if (!c || c.p !== p) return;
    if (c.k === 'node' && s.pot[p] > 0 && !c.core) out.push({ t: 'stack', p, at: i });
    if (c.k === 'pylon' || (c.k === 'node' && !c.core && canRufNode(s, p))) heroes.forEach(h => out.push({ t: 'hero', p, at: i, h }));
    targets(s, i, 'move').forEach(to => out.push({ t: 'move', p, from: i, to }));
    if (c.k === 'hero' && !c.stun && !c.lock) {
      for (const copy of c.as ? [false, true] : [false]) {
        const t = abType(c, copy);
        for (const kind of ['n', 's']) {
          if (!abilityUsable(s, i, kind, copy)) continue;
          const base = copy ? { t: 'ability', p, from: i, kind, copy: true } : { t: 'ability', p, from: i, kind };
          const need = stepsNeeded(t, kind);
          if (need === 0) { out.push(base); continue; }
          const first = targets(s, i, kind, copy);
          if (need === 1) { first.forEach(target => out.push({ ...base, target })); continue; }
          const key = t + ':' + kind;
          if (key === 'phantom:n') {
            if (lite) continue;
            const busy = new Set();
            s.cells.forEach((o, j) => { if (isFig(o)) BOARD.adj[j].forEach(x => { if (!s.cells[x]) busy.add(x); }); });
            first.filter(j => s.cells[j].k !== 'node').forEach(u => busy.forEach(d => { if (!anchorOfFoe(s, p, d)) out.push({ ...base, target: u, target2: d }); }));
          } else if (key === 'ingenieur:s') {
            first.forEach((u, x) => { out.push({ ...base, target: u }); if (!lite && stapelCount(s, p) > 1) first.slice(x + 1).forEach(v => out.push({ ...base, target: u, target2: v })); });
          } else if (key === 'saboteur:s') {
            first.forEach(u => { const nx = nextTargets(s, i, kind, copy, [u]); if (!nx.length) out.push({ ...base, target: u }); else nx.forEach(v => out.push({ ...base, target: u, target2: v })); });
          }
        }
      }
    }
  });
  out.push({ t: 'end', p });
  return out;
}

// Für den Computer: Stellung ohne die gegnerischen (verdeckten) Minen
export const hideMines = (s, p) => ({ ...s, mines: s.mines.filter(m => !foe(s, m.p, p)) });

export function replay(log, players = 2) {
  let s = newGame(players);
  for (const a of log) s = apply(s, a);
  return s;
}
