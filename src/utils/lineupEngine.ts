import { ForcedAssignments, Lineup, Player } from '../types';

const POSITIONS = ['Pitcher', 'Catcher', '1B', '2B', '3B', 'Rover', 'SS', 'LF', 'CF', 'RF'];
const FIELD_SIZE = 10;
export const NUM_INNINGS = 7;

function playerPrefs(player: Player): string[] {
  return [player.preferredPosition, player.alt1, player.alt2, player.alt3].filter(Boolean);
}

function selectSitters(
  activePlayers: Player[],
  numSitters: number,
  sitCounts: Record<string, number>
): Set<string> {
  if (numSitters === 0) return new Set();

  const sorted = [...activePlayers].sort(
    (a, b) => (sitCounts[a.name] ?? 0) - (sitCounts[b.name] ?? 0)
  );

  return new Set(sorted.slice(0, numSitters).map((p) => p.name));
}

// Returns assignments and the set of player names who were force-filled to a position
// outside their preference list.
//
//   Phase 1: priority players (missed preferred last inning) lock their preferred first.
//   Phase 2: round-robin preference pass — everyone competes tier by tier so no player
//            grabs someone else's preferred as an early alt.
//   Phase 3: fill remaining open positions. For each open spot, prefer players who list it
//            (by rank in their list), then players with fewer prior forced assignments to
//            spread the burden evenly. Only assignments outside a player's list are flagged.
function assignPositions(
  fielders: Player[],
  didntGetPreferredLastInning: Set<string>,
  forcedCounts: Record<string, number>,
  lockedPositions: Record<string, string> = {}
): { assignments: Record<string, string>; forcedNames: Set<string> } {
  const assigned: Record<string, string> = { ...lockedPositions };
  const taken = new Set<string>(Object.values(lockedPositions));
  const forcedNames = new Set<string>();

  const priority = fielders.filter((p) => didntGetPreferredLastInning.has(p.name));
  const rest = fielders.filter((p) => !didntGetPreferredLastInning.has(p.name));

  // Phase 1: priority players (missed preferred last inning) AND previously-forced players lock
  // their preferred. Sort by forcedCounts desc so most-forced players get first pick.
  const forcedPriority = rest.filter((p) => (forcedCounts[p.name] ?? 0) > 0);
  const phase1Players = [...priority, ...forcedPriority].sort(
    (a, b) => (forcedCounts[b.name] ?? 0) - (forcedCounts[a.name] ?? 0)
  );
  for (const player of phase1Players) {
    if (assigned[player.name]) continue;
    const pref = player.preferredPosition;
    if (pref && !taken.has(pref)) {
      assigned[player.name] = pref;
      taken.add(pref);
    }
  }

  // Phase 2: round-robin preference pass (tier by tier across all players).
  // Sort by forcedCounts desc so already-forced players pick earlier, reducing repeat force-fills.
  const allPlayers = [...priority, ...rest].sort(
    (a, b) => (forcedCounts[b.name] ?? 0) - (forcedCounts[a.name] ?? 0)
  );
  for (let tier = 0; tier < 4; tier++) {
    for (const player of allPlayers) {
      if (assigned[player.name]) continue;
      const prefList = playerPrefs(player);
      if (tier < prefList.length && !taken.has(prefList[tier])) {
        assigned[player.name] = prefList[tier];
        taken.add(prefList[tier]);
      }
    }
  }

  // Phase 3: force-fill any still-open positions.
  // For each open spot, sort unassigned candidates:
  //   1. Players who list this position (by rank in their list) — not a forced fill for them.
  //   2. Players who don't list it, fewest prior forced assignments first (spread the pain).
  const stillUnassigned = fielders.filter((p) => !assigned[p.name]);
  const stillOpen = POSITIONS.filter((p) => !taken.has(p) && p !== 'Pitcher');

  for (const pos of stillOpen) {
    if (stillUnassigned.length === 0) break;

    stillUnassigned.sort((a, b) => {
      const aIdx = playerPrefs(a).indexOf(pos);
      const bIdx = playerPrefs(b).indexOf(pos);
      const aHas = aIdx !== -1;
      const bHas = bIdx !== -1;
      if (aHas !== bHas) return aHas ? -1 : 1;
      if (aHas && bHas) return aIdx - bIdx;
      // Neither lists it: fewest prior forced assignments goes first (they absorb this one)
      return (forcedCounts[a.name] ?? 0) - (forcedCounts[b.name] ?? 0);
    });

    const candidate = stillUnassigned.shift()!;
    assigned[candidate.name] = pos;
    if (!playerPrefs(candidate).includes(pos)) {
      forcedNames.add(candidate.name);
    }
  }

  return { assignments: assigned, forcedNames };
}

