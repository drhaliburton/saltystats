import { useMemo } from 'react';
import { GridRenderEditCellParams, useGridApiContext } from '@mui/x-data-grid';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import ListSubheader from '@mui/material/ListSubheader';
import Box from '@mui/material/Box';
import { PALETTE } from '../theme';
import { Lineup } from '../types';

export const POSITION_COLOURS: Record<string, string> = {
  Pitcher: PALETTE.darkestTeal,
  Catcher: '#1f4e32',
  '1B': '#2d6a46',
  '2B': '#3d7d57',
  '3B': '#4f9169',
  Rover: '#1a7878',
  SS: '#0f5e5e',
  LF: '#1e7b79',
  CF: '#258f8d',
  RF: '#2a9694',
};

export const FORCED_COLOUR = '#d96b27';
export const OVERRIDE_COLOUR = '#eab308';

export function PositionChip({
  value,
  forced,
  overridden,
}: {
  value: string;
  forced?: boolean;
  overridden?: boolean;
}) {
  if (value === 'SIT') {
    if (overridden) {
      return (
        <Chip
          label="SIT"
          size="small"
          variant="outlined"
          sx={{
            borderColor: OVERRIDE_COLOUR,
            color: OVERRIDE_COLOUR,
            fontWeight: 600,
            fontSize: '0.7rem',
            height: 22,
            borderRadius: '4px',
          }}
        />
      );
    }
    return (
      <Typography variant="caption" sx={{ color: '#aaa' }}>
        —
      </Typography>
    );
  }

  const colour = POSITION_COLOURS[value];
  if (!colour) {
    return (
      <Typography variant="caption" sx={{ color: '#aaa' }}>
        —
      </Typography>
    );
  }

  return (
    <Chip
      label={value}
      size="small"
      sx={{
        backgroundColor: overridden ? OVERRIDE_COLOUR : forced ? FORCED_COLOUR : colour,
        color: overridden ? '#000' : '#fff',
        fontWeight: 600,
        fontSize: '0.7rem',
        height: 22,
        borderRadius: '4px',
      }}
    />
  );
}

export function InningEditCell({
  params,
  inningIndex,
  innings,
  engineInnings,
  playerPrefs = [],
  onOverride,
}: {
  params: GridRenderEditCellParams;
  inningIndex: number;
  innings: Lineup;
  engineInnings: Lineup;
  playerPrefs?: string[];
  onOverride: (
    playerName: string,
    inningIndex: number,
    newPosition: string,
    currentPosition: string,
    swapTargetName: string | null
  ) => void;
}) {
  const apiRef = useGridApiContext();
  const playerName = params.row.name as string;
  const currentValue = params.value as string;

  const options = useMemo(() => {
    const posSet = new Set<string>();
    const pool = currentValue === 'SIT' ? engineInnings : innings;
    for (const playerPositions of Object.values(pool)) {
      const pos = playerPositions[inningIndex];
      if (pos && pos !== 'SIT' && pos !== '—') posSet.add(pos);
    }
    return Array.from(posSet);
  }, [innings, engineInnings, inningIndex, currentValue]);

  const preferredOptions = useMemo(
    () =>
      options
        .filter((pos) => playerPrefs.includes(pos))
        .sort((a, b) => playerPrefs.indexOf(a) - playerPrefs.indexOf(b)),
    [options, playerPrefs]
  );

  const otherOptions = useMemo(
    () => options.filter((pos) => !playerPrefs.includes(pos)),
    [options, playerPrefs]
  );

  const stop = () => {
    if (apiRef.current?.getCellMode(params.id, params.field) === 'edit') {
      apiRef.current.stopCellEditMode({ id: params.id, field: params.field });
    }
  };

  const handleChange = (newValue: string) => {
    if (newValue !== currentValue) {
      const swapEntry = Object.entries(innings).find(
        ([name, positions]) => name !== playerName && positions[inningIndex] === newValue
      );
      onOverride(playerName, inningIndex, newValue, currentValue, swapEntry?.[0] ?? null);
      apiRef.current.setEditCellValue({ id: params.id, field: params.field, value: newValue });
    }
    stop();
  };

  const renderOption = (pos: string) => (
    <MenuItem key={pos} value={pos} sx={{ py: 0.5 }}>
      <Box sx={{ pointerEvents: 'none' }}>
        <PositionChip value={pos} />
      </Box>
    </MenuItem>
  );

  return (
    <Select
      value={currentValue === 'SIT' ? '' : currentValue}
      displayEmpty
      onChange={(e) => handleChange(e.target.value)}
      size="small"
      autoFocus
      open
      fullWidth
      onClose={stop}
      sx={{ fontSize: '0.7rem', height: 30, minWidth: 80 }}
    >
      {preferredOptions.length > 0 && (
        <ListSubheader sx={{ fontSize: '0.65rem', lineHeight: '24px' }}>Preferred</ListSubheader>
      )}
      {preferredOptions.map(renderOption)}
      {otherOptions.length > 0 && (
        <ListSubheader sx={{ fontSize: '0.65rem', lineHeight: '24px' }}>Other</ListSubheader>
      )}
      {otherOptions.map(renderOption)}
      {currentValue !== 'SIT' && (
        <ListSubheader sx={{ fontSize: '0.65rem', lineHeight: '24px' }}>Bench</ListSubheader>
      )}
      {currentValue !== 'SIT' && (
        <MenuItem value="SIT" sx={{ py: 0.5 }}>
          <Box sx={{ pointerEvents: 'none' }}>
            <Chip
              label="SIT"
              size="small"
              variant="outlined"
              sx={{
                borderColor: '#aaa',
                color: '#aaa',
                fontWeight: 600,
                fontSize: '0.7rem',
                height: 22,
                borderRadius: '4px',
              }}
            />
          </Box>
        </MenuItem>
      )}
    </Select>
  );
}
