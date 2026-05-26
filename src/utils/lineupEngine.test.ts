import { computeLineup, findBestSeed, NUM_INNINGS } from './lineupEngine';
import { ColumnOverrides, Player } from '../types';

const FIELD_POSITIONS = ['Catcher', '1B', '2B', '3B', 'Rover', 'SS', 'LF', 'CF', 'RF'];
const ALL_POSITIONS = ['Pitcher', ...FIELD_POSITIONS];

// ─── Helpers ────────────────────────────────────────────────────────────────

let _id = 0;
function makePlayer(overrides: Partial<Player> & { name: string }): Player {
  return {
    gender: 'm',
    battingPower: 1,
    homeruns: 0,
    preferredPosition: '1B',
    alt1: '2B',
    alt2: '3B',
    alt3: 'SS',
    pitcherPriority: null,
    active: true,
    battingSlot: ++_id,
    ...overrides,
  };
}

function makePlayers(n: number, gender: 'm' | 'f' = 'm'): Player[] {
  return Array.from({ length: n }, (_, i) =>
    makePlayer({
      name: `P${i + 1}`,
      gender,
      preferredPosition: FIELD_POSITIONS[i % FIELD_POSITIONS.length],
      alt1: FIELD_POSITIONS[(i + 1) % FIELD_POSITIONS.length],
      alt2: FIELD_POSITIONS[(i + 2) % FIELD_POSITIONS.length],
      alt3: FIELD_POSITIONS[(i + 3) % FIELD_POSITIONS.length],
    })
  );
}

// Returns the effective positions for an inning after applying overrides.
// This mirrors what App.tsx does with effectiveInnings.
function effectivePositions(
  innings: Record<string, string[]>,
  inning: number,
  overrides?: ColumnOverrides
): string[] {
  return Object.entries(innings).map(([name, positions]) => {
    const override = overrides?.[name]?.[inning];
    return override ?? positions[inning];
  });
}

// Core invariant: every field position appears exactly once, no duplicates.
function assertNoPositionConflicts(
  innings: Record<string, string[]>,
  positions: string[],
  overrides?: ColumnOverrides,
  label = ''
) {
  for (let i = 0; i < NUM_INNINGS; i++) {
    const assigned = effectivePositions(innings, i, overrides).filter((p) => p !== 'SIT');
    const fieldPositions = assigned.filter((p) => p !== '—');
    const positionSet = new Set(fieldPositions);

    expect(positionSet.size).toBe(
      fieldPositions.length
    ); // no duplicates

    // Every position that should be filled is filled (no gaps among free slots)
    const expectedCount = Math.min(Object.keys(innings).length, positions.length);
    expect(fieldPositions.length).toBe(expectedCount);
  }
}

// ─── Basic lineup invariants ─────────────────────────────────────────────────

