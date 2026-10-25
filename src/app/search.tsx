/** S09 Search: titles, note text and checklist items, as you type. */
import { router } from 'expo-router';
import { Search as SearchIcon, SearchX } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { copy } from '@/copy';
import { useQuery } from '@/data/DataProvider';
import type { NoteSummary } from '@/data/types';
import { NoteActionsSheet } from '@/features/sheets';
import { gridColumns, useTheme } from '@/theme/theme';
import { TextField } from '@/ui/fields';
import { EmptyState, TopBar } from '@/ui/layout';
import { GridSkeleton, NoteGrid } from '@/ui/NoteGrid';
import { AppText } from '@/ui/Text';

export default function SearchScreen() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [actionFor, setActionFor] = useState<NoteSummary | null>(null);

  useEffect(() => {
    const h = setTimeout(() => setQuery(text.trim()), t.layout['search-debounce-ms']);
    return () => clearTimeout(h);
  }, [text, t.layout]);

  const results = useQuery((r) => r.searchNotes(query), [query]);
  const contentWidth = Math.min(width, 1280) - t.layout.gutter * 2;
  const columns = gridColumns(contentWidth);
  const typing = text.trim() !== query;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.color.bg }} edges={['top', 'left', 'right']}>
      <TopBar onBack={() => router.back()} title={copy.home.search} />
      <View style={{ paddingHorizontal: t.layout.gutter, paddingBottom: t.space[2], alignItems: 'center' }}>
        <View style={{ width: contentWidth }}>
          <TextField
            variant="search"
            label={copy.search.placeholder}
            placeholder={copy.search.placeholder}
            value={text}
            onChangeText={setText}
            onClear={() => setText('')}
            autoFocus
            returnKeyType="search"
            autoCorrect={false}
          />
        </View>
      </View>
      <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: t.space[8] }} keyboardShouldPersistTaps="handled">
        <View style={{ width: contentWidth, gap: t.space[3] }}>
          {!query ? (
            <EmptyState compact icon={SearchIcon} title={copy.home.search} body={copy.search.hint} />
          ) : !results.data || typing ? (
            <GridSkeleton columns={columns} />
          ) : results.data.length === 0 ? (
            <EmptyState compact icon={SearchX} title={copy.search.noneTitle} body={copy.search.noneBody(query)} />
          ) : (
            <>
              <AppText variant="sm" tone="muted" aria-live="polite">
                {copy.search.results(results.data.length)}
              </AppText>
              <NoteGrid
                notes={results.data}
                columns={columns}
                showFolder
                onOpen={(n) => router.push({ pathname: '/note/[id]', params: { id: n.id } })}
                onLongPress={setActionFor}
              />
            </>
          )}
        </View>
      </ScrollView>
      <NoteActionsSheet note={actionFor} onClose={() => setActionFor(null)} />
    </SafeAreaView>
  );
}
