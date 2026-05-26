import { ColumnOverrides, ForcedAssignments, Lineup, Player } from '../types';
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
  players: Player[],
  numSitters: number,
  sitCounts: Record<string, number>,
  forcedCounts: Record<string, number>
): Set<string> {
  if (numSitters === 0) return new Set();

  const sorted = [...players].sort((a, b) => {
    const sitDiff = (sitCounts[a.name] ?? 0) - (sitCounts[b.name] ?? 0);
    if (sitDiff !== 0) return sitDiff;
    return (forcedCounts[b.name] ?? 0) - (forcedCounts[a.name] ?? 0);
  });

  return new Set(sorted.slice(0, numSitters).map((p) => p.name));
}

// Assigns positions to fielders.
//   Phase 1: priority players (missed preferred last inning) and previously-forced players lock
//            their preferred first.
//   Phase 2: round-robin preference pass — everyone competes tier by tier.
//   Phase 3: force-fill remaining open positions, preferring players who list it, then
//            spreading forced assignments to those with the fewest prior.
//   lockedPositions: pre-assigned player→position pairs (e.g. pitcher).
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
  lockedAssignments?: ColumnOverrides,
  candidates = 200,
  targetForced = 3
): number {
  let bestSeed = Math.floor(Math.random() * 2 ** 32);
  let bestCount = Infinity;
  for (let i = 0; i < candidates; i++) {
    const seed = Math.floor(Math.random() * 2 ** 32);
    const { forced } = computeLineup(
      activePlayers,
      pitcherOverride,
      selfPitching,
      seed,
      lockedAssignments
    );
    const n = countForced(forced);
    if (n < bestCount) {
      bestCount = n;
      bestSeed = seed;
    }
    if (n < targetForced) break;
  }
  return bestSeed;
}

