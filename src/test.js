const T = require('./engine.js');
let errors = 0;
function fail(m) { errors++; if (errors < 15) console.log('FAIL', m); }

// 1) fuzz: constructFollow is always legal, and a legal play always exists
for (let it = 0; it < 4000; it++) {
  const x = { level: Math.floor(Math.random() * 13), trump: Math.random() < 0.15 ? -1 : Math.floor(Math.random() * 4) };
  const deck = T.shuffle(T.makeDeck());
  const hand = deck.slice(0, 5 + Math.floor(Math.random() * 35));
  const other = deck.slice(60, 100);
  // build a random legal lead from `other`
  const bySuit = {};
  for (const c of other) { const s = T.esuit(c, x); (bySuit[s] = bySuit[s] || []).push(c); }
  const leads = [];
  for (const s in bySuit) for (const w of [1, 2, 3]) for (let k = 1; k <= 3; k++) { if (w === 1 && k > 1) continue; leads.push(...T.findUnits(bySuit[s], w, k, x)); }
  if (!leads.length) continue;
  const leadCards = leads[Math.floor(Math.random() * leads.length)];
  const lead = T.classify(leadCards, x);
  if (!lead) { fail('unit not classifiable'); continue; }
  if (lead.w * lead.k > hand.length) continue;
  for (const key of [T.lowKey(x), T.pointsKey(x)]) {
    const p = T.constructFollow(hand, lead, x, key);
    const v = T.validateFollow(p, hand, lead, x);
    if (!v.ok) fail('construct illegal: ' + v.msg + ' lead ' + leadCards.map(T.cardText) + ' play ' + p.map(T.cardText));
  }
}
console.log('fuzz done, errors', errors);

// 2) full games, all computer players
const t0 = Date.now();
let games = 0, hands = 0, swaps = 0, ptsSum = 0, maxHands = 0;
const levelWins = [0, 0];
for (let g = 0; g < 150; g++) {
  const G = T.newGame();
  let guard = 0;
  while (G.phase !== 'gameOver' && guard++ < 200) {
    while (!T.dealRound(G)) {
      for (const s of [0, 1, 2, 3]) { const o = T.AI.declare(G, s, false); if (o) T.declare(G, o); }
    }
    T.finishDeclare(G);
    if (G.hands[G.dealer].length !== 45) fail('dealer not 45');
    T.bury(G, T.AI.bury(G));
    if (G.hands.some((h) => h.length !== 39)) fail('hands not 39');
    while (G.phase === 'play') {
      const s = T.turnSeat(G);
      const cards = T.AI.play(G, s);
      const v = T.checkPlay(G, s, cards);
      if (!v.ok) { fail('AI illegal: ' + v.msg); break; }
      if (T.playCards(G, s, cards)) T.resolveTrick(G);
    }
    hands++; ptsSum += G.result.points; if (G.result.swap) swaps++;
    // points sanity: total captured w/o bonus <= 300
    if (G.result.points - G.result.bonus > 300) fail('too many points');
    if (G.phase === 'handEnd') T.nextHand(G);
  }
  if (G.phase !== 'gameOver') fail('game did not end');
  else { games++; levelWins[G.winner]++; maxHands = Math.max(maxHands, G.handNo); }
}
console.log({ games, hands, avgHands: (hands / games).toFixed(1), maxHands, swapRate: (swaps / hands).toFixed(2), avgPts: (ptsSum / hands).toFixed(0), levelWins, ms: Date.now() - t0, errors });