describe('computeLineup — basic invariants', () => {
  test('exact roster (10 players, with pitcher): all positions filled, nobody sits', () => {
    const players = makePlayers(10);
    const pitcher = makePlayer({ name: 'Pitcher1', pitcherPriority: 1 });
    const roster = [...players.slice(0, 9), pitcher];
    const { innings } = computeLineup(roster, null, false, 42);

    for (let i = 0; i < NUM_INNINGS; i++) {
      const positions = effectivePositions(innings, i);
      const fielding = positions.filter((p) => p !== 'SIT');
      const unique = new Set(fielding);
      expect(unique.size).toBe(fielding.length); // no duplicates
      expect(fielding.length).toBe(10); // all 10 positions filled
      expect(positions.includes('Pitcher')).toBe(true);
      expect(positions.filter((p) => p === 'SIT').length).toBe(0);
    }
  });

  test('exact roster self-pitching (9 players): no player gets — (regression)', () => {
    // Real-world bug: with certain preference overlaps (3 players share RF as top choice,
    // 2 share 2B, SS not in any player's first 3 prefs), one player was left unassigned.
    const players = [
      makePlayer({ name: 'Rebecca', gender: 'f', preferredPosition: '2B', alt1: 'Rover', alt2: '3B', alt3: '1B' }),
      makePlayer({ name: 'Alexis', gender: 'f', preferredPosition: 'Catcher', alt1: 'Rover', alt2: 'RF', alt3: '3B' }),
      makePlayer({ name: 'Mariah', gender: 'f', preferredPosition: 'RF', alt1: '1B', alt2: 'Catcher', alt3: 'Rover' }),
      makePlayer({ name: 'Allison', gender: 'f', preferredPosition: 'RF', alt1: 'LF', alt2: '2B', alt3: 'Rover' }),
      makePlayer({ name: 'Dylan', gender: 'm', preferredPosition: 'CF', alt1: 'LF', alt2: 'RF', alt3: 'SS', pitcherPriority: 4 }),
      makePlayer({ name: 'Hannah', gender: 'f', preferredPosition: 'RF', alt1: 'LF', alt2: '1B', alt3: 'Catcher' }),
      makePlayer({ name: 'Connor', gender: 'm', preferredPosition: '1B', alt1: 'SS', alt2: 'Rover', alt3: '3B' }),
      makePlayer({ name: 'Laura', gender: 'f', preferredPosition: '2B', alt1: 'RF', alt2: 'Rover', alt3: 'Catcher' }),
      makePlayer({ name: 'Tyler', gender: 'm', preferredPosition: '3B', alt1: 'LF', alt2: '1B', alt3: 'SS' }),
    ];
    for (const seed of [0, 1, 42, 99, 999, 12345, 0xdeadbeef]) {
      const { innings } = computeLineup(players, null, true, seed);
      for (let i = 0; i < NUM_INNINGS; i++) {
        const fielding = Object.values(innings)
          .map((arr) => arr[i])
          .filter((p) => p !== 'SIT' && p !== '—');
        expect(fielding.length).toBe(9);
        expect(new Set(fielding).size).toBe(9);
      }
    }
  });

  test('exact roster self-pitching (9 players): all field positions filled', () => {
    const players = makePlayers(9);
    const { innings } = computeLineup(players, null, true, 42);

    for (let i = 0; i < NUM_INNINGS; i++) {
      const positions = effectivePositions(innings, i);
      const fielding = positions.filter((p) => p !== 'SIT' && p !== '—');
      const unique = new Set(fielding);
      expect(unique.size).toBe(fielding.length);
      expect(fielding.length).toBe(9);
      expect(positions.includes('Pitcher')).toBe(false);
    }
  });

  test('roster larger than field size: correct number sit each inning', () => {
    // 13 regular + 1 pitcher = 14 players, 10 positions → 4 sit
    const players = [...makePlayers(13), makePlayer({ name: 'Pitcher1', pitcherPriority: 1 })];
    const { innings } = computeLineup(players, null, false, 42);

    for (let i = 0; i < NUM_INNINGS; i++) {
      const positions = Object.values(innings).map((arr) => arr[i]);
      const sitters = positions.filter((p) => p === 'SIT');
      const fielding = positions.filter((p) => p !== 'SIT' && p !== '—');
      const unique = new Set(fielding);
      expect(sitters.length).toBe(4);
      expect(fielding.length).toBe(10);
      expect(unique.size).toBe(10); // no position duplicated
    }
  });

  test('roster larger than field size self-pitching: correct sitter count', () => {
    const players = makePlayers(12); // 12 players, 9 positions → 3 sit
    const { innings } = computeLineup(players, null, true, 42);

    for (let i = 0; i < NUM_INNINGS; i++) {
      const positions = Object.values(innings).map((arr) => arr[i]);
      const sitters = positions.filter((p) => p === 'SIT');
      const fielding = positions.filter((p) => p !== 'SIT' && p !== '—');
      const unique = new Set(fielding);
      expect(sitters.length).toBe(3);
      expect(fielding.length).toBe(9);
      expect(unique.size).toBe(9);
    }
  });

  test('every player is assigned exactly once per inning', () => {
    const players = makePlayers(13);
    const { innings } = computeLineup(players, null, false, 42);

    for (let i = 0; i < NUM_INNINGS; i++) {
      const assigned = Object.keys(innings);
      expect(assigned.length).toBe(13);
      assigned.forEach((name) => {
        expect(innings[name][i]).toBeDefined();
      });
    }
  });

  test('innings array length equals NUM_INNINGS for every player', () => {
    const players = makePlayers(11);
    const { innings } = computeLineup(players, null, false, 42);
    Object.values(innings).forEach((arr) => {
      expect(arr.length).toBe(NUM_INNINGS);
    });
  });
});

// ─── Pitcher assignment ──────────────────────────────────────────────────────

