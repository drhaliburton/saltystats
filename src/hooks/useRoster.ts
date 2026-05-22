import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { Player } from '../types';

const CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSbj9IbcgJtQv65OvGUVwbQU62eqVqVplcw_stGZwjvXejAYBwCfya99dP5uXfDxyYOddtrDTWo0oWy/pub?output=csv';

const STORAGE_KEY = 'saltystats_active_players';

function normalizePlayer(row: Record<string, string>): Player {
  return {
    name: row['Player']?.trim() ?? '',
    gender: row['Gender']?.trim() ?? '',
    battingPower: parseInt(row['Batting power'], 10) || 3,
    homeruns: parseInt(row['Homerun count'], 10) || 0,
    preferredPosition: row['Preferred poisition']?.trim() ?? '',
    alt1: row['alt 1']?.trim() ?? '',
    alt2: row['alt 2']?.trim() ?? '',
    alt3: row['alt 3']?.trim() ?? '',
    pitcherPriority: row['Pitcher priority'] ? parseInt(row['Pitcher priority'], 10) : null,
    active: true,
  };
}

function loadActiveState(players: Player[]): Player[] {
  try {
    const saved: Record<string, boolean> = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return players.map((p) => ({ ...p, active: saved[p.name] !== false }));
  } catch {
    return players.map((p) => ({ ...p, active: true }));
  }
}

function saveActiveState(players: Player[]): void {
  const state: Record<string, boolean> = {};
  players.forEach((p) => (state[p.name] = p.active));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

interface UseRosterReturn {
  roster: Player[];
  loading: boolean;
  error: string | null;
  togglePlayer: (name: string) => void;
}

export function useRoster(): UseRosterReturn {
  const [roster, setRoster] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Papa.parse<Record<string, string>>(CSV_URL, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: ({ data, errors }) => {
        if (errors.length) {
          setError('Failed to parse spreadsheet: ' + errors[0].message);
          setLoading(false);
          return;
        }
        const players = data.map(normalizePlayer).filter((p) => p.name);
        setRoster(loadActiveState(players));
        setLoading(false);
      },
      error: (err: Error) => {
        setError('Failed to fetch spreadsheet: ' + err.message);
        setLoading(false);
      },
    });
  }, []);

  function togglePlayer(name: string): void {
    setRoster((prev) => {
      const next = prev.map((p) => (p.name === name ? { ...p, active: !p.active } : p));
      saveActiveState(next);
      return next;
    });
  }

  return { roster, loading, error, togglePlayer };
}
