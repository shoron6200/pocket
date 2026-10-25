/**
 * Schema migrations, tracked with PRAGMA user_version.
 * Source: replica/schema.sql. The full-text index is its own migration
 * because the web build of SQLite has no FTS5; there, search falls back
 * to LIKE (see repo.searchNotes).
 */
import type { Db } from './db';

const V1_CORE = `
create table if not exists folders (
  id          text primary key not null,
  name        text not null check (length(trim(name)) between 1 and 60),
  position    integer not null default 0,
  created_at  integer not null,
  updated_at  integer not null
);
create unique index if not exists folders_name_unique on folders (name collate nocase);
create index if not exists folders_position on folders (position);

create table if not exists notes (
  id           text primary key not null,
  type         text not null check (type in ('text', 'checklist')),
  title        text not null default '',
  body         text not null default '',
  color        text not null default 'default',
  font_family  text not null default 'default',
  font_size    text not null default 'm' check (font_size in ('s', 'm', 'l', 'xl')),
  folder_id    text references folders (id) on delete set null,
  pinned       integer not null default 0 check (pinned in (0, 1)),
  created_at   integer not null,
  updated_at   integer not null,
  deleted_at   integer
);
create index if not exists notes_home on notes (deleted_at, pinned desc, updated_at desc);
create index if not exists notes_folder on notes (folder_id, deleted_at, updated_at desc);
create index if not exists notes_trash on notes (deleted_at) where deleted_at is not null;

create table if not exists checklist_items (
  id          text primary key not null,
  note_id     text not null references notes (id) on delete cascade,
  text        text not null default '',
  checked     integer not null default 0 check (checked in (0, 1)),
  position    integer not null,
  created_at  integer not null,
  updated_at  integer not null
);
create index if not exists checklist_items_note on checklist_items (note_id, position);

create table if not exists reminders (
  id                  text primary key not null,
  note_id             text not null unique references notes (id) on delete cascade,
  fire_at             integer not null,
  timezone            text not null,
  local_time          text not null,
  repeat              text not null default 'none'
                      check (repeat in ('none', 'daily', 'weekly', 'monthly')),
  os_notification_id  text,
  status              text not null default 'scheduled'
                      check (status in ('scheduled', 'fired', 'done')),
  created_at          integer not null,
  updated_at          integer not null
);
create index if not exists reminders_due on reminders (status, fire_at);

create table if not exists settings (
  key    text primary key not null
         check (key in ('view_mode', 'sort', 'theme', 'last_backup_at', 'last_snapshot_at')),
  value  text not null
);
`;

const FTS_REFRESH = (idExpr: string) => `
  delete from notes_fts where note_id = ${idExpr};
  insert into notes_fts (note_id, title, content)
    select n.id, n.title,
           n.body || ' ' || coalesce((select group_concat(text, ' ')
                                      from checklist_items where note_id = n.id), '')
    from notes n where n.id = ${idExpr};`;

const V2_FTS = `
create virtual table if not exists notes_fts using fts5 (
  note_id unindexed, title, content, tokenize = 'unicode61 remove_diacritics 2'
);
create trigger if not exists notes_fts_insert after insert on notes begin
  insert into notes_fts (note_id, title, content) values (new.id, new.title, new.body);
end;
create trigger if not exists notes_fts_update after update of title, body on notes begin
  ${FTS_REFRESH('new.id')}
end;
create trigger if not exists notes_fts_delete after delete on notes begin
  delete from notes_fts where note_id = old.id;
end;
create trigger if not exists checklist_fts_insert after insert on checklist_items begin
  ${FTS_REFRESH('new.note_id')}
end;
create trigger if not exists checklist_fts_update after update of text on checklist_items begin
  ${FTS_REFRESH('new.note_id')}
end;
create trigger if not exists checklist_fts_delete after delete on checklist_items begin
  ${FTS_REFRESH('old.note_id')}
end;
insert into notes_fts (note_id, title, content)
  select n.id, n.title,
         n.body || ' ' || coalesce((select group_concat(text, ' ') from checklist_items where note_id = n.id), '')
  from notes n where n.id not in (select note_id from notes_fts);
`;

/**
 * v3: photos and videos on notes, and the Telegram backup's record of which
 * files it already sent. The settings table is rebuilt only to widen its list
 * of allowed keys (SQLite cannot change a CHECK in place).
 */
const V3_ATTACHMENTS = `
create table if not exists attachments (
  id           text primary key not null,
  note_id      text not null references notes (id) on delete cascade,
  kind         text not null check (kind in ('image', 'video')),
  file_name    text not null,
  mime         text not null,
  size         integer not null default 0,
  width        integer,
  height       integer,
  duration_ms  integer,
  sha256       text,
  position     integer not null,
  created_at   integer not null,
  updated_at   integer not null
);
create index if not exists attachments_note on attachments (note_id, position);
create index if not exists attachments_file on attachments (file_name);

create table if not exists telegram_files (
  sha256       text primary key not null,
  size         integer not null,
  parts        text not null,
  uploaded_at  integer not null
);

create table settings_v3 (
  key    text primary key not null
         check (key in ('view_mode', 'sort', 'theme', 'last_backup_at', 'last_snapshot_at',
                        'last_telegram_at', 'telegram_auto')),
  value  text not null
);
insert into settings_v3 (key, value) select key, value from settings;
drop table settings;
alter table settings_v3 rename to settings;
`;

export const SCHEMA_VERSION = 3;

export async function migrate(db: Db): Promise<{ fts: boolean }> {
  const row = await db.first<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;

  if (version < 1) {
    await db.transaction(async () => {
      await db.exec(V1_CORE);
      await db.exec('PRAGMA user_version = 1');
    });
  }
  if (version < 2) {
    try {
      await db.transaction(async () => {
        await db.exec(V2_FTS);
      });
    } catch {
      // No FTS5 in this SQLite build (web). Search uses LIKE instead.
    }
    await db.exec('PRAGMA user_version = 2');
  }
  if (version < 3) {
    await db.transaction(async () => {
      await db.exec(V3_ATTACHMENTS);
      await db.exec('PRAGMA user_version = 3');
    });
  }
  return { fts: await hasFts(db) };
}

export async function hasFts(db: Db): Promise<boolean> {
  const r = await db.first<{ n: number }>(
    "select count(*) as n from sqlite_master where name = 'notes_fts'",
  );
  return (r?.n ?? 0) > 0;
}
