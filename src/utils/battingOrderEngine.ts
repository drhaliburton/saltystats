import { Player } from '../types';
import { seededShuffle } from './shuffle';

const gender = (p: Player): 'f' | 'm' => (p.gender?.toLowerCase() === 'f' ? 'f' : 'm');

// Builds a gender sequence starting with `startWith`, preferring the gender with
// more remaining players when both are valid, to prevent one gender piling up at the end.
function buildSeqFrom(nF: number, nM: number, startWith: 'f' | 'm'): ('f' | 'm')[] {
  const seq: ('f' | 'm')[] = [];
  let remF = nF, remM = nM;
  let last: 'f' | 'm' | null = null;
  let consec = 0;
  let isFirst = true;

  while (remF + remM > 0) {
    const canF: boolean = remF > 0 && !(last === 'f' && consec >= 2);
    const canM: boolean = remM > 0 && !(last === 'm' && consec >= 2);

    let pick: 'f' | 'm';
    if (isFirst) {
      isFirst = false;
      pick = (startWith === 'f' ? canF : canM) ? startWith : startWith === 'f' ? 'm' : 'f';
    } else if (canF && canM) {
      pick = remF >= remM ? 'f' : 'm';
    } else if (canF) {
      pick = 'f';
    } else if (canM) {
      pick = 'm';
    } else {
      pick = remF > 0 ? 'f' : 'm'; // constraint unsatisfiable — best effort
    }

    seq.push(pick);
    if (pick === 'f') remF--;
    else remM--;
    consec = pick === last ? consec + 1 : 1;
    last = pick;
  }

  return seq;
}

function hasCircularViolation(seq: ('f' | 'm')[]): boolean {
  const n = seq.length;
  if (n < 3) return false;
  return (
    (seq[n - 2] === seq[n - 1] && seq[n - 1] === seq[0]) ||
    (seq[n - 1] === seq[0] && seq[0] === seq[1])
  );
}

function hasInlineViolation(seq: ('f' | 'm')[]): boolean {
  for (let i = 0; i <= seq.length - 3; i++) {
    if (seq[i] === seq[i + 1] && seq[i + 1] === seq[i + 2]) return true;
  }
  return false;
}

// Tries starting with each gender and returns the first sequence free of violations.
// Starting with the minority gender often resolves circular (wrap-around) issues that
// appear when the majority gender is front-loaded.
function buildGenderSequence(nF: number, nM: number): ('f' | 'm')[] {
  const majority: 'f' | 'm' = nF >= nM ? 'f' : 'm';
  const minority: 'f' | 'm' = majority === 'f' ? 'm' : 'f';

  for (const start of [majority, minority]) {
    const seq = buildSeqFrom(nF, nM, start);
    if (!hasInlineViolation(seq) && !hasCircularViolation(seq)) return seq;
  }

  return buildSeqFrom(nF, nM, majority); // best effort for unsatisfiable ratios
}

export function computeBattingOrder(activePlayers: Player[], seed?: number): Player[] {
  if (activePlayers.length === 0) return [];

  const orderWithin = <T extends Player>(arr: T[]): T[] =>
    seed !== undefined
      ? seededShuffle(arr, seed)
      : [...arr].sort((a, b) => b.battingPower - a.battingPower);

  const females = orderWithin(activePlayers.filter((p) => gender(p) === 'f'));
  const males = orderWithin(activePlayers.filter((p) => gender(p) === 'm'));

  // Build the gender sequence first, independent of batting power, so neither gender
  // can pile up at the end regardless of the power distribution across genders.
  const seq = buildGenderSequence(females.length, males.length);

  // Map the highest-power player of each gender to the earliest slots of their gender.
  let fi = 0,
    mi = 0;
  const order: Player[] = seq.map((g) => (g === 'f' ? females[fi++] : males[mi++])!);

  // Best-to-slot-2 (Tango, "The Book"): slot 2 accumulates the most high-leverage PAs.
  // Since players are filled by power desc, the overall best player lands at the first
  // slot of their gender. Swap them to slot 2 if they aren't there and slot 2 is the
  // same gender — a same-gender swap leaves the sequence pattern intact.
  const best = order.reduce((a, b) => (b.battingPower > a.battingPower ? b : a));
  const bestIdx = order.indexOf(best);
  if (bestIdx !== 1 && gender(order[1]) === gender(best)) {
    [order[bestIdx], order[1]] = [order[1], order[bestIdx]];
  }

  return order.map((p, i) => ({ ...p, battingSlot: i + 1 }));
}
