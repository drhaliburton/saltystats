# Salty Stats

A softball team planning tool — batting lineup, field positions for each inning, and homerun tracking.

## Setup

```bash
npm install
npm start
```

Deploy to GitHub Pages:

```bash
npm run deploy
```

Deploys to `https://drhaliburton.github.io/saltystats`.

---

## Spreadsheet columns

The Google Sheet is published as a public CSV. Column names must match exactly:

| Column | Description |
| --- | --- |
| `Player` | Player name |
| `Gender` | `F` or `M` |
| `Batting power` | 1–4 (1 = best on-base, 4 = big power hitter) |
| `Homerun count` | Total HRs |
| `Preferred poisition` | Primary field position (typo preserved) |
| `alt 1` | First fallback position |
| `alt 2` | Second fallback position |
| `alt 3` | Third fallback position |

Valid positions: `P`, `C`, `1B`, `2B`, `3B`, `SS`, `LF`, `CF`, `RF`

---

## Agent skills

Two Claude Code skills for regenerating lineup data when preferences change.

**Generate field positions:**

```text
Read .claude/skills/generate-lineup.md and follow the instructions
```

**Generate batting order:**

```text
Read .claude/skills/generate-batting-order.md and follow the instructions
```

---

## How it works

- **Batting order** — power 1/2 players hit first (get on base); power 3/4 players hit every ~4th slot (drive them home)
- **Field positions** — each inning tries to give everyone their preferred position, falling back to alt 1/2/3; players who missed their preferred last inning get priority next inning
- **SIT rotation** — when there are more than 9 active players, extras sit; no player sits two innings in a row
- **Gender rule** — minimum 3 female players on the field each inning; a warning chip appears if the active roster falls short
- **Player toggling** — uncheck a player to remove them from the lineup; state persists in localStorage between page loads
