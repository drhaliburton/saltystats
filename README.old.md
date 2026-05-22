### Salty stats

A team planning tool to build a softball batting lineup, positions for each inning and track homeruns.

This should be a simple react app that publishes to github pages, and pulls data from a spreadhseet. See the crowstats repository for what to mimic: https://github.com/drhaliburton/crowstats

- Based on the values in this spreadsheet: https://docs.google.com/spreadsheets/d/1evUekLJRHbFddHWywZVbwgqtoT0kQfppQ4XFRYMdvFk/edit?usp=sharing



1. Build an agent skill that allows for easily regenerating the player positions when the preferred positions change
- Based on the values in the spreadsheet for each preferred position, build a lookup of a player positions
- The positions should ensure every position exists for each inning
- The positions should ideally give everyone their preferred position, but falling back to alt 1, 2 or 3 depending on availability.
- If someone doesnt get their preferred position in one inning, they should get it in the next
- A "SIT" is when the player is not on the field, but on the bench. Ideally players dont sit more than 1 inning in a row.
- When prompted, the agent should build a massive dictionary of potential lineup options depending on which players are available for the game


2. Build an agent skill for determining batting order.
- Based on the players skill, determine a batting order for each inning.
- Lookup some reasoning on the best way to organize a rec league softball team order. Historically I have done players with 1 and 2s first, with 3 and 4s hitting every 4th round. This allows players to get on base, then have a big hitter come through to get htem all home. Unsure if there are better methods.


3. Build an MUI data grid table where each row is a user:
- Have columns for their homerun count, and one for each of 9 innings which will show either the position they are playing or SIT for if they are not playing that inning
- Only 9 players are on the field at the time, with a minimum of 3 female players (gender column)
- Table should be ordered by the batting order
- The first column should have a checkark, where a user can uncheck a player to remove them from the lineup. The table lineup should then change to accomodate the selected players. All players are selected by default.