// lockedAssignments: player→inning→position overrides that survive a roster change.
// Locked fielders are excluded from optimization entirely — their positions are reserved
// and the engine outputs '—' for them in engineInnings so the override still renders as
// yellow in the UI (override !== '—'). Locked SIT players are benched and their sit-counts
// accumulate normally.
export function computeLineup(
  activePlayers: Player[],
  pitcherOverride?: string | null,
  selfPitching = false,
  seed?: number,
  lockedAssignments?: ColumnOverrides
): { innings: Lineup; forced: ForcedAssignments; pitcher: string | null } {
  const positions = selfPitching ? FIELD_POSITIONS : ALL_POSITIONS;
  const positionSet = new Set(positions as string[]);
  const activeNames = new Set(activePlayers.map((p) => p.name));

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
    // Resolve which players are locked for this inning.
    // Pitchers are managed separately and are never subject to locked assignments.
    // Locked fielders with positions outside the current position set (e.g. Pitcher when
    // selfPitching) are silently ignored so invalid overrides don't block the engine.
    const lockedSitterNames = new Set<string>();
    const lockedFielderPositions = new Map<string, string>(); // name → position

    if (lockedAssignments) {
      for (const [name, overrides] of Object.entries(lockedAssignments)) {
        if (!activeNames.has(name) || pitchers.has(name)) continue;
        const pos = overrides[i];
        if (pos === undefined) continue;
        if (pos === 'SIT') {
          lockedSitterNames.add(name);
        } else if (positionSet.has(pos)) {
          lockedFielderPositions.set(name, pos);
        }
      }
    }

    // Positions reserved by locked fielders are unavailable to the free pool.
    const reservedPositions = new Set(lockedFielderPositions.values());

    // Pitcher position is locked separately and always reserved.
    const pitcherLock: Record<string, string> =
      designatedPitcher && !selfPitching ? { [designatedPitcher.name]: Positions.PITCHER } : {};
    Object.values(pitcherLock).forEach((p) => reservedPositions.add(p));

    const freePositions = positions.filter((p) => !reservedPositions.has(p));

    const inningPlayers =
      seed !== undefined ? seededShuffle(activePlayers, seed ^ (i * 0x9e3779b9)) : activePlayers;

    // Free players: not locked, not the designated pitcher.
    const inningFreeNonPitchers = inningPlayers.filter(
      (p) =>
        !lockedSitterNames.has(p.name) &&
        !lockedFielderPositions.has(p.name) &&
        !pitchers.has(p.name)
    );

    const freeNumSitters = Math.max(0, inningFreeNonPitchers.length - freePositions.length);

    let sitters = selectSitters(inningFreeNonPitchers, freeNumSitters, sitCounts, forcedCounts);

    // Swap in any free sitter who is the only person covering an otherwise-uncovered free position.
    for (let _pass = 0; _pass < freePositions.length; _pass++) {
      const currentSitters = sitters;
      const curFreeFielders = inningFreeNonPitchers.filter((p) => !currentSitters.has(p.name));
      const covered = new Set(curFreeFielders.flatMap((p) => playerPrefs(p)));
      const uncovered = freePositions.find((pos) => pos !== Positions.PITCHER && !covered.has(pos));
      if (!uncovered) break;

      const sitterCover = [...sitters]
        .map((name) => activePlayers.find((p) => p.name === name)!)
        .filter((p) => p && !pitchers.has(p.name) && playerPrefs(p).includes(uncovered))
        .sort((a, b) => (sitCounts[a.name] ?? 0) - (sitCounts[b.name] ?? 0))[0];
      if (!sitterCover) break;

      const swapOut = curFreeFielders
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

    // Enforce max 4 women on the field. Locked fielding women count toward the cap
    // but cannot be displaced — only free fielding women are candidates to sit.
    const lockedFieldingWomenCount = [...lockedFielderPositions.keys()].filter((name) => {
      const p = activePlayers.find((pp) => pp.name === name);
      return p && p.gender.toLowerCase() === 'f';
    }).length;
    const freeFieldingWomen = inningFreeNonPitchers.filter(
      (p) => !sitters.has(p.name) && p.gender.toLowerCase() === 'f'
    );
    if (freeFieldingWomen.length + lockedFieldingWomenCount > 4) {
      const excessFreeWomen = freeFieldingWomen.length + lockedFieldingWomenCount - 4;
      const minSitCount = Math.min(...inningFreeNonPitchers.map((p) => sitCounts[p.name] ?? 0));
      const candidates = freeFieldingWomen
        .filter((p) => !pitchers.has(p.name))
        .sort((a, b) => (sitCounts[a.name] ?? 0) - (sitCounts[b.name] ?? 0));
      const toAdd: string[] = [];
      for (const p of candidates) {
        if (toAdd.length >= excessFreeWomen) break;
        if ((sitCounts[p.name] ?? 0) + 1 > minSitCount + 2) break;
        toAdd.push(p.name);
      }
      if (toAdd.length > 0) sitters = new Set([...sitters, ...toAdd]);
    }

    // Hard rule: every free position must be filled — return the most-rested sitters to the field.
    const maxFreeSitters = inningFreeNonPitchers.length - freePositions.length;
    if (sitters.size > maxFreeSitters) {
      const overflow = [...sitters]
        .map((name) => activePlayers.find((p) => p.name === name)!)
        .filter(Boolean)
        .sort((a, b) => (sitCounts[b.name] ?? 0) - (sitCounts[a.name] ?? 0))
        .slice(0, sitters.size - maxFreeSitters)
        .map((p) => p.name);
      const overflowSet = new Set(overflow);
      sitters = new Set([...sitters].filter((name) => !overflowSet.has(name)));
    }

    lockedSitterNames.forEach((name) => sitCounts[name]++);
    sitters.forEach((name) => sitCounts[name]++);

    const freeFielders = inningFreeNonPitchers.filter((p) => !sitters.has(p.name));

    const { assignments: positionMap, forcedNames } = assignPositions(
      freeFielders,
      didntGetPreferredLastInning,
      forcedCounts,
      freePositions,
      pitcherLock
    );

    activePlayers.forEach((p) => {
      if (lockedSitterNames.has(p.name) || sitters.has(p.name)) {
        innings[p.name].push('SIT');
        forced[p.name].push(false);
      } else if (lockedFielderPositions.has(p.name)) {
        // Output '—' so the override (stored in columnOverrides) differs from engineInnings
        // and continues to render as a yellow chip in the UI.
        innings[p.name].push('—');
        forced[p.name].push(false);
      } else {
        innings[p.name].push(positionMap[p.name] ?? '—');
        forced[p.name].push(forcedNames.has(p.name));
      }
    });

    forcedNames.forEach((name) => {
      forcedCounts[name]++;
    });

    const fieldedAndMissed = new Set(
      freeFielders.filter((p) => positionMap[p.name] !== p.preferredPosition).map((p) => p.name)
    );
    const priorityRetained = new Set(
      [...didntGetPreferredLastInning].filter((name) => sitters.has(name))
    );
    didntGetPreferredLastInning = new Set([...fieldedAndMissed, ...priorityRetained]);
  }

  return { innings, forced, pitcher: designatedPitcher?.name ?? null };
}