export function computeLineup(
  activePlayers: Player[],
  pitcherOverride?: string | null
): { innings: Lineup; forced: ForcedAssignments } {
  const n = activePlayers.length;
  const numSitters = Math.max(0, n - FIELD_SIZE);

  const innings: Lineup = {};
  const forced: ForcedAssignments = {};
  activePlayers.forEach((p) => {
    innings[p.name] = [];
    forced[p.name] = [];
  });

  let lastSitters = new Set<string>();
  let didntGetPreferredLastInning = new Set<string>();
  const sitCounts: Record<string, number> = {};
  const forcedCounts: Record<string, number> = {};
  activePlayers.forEach((p) => {
    sitCounts[p.name] = 0;
    forcedCounts[p.name] = 0;
  });

  const byPriority = activePlayers
    .filter((p) => p.pitcherPriority != null && !isNaN(p.pitcherPriority))
    .sort((a, b) => (a.pitcherPriority ?? 0) - (b.pitcherPriority ?? 0));
  const byPreference = activePlayers.filter((p) => p.preferredPosition === 'Pitcher');
  const overridePlayer = pitcherOverride
    ? (activePlayers.find((p) => p.name === pitcherOverride) ?? null)
    : null;
  const designatedPitcher = overridePlayer ?? byPriority[0] ?? byPreference[0] ?? null;
  const pitchers = new Set<string>(designatedPitcher ? [designatedPitcher.name] : []);
  const nonPitchers = activePlayers.filter((p) => !pitchers.has(p.name));

  for (let i = 0; i < NUM_INNINGS; i++) {
    let sitters = selectSitters(nonPitchers, numSitters, sitCounts);

    // Swap in any sitter who is the only person listing an otherwise-uncovered position.
    // Replace the most-flexible fielder (most alts) who doesn't list that position.
    for (let _pass = 0; _pass < POSITIONS.length; _pass++) {
      const curFielders = activePlayers.filter((p) => !sitters.has(p.name));
      const covered = new Set(curFielders.flatMap((p) => playerPrefs(p)));
      const uncovered = POSITIONS.find((pos) => pos !== 'Pitcher' && !covered.has(pos));
      if (!uncovered) break;

      const sitterCover = [...sitters]
        .map((n) => activePlayers.find((p) => p.name === n)!)
        .filter((p) => p && !pitchers.has(p.name) && playerPrefs(p).includes(uncovered))
        .sort((a, b) => (sitCounts[a.name] ?? 0) - (sitCounts[b.name] ?? 0))[0];
      if (!sitterCover) break;

      const swapOut = curFielders
        .filter((p) => !pitchers.has(p.name) && !playerPrefs(p).includes(uncovered))
        .sort(
          (a, b) =>
            playerPrefs(b).length - playerPrefs(a).length ||
            (sitCounts[b.name] ?? 0) - (sitCounts[a.name] ?? 0)
        )[0];
      if (!swapOut) break;

      sitters = new Set([...sitters].filter((n) => n !== sitterCover.name));
      sitters.add(swapOut.name);
    }

    // Enforce max 4 women on the field, but skip the rule for a woman if forcing her to sit
    // would give her more than 2 extra sit-outs vs the least-rested non-pitcher player.
    const fieldingWomen = activePlayers.filter(
      (p) => !sitters.has(p.name) && p.gender.toLowerCase() === 'f'
    );
    if (fieldingWomen.length > 4) {
      const excess = fieldingWomen.length - 4;
      const minSitCount = Math.min(...nonPitchers.map((p) => sitCounts[p.name] ?? 0));
      const candidates = fieldingWomen
        .filter((p) => !pitchers.has(p.name))
        .sort((a, b) => (sitCounts[a.name] ?? 0) - (sitCounts[b.name] ?? 0));
      const toAdd: string[] = [];
      for (const p of candidates) {
        if (toAdd.length >= excess) break;
        if ((sitCounts[p.name] ?? 0) + 1 > minSitCount + 2) break;
        toAdd.push(p.name);
      }
      if (toAdd.length > 0) {
        sitters = new Set([...sitters, ...toAdd]);
      }
    }

    sitters.forEach((name) => sitCounts[name]++);

    const fielders = activePlayers.filter((p) => !sitters.has(p.name));

    const lockedPositions: Record<string, string> = designatedPitcher
      ? { [designatedPitcher.name]: 'Pitcher' }
      : {};

    const { assignments: positions, forcedNames } = assignPositions(
      fielders,
      didntGetPreferredLastInning,
      forcedCounts,
      lockedPositions
    );

    activePlayers.forEach((p) => {
      if (sitters.has(p.name)) {
        innings[p.name].push('SIT');
        forced[p.name].push(false);
      } else {
        innings[p.name].push(positions[p.name] ?? '—');
        forced[p.name].push(forcedNames.has(p.name));
      }
    });

    lastSitters = sitters;

    // Update forcedCounts for next inning's Phase 3 sorting.
    forcedNames.forEach((name) => {
      forcedCounts[name]++;
    });

    const fieldedAndMissed = new Set(
      fielders.filter((p) => positions[p.name] !== p.preferredPosition).map((p) => p.name)
    );
    const priorityRetained = new Set(
      [...didntGetPreferredLastInning].filter((name) => sitters.has(name))
    );
    didntGetPreferredLastInning = new Set([...fieldedAndMissed, ...priorityRetained]);
  }

  return { innings, forced };
}
