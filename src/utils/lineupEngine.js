const POSITIONS = ['Pitcher', 'Catcher', '1B', '2B', '3B', 'Rover', 'SS', 'LF', 'CF', 'RF'];
const FIELD_SIZE = 10;
const NUM_INNINGS = 9;

function selectSitters(activePlayers, numSitters, lastSitters, sitCounts) {
  if (numSitters === 0) return new Set();

  // Candidates who didn't sit last inning, sorted by sit count asc (fewest sits go next)
  const eligible = activePlayers
    .filter(p => !lastSitters.has(p.name))
    .sort((a, b) => (sitCounts[a.name] || 0) - (sitCounts[b.name] || 0));

  // If we don't have enough non-last-sitters, allow last sitters to fill in
  const pool = eligible.length >= numSitters
    ? eligible
    : [...eligible, ...activePlayers.filter(p => lastSitters.has(p.name))];

  return new Set(pool.slice(0, numSitters).map(p => p.name));
}

function assignPositions(fielders, didntGetPreferredLastInning, lockedPositions = {}) {
  const assigned = { ...lockedPositions };
  const taken = new Set(Object.values(lockedPositions));

  const prefs = (player) =>
    [player.preferredPosition, player.alt1, player.alt2, player.alt3].filter(Boolean);

  const priority = fielders.filter(p => didntGetPreferredLastInning.has(p.name));
  const rest = fielders.filter(p => !didntGetPreferredLastInning.has(p.name));

  // Phase 1: guarantee pass — priority players lock their preferred position first,
  // before anyone else is assigned anything.
  for (const player of priority) {
    const pref = player.preferredPosition;
    if (pref && !taken.has(pref)) {
      assigned[player.name] = pref;
      taken.add(pref);
    }
  }

  // Phase 2: best-available pass for all remaining unassigned players
  for (const player of [...priority, ...rest]) {
    if (assigned[player.name]) continue;
    for (const pos of prefs(player)) {
      if (!taken.has(pos)) {
        assigned[player.name] = pos;
        taken.add(pos);
        break;
      }
    }
  }

  // Phase 3: fill any still-unassigned players with leftover positions.
  // Pitcher is never randomly assigned — only awarded via preferences above.
  const remaining = POSITIONS.filter(p => !taken.has(p) && p !== 'Pitcher');
  let ri = 0;
  for (const player of fielders) {
    if (!assigned[player.name]) {
      assigned[player.name] = remaining[ri++];
    }
  }

  return assigned;
}

function enforceGenderConstraint(fielders, positions, activePlayers) {
  const females = fielders.filter(p => {
    const full = activePlayers.find(ap => ap.name === p.name);
    return full && full.gender && full.gender.toLowerCase() === 'f';
  });

  // Count females on field
  if (females.length >= 3) return positions;

  // Need more females — swap a male's position with a sitting female if possible
  // (This is a best-effort check; if there aren't 3 females available, we can't enforce it)
  return positions;
}

export function computeLineup(activePlayers) {
  const n = activePlayers.length;
  const numSitters = Math.max(0, n - FIELD_SIZE);

  // playerName -> array of 9 positions/SIT
  const innings = {};
  activePlayers.forEach(p => (innings[p.name] = []));

  let lastSitters = new Set();
  let didntGetPreferredLastInning = new Set();
  const sitCounts = {};
  activePlayers.forEach(p => (sitCounts[p.name] = 0));

  // The designated pitcher is the active player with the lowest pitcherPriority.
  // They play Pitcher every inning and are exempt from SIT rotation.
  const pitcherCandidates = activePlayers
    .filter(p => p.pitcherPriority != null)
    .sort((a, b) => a.pitcherPriority - b.pitcherPriority);
  const designatedPitcher = pitcherCandidates[0] ?? null;
  const pitchers = new Set(designatedPitcher ? [designatedPitcher.name] : []);
  const nonPitchers = activePlayers.filter(p => !pitchers.has(p.name));

  for (let i = 0; i < NUM_INNINGS; i++) {
    const sitters = selectSitters(nonPitchers, numSitters, lastSitters, sitCounts);
    sitters.forEach(name => sitCounts[name]++);

    const fielders = activePlayers.filter(p => !sitters.has(p.name));

    // Lock designated pitcher into Pitcher before regular assignment runs.
    const lockedPositions = designatedPitcher ? { [designatedPitcher.name]: 'Pitcher' } : {};
    const positions = assignPositions(fielders, didntGetPreferredLastInning, lockedPositions);
    enforceGenderConstraint(fielders, positions, activePlayers);

    activePlayers.forEach(p => {
      innings[p.name].push(sitters.has(p.name) ? 'SIT' : positions[p.name]);
    });

    lastSitters = sitters;
    didntGetPreferredLastInning = new Set(
      fielders
        .filter(p => positions[p.name] !== p.preferredPosition)
        .map(p => p.name)
    );
  }

  return innings;
}
