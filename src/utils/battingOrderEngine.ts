import { Player } from '../types';

function applyPowerOrdering(players: Player[]): Player[] {
  const sorted = [...players].sort((a, b) => b.battingPower - a.battingPower);
  // Research (Tango, "The Book"): best hitter should bat 2nd, not leadoff.
  // Leadoff gets most total PAs; 2nd gets most high-leverage PAs with runners on.
  if (sorted.length >= 2) {
    [sorted[0], sorted[1]] = [sorted[1], sorted[0]];
  }
  return sorted;
}

// Interleave two arrays, alternating elements. Appends leftovers at the end.
function interleave<T>(a: T[], b: T[]): T[] {
  const result: T[] = [];
  const longer = a.length >= b.length ? a : b;
  const shorter = a.length >= b.length ? b : a;
  longer.forEach((item, i) => {
    result.push(item);
    if (shorter[i] !== undefined) result.push(shorter[i]);
  });
  return result;
}

export function computeBattingOrder(activePlayers: Player[]): Player[] {
  const females = activePlayers.filter((p) => p.gender?.toLowerCase() === 'f');
  const males = activePlayers.filter((p) => p.gender?.toLowerCase() !== 'f');

  const orderedFemales = applyPowerOrdering(females);
  const orderedMales = applyPowerOrdering(males);

  // Alternate genders: M-F-M-F... (start with whichever group is larger)
  const order = interleave(orderedMales, orderedFemales);

  return order.map((p, i) => ({ ...p, battingSlot: i + 1 }));
}
