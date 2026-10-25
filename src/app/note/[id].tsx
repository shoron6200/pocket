/**
 * S03 text note / S04 checklist editor. Autosave: title and body save on a
 * short debounce, and flush when the field blurs, the app goes to the
 * background, and the screen closes. A brand-new note left empty is discarded.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { ArchiveRestore, Bell, BellRing, FileQuestion, ImagePlus, MoreVertical, Palette, Pin, Type } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { copy } from '@/copy';
import { pickAndAttach, type PickSource } from '@/data/attachments';
import { useQuery, useRepo } from '@/data/DataProvider';
import { appFileStore } from '@/data/telegramRunner';
import type { NoteFull, NotePatch } from '@/data/types';
import { ChecklistEditor } from '@/features/ChecklistEditor';
import { AttachSheet, ColourSheet, FontSheet, ReminderSheet } from '@/features/editorSheets';
import { NoteActionsSheet } from '@/features/sheets';
import { useTheme } from '@/theme/theme';
import { Button, IconButton, Tag } from '@/ui/controls';
import { TextField } from '@/ui/fields';
import { editedLabel, reminderChip } from '@/ui/format';
import { Banner, EmptyState, TopBar } from '@/ui/layout';
import { MediaStrip } from '@/ui/media';
import { useSnackbar } from '@/ui/snackbar';
import { AppText } from '@/ui/Text';

type Sheet = 'colour' | 'font' | 'reminder' | 'attach' | 'actions' | null;

export default function NoteScreen() {
  const { id, isNew } = useLocalSearchParams<{ id: string; isNew?: string }>();
  const { data: note, error } = useQuery((r) => r.getNote(id), [id]);
  const t = useTheme();

  if (error || note === null) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.color.bg }}>
        <TopBar onBack={() => router.back()} />
        <EmptyState icon={FileQuestion} title={copy.editor.notFoundTitle} body={copy.editor.notFoundBody} />
      </SafeAreaView>
    );
  }
  if (!note) return <View style={{ flex: 1, backgroundColor: t.color.bg }} aria-busy />;
  return <Editor key={note.id} note={note} isNew={isNew === '1'} />;
}

function Editor({ note, isNew }: { note: NoteFull; isNew: boolean }) {
  const t = useTheme();
  const repo = useRepo();
  const snack = useSnackbar();
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [scrollOn, setScrollOn] = useState(true);
  const editable = note.deletedAt === null;

  // ---------------------------------------------------------- autosave
  // Saves as you type: one write in flight at a time, and the newest text
  // always follows it. A refresh or a killed app loses at most that one write.
  const pending = useRef<NotePatch>({});
  const writing = useRef<Promise<void> | null>(null);
  const itemFlush = useRef<() => Promise<void>>(async () => undefined);

  const drain = useCallback((): Promise<void> => {
    if (writing.current) return writing.current;
    const run = (async () => {
      while (Object.keys(pending.current).length) {
        const patch = pending.current;
        pending.current = {};
        await repo.updateNote(note.id, patch);
      }
    })().finally(() => {
      writing.current = null;
    });
    writing.current = run;
    return run;
  }, [repo, note.id]);

  const flush = useCallback(async () => {
    await drain();
    if (Object.keys(pending.current).length) await drain();
    await itemFlush.current();
  }, [drain]);

  const queue = (patch: NotePatch) => {
    pending.current = { ...pending.current, ...patch };
    void drain();
  };

  // Flush when the app is backgrounded (it may be killed after that).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') flush();
    });
    return () => sub.remove();
  }, [flush]);

  // Leaving the screen: save what is pending, then drop a brand-new note left empty.
  useEffect(() => {
    const noteId = note.id;
    return () => {
      flush()
        .then(() => (isNew ? repo.discardIfEmpty(noteId) : false))
        .catch(() => undefined);
    };
  }, [flush, repo, note.id, isNew]);

  // Live values for colour, font, pin, reminder, items: from the database.
  const live = useQuery((r) => r.getNote(note.id), [note.id]).data ?? note;

  // Turned into a note from a list (or back): the body comes from the database.
  const lastType = useRef(note.type);
  useEffect(() => {
    if (live.type !== lastType.current) {
      lastType.current = live.type;
      setBody(live.body);
    }
  }, [live.type, live.body]);
  const bg = t.note[live.color];

  const update = async (patch: NotePatch) => {
    await repo.updateNote(note.id, patch);
  };

  const attach = async (source: PickSource) => {
    setSheet(null);
    await flush();
    // Let the sheet finish closing: iOS can't show the picker over a closing sheet.
    if (Platform.OS !== 'web') await new Promise((r) => setTimeout(r, 350));
    try {
      const r = await pickAndAttach(repo, appFileStore(), note.id, source);
      if (r.denied) snack(copy.attach.denied);
      else if (r.failed) snack(copy.attach.failed(r.failed));
      else if (r.added.length) snack(copy.attach.added(r.added.length));
    } catch {
      snack(copy.attach.failed(1));
    }
  };

  const reminder = live.reminder;
  const chip = reminder ? reminderChip(reminder) : null;
  const isList = live.type === 'checklist';
  const maxW = t.layout['editor-max-width'];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={['top', 'left', 'right', 'bottom']}>
      <TopBar
        bg={bg}
        onBack={async () => {
          await flush();
          router.back();
        }}
        actions={
          editable ? (
            <>
              <IconButton icon={Pin} label={live.pinned ? copy.editor.unpin : copy.editor.pin} active={live.pinned} onPress={() => update({ pinned: !live.pinned })} />
              <IconButton icon={ImagePlus} label={copy.editor.attach} onPress={() => setSheet('attach')} />
              <IconButton icon={reminder ? BellRing : Bell} label={copy.editor.reminder} active={!!reminder && reminder.status === 'scheduled'} onPress={() => setSheet('reminder')} />
              <IconButton icon={Palette} label={copy.editor.colour} onPress={() => setSheet('colour')} />
              <IconButton icon={Type} label={copy.editor.font} onPress={() => setSheet('font')} />
              <IconButton icon={MoreVertical} label={copy.editor.more} onPress={() => setSheet('actions')} />
            </>
          ) : (
            <IconButton icon={MoreVertical} label={copy.editor.more} onPress={() => setSheet('actions')} />
          )
        }
      />

      <ScrollView
        scrollEnabled={scrollOn}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ alignItems: 'center', paddingBottom: t.space[8] }}
      >
        <View style={{ width: '100%', maxWidth: maxW, paddingHorizontal: t.layout.gutter, gap: t.space[2] }}>
          {!editable && (
            <View style={{ gap: t.space[2], marginBottom: t.space[2] }}>
              <Banner message={copy.editor.inTrash} />
              <Button
                label={copy.editor.restore}
                icon={ArchiveRestore}
                variant="secondary"
                onPress={async () => {
                  await repo.restoreNote(note.id);
                  snack(copy.trash.restored);
                }}
              />
            </View>
          )}

          <TextField
            variant="title"
            label={copy.editor.titlePlaceholder}
            placeholder={copy.editor.titlePlaceholder}
            value={title}
            editable={editable}
            font={live.font}
            onChangeText={(v) => {
              setTitle(v);
              queue({ title: v });
            }}
            onBlur={flush}
            returnKeyType="next"
            autoFocus={false}
            maxLength={300}
          />

          {chip && (
            <Tag
              icon={BellRing}
              label={chip.label}
              tone={chip.overdue ? 'danger' : 'muted'}
              onPress={editable ? () => setSheet('reminder') : undefined}
            />
          )}

          <MediaStrip
            items={live.attachments}
            onOpen={(a) => router.push({ pathname: '/media/[id]', params: { id: a.id } })}
            onAdd={editable ? () => setSheet('attach') : undefined}
          />

          {isList ? (
            <ChecklistEditor
              noteId={note.id}
              items={live.items}
              font={live.font}
              size={live.fontSize}
              editable={editable}
              onDragging={(d) => setScrollOn(!d)}
              registerFlush={(fn) => (itemFlush.current = fn)}
            />
          ) : (
            <TextField
              variant="body"
              label={copy.editor.bodyPlaceholder}
              placeholder={copy.editor.bodyPlaceholder}
              value={body}
              editable={editable}
              font={live.font}
              size={live.fontSize}
              autoFocus={!note.title && !note.body}
              onChangeText={(v) => {
                setBody(v);
                queue({ body: v });
              }}
              onBlur={flush}
              style={{ minHeight: t.layout['editor-body-min-height'] }}
            />
          )}

          <AppText variant="xs" tone="muted" style={{ marginTop: t.space[4] }}>
            {copy.editor.edited(editedLabel(live.updatedAt))}
          </AppText>
        </View>
      </ScrollView>

      <AttachSheet open={sheet === 'attach'} onClose={() => setSheet(null)} onPick={attach} />
      <ColourSheet open={sheet === 'colour'} onClose={() => setSheet(null)} value={live.color} onChange={(color) => update({ color })} />
      <FontSheet
        open={sheet === 'font'}
        onClose={() => setSheet(null)}
        font={live.font}
        size={live.fontSize}
        onFont={(font) => update({ font })}
        onSize={(fontSize) => update({ fontSize })}
      />
      <ReminderSheet
        open={sheet === 'reminder'}
        onClose={() => setSheet(null)}
        current={reminder}
        onSave={async (r) => {
          await flush();
          await repo.setReminder(note.id, r);
          snack(copy.reminder.set(reminderChip({ fireAt: r.fireAt, repeat: r.repeat, status: 'scheduled' }).label.replace(/^(Today|Tomorrow|Yesterday)\b/, (w) => w.toLowerCase())));
        }}
        onRemove={async () => {
          await repo.clearReminder(note.id);
          snack(copy.reminder.removed);
        }}
      />
      <NoteActionsSheet
        note={sheet === 'actions' ? { ...live, title: title } : null}
        onClose={() => setSheet(null)}
        leaveOnTrash
      />
    </SafeAreaView>
  );
}
