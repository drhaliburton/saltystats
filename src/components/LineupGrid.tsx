import React, { useMemo } from 'react';
import { DataGrid, GridColDef, GridRenderCellParams, useGridApiRef } from '@mui/x-data-grid';
import Checkbox from '@mui/material/Checkbox';
import Switch from '@mui/material/Switch';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { ForcedAssignments, Lineup, Player } from '../types';
import { PALETTE } from '../theme';
import { NUM_INNINGS } from '../utils/lineupEngine';

export type LineupGridApiRef = ReturnType<typeof useGridApiRef>;

// All derived from the palette: greens for infield/battery, teals for outfield/rover
const POSITION_COLORS: Record<string, string> = {
  Pitcher: PALETTE.black,
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

const FORCED_COLOR = '#b45309';

function PositionChip({ value, forced }: { value: string; forced?: boolean }) {
  const color = POSITION_COLORS[value];
  if (!color && value !== 'SIT') {
    return (
      <Typography variant="caption" sx={{ color: '#aaa' }}>
        —
      </Typography>
    );
  }
  if (value === 'SIT') {
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
        backgroundColor: forced ? FORCED_COLOR : color,
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
  forcedAssignments: ForcedAssignments;
  onToggle: (name: string) => void;
  onPitcherChange: (name: string | null) => void;
  pitcherOverride: string | null;
  autoPitcher: string | null;
  selfPitching: boolean;
  apiRef: LineupGridApiRef;
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
  forcedAssignments,
  onToggle,
  onPitcherChange,
  pitcherOverride,
  autoPitcher,
  selfPitching,
  apiRef,
}: LineupGridProps) {
  // In self-pitching mode no one is assigned the Pitcher field position, so drive the
  // toggle from pitcherOverride directly. In normal mode derive it from the innings.
  const pitcherName = useMemo(
    () =>
      selfPitching
        ? (pitcherOverride ?? autoPitcher)
        : (orderedPlayers.find((p) => innings[p.name]?.includes('Pitcher'))?.name ?? null),
    [selfPitching, pitcherOverride, autoPitcher, orderedPlayers, innings]
  );

  const eligiblePitchers = useMemo(
    () =>
      orderedPlayers
        .filter((p) => p.active && p.pitcherPriority != null && !isNaN(p.pitcherPriority))
        .sort((a, b) => (a.pitcherPriority ?? 0) - (b.pitcherPriority ?? 0)),
    [orderedPlayers]
  );

  const rows: RowData[] = useMemo(() => {
    return orderedPlayers.map((player, idx) => {
      const inningCols: Record<string, string> = {};
      for (let i = 1; i <= NUM_INNINGS; i++) {
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

  const inningColumns: GridColDef[] = Array.from({ length: NUM_INNINGS }, (_, i) => ({
    field: `inning${i + 1}`,
    headerName: `${i + 1}`,
    flex: 1,
    minWidth: 70,
    sortable: false,
    align: 'center' as const,
    headerAlign: 'center' as const,
    renderCell: ({ value, row }: GridRenderCellParams) => (
      <PositionChip
        value={value as string}
        forced={forcedAssignments[row.name as string]?.[i] ?? false}
      />
    ),
  }));

  const columns: GridColDef[] = [
    {
      field: 'active',
      headerName: '',
      width: 50,
      sortable: false,
      disableExport: true,
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
    },
    {
      field: 'pitcher',
      headerName: 'Pitcher',
      width: 80,
      sortable: false,
      disableExport: true,
      align: 'center' as const,
      headerAlign: 'center' as const,
      renderCell: ({ row }: GridRenderCellParams<RowData>) => {
        const player = orderedPlayers.find((p) => p.name === row.name);
        if (!player || player.pitcherPriority === null) return null;
        if (selfPitching) {
          return '✓';
        }
        const isOn = pitcherName === row.name;
        return (
          <Switch
            checked={isOn}
            size="small"
            onChange={() => {
              if (isOn) {
                const next = eligiblePitchers.find((p) => p.name !== row.name)?.name ?? null;
                onPitcherChange(next);
              } else {
                onPitcherChange(row.name as string);
              }
            }}
            sx={{
              '& .MuiSwitch-switchBase.Mui-checked': { color: PALETTE.teal },
              '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                backgroundColor: PALETTE.teal,
              },
            }}
          />
        );
      },
    },
    ...inningColumns,
  ];

  return (
    <Box sx={{ width: '100%', overflow: 'hidden' }}>
      <DataGrid
        apiRef={apiRef}
        rows={rows}
        columns={columns}
        hideFooter
        disableColumnMenu
        disableVirtualization
        rowHeight={40}
        columnHeaderHeight={47}
        initialState={{
          sorting: { sortModel: [{ field: 'battingSlot', sort: 'asc' }] },
        }}
        sx={{
          border: 'none',
          borderRadius: 0,
          backgroundColor: '#fff',
          '& .MuiDataGrid-row.inactive': { opacity: 0.45 },
          '& .MuiDataGrid-columnHeader': {
            backgroundColor: '#204544',
            color: 'white',
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