describe('computeLineup — pitcher assignment', () => {
  test('designated pitcher (by pitcherPriority) plays Pitcher every inning', () => {
    const players = makePlayers(9);
    const pitcher = makePlayer({ name: 'Ace', pitcherPriority: 1 });
    const roster = [...players, pitcher];
    const { innings, pitcher: returnedPitcher } = computeLineup(roster, null, false, 42);

    expect(returnedPitcher).toBe('Ace');
    for (let i = 0; i < NUM_INNINGS; i++) {
      expect(innings['Ace'][i]).toBe('Pitcher');
      // Verify no other player has Pitcher.
      const others = Object.entries(innings)
        .filter(([name]) => name !== 'Ace')
        .map(([, arr]) => arr[i]);
      expect(others.includes('Pitcher')).toBe(false);
    }
  });

  test('pitcherOverride selects the named player as pitcher', () => {
    const players = makePlayers(10);
    players[0] = makePlayer({ name: 'OverridePitcher', pitcherPriority: null });
    const { pitcher } = computeLineup(players, 'OverridePitcher', false, 42);
    expect(pitcher).toBe('OverridePitcher');
  });

  test('self-pitching: no Pitcher position assigned to any player', () => {
    const players = makePlayers(10);
    const { innings } = computeLineup(players, null, true, 42);
    Object.values(innings).forEach((arr) => {
      arr.forEach((pos) => {
        expect(pos).not.toBe('Pitcher');
      });
    });
  });

  test('self-pitching: pitcher field is null', () => {
    const players = makePlayers(9);
    const { pitcher } = computeLineup(players, null, true, 42);
    expect(pitcher).toBeNull();
  });
});

// ─── No-duplicate guarantee across multiple seeds ────────────────────────────

describe('computeLineup — no duplicates across seeds', () => {
  const seeds = [0, 1, 42, 99999, 0xdeadbeef];

  test.each(seeds)('seed %i: no position duplicated any inning (14 players)', (seed) => {
    const players = [...makePlayers(13), makePlayer({ name: 'Pitcher1', pitcherPriority: 1 })];
    const { innings } = computeLineup(players, null, false, seed);

    for (let i = 0; i < NUM_INNINGS; i++) {
      const fielding = Object.values(innings)
        .map((arr) => arr[i])
        .filter((p) => p !== 'SIT' && p !== '—');
      expect(new Set(fielding).size).toBe(fielding.length);
      expect(fielding.length).toBe(10);
    }
  });

  test.each(seeds)('seed %i: no duplicates self-pitching (12 players)', (seed) => {
    const players = makePlayers(12);
    const { innings } = computeLineup(players, null, true, seed);

    for (let i = 0; i < NUM_INNINGS; i++) {
      const fielding = Object.values(innings)
        .map((arr) => arr[i])
        .filter((p) => p !== 'SIT' && p !== '—');
      expect(new Set(fielding).size).toBe(fielding.length);
      expect(fielding.length).toBe(9);
    }
  });
});

// ─── Sit distribution ────────────────────────────────────────────────────────

describe('computeLineup — sit distribution', () => {
  test('every player sits at least once across 7 innings (15 players, 10 positions)', () => {
    const players = makePlayers(15); // 5 sit per inning → 35 total sit slots across 7 innings
    const { innings } = computeLineup(players, null, false, 42);
    const sitCounts = players.map((p) => innings[p.name].filter((pos) => pos === 'SIT').length);
    // With 15 players and 35 total sits, everyone gets at least 2 sits
    sitCounts.forEach((count) => expect(count).toBeGreaterThanOrEqual(1));
  });

  test('total sits per inning equals numSitters', () => {
    const n = 13;
    const fieldSize = 10;
    const players = makePlayers(n);
    const { innings } = computeLineup(players, null, false, 42);

    for (let i = 0; i < NUM_INNINGS; i++) {
      const sitters = Object.values(innings).filter((arr) => arr[i] === 'SIT').length;
      expect(sitters).toBe(n - fieldSize);
    }
  });
});

// ─── Women cap ───────────────────────────────────────────────────────────────

