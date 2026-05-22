# Skill: Generate Lineup

Regenerates field positions for all 9 innings based on current player preferences from the spreadsheet.

## When to use
Run this skill when:
- Preferred positions change in the spreadsheet
- Adding or removing players from the roster
- You want a fresh optimized rotation

## What you need
- The Sheet.best URL (set in `.env` as `REACT_APP_SHEET_BEST_URL`)
- The spreadsheet columns: `Player`, `Gender`, `Batting power`, `Homerun count`, `Preferred poisition`, `alt 1`, `alt 2`, `alt 3`

## Steps

1. **Fetch roster data** from the Sheet.best endpoint:
   ```
   curl $REACT_APP_SHEET_BEST_URL
   ```

2. **Ask the user which players are available today** (or default to all players).

3. **Apply the position assignment algorithm** for 9 innings using these rules:
   - 10 softball positions per inning: Pitcher, Catcher, 1B, 2B, 3B, Rover, SS, LF, CF, RF
   - Minimum 3 female players on field each inning
   - If more than 9 players are active, extras get `SIT` (bench)
   - No player should sit two innings in a row
   - Position priority per player: `Preferred poisition` → `alt 1` → `alt 2` → `alt 3`
   - If a player didn't get their preferred position last inning, prioritize them next inning
   - Rotate SIT assignments fairly across all players

4. **Output a lineup dictionary** in this format and save it if requested:
   ```json
   {
     "PlayerName": ["P", "1B", "SIT", "P", "1B", "SIT", "P", "1B", "P"],
     "AnotherPlayer": ["SS", "SS", "SS", "SS", "SS", "SS", "SS", "SS", "SS"]
   }
   ```

5. **Flag any issues:**
   - If fewer than 3 females are active, warn the user
   - If a player has no viable positions (all 4 preferences already taken), report which inning and what fallback position was used
   - If fewer than 9 players are active, the lineup cannot be generated

## Notes
- The `Preferred poisition` column name has a typo in the spreadsheet — keep it as-is when reading the data
- The app's `src/utils/lineupEngine.js` implements this same algorithm in JavaScript for real-time updates
