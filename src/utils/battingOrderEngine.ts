import { Player } from '../types';

function applyPowerOrdering(players: Player[]): Player[] {
  const onBase = players
    .filter((p) => p.battingPower <= 2)
    .sort((a, b) => a.battingPower - b.battingPower);
  const power = players
    .filter((p) => p.battingPower >= 3)
    .sort((a, b) => b.battingPower - a.battingPower);

  const order: Player[] = [];
  let ob = 0,
    pw = 0,
    slot = 0;
  while (ob < onBase.length || pw < power.length) {
    if ((slot + 1) % 4 === 0 && pw < power.length) {
      order.push(power[pw++]);
    } else if (ob < onBase.length) {
      order.push(onBase[ob++]);
    } else {
      order.push(power[pw++]);
    }
    slot++;
  }
  return order;
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
