# Tractor 拖拉机

Tractor (Sheng Ji / 升级) in the browser: one player plus three computer players (a partner and two opponents), played with **3 decks**.

**Play:** https://jwilliamson25.github.io/tractor-game/

## House rules
- 3 decks with jokers (162 cards). 39 cards each; the last 6 are the kitty.
- Hand 1: show a level card during the deal to name trump; the highest call deals, takes the kitty and buries 6.
- Later hands (炒底): the dealer picks up the kitty first, then it goes around the table. Show more level cards or jokers to take it and bury 6, or pass. Dealer team stays the same.
- Throwing (甩牌): lead several combinations of one suit at once; if anyone can beat a piece, only the smallest beatable piece is played.
- A pair you owe never has to come out of a three-of-a-kind.
- Levels can't skip J or A.
- Jack rule: point-scoring team on J that misses 120 drops to 2 if the dealers win the last trick with Jacks only.
- Attackers need 120 of 300 points to take the deal, +1 level per 60 beyond that.

## Files
- `index.html` is the whole game (built file, served by GitHub Pages).
- `src/engine.js` holds the rules and computer players; `src/src.html` holds the table UI.
- Rebuild after edits: `python3 src/build.py`. Run the rules tests: `node src/test.js`.