describe('computeLineup — women cap (max 4 on field)', () => {
  test('never more than 4 women fielding in any inning', () => {
    const women = Array.from({ length: 6 }, (_, i) =>
      makePlayer({
        name: `F${i}`,
        gender: 'f',
        preferredPosition: FIELD_POSITIONS[i],
        alt1: FIELD_POSITIONS[(i + 1) % 9],
        alt2: FIELD_POSITIONS[(i + 2) % 9],
        alt3: FIELD_POSITIONS[(i + 3) % 9],
      })
    );
    // 16 players (6F + 10M), selfPitching=true → 7 sitters/inning.
    // Enough slack that the hard rule never cancels the women-cap additions.
    const men = makePlayers(10, 'm');
    const roster = [...women, ...men];
    const { innings } = computeLineup(roster, null, true, 42);

    for (let i = 0; i < NUM_INNINGS; i++) {
      const fieldingWomen = women.filter((w) => innings[w.name][i] !== 'SIT').length;
      expect(fieldingWomen).toBeLessThanOrEqual(4);
    }
  });

  test('women cap does not break position coverage (no duplicates when cap kicks in)', () => {
    const women = Array.from({ length: 7 }, (_, i) =>
      makePlayer({
        name: `F${i}`,
        gender: 'f',
        preferredPosition: FIELD_POSITIONS[i % 9],
        alt1: FIELD_POSITIONS[(i + 1) % 9],
        alt2: FIELD_POSITIONS[(i + 2) % 9],
        alt3: FIELD_POSITIONS[(i + 3) % 9],
      })
    );
    const men = Array.from({ length: 7 }, (_, i) =>
      makePlayer({
        name: `M${i}`,
        gender: 'm',
        preferredPosition: FIELD_POSITIONS[i % 9],
        alt1: FIELD_POSITIONS[(i + 1) % 9],
        alt2: FIELD_POSITIONS[(i + 2) % 9],
        alt3: FIELD_POSITIONS[(i + 3) % 9],
      })
    );
    const roster = [...women, ...men];
    const { innings } = computeLineup(roster, null, false, 42);

    for (let i = 0; i < NUM_INNINGS; i++) {
      const fielding = Object.values(innings)
        .map((arr) => arr[i])
        .filter((p) => p !== 'SIT' && p !== '—');
      expect(new Set(fielding).size).toBe(fielding.length);
    }
  });
});

// ─── Locked assignments ──────────────────────────────────────────────────────

