import { View } from 'react-native';

import type { NoteSummary } from '@/data/types';
import { useTheme } from '@/theme/theme';

import { toCard } from './format';
import { NoteCard } from './NoteCard';
import { useNow } from './useNow';

/**
 * Notes as a masonry grid (cards keep their natural height) or a single list.
 * Order runs left to right, then down, so pinned notes stay at the top.
 */
export function NoteGrid({
  notes,
  columns,
  showFolder,
  onOpen,
  onLongPress,
}: {
  notes: NoteSummary[];
  columns: number;
  showFolder?: boolean;
  onOpen: (n: NoteSummary) => void;
  onLongPress?: (n: NoteSummary) => void;
}) {
  const t = useTheme();
  const gap = t.layout['grid-gap'];
  const now = useNow();
  const cols: NoteSummary[][] = Array.from({ length: Math.max(1, columns) }, () => []);
  notes.forEach((n, i) => cols[i % cols.length].push(n));
  return (
    <View style={{ flexDirection: 'row', gap }}>
      {cols.map((col, i) => (
        <View key={i} style={{ flex: 1, gap }}>
          {col.map((n) => (
            <NoteCard
              key={n.id}
              note={toCard(n, { showFolder, now })}
              onPress={() => onOpen(n)}
              onLongPress={onLongPress ? () => onLongPress(n) : undefined}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

/** Loading placeholders in the shape of the grid (no spinner). */
export function GridSkeleton({ columns }: { columns: number }) {
  const t = useTheme();
  const gap = t.layout['grid-gap'];
  const heights = [120, 180, 96, 150, 110, 170];
  return (
    <View style={{ flexDirection: 'row', gap }} aria-busy aria-label="Loading notes">
      {Array.from({ length: columns }, (_, c) => (
        <View key={c} style={{ flex: 1, gap }}>
          {heights
            .filter((_, i) => i % columns === c)
            .map((h, i) => (
              <View key={i} style={{ height: h, borderRadius: t.radius.md, backgroundColor: t.color.surface }} />
            ))}
        </View>
      ))}
    </View>
  );
}
