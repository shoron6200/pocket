/**
 * Adding photos and videos to a note, and cleaning up files no note uses.
 * The file is copied into the app's own store first, then the row is added,
 * so a note never points at something that is not there.
 */
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';

import type { Repo } from './repo';
import type { Attachment, AttachmentKind, FileStore, NewAttachment } from './types';

import { holdFile } from './fileHelpers';

export { sweepUnusedFiles } from './fileHelpers';

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/3gpp': '3gp',
};

/** A safe extension for the stored copy: from the MIME type, else the original name. */
export function extensionFor(mime: string | undefined, fileName: string | null | undefined, kind: AttachmentKind): string {
  if (mime && EXT_BY_MIME[mime]) return EXT_BY_MIME[mime];
  const fromName = fileName?.split('.').pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{1,5}$/.test(fromName)) return fromName;
  return kind === 'video' ? 'mp4' : 'jpg';
}

export function mimeFor(ext: string, kind: AttachmentKind): string {
  const hit = Object.entries(EXT_BY_MIME).find(([, e]) => e === ext);
  return hit ? hit[0] : kind === 'video' ? 'video/mp4' : 'image/jpeg';
}

export type PickSource = 'camera' | 'library';
export type PickResult = { added: Attachment[]; denied: boolean; failed: number };

/** Ask for permission if needed, open the camera or gallery, and add what was chosen. */
export async function pickAndAttach(repo: Repo, store: FileStore, noteId: string, source: PickSource): Promise<PickResult> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images', 'videos'],
    // Originals, as chosen: no re-compression.
    quality: 1,
    exif: false,
  };
  let res: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return { added: [], denied: true, failed: 0 };
    res = await ImagePicker.launchCameraAsync(options);
  } else {
    res = await ImagePicker.launchImageLibraryAsync({ ...options, allowsMultipleSelection: true, selectionLimit: 30 });
  }
  if (res.canceled || !res.assets?.length) return { added: [], denied: false, failed: 0 };

  const list: NewAttachment[] = [];
  const releases: (() => void)[] = [];
  let failed = 0;
  for (const a of res.assets) {
    const kind: AttachmentKind = a.type === 'video' || a.mimeType?.startsWith('video/') ? 'video' : 'image';
    const ext = extensionFor(a.mimeType, a.fileName, kind);
    const fileName = `${Crypto.randomUUID()}.${ext}`;
    releases.push(holdFile(fileName));
    try {
      const size = await store.importUri(a.uri, fileName);
      list.push({
        kind,
        fileName,
        mime: a.mimeType ?? mimeFor(ext, kind),
        size: size || a.fileSize || 0,
        width: a.width || null,
        height: a.height || null,
        durationMs: kind === 'video' && a.duration ? Math.round(a.duration) : null,
      });
    } catch {
      failed++;
      await store.remove(fileName).catch(() => undefined);
    }
  }
  try {
    const added = list.length ? await repo.addAttachments(noteId, list) : [];
    return { added, denied: false, failed };
  } catch (e) {
    for (const a of list) await store.remove(a.fileName).catch(() => undefined);
    throw e;
  } finally {
    releases.forEach((r) => r());
  }
}
