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

export default function App() {
  const { roster, loading, error, togglePlayer } = useRoster();

  const activePlayers = useMemo(
    () => roster.filter(p => p.active),
    [roster]
  );

  const orderedPlayers = useMemo(() => {
    if (!activePlayers.length) return roster;
    const ordered = computeBattingOrder(activePlayers);
    const inactive = roster.filter(p => !p.active).map(p => ({ ...p, battingSlot: null }));
    return [...ordered, ...inactive];
  }, [activePlayers, roster]);

  const innings = useMemo(() => {
    if (!activePlayers.length) return {};
    return computeLineup(activePlayers);
  }, [activePlayers]);

  const femalesOnField = useMemo(
    () => activePlayers.filter(p => p.gender?.toLowerCase() === 'f').length,
    [activePlayers]
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
        <CircularProgress />
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
    <Box sx={{ p: 3, backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant="h5" fontWeight={700}>
          Salty Stats
        </Typography>
        <Chip label={`${activePlayers.length} active`} size="small" color="primary" />
        <Chip
          label={femalesOnField >= 3 ? `${femalesOnField}F ✓` : `${femalesOnField}F — need 3+`}
          size="small"
          color={femalesOnField >= 3 ? 'success' : 'error'}
        />
      </Box>

      <LineupGrid
        roster={roster}
        orderedPlayers={orderedPlayers}
        innings={innings}
        onToggle={togglePlayer}
      />
    </Box>
  );
}
