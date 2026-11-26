// 문서 모듈: PDF 파일 열기, 문서 목록 관리.
import { dialog } from 'electron';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { Channels, DocumentRecord, OpenedFile } from '../../shared/types';
import type { Db } from '../db';
import type { MainModule } from './types';

interface DocRow {
  id: string;
  path: string;
  file_name: string;
  added_at: string;
  last_opened_at: string;
}

const toRecord = (r: DocRow): DocumentRecord => ({
  id: r.id,
  path: r.path,
  fileName: r.file_name,
  addedAt: r.added_at,
  lastOpenedAt: r.last_opened_at,
});

export async function openDocument(db: Db, path: string): Promise<OpenedFile> {
  const buf = await readFile(path);
  const id = createHash('sha256').update(buf).digest('hex');
  const now = new Date().toISOString();
  const existing = db.get<DocRow>('SELECT * FROM documents WHERE id = ?', [id]);
  if (existing) {
    db.run('UPDATE documents SET path = ?, file_name = ?, last_opened_at = ? WHERE id = ?', [
      path,
      basename(path),
      now,
      id,
    ]);
  } else {
    db.run(
      'INSERT INTO documents (id, path, file_name, added_at, last_opened_at) VALUES (?, ?, ?, ?, ?)',
      [id, path, basename(path), now, now],
    );
  }
  const row = db.get<DocRow>('SELECT * FROM documents WHERE id = ?', [id])!;
  return { doc: toRecord(row), data: new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength) };
}

export const documentsModule: MainModule = {
  id: 'documents',
  setup(ctx) {
    ctx.handle(Channels.openFileDialog, async () => {
      const win = ctx.getWindow();
      const opts = { properties: ['openFile' as const], filters: [{ name: 'PDF', extensions: ['pdf'] }] };
      const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
      return res.canceled ? null : res.filePaths[0] ?? null;
    });
    ctx.handle(Channels.openPath, (_e, path: string) => openDocument(ctx.db, path));
    ctx.handle(Channels.recent, (_e, limit: number) =>
      ctx.db
        .all<DocRow>('SELECT * FROM documents ORDER BY last_opened_at DESC LIMIT ?', [limit])
        .map(toRecord),
    );
  },
};
