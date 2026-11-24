// Nodes – Oberfläche
import * as E from './engine.js';
import { chooseTurn, pickHeroes, pickAura, LEVELS } from './ai.js';

const app = document.getElementById('app');
const ME_COL = '#F4A261', OPP_COL = '#4CC9F0', MATE_COL = '#FFE45E', OPP2_COL = '#C77DFF';
const PAL = [ME_COL, OPP_COL, MATE_COL, OPP2_COL];
// Farbe aus deiner Sicht: du orange, Partner gelb, Gegner blau und violett (Zuschauer: nach Platz)
function colIdx(p) {
  const s = G.state;
  if (p === G.me) return 0;
  if (!s || s.n <= 2) return 1;
  if (G.me < 0) return [0, 1, 2, 3][p] ?? 1;
  if (!E.foe(s, p, G.me)) return 2;
  let k = 0;
  for (let d = 1; d < s.n; d++) { const q = (G.me + d) % s.n; if (q === p) break; if (E.foe(s, q, G.me)) k++; }
  return k === 0 ? 1 : 3;
}
const col = p => PAL[colIdx(p)];

// Einfache Heldensymbole (weiss auf dem Punkt)
const ICON = {
  titan: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/>',
  sniper: '<circle cx="12" cy="12" r="6"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
  interceptor: '<path d="M12 3l7 17-7-4-7 4z"/>',
  phantom: '<path d="M13 2L5 13h6l-1 9 8-12h-6z"/>',
  hacker: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/>',
  ingenieur: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><circle cx="12" cy="12" r="3"/>',
  mimic: '<circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/>',
  warden: '<path d="M4 7h16v11H4z M4 12.5h16 M10 7v5.5 M14 12.5V18"/>',
  saboteur: '<circle cx="12" cy="13" r="5"/><path d="M12 4v3M12 19v2M3 13h2M19 13h2M6 7.5l1.5 1.5M18 7.5L16.5 9"/>',
  schwarm: '<path d="M12 3.5l3.2 5.5H8.8z M6 13l3.2 5.5H2.8z M18 13l3.2 5.5h-6.4z"/>',
};
const iconPaths = (h, color, w = 2.2) => `<g fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${ICON[h]}</g>`;
const heroIcon = (h, size = 18, color = '#fff') => `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24">${iconPaths(h, color)}</svg>`;
const iconAt = (h, x, y, size, color = '#fff') => { const k = size / 24; return `<g transform="translate(${x - size / 2},${y - size / 2}) scale(${k})">${iconPaths(h, color, 2.4)}</g>`; };
let B = E.boardOf(null);
let VIEW = null;
function syncBoard() {
  const b = E.boardOf(G.state);
  if (b === B && VIEW) return;
  B = b;
  const xs = B.points.map(p => p.x), ys = B.points.map(p => p.y);
  const minx = Math.min(...xs) - 26, miny = Math.min(...ys) - 26;
  VIEW = { minx, miny, w: Math.max(...xs) - minx + 26, h: Math.max(...ys) - miny + 26 };
  if (FX.svg) FX.svg.setAttribute('viewBox', `${VIEW.minx} ${VIEW.miny} ${VIEW.w} ${VIEW.h}`);
}

