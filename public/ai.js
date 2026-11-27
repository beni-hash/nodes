// Nodes – Computergegner: bewertet alle Zugpaare (2 Aktionen) und nimmt das beste.
import { apply, legalActions, targets, heroType, BOARD, stapelCount, HERO_IDS, AURA_IDS, placeTargets, captureGain, HERO_ROUND, trappedAreas, hideMines, minesOf, NB, useBoard, foe, teamOf, matesOf, bridgeGap, beaconsHeld, beaconNeed, teamScore } from './engine.js';

const VAL = { node: 1, pylon: 2.4, hero: 4.2, wall: 0.3, drone: 0.9 };

function threats(s, attacker) {
  // Figuren, die attacker im nächsten Zug mit einer normalen Fähigkeit zerstören könnte
  const hit = new Set();
  s.cells.forEach((c, i) => {
    if (!c || c.p !== attacker || c.k !== 'hero') return;
    const fake = { ...s, cells: s.cells.map(x => (x && x.p === attacker ? { ...x, stun: false } : x)) };
    for (const [t, copy] of [[c.h, false], [c.as, true]]) {
      if (t === 'titan' || t === 'sniper' || t === 'interceptor' || t === 'saboteur') targets(fake, i, t === 'saboteur' ? 's' : 'n', copy).forEach(j => hit.add(j));
    }
  });
  return hit;
}

export function evaluate(s, p) {
  useBoard(s);
  MATES = Array.from({ length: s.n }, (_, X) => matesOf(s, X));
  if (s.phase === 'over') return s.winner === teamOf(s, p) ? 10000 : s.winner === null ? 0 : -10000;
  let score = 0;
  const foes = s.alive.filter((a, q) => a && foe(s, q, p)).length || 1;
  for (let q = 0; q < s.n; q++) {
    if (!s.alive[q]) continue;
    // Eigene Figuren zählen voll, die des Partners fast voll, Gegner verteilt (bei mehreren Gegnern zählt jeder etwas weniger)
    const sign = q === p ? 1 : !foe(s, q, p) ? 0.8 : -1.05 * (foes > 1 ? 0.75 : 1);
    let mat = 0, lib = 0;
    s.cells.forEach((c, i) => {
      if (!c || c.p !== q) return;
      mat += c.orig ? 1.8 : VAL[c.k];           // gehackter Held: nur geliehen
      if (c.core) mat += 6;
      if (c.stun) mat -= 0.8;
      if (c.lock) mat -= 0.5;
      BOARD.adj[i].forEach(j => { if (!s.cells[j]) lib++; });
    });
    mat += 0.55 * s.pot[q] + 0.45 * stapelCount(s, q) + 0.5 * minesOf(s, q).length;
    s.cells.forEach(c => { if (c && c.orig && c.orig.p === q) mat += 1.6; }); // eigener Held kommt zurück
    if (s.round <= HERO_ROUND + 3) s.cells.forEach((c, i) => {
      if (!c || c.p !== q || c.k === 'wall' || c.k === 'drone') return;
      const pt = BOARD.points[i];
      mat += 0.3 + 0.12 * (BOARD.R - Math.max(Math.abs(pt.q), Math.abs(pt.r), Math.abs(pt.q + pt.r)));
    });
    score += sign * (mat + 0.04 * lib);
  }
  // Bedrohungen
  for (let q = 0; q < s.n; q++) {
    if (!foe(s, q, p) || !s.alive[q]) continue;
    threats(s, q).forEach(j => { const c = s.cells[j]; if (c && c.p === p && !c.prot) score -= 0.6 * VAL[c.k]; });
    threats(s, p).forEach(j => { const c = s.cells[j]; if (c && c.p === q) score += 0.25 * VAL[c.k]; });
  }
  score += goalScore(s, p);
  // Einkreisungen, die mit einem einzigen Node möglich wären
  for (let q = 0; q < s.n; q++) {
    if (!s.alive[q] || s.pot[q] <= 0) continue;
    let best = 0;
    for (const at of placeTargets(s, q)) best = Math.max(best, captureGain(s, q, at));
    if (foe(s, q, p)) score -= 0.9 * best; else if (q === p) score += 0.3 * best; else score += 0.15 * best;
  }
  return score;
}

