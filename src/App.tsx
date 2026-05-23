import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
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
  const [pitcherOverride, setPitcherOverride] = useState<string | null>(null);

  const activePlayers = useMemo(() => roster.filter((p) => p.active), [roster]);

  const orderedPlayers = useMemo((): Player[] => {
    if (!activePlayers.length) return roster;
    const ordered = computeBattingOrder(activePlayers);
    const inactive = roster.filter((p) => !p.active).map((p) => ({ ...p, battingSlot: undefined }));
    return [...ordered, ...inactive];
  }, [activePlayers, roster]);

  const innings = useMemo(() => {
    if (!activePlayers.length) return {};
    return computeLineup(activePlayers, pitcherOverride);
  }, [activePlayers, pitcherOverride]);

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
          backgroundColor: PALETTE.black,
          px: 3,
          py: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 700, color: PALETTE.lightTeal, flexGrow: 1 }}>
          Salty Stats 🥎
        </Typography>

        <Chip
          label={`${activePlayers.length} active`}
          size="small"
          sx={{
            backgroundColor: activePlayers.length >= 10 ? PALETTE.teal : '#e57373',
            fontWeight: 600,
          }}
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

      <Box sx={{ p: 3 }}>
        <LineupGrid
          roster={roster}
          orderedPlayers={orderedPlayers}
          innings={innings}
          onToggle={togglePlayer}
          onPitcherChange={setPitcherOverride}
          apiRef={gridApiRef}
        />
      </Box>
    </Box>
  );
}
