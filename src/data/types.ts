import type { NoteColor, NoteFont, NoteSize } from '../theme/constants';
import type { Repeat } from './time';

export type NoteType = 'text' | 'checklist';
export type Sort = 'updated' | 'created' | 'title';
export type ViewMode = 'grid' | 'list';
export type ThemeSetting = 'system' | 'light' | 'dark';

export type Item = { id: string; noteId: string; text: string; checked: boolean; position: number };

export type AttachmentKind = 'image' | 'video';

/** A photo or video on a note. The file itself lives in the attachment store under `fileName`. */
export type Attachment = {
  id: string;
  noteId: string;
  kind: AttachmentKind;
  fileName: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  sha256: string | null;
  position: number;
  createdAt: number;
};

export type NewAttachment = Pick<Attachment, 'kind' | 'fileName' | 'mime' | 'size'> &
  Partial<Pick<Attachment, 'id' | 'width' | 'height' | 'durationMs' | 'sha256'>>;

export type Reminder = {
  id: string;
  noteId: string;
  fireAt: number;
  timezone: string;
  localTime: string;
  repeat: Repeat;
  osNotificationId: string | null;
  status: 'scheduled' | 'fired' | 'done';
};

/** One card on the home grid, in search results, or in the trash. */
export type NoteSummary = {
  id: string;
  type: NoteType;
  title: string;
  preview: string;
  color: NoteColor;
  font: NoteFont;
  pinned: boolean;
  folderId: string | null;
  folderName: string | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  items: { text: string; checked: boolean }[];
  itemCount: number;
  doneCount: number;
  reminder: Pick<Reminder, 'fireAt' | 'repeat' | 'status'> | null;
  /** First photo or video, shown on the card. */
  cover: Pick<Attachment, 'kind' | 'fileName'> | null;
  attachmentCount: number;
};

export type NoteFull = {
  id: string;
  type: NoteType;
  title: string;
  body: string;
  color: NoteColor;
  font: NoteFont;
  fontSize: NoteSize;
  pinned: boolean;
  folderId: string | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  items: Item[];
  reminder: Reminder | null;
  attachments: Attachment[];
};

export type NotePatch = Partial<
  Pick<NoteFull, 'title' | 'body' | 'color' | 'font' | 'fontSize' | 'folderId' | 'pinned'>
>;

export type Folder = { id: string; name: string; position: number; count: number };

export type Settings = {
  viewMode: ViewMode;
  sort: Sort;
  theme: ThemeSetting;
  lastBackupAt: number | null;
  lastSnapshotAt: number | null;
  lastTelegramAt: number | null;
  /** Daily automatic Telegram backup (on by default once connected). */
  telegramAuto: boolean;
};

/** Where one file lives in the Telegram chat: its parts, in order. */
export type TelegramPart = { fileId: string; size: number };

/** What the OS notification layer must do. A no-op on web. */
export interface Scheduler {
  schedule(r: { noteId: string; title: string; body: string; fireAt: number }): Promise<string | null>;
  cancel(osId: string): Promise<void>;
  /** Everything currently scheduled by this app: OS id -> note id. */
  listScheduled(): Promise<{ osId: string; noteId: string | null }[]>;
  /** iOS keeps at most 64 pending local notifications per app. */
  maxPending: number;
}

export class DuplicateFolderError extends Error {
  constructor() {
    super('duplicate folder name');
    this.name = 'DuplicateFolderError';
  }
}

export class BackupFormatError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'BackupFormatError';
  }
}

/**
 * Where photo and video files live. The phone keeps them in the app's own
 * documents folder (fileStore.ts); the web preview uses IndexedDB
 * (fileStore.web.ts); the tests keep them in memory.
 */
export interface FileStore {
  /** Something an <Image> or video player can load, or null if the file is missing. */
  uri(name: string): Promise<string | null>;
  exists(name: string): Promise<boolean>;
  size(name: string): Promise<number>;
  /** Lowercase hex SHA-256 of the file's contents. */
  sha256(name: string): Promise<string>;
  read(name: string, offset: number, length: number): Promise<Uint8Array>;
  /** Copy a file the picker returned into the store. Returns its size. */
  importUri(srcUri: string, name: string): Promise<number>;
  /** Build a file piece by piece; it only appears under `name` after commit. */
  writer(name: string): Promise<FileWriter>;
  remove(name: string): Promise<void>;
  list(): Promise<string[]>;
}

export interface FileWriter {
  append(bytes: Uint8Array): Promise<void>;
  commit(): Promise<void>;
  abort(): Promise<void>;
}