describe('computeLineup — locked assignments', () => {
  test('locked fielder: engineInnings outputs "—", no other player assigned their position', () => {
    const players = makePlayers(10);
    const lockedAssignments: ColumnOverrides = {
      P1: { 0: '1B', 1: '1B', 2: '1B', 3: '1B', 4: '1B', 5: '1B', 6: '1B' },
    };
    const { innings } = computeLineup(players, null, false, 42, lockedAssignments);

    for (let i = 0; i < NUM_INNINGS; i++) {
      // Locked fielder gets '—' in engineInnings (override supplies the real value)
      expect(innings['P1'][i]).toBe('—');
      // No free player is assigned '1B'
      const others = Object.entries(innings)
        .filter(([name]) => name !== 'P1')
        .map(([, arr]) => arr[i]);
      expect(others.includes('1B')).toBe(false);
    }
  });

  test('locked fielder: effective positions (override applied) have no duplicates', () => {
    const players = makePlayers(12);
    const lockedAssignments: ColumnOverrides = {
      P1: { 0: 'RF', 1: 'LF', 2: 'CF' },
      P2: { 0: '2B', 3: 'SS' },
    };
    const { innings } = computeLineup(players, null, false, 42, lockedAssignments);

    for (let i = 0; i < NUM_INNINGS; i++) {
      const effective = effectivePositions(innings, i, lockedAssignments);
      const fielding = effective.filter((p) => p !== 'SIT' && p !== '—');
      expect(new Set(fielding).size).toBe(fielding.length);
    }
  });

  test('locked SIT player sits, their position available to free players', () => {
    const players = makePlayers(10); // exact roster, nobody should sit normally
    const lockedAssignments: ColumnOverrides = {
      P1: { 0: 'SIT' },
    };
    const { innings } = computeLineup(players, null, false, 42, lockedAssignments);

    // P1 sits inning 0
    expect(innings['P1'][0]).toBe('SIT');

    // All 10 field positions still filled by the remaining 9 players + the free sitter slot
    // Actually: 10 players, 1 locked SIT → 9 free players, 10 positions, so one position unfilled
    // The engine hard-rules that every FREE position must be filled by free players.
    // With 9 free players and 10 positions - 0 reserved = 10 positions, that's 1 short.
    // The engine clamps freeNumSitters to max(0, 9 - 10) = 0, so all 9 free players field.
    const inning0Positions = Object.entries(innings)
      .filter(([name]) => name !== 'P1')
      .map(([, arr]) => arr[0])
      .filter((p) => p !== 'SIT' && p !== '—');
    expect(new Set(inning0Positions).size).toBe(inning0Positions.length); // no duplicates
  });

  test('locked assignments for inactive players are ignored', () => {
    const players = makePlayers(10);
    // 'Ghost' is not in the active roster
    const lockedAssignments: ColumnOverrides = {
      Ghost: { 0: '1B', 1: '1B' },
    };
    const { innings } = computeLineup(players, null, false, 42, lockedAssignments);

    // Ghost not in innings
    expect(innings['Ghost']).toBeUndefined();

    // 1B is freely assigned (not reserved)
    for (let i = 0; i < NUM_INNINGS; i++) {
      const fielding = Object.values(innings)
        .map((arr) => arr[i])
        .filter((p) => p !== 'SIT' && p !== '—');
      expect(fielding.includes('1B')).toBe(true);
      expect(new Set(fielding).size).toBe(fielding.length);
    }
  });

  test('multiple locked fielders: all their positions reserved, no duplicates in effective', () => {
    const players = makePlayers(14);
    const lockedAssignments: ColumnOverrides = {
      P1: { 0: 'RF', 1: 'LF', 2: 'CF', 3: 'RF', 4: 'LF', 5: 'CF', 6: 'RF' },
      P2: { 0: '1B', 1: '2B', 2: '3B', 3: '1B', 4: '2B', 5: '3B', 6: '1B' },
      P3: { 0: 'SS', 1: 'Rover', 2: 'Catcher', 3: 'SS', 4: 'Rover', 5: 'Catcher', 6: 'SS' },
    };
    const { innings } = computeLineup(players, null, false, 42, lockedAssignments);

    for (let i = 0; i < NUM_INNINGS; i++) {
      const effective = effectivePositions(innings, i, lockedAssignments);
      const fielding = effective.filter((p) => p !== 'SIT' && p !== '—');
      expect(new Set(fielding).size).toBe(fielding.length);
      // Locked players appear in effective at their locked positions
      expect(effective[players.findIndex((p) => p.name === 'P1')]).toBe(
        lockedAssignments['P1'][i]
      );
      expect(effective[players.findIndex((p) => p.name === 'P2')]).toBe(
        lockedAssignments['P2'][i]
      );
    }
  });

  test('locked position that is invalid for current mode is ignored (Pitcher when selfPitching)', () => {
    const players = makePlayers(10);
    const lockedAssignments: ColumnOverrides = {
      P1: { 0: 'Pitcher' }, // invalid in self-pitching mode
    };
    // Should not throw, and P1 should be treated as unlocked for inning 0
    expect(() => computeLineup(players, null, true, 42, lockedAssignments)).not.toThrow();
    const { innings } = computeLineup(players, null, true, 42, lockedAssignments);
    // P1 is free in inning 0 since 'Pitcher' isn't in selfPitching positions
    expect(innings['P1'][0]).not.toBe('Pitcher');
  });
});

// ─── findBestSeed ────────────────────────────────────────────────────────────

describe('findBestSeed', () => {
  test('returns a number', () => {
    const players = makePlayers(12);
    const seed = findBestSeed(players, null, false);
    expect(typeof seed).toBe('number');
  });

  test('resulting lineup has no position duplicates', () => {
    const players = makePlayers(13);
    const seed = findBestSeed(players, null, false, undefined, 20);
    const { innings } = computeLineup(players, null, false, seed);
    for (let i = 0; i < NUM_INNINGS; i++) {
      const fielding = Object.values(innings)
        .map((arr) => arr[i])
        .filter((p) => p !== 'SIT' && p !== '—');
      expect(new Set(fielding).size).toBe(fielding.length);
    }
  });

  test('respects lockedAssignments when finding seed', () => {
    const players = makePlayers(12);
    const lockedAssignments: ColumnOverrides = {
      P1: { 0: 'RF', 1: 'RF', 2: 'RF', 3: 'RF', 4: 'RF', 5: 'RF', 6: 'RF' },
    };
    const seed = findBestSeed(players, null, false, lockedAssignments, 10);
    const { innings } = computeLineup(players, null, false, seed, lockedAssignments);

    for (let i = 0; i < NUM_INNINGS; i++) {
      const effective = effectivePositions(innings, i, lockedAssignments);
      const fielding = effective.filter((p) => p !== 'SIT' && p !== '—');
      expect(new Set(fielding).size).toBe(fielding.length);
    }
  });
});
