import { ForcedAssignments, Lineup, Player } from '../types';
import { seededShuffle } from './shuffle';

enum Positions {
  CATCHER = 'Catcher',
  FIRST_BASE = '1B',
  SECOND_BASE = '2B',
  THIRD_BASE = '3B',
  SHORTSTOP = 'Rover',
  SHORT_FIELD = 'SS',
  LEFT_FIELD = 'LF',
  CENTER_FIELD = 'CF',
  RIGHT_FIELD = 'RF',
  PITCHER = 'Pitcher',
}
// 9 defensive positions when the batting team self-pitches (no dedicated pitcher on defense).
const FIELD_POSITIONS = [
  Positions.CATCHER,
  Positions.FIRST_BASE,
  Positions.SECOND_BASE,
  Positions.THIRD_BASE,
  Positions.SHORTSTOP,
  Positions.SHORT_FIELD,
  Positions.LEFT_FIELD,
  Positions.CENTER_FIELD,
  Positions.RIGHT_FIELD,
];
// All 10 positions when a dedicated pitcher is in the lineup.
const ALL_POSITIONS = [Positions.PITCHER, ...FIELD_POSITIONS];
export const NUM_INNINGS = 7;

function playerPrefs(player: Player): string[] {
  return [player.preferredPosition, player.alt1, player.alt2, player.alt3].filter(Boolean);
}