// Spielziele: Brücke, Leuchtfeuer (der Kern steckt in Material und Sicherheit)
function goalScore(s, p) {
  const me = teamOf(s, p);
  const foeTeams = [...new Set(s.alive.map((a, q) => (a && foe(s, q, p) ? teamOf(s, q) : -1)).filter(t => t >= 0))];
  let v = 0;
  // Das Spiel endet, wenn kein Punkt mehr frei ist: Wer vorne liegt, füllt das Feld, wer hinten liegt, hält es offen
  const free = s.cells.reduce((a, c) => a + (c ? 0 : 1), 0);
  const lead = teamScore(s, me) - Math.max(0, ...foeTeams.map(t => teamScore(s, t)));
  v -= 0.25 * Math.sign(lead) * free;
  if (s.anchors) {
    const f = g => (g === Infinity ? 0 : 40 / (g + 2));
    v += f(bridgeGap(s, me));
    for (const t of foeTeams) {
      const g = bridgeGap(s, t);
      v -= f(g) * (foeTeams.length > 1 ? 0.7 : 1);
      if (g <= 2) v -= g <= 1 ? 60 : 30; // Gegner kann im nächsten Zug fertig bauen
    }
  }
  if (s.beacons) {
    const need = beaconNeed(s), mine = beaconsHeld(s, me);
    v += 7 * mine + (mine >= need ? 25 : 0);
    for (const t of foeTeams) { const h = beaconsHeld(s, t); v -= 7 * h + (h >= need - 1 ? 12 : 0); }
    // Nähe zu freien Leuchtfeuern
    s.beacons.forEach(i => { if (s.cells[i]) return; if (BOARD.adj[i].some(j => s.cells[j] && teamOf(s, s.cells[j].p) === me)) v += 1.5; });
  }
  return v;
}

function safeApply(s, a) { try { return apply(s, a); } catch { return null; } }

// Was könnte X mit zwei gelegten Nodes einkreisen? (auch schon in der Aufbauphase, um vorzusorgen)
let MATES = null; // Teams der aktuellen Bewertung
function regionLoss(cells, X, victim) {
  let lost = 0, count = 0, room = BOARD.V;
  const trapped = trappedAreas(cells, X, MATES ? MATES[X] : null);
  for (const comp of trapped) for (const j of comp) { const c = cells[j]; if (c && c.p === victim && !c.prot && c.k !== 'wall') { lost += c.core ? 60 : c.k === 'node' ? 1 : c.k === 'drone' ? VAL.drone : VAL[c.k] - 1; if (c.k === 'node') count++; } }
  // Platz: kleinstes Gebiet, in dem eine eigene Figur steht (nur relevant, wenn knapp)
  const seenWall = i => { const c = cells[i]; return c && (c.k === 'hole' || ((MATES ? MATES[X] : [X]).includes(c.p) && (c.k === 'node' || c.k === 'pylon'))); };
  const seen = new Uint8Array(BOARD.V);
  let best = 0;
  for (let i = 0; i < BOARD.V; i++) {
    if (seen[i] || seenWall(i)) continue;
    const comp = [i]; seen[i] = 1;
    for (let h = 0; h < comp.length; h++) for (const j of BOARD.adj[comp[h]]) if (!seen[j] && !seenWall(j)) { seen[j] = 1; comp.push(j); }
    if (comp.some(j => cells[j] && cells[j].p === victim)) best = Math.max(best, comp.length);
  }
  room = count ? 0 : best;
  return [lost, count, room];
}
function twoNodeThreat(s, X, victim) {
  if (s.pot[X] <= 0) return [0, 0, BOARD.V];
  let best = [0, 0], room = BOARD.V;
  const first = placeTargets(s, X);
  for (const a of first) {
    const c1 = s.cells.slice(); c1[a] = { p: X, k: 'node' };
    const r1 = regionLoss(c1, X, victim);
    if (r1[0] > best[0]) best = r1;
    room = Math.min(room, r1[2]);
    if (s.pot[X] < 2) continue;
    const s1 = { ...s, cells: c1, pot: s.pot.map((v, i) => (i === X ? v - 1 : v)) };
    for (const b of placeTargets(s1, X)) {
      const c2 = c1.slice(); c2[b] = { p: X, k: 'node' };
      const r2 = regionLoss(c2, X, victim);
      if (r2[0] > best[0]) best = r2;
      room = Math.min(room, r2[2]);
    }
  }
  return [best[0], best[1], room];
}
function safety(s, p) {
  let pen = 0;
  const mine = s.cells.reduce((a, c) => a + (c && c.p === p && c.k !== 'wall' && c.k !== 'drone' ? 1 : 0), 0);
  for (let q = 0; q < s.n; q++) {
    if (!foe(s, q, p) || !s.alive[q]) continue;
    const [lost, count] = twoNodeThreat(s, q, p);
    if (!lost) continue;
    if (count >= mine) pen += 400;           // alles weg = Niederlage
    pen += 1.1 * lost;
  }
  return pen;
}

