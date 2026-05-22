import React, { useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import { LineupGrid } from './components/LineupGrid';
import { useRoster } from './hooks/useRoster';
import { computeLineup } from './utils/lineupEngine';
import { computeBattingOrder } from './utils/battingOrderEngine';
import { PALETTE } from './theme';
import { Player } from './types';

export default function App() {
  const { roster, loading, error, togglePlayer } = useRoster();

  const activePlayers = useMemo(() => roster.filter((p) => p.active), [roster]);

  const orderedPlayers = useMemo((): Player[] => {
    if (!activePlayers.length) return roster;
    const ordered = computeBattingOrder(activePlayers);
    const inactive = roster.filter((p) => !p.active).map((p) => ({ ...p, battingSlot: undefined }));
    return [...ordered, ...inactive];
  }, [activePlayers, roster]);

  const innings = useMemo(() => {
    if (!activePlayers.length) return {};
    return computeLineup(activePlayers);
  }, [activePlayers]);

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
      {/* Header banner */}
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
            backgroundColor: activePlayers.length >= 10 ? PALETTE.teal : 'red',
            color: PALETTE.black,
            fontWeight: 600,
          }}
        />
      </Box>

      {/* Content */}
      <Box sx={{ p: 3 }}>
        <LineupGrid
          roster={roster}
          orderedPlayers={orderedPlayers}
          innings={innings}
          onToggle={togglePlayer}
        />
      </Box>
    </Box>
  );
}