const G = {
  screen: 'start', mode: null, me: 0, log: [], state: null,
  sel: null, pending: null, picks: [], msg: '', err: false,
  net: null, code: '', peers: 0, aiBusy: false, menu: false, ruleBack: 'start', fx: null,
  bigFx: true, clockMin: 0, mark: 0, timeoutSent: -1, level: 'medium', adv: false, aura: null,
  name: '', mn: 3, rounds: 30, myId: '', host: false, onlineIds: null, onlineSeats: new Set(), sitAt: 0, botPick: {}, botTimer: null, botPlan: null, botLastSeq: -1,
};
try { const v = JSON.parse(localStorage.getItem('nodes-settings') || '{}'); if (typeof v.bigFx === 'boolean') G.bigFx = v.bigFx; if (Number.isInteger(v.clockMin)) G.clockMin = v.clockMin; if (v.level in { easy: 1, medium: 1, hard: 1 }) G.level = v.level; if (typeof v.adv === 'boolean') G.adv = v.adv; if (typeof v.name === 'string') G.name = v.name.slice(0, 14); if (v.mn === 3 || v.mn === 4) G.mn = v.mn; if (v.rounds >= 10 && v.rounds <= 50) G.rounds = v.rounds; } catch {}
const saveSettings = () => { try { localStorage.setItem('nodes-settings', JSON.stringify({ bigFx: G.bigFx, clockMin: G.clockMin, level: G.level, adv: G.adv, name: G.name, mn: G.mn, rounds: G.rounds })); } catch {} };
const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Neuer Spielstand; gibt die Dauer der Effekte zurück
function setState(next, animate = true) {
  G.state = next;
  syncBoard();
  G.mark = performance.now();
  return animate ? playFx(next) : 0;
}
// Uhr: verbrauchte Zeit seit Beginn des Zuges bzw. der letzten Aktion (Animationen zählen nicht)
const spentNow = () => Math.max(0, Math.round(performance.now() - Math.max(G.mark || 0, FX.lock || 0)));
const clockRuns = p => { const c = G.state && G.state.clock; return !!c && (c.only === null || c.only === p); };
const fmt = ms => { const t = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
function clockLeft(p) {
  const s = G.state;
  if (!clockRuns(p)) return null;
  return s.clock.left[p] - (s.phase === 'play' && s.cur === p ? spentNow() : 0);
}
setInterval(() => {
  const s = G.state;
  if (G.screen !== 'game' || !s || !s.clock || s.phase !== 'play') return;
  document.querySelectorAll('.clock[data-p]').forEach(el => {
    const p = +el.dataset.p, l = clockLeft(p);
    el.textContent = fmt(l);
    el.classList.toggle('low', l < 30000);
    el.classList.toggle('run', s.cur === p);
  });
  const l = clockLeft(s.cur);
  if (l !== null && l <= 0 && G.timeoutSent !== s.seq && performance.now() >= FX.lock && !G.aiBusy) {
    if (G.mode === 'single' && s.cur !== G.me) return;
    G.timeoutSent = s.seq;
    act({ t: 'timeout' });
  }
}, 250);

const esc = t => String(t).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const isMulti = () => G.mode === 'multi';
function nameOf(p) {
  const s = G.state;
  if (p === G.me) return 'Du';
  if (G.mode === 'single') return 'Computer';
  if (isMulti() && s && s.names) {
    if (E.isBot(s, p)) { const all = s.seated.filter(x => x === 'bot').length; return all > 1 ? `Computer ${s.seated.slice(0, p + 1).filter(x => x === 'bot').length}` : 'Computer'; }
    return s.names[p] || `Spieler ${p + 1}`;
  }
  return 'Gegner';
}
const names = () => Array.from({ length: G.state ? G.state.n : 2 }, (_, p) => nameOf(p));
const whose = p => (!isMulti() ? 'des Gegners' : !E.foe(G.state, p, G.me) ? `von ${esc(nameOf(p))} (Partner)` : `von ${esc(nameOf(p))}`);
const teamName = t => { const s = G.state; if (!s || s.mode !== 'team') return nameOf(t); const m = []; for (let p = 0; p < s.n; p++) if (E.teamOf(s, p) === t) m.push(nameOf(p)); return m.join(' & '); };
const isOnline = k => { const s = G.state; if (k === G.me || E.isBot(s, k)) return true; return G.onlineIds ? !!(s.seated && G.onlineIds.has(s.seated[k])) : G.onlineSeats.has(k); };
const aiSeat = () => 1 - G.me;

// ---------- Formen der Spieler: Kreis, Raute, Dreieck, Quadrat ----------
function shape(p, x, y, r, fill, stroke = 'none', sw = 0, extra = '') {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" ${extra}/>`;
}
const shapeIcon = (p, size = 12) => `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="-8 -8 16 16">${shape(p, 0, 0, 6, col(p))}</svg>`;

function emblem(size) {
  const pts = [[0, 0], ...[0, 1, 2, 3, 4, 5].map(i => [Math.cos(Math.PI / 3 * i + Math.PI / 6), Math.sin(Math.PI / 3 * i + Math.PI / 6)])];
  const k = size * 0.36, c = size / 2;
  const P = pts.map(([x, y]) => [c + x * k, c + y * k]);
  let o = `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs><filter id="eg" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
  for (let i = 1; i <= 6; i++) { const j = (i % 6) + 1; for (const [a, b] of [[0, i], [i, j]]) o += `<line x1="${P[a][0]}" y1="${P[a][1]}" x2="${P[b][0]}" y2="${P[b][1]}" stroke="#5A6EA8" stroke-width="3" stroke-linecap="round"/>`; }
  P.forEach(([x, y], i) => { o += shape(0, x, y, i ? 11 : 14, [3, 4, 5].includes(i) ? OPP_COL : ME_COL, 'none', 0, 'filter="url(#eg)"'); });
  return o + '</svg>';
}

const advToggle = () => `<div class="clockset"><label class="switch"><input type="checkbox" id="advbox" ${G.adv ? 'checked' : ''}> <span><b>Aura</b></span></label>${G.adv ? '<div class="muted" style="font-size:13px">Jeder wählt zusätzlich eine Aura mit Dauerbonus.</div>' : ''}</div>`;
const clockLabel = m => (m ? `${m} Min.` : 'Aus');
const roundPicker = () => `<div class="clockset"><label for="roundrange"><b>Runden</b> <span class="muted" id="roundlbl">${G.rounds}</span></label>
  <input id="roundrange" type="range" min="${E.ROUND_MIN}" max="${E.ROUND_MAX}" step="5" value="${G.rounds}"></div>`;
const clockPicker = () => `<div class="clockset"><label for="clockrange"><b>Uhr</b> <span class="muted" id="clocklbl">${clockLabel(G.clockMin)}</span></label>
  <input id="clockrange" type="range" min="0" max="${E.CLOCK_MAX}" step="1" value="${G.clockMin}">
  ${G.clockMin ? '<div class="muted" style="font-size:13px">Bedenkzeit pro Spieler. Ist sie um, entscheiden die Punkte.</div>' : ''}</div>`;

// ---------- Bildschirme ----------
function render() {
  syncBoard();
  const s = G.screen;
  let html = '';
  if (s === 'start') html = startScreen();
  else if (s === 'rules') html = rulesScreen();
  else if (s === 'lobby') html = lobbyScreen();
  else if (s === 'mlobby') html = mlobbyScreen();
  else if (s === 'pick') html = pickScreen();
  else if (s === 'game') html = gameScreen();
  app.innerHTML = html + (G.menu ? menuOverlay() : '') + (G.screen === 'game' && G.state && G.state.phase === 'over' ? overOverlay() : '');
  syncFx();
}

function startScreen() {
  return `<div class="screen start">
  <div class="logo">${emblem(160)}<h1>NODES</h1></div>
  <div class="stack">
    <button class="btn primary" data-act="single">Singleplayer</button>
    <button class="btn" data-act="duel">Duell</button>
    <button class="btn" data-act="multi">Multiplayer</button>
    <button class="btn" data-act="rules" style="border-color:transparent">Regeln</button>
  </div></div>`;
}

function heroCard(h, extra = '') {
  const H = E.HEROES[h];
  return `<div class="hn"><span class="badge">${heroIcon(h, 20)}</span><h3 style="font-size:18px">${H.name}</h3><span class="role">${H.role}</span></div>
  ${H.move ? `<div class="ab muted">${H.move}</div>` : ''}${H.passive ? `<div class="ab muted">${H.passive}</div>` : ''}
  <div class="ab"><b>${H.n.name}</b> · ${E.abilityCost(h, 'n')} Aktion${E.abilityCost(h, 'n') > 1 ? 'en' : ''} – ${H.n.desc}</div>
  <div class="ab"><b>${H.s.name}</b> · ${E.abilityCost(h, 's')} Aktion${E.abilityCost(h, 's') > 1 ? 'en' : ''} – ${H.s.desc}</div>${extra}`;
}

function rulesScreen() {
  const mini = (k, h) => `<svg aria-hidden="true" width="34" height="34" viewBox="-17 -17 34 34" style="flex:none">${pieceSvg({ p: G.me, k, h }, 0, 0)}</svg>`;
  const opp = `<svg aria-hidden="true" width="34" height="34" viewBox="-17 -17 34 34" style="flex:none">${pieceSvg({ p: G.me === 0 ? 1 : 0, k: 'node' }, 0, 0)}</svg>`;
  const cost = (h, k) => { const c = E.abilityCost(h, k); return c === 1 ? '1 Aktion' : '2 Aktionen'; };
  const heroes = E.HERO_IDS.map(h => {
    const H = E.HEROES[h];
    return `<div class="hcard"><div class="hn"><span class="badge">${heroIcon(h, 20)}</span><h3 style="font-size:18px;margin:0;color:var(--text)">${H.name}</h3><span class="role">${H.role}</span></div>
    <div class="ab"><b>Bewegung:</b> ${H.move || 'Zieht 1 Feld weit entlang einer Linie.'}</div>
    ${H.passive ? `<div class="ab"><b>Passiv:</b> ${H.passive.replace(/^[^:]+: /, '')}</div>` : ''}
    <div class="ab"><b>${H.n.name}</b> (${cost(h, 'n')}): ${H.n.desc}</div>
    <div class="ab"><b>${H.s.name}</b> (${cost(h, 's')}): ${H.s.desc}</div></div>`;
  }).join('');
  return `<div class="screen rules">
  <div class="top"><button class="icon" data-act="back" aria-label="Zurück">${backIcon}</button><h2>Spielregeln</h2></div>

  <div class="box"><b>Kurz gesagt:</b> Zwei Spieler (im Multiplayer drei oder vier) legen abwechselnd Nodes auf ein Netz aus Punkten. Aus Nodes werden Pylone, aus Pylonen Helden mit besonderen Fähigkeiten. Wer mit seinen Ketten gegnerische Figuren einkreist oder sie mit Helden zerstört, gewinnt.</div>

  <h3>1 · Ziel des Spiels</h3>
  <p>Entferne alle Figuren deines Gegners vom Spielfeld. Sobald ein Spieler keine Nodes, keine Pylone und keine Helden mehr auf dem Feld hat, verliert er die Partie, auch wenn er noch Nodes im Pot hat.</p>

  <h3>2 · Spielmaterial</h3>
  <p><b>Das Spielfeld</b> ist ein sechseckiges Netz aus 55 Punkten. Die Linien zeigen, welche Punkte benachbart sind. In der Mitte ist das Netz dicht (bis zu 6 Nachbarn), am Rand dünner (meist 4 Nachbarn). Figuren stehen immer auf Punkten und bewegen sich entlang der Linien.</p>
  <p><b>Die Figuren.</b> Deine Figuren sind orange, die deines Gegners blau. Es gibt drei Arten:</p>
  <div class="legend">
    <div class="lg">${mini('node')}<div><b>Node</b><br>Die Grundfigur. Jeder Spieler hat 15 Nodes, wer nicht beginnt 16.</div></div>
    <div class="lg">${mini('pylon')}<div><b>Pylon</b><br>Zwei aufeinandergestapelte Nodes. Stärker und schneller.</div></div>
    <div class="lg">${mini('hero', 'titan')}<div><b>Held</b><br>Ein verwandelter Pylon (2 Nodes) mit zwei Fähigkeiten.</div></div>
    <div class="lg">${opp}<div><b>Gegnerische Figuren</b><br>sind blau.</div></div>
  </div>
  <p><b>Pot und Stapel.</b> Der <b>Pot</b> ist dein Vorrat: Zu Beginn liegen dort alle 15 Nodes. Wird eine deiner Figuren entfernt, kommen ihre Nodes zuerst auf den <b>Stapel</b> und nach einer Pause zurück in den Pot. Nodes gehen also nie verloren. Beide Zahlen siehst du oben neben deinem Namen.</p>

  <h3>3 · Vorbereitung: Helden wählen</h3>
  <p>Vor der Partie wählt jeder Spieler geheim <b>3 Helden aus 10</b>. Derselbe Held darf <b>höchstens zweimal</b> in deinem Team sein, und beide Spieler dürfen dieselben Helden wählen. Jede Wahl ist ein Heldenplatz: Du kannst also höchstens 3 Helden gleichzeitig auf dem Feld haben.</p>
  <p>Im <b>Fortgeschrittenen-Modus</b> wählt jeder zusätzlich eine <b>Aura</b> (siehe Kapitel 11).</p>

  <h3>4 · Ablauf einer Runde</h3>
  <p>Die Spieler sind abwechselnd am Zug. Im Singleplayer entscheidet das Los, wer beginnt. Im Duell beginnt, wer den Raum erstellt hat. In deinem Zug hast du <b>2 Aktionen</b> (die zwei Punkte oben in der Mitte). <b>Ausgleich:</b> Wer nicht beginnt, startet mit <b>16 statt 15 Nodes</b> im Pot. Du darfst sie beliebig kombinieren, auch zweimal dieselbe Aktion. Sind beide Aktionen verbraucht, endet dein Zug automatisch. Du kannst ihn auch früher mit «Zug beenden» abschliessen.</p>

  <h3>5 · Die Aktionen</h3>
  <p><b>Legen (1 Aktion).</b> Nimm einen Node aus deinem Pot und lege ihn auf einen freien Punkt. Deinen <b>ersten Node</b> musst du an den <b>Rand</b> des Spielfelds legen. Danach darfst du nur noch auf Punkte legen, die durch eine Linie mit einer deiner Figuren verbunden sind. Erlaubte Punkte sind gestrichelt markiert.</p>
  <p><b>Stapeln (1 Aktion).</b> Lege einen Node aus dem Pot auf einen deiner Nodes. Daraus wird ein <b>Pylon</b>.</p>
  <p><b>Held rufen (1 Aktion, ab Runde ${E.HERO_ROUND}).</b> Verwandle einen deiner Pylone in einen Helden, dessen Heldenplatz gerade frei ist. Ein Held, der gerade zerstört wurde, muss eine Runde warten.</p>
  <p><b>Ziehen (1 Aktion).</b> Bewege eine Figur entlang der Linien auf einen freien Punkt:</p>
  <ul><li>Node: 1 Feld weit</li><li>Pylon: bis zu 3 Felder weit, nur über freie Punkte</li><li>Held: 1 Feld weit. Der Interceptor fliegt bis zu 3 Felder, auch über Figuren hinweg. Das Phantom springt auf ein beliebiges freies Feld.</li></ul>
  <p>Ausser Interceptor und Phantom springt keine Figur über andere. Energiewände und Drohnen können nicht ziehen.</p>
  <p><b>Fähigkeit einsetzen (1 oder 2 Aktionen).</b> Jeder Held hat zwei Fähigkeiten. Was sie kosten, steht auf dem Knopf. Fähigkeiten mit 2 Aktionen gehen nur, wenn du noch beide Aktionen hast.</p>
  <div class="box"><b>So bedienst du das Spiel:</b> Tippe auf einen markierten Punkt, um einen Node zu legen. Tippe auf eine eigene Figur, um sie auszuwählen: Dann siehst du, wohin sie ziehen kann, und unten erscheinen Knöpfe zum Stapeln, für Helden und für Fähigkeiten. Rot markierte Figuren sind mögliche Ziele eines Angriffs. Manche Fähigkeiten brauchen zwei oder drei Ziele nacheinander, der Hinweis unter dem Spielfeld sagt dir, was als Nächstes kommt.</div>

  <h3>6 · Die Aufbauphase</h3>
  <p>In <b>Runde 1 und 2</b> gibt es noch keine Helden und kein Einkreisen. Beide Spieler können sich in Ruhe ausbreiten. Ab Runde ${E.HERO_ROUND} gelten alle Regeln.</p>

  <h3>7 · Einkreisen</h3>
  <p>Deine <b>Nodes, Pylone, Energiewände und Drohnen</b> bilden zusammen Ketten. Helden gehören nicht zur Kette. Am Ende jedes Zuges wird geprüft, ob eine Kette zusammen mit dem Spielfeldrand ein Gebiet vom Rest des Feldes abschneidet.</p>
  <p><b>Es zählen nur die gezeichneten Linien.</b> Ein Gebiet ist abgeschlossen, wenn jede Linie, die aus dem Gebiet hinausführt, auf eine Figur deiner Kette trifft. Wo zwischen zwei Punkten keine Linie gezeichnet ist, gibt es auch keinen Weg hinaus. Die Kette selbst muss nicht zusammenhängen, und freie Punkte im Gebiet retten nichts.</p>
  <p>Ein abgeschlossenes Gebiet ist <b>eingekreist</b>, wenn es <b>höchstens ${E.ENC_MAX} Punkte</b> umfasst. Gezählt werden die Figuren darin und die freien Punkte zusammen. Grössere Gebiete gelten nicht als eingekreist, auch wenn sie abgeschnitten sind.</p>
  <div class="box"><b>Genau gesagt:</b> Das Spielfeld ist ein Graph aus Punkten und Linien. K sind die Punkte mit deinen Kettenfiguren (im 2 gegen 2 auch die deines Partners). Entfernt man K, zerfällt der Rest in zusammenhängende Gebiete. Ein Gebiet Z ist eingekreist, wenn |Z| ≤ ${E.ENC_MAX}. Springende Helden ändern daran nichts. Die Grenze muss von einem Spieler (bzw. einem Team) stammen: Orange und Violett zusammen kreisen nichts ein.</div>
  <p><b>Die Einkreisung schlägt am Ende des Zuges zu</b>, also erst, wenn der Spieler am Zug beide Aktionen gemacht oder seinen Zug beendet hat. Zuerst wird geprüft, was er selbst einkreist, danach die Ketten der anderen. Alle gegnerischen Figuren im eingekreisten Gebiet werden getroffen. Eigene Figuren (und im 2 gegen 2 die deines Partners) bleiben unberührt:</p>
  <ul><li><b>Node und Drohne:</b> werden entfernt.</li><li><b>Pylon:</b> verliert einen Node und wird zum Node.</li><li><b>Held:</b> verliert seine Kraft und wird zum Node. Er muss eine Runde warten, bevor du ihn wieder rufen kannst.</li></ul>
  <p><b>Zweiter Treffer.</b> Figuren, die einen Treffer als Node überlebt haben, bekommen einen gestrichelten roten Ring. Ihr Besitzer hat nun einen Zug Zeit, sie zu befreien. Sind sie danach immer noch eingeschlossen, werden sie am Ende des nächsten Zuges des Einkreisenden entfernt.</p>
  <div class="box"><b>Beispiel:</b> Ein blauer Pylon und ein blauer Node stehen in einer Ecke. Du schliesst mit deinem letzten Node die Kette. Am Ende deines Zuges gilt: Der Node verschwindet, der Pylon wird zum Node und bekommt einen roten Ring. Bricht Blau deine Kette in seinem Zug nicht auf, verschwindet auch dieser Node am Ende deines nächsten Zuges.</div>
  <div class="box"><b>Beispiel:</b> Eine blaue Kette schneidet in einer Ecke 7 Punkte ab, auf denen 2 deiner Nodes stehen. 7 ≤ ${E.ENC_MAX}: Am Ende des blauen Zuges sind deine Nodes eingekreist. Schneidet die Kette dagegen eine ganze Feldhälfte mit 25 Punkten ab, passiert nichts.</div>
  <p><b>Wer zieht, kreist zuerst ein</b> (wie bei Go). Schliessen sich durch eine Aktion Gebiete beider Spieler, wird zuerst geprüft, was der aktive Spieler einkreist.</p>
  <p><b>Vorsicht:</b> Legst oder ziehst du eine Figur in ein Gebiet, das dein Gegner bereits umschlossen hat, wird sie am Ende deines Zuges getroffen, ausser du brichst die Kette noch im selben Zug auf.</p>

  <h3>8 · Zerstören, Stapel und Rückkehr</h3>
  <p>Eine entfernte Figur gibt ihre Nodes auf deinen Stapel: ein Node 1, ein Pylon oder Held 2. Am Anfang deines übernächsten Zuges kommen sie zurück in deinen Pot. Ein zerstörter Held muss genauso lange warten, bevor du ihn wieder rufen kannst. Energiewände und Drohnen kosten keine Nodes und geben auch keine zurück.</p>

  <h3>9 · Schutz und Lähmung</h3>
  <p>Figuren mit einem <b>weissen gestrichelten Ring</b> sind geschützt (Energieschild oder Heldenschutz). Bis zum nächsten Zug ihres Besitzers können sie weder zerstört noch eingekreist, übernommen oder vom Gegner verschoben werden.</p>
  <p>Ein Held mit dem Zeichen <b>EMP</b> ist gelähmt, durch den EMP-Puls des Phantoms: In seinem nächsten Zug kann er weder ziehen noch Fähigkeiten einsetzen.</p>
  <p>Ein Held mit dem Zeichen <b>LOCK</b> ist im Lockdown des Wardens: In seinem nächsten Zug kann er ziehen, aber keine Fähigkeiten nutzen.</p>
  <p>Figuren direkt neben einem <b>Warden</b> stehen in seinem Schutzfeld und können nicht durch Fähigkeiten zerstört, übernommen oder verschoben werden. Du erkennst sie an einem feinen Ring mit kleinem Schild. Einkreisen und Minen wirken trotzdem.</p>

  <h3>10 · Besondere Figuren</h3>
  <p><b>Energiewand</b> (Warden): ein Quadrat in deiner Farbe. Sie zählt bis zu deinem nächsten Zug zu deiner Kette, blockiert den Weg und kann weder zerstört noch eingekreist werden.</p>
  <p><b>Drohne</b> (Schwarm): ein kleines Dreieck. Sie zählt zu deiner Kette, kostet keinen Node und kann nicht ziehen. Ein Treffer oder eine Einkreisung zerstört sie. Du kannst höchstens 2 gleichzeitig haben.</p>
  <p><b>Mine</b> (Saboteur): Deine eigenen Minen siehst du als gestricheltes ✕, die deines Gegners siehst du nicht. Landet eine gegnerische Figur durch Legen, Ziehen, Springen oder Tauschen auf einer Mine, wird sie zerstört. Höchstens 3 Minen gleichzeitig.</p>
  <p><b>Gehackter Held</b> (Hacker): Er erscheint in der Farbe seines neuen Herrn, mit einem gestrichelten Ring in der alten Farbe und einer grünen Zahl, die anzeigt, wie viele Züge er noch bleibt. Danach kehrt er zurück. Wird er vorher zerstört, verliert ihn sein ursprünglicher Besitzer.</p>

  <h3>11 · Die Helden</h3>
  <p>Ein «Feld» Entfernung heisst: ein Schritt entlang einer Linie. «In gerader Linie» heisst: immer in dieselbe Richtung des Netzes.</p>
  <div class="grid">${heroes}</div>

  <h3>12 · Fortgeschritten: Auren</h3>
  <p>Schaltest du vor der Partie <b>Fortgeschritten</b> ein, wählt jeder Spieler zu seinen 3 Helden eine <b>Aura</b>. Sie wirkt die ganze Partie und steht oben neben dem Namen.</p>
  <div class="grid">${E.AURA_IDS.map(a => `<div class="hcard"><div class="hn"><span class="badge aurab">${auraIcon}</span><h3 style="font-size:17px;margin:0;color:var(--text)">${E.AURAS[a].name}</h3></div><div class="ab">${E.AURAS[a].desc}</div></div>`).join('')}</div>

  <h3>13 · Spiel auf Zeit</h3>
  <p>Vor der Partie kannst du eine <b>Bedenkzeit</b> von 1 bis 20 Minuten pro Spieler einstellen, im Duell tut das, wer den Raum erstellt. Deine Uhr läuft nur, während du am Zug bist. Während Animationen steht sie still. Im Singleplayer läuft nur deine eigene Uhr.</p>
  <p>Läuft deine Zeit ab, endet die Partie sofort, und es werden die Figuren auf dem Feld gezählt: <b>Node 1 Punkt, Pylon 2 Punkte, Held 3 Punkte</b>. Wer mehr Punkte hat, gewinnt. Bei Gleichstand verliert, wessen Zeit abgelaufen ist.</p>

  <h3>14 · Spielende</h3>
  <p><b>Rundenlimit:</b> Nach der eingestellten Rundenzahl endet die Partie (10 bis 50 Runden, Standard ${E.ROUND_LIMIT}). Du stellst sie vor der Partie mit dem Regler «Runden» ein. Gezählt werden die Figuren auf dem Feld: <b>Node 1 Punkt, Pylon 2, Held 3</b>. Wer mehr Punkte hat, gewinnt, bei Gleichstand ist es unentschieden. Die aktuelle Runde siehst du oben in der Mitte.</p>
  <p>Die Partie endet sofort, wenn ein Spieler keine Figur mehr auf dem Feld hat. Sein Gegner gewinnt. Über das Menü (☰) kannst du auch aufgeben.</p>

  <h3>15 · Multiplayer</h3>
  <p>Im <b>Multiplayer</b> spielt jeder auf seinem eigenen Gerät. Es gibt zwei Spielarten:</p>
  <ul><li><b>3 Spieler, alle gegen alle:</b> Jeder spielt für sich, jeder hat 15 Nodes.</li>
  <li><b>2 gegen 2:</b> Zwei Teams. Die Teams sind abwechselnd am Zug (Team A, Team B, Team A, Team B). Jeder Spieler hat 12 Nodes.</li></ul>
  <p>Gespielt wird auf einem <b>grösseren Netz aus 85 Punkten</b>. Wer nicht als Erster am Zug ist, bekommt wie im Duell 1 Node mehr. Deine Figuren sind orange, die deines Partners gelb, die Gegner blau und violett.</p>
  <p><b>Ketten und Einkreisen.</b> Im 2 gegen 2 bilden du und dein Partner die Grenze <b>gemeinsam</b>: Eure Nodes, Pylone, Energiewände und Drohnen zählen zusammen als eine Kette. Bei 3 Spielern zählt nur die eigene Kette; eine Grenze aus Figuren zweier Gegner kreist nichts ein. Eingekreist werden <b>nur Gegner</b>. Deine eigenen Figuren und die deines Partners bleiben stehen, auch wenn sie in einem eingekreisten Gebiet stehen.</p>
  <p><b>Fähigkeiten</b> treffen nur Gegner. Minen zünden nur unter Gegnern, und dein Partner sieht deine Minen. Das Schutzfeld des Warden und das Energieschild schützen nur die eigenen Figuren.</p>
  <p><b>Ausscheiden und Sieg.</b> Wer keine Figur mehr auf dem Feld hat, scheidet aus und wird übersprungen. Ein Team ist erst draussen, wenn beide Spieler ausgeschieden sind. Es gewinnt, wer als Letzter (bzw. als letztes Team) übrig ist. Beim Rundenlimit und wenn eine Uhr abläuft, zählen die Punkte, im 2 gegen 2 pro Team zusammengezählt.</p>
  <p><b>Freie Plätze.</b> Wer den Raum erstellt, kann freie Plätze mit dem Computer besetzen. Vor der Heldenwahl kannst du auf einen freien Platz wechseln, zum Beispiel ins andere Team.</p>

  <h3>16 · Tipps</h3>
  <ul><li>Baue früh Pylone: Sie zählen zur Kette, ziehen weit und werden später zu Helden.</li>
  <li>Lass keine einzelnen Nodes am Rand stehen, sie sind leicht einzukreisen.</li>
  <li>Pylone und Helden überleben eine Einkreisung als Node. Befreie sie danach schnell, indem du die gegnerische Kette an ihrer schwächsten Stelle aufbrichst.</li>
  <li>Halte deine Helden hinter deinen Ketten, denn sie selbst schliessen keine Lücken.</li>
  <li>Achte auf die rot markierten Ziele, wenn du eine gegnerische Figur antippst: So siehst du, was dir droht.</li></ul>

  <h3>Kurzübersicht</h3>
  <div class="box"><b>Heldenwahl:</b> 3 Helden, derselbe höchstens zweimal (Fortgeschritten: plus 1 Aura)<br>
  <b>Pro Zug 2 Aktionen:</b> Legen · Stapeln · Held rufen · Ziehen · Fähigkeit<br>
  <b>Start:</b> erster Node an den Rand, danach nur neben eigene Figuren<br>
  <b>Runde 1–2:</b> keine Helden, kein Einkreisen<br>
  <b>Einkreisen:</b> Ketten aus Nodes, Pylonen, Energiewänden und Drohnen; nur gezeichnete Linien zählen; Gebiet höchstens ${E.ENC_MAX} Punkte<br>
  <b>Treffer (am Zugende):</b> Node und Drohne weg · Pylon und Held werden Node, im nächsten Zug weg, wenn nicht befreit<br>
  <b>Entfernt:</b> Nodes auf den Stapel, nach einer Runde Pause zurück in den Pot<br>
  <b>Sieg:</b> Der Gegner hat keine Figur mehr auf dem Feld, oder du hast nach der eingestellten Rundenzahl (10–50) mehr Punkte<br>
  <b>Ausgleich:</b> Der Nachzieher startet mit 16 Nodes<br>
  <b>Auf Zeit:</b> Läuft eine Uhr ab, gewinnt, wer mehr Punkte hat (Node 1 · Pylon 2 · Held 3)<br>
  <b>Multiplayer:</b> 3 Spieler alle gegen alle (15 Nodes) oder 2 gegen 2 (12 Nodes), 85 Punkte; Einkreisen trifft nur Gegner</div>
  <div style="height:28px"></div></div>`;
}
const backIcon = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>';
const menuIcon = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';

function lobbyScreen() {
  const back = `<div class="top"><button class="icon" data-act="leave" aria-label="Zurück">${backIcon}</button><h2>Duell</h2></div>`;
  if (G.code) {
    const ready = G.peers > 0;
    return `<div class="screen">${back}<div class="wait">
      <p class="muted" style="margin:0">Raumcode</p><div class="code">${esc(G.code)}</div>
      <p class="muted" style="margin:0 0 8px">Dein Gegner öffnet Nodes auf seinem Gerät, tippt auf «Duell» und gibt diesen Code ein.</p>
      ${G.net && G.net.shareUrl ? `<button class="btn small" data-act="share">Link teilen</button>` : ''}
      <p class="${ready ? '' : 'pulse'}" style="margin:8px 0 0">${ready ? 'Gegner verbunden' : G.net ? 'Warte auf Gegner …' : 'Verbinde …'}</p>
      <p class="status ${G.err ? 'err' : ''}">${esc(G.msg)}</p>
    </div></div>`;
  }
  return `<div class="screen">${back}
    <div class="stack" style="margin-top:6vh">
      ${clockPicker()}
      ${roundPicker()}
      ${advToggle()}
      <button class="btn primary" data-act="create">Raum erstellen</button>
      <p class="muted" style="text-align:center;margin:18px 0 4px">oder einem Raum beitreten</p>
      <label for="codein">Raumcode</label>
      <input id="codein" class="codein" maxlength="4" autocomplete="off" autocapitalize="characters" inputmode="text">
      <button class="btn" data-act="join">Beitreten</button>
      <p class="status ${G.err ? 'err' : ''}">${esc(G.msg)}</p>
    </div></div>`;
}

function mlobbyScreen() {
  const back = `<div class="top"><button class="icon" data-act="leave" aria-label="Zurück">${backIcon}</button><h2>Multiplayer</h2></div>`;
  if (!G.code) {
    return `<div class="screen">${back}
    <div class="stack" style="margin-top:3vh">
      <div class="clockset"><span style="font-size:15px"><b>Spielart</b></span><div class="seg" style="grid-template-columns:repeat(2,minmax(0,1fr))" role="radiogroup" aria-label="Spielart">
        <button class="segbtn ${G.mn === 3 ? 'on' : ''}" role="radio" aria-checked="${G.mn === 3}" data-act="mmode" data-n="3">3 Spieler</button>
        <button class="segbtn ${G.mn === 4 ? 'on' : ''}" role="radio" aria-checked="${G.mn === 4}" data-act="mmode" data-n="4">2 gegen 2</button></div>
        <div class="muted" style="font-size:13px">${G.mn === 3 ? 'Alle gegen alle, je 15 Nodes.' : 'Zwei Teams, je 12 Nodes pro Spieler.'}</div></div>
      <div class="clockset"><label for="namein"><b>Dein Name</b></label><input id="namein" class="namein" maxlength="14" autocomplete="nickname" value="${esc(G.name)}" placeholder="z. B. Benjamin"></div>
      ${clockPicker()}
      ${roundPicker()}
      ${advToggle()}
      <button class="btn primary" data-act="mcreate">Raum erstellen</button>
      <p class="muted" style="text-align:center;margin:18px 0 4px">oder einem Raum beitreten</p>
      <label for="codein">Raumcode</label>
      <input id="codein" class="codein" maxlength="4" autocomplete="off" autocapitalize="characters" inputmode="text">
      <button class="btn" data-act="mjoin">Beitreten</button>
      <p class="status ${G.err ? 'err' : ''}">${esc(G.msg)}</p>
    </div></div>`;
  }
  const s = G.state;
  if (!s || !s.seated) {
    return `<div class="screen">${back}<div class="wait"><p class="muted" style="margin:0">Raumcode</p><div class="code">${esc(G.code)}</div>
      <p class="pulse">${G.net ? 'Verbinde mit dem Raum …' : 'Verbinde …'}</p><p class="status ${G.err ? 'err' : ''}">${esc(G.msg)}</p></div></div>`;
  }
  const host = G.me === 0;
  const canMove = G.me >= 0 && !s.picks[G.me];
  const row = k => {
    const who = s.seated[k];
    const btns = [];
    if (who === null) {
      if (canMove) btns.push(`<button class="btn small" data-act="seatTo" data-k="${k}">Hierhin</button>`);
      if (host) btns.push(`<button class="btn small" data-act="addBot" data-k="${k}">+ Computer</button>`);
    } else if (who === 'bot' && host) btns.push(`<button class="btn small" data-act="rmBot" data-k="${k}">Entfernen</button>`);
    const st = who === null ? 'frei' : s.picks[k] ? 'bereit' : who === 'bot' ? 'wählt …' : k === G.me ? 'wählt Helden' : isOnline(k) ? 'wählt Helden …' : 'nicht verbunden';
    return `<div class="seat" style="--pc:${who ? col(k) : 'var(--line2)'}"><span class="sd" aria-hidden="true"></span><div class="sn"><b>${who ? esc(nameOf(k)) + (k === 0 ? ' <small style="display:inline">· Gastgeber</small>' : '') : 'Freier Platz'}</b><small>${st}</small></div><div class="sb">${btns.join('')}</div></div>`;
  };
  const seats = s.mode === 'team'
    ? [0, 1].map(t => `<div class="teamh">Team ${'AB'[t]}${G.me >= 0 && E.teamOf(s, G.me) === t ? ' · dein Team' : ''}</div>` + [0, 1, 2, 3].filter(k => s.team[k] === t).map(row).join('')).join('')
    : [0, 1, 2].map(row).join('');
  const bots = s.seated.includes('bot');
  let foot;
  if (G.me < 0) foot = s.seated.includes(null) ? '<p class="pulse">Du wirst gleich eingesetzt …</p>' : '<p class="muted">Der Raum ist voll. Du schaust zu.</p>';
  else if (!s.picks[G.me]) foot = '<button class="btn primary" data-act="toPick">Helden wählen</button>';
  else foot = `<p class="pulse">${s.seated.includes(null) ? 'Warte, bis alle Plätze besetzt sind …' : 'Warte, bis alle ihre Helden gewählt haben …'}</p>`;
  return `<div class="screen">${back}
    <div class="stack" style="margin-top:2vh">
      <div style="text-align:center"><p class="muted" style="margin:0">Raumcode</p><div class="code" style="margin:6px 0 4px">${esc(G.code)}</div>
      <p class="muted" style="margin:0 0 8px;font-size:14px">Die anderen öffnen Nodes, tippen auf «Multiplayer» und geben diesen Code ein.</p>
      ${G.net && G.net.shareUrl ? `<button class="btn small" data-act="share">Link teilen</button>` : ''}</div>
      <p class="muted" style="margin:8px 0 0;font-size:13px;text-align:center">${s.mode === 'team' ? '2 gegen 2' : '3 Spieler, alle gegen alle'} · ${E.limitOf(s)} Runden · Uhr: ${s.clock ? clockLabel(s.clock.minutes) : 'Aus'} · Aura: ${s.adv ? 'Ein' : 'Aus'}</p>
      ${seats}
      ${host && bots ? `<div class="clockset"><span style="font-size:15px">Computer</span><div class="seg" role="radiogroup" aria-label="Spielstufe">${Object.entries(LEVELS).map(([k, v]) => `<button class="segbtn ${G.level === k ? 'on' : ''}" role="radio" aria-checked="${G.level === k}" data-act="level" data-l="${k}">${v}</button>`).join('')}</div></div>` : ''}
      ${foot}
      <p class="status ${G.err ? 'err' : ''}">${esc(G.msg)}</p>
    </div></div>`;
}

function pickScreen() {
  const st = G.state;
  const done = st && st.picks[G.me];
  if (done && isMulti()) return mlobbyScreen();
  if (done) {
    return `<div class="screen"><div class="wait"><h2>Helden gewählt</h2>
    <p class="muted">${st.picks[G.me].map(h => E.HEROES[h].name).join(' · ')}${st.auras[G.me] ? ' · Aura: ' + E.AURAS[st.auras[G.me]].name : ''}</p>
    <p class="pulse">Warte auf deinen Gegner …</p></div></div>`;
  }
  const adv = G.mode === 'single' ? G.adv : !!(st && st.adv);
  const n = G.picks.length;
  const ready = n === 3 && (!adv || G.aura);
  const count = h => G.picks.filter(x => x === h).length;
  const settings = G.mode === 'single'
    ? `<div class="clockset"><span style="font-size:15px">Computer</span><div class="seg" role="radiogroup" aria-label="Spielstufe">${Object.entries(LEVELS).map(([k, v]) => `<button class="segbtn ${G.level === k ? 'on' : ''}" role="radio" aria-checked="${G.level === k}" data-act="level" data-l="${k}">${v}</button>`).join('')}</div></div>` + clockPicker() + roundPicker() + advToggle()
    : `<p class="muted" style="margin:0 0 12px">${E.limitOf(st)} Runden · Uhr: ${st && st.clock ? clockLabel(st.clock.minutes) : 'Aus'} · Aura: ${adv ? 'Ein' : 'Aus'}</p>`;
  const chosen = `<div class="chosen">${[0, 1, 2].map(k => G.picks[k] ? `<span class="slot on">${heroIcon(G.picks[k], 16)} ${E.HEROES[G.picks[k]].name}</span>` : '<span class="slot">frei</span>').join('')}${adv ? (G.aura ? `<span class="slot on aura">${E.AURAS[G.aura].name}</span>` : '<span class="slot aura">Aura</span>') : ''}</div>`;
  const auraList = adv ? `<h3 class="sect">Aura wählen</h3><div class="grid">${E.AURA_IDS.map(a => `<button class="cardbtn ${G.aura === a ? 'on' : ''}" data-act="aura" data-a="${a}" aria-pressed="${G.aura === a}"><div class="hn"><span class="badge aurab">${auraIcon}</span><h3 style="font-size:17px">${E.AURAS[a].name}</h3></div><div class="ab">${E.AURAS[a].desc}</div></button>`).join('')}</div>` : '';
  return `<div class="screen">
  <div class="top"><button class="icon" data-act="${isMulti() ? 'toLobby' : 'leave'}" aria-label="Zurück">${backIcon}</button><h2>Wähle 3 Helden</h2><span class="muted" style="margin-left:auto">${n}/3</span></div>
  ${settings}
  <div class="grid">${E.HERO_IDS.map(h => `<button class="cardbtn ${count(h) ? 'on' : ''}" data-act="toggle" data-h="${h}" aria-pressed="${count(h) > 0}">${count(h) ? `<span class="cnt">×${count(h)}</span>` : ''}${heroCard(h)}</button>`).join('')}</div>
  ${auraList}
  <div style="position:sticky;bottom:0;padding:14px 0 6px;background:linear-gradient(transparent,var(--bg) 25%)">
  ${chosen}
  <div class="row"><button class="btn" data-act="randomPick" style="flex:0 1 40%">${diceIcon} Zufall</button><button class="btn primary" data-act="confirmPick" style="flex:1 1 55%" ${ready ? '' : 'disabled'}>Los geht's</button></div></div></div>`;
}
const diceIcon = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" style="vertical-align:-3px"><rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1.3" fill="currentColor"/><circle cx="15" cy="15" r="1.3" fill="currentColor"/><circle cx="15" cy="9" r="1.3" fill="currentColor"/><circle cx="9" cy="15" r="1.3" fill="currentColor"/></svg>';
const auraIcon = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3.5"/><circle cx="12" cy="12" r="8" stroke-dasharray="3 3"/></svg>';

// ---------- Spielfeld ----------
const HALO = PAL.map((c, k) => `<radialGradient id="halo${k}"><stop offset="0" stop-color="${c}" stop-opacity=".55"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`).join('');
const halo = (p, x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#halo${colIdx(p)})"/>`;
function pieceSvg(c, x, y) {
  const cc = col(c.p);
  if (c.k === 'wall') return `<rect x="${x - 12}" y="${y - 12}" width="24" height="24" rx="5" fill="${cc}" fill-opacity=".18" stroke="${cc}" stroke-width="2.5"/><path d="M${x - 8} ${y - 3}h16M${x - 8} ${y + 4}h16M${x - 2} ${y - 11}v8M${x + 3} ${y - 3}v7" stroke="${cc}" stroke-width="1.5"/>`;
  if (c.k === 'drone') return halo(c.p, x, y, 15) + `<polygon points="${x},${y - 10} ${x + 9},${y + 7} ${x - 9},${y + 7}" fill="${cc}"/><circle cx="${x}" cy="${y + 2}" r="2.2" fill="#0B1020"/>`;
  if (c.k === 'node') return halo(c.p, x, y, 15) + shape(c.p, x, y, 8.5, cc);
  if (c.k === 'pylon') return halo(c.p, x, y, 21) + shape(c.p, x, y, 13, 'none', cc, 2.5) + shape(c.p, x, y, 7.5, cc);
  let o = halo(c.p, x, y, 27) + shape(c.p, x, y, 16, cc) + iconAt(c.h, x, y, 19);
  if (c.as) o += `<circle cx="${x + 15}" cy="${y + 15}" r="8" fill="#151C33" stroke="${cc}" stroke-width="1.5"/>` + iconAt(c.as, x + 15, y + 15, 10, cc);
  if (c.orig) o += `<circle cx="${x}" cy="${y}" r="19.5" fill="none" stroke="${col(c.orig.p)}" stroke-width="2" stroke-dasharray="3 3"/><circle cx="${x - 15}" cy="${y - 15}" r="8" fill="#5CFF9D"/><text x="${x - 15}" y="${y - 11.5}" text-anchor="middle" font-size="10" font-weight="700" fill="#06210F">${Math.max(1, (c.hack || 1) - 1)}</text>`;
  return o;
}
const P = i => B.points[i];

function boardSvg() {
  const s = G.state;
  const { minx, miny, w, h } = VIEW;
  const my = isMyTurn();
  const tgt = new Set(), atk = new Set();
  if (my && G.pending) G.pending.targets.forEach(i => (s.cells[i] ? atk : tgt).add(i));
  else if (my && G.sel === null) E.placeTargets(s, G.me).forEach(i => tgt.add(i));
  const now = performance.now();
  let o = `<svg role="img" aria-label="Spielfeld" viewBox="${minx} ${miny} ${w} ${h}"><defs>${HALO}</defs>`;
  B.edges.forEach(([a, b]) => { const A = B.points[a], C = B.points[b]; o += `<line x1="${A.x}" y1="${A.y}" x2="${C.x}" y2="${C.y}" stroke="#34446F" stroke-width="1.6" stroke-linecap="round"/>`; });
  B.points.forEach((pt, i) => { if (!s.cells[i] || (FX.hide.get(i) || 0) > now) o += `<circle cx="${pt.x}" cy="${pt.y}" r="3.2" fill="#7F8FBF"/>`; });
  (s.mines || []).filter(m => G.me >= 0 && !E.foe(s, m.p, G.me) && !s.cells[m.at]).forEach(m => { const pt = B.points[m.at]; o += `<g aria-label="${m.p === G.me ? 'Deine Mine' : 'Mine deines Partners'}"><circle cx="${pt.x}" cy="${pt.y}" r="8" fill="none" stroke="${col(m.p)}" stroke-width="1.5" stroke-dasharray="2 2"/><path d="M${pt.x - 4} ${pt.y - 4}l8 8M${pt.x + 4} ${pt.y - 4}l-8 8" stroke="${col(m.p)}" stroke-width="1.6"/></g>`; });
  tgt.forEach(i => { const pt = B.points[i]; o += `<circle cx="${pt.x}" cy="${pt.y}" r="10" fill="none" stroke="${ME_COL}" stroke-width="2" stroke-dasharray="3 3"/>`; });
  s.cells.forEach((c, i) => {
    if (!c || (FX.hide.get(i) || 0) > now) return;
    const { x, y } = B.points[i];
    if (G.sel === i) o += `<circle cx="${x}" cy="${y}" r="22" fill="none" stroke="${col(c.p)}" stroke-width="2"/>`;
    if (c.k !== 'wall' && !(c.k === 'hero' && c.h === 'warden') && E.isGuarded(s, i)) o += `<circle cx="${x}" cy="${y}" r="${c.k === 'hero' ? 21 : c.k === 'pylon' ? 17 : 13.5}" fill="none" stroke="${col(c.p)}" stroke-width="1.5" stroke-opacity=".75"/><path d="M${x + 9} ${y - 15.5}l3.2 1.3v2.4c0 2.1-1.4 3.6-3.2 4.4-1.8-.8-3.2-2.3-3.2-4.4v-2.4z" fill="${col(c.p)}" stroke="#0B1020" stroke-width=".8"/>`;
    if (c.enc) o += `<circle cx="${x}" cy="${y}" r="12.5" fill="none" stroke="#FF5C7A" stroke-width="2" stroke-dasharray="3 2"/>`;
    if (c.prot || c.hprot) o += `<circle cx="${x}" cy="${y}" r="${c.k === 'hero' ? 23 : 17}" fill="none" stroke="#E8ECF8" stroke-width="1.5" stroke-dasharray="2 3"/>`;
    o += pieceSvg(c, x, y);
    if (c.stun) o += `<text x="${x}" y="${y - 21}" text-anchor="middle" font-size="10" font-weight="700" fill="#B9A7FF">EMP</text>`;
    else if (c.lock) o += `<text x="${x}" y="${y - 21}" text-anchor="middle" font-size="10" font-weight="700" fill="#FFB347">LOCK</text>`;
    if (atk.has(i)) o += `<circle cx="${x}" cy="${y}" r="20" fill="none" stroke="${c.p === G.me ? ME_COL : '#FF6B81'}" stroke-width="2.5" stroke-dasharray="4 3"/>`;
  });
  B.points.forEach((pt, i) => { o += `<circle cx="${pt.x}" cy="${pt.y}" r="17" fill="transparent" data-act="cell" data-i="${i}"/>`; });
  return o + '</svg>';
}

// ---------- Effekte: eigene Ebene über dem Spielfeld, gesteuert vom Browser (Web Animations) ----------
const NS = 'http://www.w3.org/2000/svg';
const FX = { svg: null, hide: new Map(), timer: null, end: 0, lock: 0 };
function fxSvg() {
  if (!FX.svg) {
    FX.svg = document.createElementNS(NS, 'svg');
    FX.svg.setAttribute('aria-hidden', 'true');
    syncBoard();
    FX.svg.setAttribute('viewBox', `${VIEW.minx} ${VIEW.miny} ${VIEW.w} ${VIEW.h}`);
    FX.svg.style.cssText = 'position:absolute;pointer-events:none;overflow:visible;z-index:4';
    FX.svg.innerHTML = `<defs>${HALO}<radialGradient id="flash"><stop offset="0" stop-color="#fff"/><stop offset=".4" stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>`;
    document.body.appendChild(FX.svg);
  }
  return FX.svg;
}
function syncFx() {
  if (!FX.svg) return;
  const board = document.querySelector('.boardwrap svg');
  if (!board || G.screen !== 'game') { FX.svg.style.display = 'none'; return; }
  const r = board.getBoundingClientRect();
  Object.assign(FX.svg.style, { display: 'block', left: r.left + scrollX + 'px', top: r.top + scrollY + 'px', width: r.width + 'px', height: r.height + 'px' });
}
addEventListener('resize', syncFx);

const mk = (tag, attrs, parent, html) => {
  const el = document.createElementNS(NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  if (html) el.innerHTML = html;
  (parent || fxSvg()).appendChild(el);
  return el;
};
const EASE = { out: 'cubic-bezier(.2,.8,.3,1)', in: 'cubic-bezier(.6,0,.85,.4)', io: 'cubic-bezier(.6,0,.3,1)', back: 'cubic-bezier(.3,1.6,.5,1)' };
// Animiert ein Element und entfernt es danach. Gibt die Endzeit (ms) zurück.
// Alle Animationen laufen RATE-mal schneller als ihre Entwurfszeiten (Einspieler: 0,5 s)
const RATE = 2.6;
function A(el, frames, duration, delay = 0, easing = EASE.out, keep = false) {
  const an = el.animate(frames, { duration: duration / RATE, delay: delay / RATE, easing, fill: 'both' });
  if (!keep) an.onfinish = () => el.remove();
  return delay + duration;
}
const tr = (x, y, s = 1, rot = 0) => `translate(${x}px,${y}px) rotate(${rot}deg) scale(${s})`;
// Figur als bewegliche Gruppe, gezeichnet um (0,0)
const ghost = (c, x, y) => { const g = mk('g', {}, null, pieceSvg(c, 0, 0)); g.style.transform = tr(x, y); return g; };
const ring = (x, y, color, r0, r1, dur, delay = 0, w = 3) => {
  const c = mk('circle', { cx: 0, cy: 0, r: 10, fill: 'none', stroke: color, 'stroke-width': w * 10 / r1 });
  return A(c, [{ transform: tr(x, y, r0 / 10), opacity: 1 }, { transform: tr(x, y, r1 / 10), opacity: 0 }], dur, delay);
};
const flash = (x, y, r, dur = 350, delay = 0) => {
  const c = mk('circle', { cx: 0, cy: 0, r: 10, fill: 'url(#flash)' });
  return A(c, [{ transform: tr(x, y, 0.2), opacity: 1 }, { transform: tr(x, y, r / 10), opacity: 0 }], dur, delay);
};
function shards(x, y, color, n = 12, dist = 46, delay = 0, dur = 650) {
  let end = 0;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + Math.random() * 0.5, d = dist * (0.6 + Math.random() * 0.6);
    const c = mk('circle', { cx: 0, cy: 0, r: 2 + Math.random() * 2.2, fill: k % 3 ? color : '#fff' });
    end = Math.max(end, A(c, [{ transform: tr(x, y), opacity: 1 }, { transform: tr(x + Math.cos(a) * d, y + Math.sin(a) * d, 0.3), opacity: 0 }], dur * (0.8 + Math.random() * 0.4), delay, EASE.out));
  }
  return end;
}
function beam(a, b, color, w, dur, delay = 0) {
  const l = mk('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: color, 'stroke-linecap': 'round', 'stroke-width': w });
  return A(l, [{ opacity: 0, strokeWidth: w * 0.2 }, { opacity: 1, strokeWidth: w, offset: 0.2 }, { opacity: 0, strokeWidth: w * 0.3 }], dur, delay);
}
function shake(strength = 5, delay = 0) {
  const fr = [0, 1, 2, 3, 4, 5].map(k => ({ transform: k === 5 ? 'none' : `translate(${(Math.random() - 0.5) * strength * 2}px,${(Math.random() - 0.5) * strength * 2}px)` }));
  for (const el of [document.querySelector('.boardwrap'), FX.svg]) if (el) el.animate(fr, { duration: 320 / RATE, delay: delay / RATE, easing: 'linear' });
}
// rel: Entwurfszeit ab jetzt, bis die Figur auf dem Spielfeld wieder sichtbar ist
const hideCell = (i, rel) => { const until = performance.now() + rel / RATE; FX.hide.set(i, Math.max(FX.hide.get(i) || 0, until)); };

// Zerstörung: Blitz, Splitter, Schockwelle
function boom(f, t) {
  const { x, y } = P(f.at), c = col(f.p), big = f.unit !== 'node';
  const g = ghost({ p: f.p, k: f.unit, h: f.h }, x, y);
  A(g, [{ transform: tr(x, y), opacity: 1 }, { transform: tr(x, y, 1.35), opacity: 1, offset: 0.3 }, { transform: tr(x, y, 0), opacity: 0 }], 420, t, EASE.in);
  flash(x, y, big ? 46 : 32, 380, t + 120);
  ring(x, y, '#fff', 8, big ? 70 : 48, 600, t + 130, 4);
  ring(x, y, c, 8, big ? 56 : 38, 650, t + 200, 3);
  if (big) shake(4, t + 130);
  return shards(x, y, c, big ? 16 : 10, big ? 60 : 42, t + 130);
}

// Einkreisen: Ein grosser Kreis zieht sich zusammen und verschlingt die Figuren
function swallow(f, t) {
  const pts = f.area.map(P);
  const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length, cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  const R = Math.max(...pts.map(p => Math.hypot(p.x - cx, p.y - cy))) + 50;
  const c = col(f.p), D = 1300;
  const disc = mk('circle', { cx: 0, cy: 0, r: 10, fill: c, 'fill-opacity': '.14', stroke: c, 'stroke-width': 0.35 });
  A(disc, [{ transform: tr(cx, cy, R * 1.6 / 10), opacity: 0 }, { transform: tr(cx, cy, R / 10), opacity: 1, offset: 0.2 }, { transform: tr(cx, cy, 0), opacity: 1 }], D, t, EASE.in);
  const dash = mk('circle', { cx: 0, cy: 0, r: 10, fill: 'none', stroke: '#fff', 'stroke-width': 0.2, 'stroke-dasharray': '1.2 1.6', opacity: 0.8 });
  A(dash, [{ transform: tr(cx, cy, R * 1.25 / 10, 0), opacity: 0 }, { transform: tr(cx, cy, R * 1.05 / 10, 60), opacity: 0.9, offset: 0.2 }, { transform: tr(cx, cy, 0, 300), opacity: 0.9 }], D, t, EASE.in);
  const hit = t + D;
  f.got.forEach((gp, k) => {
    const { x, y } = P(gp.at);
    if (gp.eff === 'stun') {
      for (let r = 0; r < 3; r++) ring(x, y, '#B9A7FF', 10, 46, 600, hit - 200 + r * 150, 3);
      return;
    }
    const g = gp.eff === 'downgrade' && gp.unit === 'pylon'
      ? mk('g', {}, null, `<circle r="13" fill="none" stroke="${col(gp.p)}" stroke-width="2.5"/>`)
      : ghost({ p: gp.p, k: gp.unit, h: gp.h }, x, y);
    g.style.transform = tr(x, y);
    A(g, [{ transform: tr(x, y) }, { transform: tr(x, y, 1.15), offset: 0.3 }, { transform: tr(cx, cy, 0, 180), opacity: 0.6 }], D, t, EASE.in);
  });
  flash(cx, cy, 70, 450, hit - 60);
  ring(cx, cy, '#fff', 10, R + 60, 750, hit - 40, 5);
  ring(cx, cy, c, 10, R + 30, 800, hit + 60, 4);
  shake(7, hit - 40);
  return shards(cx, cy, c, 22, R * 0.9 + 30, hit - 40, 800);
}

// Fähigkeiten. Gibt [Ende, Einschlagzeit] zurück.
function abilityFx(f, t, st) {
  const c = col(f.p), A0 = P(f.from), T = f.to !== null ? P(f.to) : null;
  switch (f.h + ':' + f.kind) {
    case 'titan:n': {
      const dx = T.x - A0.x, dy = T.y - A0.y, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
      const path = mk('path', { d: `M${T.x + nx * 28 - dx * 0.4} ${T.y + ny * 28 - dy * 0.4} Q${T.x + dx * 0.25} ${T.y + dy * 0.25} ${T.x - nx * 28 - dx * 0.4} ${T.y - ny * 28 - dy * 0.4}`, fill: 'none', stroke: '#fff', 'stroke-width': 6, 'stroke-linecap': 'round', pathLength: 100, 'stroke-dasharray': 100 });
      A(path, [{ strokeDashoffset: 100, opacity: 1 }, { strokeDashoffset: 0, opacity: 1, offset: 0.5 }, { strokeDashoffset: -100, opacity: 0 }], 420, t, EASE.out);
      ring(A0.x, A0.y, c, 18, 30, 300, t);
      return [t + 420, t + 160];
    }
    case 'ingenieur:s': {
      [f.to, f.to2].filter(x => x !== null && x !== undefined).forEach((k, n) => {
        const Bx = P(k);
        const g = ghost({ p: f.p, k: 'node' }, A0.x, A0.y);
        A(g, [{ transform: tr(A0.x, A0.y, 0.4), opacity: 0 }, { transform: tr((A0.x + Bx.x) / 2, (A0.y + Bx.y) / 2 - 16, 1.1), opacity: 1, offset: 0.5 }, { transform: tr(Bx.x, Bx.y, 1), opacity: 1 }], 420, t + n * 90, EASE.io);
        ring(Bx.x, Bx.y, c, 6, 34, 450, t + 400 + n * 90, 2.5);
        hideCell(k, t + 420 + n * 90);
      });
      return [t + 700, t];
    }
    case 'warden:n': {
      const g = ghost({ p: f.p, k: 'wall' }, T.x, T.y);
      A(g, [{ transform: tr(T.x, T.y - 30, 0.3), opacity: 0 }, { transform: tr(T.x, T.y, 1.2), opacity: 1, offset: 0.6 }, { transform: tr(T.x, T.y, 1), opacity: 1 }], 420, t, EASE.back);
      ring(T.x, T.y, c, 8, 44, 550, t + 200, 3);
      hideCell(f.to, t + 420);
      return [t + 650, t];
    }
    case 'warden:s': {
      (f.hit || []).forEach((j, k) => { const H_ = P(j); ring(H_.x, H_.y, '#FFB347', 50, 20, 500, t + k * 80, 3); flash(H_.x, H_.y, 26, 300, t + 300 + k * 80); });
      ring(A0.x, A0.y, c, 10, 90, 700, t, 3);
      return [t + 800, t];
    }
    case 'saboteur:n': {
      if (G.me < 0 || E.foe(G.state, f.p, G.me)) return [t + 200, t];   // verdeckt: Gegner sehen nichts
      ring(T.x, T.y, c, 22, 8, 400, t, 2);
      return [t + 450, t];
    }
    case 'saboteur:s': {
      const T2 = f.to2 !== null ? P(f.to2) : null;
      const l = mk('line', { x1: A0.x, y1: A0.y, x2: T.x, y2: T.y, stroke: '#FF6B4A', 'stroke-width': 4, 'stroke-linecap': 'round' });
      A(l, [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0 }], 350, t);
      if (T2) { const l2 = mk('line', { x1: T.x, y1: T.y, x2: T2.x, y2: T2.y, stroke: '#FF6B4A', 'stroke-width': 4, 'stroke-linecap': 'round' }); A(l2, [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0 }], 350, t + 200); }
      return [t + 600, t + 150];
    }
    case 'schwarm:n': {
      const g = ghost({ p: f.p, k: 'drone' }, A0.x, A0.y);
      A(g, [{ transform: tr(A0.x, A0.y, 0.3) }, { transform: tr(T.x, T.y, 1.2), offset: 0.7 }, { transform: tr(T.x, T.y, 1) }], 380, t, EASE.io);
      ring(T.x, T.y, c, 6, 32, 450, t + 300, 2.5);
      hideCell(f.to, t + 380);
      return [t + 700, t];
    }
    case 'schwarm:s': {
      (f.drones || []).forEach((d, k) => { const Dp = P(d); flash(Dp.x, Dp.y, 50, 400, t + k * 60); ring(Dp.x, Dp.y, '#fff', 8, 56, 550, t + k * 60, 4); shards(Dp.x, Dp.y, c, 12, 50, t + k * 60, 600); });
      shake(6, t);
      return [t + 750, t + 80];
    }
    case 'titan:s': {
      const R = 40;
      const hex = mk('polygon', { points: [0, 1, 2, 3, 4, 5].map(k => `${(Math.cos(Math.PI / 3 * k + Math.PI / 6) * 10).toFixed(2)},${(Math.sin(Math.PI / 3 * k + Math.PI / 6) * 10).toFixed(2)}`).join(' '), fill: c, 'fill-opacity': '.16', stroke: '#fff', 'stroke-width': 0.35, 'stroke-linejoin': 'round' });
      A(hex, [{ transform: tr(A0.x, A0.y, 0.2, -30), opacity: 0 }, { transform: tr(A0.x, A0.y, R * 1.12 / 10, 0), opacity: 1, offset: 0.35 }, { transform: tr(A0.x, A0.y, R / 10, 0), opacity: 1, offset: 0.6 }, { transform: tr(A0.x, A0.y, R / 10, 0), opacity: 0 }], 1000, t, EASE.back);
      ring(A0.x, A0.y, c, 10, R + 20, 700, t + 150, 4);
      return [t + 1000, t];
    }
    case 'sniper:n': {
      const dot = mk('circle', { cx: 0, cy: 0, r: 10, fill: '#fff' });
      A(dot, [{ transform: tr(A0.x, A0.y, 0.1) }, { transform: tr(A0.x, A0.y, 0.9) }, { transform: tr(A0.x, A0.y, 0.2), opacity: 0 }], 380, t, EASE.in);
      ring(A0.x, A0.y, c, 30, 6, 260, t, 2);
      beam(A0, T, c, 10, 420, t + 260);
      beam(A0, T, '#fff', 3.5, 380, t + 270);
      shards(T.x, T.y, '#fff', 6, 24, t + 300, 350);
      return [t + 700, t + 300];
    }
    case 'sniper:s': {
      const cross = mk('g', {}, null, `<circle r="14" fill="none" stroke="${c}" stroke-width="2"/><path d="M0-22v10M0 12v10M-22 0h10M12 0h10" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`);
      A(cross, [{ transform: tr(T.x, T.y, 2.4, -90), opacity: 0 }, { transform: tr(T.x, T.y, 1, 0), opacity: 1, offset: 0.6 }, { transform: tr(T.x, T.y, 0.8, 0), opacity: 0 }], 600, t, EASE.out);
      const top = { x: T.x, y: VIEW.miny - 40 };
      beam(top, T, c, 34, 520, t + 480);
      beam(top, T, '#fff', 12, 480, t + 490);
      flash(T.x, T.y, 60, 450, t + 520);
      ring(T.x, T.y, c, 10, 90, 750, t + 540, 5);
      shake(8, t + 520);
      return [t + 1100, t + 540];
    }
    case 'interceptor:n': case 'interceptor:s': {
      const cell = st.cells[f.to];
      const dur = 300;
      for (let k = 1; k <= 4; k++) {
        const g = ghost(cell, A0.x, A0.y);
        g.style.opacity = 0;
        const fx = A0.x + (T.x - A0.x) * k / 5, fy = A0.y + (T.y - A0.y) * k / 5;
        A(g, [{ transform: tr(fx, fy, 0.9), opacity: 0.5 }, { transform: tr(fx, fy, 0.6), opacity: 0 }], 360, t + dur * k / 5, EASE.out);
      }
      const g = ghost(cell, A0.x, A0.y);
      A(g, [{ transform: tr(A0.x, A0.y, 1) }, { transform: tr((A0.x + T.x) / 2, (A0.y + T.y) / 2, 1.25), offset: 0.5 }, { transform: tr(T.x, T.y, 1) }], dur, t, EASE.io);
      hideCell(f.to, t + dur);
      return [t + dur, t + dur - 30];
    }
    case 'phantom:n': {
      const U = P(f.to), D2 = P(f.to2), cell = st.cells[f.to2];
      if (!cell) return [t + 300, t];
      const g = ghost(cell, U.x, U.y);
      A(g, [{ transform: tr(U.x, U.y, 1), opacity: 1 }, { transform: tr(U.x, U.y, 0.1, 180), opacity: 0 }], 320, t, EASE.in);
      shards(U.x, U.y, c, 10, 34, t, 420);
      const g2 = ghost(cell, D2.x, D2.y);
      A(g2, [{ transform: tr(D2.x, D2.y, 0, -180), opacity: 0 }, { transform: tr(D2.x, D2.y, 1.3, 0), opacity: 1, offset: 0.7 }, { transform: tr(D2.x, D2.y, 1, 0), opacity: 1 }], 380, t + 330, EASE.out);
      ring(D2.x, D2.y, c, 6, 46, 500, t + 330, 3);
      hideCell(f.to2, t + 710);
      return [t + 720, t];
    }
    case 'phantom:old': {
      const cell = st.cells[f.to];
      const g = ghost(cell, A0.x, A0.y);
      A(g, [{ transform: tr(A0.x, A0.y, 1), opacity: 1 }, { transform: tr(A0.x, A0.y, 0.1, 180), opacity: 0 }], 320, t, EASE.in);
      shards(A0.x, A0.y, c, 10, 34, t, 420);
      const g2 = ghost(cell, T.x, T.y);
      A(g2, [{ transform: tr(T.x, T.y, 0, -180), opacity: 0 }, { transform: tr(T.x, T.y, 1.3, 0), opacity: 1, offset: 0.7 }, { transform: tr(T.x, T.y, 1, 0), opacity: 1 }], 380, t + 330, EASE.out);
      ring(T.x, T.y, c, 6, 46, 500, t + 330, 3);
      hideCell(f.to, t + 710);
      return [t + 720, t];
    }
    case 'phantom:s': {
      const v = '#B9A7FF';
      const pts = [A0];
      for (let k = 1; k < 6; k++) pts.push({ x: A0.x + (T.x - A0.x) * k / 6 + (Math.random() - 0.5) * 18, y: A0.y + (T.y - A0.y) * k / 6 + (Math.random() - 0.5) * 18 });
      pts.push(T);
      const bolt = mk('polyline', { points: pts.map(p => `${p.x},${p.y}`).join(' '), fill: 'none', stroke: v, 'stroke-width': 3, 'stroke-linejoin': 'round' });
      A(bolt, [{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 0.2, offset: 0.3 }, { opacity: 1, offset: 0.45 }, { opacity: 0 }], 500, t, 'linear');
      for (let k = 0; k < 4; k++) ring(T.x, T.y, v, 8, 70, 700, t + 150 + k * 160, 3);
      flash(T.x, T.y, 36, 300, t + 160);
      return [t + 1300, t];
    }
    case 'hacker:n': case 'hacker:s': {
      for (let k = 0; k < 7; k++) {
        const b = mk('rect', { x: -2.5, y: -2.5, width: 5, height: 5, fill: k % 2 ? '#fff' : c });
        A(b, [{ transform: tr(A0.x, A0.y, 0.5), opacity: 0 }, { opacity: 1, offset: 0.15 }, { transform: tr(T.x, T.y, 1, 180), opacity: 0.2 }], 420, t + k * 55, EASE.io);
      }
      const at = t + 6 * 55 + 420;
      const cell = st.cells[f.to];
      const g = ghost(cell, T.x, T.y);
      A(g, [{ transform: tr(T.x, T.y, 0.4), opacity: 0 }, { transform: tr(T.x, T.y, 1.35), opacity: 1, offset: 0.6 }, { transform: tr(T.x, T.y, 1), opacity: 1 }], 380, at, EASE.back);
      ring(T.x, T.y, c, 8, 50, 600, at, 4);
      flash(T.x, T.y, 30, 300, at);
      hideCell(f.to, at + 380);
      return [at + 400, at];
    }
    case 'ingenieur:n': {
      const cell = st.cells[f.to];
      for (const off of [-1, 1]) {
        const n = ghost({ p: f.p, k: 'node' }, A0.x, A0.y);
        A(n, [{ transform: tr(A0.x, A0.y, 0.4) }, { transform: tr((A0.x + T.x) / 2 + off * 14, (A0.y + T.y) / 2 - 14, 0.9), offset: 0.5 }, { transform: tr(T.x, T.y, 0.7) }], 420, t + (off > 0 ? 90 : 0), EASE.io);
      }
      const g = ghost(cell, T.x, T.y);
      A(g, [{ transform: tr(T.x, T.y, 0.3), opacity: 0 }, { transform: tr(T.x, T.y, 1.3), opacity: 1, offset: 0.6 }, { transform: tr(T.x, T.y, 1), opacity: 1 }], 380, t + 500, EASE.back);
      ring(T.x, T.y, c, 8, 44, 550, t + 500, 3);
      hideCell(f.to, t + 880);
      return [t + 900, t];
    }
    case 'mimic:n': {
      const l = mk('line', { x1: A0.x, y1: A0.y, x2: T.x, y2: T.y, stroke: c, 'stroke-width': 3, 'stroke-dasharray': '4 5', 'stroke-linecap': 'round' });
      A(l, [{ strokeDashoffset: 40, opacity: 0 }, { opacity: 1, offset: 0.2 }, { strokeDashoffset: 0, opacity: 0 }], 700, t, 'linear');
      const scan = mk('circle', { cx: 0, cy: 0, r: 10, fill: 'none', stroke: c, 'stroke-width': 0.25, 'stroke-dasharray': '2 1.5' });
      A(scan, [{ transform: tr(T.x, T.y, 3, 0), opacity: 0 }, { transform: tr(T.x, T.y, 2.4, 180), opacity: 1, offset: 0.4 }, { transform: tr(T.x, T.y, 2.2, 360), opacity: 0 }], 800, t, EASE.out);
      ring(A0.x, A0.y, c, 10, 50, 600, t + 500, 3);
      flash(A0.x, A0.y, 30, 300, t + 500);
      return [t + 1100, t];
    }
    case 'mimic:s': {
      const a = st.cells[f.to], b = st.cells[f.from];
      const mx = (A0.x + T.x) / 2, my = (A0.y + T.y) / 2, dx = T.x - A0.x, dy = T.y - A0.y;
      const g1 = ghost(a, A0.x, A0.y), g2 = ghost(b, T.x, T.y);
      A(g1, [{ transform: tr(A0.x, A0.y) }, { transform: tr(mx - dy * 0.35, my + dx * 0.35, 1.2), offset: 0.5 }, { transform: tr(T.x, T.y) }], 520, t, EASE.io);
      A(g2, [{ transform: tr(T.x, T.y) }, { transform: tr(mx + dy * 0.35, my - dx * 0.35, 1.2), offset: 0.5 }, { transform: tr(A0.x, A0.y) }], 520, t, EASE.io);
      ring(A0.x, A0.y, c, 8, 36, 400, t + 500); ring(T.x, T.y, c, 8, 36, 400, t + 500);
      hideCell(f.to, t + 520); hideCell(f.from, t + 520);
      return [t + 900, t];
    }
  }
  return [t, t];
}

// Grosse Einspieler über das ganze Spielfeld, bevor eine Fähigkeit wirkt
const CINE_TXT = { 'hacker:s': 'ACCESS GRANTED', 'sniper:s': 'ZIEL ERFASST', 'warden:s': 'SYSTEME GESPERRT', 'saboteur:n': 'SPRENGSATZ SCHARF' };
function cine(f, t) {
  const strong = E.abilityCost(f.h, f.kind) > 1 || f.kind === 's';
  const D = 1300; // = 0,5 s
  const { minx, miny, w, h } = VIEW;
  const cx = minx + w / 2, cy = miny + h / 2;
  const c = col(f.p), A0 = P(f.from), T = f.to !== null && f.to !== undefined ? P(f.to) : A0;
  const H = E.HEROES[f.h][f.kind];
  // Abdunkeln
  const dim = mk('rect', { x: minx - 40, y: miny - 60, width: w + 80, height: h + 120, fill: '#03050c' });
  A(dim, [{ opacity: 0 }, { opacity: strong ? 0.62 : 0.45, offset: 0.2 }, { opacity: strong ? 0.62 : 0.45, offset: 0.7 }, { opacity: 0 }], D, t, 'linear');
  const rnd = (a, b) => a + Math.random() * (b - a);
  switch (f.h + ':' + f.kind) {
    case 'titan:n': {
      const d = `M${minx - 30} ${miny + h * 0.88} Q${cx} ${cy + 30} ${minx + w + 30} ${miny + h * 0.12}`;
      const glow = mk('path', { d, fill: 'none', stroke: c, 'stroke-width': 26, 'stroke-linecap': 'round', opacity: 0.45, pathLength: 100, 'stroke-dasharray': 100 });
      const core = mk('path', { d, fill: 'none', stroke: '#fff', 'stroke-width': 9, 'stroke-linecap': 'round', pathLength: 100, 'stroke-dasharray': 100 });
      for (const el of [glow, core]) A(el, [{ strokeDashoffset: 100, opacity: 1 }, { strokeDashoffset: 0, opacity: 1, offset: 0.35 }, { strokeDashoffset: 0, opacity: 1, offset: 0.6 }, { strokeDashoffset: -100, opacity: 0 }], D, t, EASE.out);
      shake(6, t + D * 0.3);
      break;
    }
    case 'titan:s': case 'ingenieur:s': {
      const hexPts = r => [0, 1, 2, 3, 4, 5].map(k => `${(Math.cos(Math.PI / 3 * k + Math.PI / 6) * r).toFixed(1)},${(Math.sin(Math.PI / 3 * k + Math.PI / 6) * r).toFixed(1)}`).join(' ');
      for (let k = 0; k < 3; k++) {
        const g = mk('polygon', { points: hexPts(10), fill: k ? 'none' : c, 'fill-opacity': '.08', stroke: k === 1 ? '#fff' : c, 'stroke-width': 0.35 - k * 0.08, 'stroke-linejoin': 'round' });
        const R = h * (0.5 - k * 0.12) / 10;
        A(g, [{ transform: tr(cx, cy, 0.1, -60), opacity: 0 }, { transform: tr(cx, cy, R * 1.08, 0), opacity: 1, offset: 0.45 }, { transform: tr(cx, cy, R, 0), opacity: 1, offset: 0.7 }, { transform: tr(cx, cy, R * 1.04, 0), opacity: 0 }], D, t + k * 90, EASE.back);
      }
      break;
    }
    case 'sniper:n': case 'sniper:s': {
      for (const [x1, y1, x2, y2] of [[minx - 40, T.y, minx + w + 40, T.y], [T.x, miny - 60, T.x, miny + h + 60]]) {
        const l = mk('line', { x1, y1, x2, y2, stroke: c, 'stroke-width': 1.5, 'stroke-dasharray': '6 6' });
        A(l, [{ opacity: 0 }, { opacity: 0.9, offset: 0.3 }, { opacity: 0 }], D, t, 'linear');
      }
      const g = mk('g', {}, null, `<circle r="22" fill="none" stroke="${c}" stroke-width="2.5"/><circle r="34" fill="none" stroke="${c}" stroke-width="1" stroke-dasharray="4 6"/><path d="M0-46v18M0 28v18M-46 0h18M28 0h18" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><circle r="2.5" fill="#fff"/>`);
      A(g, [{ transform: tr(T.x, T.y, 6, -120), opacity: 0 }, { transform: tr(T.x, T.y, 1.1, 0), opacity: 1, offset: 0.55 }, { transform: tr(T.x, T.y, 1, 0), opacity: 1, offset: 0.8 }, { transform: tr(T.x, T.y, 0.8, 0), opacity: 0 }], D, t, EASE.out);
      break;
    }
    case 'interceptor:n': case 'interceptor:s': {
      const ang = Math.atan2(T.y - A0.y, T.x - A0.x), dx = Math.cos(ang), dy = Math.sin(ang);
      for (let k = 0; k < 18; k++) {
        const len = rnd(50, 150), px = rnd(minx, minx + w), py = rnd(miny, miny + h);
        const l = mk('line', { x1: 0, y1: 0, x2: -dx * len, y2: -dy * len, stroke: k % 3 ? c : '#fff', 'stroke-width': rnd(1, 3), 'stroke-linecap': 'round' });
        A(l, [{ transform: tr(px - dx * w * 0.6, py - dy * w * 0.6), opacity: 0 }, { opacity: 1, offset: 0.3 }, { transform: tr(px + dx * w * 0.6, py + dy * w * 0.6), opacity: 0 }], D * rnd(0.5, 0.9), t + rnd(0, D * 0.3), 'linear');
      }
      break;
    }
    case 'phantom:n': case 'mimic:s': {
      const cols = f.h === 'mimic' ? [c, '#fff', c] : ['#4CC9F0', '#FF4FD8', '#fff'];
      for (let k = 0; k < 9; k++) {
        const bh = rnd(4, 18), by = rnd(miny, miny + h);
        const r = mk('rect', { x: minx - 40, y: by, width: w + 80, height: bh, fill: cols[k % 3] });
        const fr = [];
        for (let q = 0; q <= 6; q++) fr.push({ transform: `translate(${rnd(-40, 40)}px,0)`, opacity: q % 2 ? rnd(0.15, 0.5) : 0, offset: q / 6 });
        A(r, fr, D * 0.8, t + rnd(0, D * 0.2), 'steps(1)');
      }
      shake(4, t + D * 0.2);
      break;
    }
    case 'phantom:s': {
      const v = '#B9A7FF';
      for (let k = 0; k < 3; k++) {
        const wv = mk('circle', { cx: 0, cy: 0, r: 10, fill: 'none', stroke: v, 'stroke-width': 1.2 - k * 0.3 });
        A(wv, [{ transform: tr(A0.x, A0.y, 0.2), opacity: 1 }, { transform: tr(A0.x, A0.y, Math.hypot(w, h) / 10), opacity: 0 }], D * 0.8, t + k * 130, EASE.out);
      }
      const tint = mk('rect', { x: minx - 40, y: miny - 60, width: w + 80, height: h + 120, fill: v });
      A(tint, [{ opacity: 0 }, { opacity: 0.18, offset: 0.25 }, { opacity: 0 }], D, t, 'linear');
      break;
    }
    case 'hacker:n': case 'hacker:s': {
      const g = '#5CFF9D', glyphs = '01アイウエオ<>/{}#$';
      for (let k = 0; k < 14; k++) {
        const x = minx + (k + 0.5) * w / 14;
        let txt = '';
        for (let q = 0; q < 8; q++) txt += `<text x="0" y="${q * 16}" font-size="13" font-family="monospace" fill="${q === 7 ? '#fff' : g}" opacity="${(q + 2) / 10}" text-anchor="middle">${glyphs[Math.floor(Math.random() * glyphs.length)]}</text>`;
        const col_ = mk('g', {}, null, txt);
        A(col_, [{ transform: tr(x, miny - 140) , opacity: 1 }, { transform: tr(x, miny + h + 20), opacity: 0.2 }], D * rnd(0.7, 1), t + rnd(0, D * 0.25), 'linear');
      }
      break;
    }
    case 'ingenieur:n': {
      const bp = '#7FB8FF';
      let k = 0;
      for (let x = minx; x <= minx + w; x += 40) { const l = mk('line', { x1: x, y1: miny - 40, x2: x, y2: miny + h + 40, stroke: bp, 'stroke-width': 1, pathLength: 100, 'stroke-dasharray': 100 }); A(l, [{ strokeDashoffset: 100, opacity: 0.7 }, { strokeDashoffset: 0, opacity: 0.7, offset: 0.5 }, { strokeDashoffset: 0, opacity: 0 }], D, t + (k++) * 25, EASE.out); }
      for (let y = miny; y <= miny + h; y += 40) { const l = mk('line', { x1: minx - 40, y1: y, x2: minx + w + 40, y2: y, stroke: bp, 'stroke-width': 1, pathLength: 100, 'stroke-dasharray': 100 }); A(l, [{ strokeDashoffset: 100, opacity: 0.7 }, { strokeDashoffset: 0, opacity: 0.7, offset: 0.5 }, { strokeDashoffset: 0, opacity: 0 }], D, t + (k++) * 25, EASE.out); }
      break;
    }
    case 'warden:n': {
      for (let k = 0; k < 7; k++) {
        const x = minx + (k + 0.5) * w / 7;
        const bar = mk('rect', { x: -3, y: miny - 40, width: 6, height: h + 80, fill: k % 2 ? '#fff' : c });
        A(bar, [{ transform: 'translate(' + x + 'px,0px) scaleY(0)', opacity: 0 }, { transform: 'translate(' + x + 'px,0px) scaleY(1)', opacity: 0.5, offset: 0.4 }, { opacity: 0 }], D, t + k * 40, EASE.out);
      }
      break;
    }
    case 'warden:s': {
      for (const ang of [35, -35]) {
        const bar = mk('rect', { x: -w, y: -9, width: w * 2, height: 18, fill: '#FFB347' });
        A(bar, [{ transform: tr(cx, cy, 0, ang), opacity: 0 }, { transform: tr(cx, cy, 1, ang), opacity: 0.55, offset: 0.35 }, { transform: tr(cx, cy, 1, ang), opacity: 0 }], D, t, EASE.out);
      }
      break;
    }
    case 'saboteur:n': {
      const sweep = mk('path', { d: `M0 0 L${Math.max(w, h)} 0 A${Math.max(w, h)} ${Math.max(w, h)} 0 0 1 ${Math.max(w, h) * 0.7} ${Math.max(w, h) * 0.7} Z`, fill: c, opacity: 0.25 });
      A(sweep, [{ transform: tr(cx, cy, 1, 0) }, { transform: tr(cx, cy, 1, 360) }], D, t, 'linear');
      break;
    }
    case 'saboteur:s': case 'schwarm:s': {
      for (let k = 0; k < 6; k++) { const x = rnd(minx, minx + w), y = rnd(miny, miny + h); flash(x, y, rnd(30, 60), 400, t + k * 90); }
      shake(7, t + 200);
      break;
    }
    case 'schwarm:n': {
      for (let k = 0; k < 14; k++) {
        const y = rnd(miny, miny + h), sc = rnd(0.5, 1.1);
        const tri = mk('polygon', { points: '0,-6 5,4 -5,4', fill: k % 3 ? c : '#fff' });
        A(tri, [{ transform: tr(minx - 30, y, sc, 90), opacity: 0 }, { opacity: 1, offset: 0.2 }, { transform: tr(minx + w + 30, y + rnd(-40, 40), sc, 90), opacity: 0 }], D * rnd(0.6, 0.9), t + rnd(0, D * 0.3), EASE.io);
      }
      break;
    }
    case 'ingenieur:s': {
      const bp = '#7FB8FF';
      for (let k = 0; k < 6; k++) { const l = mk('line', { x1: cx, y1: cy, x2: cx + Math.cos(k) * w, y2: cy + Math.sin(k) * w, stroke: bp, 'stroke-width': 1.5 }); A(l, [{ opacity: 0 }, { opacity: 0.7, offset: 0.3 }, { opacity: 0 }], D, t + k * 30, EASE.out); }
      break;
    }
    case 'mimic:n': {
      const bar = mk('rect', { x: minx - 40, y: -8, width: w + 80, height: 16, fill: c });
      A(bar, [{ transform: `translate(0px,${miny - 20}px)`, opacity: 0 }, { opacity: 0.55, offset: 0.15 }, { transform: `translate(0px,${miny + h + 20}px)`, opacity: 0 }], D, t, EASE.io);
      const line = mk('rect', { x: minx - 40, y: -1, width: w + 80, height: 2, fill: '#fff' });
      A(line, [{ transform: `translate(0px,${miny - 20}px)`, opacity: 0 }, { opacity: 1, offset: 0.15 }, { transform: `translate(0px,${miny + h + 20}px)`, opacity: 0 }], D, t, EASE.io);
      break;
    }
  }
  // Name der Fähigkeit
  const by = miny + h * 0.5;
  const sub = CINE_TXT[f.h + ':' + f.kind];
  const label = mk('g', {}, null, `<text y="0" text-anchor="middle" font-family="Space Grotesk, sans-serif" font-weight="700" font-size="${Math.min(strong ? 32 : 28, (w * 0.9 - 3 * H.name.length) / (0.95 * H.name.length)).toFixed(1)}" letter-spacing="3" fill="#fff" stroke="${c}" stroke-width="1" paint-order="stroke">${esc(H.name.toUpperCase())}</text>${sub ? `<text y="24" text-anchor="middle" font-family="monospace" font-size="13" letter-spacing="3" fill="${f.h === 'hacker' ? '#5CFF9D' : c}">${sub}</text>` : ''}<rect x="-90" y="${sub ? 32 : 12}" width="180" height="2.5" fill="${c}"/>`);
  A(label, [{ transform: tr(cx, by, 0.7), opacity: 0 }, { transform: tr(cx, by, 1), opacity: 1, offset: 0.25 }, { transform: tr(cx, by, 1.03), opacity: 1, offset: 0.75 }, { transform: tr(cx, by, 1.08), opacity: 0 }], D, t, EASE.out);
  return D;
}

function playFx(st) {
  if (reduced() || !st.fx || !st.fx.length || G.screen !== 'game') return 0;
  fxSvg(); syncFx();
  let t = 0, impact = 0, end = 0, lock = 0;
  const now = performance.now();
  for (const f of st.fx) {
    if (f.k === 'place' || f.k === 'hero') {
      const { x, y } = P(f.at), cell = st.cells[f.at];
      if (!cell) continue;
      const hero = f.k === 'hero';
      if (hero) {
        const col_ = mk('line', { x1: x, y1: VIEW.miny - 30, x2: x, y2: y, stroke: col(cell.p), 'stroke-linecap': 'round' });
        A(col_, [{ strokeWidth: 0, opacity: 0 }, { strokeWidth: 26, opacity: 0.8, offset: 0.3 }, { strokeWidth: 0, opacity: 0 }], 600, t);
        flash(x, y, 44, 400, t + 200);
      }
      const g = ghost(cell, x, y);
      const d = hero ? 200 : 0;
      A(g, [{ transform: tr(x, y - (hero ? 0 : 26), 0.2), opacity: 0 }, { transform: tr(x, y, hero ? 1.45 : 1.25), opacity: 1, offset: 0.6 }, { transform: tr(x, y, 1), opacity: 1 }], hero ? 520 : 380, t + d, EASE.back);
      ring(x, y, col(cell.p), 6, hero ? 60 : 34, hero ? 700 : 500, t + d + 120, hero ? 4 : 2.5);
      hideCell(f.at, t + d + (hero ? 520 : 380));
      end = Math.max(end, t + d + (hero ? 800 : 600));
    } else if (f.k === 'move') {
      const a = P(f.from), b = P(f.to), cell = st.cells[f.to];
      if (!cell) continue;
      const g = ghost(cell, a.x, a.y);
      A(g, [{ transform: tr(a.x, a.y) }, { transform: tr(b.x, b.y) }], 380, t, EASE.io);
      ring(a.x, a.y, col(cell.p), 12, 24, 400, t, 2);
      hideCell(f.to, t + 380);
      end = Math.max(end, t + 400);
    } else if (f.k === 'ability') {
      let t0 = t;
      if (G.bigFx) { const d = cine(f, t); t0 = t + d * 0.6; lock = Math.max(lock, t + d); }
      const [e, imp] = abilityFx(f, t0, st);
      impact = imp; end = Math.max(end, e);
    } else if (f.k === 'mine') {
      const { x, y } = P(f.at);
      flash(x, y, 50, 400, t); ring(x, y, '#FF6B4A', 8, 60, 600, t, 4); shards(x, y, '#FF6B4A', 14, 55, t, 650); shake(6, t);
      end = Math.max(end, t + 700);
    } else if (f.k === 'armor') {
      const { x, y } = P(f.at);
      ring(x, y, '#fff', 30, 18, 400, impact, 3); flash(x, y, 30, 300, impact + 100);
      end = Math.max(end, impact + 500);
    } else if (f.k === 'destroy') {
      end = Math.max(end, boom(f, impact));
      t = Math.max(t, impact + 250);
    } else if (f.k === 'encircle') {
      const start = Math.max(end - 250, 0);
      end = Math.max(end, swallow(f, start));
    }
  }
  end /= RATE; lock /= RATE;
  FX.end = now + end;
  if (lock) FX.lock = now + lock;
  // Spielfeld neu zeichnen, sobald versteckte Figuren wieder erscheinen sollen
  render();
  clearTimeout(FX.timer);
  const last = Math.max(0, ...[...FX.hide.values()].map(v => v - performance.now()));
  if (last > 0) FX.timer = setTimeout(() => { FX.hide.clear(); render(); }, last + 20);
  FX.end = now + end;
  // Eingabe und Uhr pausieren nur während der grossen Einspieler
  if (lock) {
    FX.lock = now + lock;
    G.mark = Math.max(G.mark || 0, FX.lock);
    clearTimeout(FX.unlock);
    FX.unlock = setTimeout(render, lock + 30);
  }
  return end;
}

const isMyTurn = () => G.state && G.state.phase === 'play' && G.state.cur === G.me && !G.aiBusy && performance.now() >= FX.lock;

function playerBlock(p, right) {
  const s = G.state;
  const nm = names()[p];
  return `<div class="pl ${right ? 'right' : ''} ${s.cur === p && s.phase === 'play' ? 'turn' : ''}">
    <div class="nm" style="color:${col(p)}">${right ? '' : shapeIcon(p)}${nm}${right ? shapeIcon(p) : ''}</div>
    ${G.mode === 'single' && p !== G.me ? `<div class="st">Stufe: ${LEVELS[G.level]}</div>` : ''}
    <div class="st">Pot ${s.pot[p]} · Stapel ${E.stapelCount(s, p)}</div>
    ${s.auras && s.auras[p] ? `<div class="st aura-tag">✦ ${E.AURAS[s.auras[p]].name}</div>` : ''}
    ${clockRuns(p) ? `<div class="clock ${s.cur === p && s.phase === 'play' ? 'run' : ''} ${clockLeft(p) < 30000 ? 'low' : ''}" data-p="${p}">${fmt(clockLeft(p))}</div>` : ''}
    <div class="st" style="display:flex;gap:4px;${right ? 'justify-content:flex-end' : ''}">${s.phase === 'pick' ? '' : (s.picks[p] || []).map(h => heroIcon(h, 15, '#A3AED0')).join('')}</div></div>`;
}

function heroStatus(k) {
  const s = G.state;
  if (s.cells.some(c => c && c.k === 'hero' && E.owner(c) === G.me && c.slot === k)) return ['auf dem Feld', true];
  if (s.hwait[G.me][k] > 0) return ['wartet', false];
  if (s.round < E.HERO_ROUND) return [`ab Runde ${E.HERO_ROUND}`, false];
  return ['bereit', false];
}

function waitMsg() {
  const s = G.state;
  if (G.mode === 'single') return 'Der Computer überlegt …';
  if (isMulti()) {
    const who = `${esc(nameOf(s.cur))} ist am Zug${isOnline(s.cur) ? '' : ' (nicht verbunden)'} …`;
    if (G.me < 0) return 'Du schaust zu. ' + who;
    if (!s.alive[G.me]) return 'Du bist ausgeschieden und schaust zu. ' + who;
    return who;
  }
  return G.peers === 0 ? 'Gegner ist nicht verbunden …' : 'Dein Gegner ist am Zug …';
}
function pchip(p) {
  const s = G.state, turn = s.cur === p && s.phase === 'play', dead = !s.alive[p];
  const nm = nameOf(p).replace(/^Computer/, 'CPU');
  return `<div class="pc ${turn ? 'turn' : ''} ${dead ? 'dead' : ''}" style="--pc:${col(p)}" title="${esc(nameOf(p))}">
    <div class="nm">${shapeIcon(p, 11)}<span>${esc(nm)}</span></div>
    ${dead ? '<div class="st">raus</div>' : `<div class="st" aria-label="Pot ${s.pot[p]}, Stapel ${E.stapelCount(s, p)}">Pot ${s.pot[p]} · St ${E.stapelCount(s, p)}</div>`}
    ${s.auras && s.auras[p] ? `<div class="st aura-tag">✦ ${E.AURAS[s.auras[p]].name}</div>` : ''}
    ${clockRuns(p) && !dead ? `<div class="clock ${turn ? 'run' : ''} ${clockLeft(p) < 30000 ? 'low' : ''}" data-p="${p}">${fmt(clockLeft(p))}</div>` : ''}
    ${dead ? '' : `<div class="st hi">${(s.picks[p] || []).map(h => heroIcon(h, 13, '#A3AED0')).join('')}</div>`}</div>`;
}
function panel() {
  const s = G.state;
  if (s.phase !== 'play') return '';
  if (!isMyTurn()) {
    return `<div class="panel"><div class="hint pulse">${waitMsg()}</div></div>`;
  }
  const i = G.sel;
  const c = i === null ? null : s.cells[i];
  if (!c) {
    return `<div class="panel"><div class="ttl">Dein Zug</div><div class="hint">Tippe auf einen markierten Punkt, um einen Node zu legen, oder wähle eine eigene Figur.${s.pot[G.me] === 0 ? ' Dein Pot ist leer.' : ''}</div></div>`;
  }
  if (c.p !== G.me) {
    const what = c.k === 'hero' ? E.HEROES[c.h].name : E.UNIT_NAME[c.k];
    if (c.k === 'wall' || c.k === 'drone') return `<div class="panel"><div class="ttl">${shapeIcon(c.p, 14)} ${what} ${whose(c.p)}</div><div class="hint">${c.k === 'wall' ? 'Zählt bis zum nächsten Zug ihres Besitzers zu seiner Kette und blockiert den Weg. Sie kann nicht zerstört werden.' : 'Zählt zur Kette des Gegners. Ein Treffer zerstört sie.'}</div></div>`;
    return `<div class="panel"><div class="ttl">${shapeIcon(c.p, 14)} ${what} ${whose(c.p)}</div>${c.k === 'hero' ? `<div class="hint">${E.HEROES[c.h].n.name}: ${E.HEROES[c.h].n.desc}<br>${E.HEROES[c.h].s.name}: ${E.HEROES[c.h].s.desc}</div>` : ''}</div>`;
  }
  const pm = G.pending ? G.pending.mode : null;
  if (c.k === 'wall' || c.k === 'drone') {
    return `<div class="panel"><div class="ttl">${E.UNIT_NAME[c.k]}</div><div class="hint">${c.k === 'wall' ? 'Deine Energiewand zählt bis zu deinem nächsten Zug zur Kette.' : 'Deine Drohne zählt zur Kette und kann nicht ziehen. Mit dem Schwarmangriff explodiert sie.'}</div></div>`;
  }
  if (c.k === 'node') {
    return `<div class="panel"><div class="ttl">Node</div><div class="hint">Tippe auf ein markiertes Feld, um zu ziehen.</div>
    <div class="row"><button class="btn" data-act="stack" ${s.pot[G.me] > 0 ? '' : 'disabled'}>Stapeln → Pylon</button></div>${E.canRufNode(s, G.me) && E.availableHeroes(s, G.me).length ? `<div class="hint">Rufbereitschaft (einmal pro Partie): Held direkt aus diesem Node rufen.</div><div class="row">${[...new Set(s.picks[G.me])].map(h => `<button class="btn" data-act="mkhero" data-h="${h}" ${E.availableHeroes(s, G.me).includes(h) ? '' : 'disabled'}>${E.HEROES[h].name}</button>`).join('')}</div>` : ''}</div>`;
  }
  if (c.k === 'pylon') {
    const av = E.availableHeroes(s, G.me);
    const heroes = [...new Set(s.picks[G.me] || [])].map(h => `<button class="btn" data-act="mkhero" data-h="${h}" ${av.includes(h) ? '' : 'disabled'}>${E.HEROES[h].name}</button>`).join('');
    return `<div class="panel"><div class="ttl">Pylon</div><div class="hint">Ziehe bis 3 Felder weit oder verwandle ihn in einen Helden${s.round < E.HERO_ROUND ? ` (ab Runde ${E.HERO_ROUND})` : ''}.</div>
    <div class="row">${heroes}</div></div>`;
  }
  const ab = (kind, copy) => {
    const t = copy ? c.as : c.h, H = E.HEROES[t];
    const ok = E.abilityUsable(s, i, kind, copy);
    const on = G.pending && G.pending.mode === kind && !!G.pending.copy === copy;
    return `<button class="btn ability ${on ? 'on' : ''}" data-act="ability" data-kind="${kind}" data-copy="${copy ? 1 : 0}" ${ok ? '' : 'disabled'}>${H[kind].name}<small>${E.abilityCost(t, kind) === 1 ? '1 Aktion' : '2 Aktionen'}</small></button>`;
  };
  let hint = 'Tippe auf ein markiertes Feld, um zu ziehen, oder wähle eine Fähigkeit.';
  if (c.stun) hint = 'Durch EMP gelähmt: Dieser Held kann in diesem Zug nichts tun.';
  else if (c.lock && !pm) hint = 'Lockdown: Dieser Held kann in diesem Zug keine Fähigkeiten nutzen, aber ziehen.';
  else if (pm === 'n' || pm === 's') {
    const A_ = E.HEROES[G.pending.copy ? c.as : c.h][pm];
    hint = A_.desc + ' ' + (A_.steps ? A_.steps[G.pending.chosen.length] || '' : 'Tippe auf ein Ziel.');
  }
  if (c.orig) hint = `Gehackt: Dieser Held gehört dir noch ${Math.max(1, c.hack - 1)} ${c.hack - 1 === 1 ? 'Zug' : 'Züge'}. ` + hint;
  const why = ['n', 's'].map(k => (!c.stun && !c.lock && !E.abilityUsable(s, i, k, false) && E.abilityCost(c.h, k) <= s.actions && E.needsTarget(c.h, k) && E.blockedByWarden(s, i, k).length) ? E.HEROES[c.h][k].name : null).filter(Boolean);
  if (why.length) hint += ` ${why.join(' und ')}: Kein Ziel, weil die möglichen Ziele im Schutzfeld eines gegnerischen Warden stehen (kleiner Schild am Ring).`;
  const copyRow = c.as ? `<div class="hint" style="display:flex;align-items:center;gap:6px">${heroIcon(c.as, 16, '#A3AED0')} Kopiert: ${E.HEROES[c.as].name}</div><div class="row">${ab('n', true)}${ab('s', true)}</div>` : '';
  const fin = G.pending && G.pending.chosen && G.pending.chosen.length && E.canFinish(G.pending.copy ? c.as : c.h, G.pending.mode, G.pending.chosen)
    ? `<div class="row"><button class="btn primary" data-act="finishAbility">Fertig</button></div>` : '';
  return `<div class="panel"><div class="ttl">${E.HEROES[c.h].name}</div>
  <div class="hint">${hint}</div>${fin}<div class="row">${ab('n', false)}${ab('s', false)}</div>${copyRow}</div>`;
}

function gameScreen() {
  const s = G.state;
  const opp = G.me === 0 ? 1 : 0;
  const left = G.me, right = 1 - G.me;
  const cur = s.cur;
  const dots = [0, 1].map(k => `<span class="dot ${k < s.actions ? 'f' : ''}" style="border-color:${col(cur)};${k < s.actions ? `background:${col(cur)}` : ''}"></span>`).join('');
  const heroes = (s.picks[G.me] || []).map((h, k) => {
    const [st, on] = heroStatus(k);
    return `<div class="hchip"><span class="badge ${on ? '' : 'off'}">${heroIcon(h, 17, on ? '#fff' : '#A3AED0')}</span><span class="hn2">${E.HEROES[h].name}</span><span class="hs">${st}</span></div>`;
  }).join('');
  void opp;
  const bar = s.n > 2
    ? `<div class="mbar"><button class="icon" data-act="menu" aria-label="Menü" style="width:44px;height:36px">${menuIcon}</button><span>Runde ${s.round}/${E.limitOf(s)}${s.mode === 'team' ? ' · 2 gegen 2' : ' · alle gegen alle'}</span><div class="dots" aria-label="${s.actions} Aktionen übrig">${dots}</div></div>
  <div class="pgrid" style="grid-template-columns:repeat(${s.n},minmax(0,1fr))">${Array.from({ length: s.n }, (_, p) => pchip(p)).join('')}</div>`
    : `<div class="bar">${playerBlock(left, false)}
    <div class="mid"><button class="icon" data-act="menu" aria-label="Menü" style="width:44px;height:36px">${menuIcon}</button>Runde ${s.round}/${E.limitOf(s)}<div class="dots" aria-label="${s.actions} Aktionen übrig">${dots}</div></div>
    ${playerBlock(right, true)}</div>`;
  return `<div class="screen" style="padding:0">
  ${bar}
  <div class="boardwrap">${boardSvg()}</div>
  <div class="status ${G.err ? 'err' : ''}" role="status">${esc(G.msg || s.last || '')}</div>
  ${panel()}
  <div class="heroes">${heroes}</div>
  <div class="foot"><button class="btn" data-act="end" ${isMyTurn() ? '' : 'disabled'}>Zug beenden</button></div>
  </div>`;
}

function menuOverlay() {
  return `<div class="overlay"><div class="dialog"><h2 style="font-size:24px">Menü</h2>
  <button class="btn" data-act="rulesIngame">Regeln</button>
  <button class="btn" data-act="toggleFx" aria-pressed="${G.bigFx}">Grosse Animationen: ${G.bigFx ? 'ein' : 'aus'}</button>
  ${isMulti() && G.state && (G.me < 0 || !G.state.alive[G.me]) ? '<button class="btn" data-act="leave">Raum verlassen</button>' : `<button class="btn" data-act="resign">${G.mode === 'single' ? 'Partie beenden' : 'Aufgeben'}</button>`}
  <button class="btn primary" data-act="closeMenu">Weiterspielen</button></div></div>`;
}
function overOverlay() {
  const s = G.state;
  if (s.n > 2) return overMulti();
  const win = s.winner === G.me, draw = s.winner === null;
  return `<div class="overlay"><div class="dialog"><h2 style="color:${win ? ME_COL : 'var(--text)'}">${draw ? 'Unentschieden' : win ? 'Sieg!' : 'Niederlage'}</h2>
  <p class="muted" style="margin:0">${s.endReason === 'rounds'
    ? `Nach ${E.limitOf(s)} Runden zählen die Punkte (Node 1, Pylon 2, Held 3): Du ${E.score(s, G.me)} · ${names()[1 - G.me]} ${E.score(s, 1 - G.me)}.`
    : s.endReason === 'time'
    ? `Die Zeit ist abgelaufen. Punkte (Node 1, Pylon 2, Held 3): Du ${E.score(s, G.me)} · ${names()[1 - G.me]} ${E.score(s, 1 - G.me)}.`
    : win ? 'Alle gegnerischen Figuren sind vom Feld.' : s.alive[G.me] && s.last === 'Aufgegeben' ? 'Dein Gegner hat aufgegeben.' : 'Du hast keine Figuren mehr auf dem Feld.'} Runde ${s.round}.</p>
  ${G.mode === 'single' ? '<button class="btn primary" data-act="single">Nochmal</button>' : ''}
  <button class="btn" data-act="leave">Zum Menü</button></div></div>`;
}

function overMulti() {
  const s = G.state;
  const myT = G.me >= 0 ? E.teamOf(s, G.me) : -2;
  const win = s.winner === myT, draw = s.winner === null;
  const teams = [...new Set(Array.from({ length: s.n }, (_, p) => E.teamOf(s, p)))];
  const pts = teams.map(t => `${esc(t === myT && s.mode === 'team' ? 'Dein Team' : teamName(t))} ${E.teamScore(s, t)}`).join(' · ');
  const title = draw ? 'Unentschieden' : win ? 'Sieg!' : G.me < 0 ? `${esc(teamName(s.winner))} gewinnt` : 'Niederlage';
  const why = s.endReason === 'rounds' ? `Nach ${E.limitOf(s)} Runden zählen die Punkte (Node 1, Pylon 2, Held 3)${s.mode === 'team' ? ' pro Team' : ''}: ${pts}.`
    : s.endReason === 'time' ? `Eine Uhr ist abgelaufen. Punkte${s.mode === 'team' ? ' pro Team' : ''}: ${pts}.`
    : win ? (s.mode === 'team' ? 'Euer Team hat alle Gegner vom Feld gefegt.' : 'Alle anderen sind ausgeschieden.')
    : draw ? 'Niemand ist übrig.' : `${esc(teamName(s.winner))} ${s.mode === 'team' ? 'gewinnen' : 'gewinnt'}.`;
  return `<div class="overlay"><div class="dialog"><h2 style="color:${win ? ME_COL : 'var(--text)'}">${title}</h2>
  <p class="muted" style="margin:0">${why} Runde ${s.round}.</p>
  <button class="btn" data-act="leave">Zum Menü</button></div></div>`;
}

// ---------- Ablauf ----------
function setMsg(m, err = false) { G.msg = m; G.err = err; }

function selectUnit(i) {
  const s = G.state, c = s.cells[i];
  G.sel = i; G.pending = null;
  if (c && c.p === G.me) {
    const t = E.targets(s, i, 'move');
    G.pending = { mode: 'move', from: i, targets: t };
  }
}

function onCell(i) {
  if (!isMyTurn()) return;
  const s = G.state, c = s.cells[i];
  setMsg('');
  if (G.pending && G.pending.targets.includes(i)) {
    const P = G.pending;
    if (P.mode === 'move') return act({ t: 'move', from: P.from, to: i });
    const chosen = [...(P.chosen || []), i];
    const ty = P.copy ? s.cells[P.from].as : s.cells[P.from].h;
    const need = E.stepsNeeded(ty, P.mode);
    const next = E.nextTargets(s, P.from, P.mode, P.copy, chosen);
    if (chosen.length < need && next.length) { G.pending = { ...P, chosen, targets: next }; return render(); }
    const a = { t: 'ability', from: P.from, kind: P.mode, target: chosen[0] };
    if (chosen.length > 1) a.target2 = chosen[1];
    if (chosen.length > 2) a.target3 = chosen[2];
    if (P.copy) a.copy = true;
    return act(a);
  }
  if (c) { if (G.sel === i) { G.sel = null; G.pending = null; } else selectUnit(i); return render(); }
  if (G.sel === null && E.placeTargets(s, G.me).includes(i)) return act({ t: 'place', at: i });
  G.sel = null; G.pending = null; render();
}

function act(a) {
  a.p = G.me;
  if (G.state && G.state.clock) a.spent = spentNow();
  let next;
  try { next = E.apply(G.state, a); } catch (e) { setMsg(e.message, true); return render(); }
  G.sel = null; G.pending = null; setMsg('');
  if (G.mode === 'single') { G.log.push(a); setState(next); render(); maybeAI(); }
  else { G.net.send(a, next); }
}

function maybeAI() {
  const s = G.state;
  const ai = aiSeat();
  if (G.mode !== 'single' || s.phase !== 'play' || s.cur !== ai || G.aiBusy) return;
  G.aiBusy = true; render();
  setTimeout(() => {
    const seq = chooseTurn(G.state, G.level);
    const step = () => {
      const st = G.state;
      if (G.mode !== 'single' || st.phase !== 'play' || st.cur !== ai) { G.aiBusy = false; return render(); }
      const a = seq.shift() || { t: 'end', p: ai };
      let dur = 0;
      if (G.msg && !G.err) setMsg('');
      try { const n = E.apply(st, a); G.log.push(a); dur = setState(n); }
      catch {
        // Plan passt nicht mehr (z. B. eine Mine hat zugeschlagen): neu überlegen
        const re = chooseTurn(st, G.level);
        try { const n = E.apply(st, re[0]); G.log.push(re[0]); dur = setState(n); seq.splice(0, seq.length, ...re.slice(1)); }
        catch { setState(E.apply(st, { t: 'end', p: ai })); }
      }
      render();
      if (G.state.phase === 'play' && G.state.cur === ai) setTimeout(step, Math.max(800, dur + 350));
      else { G.aiBusy = false; render(); }
    };
    step();
  }, G.state.round === 1 && G.log.length === 0 ? 1500 : 600);
}

function startSingle() {
  closeNet();
  Object.assign(G, { mode: 'single', me: Math.random() < 0.5 ? 0 : 1, log: [], state: E.newGame(2), picks: [], aura: null, sel: null, pending: null, aiBusy: false, menu: false, screen: 'pick' });
  setMsg('');
  render();
}

function confirmPick() {
  if (G.picks.length !== 3) return;
  const a = { t: 'pick', p: G.me, heroes: G.picks.slice() };
  if (G.mode === 'single' ? G.adv : G.state && G.state.adv) a.aura = G.aura;
  if (G.mode === 'single') {
    let st = E.apply(G.state, { t: 'setup', p: 0, clock: G.clockMin, only: G.me, adv: G.adv, rounds: G.rounds });
    st = E.apply(st, a);
    G.state = E.apply(st, { t: 'pick', p: aiSeat(), heroes: pickHeroes(), aura: G.adv ? pickAura() : undefined });
    G.mark = performance.now();
    G.log = [];
    setMsg(G.state.cur === G.me ? 'Das Los hat entschieden: Du beginnst.' : 'Das Los hat entschieden: Der Computer beginnt.');
    G.screen = 'game'; render(); maybeAI();
  } else {
    try { const next = E.apply(G.state, a); if (isMulti()) G.screen = 'mlobby'; G.net.send(a, next); render(); } catch (e) { setMsg(e.message, true); render(); }
  }
}

// ---------- Netzwerk (Duell) ----------
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

function onNetLog(log) {
  let st;
  try { st = E.replay(log); } catch { return; }
  if (G.state && log.length < G.log.length) return;
  const fresh = log.length === G.log.length + 1;
  G.log = log; G.state = st;
  if (isMulti()) {
    if (log.length && !st.seated) { setMsg('Das ist ein Duell-Raum. Tippe im Startbildschirm auf «Duell».', true); closeNet(); render(); return; }
    G.me = E.seatOf(st, G.myId);
    if (st.phase !== 'pick') { if (G.screen !== 'rules') G.screen = 'game'; }
    else if (G.screen === 'game' || (G.screen === 'pick' && (G.me < 0 || st.picks[G.me]))) G.screen = 'mlobby';
  } else if (G.screen === 'lobby' && G.peers > 0 || G.screen === 'pick' || G.screen === 'game') {
    G.screen = st.phase === 'pick' ? 'pick' : 'game';
  }
  if (G.sel !== null && (!st.cells[G.sel] || !isMyTurn())) { G.sel = null; G.pending = null; }
  syncBoard();
  render();
  if (fresh) playFx(st);
  if (isMulti()) { maybeSit(); driveBots(); }
}

// ---------- Multiplayer: Platz nehmen und Computer des Gastgebers ----------
const initAction = () => ({ t: 'init', p: 0, n: G.mn, id: G.myId, name: G.name, clock: G.clockMin, adv: G.adv, rounds: G.rounds });
function maybeSit() {
  const s = G.state;
  if (!isMulti() || !G.net || G.me >= 0 || !s || !s.seated || s.phase !== 'pick' || !s.seated.includes(null)) return;
  if (performance.now() - G.sitAt < 4000) return;
  G.sitAt = performance.now();
  setTimeout(() => {
    const st = G.state;
    if (isMulti() && G.net && G.me < 0 && st.seated && st.phase === 'pick' && st.seated.includes(null)) G.net.send({ t: 'sit', p: -1, id: G.myId, name: G.name });
  }, 700);
}
function driveBots() {
  const s = G.state;
  if (!isMulti() || G.me !== 0 || !G.net || !s || !s.seated) return;
  if (s.phase === 'pick') {
    s.seated.forEach((x, k) => {
      if (x !== 'bot' || s.picks[k] || (G.botPick[k] || 0) > performance.now() - 3000) return;
      G.botPick[k] = performance.now();
      const a = { t: 'pick', p: k, heroes: pickHeroes() };
      if (s.adv) a.aura = pickAura();
      G.net.send(a);
    });
    return;
  }
  if (s.phase !== 'play' || !E.isBot(s, s.cur) || G.botTimer) return;
  const b = s.cur, seq0 = s.seq;
  const wait = Math.max(G.botLastSeq === seq0 ? 2500 : 700, FX.end - performance.now() + 300);
  G.botTimer = setTimeout(() => {
    G.botTimer = null;
    const st = G.state;
    if (!isMulti() || !G.net || st.phase !== 'play' || st.cur !== b) return;
    if (st.seq !== seq0) { driveBots(); return; }
    if (!G.botPlan || G.botPlan.turn !== st.turnNo) G.botPlan = { turn: st.turnNo, list: chooseTurn(st, G.level) };
    let a = G.botPlan.list.shift() || { t: 'end', p: b };
    try { E.apply(st, a); } catch {
      const re = chooseTurn(st, G.level);
      a = re[0] || { t: 'end', p: b }; G.botPlan.list = re.slice(1);
      try { E.apply(st, a); } catch { a = { t: 'end', p: b }; }
    }
    G.botLastSeq = st.seq;
    G.net.send(a);
  }, wait);
}
setInterval(() => { if (isMulti()) { maybeSit(); driveBots(); } }, 1500);
// Spieler-Kennung pro Raum: bleibt beim Neuladen erhalten, damit du deinen Platz behältst
const idFor = code => {
  const k = 'nodes-token-' + code;
  let v = null;
  try { v = sessionStorage.getItem(k) || localStorage.getItem(k); } catch {}
  if (!v) v = Math.random().toString(36).slice(2) + Date.now().toString(36);
  try { sessionStorage.setItem(k, v); localStorage.setItem(k, v); } catch {}
  return v;
};
async function startMulti(code, host) {
  closeNet();
  Object.assign(G, { mode: 'multi', me: -1, log: [], state: E.newGame(2), picks: [], aura: null, sel: null, pending: null, screen: 'mlobby', code, menu: false,
    host, myId: idFor(code), onlineIds: null, onlineSeats: new Set(), sitAt: 0, botPick: {}, botPlan: null, botLastSeq: -1 });
  setMsg(''); render();
  try {
    G.net = window.claude && typeof window.claude.use === 'function' ? await roomNet(code, host ? 0 : 1, true) : wsNet(code, true);
  } catch (e) {
    setMsg('Verbindung fehlgeschlagen: ' + e.message, true); G.code = ''; render(); return;
  }
  render();
}
function onNetPeers(n) {
  G.peers = n;
  if (G.screen === 'lobby' && n > 0 && G.state) G.screen = G.state.phase === 'pick' ? 'pick' : 'game';
  render();
}

function closeNet() { if (G.net) { try { G.net.close(); } catch {} } G.net = null; G.peers = 0; G.code = ''; }

async function startDuel(code, seatWanted) {
  closeNet();
  Object.assign(G, { mode: 'duel', me: seatWanted, log: [], state: E.newGame(2), picks: [], aura: null, sel: null, pending: null, screen: 'lobby', code, menu: false });
  setMsg(''); render();
  try {
    G.net = window.claude && typeof window.claude.use === 'function' ? await roomNet(code, seatWanted) : wsNet(code);
  } catch (e) {
    setMsg('Verbindung fehlgeschlagen: ' + e.message, true); G.code = ''; render(); return;
  }
  render();
}

// Cloudflare: WebSocket zum Durable Object
function wsNet(code, multi = false) {
  const token = idFor(code);
  if (multi) G.myId = token;
  const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/api/room/' + code;
  let ws, closed = false, retry = 0;
  const net = {
    shareUrl: location.origin + location.pathname + (multi ? '?m=' : '?r=') + code,
    send(a) { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'act', action: a })); else { setMsg('Keine Verbindung', true); render(); } },
    close() { closed = true; if (ws) ws.close(); },
  };
  const connect = () => {
    ws = new WebSocket(url);
    ws.onopen = () => { retry = 0; ws.send(JSON.stringify({ type: 'hello', token, name: G.name })); };
    ws.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.type === 'welcome') {
        if (multi) {
          if (m.log.length === 0) {
            if (G.host) ws.send(JSON.stringify({ type: 'act', action: initAction() }));
            else { setMsg('Diesen Raum gibt es nicht (mehr). Prüfe den Code.', true); G.code = ''; closed = true; ws.close(); render(); return; }
          }
          onNetLog(m.log);
          return;
        }
        if (m.seat < 0) { setMsg('Dieser Raum ist schon voll', true); G.code = ''; closed = true; ws.close(); render(); return; }
        G.me = m.seat; onNetLog(m.log);
        if (m.seat === 0 && m.log.length === 0) ws.send(JSON.stringify({ type: 'act', action: { t: 'setup', p: 0, clock: G.clockMin, adv: G.adv, rounds: G.rounds } }));
      } else if (m.type === 'log') onNetLog(m.log);
      else if (m.type === 'presence') { if (multi) { G.onlineSeats = new Set(m.seats); render(); } else onNetPeers(m.seats.filter(x => x !== G.me).length); }
      else if (m.type === 'error') { setMsg(m.msg, true); render(); }
    };
    ws.onclose = () => { if (!closed) { G.peers = 0; render(); setTimeout(connect, Math.min(8000, 800 * 2 ** retry++)); } };
  };
  connect();
  return net;
}

