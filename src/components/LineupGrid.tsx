import { useMemo } from 'react';
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridRenderEditCellParams,
  useGridApiRef,
} from '@mui/x-data-grid';
import Checkbox from '@mui/material/Checkbox';
import Switch from '@mui/material/Switch';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { ColumnOverrides, ForcedAssignments, Lineup, Player } from '../types';
import { PALETTE } from '../theme';
import { NUM_INNINGS } from '../utils/lineupEngine';
import { InningEditCell, PositionChip } from './LineupCell';

export type LineupGridApiRef = ReturnType<typeof useGridApiRef>;

interface LineupGridProps {
  roster: Player[];
  orderedPlayers: Player[];
  innings: Lineup;
  engineInnings: Lineup;
  forcedAssignments: ForcedAssignments;
  columnOverrides: ColumnOverrides;
  onOverride: (
    playerName: string,
    inningIndex: number,
    newPosition: string,
    currentPosition: string,
    swapTargetName: string | null
  ) => void;
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
  engineInnings,
  forcedAssignments,
  columnOverrides,
  onOverride,
  onToggle,
  onPitcherChange,
  pitcherOverride,
  autoPitcher,
  selfPitching,
  apiRef,
}: LineupGridProps) {
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

  const inningColumns: GridColDef[] = useMemo(
    () =>
      Array.from({ length: NUM_INNINGS }, (_, i) => ({
        field: `inning${i + 1}`,
        headerName: `${i + 1}`,
        flex: 1,
        minWidth: 70,
        sortable: false,
        align: 'center' as const,
        headerAlign: 'center' as const,
        editable: true,
        isCellEditable: (params: GridRenderCellParams) =>
          (params.row.active as boolean) && params.value !== '—' && !!params.value,
        renderCell: ({ value, row }: GridRenderCellParams) => {
          const name = row.name as string;
          const overrideVal = columnOverrides[name]?.[i];
          const isOverridden =
            overrideVal !== undefined && overrideVal !== engineInnings[name]?.[i];
          const isForced = !isOverridden && (forcedAssignments[name]?.[i] ?? false);
          return (
            <PositionChip value={value as string} forced={isForced} overridden={isOverridden} />
          );
        },
        renderEditCell: (params: GridRenderEditCellParams) => {
          const player = orderedPlayers.find((p) => p.name === (params.row.name as string));
          const playerPrefs = player
            ? [player.preferredPosition, player.alt1, player.alt2, player.alt3].filter(Boolean)
            : [];
          return (
            <InningEditCell
              params={params}
              inningIndex={i}
              innings={innings}
              engineInnings={engineInnings}
              playerPrefs={playerPrefs}
              onOverride={onOverride}
            />
          );
        },
      })),
    [innings, engineInnings, forcedAssignments, columnOverrides, onOverride, orderedPlayers]
  );

  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: 'active',
        headerName: '',
        sortable: false,
        width: 50,
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
        align: 'center',
        headerAlign: 'center',
        width: 65,
      },
      {
        field: 'name',
        headerName: 'Player',
        flex: 1,
        minWidth: 80,
        renderCell: ({ row }: GridRenderCellParams<RowData>) => (
          <Typography variant="body2" sx={{ opacity: row.active ? 1 : 0.35, fontWeight: 500 }}>
            {row.name as string}
          </Typography>
        ),
      },
      {
        field: 'homeruns',
        headerName: 'HRs',
        maxWidth: 10,
        align: 'center',
        headerAlign: 'center',
      },
      {
        field: 'pitcher',
        headerName: 'Pitcher',
        maxWidth: 10,
        sortable: false,
        disableExport: true,
        align: 'center',
        headerAlign: 'center',
        renderCell: ({ row }: GridRenderCellParams<RowData>) => {
          const player = orderedPlayers.find((p) => p.name === row.name);
          if (!player || player.pitcherPriority === null) return null;
          if (selfPitching) return '✓';
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
    ],
    [
      inningColumns,
      orderedPlayers,
      selfPitching,
      pitcherName,
      eligiblePitchers,
      onToggle,
      onPitcherChange,
    ]
  );

  return (
    <Box sx={{ width: '100%', overflow: 'hidden', pb: 1 }}>
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
        processRowUpdate={(newRow) => newRow}
        onCellClick={(params) => {
          if (!params.field.startsWith('inning')) return;
          if (!(params.row as RowData).active) return;
          const value = params.value;
          if (!value || value === '—') return;
          if (apiRef.current?.getCellMode(params.id, params.field) === 'view') {
            apiRef.current.startCellEditMode({ id: params.id, field: params.field });
          }
        }}
        sx={styleOverrides}
        getRowClassName={({ row }) => (row.active ? '' : 'inactive')}
      />
    </Box>
  );
}

const styleOverrides = {
  border: 'none',
  borderRadius: 0,
  backgroundColor: '#fff',
  '& .MuiDataGrid-row.inactive': { opacity: 0.45 },
  '& .MuiDataGrid-columnHeader': {
    backgroundColor: PALETTE.darkTeal,
    color: 'white',
    fontWeight: 700,
  },
  '& .MuiDataGrid-columnSeparator': { display: 'none' },
  '& .MuiDataGrid-cell': { display: 'flex', alignItems: 'center' },
  '& .MuiDataGrid-cell--editing': {
    backgroundColor: 'transparent !important',
    boxShadow: 'none !important',
  },
  // Pinned columns — sticky positioning
  '& .MuiDataGrid-cell[data-field="active"]': {
    position: 'sticky',
    left: 0,
    zIndex: 3,
    backgroundColor: 'var(--DataGrid-t-color-background-base, #fff)',
  },
  '& .MuiDataGrid-cell[data-field="battingSlot"]': {
    position: 'sticky',
    left: '50px',
    zIndex: 3,
    backgroundColor: 'var(--DataGrid-t-color-background-base, #fff)',
  },
  '& .MuiDataGrid-cell[data-field="name"]': {
    position: 'sticky',
    left: '115px',
    zIndex: 3,
    backgroundColor: 'var(--DataGrid-t-color-background-base, #fff)',
    borderRight: '1px solid rgb(241, 241, 236)',
  },
  // Row hover/selected — inherit from the row so DataGrid's computed color is reused exactly
  '& .MuiDataGrid-row:hover .MuiDataGrid-cell[data-field="active"], & .MuiDataGrid-row:hover .MuiDataGrid-cell[data-field="battingSlot"], & .MuiDataGrid-row:hover .MuiDataGrid-cell[data-field="name"], & .MuiDataGrid-row.Mui-selected .MuiDataGrid-cell[data-field="active"], & .MuiDataGrid-row.Mui-selected .MuiDataGrid-cell[data-field="battingSlot"], & .MuiDataGrid-row.Mui-selected .MuiDataGrid-cell[data-field="name"]':
    {
      backgroundColor: 'inherit',
    },
  '& .MuiDataGrid-columnHeader[data-field="active"]': {
    position: 'sticky',
    left: 0,
    zIndex: 5,
  },
  '& .MuiDataGrid-columnHeader[data-field="battingSlot"]': {
    position: 'sticky',
    left: '50px',
    zIndex: 5,
  },
  '& .MuiDataGrid-columnHeader[data-field="name"]': {
    position: 'sticky',
    left: '115px',
    zIndex: 5,
  },
};
