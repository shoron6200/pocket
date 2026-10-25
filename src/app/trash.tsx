/** S11 Trash: deleted notes wait 30 days. Restore, delete for good, or empty it. */
import { router } from 'expo-router';
import { Trash } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { copy } from '@/copy';
import { useQuery, useRepo } from '@/data/DataProvider';
import type { NoteSummary } from '@/data/types';
import { NoteActionsSheet } from '@/features/sheets';
import { gridColumns, useTheme } from '@/theme/theme';
import { Button } from '@/ui/controls';
import { EmptyState, TopBar } from '@/ui/layout';
import { GridSkeleton, NoteGrid } from '@/ui/NoteGrid';
import { Dialog } from '@/ui/overlays';
import { useSnackbar } from '@/ui/snackbar';
import { AppText } from '@/ui/Text';

export default function TrashScreen() {
  const t = useTheme();
  const repo = useRepo();
  const snack = useSnackbar();
  const { width } = useWindowDimensions();
  const { data: notes } = useQuery((r) => r.listTrash(), []);
  const [actionFor, setActionFor] = useState<NoteSummary | null>(null);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const contentWidth = Math.min(width, 1280) - t.layout.gutter * 2;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.color.bg }} edges={['top', 'left', 'right']}>
      <TopBar
        onBack={() => router.back()}
        title={copy.trash.title}
        actions={notes && notes.length > 0 ? <Button label={copy.trash.emptyAll} variant="text" onPress={() => setConfirmEmpty(true)} /> : null}
      />
      <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: t.space[8] }}>
        <View style={{ width: contentWidth, gap: t.space[3], paddingTop: t.space[2] }}>
          {!notes ? (
            <GridSkeleton columns={gridColumns(contentWidth)} />
          ) : notes.length === 0 ? (
            <EmptyState icon={Trash} title={copy.trash.emptyTitle} body={copy.trash.emptyBody} />
          ) : (
            <>
              <AppText variant="sm" tone="muted">
                {copy.trash.hint}
              </AppText>
              <NoteGrid notes={notes} columns={gridColumns(contentWidth)} onOpen={setActionFor} onLongPress={setActionFor} />
            </>
          )}
        </View>
      </ScrollView>
      <NoteActionsSheet note={actionFor} onClose={() => setActionFor(null)} />
      <Dialog
        open={confirmEmpty}
        title={copy.trash.emptyAllTitle}
        body={copy.trash.emptyAllBody(notes?.length ?? 0)}
        cancel={{ label: copy.common.cancel, onPress: () => setConfirmEmpty(false) }}
        confirm={{
          label: copy.trash.emptyAll,
          variant: 'danger',
          onPress: async () => {
            await repo.emptyTrash();
            setConfirmEmpty(false);
            snack(copy.trash.deletedForever);
          },
        }}
      />
    </SafeAreaView>
  );
}