// Hier im Chat: Echtzeit-Raum des Artefakts (Nachrichten max. 4 KB, darum einzelne Aktionen)
async function roomNet(code, seat, multi = false) {
  const room = await window.claude.use('room');
  if (!room) throw new Error('Echtzeit-Raum nicht verfügbar');
  const r = await room.join((multi ? 'nodesm-' : 'nodes-') + code.toLowerCase());
  const tryAppend = (i, a) => {
    if (i !== G.log.length || !a || typeof a !== 'object') return false;
    try { E.apply(G.state, a); } catch { return false; }
    onNetLog(G.log.concat([a]));
    return true;
  };
  const sendFrom = from => { for (let i = from; i < G.log.length; i++) r.emit('act', { i, a: G.log[i] }).catch(() => {}); };
  r.on('act', m => {
    if (m.sameTab || !m.data) return;
    const { i, a } = m.data;
    if (i > G.log.length) r.emit('need', { from: G.log.length }).catch(() => {});
    else tryAppend(i, a);
  });
  r.on('need', m => { if (!m.sameTab && m.data && G.log.length > m.data.from) sendFrom(m.data.from); });
  r.on('len', m => {
    if (m.sameTab || !m.data) return;
    if (m.data.n > G.log.length) r.emit('need', { from: G.log.length }).catch(() => {});
    else if (m.data.n < G.log.length) sendFrom(m.data.n);
  });
  r.onPeers(ch => {
    const others = ch.peers.filter(x => !x.sameTab && x.presence && x.presence.app === 'nodes');
    if (multi) { G.onlineIds = new Set(others.map(x => x.presence.id).filter(Boolean)); render(); }
    else onNetPeers(others.length);
    if (ch.joined.length) r.emit('len', { n: G.log.length }).catch(() => {});
  });
  r.presence(multi ? { app: 'nodes', id: G.myId } : { app: 'nodes', seat });
  if (multi) G.onlineIds = new Set();
  if (seat === 0 && G.log.length === 0) {
    const a = multi ? initAction() : { t: 'setup', p: 0, clock: G.clockMin, adv: G.adv, rounds: G.rounds };
    onNetLog([a]);
    r.emit('act', { i: 0, a }).catch(() => {});
  }
  const timer = setInterval(() => r.emit('len', { n: G.log.length }).catch(() => {}), 3000);
  return {
    send(a) {
      const i = G.log.length;
      if (multi) { try { E.apply(G.state, a); } catch (e) { setMsg(e.message, true); render(); return; } }
      onNetLog(G.log.concat([a]));
      r.emit('act', { i, a }).catch(() => { setMsg('Senden fehlgeschlagen', true); render(); });
    },
    close() { clearInterval(timer); r.leave().catch(() => {}); },
  };
}

