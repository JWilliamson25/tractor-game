/* Tractor (拖拉机 / Sheng Ji) — 3 decks, 4 players, 39 cards each + 6-card kitty */
(function (root) {
'use strict';
const SUIT_SYM = ['♠\uFE0E', '♥\uFE0E', '♣\uFE0E', '♦\uFE0E']; // text style, not emoji
const SUIT_NAME = ['spades', 'hearts', 'clubs', 'diamonds'];
const RANK_TXT = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const NDECKS = 3, KITTY = 6, HAND = 39, DEALT = HAND * 4;
const TOTAL_POINTS = 100 * NDECKS;          // 300
const THRESHOLD = 40 * NDECKS;              // 120 to take the deal
const STEP = 20 * NDECKS;                   // 60 per level
const NAMES = ['You', 'Jun', 'Mei', 'Lin'];
const JACK = 9; // rank index of J

function makeDeck() {
  const d = []; let id = 0;
  for (let k = 0; k < NDECKS; k++) {
    for (let s = 0; s < 4; s++) for (let r = 0; r < 13; r++) d.push({ id: id++, s, r });
    d.push({ id: id++, s: 4, r: 13 }); // small joker
    d.push({ id: id++, s: 4, r: 14 }); // big joker
  }
  return d;
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
const team = (seat) => seat % 2;
const partnerOf = (seat) => (seat + 2) % 4;
const isTrump = (c, x) => c.s === 4 || c.r === x.level || c.s === x.trump;
const esuit = (c, x) => (isTrump(c, x) ? 'T' : c.s);
const suitIdx = (su) => (su === 'T' ? 4 : su);
function ov(c, x) {
  if (c.s === 4) { if (x.trump < 0) return c.r === 14 ? 14 : 13; return c.r === 14 ? 15 : 14; }
  if (c.r === x.level) return c.s === x.trump ? 13 : 12;
  return c.r < x.level ? c.r : c.r - 1;
}
const pts = (c) => (c.s === 4 ? 0 : c.r === 3 ? 5 : (c.r === 8 || c.r === 11) ? 10 : 0);
const sumPts = (cs) => cs.reduce((a, c) => a + pts(c), 0);
const ckey = (c) => c.s * 16 + c.r;
function cardText(c) {
  if (c.s === 4) return c.r === 14 ? 'Big Joker' : 'Small Joker';
  return RANK_TXT[c.r] + SUIT_SYM[c.s];
}
function suitLabel(su) { return su === 'T' ? 'trump' : SUIT_NAME[su]; }

function groupCards(cards, x) {
  const m = new Map();
  for (const c of cards) { const k = ckey(c); if (!m.has(k)) m.set(k, []); m.get(k).push(c); }
  const g = [];
  for (const [key, cs] of m) g.push({ key, cards: cs, n: cs.length, ov: ov(cs[0], x) });
  g.sort((a, b) => a.ov - b.ov || a.key - b.key);
  return g;
}

/* A legal lead: single, pair, triple, or tractor (2+ consecutive pairs or triples) of one suit */
function classify(cards, x) {
  if (!cards || !cards.length) return null;
  const su = esuit(cards[0], x);
  if (cards.some((c) => esuit(c, x) !== su)) return null;
  const g = groupCards(cards, x);
  const w = g[0].n;
  if (g.some((q) => q.n !== w)) return null;
  if (g.length === 1) return { w, k: 1, suit: su, top: g[0].ov };
  if (w < 2) return null;
  for (let i = 1; i < g.length; i++) if (g[i].ov !== g[i - 1].ov + 1) return null;
  return { w, k: g.length, suit: su, top: g[g.length - 1].ov };
}
function shapeName(c) {
  if (c.k === 1) return c.w === 1 ? 'single' : c.w === 2 ? 'pair' : 'triple';
  return `tractor of ${c.k} ${c.w === 2 ? 'pairs' : 'triples'}`;
}

/* All units of exactly shape (w,k) that can be cut from `cards` (assumed one suit) */
function findUnits(cards, w, k, x, exact) {
  const g = groupCards(cards, x).filter((q) => (exact ? q.n === w : q.n >= w));
  if (k === 1) return g.map((q) => q.cards.slice(0, w));
  const byOv = new Map();
  for (const q of g) { if (!byOv.has(q.ov)) byOv.set(q.ov, []); byOv.get(q.ov).push(q); }
  const res = [];
  const ovs = [...byOv.keys()].sort((a, b) => a - b);
  for (const v of ovs) {
    let ok = true;
    for (let j = 0; j < k; j++) if (!byOv.has(v + j)) { ok = false; break; }
    if (!ok) continue;
    const u = [];
    for (let j = 0; j < k; j++) u.push(...byOv.get(v + j)[0].cards.slice(0, w));
    res.push(u);
  }
  return res;
}
function countPT(cards, x) {
  let T = 0, P = 0;
  for (const q of groupCards(cards, x)) { if (q.n >= 3) T++; else if (q.n === 2) P++; }
  return { T, P };
}

/* Split one suit's cards into combinations: longest tractors first, then triples, pairs, singles */
function decompose(cards, x) {
  const g = groupCards(cards, x).map((q) => ({ ov: q.ov, n: q.n, cards: q.cards.slice() }));
  const comps = [];
  for (const w of [3, 2]) {
    for (;;) {
      const avail = g.filter((q) => q.n >= w).sort((a, b) => a.ov - b.ov);
      let best = null, run = [];
      for (const q of avail) {
        if (run.length && run[run.length - 1].ov === q.ov) continue;
        if (run.length && run[run.length - 1].ov + 1 !== q.ov) run = [];
        run.push(q);
        if (run.length >= 2 && (!best || run.length > best.length)) best = run.slice();
      }
      if (!best) break;
      const cs = [];
      for (const q of best) { cs.push(...q.cards.splice(0, w)); q.n -= w; }
      comps.push({ w, k: best.length, top: best[best.length - 1].ov, cards: cs });
    }
  }
  for (const q of g) if (q.n > 0) comps.push({ w: q.n, k: 1, top: q.ov, cards: q.cards.splice(0, q.n) });
  comps.sort((a, b) => b.w * b.k - a.w * a.k || b.w - a.w || a.top - b.top);
  return comps;
}
const sigOf = (comps) => comps.map((c) => c.w + 'x' + c.k).sort().join(',');
const mainTop = (comps) => { const m = comps[0]; let t = -1; for (const c of comps) if (c.w * c.k === m.w * m.k && c.w === m.w) t = Math.max(t, c.top); return t; };
/* Describe a lead. A throw (甩牌) is several combinations of one suit led together. */
function leadDesc(cards, x) {
  const c = classify(cards, x);
  if (c) return Object.assign({}, c, { N: cards.length, throw: false, comps: [Object.assign({}, c, { cards })] });
  if (!cards.length) return null;
  const su = esuit(cards[0], x);
  if (cards.some((q) => esuit(q, x) !== su)) return null;
  const comps = decompose(cards, x);
  return { suit: su, N: cards.length, throw: true, comps, w: 0, k: 0, top: mainTop(comps) };
}
function unitNeed(lead) {
  if (lead.throw) {
    let T = 0, P = 0;
    for (const c of lead.comps) { if (c.w === 3) T += c.k; else if (c.w === 2) P += c.k; }
    return { T, P };
  }
  return lead.w === 3 ? { T: lead.k, P: 0 } : lead.w === 2 ? { T: 0, P: lead.k } : { T: 0, P: 0 };
}
/* Can any other player beat a piece of this throw? Returns the piece the thrower must play instead. */
function throwCheck(G, seat, cards) {
  const x = ctx(G);
  const d = leadDesc(cards, x);
  let fail = null;
  for (const comp of d.comps) {
    for (let o = 0; o < 4; o++) {
      if (o === seat) continue;
      const Hs = G.hands[o].filter((c) => esuit(c, x) === d.suit);
      if (findUnits(Hs, comp.w, comp.k, x).some((u) => classify(u, x).top > comp.top)) {
        if (!fail || comp.top < fail.comp.top || (comp.top === fail.comp.top && comp.cards.length < fail.comp.cards.length)) fail = { comp, by: o };
        break;
      }
    }
  }
  return fail ? { forced: fail.comp.cards, by: fail.by } : null;
}

function validateLead(play, x) {
  if (!play.length) return { ok: false, msg: 'Pick cards to lead.' };
  const c = classify(play, x);
  if (c) return { ok: true, cls: c };
  if (play.every((q) => esuit(q, x) === esuit(play[0], x))) return { ok: true, throw: true };
  return { ok: false, msg: 'Everything you lead has to be from one suit (trumps count as one suit).' };
}

function validateFollow(play, hand, lead, x) {
  const N = lead.N;
  if (play.length !== N) return { ok: false, msg: `Play ${N} card${N > 1 ? 's' : ''} to match the lead.` };
  const Hs = hand.filter((c) => esuit(c, x) === lead.suit);
  const Ps = play.filter((c) => esuit(c, x) === lead.suit);
  const sn = suitLabel(lead.suit);
  if (Hs.length >= N) {
    if (Ps.length !== N) return { ok: false, msg: `You still have ${sn}, so you have to follow with ${sn}.` };
    // House rule: a pair you owe never has to come out of a three-of-a-kind (exact pairs only).
    if (!lead.throw && lead.w >= 2 && findUnits(Hs, lead.w, lead.k, x, true).length) {
      const c = classify(play, x);
      if (!c || c.w !== lead.w || c.k !== lead.k) return { ok: false, msg: `You hold a matching ${shapeName(lead)} in ${sn}, so you have to play it.` };
    } else if (lead.throw || lead.w >= 2) {
      const need = unitNeed(lead);
      const H = countPT(Hs, x), P = countPT(play, x);
      const t = Math.min(need.T, H.T);
      const preq = Math.min(need.P + need.T - t, H.P);
      if (P.T < t) return { ok: false, msg: `You have to include ${t} triple${t > 1 ? 's' : ''} of ${sn} when you hold them.` };
      if (P.P + P.T - t < preq) return { ok: false, msg: `You have to include ${preq} pair${preq > 1 ? 's' : ''} of ${sn} when you hold them.` };
    }
  } else if (Ps.length !== Hs.length) {
    return { ok: false, msg: `Play all your ${sn} first, then fill in with other cards.` };
  }
  return { ok: true };
}

/* index into plays of the current winner */
function trickWinner(plays, x) {
  const ld = leadDesc(plays[0].cards, x);
  if (ld.throw) {
    if (ld.suit === 'T') return 0;
    const sig = sigOf(ld.comps);
    let best = 0, bt = -1;
    for (let i = 1; i < plays.length; i++) {
      const p = plays[i].cards;
      if (p.some((c) => !isTrump(c, x))) continue;
      const d = decompose(p, x);
      if (sigOf(d) !== sig) continue;
      const t = mainTop(d);
      if (t > bt) { best = i; bt = t; }
    }
    return best;
  }
  const lead = classify(plays[0].cards, x);
  let best = 0, bestC = lead;
  for (let i = 1; i < plays.length; i++) {
    const c = classify(plays[i].cards, x);
    if (!c || c.w !== lead.w || c.k !== lead.k) continue;
    if (c.suit === lead.suit && bestC.suit === lead.suit) {
      if (c.top > bestC.top) { best = i; bestC = c; }
    } else if (c.suit === 'T' && lead.suit !== 'T') {
      if (bestC.suit !== 'T' || c.top > bestC.top) { best = i; bestC = c; }
    }
  }
  return best;
}

/* ---------------- game state ---------------- */
function ctx(G) {
  let trump = -2; // unknown yet
  if (G.trump !== null && G.trump !== undefined) trump = G.trump;
  else if (G.decl) trump = G.decl.joker ? -1 : G.decl.suit;
  return { level: G.level, trump };
}

function newGame() {
  const G = { levels: [0, 0], handNo: 0, dealer: null, nextDealer: null, history: [], winner: null };
  startHand(G);
  return G;
}
function startHand(G) {
  G.handNo++;
  if (G.nextDealer !== null) G.dealer = G.nextDealer;
  G.level = G.dealer === null ? 0 : G.levels[team(G.dealer)];
  G.deck = shuffle(makeDeck());
  G.dealIdx = 0;
  G.dealStart = G.dealer === null ? 0 : G.dealer;
  G.hands = [[], [], [], []];
  G.kitty = G.deck.slice(DEALT);
  G.buried = [];
  G.decl = null; G.trump = null; G.flipped = null;
  G.chaodi = G.dealer !== null; // from hand 2: kitty goes around the table
  G.burier = null; G.cd = null;
  G.points = 0; G.pointCards = [];
  G.played = [];
  G.playedBy = [[], [], [], []]; // each player's pile this hand
  G.voids = [0, 1, 2, 3].map(() => [false, false, false, false, false]);
  G.trick = null; G.lastTrick = null; G.result = null;
  G.phase = 'deal';
  G.msg = '';
}
function dealRound(G) {
  for (let i = 0; i < 4; i++) {
    const seat = (G.dealStart + i) % 4;
    G.hands[seat].push(G.deck[G.dealIdx++]);
  }
  return G.dealIdx >= DEALT;
}

function declStrength(o) { return o.count * 10 + (o.joker === 'BJ' ? 2 : o.joker === 'SJ' ? 1 : 0); }
function declOptions(G, seat) {
  const cur = G.decl ? G.decl.str : 0;
  const hand = G.hands[seat];
  const out = [];
  for (let s = 0; s < 4; s++) {
    const n = hand.filter((c) => c.s === s && c.r === G.level).length;
    for (let m = 1; m <= n; m++) {
      const o = { seat, suit: s, count: m, joker: null }; o.str = declStrength(o);
      if (o.str > cur) { out.push(o); break; }
    }
  }
  for (const [jr, name] of [[13, 'SJ'], [14, 'BJ']]) {
    const n = hand.filter((c) => c.s === 4 && c.r === jr).length;
    for (let m = 2; m <= n; m++) {
      const o = { seat, suit: -1, count: m, joker: name }; o.str = declStrength(o);
      if (o.str > cur) { out.push(o); break; }
    }
  }
  return out;
}
function declare(G, o) {
  G.decl = { seat: o.seat, suit: o.suit, count: o.count, joker: o.joker, str: declStrength(o) };
}
function declText(d) {
  if (!d) return '';
  if (d.joker) return `${d.count} ${d.joker === 'BJ' ? 'big' : 'small'} jokers (no trump suit)`;
  return `${SUIT_SYM[d.suit]}${d.count > 1 ? ' ×' + d.count : ''}`;
}

/* After the deal: settle trump and the dealer, hand the kitty over */
function finishDeclare(G) {
  if (!G.decl) {
    // a computer player with any level card takes it
    let best = null;
    for (const seat of [1, 2, 3]) {
      const o = AI.declare(G, seat, true);
      if (o) { const r = AI.declRatio(G, seat, o); if (!best || r > best.r) best = { o, r }; }
    }
    if (best) declare(G, best.o);
  }
  if (G.decl) {
    G.trump = G.decl.joker ? -1 : G.decl.suit;
  } else {
    // nobody could declare: flip the kitty, highest card names trump
    let top = G.kitty[0];
    for (const c of G.kitty) if (c.r > top.r) top = c;
    G.flipped = top;
    G.trump = top.s === 4 ? -1 : top.s;
  }
  if (G.dealer === null) G.dealer = G.decl ? G.decl.seat : 0;
  G.level = G.levels[team(G.dealer)];
  G.hands[G.dealer].push(...G.kitty);
  G.kittyShown = G.kitty.slice();
  G.kitty = [];
  G.burier = G.dealer;
  G.phase = 'bury';
}
/* After the deal. Hand 1: the highest declaration takes the kitty.
   Later hands: the dealer picks up first, then the kitty goes around the table (炒地皮). */
function afterDeal(G) {
  if (!G.chaodi) return finishDeclare(G);
  G.burier = G.dealer;
  G.hands[G.dealer].push(...G.kitty);
  G.kittyShown = G.kitty.slice();
  G.kitty = [];
  G.cd = { holder: G.dealer, turn: null, dealerOpen: true, log: [{ seat: G.dealer, text: 'picks up the kitty' }] };
  G.phase = 'bury';
}
function chaodiAct(G, seat, o) {
  if (o) {
    declare(G, o);
    G.cd.holder = seat;
    G.burier = seat;
    G.kittyShown = G.buried.slice();
    G.hands[seat].push(...G.buried);
    G.buried = [];
    G.cd.log.push({ seat, text: `shows ${declText(G.decl)} and takes the kitty`, bid: true });
    G.phase = 'bury';
  } else {
    G.cd.log.push({ seat, text: 'passes' });
    G.cd.turn = (seat + 1) % 4;
    if (G.cd.turn === G.cd.holder) finishChaodi(G);
  }
}
function finishChaodi(G) {
  if (G.decl) G.trump = G.decl.joker ? -1 : G.decl.suit;
  else {
    let top = G.buried[0];
    for (const c of G.buried) if (c.r > top.r) top = c;
    G.flipped = top;
    G.trump = top.s === 4 ? -1 : top.s;
  }
  G.phase = 'play';
  G.trick = { leader: G.dealer, plays: [] };
}
function bury(G, ids) {
  const b = G.burier;
  const h = G.hands[b];
  if (ids.length !== KITTY) throw new Error('bury needs 6');
  G.buried = h.filter((c) => ids.includes(c.id));
  G.hands[b] = h.filter((c) => !ids.includes(c.id));
  if (G.chaodi) {
    if (G.cd.dealerOpen) {
      G.cd.dealerOpen = false;
      if (G.decl) G.cd.log.push({ seat: b, text: `shows ${declText(G.decl)}`, bid: true });
    }
    G.cd.log.push({ seat: b, text: 'buries 6 cards' });
    G.cd.turn = (b + 1) % 4;
    G.phase = 'chaodi';
    return;
  }
  G.phase = 'play';
  G.trick = { leader: G.dealer, plays: [] };
}
function turnSeat(G) { return (G.trick.leader + G.trick.plays.length) % 4; }
function leadCls(G) { return G.trick.plays.length ? leadDesc(G.trick.plays[0].cards, ctx(G)) : null; }

function checkPlay(G, seat, cards) {
  const x = ctx(G);
  if (!G.trick.plays.length) return validateLead(cards, x);
  return validateFollow(cards, G.hands[seat], leadCls(G), x);
}
function playCards(G, seat, cards) {
  const x = ctx(G);
  const v = checkPlay(G, seat, cards);
  if (!v.ok) throw new Error('illegal play by ' + seat + ': ' + v.msg + ' ' + cards.map(cardText).join(' '));
  G.throwFail = null;
  if (!G.trick.plays.length && v.throw) {
    const f = throwCheck(G, seat, cards);
    if (f) { G.throwFail = { seat, tried: cards, forced: f.forced, by: f.by }; cards = f.forced; }
  }
  const ids = cards.map((c) => c.id);
  if (G.trick.plays.length) {
    const lead = leadCls(G);
    const inSuit = cards.filter((c) => esuit(c, x) === lead.suit).length;
    if (inSuit < cards.length) G.voids[seat][suitIdx(lead.suit)] = true;
  }
  G.hands[seat] = G.hands[seat].filter((c) => !ids.includes(c.id));
  G.trick.plays.push({ seat, cards });
  for (const c of cards) G.played.push(ckey(c));
  if (!G.playedBy) G.playedBy = [[], [], [], []];
  G.playedBy[seat].push(...cards);
  return G.trick.plays.length === 4;
}
function resolveTrick(G) {
  const x = ctx(G);
  const plays = G.trick.plays;
  const wi = trickWinner(plays, x);
  const winner = plays[wi].seat;
  const all = plays.flatMap((p) => p.cards);
  const p = sumPts(all);
  const attackers = team(winner) !== team(G.dealer);
  if (attackers && p) { G.points += p; G.pointCards.push(...all.filter((c) => pts(c))); }
  G.lastTrick = { plays, winner, points: p };
  if (G.hands.every((h) => h.length === 0)) { endHand(G, winner, leadDesc(plays[0].cards, x), plays[wi].cards); return winner; }
  G.trick = { leader: winner, plays: [] };
  return winner;
}
/* Levels can't skip J (it must be played) or go past A */
function raise(level, up) {
  let n = level + up;
  if (level < JACK && n > JACK) n = JACK;
  return Math.min(12, n);
}
function endHand(G, lastWinner, lastLead, lastWinCards) {
  const dTeam = team(G.dealer), aTeam = 1 - dTeam;
  const kittyPts = sumPts(G.buried);
  let mult = 0, bonus = 0;
  if (team(lastWinner) === aTeam) {
    mult = lastLead.comps.some((c) => c.k >= 2) ? 8 : 2 * Math.max(...lastLead.comps.map((c) => c.w));
    bonus = kittyPts * mult;
    G.points += bonus;
  }
  const p = G.points;
  const R = { points: p, kittyPts, mult, bonus, dealerTeam: dTeam, levelBefore: G.levels.slice(), dealer: G.dealer, burier: G.burier, buried: G.buried.slice() };
  if (p < THRESHOLD) {
    const up = p === 0 ? 3 : p < STEP ? 2 : 1;
    R.winTeam = dTeam; R.up = up; R.swap = false;
    if (G.levels[dTeam] === 12) { G.winner = dTeam; }
    else G.levels[dTeam] = raise(G.levels[dTeam], up);
    // Jack rule: point-scoring team sitting on J misses 120 and the dealers take the last trick with Jacks only -> back to 2
    if (G.levels[aTeam] === JACK && team(lastWinner) === dTeam && lastWinCards && lastWinCards.length && lastWinCards.every((c) => c.s !== 4 && c.r === JACK)) {
      G.levels[aTeam] = 0; R.jackDrop = aTeam;
    }
    G.nextDealer = partnerOf(G.dealer);
  } else {
    const up = Math.floor((p - THRESHOLD) / STEP);
    R.winTeam = aTeam; R.up = up; R.swap = true;
    G.levels[aTeam] = raise(G.levels[aTeam], up);
    G.nextDealer = (G.dealer + 1) % 4;
  }
  if (G.winner === null) R.up = Math.max(0, G.levels[R.winTeam] - R.levelBefore[R.winTeam]); // after J/A caps
  R.levelAfter = G.levels.slice();
  G.result = R;
  G.history.push({ hand: G.handNo, dealer: G.dealer, level: G.level, points: p, winTeam: R.winTeam, up: R.up, swap: R.swap, jackDrop: R.jackDrop });
  G.phase = G.winner !== null ? 'gameOver' : 'handEnd';
}
function nextHand(G) { startHand(G); }

/* ---------------- computer players ---------------- */
const IDS = [];
for (let s = 0; s < 4; s++) for (let r = 0; r < 13; r++) IDS.push({ s, r });
IDS.push({ s: 4, r: 13 }, { s: 4, r: 14 });

function unseenFor(G, seat) {
  const m = new Map();
  for (const c of IDS) m.set(ckey(c), NDECKS);
  const sub = (k) => m.set(k, m.get(k) - 1);
  for (const c of G.hands[seat]) sub(ckey(c));
  for (const k of G.played) sub(k);
  if (seat === G.burier) for (const c of G.buried) sub(ckey(c));
  return m;
}
function isBoss(unit, x, unseen) {
  const c = classify(unit, x);
  if (!c) { const d = leadDesc(unit, x); return !!d && d.comps.every((q) => isBoss(q.cards, x, unseen)); }
  for (const id of IDS) {
    if ((unseen.get(ckey(id)) || 0) < c.w) continue;
    if (esuit(id, x) === c.suit && ov(id, x) > c.top) return false;
  }
  return true;
}
function trumpsOut(unseen, x) {
  let n = 0;
  for (const id of IDS) if (isTrump(id, x)) n += Math.max(0, unseen.get(ckey(id)) || 0);
  return n;
}
const jackThreat = (G, seat) => team(seat) === team(G.dealer) && G.levels[1 - team(G.dealer)] === JACK;
/* Cards worth saving for the last trick: best trump pair + best trump single (and Jacks under the Jack rule) */
function reserveFor(G, seat, x) {
  const hand = G.hands[seat], res = new Set();
  if (hand.length > 12) return res;
  const tr = hand.filter((c) => isTrump(c, x));
  if (tr.length < hand.length - 1) {
    const pairs = findUnits(tr, 2, 1, x).sort((a, b) => classify(b, x).top - classify(a, x).top);
    if (pairs.length) pairs[0].forEach((c) => res.add(c.id));
    const singles = tr.filter((c) => !res.has(c.id)).sort((a, b) => ov(b, x) - ov(a, x));
    if (singles.length) res.add(singles[0].id);
  }
  if (jackThreat(G, seat)) hand.filter((c) => c.s !== 4 && c.r === JACK).forEach((c) => res.add(c.id));
  return res;
}
const withRes = (key, res) => (c) => key(c) + (res.has(c.id) ? 100 : 0);
const lowKey = (x) => (c) => (isTrump(c, x) ? 40 : 0) + ov(c, x) + pts(c) * 1.2;
const pointsKey = (x) => (c) => (isTrump(c, x) ? 40 : 0) - pts(c) * 3 + ov(c, x) * 0.2;
const sumKey = (cs, f) => cs.reduce((a, c) => a + f(c), 0);

function constructFollow(hand, lead, x, key) {
  const N = lead.N;
  const by = (a, b) => key(a) - key(b);
  const Hs = hand.filter((c) => esuit(c, x) === lead.suit).sort(by);
  const others = hand.filter((c) => esuit(c, x) !== lead.suit).sort(by);
  if (Hs.length <= N) { const p = Hs.slice(); for (const c of others) if (p.length < N) p.push(c); return p; }
  if (!lead.throw && lead.w === 1) return [Hs[0]];
  const units = lead.throw ? [] : findUnits(Hs, lead.w, lead.k, x, true);
  if (units.length) { units.sort((a, b) => sumKey(a, key) - sumKey(b, key)); return units[0]; }
  let chosen = [], rest = Hs.slice();
  const take = (n, size) => {
    for (let t = 0; t < n; t++) {
      const g = groupCards(rest, x).filter((q) => q.n === size).map((q) => q.cards.slice(0, size));
      if (!g.length) break;
      g.sort((a, b) => sumKey(a, key) - sumKey(b, key));
      chosen.push(...g[0]);
      rest = rest.filter((c) => !g[0].includes(c));
    }
  };
  const H = countPT(Hs, x), need = unitNeed(lead);
  const t = Math.min(need.T, H.T);
  take(t, 3);
  take(Math.min(need.P + need.T - t, H.P), 2);
  rest.sort(by);
  for (const c of rest) if (chosen.length < N) chosen.push(c);
  return chosen;
}

function winCandidates(G, seat) {
  const x = ctx(G), hand = G.hands[seat], plays = G.trick.plays;
  const lead = leadDesc(plays[0].cards, x);
  const N = lead.N;
  const Hs = hand.filter((c) => esuit(c, x) === lead.suit);
  const out = [];
  if (lead.throw) {
    if (Hs.length || lead.suit === 'T') return out;
    let tr = hand.filter((c) => isTrump(c, x)); const pick = [];
    const k0 = lowKey(x);
    for (const comp of lead.comps) {
      const u = findUnits(tr, comp.w, comp.k, x).sort((a, b) => sumKey(a, k0) - sumKey(b, k0))[0];
      if (!u) return out;
      pick.push(...u); tr = tr.filter((c) => !u.includes(c));
    }
    const sim = plays.concat([{ seat, cards: pick }]);
    if (trickWinner(sim, x) === sim.length - 1 && validateFollow(pick, hand, lead, x).ok) out.push(pick);
    return out;
  }
  const best = classify(plays[trickWinner(plays, x)].cards, x);
  if (Hs.length >= N) {
    if (best.suit === lead.suit) for (const u of findUnits(Hs, lead.w, lead.k, x)) { if (classify(u, x).top > best.top) out.push(u); }
  } else if (Hs.length === 0 && lead.suit !== 'T') {
    const tr = hand.filter((c) => isTrump(c, x));
    for (const u of findUnits(tr, lead.w, lead.k, x)) { const c = classify(u, x); if (best.suit !== 'T' || c.top > best.top) out.push(u); }
  }
  const k = lowKey(x);
  return out.filter((u) => validateFollow(u, hand, lead, x).ok).sort((a, b) => sumKey(a, k) - sumKey(b, k));
}

const AI = {
  declRatio(G, seat, o) {
    const h = G.hands[seat];
    const n = h.filter((c) => c.s === 4 || c.r === G.level || (!o.joker && c.s === o.suit)).length;
    return n / Math.max(1, h.length);
  },
  declare(G, seat, final) {
    const opts = declOptions(G, seat).filter((o) => !o.joker);
    if (!opts.length) return null;
    if (G.decl && team(G.decl.seat) === team(seat)) return null;
    const d = G.hands[seat].length;
    let best = null, br = -1;
    for (const o of opts) { const r = AI.declRatio(G, seat, o); if (r > br) { br = r; best = o; } }
    if (G.decl) return (best.count >= 2 && br >= 0.36 && d >= 15 && Math.random() < 0.5) ? best : null;
    if (final) return br >= 0.22 ? best : null;
    if (d >= 10 && br >= 0.38 && Math.random() < 0.35) return best;
    if (d >= 24 && br >= 0.32 && Math.random() < 0.25) return best;
    return null;
  },
  dealerShow(G) {
    const seat = G.burier;
    const opts = declOptions(G, seat).filter((o) => !o.joker);
    let best = null, br = -1;
    for (const o of opts) { const r = AI.declRatio(G, seat, o); if (r > br) { br = r; best = o; } }
    return best && br >= 0.27 ? best : null;
  },
  chaodi(G, seat) {
    if (team(G.cd.holder) === team(seat) && G.decl) return null; // never steal from your own team
    const opts = declOptions(G, seat).filter((o) => !o.joker);
    if (!opts.length) return null;
    let best = null, br = -1;
    for (const o of opts) { const r = AI.declRatio(G, seat, o); if (r > br) { br = r; best = o; } }
    if (!G.decl) return br >= 0.3 ? best : null;
    const curR = G.decl.joker ? 0.2 : AI.declRatio(G, seat, { suit: G.decl.suit });
    if (br >= 0.37) return best;
    if (curR < 0.27 && br >= 0.32) return best;
    return null;
  },
  bury(G) {
    const x = ctx(G);
    let h = G.hands[G.burier].slice();
    const out = [];
    const attacker = team(G.burier) !== team(G.dealer); // attackers want points in the kitty (×2+ if they win the last trick)
    const trN = h.filter((c) => isTrump(c, x)).length;
    const ptW = attacker ? 1.5 : trN < 14 ? -5 : -2.5;
    for (let i = 0; i < KITTY; i++) {
      const len = [0, 0, 0, 0];
      for (const c of h) if (!isTrump(c, x)) len[c.s]++;
      const cnt = new Map();
      for (const c of h) cnt.set(ckey(c), (cnt.get(ckey(c)) || 0) + 1);
      let best = null, bs = -1e9;
      for (const c of h) {
        let s;
        if (isTrump(c, x)) s = -200 - ov(c, x);
        else {
          s = -ov(c, x) + pts(c) * ptW;
          if (cnt.get(ckey(c)) >= 2) s -= 40;
          if (c.r === 12) s -= 50;
          if (len[c.s] <= 5) s += (8 - len[c.s]) * 4;
        }
        if (s > bs) { bs = s; best = c; }
      }
      out.push(best.id);
      h = h.filter((c) => c !== best);
    }
    return out;
  },
  lead(G, seat) {
    const x = ctx(G), hand = G.hands[seat];
    const unseen = unseenFor(G, seat);
    const partner = partnerOf(seat);
    const opp = [(seat + 1) % 4, (seat + 3) % 4];
    const dealerTeam = team(seat) === team(G.dealer);
    const trumps = hand.filter((c) => isTrump(c, x)).length;
    const frac = trumps / hand.length;
    const res = reserveFor(G, seat, x);
    const tOut = trumpsOut(unseen, x);
    const oppNoTrump = opp.every((o) => G.voids[o][4]);
    const endgame = hand.length <= 12;
    const bySuit = new Map();
    for (const c of hand) { const su = esuit(c, x); if (!bySuit.has(su)) bySuit.set(su, []); bySuit.get(su).push(c); }
    let best = null, bs = -1e9;
    for (const [su, Hs] of bySuit) {
      const cands = [];
      for (const w of [3, 2]) for (let k = 2; ; k++) { const u = findUnits(Hs, w, k, x); if (!u.length) break; cands.push(...u); }
      cands.push(...findUnits(Hs, 3, 1, x), ...findUnits(Hs, 2, 1, x), ...findUnits(Hs, 1, 1, x));
      const si = suitIdx(su);
      const oppVoid = opp.some((o) => G.voids[o][si]);
      const pVoid = G.voids[partner][si];
      // throw (甩牌): every combination left in this suit is unbeatable, or at least two are
      const comps = decompose(Hs, x);
      if (comps.length >= 2 && !oppVoid) {
        const boss = comps.filter((q) => isBoss(q.cards, x, unseen));
        if (boss.length >= 2) {
          const u = boss.flatMap((q) => q.cards);
          let s = (su === 'T' ? 60 : 115) + u.length * 8 + (boss.length === comps.length ? 10 : 0) + Math.random() * 3;
          if (u.some((c) => res.has(c.id)) && u.length < hand.length) s -= 60;
          if (s > bs) { bs = s; best = u; }
        }
      }
      for (const u of cands) {
        const c = classify(u, x), size = u.length, p = sumPts(u);
        const boss = isBoss(u, x, unseen);
        let s;
        if (su !== 'T') {
          if (boss) { s = 100 + size * 10 + p * 2 + (endgame ? 15 : 0); if (oppVoid && tOut > 0) s -= 95; }
          else s = 20 + size * 3 - c.top * 1.2 - p * 3 + (Hs.length <= 3 && size === 1 ? 6 : 0) + (pVoid && !oppVoid ? 25 : 0) - (oppVoid ? 10 : 0);
        } else {
          if (boss) s = (dealerTeam || frac > 0.45 ? 70 : 35) + size * 10;
          else s = (frac > 0.5 ? 25 : 2) + size * 3 - c.top - p * 3 + (dealerTeam && tOut > 6 && frac > 0.35 ? 10 : 0);
          if (oppNoTrump && trumps < hand.length) s -= 50; // nobody left to pull trumps from
        }
        if (u.some((q) => res.has(q.id)) && u.length < hand.length) s -= 60; // save it for the last trick
        s += Math.random() * 3;
        if (s > bs) { bs = s; best = u; }
      }
    }
    return best;
  },
  follow(G, seat) {
    const x = ctx(G), hand = G.hands[seat], plays = G.trick.plays;
    const lead = leadDesc(plays[0].cards, x);
    const res = reserveFor(G, seat, x);
    const low = constructFollow(hand, lead, x, withRes(lowKey(x), res));
    const dump = constructFollow(hand, lead, x, withRes(pointsKey(x), res));
    const bi = trickWinner(plays, x);
    const bestSeat = plays[bi].seat;
    const bestC = classify(plays[bi].cards, x) || { suit: bi === 0 ? lead.suit : 'T' };
    const after = 3 - plays.length;
    const rem = []; for (let i = 1; i <= after; i++) rem.push((seat + i) % 4);
    const remOpp = rem.filter((s) => team(s) !== team(seat));
    const tp = sumPts(plays.flatMap((p) => p.cards));
    const unseen = unseenFor(G, seat);
    const si = suitIdx(lead.suit);
    const lastTrick = hand.length === lead.N; // this trick decides the kitty bonus
    const rk = withRes(lowKey(x), res);
    const wins = winCandidates(G, seat).sort((a, b) => sumKey(a, rk) - sumKey(b, rk));
    const ruffRiskOf = (cards) => lead.suit !== 'T' && !cards.every((c) => isTrump(c, x)) && remOpp.some((o) => G.voids[o][si]);
    const safeOf = (cards) => remOpp.length === 0 || (isBoss(cards, x, unseen) && !ruffRiskOf(cards));
    if (lastTrick && jackThreat(G, seat) && wins.length) {
      const jw = wins.find((u) => u.every((c) => c.s !== 4 && c.r === JACK));
      if (jw && safeOf(jw)) return jw;
    }
    if (bestSeat === partnerOf(seat)) {
      if (safeOf(plays[bi].cards)) return dump;
      // partner may get beaten: overtake with a sure winner when it matters
      if (lastTrick || tp >= 10) { const sure = wins.find((u) => safeOf(u)); if (sure) return sure; }
      return low;
    }
    if (wins.length) {
      const w0 = wins[0];
      const ruff = lead.suit !== 'T' && w0.every((c) => isTrump(c, x));
      const wc = classify(w0, x) || { top: mainTop(decompose(w0, x)) };
      const usesRes = w0.some((c) => res.has(c.id));
      const pricey = usesRes || w0.some((c) => c.s === 4 || c.r === G.level) || (ruff && wc.top >= 9);
      const boss = safeOf(w0);
      let take;
      if (lastTrick) take = true;
      else if (usesRes) take = tp >= 20 && boss;
      else if (remOpp.length === 0) take = tp + sumPts(w0) > 0 || !pricey;
      else if (boss) take = tp >= 5 || !pricey;
      else take = tp >= 10;
      if (take) return w0;
    }
    return low;
  },
  play(G, seat) { return G.trick.plays.length ? AI.follow(G, seat) : AI.lead(G, seat); },
};

function sortHand(cards, x) {
  const k = (c) => { const su = esuit(c, x); return (su === 'T' ? 4 : su) * 1000 + ov(c, x) * 10 + c.s; };
  return cards.slice().sort((a, b) => k(a) - k(b));
}

const API = {
  SUIT_SYM, SUIT_NAME, RANK_TXT, NAMES, NDECKS, KITTY, HAND, DEALT, TOTAL_POINTS, THRESHOLD, STEP,
  makeDeck, shuffle, team, partnerOf, isTrump, esuit, ov, pts, sumPts, ckey, cardText, suitLabel, classify, shapeName,
  JACK, raise, unseenFor, IDS, findUnits, decompose, leadDesc, throwCheck, validateLead, validateFollow, trickWinner, ctx, newGame, startHand, dealRound, declOptions, declare, declText,
  finishDeclare, afterDeal, chaodiAct, finishChaodi, bury, turnSeat, leadCls, checkPlay, playCards, resolveTrick, nextHand, AI, constructFollow, sortHand, lowKey, pointsKey,
};
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.TR = API;
})(this);
