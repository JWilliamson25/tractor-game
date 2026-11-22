/* Tractor (拖拉机 / Sheng Ji) — 3 decks, 4 players, 39 cards each + 6-card kitty */
(function (root) {
'use strict';
const SUIT_SYM = ['♠', '♥', '♣', '♦'];
const SUIT_NAME = ['spades', 'hearts', 'clubs', 'diamonds'];
const RANK_TXT = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const NDECKS = 3, KITTY = 6, HAND = 39, DEALT = HAND * 4;
const TOTAL_POINTS = 100 * NDECKS;          // 300
const THRESHOLD = 40 * NDECKS;              // 120 to take the deal
const STEP = 20 * NDECKS;                   // 60 per level
const NAMES = ['You', 'Jun', 'Mei', 'Lin'];

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
function findUnits(cards, w, k, x) {
  const g = groupCards(cards, x).filter((q) => q.n >= w);
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

function validateLead(play, x) {
  if (!play.length) return { ok: false, msg: 'Pick cards to lead.' };
  const c = classify(play, x);
  if (!c) return { ok: false, msg: 'Lead a single, pair, triple, or tractor (back-to-back pairs or triples in one suit).' };
  return { ok: true, cls: c };
}

function validateFollow(play, hand, lead, x) {
  const N = lead.w * lead.k;
  if (play.length !== N) return { ok: false, msg: `Play ${N} card${N > 1 ? 's' : ''} to match the lead.` };
  const Hs = hand.filter((c) => esuit(c, x) === lead.suit);
  const Ps = play.filter((c) => esuit(c, x) === lead.suit);
  const sn = suitLabel(lead.suit);
  if (Hs.length >= N) {
    if (Ps.length !== N) return { ok: false, msg: `You still have ${sn}, so you have to follow with ${sn}.` };
    if (lead.w >= 2) {
      if (findUnits(Hs, lead.w, lead.k, x).length) {
        const c = classify(play, x);
        if (!c || c.w !== lead.w || c.k !== lead.k) return { ok: false, msg: `You hold a matching ${shapeName(lead)} in ${sn}, so you have to play it.` };
      } else {
        const H = countPT(Hs, x), P = countPT(play, x);
        if (lead.w === 2) {
          const req = Math.min(lead.k, H.P + H.T);
          if (P.P + P.T < req) return { ok: false, msg: `You have to include ${req} pair${req > 1 ? 's' : ''} of ${sn} when you hold them.` };
        } else {
          const t = Math.min(lead.k, H.T);
          const preq = Math.min(lead.k - t, H.P + H.T - t);
          if (P.T < t) return { ok: false, msg: `You have to include ${t} triple${t > 1 ? 's' : ''} of ${sn} when you hold them.` };
          if (P.P + P.T - t < preq) return { ok: false, msg: `You have to include ${preq} pair${preq > 1 ? 's' : ''} of ${sn} when you hold them.` };
        }
      }
    }
  } else if (Ps.length !== Hs.length) {
    return { ok: false, msg: `Play all your ${sn} first, then fill in with other cards.` };
  }
  return { ok: true };
}

/* index into plays of the current winner */
function trickWinner(plays, x) {
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
  G.points = 0; G.pointCards = [];
  G.played = [];
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
  G.phase = 'bury';
}
function bury(G, ids) {
  const h = G.hands[G.dealer];
  if (ids.length !== KITTY) throw new Error('bury needs 6');
  G.buried = h.filter((c) => ids.includes(c.id));
  G.hands[G.dealer] = h.filter((c) => !ids.includes(c.id));
  G.phase = 'play';
  G.trick = { leader: G.dealer, plays: [] };
}
function turnSeat(G) { return (G.trick.leader + G.trick.plays.length) % 4; }
function leadCls(G) { return G.trick.plays.length ? classify(G.trick.plays[0].cards, ctx(G)) : null; }

function checkPlay(G, seat, cards) {
  const x = ctx(G);
  if (!G.trick.plays.length) return validateLead(cards, x);
  return validateFollow(cards, G.hands[seat], leadCls(G), x);
}
function playCards(G, seat, cards) {
  const x = ctx(G);
  const v = checkPlay(G, seat, cards);
  if (!v.ok) throw new Error('illegal play by ' + seat + ': ' + v.msg + ' ' + cards.map(cardText).join(' '));
  const ids = cards.map((c) => c.id);
  if (G.trick.plays.length) {
    const lead = leadCls(G);
    const inSuit = cards.filter((c) => esuit(c, x) === lead.suit).length;
    if (inSuit < cards.length) G.voids[seat][suitIdx(lead.suit)] = true;
  }
  G.hands[seat] = G.hands[seat].filter((c) => !ids.includes(c.id));
  G.trick.plays.push({ seat, cards });
  for (const c of cards) G.played.push(ckey(c));
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
  if (G.hands.every((h) => h.length === 0)) { endHand(G, winner, classify(plays[0].cards, x)); return winner; }
  G.trick = { leader: winner, plays: [] };
  return winner;
}
function endHand(G, lastWinner, lastLead) {
  const dTeam = team(G.dealer), aTeam = 1 - dTeam;
  const kittyPts = sumPts(G.buried);
  let mult = 0, bonus = 0;
  if (team(lastWinner) === aTeam) {
    mult = lastLead.k >= 2 ? 8 : 2 * lastLead.w;
    bonus = kittyPts * mult;
    G.points += bonus;
  }
  const p = G.points;
  const R = { points: p, kittyPts, mult, bonus, dealerTeam: dTeam, levelBefore: G.levels.slice(), dealer: G.dealer, buried: G.buried.slice() };
  if (p < THRESHOLD) {
    const up = p === 0 ? 3 : p < STEP ? 2 : 1;
    R.winTeam = dTeam; R.up = up; R.swap = false;
    if (G.levels[dTeam] === 12) { G.winner = dTeam; }
    else G.levels[dTeam] = Math.min(12, G.levels[dTeam] + up);
    G.nextDealer = partnerOf(G.dealer);
  } else {
    const up = Math.floor((p - THRESHOLD) / STEP);
    R.winTeam = aTeam; R.up = up; R.swap = true;
    G.levels[aTeam] = Math.min(12, G.levels[aTeam] + up);
    G.nextDealer = (G.dealer + 1) % 4;
  }
  R.levelAfter = G.levels.slice();
  G.result = R;
  G.history.push({ hand: G.handNo, dealer: G.dealer, level: G.level, points: p, winTeam: R.winTeam, up: R.up, swap: R.swap });
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
  if (seat === G.dealer) for (const c of G.buried) sub(ckey(c));
  return m;
}
function isBoss(unit, x, unseen) {
  const c = classify(unit, x);
  if (!c) return false;
  for (const id of IDS) {
    if ((unseen.get(ckey(id)) || 0) < c.w) continue;
    if (esuit(id, x) === c.suit && ov(id, x) > c.top) return false;
  }
  return true;
}
const lowKey = (x) => (c) => (isTrump(c, x) ? 40 : 0) + ov(c, x) + pts(c) * 1.2;
const pointsKey = (x) => (c) => (isTrump(c, x) ? 40 : 0) - pts(c) * 3 + ov(c, x) * 0.2;
const sumKey = (cs, f) => cs.reduce((a, c) => a + f(c), 0);

function constructFollow(hand, lead, x, key) {
  const N = lead.w * lead.k;
  const by = (a, b) => key(a) - key(b);
  const Hs = hand.filter((c) => esuit(c, x) === lead.suit).sort(by);
  const others = hand.filter((c) => esuit(c, x) !== lead.suit).sort(by);
  if (Hs.length <= N) { const p = Hs.slice(); for (const c of others) if (p.length < N) p.push(c); return p; }
  if (lead.w === 1) return [Hs[0]];
  const units = findUnits(Hs, lead.w, lead.k, x);
  if (units.length) { units.sort((a, b) => sumKey(a, key) - sumKey(b, key)); return units[0]; }
  let chosen = [], rest = Hs.slice();
  const take = (n, size) => {
    for (let t = 0; t < n; t++) {
      const g = groupCards(rest, x).filter((q) => q.n >= size).map((q) => q.cards.slice(0, size));
      if (!g.length) break;
      g.sort((a, b) => sumKey(a, key) - sumKey(b, key));
      chosen.push(...g[0]);
      rest = rest.filter((c) => !g[0].includes(c));
    }
  };
  const H = countPT(Hs, x);
  if (lead.w === 3) { const t = Math.min(lead.k, H.T); take(t, 3); take(Math.min(lead.k - t, H.P + H.T - t), 2); }
  else take(Math.min(lead.k, H.P + H.T), 2);
  rest.sort(by);
  for (const c of rest) if (chosen.length < N) chosen.push(c);
  return chosen;
}

function winCandidates(G, seat) {
  const x = ctx(G), hand = G.hands[seat], plays = G.trick.plays;
  const lead = classify(plays[0].cards, x);
  const best = classify(plays[trickWinner(plays, x)].cards, x);
  const N = lead.w * lead.k;
  const Hs = hand.filter((c) => esuit(c, x) === lead.suit);
  const out = [];
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
  bury(G) {
    const x = ctx(G);
    let h = G.hands[G.dealer].slice();
    const out = [];
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
          s = -ov(c, x) - pts(c) * 2.5;
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
      for (const u of cands) {
        const c = classify(u, x), size = u.length, p = sumPts(u);
        const boss = isBoss(u, x, unseen);
        let s;
        if (su !== 'T') {
          if (boss) { s = 100 + size * 10 + p * 2; if (oppVoid) s -= 95; }
          else s = 20 + size * 3 - c.top * 1.2 - p * 3 + (Hs.length <= 3 && size === 1 ? 6 : 0) + (pVoid && !oppVoid ? 25 : 0) - (oppVoid ? 10 : 0);
        } else {
          if (boss) s = (dealerTeam || frac > 0.45 ? 70 : 35) + size * 10;
          else s = (frac > 0.5 ? 25 : 2) + size * 3 - c.top - p * 3;
        }
        s += Math.random() * 3;
        if (s > bs) { bs = s; best = u; }
      }
    }
    return best;
  },
  follow(G, seat) {
    const x = ctx(G), hand = G.hands[seat], plays = G.trick.plays;
    const lead = classify(plays[0].cards, x);
    const low = constructFollow(hand, lead, x, lowKey(x));
    const dump = constructFollow(hand, lead, x, pointsKey(x));
    const bi = trickWinner(plays, x);
    const bestSeat = plays[bi].seat;
    const bestC = classify(plays[bi].cards, x);
    const after = 3 - plays.length;
    const rem = []; for (let i = 1; i <= after; i++) rem.push((seat + i) % 4);
    const remOpp = rem.filter((s) => team(s) !== team(seat));
    const tp = sumPts(plays.flatMap((p) => p.cards));
    const unseen = unseenFor(G, seat);
    const si = suitIdx(lead.suit);
    if (bestSeat === partnerOf(seat)) {
      const ruffRisk = lead.suit !== 'T' && bestC.suit !== 'T' && remOpp.some((o) => G.voids[o][si]);
      const safe = remOpp.length === 0 || (isBoss(plays[bi].cards, x, unseen) && !ruffRisk);
      return safe ? dump : low;
    }
    const wins = winCandidates(G, seat);
    if (wins.length) {
      const w0 = wins[0];
      const wc = classify(w0, x);
      const ruff = wc.suit === 'T' && lead.suit !== 'T';
      const pricey = w0.some((c) => c.s === 4 || c.r === G.level) || (ruff && wc.top >= 9);
      const boss = isBoss(w0, x, unseen) && !(ruff && remOpp.some((o) => G.voids[o][si]));
      let take;
      if (remOpp.length === 0) take = tp + sumPts(w0) > 0 || !pricey;
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
  findUnits, validateLead, validateFollow, trickWinner, ctx, newGame, startHand, dealRound, declOptions, declare, declText,
  finishDeclare, bury, turnSeat, leadCls, checkPlay, playCards, resolveTrick, nextHand, AI, constructFollow, sortHand, lowKey, pointsKey,
};
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.TR = API;
})(this);