// ---------- Eingaben ----------
app.addEventListener('input', e => {
  if (e.target.id === 'namein') { G.name = e.target.value.replace(/[<>&"'`]/g, '').slice(0, 14); saveSettings(); return; }
  if (e.target.id === 'roundrange') { G.rounds = +e.target.value; const l = document.getElementById('roundlbl'); if (l) l.textContent = G.rounds; return; }
  if (e.target.id !== 'clockrange') return;
  G.clockMin = +e.target.value;
  const l = document.getElementById('clocklbl'); if (l) l.textContent = clockLabel(G.clockMin);
});
app.addEventListener('change', e => {
  if (e.target.id === 'clockrange' || e.target.id === 'roundrange') { saveSettings(); render(); }
  if (e.target.id === 'advbox') { G.adv = e.target.checked; if (!G.adv) G.aura = null; saveSettings(); render(); }
});
app.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const a = el.dataset.act;
  switch (a) {
    case 'single': startSingle(); break;
    case 'duel': closeNet(); G.screen = 'lobby'; G.code = ''; setMsg(''); render(); break;
    case 'rules': G.ruleBack = 'start'; G.screen = 'rules'; render(); window.scrollTo(0, 0); break;
    case 'rulesIngame': G.menu = false; G.ruleBack = 'game'; G.screen = 'rules'; render(); window.scrollTo(0, 0); break;
    case 'back': G.screen = G.ruleBack; render(); break;
    case 'leave': closeNet(); G.mode = null; G.state = null; G.me = 0; G.screen = 'start'; G.menu = false; setMsg(''); render(); break;
    case 'create': startDuel(newCode(), 0); break;
    case 'multi': closeNet(); G.mode = 'multi'; G.state = null; G.me = -1; G.screen = 'mlobby'; G.code = ''; setMsg(''); render(); break;
    case 'mmode': G.mn = +el.dataset.n === 4 ? 4 : 3; saveSettings(); render(); break;
    case 'mcreate': startMulti(newCode(), true); break;
    case 'mjoin': {
      const v = (document.getElementById('codein').value || '').toUpperCase().trim();
      if (!/^[A-Z0-9]{4}$/.test(v)) { setMsg('Der Code hat 4 Zeichen', true); render(); break; }
      startMulti(v, false); break;
    }
    case 'toPick': if (G.state && G.me >= 0 && !G.state.picks[G.me]) { G.picks = []; G.aura = null; G.screen = 'pick'; setMsg(''); render(); window.scrollTo(0, 0); } break;
    case 'toLobby': G.screen = 'mlobby'; render(); break;
    case 'seatTo': if (G.net && G.me >= 0) G.net.send({ t: 'seat', p: G.me, to: +el.dataset.k }); break;
    case 'addBot': if (G.net && G.me === 0) G.net.send({ t: 'bot', p: 0, seat: +el.dataset.k }); break;
    case 'rmBot': if (G.net && G.me === 0) G.net.send({ t: 'unbot', p: 0, seat: +el.dataset.k }); break;
    case 'join': {
      const v = (document.getElementById('codein').value || '').toUpperCase().trim();
      if (!/^[A-Z0-9]{4}$/.test(v)) { setMsg('Der Code hat 4 Zeichen', true); render(); break; }
      startDuel(v, 1); break;
    }
    case 'share': {
      const url = G.net && G.net.shareUrl;
      if (!url) break;
      if (navigator.share) navigator.share({ title: isMulti() ? 'Nodes – Multiplayer' : 'Nodes – Duell', text: (isMulti() ? 'Spiel Nodes mit uns! Code ' : 'Spiel Nodes gegen mich! Code ') + G.code, url }).catch(() => {});
      else if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => { setMsg('Link kopiert'); render(); });
      break;
    }
    case 'toggle': {
      const h = el.dataset.h, c = G.picks.filter(x => x === h).length;
      if (c < E.MAX_SAME && G.picks.length < 3) G.picks.push(h);
      else G.picks = G.picks.filter(x => x !== h);
      render(); break;
    }
    case 'aura': G.aura = el.dataset.a; render(); break;
    case 'finishAbility': {
      const P_ = G.pending;
      if (!P_ || !P_.chosen || !P_.chosen.length) break;
      const a = { t: 'ability', from: P_.from, kind: P_.mode, target: P_.chosen[0] };
      if (P_.chosen.length > 1) a.target2 = P_.chosen[1];
      if (P_.copy) a.copy = true;
      act(a); break;
    }
    case 'randomPick': {
      // Zufällige Helden (und Aura) und direkt los
      G.picks = pickHeroes();
      const adv = G.mode === 'single' ? G.adv : !!(G.state && G.state.adv);
      G.aura = adv ? pickAura() : null;
      confirmPick(); break;
    }
    case 'confirmPick': confirmPick(); break;
    case 'cell': onCell(+el.dataset.i); break;
    case 'stack': act({ t: 'stack', at: G.sel }); break;
    case 'mkhero': act({ t: 'hero', at: G.sel, h: el.dataset.h }); break;
    case 'ability': {
      const kind = el.dataset.kind, copy = el.dataset.copy === '1', s = G.state, c = s.cells[G.sel];
      const t = copy ? c.as : c.h;
      if (!E.needsTarget(t, kind)) { act(copy ? { t: 'ability', from: G.sel, kind, copy } : { t: 'ability', from: G.sel, kind }); break; }
      if (G.pending && G.pending.mode === kind && !!G.pending.copy === copy) { selectUnit(G.sel); render(); break; }
      G.pending = { mode: kind, copy, from: G.sel, chosen: [], targets: E.targets(s, G.sel, kind, copy) };
      render(); break;
    }
    case 'end': if (isMyTurn()) act({ t: 'end' }); break;
    case 'menu': G.menu = true; render(); break;
    case 'level': G.level = el.dataset.l; saveSettings(); render(); break;
    case 'toggleFx': G.bigFx = !G.bigFx; saveSettings(); render(); break;
    case 'closeMenu': G.menu = false; render(); break;
    case 'resign':
      G.menu = false;
      if (G.mode === 'single') { G.mode = null; G.screen = 'start'; render(); }
      else if (G.state && G.state.phase === 'play') act({ t: 'resign' });
      else { closeNet(); G.screen = 'start'; render(); }
      break;
  }
});

if (location.hash === '#debug') window.__nodes = { G, render, setState, E };

// Direktlink ?r=CODE öffnet das Duell
const rq = new URLSearchParams(location.search).get('r');
const mq = new URLSearchParams(location.search).get('m');
if (rq && /^[A-Z0-9]{4}$/i.test(rq) && !(window.claude && window.claude.use)) startDuel(rq.toUpperCase(), 1);
else if (mq && /^[A-Z0-9]{4}$/i.test(mq) && !(window.claude && window.claude.use)) startMulti(mq.toUpperCase(), false);
else render();