function selectSitters(
  activePlayers: Player[],
  numSitters: number,
  sitCounts: Record<string, number>,
  forcedCounts: Record<string, number>
): Set<string> {
  if (numSitters === 0) return new Set();

  const sorted = [...activePlayers].sort((a, b) => {
    const sitDiff = (sitCounts[a.name] ?? 0) - (sitCounts[b.name] ?? 0);
    if (sitDiff !== 0) return sitDiff;
    return (forcedCounts[b.name] ?? 0) - (forcedCounts[a.name] ?? 0);
  });

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
//            Pitcher is excluded — it's only filled via lockedPositions.
function assignPositions(
  fielders: Player[],
  didntGetPreferredLastInning: Set<string>,
  forcedCounts: Record<string, number>,
  positions: string[],
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
  const validPositions = new Set(positions);
  for (const player of phase1Players) {
    if (assigned[player.name]) continue;
    const tryList = (
      (forcedCounts[player.name] ?? 0) > 0
        ? playerPrefs(player)
        : [player.preferredPosition].filter(Boolean)
    ).filter((p) => validPositions.has(p));
    for (const pref of tryList) {
      if (!taken.has(pref)) {
        assigned[player.name] = pref;
        taken.add(pref);
        break;
      }
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
      const prefList = playerPrefs(player).filter((p) => validPositions.has(p));
      if (tier < prefList.length && !taken.has(prefList[tier])) {
        assigned[player.name] = prefList[tier];
        taken.add(prefList[tier]);
      }
    }
  }

  // Phase 3: force-fill any still-open non-Pitcher positions.
  const stillUnassigned = fielders.filter((p) => !assigned[p.name]);
  const stillOpen = positions.filter((p) => !taken.has(p) && p !== Positions.PITCHER);

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

function countForced(forced: ForcedAssignments): number {
  let total = 0;
  for (const arr of Object.values(forced)) total += arr.filter(Boolean).length;
  return total;
}

export function findBestSeed(
  activePlayers: Player[],
  pitcherOverride: string | null | undefined,
  selfPitching: boolean,
  candidates = 200,
  targetForced = 3
): number {
  let bestSeed = Math.floor(Math.random() * 2 ** 32);
  let bestCount = Infinity;
  for (let i = 0; i < candidates; i++) {
    const seed = Math.floor(Math.random() * 2 ** 32);
    const { forced } = computeLineup(activePlayers, pitcherOverride, selfPitching, seed);
    const n = countForced(forced);
    if (n < bestCount) {
      bestCount = n;
      bestSeed = seed;
    }
    if (n < targetForced) break;
  }
  return bestSeed;
}

export function computeLineup(
  activePlayers: Player[],
  pitcherOverride?: string | null,
  selfPitching = false,
  seed?: number
): { innings: Lineup; forced: ForcedAssignments; pitcher: string | null } {
  // Self-pitching: batting team provides their own pitcher, so no Pitcher field position.
  const positions = selfPitching ? FIELD_POSITIONS : ALL_POSITIONS;
  const fieldSize = positions.length;

  const n = activePlayers.length;
  const numSitters = Math.max(0, n - fieldSize);

  const innings: Lineup = {};
  const forced: ForcedAssignments = {};
  activePlayers.forEach((p) => {
    innings[p.name] = [];
    forced[p.name] = [];
  });

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
  const byPreference = activePlayers.filter((p) => p.preferredPosition === Positions.PITCHER);
  const overridePlayer = pitcherOverride
    ? (activePlayers.find((p) => p.name === pitcherOverride) ?? null)
    : null;
  const designatedPitcher = overridePlayer ?? byPriority[0] ?? byPreference[0] ?? null;
  const pitchers = new Set<string>(
    designatedPitcher && !selfPitching ? [designatedPitcher.name] : []
  );
  for (let i = 0; i < NUM_INNINGS; i++) {
    // Shuffle player order each inning when a seed is provided so tiebreaking is randomised.
    const inningPlayers =
      seed !== undefined ? seededShuffle(activePlayers, seed ^ (i * 0x9e3779b9)) : activePlayers;
    const inningNonPitchers = inningPlayers.filter((p) => !pitchers.has(p.name));

    let sitters = selectSitters(inningNonPitchers, numSitters, sitCounts, forcedCounts);

    // Swap in any sitter who is the only person listing an otherwise-uncovered position.
    // Replace the most-flexible fielder (most alts) who doesn't list that position.
    for (let _pass = 0; _pass < positions.length; _pass++) {
      const currentSitters = sitters;
      const curFielders = inningPlayers.filter((p) => !currentSitters.has(p.name));
      const covered = new Set(curFielders.flatMap((p) => playerPrefs(p)));
      const uncovered = positions.find((pos) => pos !== Positions.PITCHER && !covered.has(pos));
      if (!uncovered) break;

      const sitterCover = [...sitters]
        .map((name) => activePlayers.find((p) => p.name === name)!)
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

      sitters = new Set([...sitters].filter((name) => name !== sitterCover.name));
      sitters.add(swapOut.name);
    }

    // Enforce max 4 women on the field, but skip the rule for a woman if forcing her to sit
    // would give her more than 2 extra sit-outs vs the least-rested non-pitcher player.
    const fieldingWomen = inningPlayers.filter(
      (p) => !sitters.has(p.name) && p.gender.toLowerCase() === 'f'
    );
    if (fieldingWomen.length > 4) {
      const excess = fieldingWomen.length - 4;
      const minSitCount = Math.min(...inningNonPitchers.map((p) => sitCounts[p.name] ?? 0));
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

    // Hard rule: every position must be filled every inning. If sitter adjustments
    // pushed too many players to the bench, return the most-rested sitters to the field.
    const maxSitters = n - fieldSize;
    if (sitters.size > maxSitters) {
      const overflow = [...sitters]
        .map((name) => activePlayers.find((p) => p.name === name)!)
        .filter(Boolean)
        .sort((a, b) => (sitCounts[b.name] ?? 0) - (sitCounts[a.name] ?? 0))
        .slice(0, sitters.size - maxSitters)
        .map((p) => p.name);
      const overflowSet = new Set(overflow);
      sitters = new Set([...sitters].filter((name) => !overflowSet.has(name)));
    }

    sitters.forEach((name) => sitCounts[name]++);

    const fielders = inningPlayers.filter((p) => !sitters.has(p.name));

    const lockedPositions: Record<string, string> =
      designatedPitcher && !selfPitching ? { [designatedPitcher.name]: Positions.PITCHER } : {};

    const { assignments: positionMap, forcedNames } = assignPositions(
      fielders,
      didntGetPreferredLastInning,
      forcedCounts,
      positions,
      lockedPositions
    );

    activePlayers.forEach((p) => {
      if (sitters.has(p.name)) {
        innings[p.name].push('SIT');
        forced[p.name].push(false);
      } else {
        innings[p.name].push(positionMap[p.name] ?? '—');
        forced[p.name].push(forcedNames.has(p.name));
      }
    });

    // Update forcedCounts for next inning's Phase 3 sorting.
    forcedNames.forEach((name) => {
      forcedCounts[name]++;
    });

    const fieldedAndMissed = new Set(
      fielders.filter((p) => positionMap[p.name] !== p.preferredPosition).map((p) => p.name)
    );
    const priorityRetained = new Set(
      [...didntGetPreferredLastInning].filter((name) => sitters.has(name))
    );
    didntGetPreferredLastInning = new Set([...fieldedAndMissed, ...priorityRetained]);
  }

  return { innings, forced, pitcher: designatedPitcher?.name ?? null };
}
