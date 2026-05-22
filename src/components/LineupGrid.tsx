import React, { useMemo } from 'react';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Lineup, Player } from '../types';
import { PALETTE } from '../theme';

const INNING_COUNT = 9;

// All derived from the palette: greens for infield/battery, teals for outfield/rover
const POSITION_COLORS: Record<string, string> = {
  Pitcher: PALETTE.black, // most distinctive — the ace
  Catcher: '#1f4e32', // deep sage
  '1B': '#2d6a46', // dark sage
  '2B': '#3d7d57', // medium sage
  '3B': '#4f9169', // lighter sage (still readable)
  Rover: '#1a7878', // distinct teal, separate from outfield
  SS: '#0f5e5e', // dark teal
  LF: '#1e7b79', // medium teal
  CF: '#258f8d', // brighter teal
  RF: '#2a9694', // lighter teal
};

function PositionChip({ value }: { value: string }) {
  const color = POSITION_COLORS[value];
  if (!color) {
    return <Typography variant="caption">—</Typography>;
  }
  return (
    <Chip
      label={value}
      size="small"
      sx={{
        backgroundColor: color,
        color: '#fff',
        fontWeight: 600,
        fontSize: '0.7rem',
        height: 22,
        borderRadius: '4px',
      }}
    />
  );
}

interface LineupGridProps {
  roster: Player[];
  orderedPlayers: Player[];
  innings: Lineup;
  onToggle: (name: string) => void;
}

interface RowData {
  id: string;
  battingSlot: number;
  active: boolean;
  name: string;
  gender: string;
  homeruns: number;
  [key: string]: string | number | boolean;
}

export function LineupGrid({
  roster: _roster,
  orderedPlayers,
  innings,
  onToggle,
}: LineupGridProps) {
  const rows: RowData[] = useMemo(() => {
    return orderedPlayers.map((player, idx) => {
      const inningCols: Record<string, string> = {};
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

  const inningColumns: GridColDef[] = Array.from({ length: INNING_COUNT }, (_, i) => ({
    field: `inning${i + 1}`,
    headerName: `Inning ${i + 1}`,
    flex: 1,
    minWidth: 70,
    sortable: false,
    align: 'center' as const,
    headerAlign: 'center' as const,
    renderCell: ({ value }: GridRenderCellParams) => <PositionChip value={value as string} />,
  }));

  const columns: GridColDef[] = [
    {
      field: 'active',
      headerName: '',
      width: 50,
      sortable: false,
      renderCell: ({ row }: GridRenderCellParams<RowData>) => (
        <Checkbox
          checked={row.active as boolean}
          size="small"
          sx={{ color: PALETTE.teal, '&.Mui-checked': { color: PALETTE.teal } }}
          onChange={() => onToggle(row.name as string)}
        />
      ),
    },
    {
      field: 'battingSlot',
      headerName: 'Order',
      width: 80,
      sortable: false,
    },
    {
      field: 'name',
      headerName: 'Player',
      flex: 1,
      minWidth: 120,
      renderCell: ({ row }: GridRenderCellParams<RowData>) => (
        <Typography variant="body2" sx={{ opacity: row.active ? 1 : 0.35, fontWeight: 500 }}>
          {row.name as string}
        </Typography>
      ),
    },
    {
      field: 'homeruns',
      headerName: 'HRs',
      width: 80,
      align: 'center',
      headerAlign: 'center',
      sortable: false,
    },
    ...inningColumns,
  ];

  return (
    <Box sx={{ width: '100%', borderRadius: 2, overflow: 'hidden', boxShadow: 1 }}>
      <DataGrid
        rows={rows}
        columns={columns}
        hideFooter
        disableColumnMenu
        rowHeight={40}
        sx={{
          border: 'none',
          backgroundColor: '#fff',
          '& .MuiDataGrid-row.inactive': { opacity: 0.45 },
          '& .MuiDataGrid-columnHeader': {
            backgroundColor: PALETTE.black,
            color: PALETTE.lightTeal,
            fontWeight: 700,
          },
          '& .MuiDataGrid-columnSeparator': { display: 'none' },
          '& .MuiDataGrid-cell': { display: 'flex', alignItems: 'center' },
        }}
        getRowClassName={({ row }) => (row.active ? '' : 'inactive')}
      />
    </Box>
  );
}
