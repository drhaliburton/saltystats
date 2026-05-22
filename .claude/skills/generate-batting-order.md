# Skill: Generate Batting Order

Determines the optimal batting order for a rec league softball game based on player skill ratings.

## When to use
Run this skill when:
- Player skill ratings change in the spreadsheet
- Roster changes significantly
- You want to experiment with a different batting strategy

## What you need
- The Sheet.best URL (set in `.env` as `REACT_APP_SHEET_BEST_URL`)
- The `Batting power` column: 1 (best on-base), 2 (good on-base), 3 (moderate power), 4 (big power)

## Strategy
Rec league softball batting order philosophy:
- **Power 1-2 players** hit first — they get on base reliably
- **Power 3-4 players** hit every ~4th slot — they drive runners home
- Pattern: `[1, 2, 1, 4, 2, 1, 3, 1, 2, ...]` (three on-base, one power, repeat)
- Within each tier, sort power 1s before 2s, power 4s before 3s

## Steps

1. **Fetch roster data** from the Sheet.best endpoint:
   ```
   curl $REACT_APP_SHEET_BEST_URL
   ```

2. **Ask which players are available today** (or default to all).

3. **Sort into two groups:**
   - On-base group: `Batting power` 1 or 2, sorted ascending
   - Power group: `Batting power` 3 or 4, sorted descending

4. **Build the order:** Interleave 3 on-base hitters, then 1 power hitter, repeat until all players placed.

5. **Output the batting order:**
   ```
   1. PlayerA (power: 1)
   2. PlayerB (power: 2)
   3. PlayerC (power: 1)
   4. PlayerD (power: 4)  ← cleanup hitter
   5. PlayerE (power: 2)
   ...
   ```

## Notes
- The app's `src/utils/battingOrderEngine.js` implements this same logic for real-time updates
- Batting order affects row ordering in the DataGrid — slot 1 is the first row