// Spielstufen: 'easy' (sorglos, viel Zufall), 'medium' (denkt mit, macht Fehler), 'hard' (volle Stärke)
export const LEVELS = { easy: 'Einfach', medium: 'Mittel', hard: 'Schwierig' };

function easyTurn(s) {
  s = hideMines(s, s.cur);
  const p = s.cur, seq = [];
  let cur = s;
  for (let k = 0; k < 2 && cur.phase === 'play' && cur.cur === p; k++) {
    const acts = legalActions(cur).filter(a => a.t !== 'end');
    if (!acts.length) break;
    let a;
    if (Math.random() < 0.3) a = acts[Math.floor(Math.random() * acts.length)];
    else {
      const sc = acts.map(x => { const n = safeApply(cur, x); return n ? { x, n, v: evaluate(n, p) + Math.random() * 1.5 } : null; }).filter(Boolean);
      sc.sort((u, w) => w.v - u.v);
      a = sc[Math.floor(Math.random() * Math.min(4, sc.length))].x;
    }
    const n = safeApply(cur, a); if (!n) break;
    seq.push(a); cur = n;
  }
  return seq.length ? seq : [{ t: 'end', p }];
}

// Tutorial-Gegner: spielt bewusst schwach. Legt gern an den Rand, verteilt sich, nutzt Helden nur selten.
function noviceTurn(s) {
  const p = s.cur, seq = [];
  let st = s;
  for (let k = 0; k < 2 && st.phase === 'play' && st.cur === p; k++) {
    const L = legalActions(st, true).filter(a => a.t !== 'end' && a.t !== 'remove');
    if (!L.length) break;
    const w = a => a.t === 'place' ? (BOARD.points[a.at].edge ? 4 : 1) : a.t === 'stack' ? 0.6 : a.t === 'hero' ? 0.8 : a.t === 'ability' ? 0.5 : 0.15;
    const tot = L.reduce((x, a) => x + w(a), 0);
    let r = Math.random() * tot, pick = L[0];
    for (const a of L) { r -= w(a); if (r <= 0) { pick = a; break; } }
    try { st = apply(st, pick); seq.push(pick); } catch { break; }
  }
  return seq;
}
export function chooseTurn(s, level = 'hard') {
  useBoard(s);
  if (level === 'novice') return noviceTurn(hideMines(s, s.cur));
  MATES = Array.from({ length: s.n }, (_, X) => matesOf(s, X));
  if (level === 'easy') return easyTurn(s);
  s = hideMines(s, s.cur);   // Der Computer sieht die Minen seines Gegners nicht
  const hard = level !== 'medium';
  const noise = hard ? 0.05 : 0.7;
  const p = s.cur;
  const first = legalActions(s);
  const scored = [];
  for (const a of first) {
    const s1 = safeApply(s, a); if (!s1) continue;
    scored.push({ a, s1, v: evaluate(s1, p) + Math.random() * noise });
  }
  scored.sort((x, y) => y.v - x.v);
  const cands = [];
  for (const { a, s1, v } of scored.slice(0, hard ? 24 : 8)) {
    if (s1.phase !== 'play' || s1.cur !== p) { cands.push({ seq: [a], v, st: s1 }); continue; }
    for (const b of legalActions(s1, true)) {
      const s2 = safeApply(s1, b); if (!s2) continue;
      cands.push({ seq: [a, b], v: evaluate(s2, p) + Math.random() * noise, st: s2 });
    }
  }
  if (!cands.length) return [{ t: 'end', p }];
  cands.sort((x, y) => y.v - x.v);
  // Die besten Kandidaten genauer prüfen: Kann der Gegner danach mit zwei Nodes einkreisen?
  let best = null;
  for (const c of cands.slice(0, hard ? 260 : 20)) {
    const v = c.st.phase === 'over' ? c.v : c.v - (hard ? 1 : 0.5) * safety(c.st, p);
    if (!best || v > best.v) best = { seq: c.seq, v };
  }
  return best.seq;
}

export function pickHeroes(pool = HERO_IDS) {
  const out = [];
  while (out.length < 3) { const h = pool[Math.floor(Math.random() * pool.length)]; if (!out.includes(h) || (Math.random() < 0.15 && out.filter(x => x === h).length < 2)) out.push(h); }
  return out;
}
export function pickAura() {
  return AURA_IDS[Math.floor(Math.random() * AURA_IDS.length)];
}
