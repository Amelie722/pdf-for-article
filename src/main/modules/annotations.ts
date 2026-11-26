// 주석 모듈: 하이라이트와 메모 저장·조회.
import { randomUUID } from 'node:crypto';
import { Annotation, AnnotationPatch, AnnotationWithDoc, Channels, NewAnnotation } from '../../shared/types';
import type { MainModule } from './types';

interface AnnRow {
  id: string;
  doc_id: string;
  page: number;
  kind: string;
  color: string;
  text: string;
  note: string;
  rects: string;
  created_at: string;
  updated_at: string;
  file_name?: string;
  path?: string;
}

const toAnnotation = (r: AnnRow): Annotation => ({
  id: r.id,
  docId: r.doc_id,
  page: r.page,
  kind: r.kind as Annotation['kind'],
  color: r.color,
  text: r.text,
  note: r.note,
  rects: JSON.parse(r.rects),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const annotationsModule: MainModule = {
  id: 'annotations',
  setup({ db, handle }) {
    const byId = (id: string) => {
      const row = db.get<AnnRow>('SELECT * FROM annotations WHERE id = ?', [id]);
      if (!row) throw new Error(`주석을 찾을 수 없습니다: ${id}`);
      return toAnnotation(row);
    };

    handle(Channels.listAnnotations, (_e, docId: string) =>
      db
        .all<AnnRow>('SELECT * FROM annotations WHERE doc_id = ? ORDER BY page, created_at', [docId])
        .map(toAnnotation),
    );

    handle(Channels.listAllAnnotations, (): AnnotationWithDoc[] =>
      db
        .all<AnnRow>(
          `SELECT a.*, d.file_name, d.path FROM annotations a
           JOIN documents d ON d.id = a.doc_id
           ORDER BY d.last_opened_at DESC, a.page, a.created_at`,
        )
        .map((r) => ({ ...toAnnotation(r), fileName: r.file_name!, path: r.path! })),
    );

    handle(Channels.addAnnotation, (_e, a: NewAnnotation) => {
      const id = randomUUID();
      const now = new Date().toISOString();
      db.run(
        `INSERT INTO annotations (id, doc_id, page, kind, color, text, note, rects, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, a.docId, a.page, a.kind, a.color, a.text, a.note, JSON.stringify(a.rects), now, now],
      );
      return byId(id);
    });

    handle(Channels.updateAnnotation, (_e, id: string, patch: AnnotationPatch) => {
      const cur = byId(id);
      const next = { ...cur, ...patch };
      db.run('UPDATE annotations SET color = ?, note = ?, kind = ?, updated_at = ? WHERE id = ?', [
        next.color,
        next.note,
        next.kind,
        new Date().toISOString(),
        id,
      ]);
      return byId(id);
    });

    handle(Channels.deleteAnnotation, (_e, id: string) => {
      db.run('DELETE FROM annotations WHERE id = ?', [id]);
    });
  },
};
