/** S01 Home: every note, newest first, filtered by folder. S02 is the FAB's speed dial. */
import { router } from 'expo-router';
import { CheckSquare, FileText, FolderOpen, LayoutGrid, MoreVertical, NotebookPen, Plus, Rows3, Search, Settings2, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { copy } from '@/copy';
import { useQuery, useRepo, useSettings } from '@/data/DataProvider';
import type { NoteSummary, NoteType } from '@/data/types';
import { NoteActionsSheet, SheetRow, FolderNameDialog } from '@/features/sheets';
import { gridColumns, useTheme, withAlpha } from '@/theme/theme';
import { Fab, FolderChip, IconButton } from '@/ui/controls';
import { EmptyState, TopBar } from '@/ui/layout';
import { GridSkeleton, NoteGrid } from '@/ui/NoteGrid';
import { BottomSheet } from '@/ui/overlays';
import { AppText, focusRing, type PState } from '@/ui/Text';

export default function Home() {
  const t = useTheme();
  const repo = useRepo();
  const settings = useSettings();
  const { width } = useWindowDimensions();
  const [selectedFolder, setSelectedFolder] = useState<string | undefined>(undefined);
  const [fabOpen, setFabOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [newFolder, setNewFolder] = useState(false);
  const [actionFor, setActionFor] = useState<NoteSummary | null>(null);
  const [scrolled, setScrolled] = useState(false);

  const foldersLoaded = useQuery((r) => r.listFolders(), []).data;
  const folders = foldersLoaded ?? [];
  // The selected folder was deleted elsewhere: show All.
  const folderId = selectedFolder && foldersLoaded && !foldersLoaded.some((f) => f.id === selectedFolder) ? undefined : selectedFolder;
  const setFolderId = setSelectedFolder;

  const sort = settings?.sort ?? 'updated';
  const viewMode = settings?.viewMode ?? 'grid';
  const notes = useQuery((r) => r.listNotes({ folderId, sort }), [folderId, sort]);
  const allCount = useQuery((r) => r.listNotes(), []).data?.length;


  const contentWidth = Math.min(width, 1280) - t.layout.gutter * 2;
  const columns = viewMode === 'list' ? 1 : gridColumns(contentWidth);
  const currentFolder = folders.find((f) => f.id === folderId);

  const create = async (type: NoteType) => {
    setFabOpen(false);
    const id = await repo.createNote({ type, folderId: folderId ?? null });
    router.push({ pathname: '/note/[id]', params: { id, isNew: '1' } });
  };

  // Android back closes the speed dial first.
  useEffect(() => {
    if (!fabOpen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setFabOpen(false);
      return true;
    });
    return () => sub.remove();
  }, [fabOpen]);

  const list = notes.data;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.color.bg }} edges={['top', 'left', 'right']}>
      <TopBar
        title={copy.home.title}
        scrolled={scrolled}
        actions={
          <>
            <IconButton icon={Search} label={copy.home.search} onPress={() => router.push('/search')} />
            <IconButton
              icon={viewMode === 'grid' ? Rows3 : LayoutGrid}
              label={viewMode === 'grid' ? copy.home.asList : copy.home.asGrid}
              onPress={() => repo.setSetting('viewMode', viewMode === 'grid' ? 'list' : 'grid')}
            />
            <IconButton icon={MoreVertical} label={copy.home.more} onPress={() => setMenuOpen(true)} />
          </>
        }
      />

      <ScrollView
        onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > 4)}
        scrollEventThrottle={32}
        contentContainerStyle={{ paddingBottom: t.layout['fab-size'] * 2 + t.space[6] }}
        stickyHeaderIndices={[0]}
      >
        {/* Folder chips */}
        <View style={{ width: '100%', backgroundColor: t.color.bg }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: t.space[2], paddingHorizontal: Math.max(t.layout.gutter, (width - contentWidth) / 2), paddingVertical: t.space[2], alignItems: 'center' }}
          >
            <View role="tablist" aria-label={copy.folder.title} style={{ flexDirection: 'row', gap: t.space[2] }}>
              <FolderChip label={copy.home.all} count={allCount} selected={!folderId} onPress={() => setFolderId(undefined)} />
              {folders.map((f) => (
                <FolderChip key={f.id} label={f.name} count={f.count} selected={folderId === f.id} onPress={() => setFolderId(f.id)} />
              ))}
            </View>
            <Pressable
              role="button"
              aria-label={copy.home.newFolder}
              onPress={() => setNewFolder(true)}
              hitSlop={6}
              style={(s: PState) => [
                styles.addChip,
                { borderRadius: t.radius.pill, borderColor: t.color.borderInput },
                (s.pressed || s.hovered) && { backgroundColor: withAlpha(t.color.text, 0.06) },
                focusRing(t, s, t.radius.pill),
              ]}
            >
              <Plus size={16} color={t.color.text} />
              <AppText variant="sm" weight="500">
                {copy.home.newFolder}
              </AppText>
            </Pressable>
          </ScrollView>
        </View>

        <View style={{ width: contentWidth, paddingTop: t.space[2], alignSelf: 'center' }}>
          {notes.error ? (
            <EmptyState icon={NotebookPen} title={copy.home.loadError} body={notes.error.message} action={{ label: copy.common.tryAgain, onPress: notes.reload }} />
          ) : !list ? (
            <GridSkeleton columns={columns} />
          ) : list.length === 0 ? (
            folderId ? (
              <EmptyState icon={FolderOpen} title={copy.home.emptyFolderTitle} body={copy.home.emptyFolderBody} />
            ) : (
              <EmptyState icon={NotebookPen} title={copy.home.emptyTitle} body={copy.home.emptyBody} />
            )
          ) : (
            <NoteGrid
              notes={list}
              columns={columns}
              showFolder={!folderId}
              onOpen={(n) => router.push({ pathname: '/note/[id]', params: { id: n.id } })}
              onLongPress={setActionFor}
            />
          )}
        </View>
      </ScrollView>

      {fabOpen && (
        <Pressable
          role="button"
          aria-label={copy.common.close}
          onPress={() => setFabOpen(false)}
          style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(t.color.scrim, 0.32) }]}
        />
      )}
      <Fab
        expanded={fabOpen}
        onPress={() => setFabOpen(!fabOpen)}
        style={{ position: 'absolute', right: t.layout['fab-offset'], bottom: t.layout['fab-offset'] + t.space[4] }}
        actions={[
          { label: copy.newItem.checklist, icon: CheckSquare, onPress: () => create('checklist') },
          { label: copy.newItem.text, icon: FileText, onPress: () => create('text') },
        ]}
      />

      <BottomSheet open={menuOpen} onClose={() => setMenuOpen(false)} title={currentFolder?.name ?? copy.home.title}>
        <SheetRow icon={FolderOpen} label={copy.settings.folders} onPress={() => (setMenuOpen(false), router.push('/folders'))} />
        <SheetRow icon={Trash2} label={copy.settings.trash} onPress={() => (setMenuOpen(false), router.push('/trash'))} />
        <SheetRow icon={Settings2} label={copy.settings.title} onPress={() => (setMenuOpen(false), router.push('/settings'))} />
      </BottomSheet>

      <FolderNameDialog open={newFolder} onClose={() => setNewFolder(false)} onSaved={(f) => setFolderId(f.id)} />

      <NoteActionsSheet
        note={actionFor && { ...actionFor, deletedAt: actionFor.deletedAt }}
        onClose={() => setActionFor(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  addChip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderWidth: 1, borderStyle: 'dashed' },
});
