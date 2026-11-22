# Tractor 拖拉机

Tractor (Sheng Ji / 升级) in the browser: one player plus three computer players (a partner and two opponents), played with **3 decks**.

**Play:** https://jwilliamson25.github.io/tractor-game/

## House rules
- 3 decks with jokers (162 cards). 39 cards each; the last 6 are the kitty.
- Show a level card during the deal to name trump; more copies overcall. The dealer takes the kitty and buries 6.
- Attackers need 120 of 300 points to take the deal, +1 level per 60 beyond that.

## Files
- `index.html` is the whole game (built file, served by GitHub Pages).
- `src/engine.js` holds the rules and computer players; `src/src.html` holds the table UI.
- Rebuild after edits: `python3 src/build.py`. Run the rules tests: `node src/test.js`.
