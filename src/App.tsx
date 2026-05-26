import { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import { useGridApiRef } from '@mui/x-data-grid';
import { LineupGrid } from './components/LineupGrid';
import { useRoster } from './hooks/useRoster';
import { computeLineup, findBestSeed } from './utils/lineupEngine';
import { computeBattingOrder } from './utils/battingOrderEngine';
import { PALETTE } from './theme';
import { ColumnOverrides, Lineup, Player } from './types';
import { FORCED_COLOUR, OVERRIDE_COLOUR } from './components/LineupCell';

function exportFileName() {
  const d = new Date();
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `salty-order-${date}`;
}

export default function App() {
  const { roster, loading, error, togglePlayer } = useRoster();
  const gridApiRef = useGridApiRef();
  const [selfPitching, setSelfPitching] = useState(
    () => localStorage.getItem('salty-self-pitching') !== 'false'
  );

  const [pitcherOverride, setPitcherOverride] = useState<string | null>(() =>
    localStorage.getItem('salty-pitcher-override')
  );
  const [shuffleSeed, setShuffleSeed] = useState<number | undefined>(() => {
    const stored = localStorage.getItem('salty-shuffle-seed');
    return stored !== null ? Number(stored) : undefined;
  });
  const [columnOverrides, setColumnOverrides] = useState<ColumnOverrides>(() => {
    try {
      const stored = localStorage.getItem('salty-column-overrides');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('salty-self-pitching', String(selfPitching));
  }, [selfPitching]);

  useEffect(() => {
    if (pitcherOverride !== null) {
      localStorage.setItem('salty-pitcher-override', pitcherOverride);
    } else {
      localStorage.removeItem('salty-pitcher-override');
    }
  }, [pitcherOverride]);

  useEffect(() => {
    if (shuffleSeed !== undefined) {
      localStorage.setItem('salty-shuffle-seed', String(shuffleSeed));
    } else {
      localStorage.removeItem('salty-shuffle-seed');
    }
  }, [shuffleSeed]);

  useEffect(() => {
    localStorage.setItem('salty-column-overrides', JSON.stringify(columnOverrides));
  }, [columnOverrides]);

  const activePlayers = useMemo(() => roster.filter((p) => p.active), [roster]);

  const reoptimize = useCallback(
    (players: Player[]) => {
      if (!players.length) return;
      setShuffleSeed(findBestSeed(players, pitcherOverride, selfPitching));
    },
    [pitcherOverride, selfPitching]
  );

  // Synchronously re-optimize when the active player set changes so React discards
  // the intermediate render and never paints an unoptimized lineup.
  const [prevActiveFingerprint, setPrevActiveFingerprint] = useState('');
  const activeFingerprint = activePlayers
    .map((p) => p.name)
    .sort()
    .join(',');
  if (activePlayers.length > 0 && activeFingerprint !== prevActiveFingerprint) {
    setPrevActiveFingerprint(activeFingerprint);
    if (prevActiveFingerprint !== '' || shuffleSeed === undefined) {
      setShuffleSeed(findBestSeed(activePlayers, pitcherOverride, selfPitching));
    }
  }

  const orderedPlayers = useMemo((): Player[] => {
    if (!activePlayers.length) return roster;
    const ordered = computeBattingOrder(activePlayers);
    const inactive = roster.filter((p) => !p.active).map((p) => ({ ...p, battingSlot: undefined }));
    return [...ordered, ...inactive];
  }, [activePlayers, roster]);

  const {
    innings,
    forced: forcedAssignments,
    pitcher: autoPitcher,
  } = useMemo(() => {
    if (!activePlayers.length) return { innings: {}, forced: {}, pitcher: null };
    return computeLineup(activePlayers, pitcherOverride, selfPitching, shuffleSeed);
  }, [activePlayers, pitcherOverride, selfPitching, shuffleSeed]);

  const effectiveInnings: Lineup = useMemo(() => {
    const result: Lineup = {};
    for (const [name, positions] of Object.entries(innings)) {
      result[name] = positions.map((pos, i) => columnOverrides[name]?.[i] ?? pos);
    }
    return result;
  }, [innings, columnOverrides]);

  const handleOverride = useCallback(
    (
      playerName: string,
      inningIndex: number,
      newPosition: string,
      currentPosition: string,
      swapTargetName: string | null
    ) => {
      setColumnOverrides((prev) => {
        const next = { ...prev };
        next[playerName] = { ...(next[playerName] ?? {}), [inningIndex]: newPosition };
        if (swapTargetName) {
          next[swapTargetName] = {
            ...(next[swapTargetName] ?? {}),
            [inningIndex]: currentPosition,
          };
        }
        return next;
      });
    },
    []
  );

  const overrideCount = useMemo(() => {
    let count = 0;
    for (const [name, inningMap] of Object.entries(columnOverrides)) {
      for (const [idx, val] of Object.entries(inningMap)) {
        if (val !== innings[name]?.[Number(idx)]) count++;
      }
    }
    return count;
  }, [columnOverrides, innings]);

  const forcedCount = useMemo(() => {
    let count = 0;
    for (const [name, forcedArr] of Object.entries(forcedAssignments)) {
      for (let i = 0; i < forcedArr.length; i++) {
        if (forcedArr[i] && columnOverrides[name]?.[i] === undefined) count++;
      }
    }
    return count;
  }, [forcedAssignments, columnOverrides]);

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          backgroundColor: PALETTE.darkestTeal,
        }}
      >
        <CircularProgress sx={{ color: PALETTE.lightTeal }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#edf8f9', overscrollBehavior: 'none' }}>
      <Box
        sx={{
          backgroundColor: PALETTE.darkestTeal,
          px: 1.5,
          py: 1,
          height: '47px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={`${activePlayers.length} active`}
            size="small"
            sx={{
              backgroundColor:
                activePlayers.length >= (selfPitching ? 9 : 10) ? PALETTE.teal : '#e57373',
              fontWeight: 600,
            }}
          />
          {forcedCount > 0 && (
            <Chip
              label={`${forcedCount} forced`}
              size="small"
              sx={{ backgroundColor: FORCED_COLOUR, color: '#fff', fontWeight: 600 }}
            />
          )}
          {overrideCount > 0 && (
            <Chip
              label={`${overrideCount} overrides`}
              size="small"
              onDelete={() => setColumnOverrides({})}
              sx={{
                backgroundColor: OVERRIDE_COLOUR,
                color: '#fff',
                fontWeight: 600,
                '& .MuiChip-deleteIcon': {
                  color: 'rgba(255,255,255,0.7)',
                  '&:hover': { color: '#fff' },
                },
              }}
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FormControlLabel
            control={
              <Switch
                checked={selfPitching}
                onChange={(e) => setSelfPitching(e.target.checked)}
                size="small"
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': { color: PALETTE.lightTeal },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: PALETTE.lightTeal,
                  },
                }}
              />
            }
            label={
              <Typography variant="body2" sx={{ color: '#fff', whiteSpace: 'nowrap' }}>
                Self-pitching?
              </Typography>
            }
            labelPlacement="start"
            sx={{ m: 0 }}
          />
          <Button
            size="small"
            variant="outlined"
            onClick={() => reoptimize(activePlayers)}
            sx={{ textTransform: 'none' }}
          >
            Shuffle
          </Button>

          <Button
            size="small"
            variant="outlined"
            onClick={() =>
              gridApiRef.current?.exportDataAsCsv({
                fileName: exportFileName(),
                getRowsToExport: () => orderedPlayers.filter((p) => p.active).map((p) => p.name),
              })
            }
            sx={{ textTransform: 'none' }}
          >
            Export .csv
          </Button>
        </Box>
      </Box>

      <Box>
        <LineupGrid
          roster={roster}
          orderedPlayers={orderedPlayers}
          innings={effectiveInnings}
          engineInnings={innings}
          forcedAssignments={forcedAssignments}
          columnOverrides={columnOverrides}
          onOverride={handleOverride}
          onToggle={togglePlayer}
          onPitcherChange={setPitcherOverride}
          pitcherOverride={pitcherOverride}
          autoPitcher={autoPitcher}
          selfPitching={selfPitching}
          apiRef={gridApiRef}
        />
      </Box>
    </Box>
  );
}
