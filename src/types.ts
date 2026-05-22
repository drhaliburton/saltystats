export interface Player {
  name: string;
  gender: string;
  battingPower: number;
  homeruns: number;
  preferredPosition: string;
  alt1: string;
  alt2: string;
  alt3: string;
  pitcherPriority: number | null;
  active: boolean;
  battingSlot?: number;
}

export type Lineup = Record<string, string[]>;
