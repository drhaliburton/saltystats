import React, { useMemo } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

const INNING_COUNT = 9;


const POSITION_COLORS = {
  SIT: '#757575',
  Pitcher: '#1565c0',
  Catcher: '#6a1b9a',
  '1B': '#2e7d32',
  '2B': '#388e3c',
  '3B': '#1b5e20',
  Rover: '#f57c00',
  SS: '#e65100',
  LF: '#0277bd',
  CF: '#01579b',
  RF: '#006064',
};

function PositionChip({ value }) {
  const color = POSITION_COLORS[value] || '#424242';
  if (value === 'SIT') return '-'
  return (
    <Box fullWidth display="flex" alignItems="center" justifyContent="center">
    <Chip
      label={value}
      size="small"
      sx={{
        backgroundColor: color,
        color: '#fff',
        fontWeight: 600,
        fontSize: '0.7rem',
        height: 22,
      }}
    />
    </Box>
  );
}

export function LineupGrid({ roster, orderedPlayers, innings, onToggle }) {
  const rows = useMemo(() => {
    return orderedPlayers.map((player, idx) => {
      const inningCols = {};
      for (let i = 1; i <= INNING_COUNT; i++) {
        inningCols[`inning${i}`] = innings[player.name]?.[i - 1] ?? '—';
      }
      return {
        id: player.name,
        battingSlot: player.battingSlot ?? idx + 1,
        active: player.active,
        name: player.name,
        gender: player.gender,
        homeruns: player.homeruns,
        ...inningCols,
      };
    });
  }, [orderedPlayers, innings]);

  const inningColumns = Array.from({ length: INNING_COUNT }, (_, i) => ({
    field: `inning${i + 1}`,
    headerName: `Inning ${i + 1}`,
    flex: 1,
    minWidth: 70,
    sortable: false,
    alignItems: 'center',
    textAlign: 'center',
    renderCell: ({ value }) => <PositionChip value={value} />,
  }));

  const columns = [
    {
      field: 'active',
      headerName: '',
      width: 50,
      sortable: false,
      renderCell: ({ row }) => (
        <Checkbox
          checked={row.active}
          size="small"
          onChange={() => onToggle(row.name)}
        />
      ),
    },
    {
      field: 'battingSlot',
      headerName: 'Order',
      width: 80,
    },
    {
      field: 'name',
      headerName: 'Player',
      flex: 1.5,
      minWidth: 120,
      renderCell: ({ row }) => (
        <Typography
          variant="body2"
          sx={{ opacity: row.active ? 1 : 0.4, fontWeight: 500 }}
        >
          {row.name}
        </Typography>
      ),
    },
    {
      field: 'homeruns',
      headerName: 'HR',
      width: 60,
      type: 'number',
    },
    ...inningColumns,
  ];

  return (
    <Box sx={{ width: '100%' }}>
      <DataGrid
        rows={rows}
        columns={columns}
        hideFooter
        disableColumnMenu
        rowHeight={40}
        sx={{
          '& .MuiDataGrid-row.inactive': {
            opacity: 0.5,
          },
          '& .MuiDataGrid-columnHeader': {
            backgroundColor: '#1a1a2e',
            color: '#fff',
            fontWeight: 700,
          },
          '& .MuiDataGrid-cell': {
            display: 'flex',
            alignItems: 'center',
          },
        }}
        getRowClassName={({ row }) => (row.active ? '' : 'inactive')}
      />
    </Box>
  );
}
