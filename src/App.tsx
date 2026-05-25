import { useMemo, useState } from 'react';
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
import { computeLineup } from './utils/lineupEngine';
import { computeBattingOrder } from './utils/battingOrderEngine';
import { PALETTE } from './theme';
import { Player } from './types';

function exportFileName() {
  const d = new Date();
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `salty-order-${date}`;
}

export default function App() {
  const { roster, loading, error, togglePlayer } = useRoster();
  const gridApiRef = useGridApiRef();
  const [selfPitching, setSelfPitching] = useState(true);
  const [pitcherOverride, setPitcherOverride] = useState<string | null>(null);

  const activePlayers = useMemo(() => roster.filter((p) => p.active), [roster]);

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
    return computeLineup(activePlayers, pitcherOverride, selfPitching);
  }, [activePlayers, pitcherOverride, selfPitching]);

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          backgroundColor: PALETTE.black,
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
    <Box sx={{ minHeight: '100vh', backgroundColor: '#edf8f9' }}>
      <Box
        sx={{
          backgroundColor: '#102221',
          px: 3,
          py: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'right',
          gap: 2,
        }}
      >
        <Chip
          label={`${activePlayers.length} active`}
          size="small"
          sx={{
            backgroundColor: activePlayers.length >= 10 ? PALETTE.teal : '#e57373',
            fontWeight: 600,
          }}
        />
        {/* <Typography variant="h5" sx={{ fontWeight: 700, color: PALETTE.lightTeal, flexGrow: 1 }}>
          Salty Stats 🥎
        </Typography> */}

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

      <Box>
        <LineupGrid
          roster={roster}
          orderedPlayers={orderedPlayers}
          innings={innings}
          forcedAssignments={forcedAssignments}
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
